import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodeInventory, decodeRecord, decodeRecords, decodeReply } from './contracts';
import { previewApi } from './api';
import { newContext } from '../features/chat/model';
const reply = { stage: 'EMOTIONS', text: '마음을 골라볼까요?', slots: { OPEN: '사건' }, unknowns: {} };
const input = { context: newContext(), text: '오늘 발표를 망쳤어', requestId: 'stable-id' };
const record = { id: 'one', createdAt: '2026-11-14T00:00:00Z', context: { ...newContext(), stage: 'DONE', primary: '불안', pre: 0 }, summary: '정리', recommended: 'SLANGI' };
afterEach(() => vi.unstubAllGlobals());
describe('response boundary', () => {
  it('whitelists reply fields so the server cannot override explicit user values', () => {
    expect(decodeReply({ ...reply, primary: '분노', pre: 10, messages: [], __proto__: null })).toEqual(reply);
  });
  it.each([null, [], { ...reply, stage: 'OTHER' }, { ...reply, text: '왜? 언제?' }, { ...reply, stage: 'DONE' }, { ...reply, slots: { OPEN: 4 } }, { ...reply, unknowns: { OPEN: -1 } }])('rejects malformed reply %#', value => {
    expect(() => decodeReply(value)).toThrow();
  });
  it('keeps zero and null distinct and rejects invalid records', () => {
    expect(decodeRecord(record).context).toMatchObject({ pre: 0, post: null });
    for (const pre of [undefined, 11, -1, .5, '0']) expect(() => decodeRecord({ ...record, context: { ...record.context, pre } })).toThrow();
    expect(() => decodeRecord({ ...record, createdAt: 'not a date' })).toThrow();
    expect(() => decodeRecords([record, record])).toThrow();
  });
  it('rejects unknown or inconsistent inventory rather than rendering a broken toy', () => {
    expect(() => decodeInventory({ selected: 'SQUISHY', unlocked: ['SLANGI'], name: '말랑이' })).toThrow();
    expect(() => decodeInventory({ selected: 'OTHER', unlocked: ['OTHER'], name: '말랑이' })).toThrow();
  });
  it('retries malformed message data once with exactly the same request id and payload', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ stage: 'bad' })).mockResolvedValueOnce(Response.json(reply)); vi.stubGlobal('fetch', fetcher);
    await expect(previewApi.reply(input)).resolves.toEqual(reply);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0][1].body).toBe(fetcher.mock.calls[1][1].body);
  });
  it('stops after the second invalid response', async () => {
    const fetcher = vi.fn(() => Promise.resolve(Response.json({ stage: 'bad' }))); vi.stubGlobal('fetch', fetcher);
    await expect(previewApi.reply(input)).rejects.toMatchObject({ status: 502 }); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('does not automatically repeat HTTP failures or writes', async () => {
    const fetcher = vi.fn(() => Promise.resolve(Response.json({}, { status: 503 }))); vi.stubGlobal('fetch', fetcher);
    await expect(previewApi.reply(input)).rejects.toMatchObject({ status: 503 }); expect(fetcher).toHaveBeenCalledTimes(1);
    fetcher.mockClear(); fetcher.mockImplementation(() => Promise.resolve(Response.json({})));
    await expect(previewApi.deleteRecord('one')).rejects.toMatchObject({ status: 502 }); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('never retries after caller cancellation', async () => {
    const controller = new AbortController();
    const fetcher = vi.fn(async () => { controller.abort(); return Response.json({}); }); vi.stubGlobal('fetch', fetcher);
    await expect(previewApi.reply(input, false, controller.signal)).rejects.toBeDefined(); expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
