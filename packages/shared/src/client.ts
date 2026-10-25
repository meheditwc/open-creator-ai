import type {
  AppSettings,
  ChatResponse,
  DaemonHealth,
  ListResponse,
  Project,
  ProjectInput,
  Run,
  RunInput,
} from './types.ts';

export interface ClientOptions {
  baseUrl?: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

/**
 * Thin, dependency-free client for the Open Creator daemon.
 *
 * It works in the browser and in Node, so skills, MCP servers and CI jobs can
 * reuse exactly the same calls the studio UI makes.
 */
export class CreatorClient {
  private baseUrl: string;
  private apiKey?: string;
  private fetchImpl: typeof fetch;

  constructor(options: ClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? 'http://127.0.0.1:9861').replace(/\/$/, '');
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    };
    if (this.apiKey) headers.authorization = `Bearer ${this.apiKey}`;

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    });

    if (!response.ok) {
      let message = `${response.status} ${response.statusText}`;
      try {
        const body = (await response.json()) as { message?: string };
        if (body.message) message = body.message;
      } catch {
        /* keep the status line */
      }
      throw new Error(message);
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  health(): Promise<DaemonHealth> {
    return this.request<DaemonHealth>('/api/health');
  }

  listProjects(): Promise<ListResponse<Project>> {
    return this.request<ListResponse<Project>>('/api/projects');
  }

  createProject(input: ProjectInput): Promise<Project> {
    return this.request<Project>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  updateProject(id: string, patch: Partial<ProjectInput> & { status?: string }): Promise<Project> {
    return this.request<Project>(`/api/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  }

  deleteProject(id: string): Promise<void> {
    return this.request<void>(`/api/projects/${id}`, { method: 'DELETE' });
  }

  listRuns(projectId?: string): Promise<ListResponse<Run>> {
    const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
    return this.request<ListResponse<Run>>(`/api/runs${query}`);
  }

  createRun(input: RunInput): Promise<Run> {
    return this.request<Run>('/api/runs', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  getSettings(): Promise<AppSettings> {
    return this.request<AppSettings>('/api/settings');
  }

  updateSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
    return this.request<AppSettings>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  chat(message: string, projectId?: string): Promise<ChatResponse> {
    return this.request<ChatResponse>('/api/agent/chat', {
      method: 'POST',
      body: JSON.stringify({ message, projectId }),
    });
  }
}

export function createClient(options: ClientOptions = {}): CreatorClient {
  return new CreatorClient(options);
}
