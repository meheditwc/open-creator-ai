import { useState, type JSX } from 'react';
import type { ToolDefinition } from '@open-creator/shared';
import { CATEGORY_LABELS } from '@open-creator/shared';
import { Icon } from './Icon.tsx';
import { useApp } from '../state/AppState.tsx';

export function ToolDrawer({
  tool,
  onClose,
}: {
  tool: ToolDefinition;
  onClose: () => void;
}): JSX.Element {
  const { projects, createRun, notify } = useApp();
  const [projectId, setProjectId] = useState('');
  const [title, setTitle] = useState('');

  const startRun = async () => {
    await createRun({
      tool: tool.id,
      projectId: projectId || undefined,
      title: title.trim() || `${tool.name} run`,
    });
    setTitle('');
    notify(`${tool.name} queued`, 'success');
    onClose();
  };

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} role="presentation" />
      <aside className="drawer" role="dialog" aria-label={tool.name}>
        <div className="drawer__head">
          <div
            className="tool-card__icon"
            style={{ color: tool.accent, background: `${tool.accent}22` }}
          >
            <Icon name={tool.icon} size={19} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3>{tool.name}</h3>
            <p>{tool.summary}</p>
          </div>
          <button
            type="button"
            className="btn btn--icon btn--ghost"
            onClick={onClose}
            aria-label="Close"
          >
            <Icon name="close" size={17} />
          </button>
        </div>

        <div className="drawer__body">
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            <span className={`badge badge--${tool.status}`}>{tool.status}</span>
            <span className="badge">{CATEGORY_LABELS[tool.category]}</span>
            <span className="badge badge--accent">{tool.pipeline.length}-stage pipeline</span>
          </div>

          <div className="kv">
            <h4>Inputs</h4>
            <ul>
              {tool.inputs.map((input) => (
                <li key={input}>{input}</li>
              ))}
            </ul>
          </div>

          <div className="kv">
            <h4>Pipeline</h4>
            <div className="pipeline">
              {tool.pipeline.map((step, index) => (
                <span key={step} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                  {index > 0 && <span className="pipeline__arrow">→</span>}
                  <span className="pipeline__step">{step}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="kv">
            <h4>Outputs</h4>
            <ul>
              {tool.outputs.map((output) => (
                <li key={output}>{output}</li>
              ))}
            </ul>
          </div>

          <div className="kv">
            <h4>Requirements</h4>
            {tool.requires.length ? (
              <ul>
                {tool.requires.map((requirement) => (
                  <li key={requirement}>{requirement}</li>
                ))}
              </ul>
            ) : (
              <p className="muted" style={{ fontSize: 13.5 }}>
                No local binaries required — runs entirely through the studio.
              </p>
            )}
          </div>

          <div className="field">
            <label htmlFor="drawer-title">Run title</label>
            <input
              id="drawer-title"
              className="input"
              value={title}
              placeholder={`${tool.name} — ${new Date().toLocaleDateString()}`}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="drawer-project">Project</label>
            <select
              id="drawer-project"
              className="select"
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
            >
              <option value="">No project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="drawer__foot">
          <button type="button" className="btn btn--primary" onClick={startRun}>
            <Icon name="play" size={15} />
            Start run
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </aside>
    </>
  );
}
