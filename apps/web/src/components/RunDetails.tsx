import { useEffect, useState, type JSX } from 'react';
import type { Artifact, Run } from '@open-creator/shared';
import { useApp } from '../state/AppState.tsx';
import { Icon } from './Icon.tsx';
import { relativeTime } from '../lib/format.ts';

const KIND_LABEL: Record<Artifact['kind'], string> = {
  text: 'Markdown',
  subtitle: 'Subtitles',
  data: 'Data',
  document: 'HTML',
};

/** Copy/download a whole file, not just the preview. */
async function copyArtifact(url: string, notify: (m: string, k?: 'success' | 'error') => void) {
  try {
    const response = await fetch(url);
    const text = await response.text();
    await navigator.clipboard.writeText(text);
    notify('Copied to clipboard', 'success');
  } catch {
    notify('Could not copy — open the file instead', 'error');
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ArtifactPreview({ artifact }: { artifact: Artifact }): JSX.Element {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(artifact.url)
      .then((response) => (response.ok ? response.text() : ''))
      .then((value) => {
        if (!cancelled) setText(value.slice(0, 2400));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [artifact.url]);

  if (artifact.mime === 'text/html; charset=utf-8') {
    return (
      <iframe
        className="artifact__media"
        src={artifact.url}
        title={artifact.name}
        sandbox=""
        style={{ height: 240, border: 0, background: '#fff' }}
      />
    );
  }

  return <pre className="artifact__text">{text ?? 'Loading preview…'}</pre>;
}

export function RunDetails({ run, onClose }: { run: Run; onClose: () => void }): JSX.Element {
  const { deleteRun, notify } = useApp();
  const busy = run.status === 'queued' || run.status === 'running';
  const artifacts = run.artifacts ?? [];
  const notes = run.notes ?? [];

  const remove = async () => {
    await deleteRun(run.id);
    notify('Run deleted', 'success');
    onClose();
  };

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} role="presentation" />
      <aside className="drawer drawer--wide" role="dialog" aria-label={run.title}>
        <div className="drawer__head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3>{run.title}</h3>
            <p>
              <span className="mono faint">{run.tool}</span> · {run.message}
            </p>
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
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
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
            <span className="badge">
              {artifacts.length} artifact{artifacts.length === 1 ? '' : 's'}
            </span>
            <span className="badge">{relativeTime(run.updatedAt)}</span>
          </div>

          {busy && (
            <div style={{ marginBottom: 16 }}>
              <div className="progress">
                <div className="progress__bar" style={{ width: `${run.progress}%` }} />
              </div>
              <p className="faint" style={{ fontSize: 12.5, marginTop: 8 }}>
                Writing files… {run.progress}%
              </p>
            </div>
          )}

          {run.error && (
            <div className="banner banner--danger" style={{ marginBottom: 16 }}>
              <Icon name="bolt" size={16} />
              <span>{run.error}</span>
            </div>
          )}

          {notes.length > 0 && (
            <div className="banner" style={{ marginBottom: 16 }}>
              <Icon name="spark" size={16} />
              <span>
                {notes.map((note) => (
                  <span key={note} style={{ display: 'block' }}>
                    {note}
                  </span>
                ))}
              </span>
            </div>
          )}

          {artifacts.length === 0 && !busy && !run.error && (
            <p className="muted" style={{ fontSize: 13.5 }}>
              This run has no files yet.
            </p>
          )}

          <div className="artifact-grid">
            {artifacts.map((artifact) => (
              <article key={artifact.id} className="artifact">
                <div className="artifact__head">
                  <div style={{ minWidth: 0 }}>
                    <div className="artifact__name" title={artifact.name}>
                      {artifact.name}
                    </div>
                    <div className="faint" style={{ fontSize: 11.5 }}>
                      {KIND_LABEL[artifact.kind]} · {formatBytes(artifact.bytes)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 2 }}>
                    <button
                      type="button"
                      className="btn btn--icon btn--ghost"
                      onClick={() => void copyArtifact(artifact.url, notify)}
                      title={`Copy ${artifact.name}`}
                    >
                      <Icon name="copy" size={15} />
                    </button>
                    <a
                      className="btn btn--icon btn--ghost"
                      href={`${artifact.url}?download=1`}
                      download={artifact.name}
                      title={`Download ${artifact.name}`}
                    >
                      <Icon name="download" size={15} />
                    </a>
                  </div>
                </div>
                <ArtifactPreview artifact={artifact} />
                {artifact.note && (
                  <div className="faint" style={{ fontSize: 11.5, padding: '0 12px 12px' }}>
                    {artifact.note}
                  </div>
                )}
              </article>
            ))}
          </div>

          <details className="kv" style={{ marginTop: 20 }}>
            <summary style={{ cursor: 'pointer', fontSize: 13 }}>Run input</summary>
            <pre className="artifact__text" style={{ marginTop: 10 }}>
              {JSON.stringify(run.input ?? {}, null, 2)}
            </pre>
          </details>
        </div>

        <div className="drawer__foot">
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
          <div className="spacer" />
          <button type="button" className="btn btn--ghost" onClick={() => void remove()}>
            <Icon name="trash" size={15} />
            Delete run
          </button>
        </div>
      </aside>
    </>
  );
}
