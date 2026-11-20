import type { Context, Message } from '../features/chat/model';
export const TOYS = {
  SLANGI: { name: '슬랑이', instruction: '꾹 누르고, 천천히 늘려보세요.', tint: 'ivory' },
  SQUISHY: { name: '스퀴시', instruction: '가볍게 누르면 부드럽게 돌아와요.', tint: 'slate' },
  WAKPPU: { name: '왁뿌볼', instruction: '톡톡, 껍질을 깨고 안의 말랑이를 만나보세요.', tint: 'warm' },
} as const;
export type ToyType = keyof typeof TOYS;
export interface Profile { id: string; nickname: string; email?: string }
export interface Inventory { selected: ToyType; unlocked: ToyType[]; name: string }
export interface DiaryRecord {
  id: string; createdAt: string; context: Context; summary: string; recommended: ToyType | null; messages?: Message[];
  partial?: boolean; hidden?: boolean; keySentence?: string;
}
// Preview-only completion payload. The production API adapter has not been agreed yet.
export interface ResultDraft { id: string; context: Context; messages: Message[]; partial?: boolean; failOnce?: boolean }
export const SLOT_LABELS = { OPEN: '상황', THOUGHT: '떠올랐던 생각', REFRAME: '다른 관점', NEED: '바랐던 마음', COPING: '도움이 됐던 일', ACTION: '작은 실천' } as const;
export function localDate(value: Date | string) {
  if (typeof value === 'string') {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit' }).formatToParts(new Date(value));
    const part = (type: string) => parts.find(p => p.type === type)!.value;
    return `${part('year')}-${part('month')}-${part('day')}`;
  }
  const date = value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function dateLabel(value: string) { return new Date(value).toLocaleString('ko-KR', { timeZone:'Asia/Seoul', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
