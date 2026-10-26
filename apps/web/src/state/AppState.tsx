import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
  type ReactNode,
} from 'react';
import { TOOLS, localAgentReply } from '@open-creator/shared';
import type {
  AppSettings,
  Capabilities,
  ChatResponse,
  DaemonHealth,
  Project,
  ProjectInput,
  Run,
  RunInput,
  ToolDefinition,
} from '@open-creator/shared';
import { api } from '../lib/api.ts';
import { createLocalId, localStore } from '../lib/local.ts';

interface Toast {
  id: string;
  message: string;
  tone: 'info' | 'success' | 'error';
}

interface AppContextValue {
  ready: boolean;
  daemonOnline: boolean;
  health: DaemonHealth | null;
  projects: Project[];
  runs: Run[];
  tools: ToolDefinition[];
  settings: AppSettings | null;
  capabilities: Capabilities | null;
  toasts: Toast[];
  refresh: () => Promise<void>;
  createProject: (input: ProjectInput) => Promise<void>;
  updateProject: (id: string, patch: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  createRun: (input: RunInput) => Promise<void>;
  deleteRun: (id: string) => Promise<void>;
  refreshCapabilities: () => Promise<void>;
  saveSettings: (patch: Partial<AppSettings>) => Promise<void>;
  chat: (message: string, projectId?: string) => Promise<ChatResponse>;
  notify: (message: string, tone?: Toast['tone']) => void;
  dismissToast: (id: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const DEFAULT_SETTINGS: AppSettings = {
  llm: {
    baseUrl: 'http://localhost:3001/v1',
    apiKey: '',
    model: 'gpt-4o-mini',
    fastModel: 'gpt-4o-mini',
    imageModel: '',
  },
  dataDir: '.runtime',
  useFreeRouter: true,
  autosave: true,
  keylessImages: true,
};

/** Keep the offline cache in step with every mutation, not just creation. */
function persistProjects(projects: Project[]): Project[] {
  localStore.saveProjects(projects);
  return projects;
}

function persistRuns(runs: Run[]): Run[] {
  localStore.saveRuns(runs);
  return runs;
}

export function AppProvider({ children }: { children: ReactNode }): JSX.Element {
  const [ready, setReady] = useState(false);
  const [daemonOnline, setDaemonOnline] = useState(false);
  const [health, setHealth] = useState<DaemonHealth | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastTimers = useRef<number[]>([]);

  const notify = useCallback((message: string, tone: Toast['tone'] = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((current) => [...current, { id, message, tone }]);
    const timer = window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4200);
    toastTimers.current.push(timer);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const refreshCapabilities = useCallback(async () => {
    try {
      setCapabilities(await api.capabilities());
    } catch {
      setCapabilities(null);
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const daemonHealth = await api.health();
      setDaemonOnline(true);
      setHealth(daemonHealth);

      const [projectResponse, runResponse, daemonSettings] = await Promise.all([
        api.listProjects(),
        api.listRuns(),
        api.getSettings(),
      ]);
      setProjects(projectResponse.items);
      setRuns(runResponse.items);
      setSettings(daemonSettings);
      localStore.saveProjects(projectResponse.items);
      localStore.saveRuns(runResponse.items);
      localStore.saveSettings(daemonSettings);
    } catch {
      setDaemonOnline(false);
      setHealth(null);
      setProjects(localStore.projects());
      setRuns(localStore.runs());
      setSettings(localStore.settings() ?? DEFAULT_SETTINGS);
    } finally {
      setReady(true);
    }
  }, []);

  const hasActiveRun = runs.some((run) => run.status === 'queued' || run.status === 'running');

  useEffect(() => {
    void refresh();
    void refreshCapabilities();
    // Idle workspaces poll slowly; while a render is in flight the studio
    // refreshes every second so progress and artifacts appear as they land.
    const interval = window.setInterval(() => void refresh(), hasActiveRun ? 1_200 : 15_000);
    return () => {
      window.clearInterval(interval);
      toastTimers.current.forEach((timer) => window.clearTimeout(timer));
    };
  }, [refresh, hasActiveRun]);

  const createProject = useCallback(
    async (input: ProjectInput) => {
      try {
        if (daemonOnline) {
          const project = await api.createProject(input);
          setProjects((current) => persistProjects([project, ...current]));
        } else {
          const now = new Date().toISOString();
          const project: Project = {
            id: createLocalId('prj'),
            name: input.name,
            description: input.description ?? '',
            status: 'active',
            createdAt: now,
            updatedAt: now,
          };
          setProjects((current) => persistProjects([project, ...current]));
        }
        notify(`Project “${input.name}” created`, 'success');
      } catch (error) {
        notify(error instanceof Error ? error.message : 'Could not create project', 'error');
      }
    },
    [daemonOnline, notify],
  );

  const updateProject = useCallback(
    async (id: string, patch: Partial<Project>) => {
      try {
        if (daemonOnline) {
          const updated = await api.updateProject(id, patch);
          setProjects((current) =>
            persistProjects(current.map((project) => (project.id === id ? updated : project))),
          );
        } else {
          setProjects((current) =>
            persistProjects(
              current.map((project) =>
                project.id === id
                  ? { ...project, ...patch, updatedAt: new Date().toISOString() }
                  : project,
              ),
            ),
          );
        }
      } catch (error) {
        notify(error instanceof Error ? error.message : 'Could not update project', 'error');
      }
    },
    [daemonOnline, notify],
  );

  const deleteProject = useCallback(
    async (id: string) => {
      try {
        if (daemonOnline) await api.deleteProject(id);
        setProjects((current) => persistProjects(current.filter((project) => project.id !== id)));
        setRuns((current) => persistRuns(current.filter((run) => run.projectId !== id)));
        notify('Project deleted', 'success');
      } catch (error) {
        notify(error instanceof Error ? error.message : 'Could not delete project', 'error');
      }
    },
    [daemonOnline, notify],
  );

  const createRun = useCallback(
    async (input: RunInput) => {
      try {
        if (daemonOnline) {
          const run = await api.createRun(input);
          setRuns((current) => persistRuns([run, ...current]));
        } else {
          const now = new Date().toISOString();
          const run: Run = {
            id: createLocalId('run'),
            projectId: input.projectId ?? '',
            tool: input.tool,
            title: input.title ?? input.tool,
            status: 'failed',
            progress: 100,
            message: 'Rendering needs the local daemon.',
            error:
              'The studio is running without the daemon, so nothing can be rendered. Start it with `npm run dev:daemon` and run this tool again.',
            artifacts: [],
            notes: [],
            input,
            createdAt: now,
            updatedAt: now,
          };
          setRuns((current) => persistRuns([run, ...current]));
        }
        notify(`Run queued for ${input.tool}`, 'success');
      } catch (error) {
        notify(error instanceof Error ? error.message : 'Could not start the run', 'error');
      }
    },
    [daemonOnline, notify],
  );

  const deleteRun = useCallback(
    async (id: string) => {
      try {
        if (daemonOnline) await api.deleteRun(id);
        setRuns((current) => persistRuns(current.filter((run) => run.id !== id)));
        notify('Run deleted', 'success');
      } catch (error) {
        notify(error instanceof Error ? error.message : 'Could not delete the run', 'error');
      }
    },
    [daemonOnline, notify],
  );

  const saveSettings = useCallback(
    async (patch: Partial<AppSettings>) => {
      try {
        if (daemonOnline) {
          const updated = await api.updateSettings(patch);
          setSettings(updated);
          localStore.saveSettings(updated);
        } else {
          setSettings((current) => {
            const next = { ...(current ?? DEFAULT_SETTINGS), ...patch };
            localStore.saveSettings(next);
            return next;
          });
        }
        notify('Settings saved', 'success');
      } catch (error) {
        notify(error instanceof Error ? error.message : 'Could not save settings', 'error');
      }
    },
    [daemonOnline, notify],
  );

  const chat = useCallback(async (message: string, projectId?: string): Promise<ChatResponse> => {
    try {
      return await api.chat(message, projectId);
    } catch {
      const local = localAgentReply(message);
      return { reply: local.reply, source: 'local', suggestions: local.suggestions };
    }
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      ready,
      daemonOnline,
      health,
      projects,
      runs,
      tools: TOOLS,
      settings,
      capabilities,
      toasts,
      refresh,
      createProject,
      updateProject,
      deleteProject,
      createRun,
      deleteRun,
      refreshCapabilities,
      saveSettings,
      chat,
      notify,
      dismissToast,
    }),
    [
      ready,
      daemonOnline,
      health,
      projects,
      runs,
      settings,
      capabilities,
      toasts,
      refresh,
      createProject,
      updateProject,
      deleteProject,
      createRun,
      deleteRun,
      refreshCapabilities,
      saveSettings,
      chat,
      notify,
      dismissToast,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside <AppProvider>');
  return context;
}
