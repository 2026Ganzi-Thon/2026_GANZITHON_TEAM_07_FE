import { afterEach, describe, expect, it, vi } from 'vitest';
import { authSession } from './authSession';
import { backend, SESSION_EXPIRED } from './backend';
import { authApi } from './authApi';
import { decodeBackendProfile, decodeEnvelope, decodeLogin } from './contracts';

const ok = (data: unknown, status = 200) => Response.json({ success: true, data, error: null }, { status });
const fail = (status: number, code: string, message = '실패', data: unknown = null) => Response.json({ success: false, data, error: { code, message } }, { status });
const tokens = (n: number) => ({ accessToken: `access-${n}`, refreshToken: `refresh-${n}`, tokenType: 'Bearer', expiresIn: 86400 });
const authHeader = (call: unknown[]) => new Headers((call[1] as RequestInit).headers).get('Authorization');

afterEach(() => { authSession.clear('signed-out'); vi.unstubAllGlobals(); });

describe('backend envelope', () => {
  it('returns data, maps error code/details and tolerates 204', () => {
    expect(decodeEnvelope({ status: 200, ok: true, body: { success: true, data: { a: 1 }, error: null } })).toEqual({ a: 1 });
    expect(decodeEnvelope({ status: 204, ok: true, body: undefined })).toBeUndefined();
    expect(() => decodeEnvelope({ status: 409, ok: false, body: { success: false, data: { existingProvider: 'KAKAO' }, error: { code: 'EMAIL_ALREADY_REGISTERED', message: '이미 가입됨' } } }))
      .toThrow(expect.objectContaining({ status: 409, code: 'EMAIL_ALREADY_REGISTERED', details: { existingProvider: 'KAKAO' }, message: '이미 가입됨' }));
    expect(() => decodeEnvelope({ status: 502, ok: false, body: null })).toThrow(expect.objectContaining({ status: 502 }));
    expect(() => decodeEnvelope({ status: 200, ok: true, body: { id: 1 } })).toThrow(expect.objectContaining({ status: 502 }));
  });
  it('validates auth payloads instead of trusting them', () => {
    expect(decodeLogin({ ...tokens(1), userId: 7, nickname: '말랑' })).toEqual({ tokens: { accessToken: 'access-1', refreshToken: 'refresh-1', expiresIn: 86400 }, profile: { id: '7', nickname: '말랑' } });
    expect(decodeBackendProfile({ userId: 7, email: 'a@b.c', nickname: '말랑', provider: 'LOCAL' })).toEqual({ id: '7', email: 'a@b.c', nickname: '말랑' });
    expect(() => decodeLogin({ ...tokens(1), userId: '7', nickname: '말랑' })).toThrow();
    expect(() => decodeLogin({ accessToken: 'a', userId: 7, nickname: '말랑', expiresIn: 1 })).toThrow();
  });
});

describe('authorized requests', () => {
  it('refreshes once on 401 and resends exactly once with the new token', async () => {
    authSession.set(tokens(1));
    const fetcher = vi.fn()
      .mockResolvedValueOnce(fail(401, 'UNAUTHORIZED'))
      .mockResolvedValueOnce(ok(tokens(2)))
      .mockResolvedValueOnce(ok({ userId: 1, email: 'a@b.c', nickname: 'n' }));
    vi.stubGlobal('fetch', fetcher);
    await expect(backend('auth/me', { auth: true })).resolves.toMatchObject({ userId: 1 });
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(authHeader(fetcher.mock.calls[0])).toBe('Bearer access-1');
    expect(JSON.parse((fetcher.mock.calls[1][1] as RequestInit).body as string)).toEqual({ refreshToken: 'refresh-1' });
    expect(authHeader(fetcher.mock.calls[2])).toBe('Bearer access-2');
    expect(authSession.refreshToken()).toBe('refresh-2');
  });
  it('shares one refresh between concurrent 401s', async () => {
    authSession.set(tokens(1));
    let refreshes = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith('/auth/refresh')) { refreshes++; await new Promise(resolve => setTimeout(resolve, 5)); return ok(tokens(2)); }
      return new Headers(init.headers).get('Authorization') === 'Bearer access-2' ? ok({ fine: true }) : fail(401, 'UNAUTHORIZED');
    }));
    await expect(Promise.all([backend('records', { auth: true }), backend('malangis', { auth: true })])).resolves.toEqual([{ fine: true }, { fine: true }]);
    expect(refreshes).toBe(1);
  });
  it('ends the session when the refresh token is rejected, without a further resend', async () => {
    authSession.set(tokens(1));
    const changes: string[] = []; const stop = authSession.subscribe(change => changes.push(change));
    const fetcher = vi.fn().mockResolvedValueOnce(fail(401, 'UNAUTHORIZED')).mockResolvedValueOnce(fail(401, 'INVALID_REFRESH_TOKEN'));
    vi.stubGlobal('fetch', fetcher);
    await expect(backend('auth/me', { auth: true })).rejects.toMatchObject({ status: 401, code: SESSION_EXPIRED });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(authSession.hasSession()).toBe(false);
    expect(changes).toEqual(['expired']); stop();
  });
  it('keeps the session on a network failure during refresh so the user can retry', async () => {
    authSession.set(tokens(1));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(fail(401, 'UNAUTHORIZED')).mockRejectedValueOnce(new TypeError('offline')));
    await expect(backend('auth/me', { auth: true })).rejects.toMatchObject({ status: 0 });
    expect(authSession.refreshToken()).toBe('refresh-1');
  });
  it('does not refresh or resend non-401 failures', async () => {
    authSession.set(tokens(1));
    const fetcher = vi.fn().mockResolvedValue(fail(503, 'REPORT_UNAVAILABLE'));
    vi.stubGlobal('fetch', fetcher);
    await expect(backend('records/report', { auth: true })).rejects.toMatchObject({ status: 503, code: 'REPORT_UNAVAILABLE' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe('auth api', () => {
  it('logs in, then clears the local session on logout even if the server is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(ok({ ...tokens(1), userId: 3, nickname: '테스' })).mockRejectedValueOnce(new TypeError('offline')));
    await expect(authApi.login('a@b.c', 'Password1!')).resolves.toEqual({ id: '3', nickname: '테스' });
    expect(authSession.access()).toBe('access-1');
    await authApi.logout();
    expect(authSession.hasSession()).toBe(false);
  });
  it('reports no profile without a session and when the session expired', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    await expect(authApi.me()).resolves.toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
    authSession.set(tokens(1));
    fetcher.mockResolvedValueOnce(fail(401, 'UNAUTHORIZED')).mockResolvedValueOnce(fail(401, 'INVALID_REFRESH_TOKEN'));
    await expect(authApi.me()).resolves.toBeNull();
  });
});
