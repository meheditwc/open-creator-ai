import { useMemo } from 'react';
import type { RouteName } from '../lib/router.ts';
import { useApp } from '../state/AppState.tsx';
import { StatCard } from '../components/StatCard.tsx';
import { Icon } from '../components/Icon.tsx';
import { EmptyState } from '../components/EmptyState.tsx';
import { ToolCard } from '../components/ToolCard.tsx';
import { greeting, pluralize, relativeTime } from '../lib/format.ts';

export function Dashboard({
  onNavigate,
  onSelectTool,
}: {
  onNavigate: (route: RouteName) => void;
  onSelectTool: (toolId: string) => void;
}): JSX.Element {
  const { projects, runs, tools, health, daemonOnline } = useApp();

  const stats = useMemo(() => {
    const completed = runs.filter((run) => run.status === 'completed').length;
    const active = runs.filter((run) => run.status === 'running' || run.status === 'queued').length;
    return { completed, active };
  }, [runs]);

  const featured = tools.filter((tool) => tool.status === 'stable').slice(0, 6);

  return (
    <>
      <section className="hero">
        <span className="hero__eyebrow">
          <Icon name="spark" size={13} />
          Open-source creator workspace
        </span>
        <h2>
          {greeting()}, creator. Turn one idea into a
          <br />
          finished video, image or voice track.
        </h2>
        <p>
          Open Creator AI keeps your projects, pipelines and agent in one place — video translation,
          thumbnails, scripts, voiceovers and subtitles, wired to the models you already run.
        </p>
        <div className="hero__actions">
          <button type="button" className="btn btn--primary" onClick={() => onNavigate('agent')}>
            <Icon name="spark" size={15} />
            Ask the agent
          </button>
          <button type="button" className="btn" onClick={() => onNavigate('projects')}>
            <Icon name="plus" size={15} />
            New project
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => onNavigate('tools')}>
            Browse tools
            <Icon name="chevron" size={14} />
          </button>
        </div>
      </section>

      {!daemonOnline && (
        <div className="banner banner--danger">
          <Icon name="bolt" size={16} />
          <span>
            <b>The daemon is offline.</b> The studio still works with local storage, but runs and
            the agent planner need the runtime — start it with <code>npm run dev:daemon</code>.
          </span>
        </div>
      )}

      <section className="section">
        <div className="stat-grid">
          <StatCard
            icon="folder"
            value={projects.length}
            label="Projects"
            trend={projects.length ? 'Synced with your workspace' : 'Create your first project'}
          />
          <StatCard
            icon="bolt"
            value={stats.completed}
            label="Completed runs"
            trend={stats.active ? `${stats.active} in progress` : 'Nothing running right now'}
          />
          <StatCard
            icon="tools"
            value={tools.length}
            label="Creator tools"
            trend={`${tools.filter((tool) => tool.status === 'stable').length} stable`}
          />
          <StatCard
            icon="agent"
            value={health?.llm.reachable ? 'Online' : 'Local'}
            label="Model provider"
            trend={
              health?.llm.reachable
                ? `${health.llm.models.length} models available`
                : 'Using the built-in planner'
            }
          />
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <h2>Recent runs</h2>
          <p>Everything you have queued, in one timeline.</p>
          <div className="spacer" />
          <button type="button" className="btn btn--sm" onClick={() => onNavigate('projects')}>
            View all
          </button>
        </div>

        {runs.length === 0 ? (
          <EmptyState
            icon="film"
            title="No runs yet"
            description="Pick a tool below and start your first pipeline — the studio tracks every stage for you."
            action={
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => onNavigate('tools')}
              >
                <Icon name="play" size={15} />
                Browse creator tools
              </button>
            }
          />
        ) : (
          <div className="card" style={{ padding: '6px 0' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Run</th>
                  <th>Tool</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {runs.slice(0, 7).map((run) => (
                  <tr key={run.id}>
                    <td>
                      <div style={{ fontWeight: 550 }}>{run.title}</div>
                      <div className="faint mono" style={{ fontSize: 11 }}>
                        {run.id}
                      </div>
                    </td>
                    <td className="muted">{run.tool}</td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          color:
                            run.status === 'completed'
                              ? 'var(--success)'
                              : run.status === 'failed'
                                ? 'var(--danger)'
                                : 'var(--warning)',
                        }}
                      >
                        {run.status}
                      </span>
                    </td>
                    <td style={{ minWidth: 140 }}>
                      <div className="progress">
                        <div className="progress__bar" style={{ width: `${run.progress}%` }} />
                      </div>
                    </td>
                    <td className="faint">{relativeTime(run.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="section">
        <div className="section__head">
          <h2>Quick start</h2>
          <p>The pipelines creators reach for most.</p>
          <div className="spacer" />
          <button type="button" className="btn btn--sm" onClick={() => onNavigate('tools')}>
            All tools
          </button>
        </div>

        <div className="tool-grid">
          {featured.map((tool) => (
            <ToolCard key={tool.id} tool={tool} onSelect={() => onSelectTool(tool.id)} />
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <h2>Workspace</h2>
          <p>
            {pluralize(projects.length, 'project')} · {pluralize(runs.length, 'run')}
          </p>
        </div>
        {projects.length === 0 ? (
          <EmptyState
            icon="folder"
            title="Your projects live here"
            description="Group related runs into a project so every asset, caption and export stays together."
            action={
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => onNavigate('projects')}
              >
                <Icon name="plus" size={15} />
                Create a project
              </button>
            }
          />
        ) : (
          <div className="project-grid">
            {projects.slice(0, 3).map((project) => (
              <div key={project.id} className="card card--interactive">
                <div className="project-card__head">
                  <div>
                    <div className="project-card__name">{project.name}</div>
                    <div className="faint" style={{ fontSize: 11.5 }}>
                      {pluralize(runs.filter((run) => run.projectId === project.id).length, 'run')}
                    </div>
                  </div>
                </div>
                <p className="project-card__desc">{project.description || 'No description yet.'}</p>
                <div className="project-card__meta">
                  <Icon name="refresh" size={13} />
                  Updated {relativeTime(project.updatedAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
