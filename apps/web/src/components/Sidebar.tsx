import type { RouteName } from '../lib/router.ts';
import { Icon, type IconName } from './Icon.tsx';
import { Logo } from './Logo.tsx';
import { useApp } from '../state/AppState.tsx';

const NAV: { route: RouteName; label: string; icon: IconName }[] = [
  { route: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { route: 'tools', label: 'Creator tools', icon: 'tools' },
  { route: 'agent', label: 'Agent', icon: 'agent' },
  { route: 'projects', label: 'Projects', icon: 'projects' },
  { route: 'settings', label: 'Settings', icon: 'settings' },
];

export function Sidebar({
  route,
  onNavigate,
}: {
  route: RouteName;
  onNavigate: (route: RouteName) => void;
}): JSX.Element {
  const { daemonOnline, health, projects, tools } = useApp();

  return (
    <aside className="sidebar">
      <div className="brand">
        <Logo />
        <div>
          <div className="brand__name">Open Creator AI</div>
          <div className="brand__tag">Creator studio</div>
        </div>
      </div>

      <nav className="nav">
        <div className="nav__label">Workspace</div>
        {NAV.map((item) => (
          <button
            key={item.route}
            type="button"
            className={`nav__item${route === item.route ? ' nav__item--active' : ''}`}
            onClick={() => onNavigate(item.route)}
          >
            <span className="nav__icon">
              <Icon name={item.icon} size={17} />
            </span>
            {item.label}
            {item.route === 'tools' && <span className="nav__count">{tools.length}</span>}
            {item.route === 'projects' && projects.length > 0 && (
              <span className="nav__count">{projects.length}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="sidebar__footer">
        <div className="status-pill" title={health ? `v${health.version}` : 'Daemon not reachable'}>
          <span
            className={`status-dot ${daemonOnline ? 'status-dot--online' : 'status-dot--offline'}`}
          />
          <div style={{ minWidth: 0 }}>
            <div style={{ color: 'var(--text)', fontWeight: 550 }}>
              {daemonOnline ? 'Daemon online' : 'Offline mode'}
            </div>
            <div className="faint" style={{ fontSize: 11 }}>
              {daemonOnline
                ? `${health?.llm.reachable ? 'LLM connected' : 'LLM not configured'} · v${health?.version}`
                : 'Start the daemon to sync'}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
