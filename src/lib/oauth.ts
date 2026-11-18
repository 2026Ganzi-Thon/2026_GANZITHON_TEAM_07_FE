/**
 * Kakao OAuth (Authorization Code). The browser only obtains the code; the backend
 * (`POST /api/v1/auth/oauth/kakao`) exchanges it with its client secret. The redirect URI must be the
 * exact value registered in the Kakao console and in the backend KAKAO_REDIRECT_URI.
 * The button is always shown (decision 2026-11-18); starting needs VITE_KAKAO_CLIENT_ID, and finishing
 * needs the backend (real mode).
 */
export type OAuthProvider = 'kakao';
const PENDING_KEY = 'teslang:oauth-pending';
const AUTHORIZE = 'https://kauth.kakao.com/oauth/authorize';

export function kakaoRedirectUri() {
  return import.meta.env.VITE_KAKAO_REDIRECT_URI?.trim() || `${window.location.origin}/oauth/callback/kakao`;
}

interface Pending { provider: OAuthProvider; state: string; next: string; redirectUri: string }
function storage(): Storage | null { try { return globalThis.sessionStorage ?? null; } catch { return null; } }

/** Leaves the app for Kakao and returns true; false when the app key is not configured. */
export function startKakaoLogin(next: string): boolean {
  const clientId = import.meta.env.VITE_KAKAO_CLIENT_ID?.trim();
  if (!clientId) return false;
  const redirectUri = kakaoRedirectUri();
  const state = crypto.randomUUID(); // guards the callback against forged or stale redirects
  const pending: Pending = { provider: 'kakao', state, next, redirectUri };
  try { storage()?.setItem(PENDING_KEY, JSON.stringify(pending)); } catch { /* the callback will report a state mismatch */ }
  const url = new URL(AUTHORIZE);
  url.search = new URLSearchParams({ response_type: 'code', client_id: clientId, redirect_uri: redirectUri, state }).toString();
  window.location.assign(url.toString());
  return true;
}

/** Reads and removes the pending request once; a second read (refresh, StrictMode replay) returns null. */
export function takePendingOAuth(provider: OAuthProvider, state: string | null): Pending | null {
  let pending: Pending | null = null;
  try {
    const raw = storage()?.getItem(PENDING_KEY);
    storage()?.removeItem(PENDING_KEY);
    pending = raw ? JSON.parse(raw) as Pending : null;
  } catch { return null; }
  if (!pending || pending.provider !== provider || !state || pending.state !== state) return null;
  return pending;
}
