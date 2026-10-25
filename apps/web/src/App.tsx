import { useMemo, useState } from 'react';
import { useHashRoute, type RouteName } from './lib/router.ts';
import { AppProvider, useApp } from './state/AppState.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { Topbar } from './components/Topbar.tsx';
import { ToolDrawer } from './components/ToolDrawer.tsx';
import { Toasts } from './components/Toasts.tsx';
import { Dashboard } from './pages/Dashboard.tsx';
import { Tools } from './pages/Tools.tsx';
import { Agent } from './pages/Agent.tsx';
import { Projects } from './pages/Projects.tsx';
import { Settings } from './pages/Settings.tsx';
import type { ToolDefinition } from '@open-creator/shared';

const META: Record<RouteName, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Everything you are working on, at a glance.',
  },
  tools: {
    title: 'Creator tools',
    subtitle: 'Reusable pipelines for video, image, audio and text.',
  },
  agent: {
    title: 'Agent',
    subtitle: 'Describe the outcome — get the plan, then run it.',
  },
  projects: {
    title: 'Projects',
    subtitle: 'Keep every asset of a piece of content together.',
  },
  settings: {
    title: 'Settings',
    subtitle: 'Provider, runtime and appearance.',
  },
};

function Studio(): JSX.Element {
  const [route, navigate] = useHashRoute();
  const { tools, ready } = useApp();
  const [search, setSearch] = useState('');
  const [selectedTool, setSelectedTool] = useState<ToolDefinition | null>(null);

  const meta = META[route];

  const openTool = (toolId: string) => {
    const tool = tools.find((candidate) => candidate.id === toolId);
    if (tool) setSelectedTool(tool);
  };

  const content = useMemo(() => {
    switch (route) {
      case 'dashboard':
        return <Dashboard onNavigate={navigate} onSelectTool={openTool} />;
      case 'tools':
        return <Tools search={search} onSelectTool={openTool} />;
      case 'agent':
        return <Agent />;
      case 'projects':
        return <Projects />;
      case 'settings':
        return <Settings />;
      default:
        return null;
    }
  }, [route, search, tools]);

  return (
    <div className="app-shell">
      <Sidebar route={route} onNavigate={navigate} />

      <div className="main">
        <Topbar
          title={meta.title}
          subtitle={meta.subtitle}
          search={route === 'tools' ? search : undefined}
          onSearch={route === 'tools' ? setSearch : undefined}
        />

        <nav className="mobile-nav">
          {(Object.keys(META) as RouteName[]).map((key) => (
            <button
              key={key}
              type="button"
              className={`chip${route === key ? ' chip--active' : ''}`}
              onClick={() => navigate(key)}
            >
              {META[key].title}
            </button>
          ))}
        </nav>

        <main className="content">
          {ready ? content : <div className="faint">Loading the studio…</div>}
        </main>
      </div>

      {selectedTool && <ToolDrawer tool={selectedTool} onClose={() => setSelectedTool(null)} />}
      <Toasts />
    </div>
  );
}

export function App(): JSX.Element {
  return (
    <AppProvider>
      <Studio />
    </AppProvider>
  );
}

export default App;
