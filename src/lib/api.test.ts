import { afterEach, describe, expect, it, vi } from 'vitest';
import { request, REQUEST_TIMEOUT_MS } from './api';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
function waitForAbort(signal: AbortSignal) {
  return new Promise<never>((_, reject) => {
    const abort = () => reject(new DOMException('Aborted', 'AbortError'));
    if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true });
  });
}
describe('bounded preview transport', () => {
  it('ends an unresponsive request without automatic retries', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn((_: string, init: RequestInit) => waitForAbort(init.signal!));
    vi.stubGlobal('fetch', fetcher);
    const checked = expect(request('messages')).rejects.toMatchObject({ status: 408 });
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS); await checked;
    expect(fetcher).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
  });
  it('also bounds stalled response body reads', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(async (_: string, init: RequestInit) => ({ ok: true, json: () => waitForAbort(init.signal!) })));
    const checked = expect(request('records')).rejects.toMatchObject({ status: 408 });
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS); await checked;
  });
  it('preserves caller cancellation instead of reporting a timeout', async () => {
    vi.useFakeTimers(); const controller = new AbortController();
    vi.stubGlobal('fetch', vi.fn((_: string, init: RequestInit) => waitForAbort(init.signal!)));
    const checked = expect(request('messages', { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort(); await checked; expect(vi.getTimerCount()).toBe(0);
  });
  it('reports connection failures without clearing user data or retrying', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(request('messages')).rejects.toMatchObject({ status: 0 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('rejects malformed successful JSON while preserving HTTP error status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('<html>bad gateway</html>')).mockResolvedValueOnce(new Response('not json', { status: 503 })));
    await expect(request('messages')).rejects.toMatchObject({ status: 502 });
    await expect(request('messages')).rejects.toMatchObject({ status: 503 });
  });
  it('cleans deadlines after success and passes a readable API error through', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({ ok: true })).mockResolvedValueOnce(Response.json({ message: '다시 연결해 주세요' }, { status: 401 })));
    await expect(request('me')).resolves.toEqual({ ok: true });
    await expect(request('me')).rejects.toMatchObject({ status: 401, message: '다시 연결해 주세요' });
    expect(vi.getTimerCount()).toBe(0);
  });
});
