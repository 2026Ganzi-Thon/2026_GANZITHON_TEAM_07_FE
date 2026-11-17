import { TEXT_STAGES, stageLabels } from '../features/chat/model';
import type { Context, Message, PreviewReply, Slots, Stage, TextStage } from '../features/chat/model';
import { TOYS } from './domain';
import type { DiaryRecord, Inventory, Profile, ToyType } from './domain';
import { ResponseShapeError } from './errors';

// Boundary decoders for the current adapter, not an assertion about the production DTO.
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ResponseShapeError();
  return value as Record<string, unknown>;
}
function text(value: unknown, empty = false): string {
  if (typeof value !== 'string' || (!empty && !value.trim())) throw new ResponseShapeError();
  return value;
}
function stage(value: unknown): Stage {
  if (typeof value !== 'string' || !Object.hasOwn(stageLabels, value)) throw new ResponseShapeError();
  return value as Stage;
}
function toy(value: unknown): ToyType {
  if (typeof value !== 'string' || !Object.hasOwn(TOYS, value)) throw new ResponseShapeError();
  return value as ToyType;
}
function intensity(value: unknown): number | null {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 10) throw new ResponseShapeError();
  return value;
}
function slots(value: unknown): Slots {
  const input = object(value); const output: Slots = {};
  for (const [key, entry] of Object.entries(input)) {
    if (!TEXT_STAGES.includes(key as TextStage)) throw new ResponseShapeError();
    output[key as TextStage] = text(entry, true);
  }
  return output;
}
function unknowns(value: unknown): Context['unknowns'] {
  const input = object(value); const output: Context['unknowns'] = {};
  for (const [key, entry] of Object.entries(input)) {
    if (!TEXT_STAGES.includes(key as TextStage) || typeof entry !== 'number' || !Number.isSafeInteger(entry) || entry < 0) throw new ResponseShapeError();
    output[key as TextStage] = entry;
  }
  return output;
}
function context(value: unknown): Context {
  const input = object(value);
  const primary = input.primary === null ? null : text(input.primary);
  const secondary = input.secondary === null ? null : text(input.secondary);
  if (secondary !== null && (!primary || primary === secondary)) throw new ResponseShapeError();
  return { stage: stage(input.stage), primary, secondary, pre: intensity(input.pre), post: intensity(input.post), slots: slots(input.slots), unknowns: unknowns(input.unknowns) };
}
export function decodeReply(value: unknown): PreviewReply {
  const input = object(value); const next = stage(input.stage); const replyText = text(input.text);
  const questions = (replyText.match(/[?？]/g) ?? []).length;
  if (questions > 1 || ((next === 'DONE' || next === 'SAFETY') && questions > 0)) throw new ResponseShapeError();
  // Whitelist fields: unexpected primary/pre/messages fields must never overwrite user choices.
  return { stage: next, text: replyText, slots: slots(input.slots), unknowns: unknowns(input.unknowns) };
}
export function decodeProfile(value: unknown): Profile {
  const input = object(value); return { id: text(input.id), nickname: text(input.nickname) };
}
export function decodeInventory(value: unknown): Inventory {
  const input = object(value);
  if (!Array.isArray(input.unlocked)) throw new ResponseShapeError();
  const selected = toy(input.selected); const unlocked = input.unlocked.map(toy);
  if (!unlocked.includes(selected) || new Set(unlocked).size !== unlocked.length) throw new ResponseShapeError();
  return { selected, unlocked, name: text(input.name) };
}
function messages(value: unknown): Message[] {
  if (!Array.isArray(value)) throw new ResponseShapeError();
  const result = value.map(entry => {
    const item = object(entry);
    if (item.role !== 'assistant' && item.role !== 'user') throw new ResponseShapeError();
    return { id: text(item.id), role: item.role, text: text(item.text), time: text(item.time) } as Message;
  });
  if (new Set(result.map(item => item.id)).size !== result.length) throw new ResponseShapeError();
  return result;
}
export function decodeRecord(value: unknown): DiaryRecord {
  const input = object(value); const createdAt = text(input.createdAt);
  if (!Number.isFinite(Date.parse(createdAt))) throw new ResponseShapeError();
  const decoded = context(input.context);
  if (input.partial !== undefined && typeof input.partial !== 'boolean' || input.hidden !== undefined && typeof input.hidden !== 'boolean') throw new ResponseShapeError();
  const partial = input.partial === true;
  const transcript = input.messages !== undefined ? messages(input.messages) : undefined;
  if (partial ? input.recommended !== null || decoded.stage === 'SAFETY' || !transcript?.some(message => message.role === 'user') : !decoded.primary) throw new ResponseShapeError();
  return { id: text(input.id), createdAt, context: decoded, summary: text(input.summary, true), recommended: partial ? null : toy(input.recommended), partial, hidden: input.hidden === true, ...(transcript ? { messages: transcript } : {}) };
}
export function decodeRecords(value: unknown): DiaryRecord[] {
  if (!Array.isArray(value)) throw new ResponseShapeError();
  const records = value.map(decodeRecord);
  if (new Set(records.map(record => record.id)).size !== records.length) throw new ResponseShapeError();
  return records;
}
export function decodeOk(value: unknown): { ok: true } {
  if (object(value).ok !== true) throw new ResponseShapeError();
  return { ok: true };
}
