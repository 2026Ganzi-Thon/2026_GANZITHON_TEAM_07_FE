import { createContext, useContext, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, useLocation } from 'react-router';
import type { ResultDraft } from './domain';
import { accountApi, previewApi } from './api';
import { authSession } from './authSession';
interface PreviewState { entry: { text: string } | null; drafts: Map<string, ResultDraft>; faults: { save: boolean; list: boolean; remove: boolean } }
const PreviewContext = createContext<PreviewState | null>(null);
export function PreviewProvider({ children }: { children: ReactNode }) {
  const value = useRef<PreviewState>({ entry: null, drafts: new Map(), faults: { save: false, list: false, remove: false } });
  const client = useQueryClient();
  // real mode: when the refresh token is rejected, drop cached account data; RequirePreview then sends the
  // user to /login with the current page as `next`.
  useEffect(() => authSession.subscribe(change => {
    if (change !== 'expired') return;
    value.current.drafts.clear(); value.current.entry = null;
    // Keep the profile query itself: it may be the request that just detected the expiry. Removing an
    // in-flight query leaves its observers pending; setting null lets RequirePreview redirect.
    client.removeQueries({ queryKey: ['preview'], predicate: query => query.queryKey[1] !== 'me' });
    client.setQueryData(['preview', 'me'], null);
    void previewApi.logout().catch(() => {});
  }), [client]);
  return <PreviewContext.Provider value={value.current}>{children}</PreviewContext.Provider>;
}
export function usePreview() { const value = useContext(PreviewContext); if (!value) throw new Error('PreviewProvider required'); return value; }
export function useProfile() { return useQuery({ queryKey: ['preview', 'me'], queryFn: accountApi.me, staleTime: Infinity }); }
export function RequirePreview({ children }: { children: ReactNode }) {
  const user = useProfile(); const location = useLocation();
  if (user.isPending) return <div className="bootError" role="status">화면을 준비하고 있어요.</div>;
  if (user.isError) return <div className="bootError" role="alert"><p>계정을 확인하지 못했어요.</p><button onClick={() => user.refetch()}>다시 시도하기</button></div>;
  if (!user.data) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return children;
}
