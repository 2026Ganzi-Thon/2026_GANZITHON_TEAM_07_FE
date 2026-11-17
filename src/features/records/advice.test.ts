import { expect, it } from 'vitest';
import { adviceFor } from './advice';
import { newContext } from '../chat/model';
import type { DiaryRecord } from '../../lib/domain';

const record = (action?: string): DiaryRecord => ({ id: 'record', createdAt: '2026-11-16T00:00:00Z', summary: '이야기', recommended: 'SLANGI', context: { ...newContext(), primary: '불안', stage: 'DONE', slots: action ? { ACTION: action } : {} } });
it.each([['집 앞을 천천히 걷기', 'walk'], ['내 마음을 한 문장 적기', 'write'], ['오늘은 충분히 쉬기', 'rest']])('preserves chosen action and pairs its icon: %s', (text, kind) => {
  expect(adviceFor(record(text))).toEqual({ kind, text, chosen: true });
});
it('keeps fallback advice stable and separate from chosen actions', () => {
  expect(adviceFor(record())).toEqual(adviceFor(record()));
  expect(adviceFor(record()).chosen).toBe(false);
  expect(new Set(['a', 'b', 'c'].map(id => adviceFor({ ...record(), id }).text)).size).toBe(3);
});
