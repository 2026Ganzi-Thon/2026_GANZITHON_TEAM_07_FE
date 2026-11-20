import type { CustomArtworkId } from '../../lib/toyArtwork';

export const INNER_COLORS = [
  { name: '크림 화이트', body: '#f5f0e8', light: '#fffdf8', shade: '#d5cbc0' },
  { name: '연분홍', body: '#f2cbd9', light: '#fff0f5', shade: '#c99aaf' },
  { name: '라벤더', body: '#d9cdee', light: '#f5efff', shade: '#afa0ca' },
  { name: '하늘색', body: '#cbdff2', light: '#eef8ff', shade: '#9db9d2' },
] as const;
export const MAX_CUSTOM_WAX = 6;
export interface WaxCrop { mode: 'circle' | 'outline'; zoom: number; x: number; y: number }
export const DEFAULT_CROP: WaxCrop = { mode: 'circle', zoom: 1, x: 0, y: 0 };
export interface CustomWax {
  id: CustomArtworkId; source: Blob; image: Blob; crop: WaxCrop; color: number; createdAt: number;
}
// Store bytes rather than browser-managed Blob file handles (portable to WebKit).
function restorePhoto(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  const v = value as Record<string,unknown>;
  return { ...v,
    source: v.source instanceof ArrayBuffer ? new Blob([v.source], { type:'image/png' }) : v.source,
    image: v.image instanceof ArrayBuffer ? new Blob([v.image], { type:'image/png' }) : v.image,
  };
}
export function validCustomWax(value: unknown): value is CustomWax {
  if (!value || typeof value !== 'object') return false;
  const v = value as CustomWax, c = v.crop;
  return typeof v.id === 'string' && /^custom-[a-f0-9-]{36}$/.test(v.id)
    && v.source instanceof Blob && v.image instanceof Blob
    && v.source.type === 'image/png' && v.image.type === 'image/png'
    && v.source.size > 0 && v.source.size <= 6_000_000 && v.image.size > 0 && v.image.size <= 3_000_000
    && Number.isInteger(v.color) && v.color >= 0 && v.color < INNER_COLORS.length
    && Number.isFinite(v.createdAt) && !!c && ['circle', 'outline'].includes(c.mode)
    && Number.isFinite(c.zoom) && c.zoom >= 1 && c.zoom <= 2.5
    && Number.isFinite(c.x) && Math.abs(c.x) <= 1 && Number.isFinite(c.y) && Math.abs(c.y) <= 1;
}

// Photo blobs remain on this origin/device. No upload or API calls.
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('teslang-custom-wax', 1);
    let blocked = false;
    request.onupgradeneeded = () => request.result.createObjectStore('wax', { keyPath: 'id' });
    request.onsuccess = () => { if (blocked) request.result.close(); else resolve(request.result); };
    request.onerror = () => reject(request.error);
    request.onblocked = () => { blocked = true; reject(new Error('다른 테슬랑 탭을 닫고 다시 시도해 주세요.')); };
  });
}
export async function readCustomWax(): Promise<CustomWax[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('wax', 'readonly'); const request = tx.objectStore('wax').getAll();
    tx.oncomplete = () => { db.close(); resolve((request.result as unknown[]).map(restorePhoto).filter(validCustomWax).sort((a,b) => a.createdAt - b.createdAt).slice(0, MAX_CUSTOM_WAX)); };
    tx.onabort = tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
export async function writeCustomWax(value: CustomWax, replacing?: CustomArtworkId) {
  if (!validCustomWax(value)) throw new Error('사진 설정을 다시 확인해 주세요.');
  const [source,image] = await Promise.all([value.source.arrayBuffer(),value.image.arrayBuffer()]);
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('wax', 'readwrite'), store = tx.objectStore('wax');
    let full = false;
    const count = store.count();
    count.onsuccess = () => {
      const existing = store.get(replacing ?? value.id);
      existing.onsuccess = () => {
        if (!existing.result && count.result >= MAX_CUSTOM_WAX) { full = true; tx.abort(); return; }
        if (replacing) store.delete(replacing);
        store.put({...value,source,image});
      };
    };
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onabort = tx.onerror = () => { db.close(); reject(new Error(full ? '최대 6개까지 만들 수 있어요. 하나를 지우고 다시 만들어 주세요.' : '저장하지 못했어요. 기기 저장 공간과 브라우저 설정을 확인해 주세요.')); };
  });
}
export async function deleteCustomWax(id: CustomArtworkId) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('wax', 'readwrite'); tx.objectStore('wax').delete(id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onabort = tx.onerror = () => { db.close(); reject(new Error('삭제하지 못했어요. 다시 시도해 주세요.')); };
  });
}
