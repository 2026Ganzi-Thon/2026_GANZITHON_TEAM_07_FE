export type Stage = 'OPEN' | 'EMOTIONS' | 'PRE' | 'THOUGHT' | 'REFRAME' | 'NEED' | 'COPING' | 'ACTION' | 'POST' | 'DONE' | 'SAFETY';
export type TextStage = 'OPEN' | 'THOUGHT' | 'REFRAME' | 'NEED' | 'COPING' | 'ACTION';
export type Slots = Partial<Record<TextStage, string>>;
export interface Message { id: string; role: 'assistant' | 'user'; text: string; time: string }
export interface Context {
  stage: Stage;
  primary: string | null;
  secondary: string | null;
  pre: number | null;
  post: number | null;
  slots: Slots;
  unknowns: Partial<Record<TextStage, number>>;
}
export interface ChatState extends Context { messages: Message[] }
export interface PreviewRequest { context: Context; text: string; requestId: string; history?: Message[] }
export interface PreviewReply { stage: Stage; text: string; slots: Slots; unknowns: Context['unknowns'] }

export const TEXT_STAGES: TextStage[] = ['OPEN', 'THOUGHT', 'REFRAME', 'NEED', 'COPING', 'ACTION'];
// Accept real letters even when words are separated; reject bare jamo/symbol input.
export function hasStoryText(text: string) { return /[가-힣a-zA-Z]/u.test(text.normalize('NFC')); }
export function isTextStage(stage: Stage): stage is TextStage { return TEXT_STAGES.includes(stage as TextStage); }
// A preview fixture only. These are not the team's final allowed emotion values.
export const SAMPLE_EMOTIONS = ['불안', '속상함', '슬픔', '분노', '스트레스', '우울'];
export const SAMPLE_ACTIONS = ['잠깐 산책하며 숨 돌리기', '내 마음을 한 문장으로 적기', '오늘은 충분히 쉬기'];
export const suggestions = [
  { label: '오늘 조금 속상한 일이 있었어요', text: '오늘 조금 속상한 일이 있었어요' },
  { label: '앞으로의 일이 걱정돼요', text: '앞으로의 일이 걱정돼요' },
  { label: '어디서부터 말해야 할지 모르겠어요', text: '어디서부터 말해야 할지 모르겠어요' },
];
export const newContext = (): Context => ({ stage: 'OPEN', primary: null, secondary: null, pre: null, post: null, slots: {}, unknowns: {} });
export function makeMessage(role: Message['role'], text: string): Message {
  return { id: crypto.randomUUID(), role, text, time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }) };
}
export const initialChat = (): ChatState => ({ ...newContext(), messages: [makeMessage('assistant', '반갑소, 테스요.\n오늘 어떤 일이 있었소? 편하게 이야기해 주시오.')] });
type Action =
  | { type: 'sent'; message: Message }
  | { type: 'reply'; reply: PreviewReply }
  | { type: 'emotions'; primary: string; secondary: string | null }
  | { type: 'intensity'; value: number | null }
  | { type: 'finish' };
export function chatReducer(state: ChatState, action: Action): ChatState {
  switch (action.type) {
    case 'sent': return { ...state, messages: [...state.messages, action.message] };
    case 'reply': return { ...state, ...action.reply, messages: [...state.messages, makeMessage('assistant', action.reply.text)] };
    case 'emotions':
      if (state.stage !== 'EMOTIONS' || !SAMPLE_EMOTIONS.includes(action.primary) || (action.secondary !== null && (!SAMPLE_EMOTIONS.includes(action.secondary) || action.secondary === action.primary))) return state;
      return { ...state, stage: 'PRE', primary: action.primary, secondary: action.secondary, messages: [...state.messages,
        makeMessage('user', `${action.primary}${action.secondary ? `, 그리고 ${action.secondary}` : ''}`),
        makeMessage('assistant', '지금 그 감정의 크기는 어느 정도요?\n정답은 없소. 느껴지는 만큼 골라보시오.')] };
    case 'intensity': {
      if (state.stage !== 'PRE' && state.stage !== 'POST') return state;
      if (action.value !== null && (!Number.isInteger(action.value) || action.value < 0 || action.value > 10)) return state;
      if (state.stage === 'PRE' && action.value === null) return state;
      const before = state.stage === 'PRE';
      return { ...state, stage: before ? 'THOUGHT' : 'DONE', ...(before ? { pre: action.value } : { post: action.value }), messages: [...state.messages,
        makeMessage('user', action.value === null ? '지금은 점수를 남기지 않을게요.' : `${action.value}점 정도예요.`),
        makeMessage('assistant', before ? '그때 가장 먼저 떠올랐던 생각은 무엇이었소?' : '이야기를 나눠주어 고맙소.\n잠시 마음을 내려놓는 시간이 되었기를 바라오.')] };
    }
    case 'finish':
      if (!state.primary || state.stage === 'DONE' || state.stage === 'SAFETY' || state.stage === 'POST') return state;
      return { ...state, stage: 'POST', messages: [...state.messages, makeMessage('assistant', '여기까지 이야기해도 괜찮소.\n마무리하기 전에, 지금 마음의 무게는 어떻소?')] };
  }
}
export const stageLabels: Record<Stage, string> = {
  OPEN: '이야기 꺼내기', EMOTIONS: '감정 알아보기', PRE: '마음의 크기', THOUGHT: '생각 들여다보기',
  REFRAME: '다르게 바라보기', NEED: '바랐던 마음', COPING: '나의 힘 찾기', ACTION: '작은 실천', POST: '지금의 마음', DONE: '대화 마무리', SAFETY: '잠시 멈추기',
};
