import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useProfile } from '../../lib/PreviewContext';
import { authSession } from '../../lib/authSession';
import { API_MODE } from '../../lib/apiMode';
import { DESIGN_ASSETS } from '../../lib/assets';
import { loginDestination } from './Login';
import styles from './Splash.module.css';

/** One entry boundary per app mount; ordinary navigation never replays the splash. */
export function AppEntry({ children }: { children: ReactNode }) {
  // Keep the explicitly selected mock workbench and its isolated material fixtures independent of real auth.
  return API_MODE === 'mock' ? children : <AuthenticatedEntry>{children}</AuthenticatedEntry>;
}

function AuthenticatedEntry({ children }: { children: ReactNode }) {
  const location = useLocation();
  // Public help must not rotate a refresh token during Back/Forward document navigation.
  const profile = useProfile(location.pathname !== '/help');
  const id = profile.data?.id ?? null;
  const [readyFor, setReadyFor] = useState<string | null>(null);

  useEffect(() => {
    setReadyFor(null);
    if (!id) return;
    let cancelled = false;
    const timers: number[] = [];
    const wait = (ms: number) => new Promise<void>(resolve => { timers.push(window.setTimeout(resolve, ms)); });
    const image = new Image(); image.src = DESIGN_ASSETS.lamb;
    const assets = Promise.allSettled([image.decode(), document.fonts.load('28px Cafe24Dongdong')]);
    // A short readable transition, capped asset wait; a failed image must not trap entry.
    void Promise.all([Promise.race([assets, wait(3000)]), wait(700)]).then(() => {
      if (!cancelled) setReadyFor(id);
    });
    return () => { cancelled = true; timers.forEach(window.clearTimeout); };
  }, [id]);

  // Help remains reachable independently of authentication.
  if (location.pathname === '/help') return children;
  if (profile.isPending) return authSession.hasSession() ? <Splash /> : <div className={styles.checking} aria-busy="true" aria-label="로그인 상태 확인 중" />;
  if (profile.isError) return <div className={styles.error} role="alert"><p>계정을 확인하지 못했어요.</p><button onClick={() => void profile.refetch()}>다시 시도하기</button></div>;
  if (!id) {
    if (location.pathname === '/login') return children;
    const next = location.pathname + location.search;
    return <Navigate to={next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`} replace />;
  }
  if (readyFor !== id) return <Splash />;
  if (location.pathname === '/login') return <Navigate to={loginDestination(new URLSearchParams(location.search).get('next'))} replace />;
  return <div className={styles.content}>{children}</div>;
}

function Splash() {
  return <main className={styles.splash} aria-label="테슬랑 시작" aria-busy="true">
    <div className={styles.group}>
      <img src={DESIGN_ASSETS.lamb} width={1536} height={1024} alt="편안히 쉬고 있는 양" className={styles.sheep} />
      <p role="status" aria-label="로딩 중" className={styles.loading}>로딩 중<span aria-hidden="true" className={styles.dots}><span>.</span><span>.</span><span>.</span></span></p>
    </div>
  </main>;
}
