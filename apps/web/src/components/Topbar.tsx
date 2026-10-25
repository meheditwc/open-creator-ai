import type { JSX } from 'react';

import { Icon } from './Icon.tsx';
import { useTheme } from '../hooks/useTheme.ts';

export function Topbar({
  title,
  subtitle,
  search,
  onSearch,
  children,
}: {
  title: string;
  subtitle: string;
  search?: string;
  onSearch?: (value: string) => void;
  children?: React.ReactNode;
}): JSX.Element {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="topbar">
      <div className="topbar__title">
        <h1>{title}</h1>
        <span>{subtitle}</span>
      </div>

      <div className="topbar__actions">
        {onSearch && (
          <label className="search">
            <span className="search__icon">
              <Icon name="search" size={15} />
            </span>
            <input
              type="search"
              value={search}
              placeholder="Search tools…"
              onChange={(event) => onSearch(event.target.value)}
              aria-label="Search"
            />
          </label>
        )}

        {children}

        <button
          type="button"
          className="btn btn--icon btn--ghost"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          aria-label="Toggle theme"
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17} />
        </button>
      </div>
    </header>
  );
}
