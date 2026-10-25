import type { JSX } from 'react';

import { useApp } from '../state/AppState.tsx';

const TONE_COLORS: Record<string, string> = {
  info: 'var(--text)',
  success: 'var(--success)',
  error: 'var(--danger)',
};

export function Toasts(): JSX.Element {
  const { toasts, dismissToast } = useApp();

  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          className="toast"
          onClick={() => dismissToast(toast.id)}
          style={{ borderLeft: `3px solid ${TONE_COLORS[toast.tone]}`, textAlign: 'left' }}
        >
          {toast.message}
        </button>
      ))}
    </div>
  );
}
