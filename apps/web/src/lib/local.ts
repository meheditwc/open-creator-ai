import type { AppSettings, Project, Run } from '@open-creator/shared';

/**
 * Offline fallback storage.
 *
 * If the daemon is not running (someone opened the static build, or the
 * runtime crashed) the studio still works: projects and runs are kept in
 * localStorage and the agent falls back to the built-in planner.
 */

const KEYS = {
  projects: 'open-creator-ai.projects',
  runs: 'open-creator-ai.runs',
  settings: 'open-creator-ai.settings',
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage disabled — keep the session in memory only */
  }
}

export const localStore = {
  projects: (): Project[] => read<Project[]>(KEYS.projects, []),
  saveProjects: (projects: Project[]) => write(KEYS.projects, projects),
  runs: (): Run[] => read<Run[]>(KEYS.runs, []),
  saveRuns: (runs: Run[]) => write(KEYS.runs, runs),
  settings: (): AppSettings | null => read<AppSettings | null>(KEYS.settings, null),
  saveSettings: (settings: AppSettings) => write(KEYS.settings, settings),
};

export function createLocalId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
