import { authSession } from './authSession';
import { backend, SESSION_EXPIRED, settleRefresh } from './backend';
import { decodeBackendProfile, decodeLogin } from './contracts';
import type { Profile } from './domain';
import { ApiError } from './errors';

/** Backend email auth (/api/v1/auth). */
export const authApi = {
  /** Creates the account only; the caller logs in afterwards. */
  signup: async (email: string, password: string, nickname: string): Promise<Profile> =>
    decodeBackendProfile(await backend('auth/signup', { method: 'POST', body: { email, password, nickname } })),
  login: async (email: string, password: string): Promise<Profile> => {
    const { tokens, profile } = decodeLogin(await backend('auth/login', { method: 'POST', body: { email, password } }));
    authSession.set(tokens);
    return profile;
  },
  /** null when there is no session or it can no longer be refreshed. Network errors still throw (retry UI). */
  me: async (): Promise<Profile | null> => {
    if (!authSession.hasSession()) return null;
    try { return decodeBackendProfile(await backend('auth/me', { auth: true })); }
    catch (error) { if (error instanceof ApiError && error.code === SESSION_EXPIRED) return null; throw error; }
  },
  /**
   * Revokes the refresh token on the server when possible; the local session is cleared either way.
   * PR #14 review: wait for an in-flight rotation and read the token at send time, so the token that is
   * revoked is the newest one (a 401 → refresh → resend also sends the rotated token).
   */
  logout: async () => {
    await settleRefresh();
    try { if (authSession.refreshToken()) await backend('auth/logout', { method: 'POST', auth: true, body: () => ({ refreshToken: authSession.refreshToken() }) }); }
    catch { /* best effort: an unreachable server must not keep the user signed in on this device */ }
    finally { authSession.clear('signed-out'); }
  },
};
