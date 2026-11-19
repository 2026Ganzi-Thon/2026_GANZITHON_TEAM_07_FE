import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { accountApi } from '../../lib/api';
import { API_MODE } from '../../lib/apiMode';
import { takePendingOAuth } from '../../lib/oauth';
import { usePreview } from '../../lib/PreviewContext';
import { describeOAuthError } from './authMessages';
import { loginDestination } from './Login';
import styles from './Login.module.css';

/** /oauth/callback/:provider — exchanges the Kakao code once, then returns to the original destination. */
export function OAuthCallback() {
  const { provider } = useParams(); const [params] = useSearchParams();
  const navigate = useNavigate(); const client = useQueryClient(); const preview = usePreview();
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState('/login');
  useEffect(() => {
    if (started.current) return; // StrictMode replay / re-render must not spend the one-time code twice
    started.current = true;
    const { pending, entry } = provider === 'kakao' ? takePendingOAuth('kakao', params.get('state')) : { pending: null };
    // Restore the unsent first message (PR #14 review) whatever the outcome; Chat sends it after login.
    if (entry && !preview.entry) preview.entry = { text: entry };
    if (pending) setRetry(`/login?next=${encodeURIComponent(pending.next)}`);
    if (provider !== 'kakao') { setError('지원하지 않는 로그인 방식이에요.'); return; }
    const denied = params.get('error');
    if (denied) { setError(denied === 'access_denied' ? '카카오 로그인을 취소했어요.' : '카카오 로그인을 완료하지 못했어요. 다시 시도해 주세요.'); return; }
    const code = params.get('code');
    if (!pending || !code) { setError('로그인 요청을 확인하지 못했어요. 처음부터 다시 시도해 주세요.'); return; }
    // mock mode has no backend to exchange the code with; say so instead of failing on a missing /api.
    if (API_MODE !== 'real') { setError('카카오 로그인은 실제 서버에 연결된 상태(real 모드)에서만 완료할 수 있어요.'); return; }
    accountApi.loginWithOAuth('kakao', code, pending.redirectUri).then(profile => {
      client.removeQueries({ queryKey: ['preview'] }); preview.drafts.clear(); // entry is kept on purpose
      client.setQueryData(['preview', 'me'], profile);
      navigate(loginDestination(pending.next), { replace: true });
    }, failure => setError(describeOAuthError(failure)));
  }, [client, navigate, params, preview, provider]);
  return <main className={styles.callback} aria-busy={!error}>
    {error
      ? <><p role="alert">{error}</p><Link to={retry} replace>로그인 화면으로 돌아가기</Link></>
      : <p role="status">카카오 계정을 확인하고 있어요…</p>}
  </main>;
}
