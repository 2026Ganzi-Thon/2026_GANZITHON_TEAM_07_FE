import { API_MODE } from './apiMode';
import type { DiaryRecord, ToyType } from './domain';
import type { ArtworkId } from './toyArtwork';

const groups: Record<ToyType, readonly ArtworkId[]> = {
  SLANGI: ['slime-lavender','slime-mint','slime-pink'],
  SQUISHY: ['sheep','pudding-squishy','dumpling'],
  WAKPPU: ['butter','heart','wax-cloud'],
};
export function artworkForType(type: ToyType, value: unknown): value is ArtworkId {
  return typeof value === 'string' && groups[type].includes(value as ArtworkId);
}
// Backend records store the category only. Keep presentation identity locally,
// scoped to account, record and creation time. Never store conversation content.
const memory = new Map<string, ArtworkId>();
const keyFor = (owner:string, record:DiaryRecord) => `teslang:record-artwork:v1:${API_MODE}:${encodeURIComponent(owner)}:${encodeURIComponent(record.id)}:${encodeURIComponent(record.createdAt)}`;
export function readRecordArtwork(owner:string, record:DiaryRecord): ArtworkId | undefined {
  if (!record.recommended) return;
  const key=keyFor(owner,record);
  let value:unknown=memory.get(key);
  try { value ??= localStorage.getItem(key); } catch { /* Storage may be unavailable. */ }
  return artworkForType(record.recommended,value) ? value : undefined;
}
export function rememberRecordArtwork(owner:string, record:DiaryRecord, artwork:unknown): ArtworkId | undefined {
  const existing=readRecordArtwork(owner,record);
  if (existing) return existing;
  if (!record.recommended || record.partial || !artworkForType(record.recommended,artwork)) return;
  const key=keyFor(owner,record); memory.set(key,artwork);
  try { localStorage.setItem(key,artwork); } catch { /* Current tab still retains the shape. */ }
  return artwork;
}
export function forgetRecordArtwork(owner:string, record:DiaryRecord) {
  const key=keyFor(owner,record); memory.delete(key);
  try { localStorage.removeItem(key); } catch { /* Best effort local metadata cleanup. */ }
}
