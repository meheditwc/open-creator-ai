import { createReadStream } from 'node:fs';
import { rm, stat } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AGENT_SYSTEM_PROMPT, TOOLS, localAgentReply } from '@open-creator/shared';
import type {
  AppSettings,
  Capabilities,
  ChatResponse,
  Project,
  Run,
  RunInput,
} from '@open-creator/shared';
import { JsonStore, SettingsStore, storePaths } from './store.ts';
import { LlmClient } from './llm.ts';
import { resolveFfmpeg, resolveOptional } from './media.ts';
import { providerConfigured } from './provider.ts';
import { imageCapability } from './imagegen.ts';
import { RenderQueue, artifactsDir, executeRun, mimeFor } from './worker.ts';
import { logger } from './logger.ts';
import type { AppConfig } from './config.ts';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

interface RouteContext {
  params: Record<string, string>;
  query: URLSearchParams;
  body: Record<string, unknown>;
}

type Handler = (context: RouteContext) => Promise<unknown> | unknown;

interface Route {
  method: string;
  pattern: RegExp;
  keys: string[];
  handler: Handler;
}

export class Daemon {
  private readonly routes: Route[] = [];
  private readonly projects: JsonStore<Project>;
  private readonly runs: JsonStore<Run>;
  private readonly settingsStore: SettingsStore<AppSettings>;
  private readonly startedAt = new Date();
  /** Resolves once the persisted state is in memory (and repaired if needed). */
  private readonly ready: Promise<void>;
  /** Two renders at a time keeps ffmpeg from starving the HTTP server. */
  private readonly queue = new RenderQueue(2, (runId) => this.executeRunById(runId));

  private readonly config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
    const paths = storePaths(config.dataDir);
    this.projects = new JsonStore<Project>(paths.projects, () => []);
    this.runs = new JsonStore<Run>(paths.runs, () => []);
    this.settingsStore = new SettingsStore<AppSettings>(paths.settings, () => ({
      llm: {
        baseUrl: process.env.FREELLMAPI_BASE_URL ?? 'http://localhost:3001/v1',
        apiKey: process.env.FREELLMAPI_API_KEY ?? '',
        model: process.env.OPENCREATOR_MODEL ?? 'gpt-4o-mini',
        fastModel: process.env.OPENCREATOR_FAST_MODEL ?? 'gpt-4o-mini',
        imageModel: process.env.OPENCREATOR_IMAGE_MODEL ?? '',
      },
      dataDir: config.dataDir,
      useFreeRouter: true,
      autosave: true,
      keylessImages: process.env.OPENCREATOR_KEYLESS_IMAGES !== '0',
    }));
    this.registerRoutes();
    this.ready = this.bootstrap();
  }

  /* ------------------------------------------------------------------ */
  /* Startup                                                             */
  /* ------------------------------------------------------------------ */

  /** Read the persisted workspace and repair anything a crash left behind. */
  private async bootstrap(): Promise<void> {
    try {
      await Promise.all([this.projects.load(), this.runs.load()]);
      await this.recoverInterruptedRuns();
    } catch (error) {
      // Never block the API because of a stubborn data file — the daemon
      // still serves requests, it just starts from an empty workspace.
      logger.error(`could not restore the workspace: ${String(error)}`);
    }
  }

  /**
   * Runs are advanced by an in-process timer, so a restart leaves them stuck in
   * `queued`/`running` forever. Report them honestly instead of lying.
   */
  private async recoverInterruptedRuns(): Promise<void> {
    const interrupted = this.runs
      .all()
      .filter((run) => run.status === 'queued' || run.status === 'running');
    if (interrupted.length === 0) return;
    const now = new Date().toISOString();
    for (const run of interrupted) {
      await this.runs.put({
        ...run,
        status: 'failed',
        message: 'Interrupted by a daemon restart — start the run again.',
        updatedAt: now,
      });
    }
    logger.warn(`${interrupted.length} interrupted run(s) marked as failed after a restart`);
  }

  /* ------------------------------------------------------------------ */
  /* Routing                                                             */
  /* ------------------------------------------------------------------ */

  private route(method: string, path: string, handler: Handler): void {
    const keys: string[] = [];
    const pattern = new RegExp(
      `^${path.replace(/:([A-Za-z0-9_]+)/g, (_match, key: string) => {
        keys.push(key);
        return '([^/]+)';
      })}$`,
    );
    this.routes.push({ method, pattern, keys, handler });
  }

  private registerRoutes(): void {
    this.route('GET', '/api/health', async () => this.health());
    this.route('GET', '/api/tools', () => this.listTools());

    this.route('GET', '/api/projects', async () => this.listProjects());

    this.route('POST', '/api/projects', async ({ body }) =>
      this.createProject({
        name: String(body.name ?? ''),
        description: body.description === undefined ? undefined : String(body.description),
      }),
    );

    this.route('PATCH', '/api/projects/:id', async ({ params, body }) =>
      this.updateProject(params.id, {
        name: body.name === undefined ? undefined : String(body.name),
        description: body.description === undefined ? undefined : String(body.description),
        status: body.status === 'archived' || body.status === 'active' ? body.status : undefined,
      }),
    );

    this.route('DELETE', '/api/projects/:id', async ({ params }) => this.deleteProject(params.id));

    this.route('GET', '/api/runs', async ({ query }) =>
      this.listRuns(query.get('projectId') ?? undefined),
    );

    this.route('POST', '/api/runs', async ({ body }) => this.createRun(parseRunInput(body)));

    this.route('GET', '/api/runs/:id', async ({ params }) => this.getRunOrThrow(params.id));

    this.route('DELETE', '/api/runs/:id', async ({ params }) => this.deleteRun(params.id));

    this.route('GET', '/api/capabilities', async () => this.capabilities());

    this.route('GET', '/api/settings', async () => this.getSettings());

    this.route('PUT', '/api/settings', async ({ body }) => this.updateSettings(body));

    this.route('POST', '/api/agent/chat', async ({ body }) =>
      this.chat(
        String(body.message ?? ''),
        body.projectId === undefined ? undefined : String(body.projectId),
      ),
    );
  }

  /* ------------------------------------------------------------------ */
  /* Operations                                                          */
  /* ------------------------------------------------------------------ */

  listTools(): { items: typeof TOOLS; total: number } {
    return { items: TOOLS, total: TOOLS.length };
  }

  async listProjects(): Promise<{ items: Project[]; total: number }> {
    await this.ready;
    const items = this.projects.all().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return { items, total: items.length };
  }

  async createProject(input: { name: string; description?: string }): Promise<Project> {
    const name = input.name.trim();
    if (!name) throw new HttpError(400, 'Project name is required');
    const now = new Date().toISOString();
    const project: Project = {
      id: createId('prj'),
      name,
      description: input.description ?? '',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    await this.projects.put(project);
    return project;
  }

  async updateProject(
    id: string,
    patch: { name?: string; description?: string; status?: Project['status'] },
  ): Promise<Project> {
    const existing = this.projects.get(id);
    if (!existing) throw new HttpError(404, 'Project not found');
    const updated: Project = {
      ...existing,
      name: patch.name === undefined ? existing.name : patch.name,
      description: patch.description === undefined ? existing.description : patch.description,
      status: patch.status === undefined ? existing.status : patch.status,
      updatedAt: new Date().toISOString(),
    };
    await this.projects.put(updated);
    return updated;
  }

  async deleteProject(id: string): Promise<{ deleted: boolean }> {
    const removed = await this.projects.remove(id);
    if (!removed) throw new HttpError(404, 'Project not found');
    const orphanRuns = this.runs.all().filter((run) => run.projectId === id);
    for (const run of orphanRuns) {
      await this.runs.remove(run.id);
      await rm(join(artifactsDir(this.config.dataDir), run.id), {
        recursive: true,
        force: true,
      });
    }
    return { deleted: true };
  }

  async listRuns(projectId?: string): Promise<{ items: Run[]; total: number }> {
    await this.ready;
    const items = this.runs
      .all()
      .filter((run) => (projectId ? run.projectId === projectId : true))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { items, total: items.length };
  }

  getRun(id: string): Run | undefined {
    return this.runs.get(id);
  }

  async createRun(input: RunInput): Promise<Run> {
    await this.ready;
    const tool = TOOLS.find((candidate) => candidate.id === input.tool);
    if (!tool) throw new HttpError(400, `Unknown tool: ${input.tool || '(missing)'}`);
    const projectId = input.projectId ?? '';
    if (projectId && !this.projects.get(projectId)) {
      throw new HttpError(404, 'Project not found');
    }
    const now = new Date().toISOString();
    const run: Run = {
      id: createId('run'),
      projectId,
      tool: tool.id,
      title: (input.title?.trim() || tool.name).slice(0, 140),
      status: 'queued',
      progress: 0,
      message: 'Queued — waiting for a render slot.',
      artifacts: [],
      notes: [],
      input,
      createdAt: now,
      updatedAt: now,
    };
    await this.runs.put(run);
    this.queue.enqueue(run.id);
    return run;
  }

  async getRunOrThrow(id: string): Promise<Run> {
    await this.ready;
    const run = this.runs.get(id);
    if (!run) throw new HttpError(404, 'Run not found');
    return run;
  }

  async deleteRun(id: string): Promise<{ deleted: boolean }> {
    await this.ready;
    const removed = await this.runs.remove(id);
    if (!removed) throw new HttpError(404, 'Run not found');
    await rm(join(artifactsDir(this.config.dataDir), id), { recursive: true, force: true });
    return { deleted: true };
  }

  /** What this machine can actually render right now. */
  async capabilities(): Promise<Capabilities> {
    const settings = await this.settingsStore.get();
    const [ffmpegInfo, ytDlp] = await Promise.all([resolveFfmpeg(), resolveOptional('yt-dlp')]);
    const configured = providerConfigured(settings.llm);
    const probe = configured
      ? await new LlmClient(settings.llm).probe()
      : { reachable: false, models: [] as string[] };

    const tools: Capabilities['tools'] = {};
    for (const tool of TOOLS) {
      const missing: string[] = [];
      if (tool.engine !== 'external' && !ffmpegInfo.available) missing.push('ffmpeg');
      if (tool.engine === 'external' && !ytDlp.available) missing.push('yt-dlp');
      if (tool.engine === 'provider' && !configured) missing.push('text + TTS provider');
      tools[tool.id] = { ready: missing.length === 0, missing };
    }

    return {
      ffmpeg: ffmpegInfo,
      ytDlp,
      provider: { configured, reachable: probe.reachable, models: probe.models },
      images: imageCapability(settings),
      tools,
    };
  }

  private async executeRunById(runId: string): Promise<void> {
    const run = this.runs.get(runId);
    if (!run) return;
    await executeRun(run, {
      dataDir: this.config.dataDir,
      getSettings: () => this.settingsStore.get(),
      updateRun: async (id, patch) => {
        const current = this.runs.get(id);
        if (!current) return;
        await this.runs.put({ ...current, ...patch });
      },
    });
  }

  async getSettings(): Promise<AppSettings> {
    return this.settingsStore.get();
  }

  async updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.settingsStore.get();
    const llm = { ...current.llm, ...(patch.llm ?? {}) };
    return this.settingsStore.set({ ...current, ...patch, llm });
  }

  async chat(message: string, projectId?: string): Promise<ChatResponse> {
    // `projectId` lets a future provider scope the conversation; the offline
    // planner is project-agnostic, so it is accepted but not required.
    const trimmed = message.trim();
    if (!trimmed) throw new HttpError(400, 'Message is required');
    void projectId;
    const settings = await this.settingsStore.get();
    const client = new LlmClient(settings.llm);

    if (settings.useFreeRouter && settings.llm.baseUrl && settings.llm.apiKey) {
      try {
        const result = await client.chat(AGENT_SYSTEM_PROMPT, trimmed);
        const response: ChatResponse = {
          reply: result.content,
          source: 'llm',
          model: result.model,
          suggestions: ['Start a run from this plan', 'Save this as a project', 'Refine the plan'],
        };
        return response;
      } catch (error) {
        logger.warn(`LLM provider unavailable (${String(error)}) — using local planner`);
      }
    }

    const local = localAgentReply(trimmed);
    const response: ChatResponse = {
      reply: local.reply,
      source: 'local',
      suggestions: local.suggestions,
    };
    return response;
  }

  private async updateRun(runId: string, patch: Partial<Run>): Promise<void> {
    const run = this.runs.get(runId);
    if (!run) return;
    await this.runs.put({ ...run, ...patch, updatedAt: new Date().toISOString() });
  }

  /* ------------------------------------------------------------------ */
  /* Health                                                              */
  /* ------------------------------------------------------------------ */

  async health(): Promise<unknown> {
    await this.ready;
    const settings = await this.settingsStore.get();
    const probe = await new LlmClient(settings.llm).probe();
    return {
      status: 'ok',
      version: this.config.version,
      uptimeSeconds: Math.round((Date.now() - this.startedAt.getTime()) / 1000),
      startedAt: this.startedAt.toISOString(),
      projects: this.projects.all().length,
      runs: this.runs.all().length,
      llm: {
        reachable: probe.reachable,
        baseUrl: settings.llm.baseUrl,
        models: probe.models,
        error: probe.error,
      },
    };
  }

  /* ------------------------------------------------------------------ */
  /* HTTP plumbing                                                       */
  /* ------------------------------------------------------------------ */

  private applyCors(request: IncomingMessage, response: ServerResponse): void {
    const origin = request.headers.origin;
    const allowed = this.config.corsOrigins.includes('*')
      ? (origin ?? '*')
      : (this.config.corsOrigins.find((candidate) => candidate === origin) ?? '');
    if (allowed) {
      response.setHeader('access-control-allow-origin', allowed);
      response.setHeader('access-control-allow-credentials', 'true');
      response.setHeader(
        'access-control-allow-headers',
        'content-type, authorization, x-open-creator-key',
      );
      response.setHeader('access-control-allow-methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
      response.setHeader('vary', 'origin');
    }
  }

  async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    this.applyCors(request, response);

    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }

    // Every request waits for the persisted state, so `/api/projects` right
    // after a restart returns the stored projects instead of an empty list.
    await this.ready;

    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);

    if (url.pathname.startsWith('/api/artifacts/')) {
      await this.serveArtifact(url.pathname, request, response);
      return;
    }

    for (const route of this.routes) {
      if (route.method !== request.method) continue;
      const match = route.pattern.exec(url.pathname);
      if (!match) continue;

      const params: Record<string, string> = {};
      route.keys.forEach((key, index) => {
        params[key] = decodeURIComponent(match[index + 1]);
      });

      try {
        const body =
          request.method === 'GET' || request.method === 'DELETE' ? {} : await readJson(request);
        const result = await route.handler({ params, query: url.searchParams, body });
        this.sendJson(response, 200, result ?? {});
      } catch (error) {
        if (error instanceof HttpError) {
          this.sendJson(response, error.status, { error: error.code, message: error.message });
        } else {
          logger.error(String(error));
          this.sendJson(response, 500, {
            error: 'InternalError',
            message: error instanceof Error ? error.message : 'Unexpected error',
          });
        }
      }
      return;
    }

    if (url.pathname.startsWith('/api/')) {
      this.sendJson(response, 404, { error: 'NotFound', message: `No route for ${url.pathname}` });
      return;
    }

    await this.serveStatic(url.pathname, response);
  }

  private sendJson(response: ServerResponse, status: number, payload: unknown): void {
    const body = JSON.stringify(payload);
    response.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'content-length': Buffer.byteLength(body),
      'cache-control': 'no-store',
    });
    response.end(body);
  }

  /**
   * Serve a rendered file with Range support so video scrubbing works in the
   * browser. Only files inside `artifacts/<runId>/` are reachable.
   */
  private async serveArtifact(
    pathname: string,
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    const match = /^\/api\/artifacts\/([^/]+)\/(.+)$/.exec(pathname);
    if (!match) {
      this.sendJson(response, 404, { error: 'NotFound', message: 'Artifact not found' });
      return;
    }

    let runId: string;
    let name: string;
    try {
      runId = decodeURIComponent(match[1]);
      name = decodeURIComponent(match[2]);
    } catch {
      this.sendJson(response, 400, { error: 'BadRequest', message: 'Malformed artifact path' });
      return;
    }

    const dir = join(artifactsDir(this.config.dataDir), runId);
    const filePath = normalize(join(dir, name));
    if (!filePath.startsWith(`${dir}${sep}`) || name.includes('..')) {
      this.sendJson(response, 403, { error: 'Forbidden', message: 'Invalid artifact path' });
      return;
    }

    try {
      const info = await stat(filePath);
      if (!info.isFile()) throw new Error('not a file');

      const type = mimeFor(name);
      const headers: Record<string, string> = {
        'content-type': type,
        'cache-control': 'private, max-age=300',
        'accept-ranges': 'bytes',
        'content-disposition': `inline; filename="${name.replace(/"/g, '')}"`,
      };

      const range = request.headers.range;
      if (range) {
        const parsed = /bytes=(\d*)-(\d*)/.exec(range);
        const start = parsed?.[1] ? Number.parseInt(parsed[1], 10) : 0;
        const end = parsed?.[2] ? Number.parseInt(parsed[2], 10) : info.size - 1;
        if (Number.isNaN(start) || start >= info.size) {
          response.writeHead(416, { 'content-range': `bytes */${info.size}` });
          response.end();
          return;
        }
        const safeEnd = Math.min(end, info.size - 1);
        response.writeHead(206, {
          ...headers,
          'content-range': `bytes ${start}-${safeEnd}/${info.size}`,
          'content-length': String(safeEnd - start + 1),
        });
        createReadStream(filePath, { start, end: safeEnd }).pipe(response);
        return;
      }

      response.writeHead(200, { ...headers, 'content-length': String(info.size) });
      createReadStream(filePath).pipe(response);
    } catch {
      this.sendJson(response, 404, { error: 'NotFound', message: `No artifact named ${name}` });
    }
  }

  /** Serve the built studio (apps/web/dist) when it exists. */
  private async serveStatic(pathname: string, response: ServerResponse): Promise<void> {
    const distDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../web/dist');
    const candidate = normalize(join(distDir, pathname === '/' ? 'index.html' : pathname));
    if (!candidate.startsWith(distDir)) {
      response.writeHead(403).end('Forbidden');
      return;
    }

    let filePath = candidate;
    try {
      const info = await stat(filePath);
      if (info.isDirectory()) filePath = join(filePath, 'index.html');
    } catch {
      filePath = join(distDir, 'index.html');
    }

    try {
      await stat(filePath);
    } catch {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end(
        'The studio bundle is not built yet.\n\nRun `npm run build` (or `npm run dev` for the Vite dev server).\n',
      );
      return;
    }

    const type = MIME[extname(filePath)] ?? 'application/octet-stream';
    response.writeHead(200, { 'content-type': type });
    createReadStream(filePath).pipe(response);
  }

  listen(): void {
    const server = createServer((request, response) => {
      void this.handle(request, response);
    });

    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(
          `port ${this.config.port} is already in use — stop the other process or set PORT`,
        );
      } else {
        logger.error(`server error: ${error.message}`);
      }
      process.exit(1);
    });

    void this.ready.then(() => {
      server.listen(this.config.port, this.config.host, () => {
        logger.success(`daemon listening on http://${this.config.host}:${this.config.port}`);
        logger.info(`data directory: ${this.config.dataDir} (version ${this.config.version})`);
      });
    });
  }
}

/* -------------------------------------------------------------------- */

const ERROR_CODES: Record<number, string> = {
  400: 'BadRequest',
  403: 'Forbidden',
  404: 'NotFound',
  409: 'Conflict',
  413: 'PayloadTooLarge',
  429: 'TooManyRequests',
  500: 'InternalError',
  502: 'BadGateway',
};

export class HttpError extends Error {
  readonly status: number;
  /** Stable, machine-readable code such as `BadRequest` or `NotFound`. */
  readonly code: string;

  constructor(status: number, message: string, code = ERROR_CODES[status] ?? 'Error') {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

/** Validate and normalise the JSON body of `POST /api/runs`. */
function parseRunInput(body: Record<string, unknown>): RunInput {
  const text = (value: unknown): string | undefined =>
    value === undefined || value === null ? undefined : String(value).slice(0, 8000);

  const aspect =
    body.aspect === '16:9' || body.aspect === '9:16' || body.aspect === '1:1'
      ? body.aspect
      : undefined;

  const number = (value: unknown): number | undefined => {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  return {
    tool: String(body.tool ?? ''),
    projectId: text(body.projectId),
    title: text(body.title),
    prompt: text(body.prompt),
    sourceUrl: text(body.sourceUrl),
    language: text(body.language),
    aspect,
    durationSeconds: number(body.durationSeconds),
    variants: number(body.variants),
  };
}

function createId(prefix: string): string {
  const stamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${stamp}${random}`;
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = chunk as Buffer;
    size += buffer.length;
    if (size > 2_000_000) throw new HttpError(413, 'Request body too large');
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
    return { value: parsed };
  } catch {
    throw new HttpError(400, 'Invalid JSON body');
  }
}
