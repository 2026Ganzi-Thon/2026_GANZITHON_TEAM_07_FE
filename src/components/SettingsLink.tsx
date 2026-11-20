import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router';

export function settingsReturnFor(location: { pathname: string; search: string; state: unknown }, state = location.state) {
  return { to: location.pathname + location.search, state };
}
export function readSettingsReturn(value: unknown): { to: string; state?: unknown } {
  if (value && typeof value === 'object' && 'to' in value && typeof value.to === 'string'
    && /^(?:\/(?:\?play=(?:SLANGI|SQUISHY|WAKPPU))?|\/(?:archive|malangi|chat|sleep|results\/[^/?#]+|records\/[^/?#]+)(?:\?[^#]*)?)$/.test(value.to)) {
    return { to: value.to, state: 'state' in value ? value.state : undefined };
  }
  return { to: '/' };
}
export function SettingsLink({ children, returnState }: { children: ReactNode; returnState?: unknown }) {
  const location = useLocation();
  return <Link to="/settings" state={{ settingsReturn: settingsReturnFor(location, returnState ?? location.state) }} aria-label="MY 및 설정">{children}</Link>;
}
