import { isTextStage } from '../features/chat/model';
import type { PreviewReply, PreviewRequest, Stage, TextStage } from '../features/chat/model';

const next: Record<TextStage, Stage> = { OPEN: 'EMOTIONS', THOUGHT: 'REFRAME', REFRAME: 'NEED', NEED: 'COPING', COPING: 'ACTION', ACTION: 'POST' };
const prompts: Partial<Record<Stage, string>> = {
  EMOTIONS: '그 순간 어떤 감정이 가장 크게 느껴졌나요?\n내 마음과 가까운 감정을 골라주세요.',
  REFRAME: '그 생각이 들었군요.\n같은 상황을 조금 다르게 바라볼 가능성도 있을까요?',
  NEED: '그 상황에서 사실 가장 바랐던 것은 무엇이었나요?',
  COPING: '비슷한 마음이 들었을 때, 조금이라도 도움이 됐던 일이 있었나요?',
  ACTION: '지금 나를 위해 할 수 있는 작은 일 하나를 골라볼까요? 쉬어가는 것도 괜찮아요.',
  POST: '마무리하기 전에 잠깐 마음을 살펴봐요.\n지금 마음의 무게는 어느 정도인가요?',
};

// Deterministic visual-preview script. Not a counseling engine or a validated safety classifier.
export function previewReply({ context, text }: PreviewRequest): PreviewReply {
  const { stage } = context;
  const slots = { ...context.slots };
  const unknowns = { ...context.unknowns };
  const trimmed = text.trim();
  if (/(죽고\s*싶|자살|자해|해치고\s*싶)/.test(trimmed)) {
    return { stage: 'SAFETY', text: '지금은 예시 대화를 잠시 멈출게요. 이 미리보기는 위기 상황에 대응할 수 없어요. 실제 도움이 필요하다면 가까운 믿을 수 있는 사람이나 전문 지원 기관에 연락해 주세요.', slots, unknowns };
  }
  if (/(그만할|그만\s*할|끝낼|종료할|여기까지)/.test(trimmed)) {
    return { stage: context.primary ? 'POST' : 'DONE', text: context.primary ? prompts.POST! : '여기서 마무리할게요. 이 대화는 예시이며 결과나 추천을 만들지 않아요.', slots, unknowns };
  }
  if (!isTextStage(stage)) return { stage, text: '아래 카드에서 선택을 마쳐주세요.', slots, unknowns };
  const unableReframe = stage === 'REFRAME' && /(어려|어렵|못하|힘들|안\s*돼)/.test(trimmed);
  const none = /^(?:딱히\s*)?(?:없어|없어요|없습니다)[.!?~\s]*$/.test(trimmed);
  const unknown = none || /^(?:(?:잘|정말|아직|그래도|음)\s*)*(?:모르겠어|모르겠어요|모르겠습니다|몰라|몰라요)[.!?~\s]*$/.test(trimmed);
  if (none && (stage === 'NEED' || stage === 'COPING')) {
    slots[stage] = trimmed;
    return { stage: next[stage], text: prompts[next[stage]]!, slots, unknowns };
  }
  if (unknown) {
    unknowns[stage] = (unknowns[stage] ?? 0) + 1;
    if (unknowns[stage]! < 2 && !unableReframe) return { stage, text: '바로 떠오르지 않아도 괜찮아요.\n조금 더 생각해 보고, 어렵다면 모르겠다고 말해도 돼요.', slots, unknowns };
  }
  if (stage === 'OPEN' && !unknown && !/(회의|발표|과제|시험|점수|주문|다퉜|싸웠|말했|무시|연락|면접|거절|실수|친구가|상사가)/.test(trimmed)) {
    return { stage, text: '그 마음이 들었던 순간을 조금 더 알고 싶어요.\n어떤 일이 있었는지 하나만 이야기해 주실래요?', slots, unknowns };
  }
  if (!unknown && !unableReframe) slots[stage] = trimmed;
  return { stage: next[stage], text: prompts[next[stage]]!, slots, unknowns };
}
