import { useState, type JSX } from 'react';
import { useApp } from '../state/AppState.tsx';
import { Icon } from '../components/Icon.tsx';
import { EmptyState } from '../components/EmptyState.tsx';
import { RunDetails } from '../components/RunDetails.tsx';
import { pluralize, relativeTime } from '../lib/format.ts';

export function Projects(): JSX.Element {
  const { projects, runs, createProject, deleteProject, updateProject } = useApp();
  const [openRunId, setOpenRunId] = useState<string | null>(null);
  const openRun = runs.find((run) => run.id === openRunId) ?? null;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    await createProject({ name: trimmed, description: description.trim() });
    setName('');
    setDescription('');
    setCreating(false);
  };

  return (
    <>
      <section className="section">
        <div className="section__head">
          <h2>New project</h2>
          <p>One project per channel — every document that channel produces, in one place.</p>
        </div>

        <form className="card" onSubmit={submit}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr) auto',
              gap: 12,
              alignItems: 'end',
            }}
          >
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="project-name">Name</label>
              <input
                id="project-name"
                className="input"
                value={name}
                placeholder="e.g. Cut Faster — phone editing"
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="project-description">Description</label>
              <input
                id="project-description"
                className="input"
                value={description}
                placeholder="e.g. Beginner phone editing for creators in Bangladesh"
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            <button type="submit" className="btn btn--primary" disabled={!name.trim() || creating}>
              <Icon name="plus" size={15} />
              {creating ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </section>

      <section className="section">
        <div className="section__head">
          <h2>Projects</h2>
          <p>{pluralize(projects.length, 'project')} in this workspace.</p>
        </div>

        {projects.length === 0 ? (
          <EmptyState
            icon="folder"
            title="No projects yet"
            description="Create your first project above — it becomes the home for every run, subtitle and export."
          />
        ) : (
          <div className="project-grid">
            {projects.map((project) => {
              const projectRuns = runs.filter((run) => run.projectId === project.id);
              return (
                <article key={project.id} className="card card--interactive">
                  <div className="project-card__head">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="project-card__name">{project.name}</div>
                      <div className="faint" style={{ fontSize: 11.5 }}>
                        {pluralize(projectRuns.length, 'run')} ·{' '}
                        {projectRuns.filter((run) => run.status === 'completed').length} completed
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn--icon btn--ghost"
                      title="Delete project"
                      onClick={() => void deleteProject(project.id)}
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </div>

                  <p className="project-card__desc">
                    {project.description || 'No description yet.'}
                  </p>

                  <div className="project-card__meta">
                    <Icon name="refresh" size={13} />
                    Updated {relativeTime(project.updatedAt)}
                    <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        className="btn btn--sm"
                        onClick={() =>
                          void updateProject(project.id, {
                            status: project.status === 'active' ? 'archived' : 'active',
                          })
                        }
                      >
                        {project.status === 'active' ? 'Archive' : 'Restore'}
                      </button>
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="section">
        <div className="section__head">
          <h2>All runs</h2>
          <p>Every run in this workspace — click one to read its files.</p>
        </div>

        {runs.length === 0 ? (
          <EmptyState
            icon="bolt"
            title="Nothing has run yet"
            description="Start a tool from the Channel tools page and its files will show up here."
          />
        ) : (
          <div className="card" style={{ padding: '6px 0' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Run</th>
                  <th>Tool</th>
                  <th>Project</th>
                  <th>Status</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => {
                  const project = projects.find((candidate) => candidate.id === run.projectId);
                  return (
                    <tr
                      key={run.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setOpenRunId(run.id)}
                    >
                      <td>
                        <div style={{ fontWeight: 550 }}>{run.title}</div>
                        <div className="faint mono" style={{ fontSize: 11 }}>
                          {run.message}
                        </div>
                      </td>
                      <td className="muted">{run.tool}</td>
                      <td className="muted">{project?.name ?? '—'}</td>
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
                      <td className="faint">{relativeTime(run.updatedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {openRun && <RunDetails run={openRun} onClose={() => setOpenRunId(null)} />}
    </>
  );
}
