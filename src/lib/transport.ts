import { ApiError, ResponseShapeError } from './errors';

export const REQUEST_TIMEOUT_MS = 30_000;
export interface Sent { status: number; ok: boolean; body: unknown }

/**
 * One bounded fetch shared by the preview (MSW) and backend adapters: a 30s deadline that also covers the
 * body download, caller cancellation, and a single attempt (no automatic retry here).
 * `body` is undefined for 204/empty responses and null for an unreadable error body.
 */
export async function send(url: string, options: RequestInit = {}): Promise<Sent> {
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) cancel();
  else options.signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (response.status === 204) return { status: 204, ok: true, body: undefined };
    // Keep the deadline active while the response body is still downloading.
    const body: unknown = await response.json().catch(error => {
      if (controller.signal.aborted) throw error;
      if (!response.ok) return null;
      throw new ResponseShapeError();
    });
    return { status: response.status, ok: response.ok, body };
  } catch (error) {
    if (timedOut) throw new ApiError('응답이 지연되고 있어요. 연결을 확인한 뒤 다시 시도해 주세요.', 408);
    if (controller.signal.aborted || error instanceof ApiError) throw error;
    throw new ApiError('연결하지 못했어요. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.', 0);
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', cancel);
  }
}
