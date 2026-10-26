import { useEffect, useRef, useState, type JSX } from 'react';
import { useApp } from '../state/AppState.tsx';
import { Markdown } from '../lib/markdown.tsx';
import { Icon } from '../components/Icon.tsx';

interface Turn {
  role: 'user' | 'assistant';
  content: string;
  meta?: string;
}

const STARTERS = [
  'Translate this video into Spanish with a dubbed voice track',
  'Write a 60-second short script about launching a new product',
  'Plan a thumbnail + short video launch for my article',
  'What can I make from a YouTube link?',
];

export function Agent(): JSX.Element {
  const { chat, health, daemonOnline, projects } = useApp();
  const [turns, setTurns] = useState<Turn[]>([
    {
      role: 'assistant',
      content:
        'Hi! I can plan and run your creator pipelines. Tell me what you want to make and which tools you already have on this machine.',
    },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>(STARTERS);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, busy]);

  const send = async (message: string) => {
    const trimmed = message.trim();
    if (!trimmed || busy) return;
    setInput('');
    setBusy(true);
    setTurns((current) => [...current, { role: 'user', content: trimmed }]);

    try {
      const project = projects[0];
      const response = await chat(trimmed, project?.id);
      setTurns((current) => [
        ...current,
        {
          role: 'assistant',
          content: response.reply,
          meta:
            response.source === 'llm'
              ? `model: ${response.model ?? 'provider'}`
              : 'offline planner — connect a provider for full answers',
        },
      ]);
      if (response.suggestions?.length) setSuggestions(response.suggestions);
    } catch (error) {
      setTurns((current) => [
        ...current,
        {
          role: 'assistant',
          content: `I could not reach the agent runtime. ${
            error instanceof Error ? error.message : ''
          }`,
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="chat">
      <section className="chat__panel">
        <div className="chat__scroll" ref={scrollRef}>
          {turns.map((turn, index) => (
            <div key={index} className={`msg msg--${turn.role}`}>
              <div className="msg__avatar">
                {turn.role === 'assistant' ? <Icon name="spark" size={15} /> : 'You'}
              </div>
              <div className="msg__bubble">
                {turn.meta && (
                  <div className="msg__meta" style={{ marginBottom: 6 }}>
                    {turn.meta}
                  </div>
                )}
                {turn.role === 'assistant' ? <Markdown content={turn.content} /> : turn.content}
              </div>
            </div>
          ))}

          {busy && (
            <div className="msg msg--assistant">
              <div className="msg__avatar">
                <Icon name="spark" size={15} />
              </div>
              <div className="msg__bubble muted">Thinking…</div>
            </div>
          )}
        </div>

        <form
          className="chat__composer"
          onSubmit={(event) => {
            event.preventDefault();
            void send(input);
          }}
        >
          <textarea
            className="textarea"
            value={input}
            placeholder="Describe what you want to create…"
            rows={1}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void send(input);
              }
            }}
          />
          <button type="submit" className="btn btn--primary" disabled={busy || !input.trim()}>
            <Icon name="chevron" size={15} />
            Send
          </button>
        </form>
      </section>

      <aside className="chat__aside" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="card">
          <div className="section__head" style={{ marginBottom: 10 }}>
            <h2 style={{ fontSize: 14 }}>Try one of these</h2>
          </div>
          <div className="suggestions">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="suggestion"
                onClick={() => void send(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="section__head" style={{ marginBottom: 10 }}>
            <h2 style={{ fontSize: 14 }}>Runtime</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
            <div className="status-pill" style={{ padding: '8px 11px' }}>
              <span
                className={`status-dot ${daemonOnline ? 'status-dot--online' : 'status-dot--offline'}`}
              />
              {daemonOnline ? 'Daemon connected' : 'Daemon offline'}
            </div>
            <div className="status-pill" style={{ padding: '8px 11px' }}>
              {/* The offline planner is a working mode, not a failure — show it
                  in the accent colour rather than the offline red. */}
              <span
                className="status-dot"
                style={{ background: health?.llm.reachable ? 'var(--success)' : 'var(--accent-1)' }}
              />
              {health?.llm.reachable
                ? `${health.llm.models.length} models available`
                : 'Built-in planner active'}
            </div>
            <p className="faint" style={{ fontSize: 12, margin: 0 }}>
              Connect any OpenAI-compatible provider in Settings to upgrade every answer.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
