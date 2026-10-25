import { useEffect, useState } from 'react';
import { useApp } from '../state/AppState.tsx';
import { Icon } from '../components/Icon.tsx';
import { useTheme } from '../hooks/useTheme.ts';

export function Settings(): JSX.Element {
  const { settings, saveSettings, health, daemonOnline, refresh } = useApp();
  const { theme, toggleTheme } = useTheme();

  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [fastModel, setFastModel] = useState('');
  const [useFreeRouter, setUseFreeRouter] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setBaseUrl(settings.llm.baseUrl);
    setApiKey(settings.llm.apiKey);
    setModel(settings.llm.model);
    setFastModel(settings.llm.fastModel);
    setUseFreeRouter(settings.useFreeRouter);
  }, [settings]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    await saveSettings({
      llm: { baseUrl, apiKey, model, fastModel },
      useFreeRouter,
    });
    setSaving(false);
    await refresh();
  };

  return (
    <>
      <section className="section">
        <div className="section__head">
          <h2>Model provider</h2>
          <p>Any OpenAI-compatible endpoint works — a local router, or a hosted API.</p>
        </div>

        <form className="card" onSubmit={save}>
          <div className="field">
            <label htmlFor="base-url">Base URL</label>
            <input
              id="base-url"
              className="input"
              value={baseUrl}
              placeholder="http://localhost:3001/v1"
              onChange={(event) => setBaseUrl(event.target.value)}
            />
            <span className="field__hint">
              FreeLLMAPI, Ollama, LM Studio, LiteLLM and vLLM all expose this shape.
            </span>
          </div>

          <div className="field">
            <label htmlFor="api-key">API key</label>
            <input
              id="api-key"
              className="input"
              type="password"
              value={apiKey}
              placeholder="sk-…"
              onChange={(event) => setApiKey(event.target.value)}
            />
            <span className="field__hint">
              Stored locally in your data directory. Never sent anywhere else.
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 14,
            }}
          >
            <div className="field">
              <label htmlFor="model">Main model</label>
              <input
                id="model"
                className="input"
                value={model}
                placeholder="gpt-4o-mini"
                onChange={(event) => setModel(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="fast-model">Fast model</label>
              <input
                id="fast-model"
                className="input"
                value={fastModel}
                placeholder="gpt-4o-mini"
                onChange={(event) => setFastModel(event.target.value)}
              />
            </div>
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 13.5,
              marginBottom: 18,
            }}
          >
            <input
              type="checkbox"
              checked={useFreeRouter}
              onChange={(event) => setUseFreeRouter(event.target.checked)}
            />
            Use the provider when it is reachable (fall back to the offline planner otherwise)
          </label>

          <button type="submit" className="btn btn--primary" disabled={saving}>
            <Icon name="check" size={15} />
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </form>
      </section>

      <section className="section">
        <div className="section__head">
          <h2>Appearance</h2>
          <p>The studio remembers your choice on this device.</p>
        </div>
        <div
          className="card"
          style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}
        >
          <button type="button" className="btn" onClick={toggleTheme}>
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={15} />
            Switch to {theme === 'dark' ? 'light' : 'dark'} theme
          </button>
          <span className="faint" style={{ fontSize: 13 }}>
            Current theme: <b style={{ color: 'var(--text)' }}>{theme}</b>
          </span>
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <h2>Runtime</h2>
          <p>Everything the local daemon reports about itself.</p>
        </div>

        <div className="card" style={{ padding: '6px 0' }}>
          <table className="table">
            <tbody>
              <tr>
                <td className="muted">Status</td>
                <td>
                  <span
                    className="badge"
                    style={{
                      color: daemonOnline ? 'var(--success)' : 'var(--danger)',
                    }}
                  >
                    {daemonOnline ? 'online' : 'offline'}
                  </span>
                </td>
              </tr>
              <tr>
                <td className="muted">Version</td>
                <td className="mono">{health?.version ?? '—'}</td>
              </tr>
              <tr>
                <td className="muted">Uptime</td>
                <td className="mono">{health ? `${health.uptimeSeconds}s` : '—'}</td>
              </tr>
              <tr>
                <td className="muted">Provider</td>
                <td className="mono">{settings?.llm.baseUrl ?? '—'}</td>
              </tr>
              <tr>
                <td className="muted">Models available</td>
                <td className="mono">{health?.llm.models.length ?? 0}</td>
              </tr>
              <tr>
                <td className="muted">Data directory</td>
                <td className="mono">{settings?.dataDir ?? '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
