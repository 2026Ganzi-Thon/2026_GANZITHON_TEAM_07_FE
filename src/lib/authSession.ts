/**
 * Token holder for real mode (decision A, 2026-11-18):
 * - access token: memory only (lost on reload, re-issued from the refresh token)
 * - refresh token: sessionStorage, so a reload in the same tab keeps the login; closing the tab ends it.
 * Tokens are never logged or rendered. Swap the storage here if the team changes the policy.
 */
export type SessionChange = 'signed-in' | 'signed-out' | 'expired';
const REFRESH_KEY = 'teslang:refresh-token';
let access: string | null = null;
let memoryRefresh: string | null = null; // fallback when sessionStorage is blocked
const listeners = new Set<(change: SessionChange) => void>();

function storage(): Storage | null {
  try { return globalThis.sessionStorage ?? null; } catch { return null; }
}

export const authSession = {
  access: () => access,
  refreshToken(): string | null {
    try { return storage()?.getItem(REFRESH_KEY) ?? memoryRefresh; } catch { return memoryRefresh; }
  },
  hasSession() { return !!access || !!this.refreshToken(); },
  set(tokens: { accessToken: string; refreshToken: string }) {
    access = tokens.accessToken; memoryRefresh = tokens.refreshToken;
    try { storage()?.setItem(REFRESH_KEY, tokens.refreshToken); } catch { /* memory fallback keeps this tab working */ }
    listeners.forEach(listener => listener('signed-in'));
  },
  clear(change: Exclude<SessionChange, 'signed-in'>) {
    const had = this.hasSession();
    access = null; memoryRefresh = null;
    try { storage()?.removeItem(REFRESH_KEY); } catch { /* nothing stored */ }
    if (had) listeners.forEach(listener => listener(change));
  },
  subscribe(listener: (change: SessionChange) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
};
