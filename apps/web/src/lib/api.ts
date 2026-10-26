import type {
  AppSettings,
  Capabilities,
  ChatResponse,
  DaemonHealth,
  ListResponse,
  Project,
  ProjectInput,
  Run,
  RunInput,
  ToolDefinition,
} from '@open-creator/shared';

const BASE = '/api';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    },
  });

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      /* keep status line */
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  health: () => request<DaemonHealth>('/health'),
  tools: () => request<ListResponse<ToolDefinition>>('/tools'),
  listProjects: () => request<ListResponse<Project>>('/projects'),
  createProject: (input: ProjectInput) =>
    request<Project>('/projects', { method: 'POST', body: JSON.stringify(input) }),
  updateProject: (id: string, patch: Partial<Project> & { status?: string }) =>
    request<Project>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteProject: (id: string) => request<void>(`/projects/${id}`, { method: 'DELETE' }),
  listRuns: (projectId?: string) =>
    request<ListResponse<Run>>(
      `/runs${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`,
    ),
  createRun: (input: RunInput) =>
    request<Run>('/runs', { method: 'POST', body: JSON.stringify(input) }),
  getRun: (id: string) => request<Run>(`/runs/${id}`),
  deleteRun: (id: string) => request<{ deleted: boolean }>(`/runs/${id}`, { method: 'DELETE' }),
  capabilities: () => request<Capabilities>('/capabilities'),
  getSettings: () => request<AppSettings>('/settings'),
  updateSettings: (settings: Partial<AppSettings>) =>
    request<AppSettings>('/settings', { method: 'PUT', body: JSON.stringify(settings) }),
  chat: (message: string, projectId?: string) =>
    request<ChatResponse>('/agent/chat', {
      method: 'POST',
      body: JSON.stringify({ message, projectId }),
    }),
};
