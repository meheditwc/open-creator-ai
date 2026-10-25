import { useCallback, useEffect, useState } from 'react';

export const ROUTES = ['dashboard', 'tools', 'agent', 'projects', 'settings'] as const;

export type RouteName = (typeof ROUTES)[number];

const DEFAULT_ROUTE: RouteName = 'dashboard';

function readHash(): RouteName {
  const raw = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  return (ROUTES as readonly string[]).includes(raw) ? (raw as RouteName) : DEFAULT_ROUTE;
}

/** A tiny hash router — no dependency, no history surprises. */
export function useHashRoute(): [RouteName, (route: RouteName) => void] {
  const [route, setRoute] = useState<RouteName>(readHash);

  useEffect(() => {
    const onChange = () => setRoute(readHash());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = useCallback((next: RouteName) => {
    if (window.location.hash === `#/${next}`) return;
    window.location.hash = `#/${next}`;
  }, []);

  return [route, navigate];
}
