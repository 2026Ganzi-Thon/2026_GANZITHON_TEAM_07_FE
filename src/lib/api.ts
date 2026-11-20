import type { PreviewReply, PreviewRequest } from '../features/chat/model';
import type { Profile, ResultDraft, ToyType } from './domain';
import { ApiError, ResponseShapeError } from './errors';
import { decodeInventory, decodeOk, decodeProfile, decodeRecord, decodeRecords, decodeReply } from './contracts';
import { send } from './transport';
import { API_MODE } from './apiMode';
import { authApi } from './authApi';
export { ApiError } from './errors';
export { REQUEST_TIMEOUT_MS } from './transport';
/** Preview (MSW) transport: plain JSON bodies, `{ message }` on failure. */
export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { ok, status, body } = await send(`/__preview__/${path}`, options);
  if (!ok) {
    const message = body && typeof body === 'object' && 'message' in body && typeof body.message === 'string' ? body.message : `요청에 실패했습니다 (${status})`;
    throw new ApiError(message, status);
  }
  return body as T;
}
function json(body: unknown, method = 'POST', fail = false): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json', ...(fail ? { 'X-Preview-Failure': 'once' } : {}) }, body: JSON.stringify(body) };
}
export const previewApi = {
  me: async () => { const value = await request<unknown>('me'); return value === null ? null : decodeProfile(value); },
  login: async (id: string) => decodeProfile(await request('login', json({ id }))),
  logout: async () => decodeOk(await request('logout', json({}))),
  /** real mode: keep not-yet-connected example features separated per backend account. */
  bind: async (profile: Profile) => decodeProfile(await request('bind', json({ id: profile.id, nickname: profile.nickname }))),
  inventory: async () => decodeInventory(await request('inventory')),
  selectToy: async (type: ToyType) => decodeInventory(await request('inventory', json({ type }, 'PATCH'))),
  reply: async (input: PreviewRequest, fail = false, signal?: AbortSignal): Promise<PreviewReply> => {
    for (let attempt = 0; attempt < 2; attempt++) {
      signal?.throwIfAborted();
      try { return decodeReply(await request('messages', { ...json(input, 'POST', fail), signal })); }
      catch (error) { if (!(error instanceof ResponseShapeError) || attempt === 1 || signal?.aborted) throw error; }
    }
    throw new ResponseShapeError();
  },
  save: async (draft: ResultDraft, fail = false) => decodeRecord(await request('records', json(draft, 'POST', fail))),
  records: async (fail = false) => decodeRecords(await request('records', { headers: fail ? { 'X-Preview-Failure': 'once' } : {} })),
  record: async (id: string) => decodeRecord(await request(`records/${encodeURIComponent(id)}`)),
  setRecordHidden: async (id: string, hidden: boolean) => decodeRecord(await request(`records/${encodeURIComponent(id)}`, json({ hidden }, 'PATCH'))),
  deleteRecord: async (id: string, fail = false) => decodeOk(await request(`records/${encodeURIComponent(id)}`, { method: 'DELETE', headers: fail ? { 'X-Preview-Failure': 'once' } : {} })),
};
/**
 * Account entry points used by screens. mock: preview demo accounts. real: backend auth, then the profile is
 * bound to the preview store so local toy inventory remains scoped per real account.
 */
export const accountApi = {
  me: async (): Promise<Profile | null> => {
    if (API_MODE === 'mock') return previewApi.me();
    const profile = await authApi.me();
    if (profile) await previewApi.bind(profile); else await previewApi.logout();
    return profile;
  },
  loginWithEmail: async (email: string, password: string) => {
    const profile = await authApi.login(email, password);
    await previewApi.bind(profile);
    return profile;
  },
  signupWithEmail: (email: string, password: string, nickname: string) => authApi.signup(email, password, nickname),
  logout: async () => {
    if (API_MODE === 'real') await authApi.logout();
    return previewApi.logout();
  },
};
