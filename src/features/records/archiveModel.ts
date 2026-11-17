import { localDate } from '../../lib/domain';
import type { DiaryRecord } from '../../lib/domain';

// Presentation only; this does not define which emotions the API accepts.
export const emotionPresentation: Record<string, { emoji: string; color: string }> = {
  불안: { emoji: '😰', color: '#8470df' }, 분노: { emoji: '😠', color: '#dc6b55' },
  서운함: { emoji: '🥲', color: '#c68e2e' }, 속상함: { emoji: '🥲', color: '#c68e2e' },
  슬픔: { emoji: '😢', color: '#5284cf' }, 스트레스: { emoji: '😣', color: '#b57589' },
  우울: { emoji: '😔', color: '#887f9f' },
};
export const presentEmotion = (emotion: string | null) => emotionPresentation[emotion ?? ''] ?? { emoji: '💭', color: '#868079' };
export const newestFirst = (records: DiaryRecord[]) => [...records].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
export function weekDates(value: string) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() - (date.getDay() + 6) % 7);
  return Array.from({ length: 7 }, (_, index) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + index, 12));
}
export function weeklySummary(records: DiaryRecord[], selected: string) {
  const dates = new Set(weekDates(selected).map(localDate));
  const entries = records.filter(record => dates.has(localDate(record.createdAt)));
  const paired = entries.filter(record => record.context.pre !== null && record.context.post !== null);
  return {
    count: entries.length, pairedCount: paired.length,
    pre: paired.length ? paired.reduce((total, record) => total + record.context.pre!, 0) / paired.length : null,
    post: paired.length ? paired.reduce((total, record) => total + record.context.post!, 0) / paired.length : null,
  };
}
