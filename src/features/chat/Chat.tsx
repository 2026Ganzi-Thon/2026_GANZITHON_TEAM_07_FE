import { useEffect, useReducer, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronRight, CircleHelp, Mic, MessageCircle, Settings, Send, RefreshCw } from 'lucide-react';
import { Avatar, IconButton, Modal } from '../../components/ui';
import { previewApi } from '../../lib/api';
import { chatReducer, initialChat, isTextStage, makeMessage, SAMPLE_ACTIONS, suggestions } from './model';
import type { PreviewRequest } from './model';
import { useVoice } from './useVoice';
import { VoiceView } from './VoiceView';
import { EmotionCard, IntensityCard } from './InputCards';
import styles from './Chat.module.css';
import { usePreview, useProfile } from '../../lib/PreviewContext';
import type { ResultDraft } from '../../lib/domain';

export function Chat() {
  const [state, dispatch] = useReducer(chatReducer, undefined, initialChat);
  const [draft, setDraft] = useState('');
  const [inputError, setInputError] = useState('');
  const [voiceScreen, setVoiceScreen] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [hasNew, setHasNew] = useState(false);
  const navigate = useNavigate();
  const preview = usePreview();
  const profile = useProfile(); const client = useQueryClient();
  const partialDraft = useRef<ResultDraft | null>(null);
  const savePartial = useMutation({ mutationFn: () => previewApi.save(partialDraft.current!), onSuccess: async record => {
    client.setQueryData(['preview', profile.data!.id, 'record', record.id], record);
    await client.invalidateQueries({ queryKey: ['preview', profile.data!.id, 'records'] });
    navigate('/archive', { replace: true, state: { saved: true } });
  } });
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
  const voice = useVoice({ ready: canType && !pending && !failed && !confirmEnd && !infoOpen,
    reply: state.messages.filter(message => message.role === 'assistant').at(-1),
    onFinal: text => send(text, false), onDraft: text => setDraft(current => current ? `${current} ${text}` : text),
  });
  const voiceStatus = voice.error ? '음성 인식을 확인해 주세요' : voice.muted ? '마이크가 꺼져 있어요' : voice.speaking ? '테스가 이야기하고 있어요' : pending ? '테스가 생각하고 있어요' : !canType ? '채팅에서 마음을 골라주세요' : voice.listening ? '그대의 이야기를 듣고 있소…' : '마이크를 연결하고 있어요';
  const showVoice = voice.active && voiceScreen && canType;
  useEffect(() => { if (!canType || !voice.active) setVoiceScreen(false); }, [canType, voice.active]);
  useEffect(() => {
    if (!voice.interim) return;
    const timer = requestAnimationFrame(() => { if (stickToBottom.current) toBottom('instant'); else setHasNew(true); });
    return () => cancelAnimationFrame(timer);
  }, [voice.interim]);
  function askFinish() { if (!pending) { savePartial.reset(); partialDraft.current = null; setConfirmEnd(true); } }
  function saveAndLeave() {
    if (pending || savePartial.isPending || !state.messages.some(message => message.role === 'user')) return;
    voice.stop();
    partialDraft.current ??= { id: conversationId.current, partial: true, messages: structuredClone(state.messages), context: { stage: state.stage, primary: state.primary, secondary: state.secondary, pre: state.pre, post: state.post, slots: structuredClone(state.slots), unknowns: { ...state.unknowns } } };
    savePartial.mutate();
  }
  function startVoice() { voice.start(); if (voice.supported && window.isSecureContext) setVoiceScreen(true); }


  function send(text: string, clearDraft = true, continueOpening = false) {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 2000 || busy.current || failed || !canType) return;
    if (!/[가-힣a-zA-Z]{2}/.test(trimmed)) { setDraft(current => clearDraft ? text : current ? `${current} ${text}` : text); setInputError('이야기를 짧은 문장으로 적어주세요.'); return; }
    setInputError('');
    busy.current = true; stickToBottom.current = true;
    const request: PreviewRequest = { context: { stage: state.stage, primary: state.primary, secondary: state.secondary, pre: state.pre, post: state.post, slots: state.slots, unknowns: state.unknowns }, text: trimmed, history: state.messages, continueOpening, requestId: crypto.randomUUID() };
    lastRequest.current = request;
    dispatch({ type: 'sent', message: makeMessage('user', trimmed) }); if (clearDraft) setDraft('');
    mutation.mutate({ request, fail: false });
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
    voice.stop(); setConfirmEnd(false);
    mutation.reset();
    if (!state.primary || ended) { navigate('/'); return; }
    stickToBottom.current = true; setDraft(''); dispatch({ type: 'finish' });
  }
  return <main className={styles.chat}>
    <header className={styles.header} inert={showVoice} aria-hidden={showVoice}>
      <IconButton label="대화 나가기" onClick={askFinish} disabled={pending}><ArrowLeft size={21} strokeWidth={1.6} /></IconButton>
      <div className={styles.headerTitle}><h1>대화</h1></div>
      <IconButton label="대화 설정" onClick={() => setInfoOpen(true)}><Settings size={21} strokeWidth={1.6} /></IconButton>
    </header>
    <div className={styles.statusLine} inert={showVoice} aria-hidden={showVoice}><span role="status">{pending ? '답변을 준비하고 있어요' : failed ? '답변을 다시 불러올 수 있어요' : ''}</span><button onClick={askFinish} disabled={pending} className={styles.endButton}>끝내기</button></div>
    <div className={styles.conversation} inert={showVoice} aria-hidden={showVoice} ref={scroll} onScroll={() => { const el = scroll.current; if (el) { stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 90; if (stickToBottom.current) setHasNew(false); } }} data-testid="conversation-scroll">
      <div className={styles.daySeparator}>{new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' })}</div>
      <div className={styles.messageList} role="log" aria-label="대화 내용" aria-live="polite" aria-relevant="additions text">
        {state.messages.map((message, index) => <div key={message.id} className={styles.messageRow}>
          <div className={`${styles.message} ${message.role === 'user' ? styles.user : styles.assistant}`}>
            {message.role === 'assistant' && <span className={styles.messageAvatar}><Avatar /></span>}
            <div className={styles.bubble}>{message.text}</div><time className={styles.time}>{message.time}</time>
          </div>
          {state.pre !== null && index === state.messages.findIndex(m => m.role === 'user' && m.text === `${state.pre}점 정도예요.`) && <EmotionSummary primary={state.primary!} secondary={state.secondary} situation={state.slots.OPEN} score={state.pre} time={message.time} />}
        </div>)}
        {voice.interim && <div className={`${styles.message} ${styles.user}`} data-testid="live-transcript"><div className={styles.bubble}>{voice.interim}</div><span className={styles.time}>듣는 중</span></div>}
        {pending && <div className={`${styles.message} ${styles.assistant}`}><span className={styles.messageAvatar}><Avatar /></span><div className={styles.typing} aria-label="답변 준비 중"><span /><span /><span /></div></div>}
      </div>
      {fresh && <section className={styles.suggestions} aria-label="이야기 시작 문구"><p>이야기 시작하기</p>{suggestions.map((item) => <button key={item.label} onClick={() => send(item.text)}>{item.label}<ChevronRight size={14} /></button>)}</section>}
      {failed && <div className={styles.error} role="alert"><CircleHelp size={19} /><div><strong>답변을 받지 못했어요</strong><p>{mutation.error.message}</p><p>보낸 이야기는 그대로 있어요.</p><button onClick={retry}><RefreshCw size={14} /> 다시 시도하기</button></div></div>}
      {!pending && !failed && state.stage === 'EMOTIONS' && <EmotionCard onSubmit={(primary, secondary) => { stickToBottom.current = true; dispatch({ type: 'emotions', primary, secondary }); }} />}
      {!pending && !failed && (state.stage === 'PRE' || state.stage === 'POST') && <IntensityCard key={state.stage} after={state.stage === 'POST'} onSubmit={value => { stickToBottom.current = true; dispatch({ type: 'intensity', value }); }} />}
      {!pending && !failed && state.stage === 'ACTION' && <section className={styles.actions} aria-label="실천 예시"><p>작은 일 하나면 충분해요</p>{SAMPLE_ACTIONS.map(text => <button key={text} onClick={() => send(text)}>{text}<ArrowUp size={15} /></button>)}</section>}
      {!pending && !failed && state.stage === 'OPEN' && !fresh && <button className={styles.continueOpening} onClick={() => send('이 내용으로 계속할게요.', true, true)}>이 내용으로 계속하기<ChevronRight size={14} /></button>}
      {ended && <p role="status">다음 화면으로 이동하고 있어요.</p>}
      <div className={styles.scrollTail} />
    </div>
    {hasNew && <button className={styles.newMessages} inert={showVoice} aria-hidden={showVoice} onClick={() => toBottom()}><ArrowDown size={14} /> 새 내용 보기</button>}
    <footer className={styles.composerArea} inert={showVoice} aria-hidden={showVoice}>
      {voice.active && <div className={styles.voiceBar}><span role="status">{voiceStatus}</span><button onClick={() => setVoiceScreen(true)}>음성 화면</button><button onClick={voice.toggleMute}>{voice.muted ? '마이크 켜기' : '음소거'}</button><button onClick={voice.stop}>중단</button></div>}
      {voice.error && !voiceScreen && <div role="alert" className={styles.voiceError}>{voice.error}{voice.active && <button onClick={voice.retry}>다시 시도하기</button>}<button onClick={() => { voice.stop(); voice.dismissError(); }}>글로 계속하기</button></div>}
      {inputError && <p className={styles.inputError} role="alert">{inputError}</p>}
      {ended ? <Link className={styles.closedComposer} to="/"><MessageCircle size={17} />대화를 마쳤어요. 메인으로 돌아가기 <ArrowRight size={16} /></Link> : <form className={`${styles.composer} ${!canType ? styles.composerInactive : ''}`} onSubmit={e => { e.preventDefault(); if (!composing.current) send(draft); }}>
        <button type="button" className={styles.micButton} aria-label="음성 대화 시작" disabled={!canType || pending || failed} onClick={startVoice}><Mic size={20} strokeWidth={1.5} /></button>
        <textarea ref={input} aria-label="테스에게 보낼 이야기" placeholder={!canType ? '위 카드에서 마음을 골라주세요' : failed ? '다시 시도하거나 대화를 마무리해 주세요' : '고민을 입력해보세요.'} value={draft} onChange={e => { setDraft(e.target.value); setInputError(''); }} maxLength={2000} rows={1} disabled={!canType || failed || (voice.active && !voice.muted)} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && !composing.current && e.keyCode !== 229) { e.preventDefault(); send(draft); } }} />
        <button type="submit" aria-label="메시지 보내기" disabled={!canType || !draft.trim() || pending || failed || (voice.active && !voice.muted)}><Send size={23} strokeWidth={1.5} /></button>
      </form>}
      {draft.length > 1600 && <div className={styles.composerHint}>{draft.length}/2,000</div>}
    </footer>
    {showVoice && <VoiceView voice={voice} status={voiceStatus} onChat={() => { setVoiceScreen(false); toBottom('instant'); }} />}
    {confirmEnd && <Modal title="대화를 마무리할까요?" dismissible={!savePartial.isPending} onClose={() => { if (!savePartial.isPending) setConfirmEnd(false); }}><p>{state.messages.some(message => message.role === 'user') ? '보낸 이야기까지만 보관하거나, 대화를 더 이어갈 수 있어요. 아직 보내지 않은 글은 저장하지 않아요.' : '아직 나눈 이야기가 없어요. 저장 없이 메인으로 돌아갈 수 있어요.'}</p>
      {savePartial.isError && <p role="alert">{savePartial.error.message} 대화 내용은 그대로 있어요.</p>}
      {state.messages.some(message => message.role === 'user') && <button className={styles.cardSubmit} disabled={savePartial.isPending} onClick={saveAndLeave}>{savePartial.isPending ? '보관하고 있어요…' : savePartial.isError ? '다시 보관하기' : '여기까지 보관하고 나가기'}</button>}
      <button className={styles.continueConversation} disabled={savePartial.isPending} onClick={() => setConfirmEnd(false)}>계속 대화하기</button>
      {state.primary && <button className={styles.finishScore} disabled={savePartial.isPending} onClick={finish}>점수 남기고 마무리하기</button>}
      <div className={styles.discardArea}><button disabled={savePartial.isPending} onClick={() => { voice.stop(); navigate('/', { replace: true }); }}>저장 없이 나가기</button></div></Modal>}
    {infoOpen && <Modal title="대화 설정" onClose={() => setInfoOpen(false)}><label className={styles.settingRow}><span>음성 대화에서 답변 읽어주기</span><input type="checkbox" checked={voice.readAloud} onChange={event => voice.setReadAloud(event.target.checked)} /></label><p className={styles.settingNote}>마이크 버튼으로 말하거나 글로 이야기를 나눌 수 있어요. 음성 인식에는 브라우저의 마이크 권한이 필요해요.</p></Modal>}

  </main>;
}

export function EmotionSummary({ primary, secondary, situation, score, time }: { primary: string; secondary: string | null; situation?: string; score: number; time: string }) {
  return <section className={styles.emotionSummary} aria-label="선택한 감정 기록"><header><strong>감정 기록 확인</strong><time>{time}</time></header><dl><div><dt>대표 감정</dt><dd><span className={styles.primaryPill}>✓ {primary}</span></dd></div><div><dt>부가 감정</dt><dd>{secondary ? <span className={styles.secondaryPill}>{secondary}</span> : '없음'}</dd></div><div><dt>유발 상황</dt><dd>{situation || '아직 남기지 않았어요.'}</dd></div></dl><div className={styles.scoreCaption}><span>감정 강도</span><strong>{score} / 10</strong></div><meter min={0} max={10} value={score} aria-label={`감정 강도 ${score}점`} /></section>;
}
