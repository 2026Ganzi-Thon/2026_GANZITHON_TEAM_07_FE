import { isTextStage } from '../features/chat/model';
import type { PreviewReply, PreviewRequest, Stage, TextStage } from '../features/chat/model';

// D38: shorter frontend walkthrough. Production stage decisions belong to the server.
const next: Record<TextStage, Stage> = { OPEN: 'EMOTIONS', THOUGHT: 'ACTION', REFRAME: 'NEED', NEED: 'COPING', COPING: 'ACTION', ACTION: 'POST' };
const prompts: Partial<Record<Stage, string>> = {
  EMOTIONS: '그 순간 어떤 감정이 가장 크게 느껴졌소?\n그대 마음과 가까운 감정을 골라보시오.',
  REFRAME: '그런 생각이 들었구려.\n같은 상황을 조금 다르게 바라볼 수도 있겠소?',
  NEED: '그 상황에서 가장 바랐던 것은 무엇이었소?',
  COPING: '비슷한 마음이 들었을 때, 조금이라도 도움이 됐던 일이 있었소?',
  ACTION: '지금 그대를 위해 할 수 있는 작은 일 하나를 골라보겠소? 쉬어가도 괜찮소.',
  POST: '마무리하기 전에 잠시 마음을 살펴봅시다.\n지금 마음의 무게는 어느 정도요?',
};

// Deterministic visual-preview script. Not a counseling engine or a validated safety classifier.
export function previewReply({ context, text, history = [], continueOpening = false }: PreviewRequest): PreviewReply {
  const { stage } = context;
  const slots = { ...context.slots };
  const unknowns = { ...context.unknowns };
  const trimmed = text.trim();
  if (/(죽고\s*싶|자살|자해|해치고\s*싶)/.test(trimmed)) {
    return { stage: 'SAFETY', text: '지금은 안전을 먼저 살펴볼게요. 가까운 믿을 수 있는 사람이나 전문 지원에 도움을 요청해 주세요.', slots, unknowns };
  }
  if (/(그만할|그만\s*할|끝낼|종료할|여기까지)/.test(trimmed)) {
    return { stage: context.primary ? 'POST' : 'DONE', text: context.primary ? prompts.POST! : '여기서 마무리하겠소. 다음에 이야기를 나누고 싶을 때 다시 오시오.', slots, unknowns };
  }
  if (!isTextStage(stage)) return { stage, text: '아래 카드에서 선택을 마쳐주시오.', slots, unknowns };
  const unableReframe = stage === 'REFRAME' && /(어려|어렵|못하|힘들|안\s*돼)/.test(trimmed);
  const none = /^(?:딱히\s*)?(?:없어|없어요|없습니다)[.!?~\s]*$/.test(trimmed);
  const unknown = none || /^(?:(?:잘|정말|아직|그래도|음)\s*)*(?:모르겠어|모르겠어요|모르겠습니다|몰라|몰라요)[.!?~\s]*$/.test(trimmed) || /^어디서부터 말해야 할지 모르겠어요[.!?\s]*$/.test(trimmed);
  if (none && (stage === 'NEED' || stage === 'COPING')) {
    slots[stage] = trimmed;
    return { stage: next[stage], text: prompts[next[stage]]!, slots, unknowns };
  }
  if (unknown) {
    unknowns[stage] = (unknowns[stage] ?? 0) + 1;
    if (unknowns[stage]! < 2 && !unableReframe) return { stage, text: '바로 떠오르지 않아도 괜찮소.\n조금 더 생각해 보고, 어렵다면 모르겠다고 말해도 좋소.', slots, unknowns };
  }
  if (stage === 'OPEN' && !unknown) {
    const prior = history.filter(message => message.role === 'user').map(message => message.text);
    const meaningful = /[가-힣a-zA-Z]{2}/.test(trimmed);
    // Local walkthrough only. Do not attempt semantic classification with an event whitelist.
    // One clarification for a plainly vague opener; then accept the user's own words.
    const vague = /^(?:(?:오늘|그냥|조금|너무|좀|많이)\s*)*(?:힘들어(?:요)?|속상해(?:요)?|슬퍼(?:요)?|불안해(?:요)?|걱정돼(?:요)?|혼났어(?:요)?|회의|친구가|속상한 일이 있었어요)[.!?~\s]*$/.test(trimmed)
      || trimmed === '앞으로의 일이 걱정돼요';
    if (!continueOpening && (!meaningful || (vague && prior.length === 0))) {
      return { stage, text: meaningful ? '어떤 일이 있었는지 조금만 더 들려주겠소? 지금 이야기한 내용으로 이어가도 괜찮소.' : '글이 잘 전달되지 않았소. 짧은 문장으로 적어주겠소?', slots, unknowns };
    }
    const words = continueOpening ? prior : [...prior, trimmed];
    if (!words.some(word => /[가-힣a-zA-Z]{2}/.test(word))) return { stage, text: '먼저 이야기를 짧게 남겨주겠소?', slots, unknowns };
    slots.OPEN = words.join(' ').slice(0, 6000);
    return { stage: next.OPEN, text: prompts.EMOTIONS!, slots, unknowns };
  }
  if (!unknown && !unableReframe) slots[stage] = trimmed;
  return { stage: next[stage], text: prompts[next[stage]]!, slots, unknowns };
}
