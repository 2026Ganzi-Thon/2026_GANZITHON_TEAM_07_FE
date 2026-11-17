import { describe, expect, it } from 'vitest';
import { newContext } from '../chat/model';
import { localDate } from '../../lib/domain';
import type { DiaryRecord } from '../../lib/domain';
import { newestFirst, presentEmotion, weekDates, weeklySummary } from './archiveModel';
const record = (createdAt: string, pre: number | null, post: number | null): DiaryRecord => ({
  id: createdAt, createdAt, context: { ...newContext(), primary: '불안', pre, post }, summary: '기록', recommended: 'SLANGI',
});
describe('archive week and data presentation', () => {
  it('keeps a Monday–Sunday week across month and year boundaries', () => {
    expect(weekDates('2027-01-03').map(localDate)).toEqual(['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03']);
  });
  it('counts every record but averages only matching pre/post pairs, including zero', () => {
    const rows = [record('2026-12-28T09:00:00', 8, 4), record('2027-01-03T23:59:00', 0, 0), record('2027-01-02T09:00:00', 10, null), record('2027-01-02T10:00:00', null, 5), record('2027-01-04T00:00:00', 10, 10)];
    expect(weeklySummary(rows, '2027-01-01')).toEqual({ count: 4, pairedCount: 2, pre: 4, post: 2 });
  });
  it('does not turn an empty or unscored week into a zero score', () => {
    expect(weeklySummary([], '2026-11-16')).toEqual({ count: 0, pairedCount: 0, pre: null, post: null });
    expect(weeklySummary([record('2026-11-16T12:00:00', 7, null)], '2026-11-16').pre).toBeNull();
  });
  it('sorts for the latest daily emotion without mutating fetched data and has a fallback icon', () => {
    const rows = [record('2026-11-16T09:00:00', 7, 2), record('2026-11-16T10:00:00', 8, 3)];
    expect(newestFirst(rows)[0]).toBe(rows[1]);
    expect(rows[0].createdAt).toBe('2026-11-16T09:00:00');
    expect(presentEmotion('새 감정').emoji).toBe('💭');
  });
});
