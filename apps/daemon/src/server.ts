import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AGENT_SYSTEM_PROMPT, TOOLS, localAgentReply } from '@open-creator/shared';
import type { AppSettings, ChatResponse, Project, Run } from '@open-creator/shared';
import { JsonStore, SettingsStore, storePaths } from './store.ts';
import { LlmClient } from './llm.ts';
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
      },
      dataDir: config.dataDir,
      useFreeRouter: true,
      autosave: true,
    }));
    this.registerRoutes();
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

    this.route('POST', '/api/runs', async ({ body }) =>
      this.createRun({
        tool: String(body.tool ?? ''),
        projectId: body.projectId === undefined ? undefined : String(body.projectId),
        title: body.title === undefined ? undefined : String(body.title),
      }),
    );

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
    for (const run of orphanRuns) await this.runs.remove(run.id);
    return { deleted: true };
  }

  async listRuns(projectId?: string): Promise<{ items: Run[]; total: number }> {
    const items = this.runs
      .all()
      .filter((run) => (projectId ? run.projectId === projectId : true))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { items, total: items.length };
  }

  getRun(id: string): Run | undefined {
    return this.runs.get(id);
  }

  async createRun(input: { tool: string; projectId?: string; title?: string }): Promise<Run> {
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
      title: input.title ?? tool.name,
      status: 'queued',
      progress: 0,
      message: 'Queued — waiting for a worker.',
      createdAt: now,
      updatedAt: now,
    };
    await this.runs.put(run);
    this.advanceRun(run.id).catch((error) => logger.error(String(error)));
    return run;
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

  private async advanceRun(runId: string): Promise<void> {
    const run = this.runs.get(runId);
    if (!run) return;
    const tool = TOOLS.find((candidate) => candidate.id === run.tool);

    await this.updateRun(runId, { status: 'running', progress: 25, message: 'Preparing inputs…' });
    await delay(350);
    await this.updateRun(runId, {
      progress: 65,
      message: `${tool?.name ?? run.tool}: ${tool?.pipeline[0] ?? 'pipeline'} → ${
        tool?.pipeline[1] ?? tool?.pipeline[0] ?? 'output'
      }`,
    });
    await delay(350);
    await this.updateRun(runId, {
      status: 'completed',
      progress: 100,
      message: `Completed with ${tool?.outputs.length ?? 1} output${
        (tool?.outputs.length ?? 1) === 1 ? '' : 's'
      }. Add a local worker to render the assets.`,
    });
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

    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);

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
          this.sendJson(response, error.status, { error: error.name, message: error.message });
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
    createServer((request, response) => {
      void this.handle(request, response);
    }).listen(this.config.port, this.config.host, () => {
      logger.success(`daemon listening on http://${this.config.host}:${this.config.port}`);
      logger.info(`data directory: ${this.config.dataDir}`);
    });
  }
}

/* -------------------------------------------------------------------- */

export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

function createId(prefix: string): string {
  const stamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${stamp}${random}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
