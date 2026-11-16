import type { DiaryRecord } from '../../lib/domain';

export type AdviceKind = 'walk' | 'rest' | 'write';
const messages: Record<AdviceKind, string[]> = {
  walk: ['잠깐 걸으며 주변의 색 하나를 찾아보세요.', '가까운 곳까지 천천히 걸어보세요.', '밖으로 나가기 어렵다면 자리에서 가볍게 몸을 풀어보세요.'],
  rest: ['하던 일을 잠시 멈추고 편하게 쉬어보세요.', '어깨의 힘을 풀고 잠깐 숨을 돌려보세요.', '오늘 할 일 하나를 잠시 내려놓아도 좋아요.'],
  write: ['지금 마음에 남은 말을 한 문장 적어보세요.', '나에게 해주고 싶은 말을 짧게 남겨보세요.', '오늘 기억하고 싶은 순간 하나를 적어보세요.'],
};
export function adviceFor(record: DiaryRecord): { kind: AdviceKind; text: string; chosen: boolean } {
  const action = record.context.slots.ACTION?.trim();
  const kind: AdviceKind = action
    ? /산책|걷|걸|몸|스트레칭/.test(action) ? 'walk' : /적|기록|쓰|문장|메모/.test(action) ? 'write' : 'rest'
    : ['분노', '스트레스'].includes(record.context.primary ?? '') ? 'walk'
      : ['속상함', '서운함', '억울함'].includes(record.context.primary ?? '') ? 'write' : 'rest';
  // Stable for this record, so rerenders and toy selection do not change the advice.
  const index = [...record.id].reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % 3;
  return { kind, text: action || messages[kind][index], chosen: !!action };
}
