import { useState, type JSX } from 'react';
import type { ToolDefinition } from '@open-creator/shared';
import { CATEGORY_LABELS, STAGE_LABELS } from '@open-creator/shared';
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
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(tool.fields.map((field) => [field.key, field.defaultValue ?? ''])),
  );
  const [starting, setStarting] = useState(false);

  const setValue = (key: string, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  const missingRequired = tool.fields
    .filter((field) => field.required || field.key === 'prompt' || field.key === 'script')
    .some((field) => !(values[field.key] ?? '').trim());

  const startRun = async () => {
    if (missingRequired) {
      notify('Fill in the main field first', 'error');
      return;
    }
    setStarting(true);
    const promptValue = values.prompt ?? values.script ?? '';
    await createRun({
      tool: tool.id,
      projectId: projectId || undefined,
      title: title.trim() || promptValue.trim().slice(0, 80) || `${tool.name} run`,
      prompt: promptValue.trim() || undefined,
      fields: values,
    });
    setStarting(false);
    setTitle('');
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
            <span className="badge badge--accent">{STAGE_LABELS[tool.stage]}</span>
            <span className="badge">{tool.pipeline.length}-stage pipeline</span>
            <span className="badge" style={{ color: 'var(--success)' }}>
              ready
            </span>
          </div>

          <div className="kv" style={{ marginBottom: 4 }}>
            <h4>Your answers</h4>
            <p className="muted" style={{ fontSize: 12.5, margin: '4px 0 0' }}>
              These feed straight into the documents — the more specific, the better.
            </p>
          </div>

          {tool.fields.map((field) => {
            const id = `drawer-${field.key}`;
            const value = values[field.key] ?? '';
            const required = field.required || field.key === 'prompt' || field.key === 'script';
            return (
              <div className="field" key={field.key}>
                <label htmlFor={id}>
                  {field.label}
                  {required ? ' *' : ''}
                </label>
                {field.type === 'textarea' ? (
                  <textarea
                    id={id}
                    className="input"
                    rows={field.key === 'script' ? 6 : 3}
                    value={value}
                    placeholder={field.placeholder}
                    onChange={(event) => setValue(field.key, event.target.value)}
                  />
                ) : field.type === 'select' ? (
                  <select
                    id={id}
                    className="select"
                    value={value || field.defaultValue || field.options?.[0] || ''}
                    onChange={(event) => setValue(field.key, event.target.value)}
                  >
                    {(field.options ?? []).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={id}
                    className="input"
                    value={value}
                    placeholder={field.placeholder}
                    onChange={(event) => setValue(field.key, event.target.value)}
                  />
                )}
                {field.hint && <span className="field__hint">{field.hint}</span>}
              </div>
            );
          })}

          <div className="kv">
            <h4>Pipeline</h4>
            <div className="pipeline">
              {tool.pipeline.map((step) => (
                <span key={step} className="pipeline__item">
                  <span className="pipeline__step">{step}</span>
                  {/* The arrow trails its step so a wrapped line still starts
                      with a step name rather than a dangling arrow. */}
                  <span className="pipeline__arrow" aria-hidden="true">
                    →
                  </span>
                </span>
              ))}
            </div>
          </div>

          <div className="kv">
            <h4>You get</h4>
            <ul>
              {tool.deliverables.map((file) => (
                <li key={file}>
                  <span className="mono">{file}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="kv">
            <h4>Needs</h4>
            <p className="muted" style={{ fontSize: 13.5 }}>
              Nothing but the studio — no API key, no binaries. Everything is generated locally.
            </p>
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
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => void startRun()}
            disabled={starting || missingRequired}
          >
            <Icon name="play" size={15} />
            {starting ? 'Generating…' : 'Generate files'}
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </aside>
    </>
  );
}
