import { API_MODE } from './apiMode';
import { backend } from './backend';
import { previewApi } from './api';
import { decodeServerRecord, decodeRecordPage, decodeMessages } from './counselingContracts';
import { ResponseShapeError } from './errors';
import type { DiaryRecord } from './domain';
const path = (id: string) => `records/${encodeURIComponent(id)}`;
export const serverRecords = {
  records: async (): Promise<DiaryRecord[]> => {
    const records = new Map<string,DiaryRecord>();
    for (let page = 0; page < 10000; page++) {
      const result = decodeRecordPage(await backend(`records?page=${page}&size=50`, { auth:true }));
      if (result.page !== page) throw new ResponseShapeError();
      result.records.forEach(record => records.set(record.id,record));
      if (result.last) return [...records.values()];
      if (!result.records.length) throw new ResponseShapeError();
    }
    throw new ResponseShapeError();
  },
  record: async (id: string) => decodeServerRecord(await backend(path(id), { auth:true })),
  messages: async (id: string) => decodeMessages(await backend(`${path(id)}/messages`, { auth:true })),
  setRecordHidden: async (id: string, hidden: boolean) => {
    await backend(`${path(id)}/hidden`, { auth:true, method:'PATCH', body:{ hidden } });
    return serverRecords.record(id);
  },
  deleteRecord: async (id: string) => { await backend(path(id), { auth:true, method:'DELETE' }); return { ok:true }; },
};
export const recordsApi = {
  records: (fail = false) => API_MODE === 'real' ? serverRecords.records() : previewApi.records(fail),
  record: (id: string) => API_MODE === 'real' ? serverRecords.record(id) : previewApi.record(id),
  messages: async (id: string) => API_MODE === 'real' ? serverRecords.messages(id) : (await previewApi.record(id)).messages ?? [],
  setRecordHidden: (id: string, hidden: boolean) => API_MODE === 'real' ? serverRecords.setRecordHidden(id, hidden) : previewApi.setRecordHidden(id, hidden),
  deleteRecord: (id: string, fail = false) => API_MODE === 'real' ? serverRecords.deleteRecord(id) : previewApi.deleteRecord(id, fail),
};
