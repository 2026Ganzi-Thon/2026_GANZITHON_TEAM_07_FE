import { TEXT_STAGES, stageLabels } from '../features/chat/model';
import type { Context, Message, PreviewReply, Slots, Stage, TextStage } from '../features/chat/model';
import { TOYS } from './domain';
import type { DiaryRecord, Inventory, Profile, ToyType } from './domain';
import { ApiError, ResponseShapeError } from './errors';
import type { Sent } from './transport';

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

// ---- Backend (/api/v1) boundary. Shapes follow the backend docs/api.md as of 2026-11-17 (PR #23). ----
function fallbackMessage(status: number) {
  if (status === 401) return '로그인이 필요해요.';
  if (status === 403) return '접근할 수 없어요.';
  if (status === 404) return '찾을 수 없어요.';
  if (status >= 500) return '서버에 문제가 생겼어요. 잠시 후 다시 시도해 주세요.';
  return `요청에 실패했습니다 (${status})`;
}
/** Unwraps `{ success, data, error }`. Failures become ApiError with the backend `error.code` and failure `data`. */
export function decodeEnvelope({ status, ok, body }: Sent): unknown {
  if (body === undefined && ok) return undefined; // 204 No Content
  if (body && typeof body === 'object' && !Array.isArray(body) && typeof (body as Record<string, unknown>).success === 'boolean') {
    const envelope = body as Record<string, unknown>;
    if (envelope.success === true && ok) return envelope.data;
    const error = envelope.error && typeof envelope.error === 'object' ? envelope.error as Record<string, unknown> : {};
    const code = typeof error.code === 'string' ? error.code : undefined;
    const message = typeof error.message === 'string' && error.message.trim() ? error.message : fallbackMessage(status);
    throw new ApiError(message, ok ? 502 : status, code, envelope.data ?? undefined);
  }
  if (!ok) throw new ApiError(fallbackMessage(status), status);
  throw new ResponseShapeError();
}
function userId(value: unknown): string {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) throw new ResponseShapeError();
  return String(value);
}
export interface TokenPair { accessToken: string; refreshToken: string; expiresIn: number }
export function decodeTokenPair(value: unknown): TokenPair {
  const input = object(value);
  if (typeof input.expiresIn !== 'number' || !Number.isFinite(input.expiresIn) || input.expiresIn <= 0) throw new ResponseShapeError();
  return { accessToken: text(input.accessToken), refreshToken: text(input.refreshToken), expiresIn: input.expiresIn };
}
/** POST /auth/login data: token pair + userId + nickname. */
export function decodeLogin(value: unknown): { tokens: TokenPair; profile: Profile } {
  const input = object(value);
  return { tokens: decodeTokenPair(input), profile: { id: userId(input.userId), nickname: text(input.nickname) } };
}
/** POST /auth/oauth/{provider} data: token pair + userId, email, nickname (provider/isNewUser ignored). */
export function decodeSocialLogin(value: unknown): { tokens: TokenPair; profile: Profile } {
  const input = object(value);
  return { tokens: decodeTokenPair(input), profile: { id: userId(input.userId), nickname: text(input.nickname), email: text(input.email) } };
}
/** GET /auth/me and POST /auth/signup data. Extra fields (provider) are ignored. */
export function decodeBackendProfile(value: unknown): Profile {
  const input = object(value);
  return { id: userId(input.userId), nickname: text(input.nickname), email: text(input.email) };
}
