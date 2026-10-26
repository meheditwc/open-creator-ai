import type { JSX, SVGProps } from 'react';

export type IconName =
  | 'dashboard'
  | 'tools'
  | 'agent'
  | 'projects'
  | 'settings'
  | 'sun'
  | 'moon'
  | 'search'
  | 'plus'
  | 'play'
  | 'trash'
  | 'close'
  | 'spark'
  | 'check'
  | 'chevron'
  | 'refresh'
  | 'external'
  | 'folder'
  | 'bolt'
  | 'translate'
  | 'download'
  | 'image'
  | 'film'
  | 'article'
  | 'clapper'
  | 'figure'
  | 'mic'
  | 'captions'
  | 'compass'
  | 'target'
  | 'key'
  | 'calendar'
  | 'checklist'
  | 'growth'
  | 'copy';

const PATHS: Record<IconName, JSX.Element> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7.5" height="8.5" rx="2" />
      <rect x="13.5" y="3" width="7.5" height="5.5" rx="2" />
      <rect x="3" y="14.5" width="7.5" height="6.5" rx="2" />
      <rect x="13.5" y="11.5" width="7.5" height="9.5" rx="2" />
    </>
  ),
  tools: (
    <>
      <path d="M14.7 6.3a4.5 4.5 0 0 0 5.9-5.9L18 3l3 3 2.6-2.6a4.5 4.5 0 0 1-5.9 5.9L9.9 17.1a2.1 2.1 0 0 1-3-3z" />
      <path d="M6.5 14.5 3 18" />
    </>
  ),
  agent: (
    <>
      <rect x="4" y="7" width="16" height="12" rx="3.5" />
      <path d="M12 7V4" />
      <circle cx="12" cy="3" r="1.4" />
      <path d="M9 12v1.5M15 12v1.5M9.5 16h5" />
    </>
  ),
  projects: (
    <>
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.2a2 2 0 0 1 1.5.7l1 1.2a2 2 0 0 0 1.5.7h6.8A2.5 2.5 0 0 1 22 10v6.5a2.5 2.5 0 0 1-2.5 2.5h-14A2.5 2.5 0 0 1 3 16.5z" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  play: <path d="M7 4.5v15l12-7.5z" />,
  trash: (
    <>
      <path d="M4 7h16M10 11v6M14 11v6" />
      <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
      <path d="M9 7V4h6v3" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6L6 18" />,
  spark: (
    <>
      <path d="M12 3.5 13.8 9l5.5 1.8-5.5 1.8L12 18l-1.8-5.4L4.7 10.8 10.2 9z" />
      <path d="M18.5 16.5 19.3 19l2.2.8-2.2.8-.8 2.4-.8-2.4-2.2-.8 2.2-.8z" />
    </>
  ),
  check: <path d="m5 13 4.5 4.5L19 7" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  refresh: (
    <>
      <path d="M20 11a8 8 0 1 0-2.3 5.7" />
      <path d="M20 5v6h-6" />
    </>
  ),
  external: (
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4 10 14" />
      <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </>
  ),
  folder: (
    <>
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.2a2 2 0 0 1 1.5.7l1 1.2a2 2 0 0 0 1.5.7h6.8A2.5 2.5 0 0 1 22 10v6.5a2.5 2.5 0 0 1-2.5 2.5h-14A2.5 2.5 0 0 1 3 16.5z" />
    </>
  ),
  bolt: <path d="M13 2 4.5 13.5H11l-1 8.5 9-11.5h-6.5z" />,
  translate: (
    <>
      <path d="M3 6h9M7.5 6V4.5M9.8 6c-.6 4.2-3 6.9-6.3 8.2" />
      <path d="M5 10.4c1.4 2 3.3 3.3 5.5 3.9" />
      <path d="m13 20 4-9 4 9M14.6 17h4.8" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v11" />
      <path d="m7.5 10 4.5 4.5L16.5 10" />
      <path d="M4 20h16" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="3" />
      <circle cx="8.5" cy="10" r="1.6" />
      <path d="m4 17 4.5-4.2a2 2 0 0 1 2.7 0L16 17M14 14l1.6-1.5a2 2 0 0 1 2.7 0L20.5 14" />
    </>
  ),
  film: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M8 4v16M16 4v16M3 12h18M3 8h5M3 16h5M16 8h5M16 16h5" />
    </>
  ),
  article: (
    <>
      <path d="M6 3.5h7.5L18 8v12.5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1z" />
      <path d="M13 3.5V8h4.5M8.5 13h7M8.5 17h4.5" />
    </>
  ),
  clapper: (
    <>
      <path d="M3 9.5 20.5 5l1 4L4 13.5z" />
      <path d="M4 13.5V19a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-5.5" />
      <path d="m8 7.5 2 4M14 5.5l2 4" />
    </>
  ),
  figure: (
    <>
      <circle cx="12" cy="5" r="2.4" />
      <path d="M12 7.5v6M8 10.5h8M9.5 21l2.5-7 2.5 7" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
    </>
  ),
  captions: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="M8 11.5h3M14 11.5h3M8 15h2M12.5 15h4.5" />
    </>
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2.5" />
      <path d="M15.5 8.5V6a2.5 2.5 0 0 0-2.5-2.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15" r="3.5" />
      <path d="M10.5 12.5 19 4M16.5 6.5 19 9M14 9l2.5 2.5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 9.5h17M8 3.5V6M16 3.5V6" />
    </>
  ),
  checklist: (
    <>
      <path d="M4 6.5l2 2 3-3.5M4 12.5l2 2 3-3.5M4 18.5l2 2 3-3.5" />
      <path d="M13 7h7M13 13h7M13 19h7" />
    </>
  ),
  growth: (
    <>
      <path d="M3.5 19.5h17" />
      <path d="M6.5 16V10M11 16V6.5M15.5 16v-4M20 16V8.5" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" />
    </>
  ),
};

export interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 18, ...props }: IconProps): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {PATHS[name]}
    </svg>
  );
}
