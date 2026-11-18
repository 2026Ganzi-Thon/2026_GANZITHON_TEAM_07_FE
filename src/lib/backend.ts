import { API_BASE_URL } from './apiMode';
import { authSession } from './authSession';
import { decodeEnvelope, decodeTokenPair } from './contracts';
import { ApiError } from './errors';
import { send } from './transport';

export interface BackendOptions { method?: string; body?: unknown; auth?: boolean; signal?: AbortSignal }
export const SESSION_EXPIRED = 'SESSION_EXPIRED';
const expired = () => new ApiError('로그인이 만료됐어요. 다시 로그인해 주세요.', 401, SESSION_EXPIRED);

async function call(path: string, options: BackendOptions, token?: string): Promise<unknown> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  return decodeEnvelope(await send(`${API_BASE_URL}/api/v1/${path}`, {
    method: options.method ?? 'GET', headers, signal: options.signal,
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  }));
}

let refreshing: Promise<string> | null = null;
/**
 * Rotates the token pair once. Concurrent 401s share this single request (the backend revokes the old
 * refresh token, so a second parallel refresh would fail). A rejected refresh token ends the session;
 * a network failure keeps it so the user can retry.
 */
export function refreshAccess(staleAccess?: string): Promise<string> {
  const current = authSession.access();
  if (staleAccess && current && current !== staleAccess) return Promise.resolve(current);
  refreshing ??= (async () => {
    const refreshToken = authSession.refreshToken();
    if (!refreshToken) { authSession.clear('expired'); throw expired(); }
    try {
      const tokens = decodeTokenPair(await call('auth/refresh', { method: 'POST', body: { refreshToken } }));
      authSession.set(tokens);
      return tokens.accessToken;
    } catch (error) {
      if (error instanceof ApiError && (error.status === 400 || error.status === 401)) { authSession.clear('expired'); throw expired(); }
      throw error;
    }
  })().finally(() => { refreshing = null; });
  return refreshing;
}

/**
 * Backend request returning the envelope `data`. With `auth`, a 401 triggers one refresh and exactly one
 * resend: 401 means the server did not process the request, so the resend cannot duplicate a save/delete.
 * This is the only automatic resend for backend HTTP failures (AGENTS.md exception for auth).
 */
export async function backend(path: string, options: BackendOptions = {}): Promise<unknown> {
  if (!options.auth) return call(path, options);
  const token = authSession.access() ?? (authSession.refreshToken() ? await refreshAccess() : null);
  if (!token) throw expired();
  try {
    return await call(path, options, token);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401 || options.signal?.aborted) throw error;
  }
  const renewed = await refreshAccess(token);
  try {
    return await call(path, options, renewed);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) { authSession.clear('expired'); throw expired(); }
    throw error;
  }
}
