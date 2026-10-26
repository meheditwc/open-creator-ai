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

/** A rendered deliverable that lives in the daemon's artifact directory. */
export interface Artifact {
  id: string;
  name: string;
  kind: 'text' | 'subtitle' | 'data' | 'document';
  mime: string;
  bytes: number;
  /** Relative URL served by the daemon, e.g. `/api/artifacts/run_x/clip.mp4`. */
  url: string;
  note?: string;
  createdAt: string;
}

export interface Run {
  id: string;
  projectId: string;
  tool: string;
  title: string;
  status: RunStatus;
  /** 0 – 100 */
  progress: number;
  message: string;
  /** Files this run produced. */
  artifacts: Artifact[];
  /** What the creator asked for (prompt, source, aspect, duration…). */
  input: RunInput;
  /** Everything still missing to finish the job (a provider, a binary…). */
  notes: string[];
  /** Human-readable failure reason when `status` is `failed`. */
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RunInput {
  projectId?: string;
  tool: string;
  title?: string;
  /** The primary text: a topic, a video title or a script. */
  prompt?: string;
  /** Answers to the tool's own fields (audience, market, tone, …). */
  fields?: Record<string, string>;
}

/** What this machine can actually do right now. */
export interface Capabilities {
  provider: { configured: boolean; reachable: boolean; models: string[] };
  tools: Record<string, { ready: boolean; missing: string[]; note?: string }>;
}

/* -------------------------------------------------------------------------- */
/* Tools                                                                       */
/* -------------------------------------------------------------------------- */

export type ToolCategory = 'strategy' | 'script' | 'seo' | 'production' | 'text';

export type ToolStatus = 'stable' | 'beta' | 'planned';

export type ToolIcon =
  | 'compass'
  | 'target'
  | 'key'
  | 'search'
  | 'clapper'
  | 'calendar'
  | 'checklist'
  | 'growth'
  | 'captions'
  | 'article';

export interface ToolCapability {
  label: string;
  detail: string;
}

/** Where the tool sits in the channel journey. */
export type ToolStage = 'start' | 'plan' | 'write' | 'publish' | 'grow';

/** One input the studio asks for before a tool can run. */
export type ToolFieldKey =
  | 'prompt'
  | 'audience'
  | 'market'
  | 'tone'
  | 'length'
  | 'keywords'
  | 'channelName'
  | 'script'
  | 'niche'
  | 'notes';

export interface ToolField {
  key: ToolFieldKey;
  label: string;
  placeholder?: string;
  type?: 'text' | 'textarea' | 'select' | 'number';
  options?: string[];
  hint?: string;
  required?: boolean;
  defaultValue?: string;
}

export interface ToolDefinition {
  id: string;
  name: string;
  category: ToolCategory;
  status: ToolStatus;
  summary: string;
  icon: ToolIcon;
  accent: string;
  pipeline: string[];
  /** Where this tool fits in the journey from empty channel to publishing. */
  stage: ToolStage;
  /** Inputs the studio renders for this tool. */
  fields: ToolField[];
  /** Files this tool writes, shown before the run starts. */
  deliverables: string[];
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
