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

/**
 * Kept in sessionStorage only for the Kakao round trip (the page is reloaded). `entry` is the unsent first
 * message from the home sheet (PR #14 review): AGENTS.md keeps conversation text out of browser storage, so it
 * is the one exception — written right before leaving, removed on the first read, ignored after 10 minutes,
 * and gone when the tab closes.
 */
interface Pending { provider: OAuthProvider; state: string; next: string; redirectUri: string; entry?: string; createdAt: number }
const PENDING_TTL_MS = 10 * 60_000;
function storage(): Storage | null { try { return globalThis.sessionStorage ?? null; } catch { return null; } }

/** Leaves the app for Kakao and returns true; false when the app key is not configured. */
export function startKakaoLogin(next: string, entry?: string): boolean {
  const clientId = import.meta.env.VITE_KAKAO_CLIENT_ID?.trim();
  if (!clientId) return false;
  const redirectUri = kakaoRedirectUri();
  const state = crypto.randomUUID(); // guards the callback against forged or stale redirects
  const pending: Pending = { provider: 'kakao', state, next, redirectUri, createdAt: Date.now(), ...(entry?.trim() ? { entry: entry.trim() } : {}) };
  try { storage()?.setItem(PENDING_KEY, JSON.stringify(pending)); } catch { /* the callback will report a state mismatch */ }
  const url = new URL(AUTHORIZE);
  url.search = new URLSearchParams({ response_type: 'code', client_id: clientId, redirect_uri: redirectUri, state }).toString();
  window.location.assign(url.toString());
  return true;
}

function readAndRemove(): Pending | null {
  try {
    const raw = storage()?.getItem(PENDING_KEY);
    storage()?.removeItem(PENDING_KEY);
    const pending = raw ? JSON.parse(raw) as Pending : null;
    return pending && typeof pending.createdAt === 'number' && Date.now() - pending.createdAt <= PENDING_TTL_MS ? pending : null;
  } catch { return null; }
}

/**
 * Callback: reads and removes the pending request once (a refresh or StrictMode replay returns null).
 * `entry` is returned even when the state does not match, so the user's unsent first message is never lost;
 * only `pending` (the permission to exchange the code) depends on the state check.
 */
export function takePendingOAuth(provider: OAuthProvider, state: string | null): { pending: Pending | null; entry?: string } {
  const stored = readAndRemove();
  const matches = !!stored && stored.provider === provider && !!state && stored.state === state;
  return { pending: matches ? stored : null, entry: stored?.entry };
}

/** Back on the login screen without a callback (Kakao page abandoned): drop the request, keep the message. */
export function discardPendingOAuth(): string | undefined { return readAndRemove()?.entry; }
