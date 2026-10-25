import type { JSX } from 'react';

export function Logo({ size = 38 }: { size?: number }): JSX.Element {
  return (
    <div className="brand__mark" style={{ width: size, height: size, borderRadius: size * 0.32 }}>
      <svg
        viewBox="0 0 24 24"
        width={size * 0.58}
        height={size * 0.58}
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M6 17.5 12 6.5l6 11"
          stroke="#fff"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M8.5 13.5h7" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" />
        <circle cx="18" cy="7.5" r="1.6" fill="#22d3ee" />
      </svg>
    </div>
  );
}
