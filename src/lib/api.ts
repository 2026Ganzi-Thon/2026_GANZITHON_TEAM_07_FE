import type { PreviewReply, PreviewRequest } from '../features/chat/model';
import type { ResultDraft, ToyType } from './domain';
import { ApiError, ResponseShapeError } from './errors';
import { decodeInventory, decodeOk, decodeProfile, decodeRecord, decodeRecords, decodeReply } from './contracts';
export { ApiError } from './errors';
export const REQUEST_TIMEOUT_MS = 30_000;
export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) cancel();
  else options.signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`/__preview__/${path}`, { ...options, signal: controller.signal });
    // Keep the deadline active while the response body is still downloading.
    const body: unknown = await response.json().catch(error => {
      if (controller.signal.aborted) throw error;
      if (!response.ok) return null;
      throw new ResponseShapeError();
    });
    if (!response.ok) {
      const message = body && typeof body === 'object' && 'message' in body && typeof body.message === 'string' ? body.message : `요청에 실패했습니다 (${response.status})`;
      throw new ApiError(message, response.status);
    }
    return body as T;
  } catch (error) {
    if (timedOut) throw new ApiError('응답이 지연되고 있어요. 연결을 확인한 뒤 다시 시도해 주세요.', 408);
    if (controller.signal.aborted || error instanceof ApiError) throw error;
    throw new ApiError('연결하지 못했어요. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.', 0);
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', cancel);
  }
}
function json(body: unknown, method = 'POST', fail = false): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json', ...(fail ? { 'X-Preview-Failure': 'once' } : {}) }, body: JSON.stringify(body) };
}
export const previewApi = {
  me: async () => { const value = await request<unknown>('me'); return value === null ? null : decodeProfile(value); },
  login: async (id: string) => decodeProfile(await request('login', json({ id }))),
  logout: async () => decodeOk(await request('logout', json({}))),
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
