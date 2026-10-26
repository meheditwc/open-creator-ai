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
  kind: 'image' | 'video' | 'audio' | 'text' | 'subtitle' | 'document';
  mime: string;
  bytes: number;
  /** Relative URL served by the daemon, e.g. `/api/artifacts/run_x/clip.mp4`. */
  url: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
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

export type RunAspect = '16:9' | '9:16' | '1:1';

export interface RunInput {
  projectId?: string;
  tool: string;
  title?: string;
  /** The creator's prompt / topic. */
  prompt?: string;
  /** A source URL or pasted text (subtitles, narration, transcript). */
  sourceUrl?: string;
  language?: string;
  aspect?: RunAspect;
  durationSeconds?: number;
  /** How many variants to render where the tool supports it. */
  variants?: number;
}

/** What this machine can actually do right now. */
export interface Capabilities {
  ffmpeg: { available: boolean; version?: string; path?: string; error?: string };
  ytDlp: { available: boolean; version?: string; error?: string };
  provider: { configured: boolean; reachable: boolean; models: string[] };
  tools: Record<string, { ready: boolean; missing: string[]; note?: string }>;
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

/**
 * How a tool actually runs:
 * - `local`    — renders real files on this machine with ffmpeg, no provider.
 * - `provider` — needs a model provider for the interesting part.
 * - `external` — needs another binary on the machine (yt-dlp, whisper…).
 */
export type ToolEngine = 'local' | 'provider' | 'external';

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
  /** What has to be installed/configured for this tool to produce output. */
  engine: ToolEngine;
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
