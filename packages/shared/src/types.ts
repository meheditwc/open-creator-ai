/**
 * Core domain types shared by the daemon, the web studio and any external
 * integration (MCP servers, CI jobs, custom skills).
 *
 * Everything here is intentionally transport-agnostic: the same shapes are
 * used over HTTP, on disk and in the browser.
 */

/* -------------------------------------------------------------------------- */
/* Projects                                                                    */
/* -------------------------------------------------------------------------- */

export type ProjectStatus = 'active' | 'archived';

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectInput {
  name: string;
  description?: string;
}

/* -------------------------------------------------------------------------- */
/* Runs (a single creator pipeline execution)                                  */
/* -------------------------------------------------------------------------- */

export type RunStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface Run {
  id: string;
  projectId: string;
  tool: string;
  title: string;
  status: RunStatus;
  /** 0 – 100 */
  progress: number;
  message: string;
  createdAt: string;
  updatedAt: string;
}

export interface RunInput {
  projectId?: string;
  tool: string;
  title?: string;
  prompt?: string;
}

/* -------------------------------------------------------------------------- */
/* Tools                                                                       */
/* -------------------------------------------------------------------------- */

export type ToolCategory = 'video' | 'image' | 'audio' | 'text' | 'utility';

export type ToolStatus = 'stable' | 'beta' | 'planned';

export type ToolIcon =
  | 'translate'
  | 'download'
  | 'image'
  | 'film'
  | 'article'
  | 'clapper'
  | 'figure'
  | 'mic'
  | 'captions'
  | 'compass';

export interface ToolCapability {
  label: string;
  detail: string;
}

export interface ToolDefinition {
  id: string;
  name: string;
  category: ToolCategory;
  status: ToolStatus;
  summary: string;
  icon: ToolIcon;
  accent: string;
  inputs: string[];
  outputs: string[];
  pipeline: string[];
  requires: string[];
}

/* -------------------------------------------------------------------------- */
/* Settings & health                                                           */
/* -------------------------------------------------------------------------- */

export interface LlmSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
  /** Model used for fast/cheap operations such as translation. */
  fastModel: string;
}

export interface AppSettings {
  llm: LlmSettings;
  /** Where the daemon writes its workspace data. */
  dataDir: string;
  /** Enable the free local model router when reachable. */
  useFreeRouter: boolean;
  autosave: boolean;
}

export interface DaemonHealth {
  status: 'ok';
  version: string;
  uptimeSeconds: number;
  startedAt: string;
  projects: number;
  runs: number;
  llm: {
    reachable: boolean;
    baseUrl: string;
    models: string[];
    error?: string;
  };
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt?: string;
}

export interface ChatResponse {
  reply: string;
  source: 'llm' | 'local';
  model?: string;
  suggestions?: string[];
}

/* -------------------------------------------------------------------------- */
/* API envelope                                                                */
/* -------------------------------------------------------------------------- */

export interface ApiError {
  error: string;
  message: string;
}

export interface ListResponse<T> {
  items: T[];
  total: number;
}
