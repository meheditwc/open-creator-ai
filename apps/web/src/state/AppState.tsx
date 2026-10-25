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
  toasts: Toast[];
  refresh: () => Promise<void>;
  createProject: (input: ProjectInput) => Promise<void>;
  updateProject: (id: string, patch: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  createRun: (input: RunInput) => Promise<void>;
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
  },
  dataDir: '.runtime',
  useFreeRouter: true,
  autosave: true,
};

export function AppProvider({ children }: { children: ReactNode }): JSX.Element {
  const [ready, setReady] = useState(false);
  const [daemonOnline, setDaemonOnline] = useState(false);
  const [health, setHealth] = useState<DaemonHealth | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
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

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 15_000);
    return () => {
      window.clearInterval(interval);
      toastTimers.current.forEach((timer) => window.clearTimeout(timer));
    };
  }, [refresh]);

  const createProject = useCallback(
    async (input: ProjectInput) => {
      try {
        if (daemonOnline) {
          const project = await api.createProject(input);
          setProjects((current) => [project, ...current]);
          localStore.saveProjects([project, ...projects]);
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
          const next = [project, ...projects];
          setProjects(next);
          localStore.saveProjects(next);
        }
        notify(`Project “${input.name}” created`, 'success');
      } catch (error) {
        notify(error instanceof Error ? error.message : 'Could not create project', 'error');
      }
    },
    [daemonOnline, notify, projects],
  );

  const updateProject = useCallback(
    async (id: string, patch: Partial<Project>) => {
      try {
        if (daemonOnline) {
          const updated = await api.updateProject(id, patch);
          setProjects((current) =>
            current.map((project) => (project.id === id ? updated : project)),
          );
        } else {
          setProjects((current) =>
            current.map((project) =>
              project.id === id
                ? { ...project, ...patch, updatedAt: new Date().toISOString() }
                : project,
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
        setProjects((current) => current.filter((project) => project.id !== id));
        setRuns((current) => current.filter((run) => run.projectId !== id));
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
          setRuns((current) => [run, ...current]);
        } else {
          const now = new Date().toISOString();
          const run: Run = {
            id: createLocalId('run'),
            projectId: input.projectId ?? '',
            tool: input.tool,
            title: input.title ?? input.tool,
            status: 'running',
            progress: 40,
            message: 'Running locally — start the daemon for full pipeline output.',
            createdAt: now,
            updatedAt: now,
          };
          setRuns((current) => [run, ...current]);
        }
        notify(`Run queued for ${input.tool}`, 'success');
      } catch (error) {
        notify(error instanceof Error ? error.message : 'Could not start the run', 'error');
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
      toasts,
      refresh,
      createProject,
      updateProject,
      deleteProject,
      createRun,
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
      toasts,
      refresh,
      createProject,
      updateProject,
      deleteProject,
      createRun,
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
