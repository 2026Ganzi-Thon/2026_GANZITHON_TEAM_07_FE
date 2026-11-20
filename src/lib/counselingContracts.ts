import { ResponseShapeError } from './errors';
import type { DiaryRecord, ToyType } from './domain';
import type { Message, Slots } from '../features/chat/model';

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ResponseShapeError();
  return value as Record<string, unknown>;
}
export function text(value: unknown): string { if (typeof value !== 'string') throw new ResponseShapeError(); return value; }
export function optionalText(value: unknown): string | null { return value == null ? null : text(value); }
export function identifier(value: unknown): string {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return String(value);
  throw new ResponseShapeError();
}
function score(value: unknown): number | null { if (value == null) return null; if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 10) throw new ResponseShapeError(); return value; }
function flag(value: unknown): boolean { if (typeof value !== 'boolean') throw new ResponseShapeError(); return value; }
function strings(value: unknown): string[] { if (!Array.isArray(value)) throw new ResponseShapeError(); return value.map(text); }
export interface EmotionOptions { triggerFactor: string | null; primaryEmotions: string[]; secondaryEmotions: string[] }
export interface Turn { sessionId: string; status: string; currentStep: string; aiMessage: string | null; riskDetected: boolean; replyOptions: string[]; nextInput: 'MESSAGE' | 'EMOTION_CARD' | 'POST_INTENSITY' | 'NONE'; emotionCard: EmotionOptions | null }
export function decodeTurn(value: unknown): Turn {
  const v = object(value), nextInput = text(v.nextInput);
  if (!['MESSAGE','EMOTION_CARD','POST_INTENSITY','NONE'].includes(nextInput)) throw new ResponseShapeError();
  const status = text(v.status);
  if (!['IN_PROGRESS','COMPLETED','ABORTED','ABORTED_RISK'].includes(status)) throw new ResponseShapeError();
  let emotionCard: EmotionOptions | null = null;
  if (v.emotionCard != null) { const c = object(v.emotionCard); emotionCard = { triggerFactor: optionalText(c.triggerFactor), primaryEmotions: strings(c.primaryEmotions), secondaryEmotions: strings(c.secondaryEmotions) }; }
  if (nextInput === 'EMOTION_CARD' && !emotionCard?.primaryEmotions.length) throw new ResponseShapeError();
  return { sessionId: identifier(v.sessionId), status, currentStep: text(v.currentStep), aiMessage: optionalText(v.aiMessage), riskDetected: flag(v.riskDetected), replyOptions: strings(v.replyOptions), nextInput: nextInput as Turn['nextInput'], emotionCard };
}
export function decodeToy(value: unknown): ToyType | null {
  if (value == null) return null;
  const aliases: Record<string,ToyType> = { SLANGI: 'SLANGI', SQUISHY: 'SQUISHY', WAKPPU: 'WAKPPU', WAKPPUBALL: 'WAKPPU', WAKPPU_BALL: 'WAKPPU' };
  const name = text(value); if (!Object.hasOwn(aliases,name)) throw new ResponseShapeError(); return aliases[name];
}
export function decodeServerRecord(value: unknown): DiaryRecord {
  const v = object(value), rawDate = text(v.createdAt);
  // Backend CounselingService.now() stores UTC LocalDateTime without an offset.
  // Normalize once at the API boundary; explicit offsets must remain intact.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})?$/.test(rawDate)) throw new ResponseShapeError();
  const createdAt = /(?:Z|[+-]\d{2}:\d{2})$/.test(rawDate) ? rawDate : `${rawDate}Z`;
  if (!Number.isFinite(Date.parse(createdAt))) throw new ResponseShapeError();
  const slots: Slots = {};
  for (const [key,field] of Object.entries({ OPEN:'situation', THOUGHT:'initialThought', REFRAME:'alternativeThought', NEED:'underlyingNeed', COPING:'copingStrategy', ACTION:'actionPlan' })) {
    const content = optionalText(v[field]); if (content) slots[key as keyof Slots] = content;
  }
  return { id: identifier(v.resultId), createdAt, summary: optionalText(v.summary) ?? '', keySentence: optionalText(v.keySentence) ?? undefined, recommended: decodeToy(v.recommendedMalangi), hidden: flag(v.hidden),
    context: { stage:'DONE', primary:optionalText(v.primaryEmotion), secondary:optionalText(v.secondaryEmotion), pre:score(v.preIntensity), post:score(v.postIntensity), slots, unknowns:{} } };
}
export function decodeMessages(value: unknown): Message[] {
  const list = object(value).messages; if (!Array.isArray(list)) throw new ResponseShapeError();
  return list.flatMap(item => {
    const v = object(item), type = text(v.type);
    if (type === 'EMOTION_CARD') return []; // Detail renders the stored emotion summary separately.
    if (type !== 'USER' && type !== 'ASSISTANT') return [];
    const content = optionalText(v.content); if (!content) return [];
    return [{ id: identifier(v.messageId), role: type === 'USER' ? 'user' as const : 'assistant' as const, text: content, time: optionalText(v.time) ?? '' }];
  });
}
export function decodeRecordPage(value: unknown) {
  const v = object(value); if (!Array.isArray(v.content) || typeof v.last !== 'boolean' || !Number.isInteger(v.pageNumber)) throw new ResponseShapeError();
  return { records: v.content.map(decodeServerRecord), last: v.last, page: v.pageNumber };
}
export function decodeCompletionId(value: unknown): string { const v = object(value); if (v.status !== 'COMPLETED') throw new ResponseShapeError(); return identifier(v.resultId); }
