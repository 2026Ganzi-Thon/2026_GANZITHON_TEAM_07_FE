import { useEffect, useReducer, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronRight, CircleHelp, Mic, MessageCircle, Settings, Send, RefreshCw } from 'lucide-react';
import { Avatar, IconButton, Modal } from '../../components/ui';
import { previewApi } from '../../lib/api';
import { chatReducer, initialChat, isTextStage, makeMessage, SAMPLE_ACTIONS, stageLabels, suggestions } from './model';
import type { PreviewRequest } from './model';
import { EmotionCard, IntensityCard } from './InputCards';
import styles from './Chat.module.css';
import { usePreview } from '../../lib/PreviewContext';

export function Chat() {
  const [state, dispatch] = useReducer(chatReducer, undefined, initialChat);
  const [draft, setDraft] = useState('');
  const [voiceInfo, setVoiceInfo] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [failNext, setFailNext] = useState(false);
  const [hasNew, setHasNew] = useState(false);
  const navigate = useNavigate();
  const preview = usePreview();
  const conversationId = useRef(crypto.randomUUID());
  const forwarded = useRef(false);
  useEffect(() => {
    if (forwarded.current) return;
    if (state.stage === 'SAFETY') { forwarded.current = true; navigate('/help', { replace: true }); }
    if (state.stage === 'DONE') {
      forwarded.current = true;
      if (!state.primary) { navigate('/', { replace: true }); return; }
      const id = conversationId.current;
      preview.drafts.set(id, { id, messages: structuredClone(state.messages), context: { stage: state.stage, primary: state.primary, secondary: state.secondary, pre: state.pre, post: state.post, slots: state.slots, unknowns: state.unknowns } });
      navigate(`/results/${id}`, { replace: true });
    }
  }, [state, preview, navigate]);
  const scroll = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const stickToBottom = useRef(true);
  const busy = useRef(false);
  const mounted = useRef(true);
  const lastRequest = useRef<PreviewRequest | null>(null);
  const composing = useRef(false);
  const responseController = useRef<AbortController | null>(null);
  const mutation = useMutation({
    mutationFn: ({ request, fail }: { request: PreviewRequest; fail: boolean }) => {
      responseController.current = new AbortController();
      return previewApi.reply(request, fail, responseController.current.signal);
    },
    onSuccess: reply => { if (mounted.current) dispatch({ type: 'reply', reply }); },
    onSettled: () => { busy.current = false; },
  });
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; responseController.current?.abort(); }; }, []);
  function toBottom(behavior: ScrollBehavior = 'smooth') {
    const el = scroll.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : behavior });
    stickToBottom.current = true; setHasNew(false);
  }
  useEffect(() => {
    if (state.messages.length === 1) { scroll.current?.scrollTo({ top: 0 }); return; }
    const timer = requestAnimationFrame(() => { if (stickToBottom.current) toBottom('instant'); else setHasNew(true); });
    return () => cancelAnimationFrame(timer);
  }, [state.messages.length, state.stage, mutation.isPending, mutation.isError]);
  useEffect(() => {
    if (!input.current) return;
    input.current.style.height = '24px';
    input.current.style.height = `${Math.min(input.current.scrollHeight, 112)}px`;
  }, [draft]);
  const ended = state.stage === 'DONE' || state.stage === 'SAFETY';
  const canType = isTextStage(state.stage) && !ended;
  const pending = mutation.isPending;
  const failed = mutation.isError;
  const fresh = state.messages.length === 1;

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 2000 || busy.current || failed || !canType) return;
    busy.current = true; stickToBottom.current = true;
    const request: PreviewRequest = { context: { stage: state.stage, primary: state.primary, secondary: state.secondary, pre: state.pre, post: state.post, slots: state.slots, unknowns: state.unknowns }, text: trimmed, requestId: crypto.randomUUID() };
    lastRequest.current = request;
    dispatch({ type: 'sent', message: makeMessage('user', trimmed) }); setDraft('');
    mutation.mutate({ request, fail: failNext }); setFailNext(false);
  }
  useEffect(() => {
    // Delay until the StrictMode setup/cleanup replay finishes, so the first request is sent once.
    let active = true;
    queueMicrotask(() => {
      if (!active || !preview.entry) return;
      const { text } = preview.entry; preview.entry = null;
      send(text);
    });
    return () => { active = false; };
  }, [preview]);
  function retry() {
    if (!lastRequest.current || busy.current) return;
    busy.current = true; stickToBottom.current = true;
    mutation.mutate({ request: lastRequest.current, fail: false });
  }
  function finish() {
    if (pending) return;
    mutation.reset();
    if (!state.primary || ended) { navigate('/'); return; }
    stickToBottom.current = true; setDraft(''); dispatch({ type: 'finish' });
  }
  return <main className={styles.chat}>
    <header className={styles.header}>
      <IconButton label="대화 나가기" onClick={finish} disabled={pending}><ArrowLeft size={21} strokeWidth={1.6} /></IconButton>
      <div className={styles.headerTitle}><h1>대화</h1></div>
      <IconButton label="대화 설정" onClick={() => setInfoOpen(true)}><Settings size={21} strokeWidth={1.6} /></IconButton>
    </header>
    <div className={styles.statusLine}><span role="status">{pending ? '답변을 준비하고 있어요' : failed ? '답변을 다시 불러올 수 있어요' : ''}</span><button onClick={finish} disabled={pending} className={styles.endButton}>끝내기</button></div>
    <div className={styles.conversation} ref={scroll} onScroll={() => { const el = scroll.current; if (el) { stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 90; if (stickToBottom.current) setHasNew(false); } }} data-testid="conversation-scroll">
      <div className={styles.daySeparator}>{new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' })}</div>
      <div className={styles.messageList} role="log" aria-label="대화 내용" aria-live="polite" aria-relevant="additions text">
        {state.messages.map((message, index) => <div key={message.id} className={styles.messageRow}>
          <div className={`${styles.message} ${message.role === 'user' ? styles.user : styles.assistant}`}>
            {message.role === 'assistant' && <span className={styles.messageAvatar}><Avatar /></span>}
            <div className={styles.bubble}>{message.text}</div><time className={styles.time}>{message.time}</time>
          </div>
          {state.pre !== null && index === state.messages.findIndex(m => m.role === 'user' && m.text === `${state.pre}점 정도예요.`) && <EmotionSummary primary={state.primary!} secondary={state.secondary} situation={state.slots.OPEN} score={state.pre} time={message.time} />}
        </div>)}
        {pending && <div className={`${styles.message} ${styles.assistant}`}><span className={styles.messageAvatar}><Avatar /></span><div className={styles.typing} aria-label="답변 준비 중"><span /><span /><span /></div></div>}
      </div>
      {fresh && <section className={styles.suggestions} aria-label="예시 이야기"><p>이야기 시작하기</p>{suggestions.map((item) => <button key={item.label} onClick={() => send(item.text)}>{item.label}<ChevronRight size={14} /></button>)}</section>}
      {failed && <div className={styles.error} role="alert"><CircleHelp size={19} /><div><strong>답변을 받지 못했어요</strong><p>{mutation.error.message}</p><p>보낸 이야기는 그대로 있어요.</p><button onClick={retry}><RefreshCw size={14} /> 다시 시도하기</button></div></div>}
      {!pending && !failed && state.stage === 'EMOTIONS' && <EmotionCard onSubmit={(primary, secondary) => { stickToBottom.current = true; dispatch({ type: 'emotions', primary, secondary }); }} />}
      {!pending && !failed && (state.stage === 'PRE' || state.stage === 'POST') && <IntensityCard key={state.stage} after={state.stage === 'POST'} onSubmit={value => { stickToBottom.current = true; dispatch({ type: 'intensity', value }); }} />}
      {!pending && !failed && state.stage === 'ACTION' && <section className={styles.actions} aria-label="실천 예시"><p>작은 일 하나면 충분해요 <span>예시</span></p>{SAMPLE_ACTIONS.map(text => <button key={text} onClick={() => send(text)}>{text}<ArrowUp size={15} /></button>)}</section>}
      {ended && <p role="status">다음 화면으로 이동하고 있어요.</p>}
      <div className={styles.scrollTail} />
    </div>
    {hasNew && <button className={styles.newMessages} onClick={() => toBottom()}><ArrowDown size={14} /> 새 내용 보기</button>}
    <footer className={styles.composerArea}>
      {!fresh && !ended && <div className={styles.stepCaption}><span className={styles.stepDot} />{stageLabels[state.stage]}</div>}
      {ended ? <Link className={styles.closedComposer} to="/"><MessageCircle size={17} />대화를 마쳤어요. 메인으로 돌아가기 <ArrowRight size={16} /></Link> : <form className={`${styles.composer} ${!canType ? styles.composerInactive : ''}`} onSubmit={e => { e.preventDefault(); if (!composing.current) send(draft); }}>
        <button type="button" className={styles.micButton} aria-label="음성 대화 안내" onClick={() => setVoiceInfo(true)}><Mic size={20} strokeWidth={1.5} /></button>
        <textarea ref={input} aria-label="테스에게 보낼 이야기" placeholder={!canType ? '위 카드에서 마음을 골라주세요' : failed ? '다시 시도하거나 대화를 마무리해 주세요' : '고민을 입력해보세요.'} value={draft} onChange={e => setDraft(e.target.value)} maxLength={2000} rows={1} disabled={!canType || failed} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && !composing.current && e.keyCode !== 229) { e.preventDefault(); send(draft); } }} />
        <button type="submit" aria-label="메시지 보내기" disabled={!canType || !draft.trim() || pending || failed}><Send size={23} strokeWidth={1.5} /></button>
      </form>}
      <div className={styles.composerHint}><span>전문 상담이나 치료를 대신하지 않아요.</span>{draft.length > 1600 && <span>{draft.length}/2,000</span>}</div>
    </footer>
    {voiceInfo && <Modal title="음성 대화" onClose={() => setVoiceInfo(false)}><p>음성 대화는 아직 연결되지 않았어요. 지금은 글로 대화할 수 있어요.</p><button className={styles.cardSubmit} onClick={() => { setVoiceInfo(false); requestAnimationFrame(() => input.current?.focus()); }}>텍스트로 계속하기</button></Modal>}
    {infoOpen && <Modal title="대화 설정" onClose={() => setInfoOpen(false)}><div className={styles.previewInfo}><p>현재는 실제 AI와 연결되지 않은 예시 대화예요. 입력한 문장에 맞는 분석이나 상담 정확도를 확인하는 버전은 아니에요.</p><p>감정 목록과 행동 선택지는 화면 확인용이에요. 대화는 이 화면에 머무는 동안에만 유지되고, 새로고침하면 초기화돼요.</p><details><summary>개발 검수 도구</summary><button className={styles.failureToggle} aria-pressed={failNext} onClick={() => setFailNext(!failNext)}><span><strong>응답 실패 상태 확인</strong><small>다음 메시지를 한 번 실패시켜 재시도를 살펴봐요.</small></span><span className={`${styles.toggle} ${failNext ? styles.toggleOn : ''}`} /></button></details><p>음성과 실제 AI·서버 연결은 준비 중이에요. 완료한 대화는 체험 보관함으로 이어져요.</p></div></Modal>}
  </main>;
}

export function EmotionSummary({ primary, secondary, situation, score, time }: { primary: string; secondary: string | null; situation?: string; score: number; time: string }) {
  return <section className={styles.emotionSummary} aria-label="선택한 감정 기록"><header><strong>감정 기록 확인</strong><time>{time}</time></header><dl><div><dt>대표 감정</dt><dd><span className={styles.primaryPill}>✓ {primary}</span></dd></div><div><dt>부가 감정</dt><dd>{secondary ? <span className={styles.secondaryPill}>{secondary}</span> : '없음'}</dd></div><div><dt>유발 상황</dt><dd>{situation || '아직 남기지 않았어요.'}</dd></div></dl><div className={styles.scoreCaption}><span>감정 강도</span><strong>{score} / 10</strong></div><meter min={0} max={10} value={score} aria-label={`감정 강도 ${score}점`} /></section>;
}
