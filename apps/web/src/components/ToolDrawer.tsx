import { useState, type JSX } from 'react';
import type { RunAspect, ToolDefinition } from '@open-creator/shared';
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
  const { projects, createRun, notify, capabilities } = useApp();
  const [projectId, setProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [aspect, setAspect] = useState<RunAspect>('16:9');
  const [duration, setDuration] = useState(8);
  const [variants, setVariants] = useState(3);
  const [starting, setStarting] = useState(false);

  const readiness = capabilities?.tools[tool.id];
  const needsPrompt = tool.id !== 'video-downloader';
  const wantsSource =
    tool.id === 'video-downloader' ||
    tool.id === 'subtitle-studio' ||
    tool.id === 'video-translation' ||
    tool.id === 'stick-figure';

  const startRun = async () => {
    if (needsPrompt && !prompt.trim()) {
      notify('Add a prompt or topic first', 'error');
      return;
    }
    setStarting(true);
    await createRun({
      tool: tool.id,
      projectId: projectId || undefined,
      title: title.trim() || prompt.trim().slice(0, 80) || `${tool.name} run`,
      prompt: prompt.trim() || undefined,
      sourceUrl: sourceUrl.trim() || undefined,
      aspect,
      durationSeconds: duration,
      variants,
    });
    setStarting(false);
    setTitle('');
    notify(`${tool.name} started`, 'success');
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
            {readiness && (
              <span
                className="badge"
                style={{ color: readiness.ready ? 'var(--success)' : 'var(--warning)' }}
                title={
                  readiness.missing.length
                    ? `Needs ${readiness.missing.join(', ')}`
                    : 'Ready to run'
                }
              >
                {readiness.ready ? 'ready' : `needs ${readiness.missing.join(', ')}`}
              </span>
            )}
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
            <label htmlFor="drawer-prompt">
              {tool.category === 'image' ? 'What should it say or show?' : 'Prompt or topic'}
            </label>
            <textarea
              id="drawer-prompt"
              className="input"
              rows={3}
              value={prompt}
              placeholder="e.g. How I edit a week of content in one afternoon"
              onChange={(event) => setPrompt(event.target.value)}
            />
            <span className="field__hint">
              Everything is rendered locally with ffmpeg — no API key needed.
            </span>
          </div>

          {wantsSource && (
            <div className="field">
              <label htmlFor="drawer-source">
                {tool.id === 'video-downloader' ? 'Video URL' : 'Source text or URL (optional)'}
              </label>
              <input
                id="drawer-source"
                className="input"
                value={sourceUrl}
                placeholder={
                  tool.id === 'video-downloader'
                    ? 'https://www.youtube.com/watch?v=…'
                    : 'Paste a transcript, caption text or a link'
                }
                onChange={(event) => setSourceUrl(event.target.value)}
              />
            </div>
          )}

          {(tool.category === 'video' || tool.category === 'image') && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: 12,
              }}
            >
              <div className="field">
                <label htmlFor="drawer-aspect">Aspect</label>
                <select
                  id="drawer-aspect"
                  className="select"
                  value={aspect}
                  onChange={(event) => setAspect(event.target.value as RunAspect)}
                >
                  <option value="16:9">16:9 · landscape</option>
                  <option value="9:16">9:16 · vertical</option>
                  <option value="1:1">1:1 · square</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="drawer-duration">Duration (s)</label>
                <input
                  id="drawer-duration"
                  className="input"
                  type="number"
                  min={3}
                  max={60}
                  value={duration}
                  onChange={(event) => setDuration(Number(event.target.value))}
                />
              </div>
              {tool.id === 'thumbnail-generator' && (
                <div className="field">
                  <label htmlFor="drawer-variants">Variants</label>
                  <input
                    id="drawer-variants"
                    className="input"
                    type="number"
                    min={1}
                    max={6}
                    value={variants}
                    onChange={(event) => setVariants(Number(event.target.value))}
                  />
                </div>
              )}
            </div>
          )}

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
            disabled={starting}
          >
            <Icon name="play" size={15} />
            {starting ? 'Starting…' : 'Start run'}
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </aside>
    </>
  );
}
