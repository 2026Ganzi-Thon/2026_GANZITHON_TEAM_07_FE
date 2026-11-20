import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ChevronRight, Mic, Send } from 'lucide-react';
import { Avatar, IconButton, Modal } from '../../components/ui';
import { usePreview, useProfile } from '../../lib/PreviewContext';
import { counselingApi } from '../../lib/counselingApi';
import type { EmotionInput } from '../../lib/counselingApi';
import type { Turn } from '../../lib/counselingContracts';
import { ApiError } from '../../lib/errors';
import { initialChat, makeMessage, suggestions } from './model';
import type { Message } from './model';
import { EmotionCard, IntensityCard } from './InputCards';
import { EmotionSummary } from './Chat';
import { useVoice } from './useVoice';
import { VoiceView } from './VoiceView';
import { MicrophoneCheck } from './MicrophoneCheck';
import styles from './Chat.module.css';

// Only used when the server requests early completion before sending an emotion card.
// Backend EmotionCatalog, main 637664c. Normal cards always use the response's options.
const earlyPrimary = ['속상함','불안함','분노','억울함','슬픔','서운함'];
const earlySecondary = ['답답함','외로움','허무함','서운함','억울함'];
export interface Conversation { messages: Message[]; turn: Turn | null; emotion: EmotionInput | null; draft: string; error: string; uncertain: boolean; resultId?: string; paused?: boolean; emotionCards?: { afterId: string; value: EmotionInput }[] }
const initial = (): Conversation => ({ messages:initialChat().messages, turn:null, emotion:null, draft:'', error:'', uncertain:false });

export function LiveChat() {
  const profile = useProfile(); const client = useQueryClient(); const preview = usePreview(); const navigate = useNavigate();
  const key = ['preview', profile.data!.id, 'live-chat'];
  const [conversation,setConversation] = useState<Conversation>(() => client.getQueryData<Conversation>(key) ?? initial());
  const latest = useRef(conversation); latest.current = conversation;
  const [pending,setPending] = useState(false); const busy = useRef(false);
  const [confirmEnd,setConfirmEnd] = useState(false); const [info,setInfo] = useState(false);
  const [voiceScreen,setVoiceScreen] = useState(false);
  const [chosen,setChosen] = useState<{ primary:string; secondary:string|null } | null>(null);
  const mounted = useRef(true); const controller = useRef<AbortController | null>(null);
  const composing = useRef(false); const scroll = useRef<HTMLDivElement>(null); const input = useRef<HTMLTextAreaElement>(null);
  function update(change: Partial<Conversation> | ((value:Conversation) => Conversation)) {
    const next = typeof change === 'function' ? change(latest.current) : { ...latest.current,...change };
    latest.current = next;
    client.setQueryData(key,next);
    if (mounted.current) setConversation(next);
  }
  useEffect(() => {
    mounted.current = true;
    client.setQueryDefaults(key,{ gcTime:Infinity });
    if (latest.current.paused) update({ paused:false });
    return () => { mounted.current = false; controller.current?.abort(); };
  }, []);
  const turn = conversation.turn;
  // Keep each card at its submission point, including already-open local sessions.
  const emotionCards = conversation.emotionCards ?? (conversation.emotion ? [{
    afterId: conversation.messages.find(m => m.role === 'user' && m.text === `${conversation.emotion!.primaryEmotion}${conversation.emotion!.secondaryEmotion ? ` · ${conversation.emotion!.secondaryEmotion}` : ''}, ${conversation.emotion!.preIntensity}점`)?.id ?? conversation.messages.at(-1)!.id,
    value: conversation.emotion,
  }] : []);
  const ended = !!turn && (turn.status !== 'IN_PROGRESS' || turn.nextInput === 'NONE' || turn.riskDetected);
  const canType = !ended && (!turn || turn.nextInput === 'MESSAGE') && !conversation.resultId;
  const needsEmotion = !!turn && (turn.nextInput === 'EMOTION_CARD' || turn.nextInput === 'POST_INTENSITY' && !conversation.emotion);
  const voice = useVoice({ ready:canType && !pending && !conversation.error && !confirmEnd && !info,
    draft:conversation.draft, onDraft: text => update({ draft:text }),
  });
  const showVoice = voice.active && voiceScreen && canType;
  const voiceStatus = voice.error ? '음성 인식을 확인해 주세요' : voice.muted ? '마이크가 꺼져 있어요' : pending ? '테스가 생각하고 있어요' : !canType ? '선택을 마치면 다시 입력할 수 있어요' : voice.listening ? '테스가 듣고 있어요…' : '마이크를 연결하고 있어요';
  useEffect(() => { if (!canType || !voice.active) setVoiceScreen(false); },[canType,voice.active]);
  useEffect(() => { scroll.current?.scrollTo({ top:scroll.current.scrollHeight }); },[conversation.messages.length,pending,chosen,turn?.nextInput,voice.interim]);
  useEffect(() => { if (input.current) { input.current.style.height='24px'; input.current.style.height=`${Math.min(112,input.current.scrollHeight)}px`; } },[conversation.draft]);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active || !preview.entry) return;
      const text = preview.entry.text; preview.entry = null;
      if (latest.current.messages.length > 1) update({ draft:text });
      else void send(text);
    });
    return () => { active=false; };
  },[preview]);
  function accept(next:Turn) {
    update(c => ({ ...c, turn:next, error:'', uncertain:false, messages:next.aiMessage ? [...c.messages,...next.aiMessage.split(/\n+/).filter(Boolean).map(text => makeMessage('assistant',text))] : c.messages }));
    if (next.riskDetected || next.status === 'ABORTED_RISK') { voice.stop(); client.removeQueries({ queryKey:key, exact:true }); navigate('/help',{ replace:true }); }
  }
  async function perform(action: (signal:AbortSignal) => Promise<void>) {
    if (busy.current) return;
    busy.current=true; setPending(true); controller.current=new AbortController();
    try { await action(controller.current.signal); }
    catch(error) {
      if (mounted.current) {
        const uncertain = !(error instanceof ApiError) || error.status === 0 || error.status === 408 || error.status >= 500;
        update({ error:error instanceof Error ? error.message : '요청을 처리하지 못했어요.', uncertain });
      }
    } finally { busy.current=false; if (mounted.current) setPending(false); }
  }
  async function send(value:string, clear=true) {
    const text=value.trim();
    if (!text || text.length>2000 || busy.current || !canType || latest.current.error) { if (!clear && text) update({ draft:text }); return; }
    voice.stop(); voice.dismissError();
    update(c => ({ ...c, draft:clear ? '' : c.draft, messages:[...c.messages,makeMessage('user',text)] }));
    await perform(async signal => {
      const id=latest.current.turn?.sessionId;
      const reply=id ? await counselingApi.message(id,text,signal) : await counselingApi.start(text,signal);
      accept(reply);
    });
  }
  async function submitEmotion(score:number|null) {
    if (!chosen || score === null || !turn || busy.current) return;
    const emotion:EmotionInput={ primaryEmotion:chosen.primary, secondaryEmotion:chosen.secondary, preIntensity:score, ...(turn.emotionCard?.triggerFactor ? { triggerFactor:turn.emotionCard.triggerFactor } : {}) };
    if (turn.nextInput === 'POST_INTENSITY') { update(c => ({ ...c, emotion, emotionCards: [...(c.emotionCards ?? []), { afterId: c.messages.at(-1)!.id, value: emotion }] })); setChosen(null); return; }
    await perform(async signal => {
      const reply=await counselingApi.emotion(turn.sessionId,emotion,signal);
      const message = makeMessage('user',`${emotion.primaryEmotion}${emotion.secondaryEmotion ? ` · ${emotion.secondaryEmotion}` : ''}, ${score}점`);
      update(c => ({ ...c, emotion, messages:[...c.messages,message], emotionCards:[...(c.emotionCards ?? []), { afterId:message.id, value:emotion }] }));
      setChosen(null); accept(reply);
    });
  }
  async function complete(score:number|null) {
    if (!turn || turn.nextInput !== 'POST_INTENSITY' || score === null || busy.current) return;
    await perform(async signal => {
      const id=await counselingApi.complete(turn.sessionId,score,conversation.emotion ?? undefined,signal);
      // Remember the returned ID before any GET: a failed detail fetch must never repeat completion.
      update({ resultId:id,error:'',uncertain:false });
      voice.stop(); client.removeQueries({ queryKey:key, exact:true });
      void client.invalidateQueries({ queryKey:['preview',profile.data!.id,'records'] });
      navigate(`/results/${id}`,{ replace:true });
    });
  }
  function pause() { voice.stop(); update({ paused:true }); navigate('/',{ replace:true }); }
  async function discard() {
    if (busy.current) return;
    await perform(async () => {
      if (turn?.status === 'IN_PROGRESS') await counselingApi.abort(turn.sessionId);
      voice.stop(); client.removeQueries({ queryKey:key,exact:true }); navigate('/',{ replace:true });
    });
  }
  function startVoice() { voice.start(); if (voice.supported && window.isSecureContext) setVoiceScreen(true); }
  return <main className={styles.chat}>
    <header className={styles.header} inert={showVoice} aria-hidden={showVoice}>
      <IconButton label="대화 나가기" disabled={pending} onClick={() => setConfirmEnd(true)}><ArrowLeft size={21} /></IconButton>
      <div className={styles.headerTitle}><h1>대화</h1></div>
      <span className={styles.headerSpacer} aria-hidden="true" />
    </header>
    <div className={styles.statusLine} inert={showVoice} aria-hidden={showVoice}><span /><button className={styles.endButton} disabled={pending} onClick={() => setConfirmEnd(true)}>끝내기</button></div>
    <div ref={scroll} className={styles.conversation} inert={showVoice} aria-hidden={showVoice} data-testid="conversation-scroll">
      <div className={styles.daySeparator}>{new Date().toLocaleDateString('ko-KR')}</div>
      <div className={styles.messageList} role="log" aria-label="대화 내용" aria-live="polite" aria-relevant="additions text">
        {conversation.messages.map(message => <div className={styles.messageRow} key={message.id}><div className={`${styles.message} ${message.role === 'user' ? styles.user : styles.assistant}`}>
          {message.role === 'assistant' && <span className={styles.messageAvatar}><Avatar /></span>}<div className={styles.bubble}>{message.text}</div><time className={styles.time}>{message.time}</time>
        </div>{emotionCards.filter(card => card.afterId === message.id).map((card, index) => <EmotionSummary key={`${message.id}-${index}`} collapsible primary={card.value.primaryEmotion} secondary={card.value.secondaryEmotion} situation={card.value.triggerFactor} score={card.value.preIntensity} time={message.time} />)}</div>)}
        {pending && <div className={`${styles.message} ${styles.assistant}`}><span className={styles.messageAvatar}><Avatar /></span><div className={styles.typing} aria-label="답변 준비 중"><span /><span /><span /></div></div>}
      </div>
      {conversation.error && <div role="alert" className={styles.error}><div><strong>요청을 확인해 주세요</strong><p>{conversation.error}</p>
        {conversation.uncertain ? <p>서버 처리 여부를 확인하지 못했어요. 중복 전송을 막기 위해 자동으로 다시 보내지 않아요. 완료 요청이었다면 보관함을 확인해 주세요.</p> : <button onClick={() => update({ error:'',uncertain:false })}>입력으로 돌아가기</button>}
        <Link to="/archive">마음 보관함 확인하기</Link>
      </div></div>}
      {!pending && !conversation.error && !ended && <>
        {canType && (turn?.replyOptions.length || conversation.messages.length === 1) ? <section className={styles.suggestions} aria-label="대화 선택지">{(turn ? turn.replyOptions : suggestions.map(item => item.text)).map(text => <button key={text} onClick={() => void send(text)}>{text}<ChevronRight size={14} /></button>)}</section> : null}
        {needsEmotion && !chosen && <EmotionCard key={turn!.currentStep} primaryOptions={turn?.emotionCard?.primaryEmotions ?? earlyPrimary} secondaryOptions={turn?.emotionCard?.secondaryEmotions ?? earlySecondary} onSubmit={(primary,secondary) => setChosen({ primary,secondary })} />}
        {needsEmotion && chosen && <IntensityCard after={false} allowSkip={false} onSubmit={value => void submitEmotion(value)} />}
        {turn?.nextInput === 'POST_INTENSITY' && conversation.emotion && <IntensityCard after allowSkip={false} onSubmit={value => void complete(value)} />}
        {canType && turn && <div className={styles.wrapUp}><p>충분히 이야기했다면 지금까지의 내용을 정리할 수 있어요.</p><button onClick={() => setConfirmEnd(true)}>지금까지 이야기 정리하기</button></div>}
        {turn?.nextInput === 'MESSAGE' && !turn.aiMessage && <p className={styles.settingNote}>떠오르는 이야기를 이어서 남겨주세요.</p>}
      </>}
      {ended && !turn?.riskDetected && <p role="status">대화가 종료됐어요. 보관함에서 완료한 기록을 확인할 수 있어요.</p>}
      <div className={styles.scrollTail} />
    </div>
    <footer className={styles.composerArea} inert={showVoice} aria-hidden={showVoice}>
      {voice.active && <div className={styles.voiceBar}><span role="status">{voiceStatus}</span><button onClick={() => setVoiceScreen(true)}>음성 화면</button><button onClick={voice.toggleMute}>{voice.muted ? '마이크 켜기' : '음소거'}</button><button onClick={voice.stop}>중단</button></div>}
      {voice.error && !showVoice && <div className={styles.voiceError} role="alert">{voice.error}<MicrophoneCheck /><button onClick={voice.retry}>다시 시도하기</button><button onClick={() => { voice.stop(); voice.dismissError(); }}>글로 계속하기</button></div>}
      <form className={styles.composer} onSubmit={event => { event.preventDefault(); if (!composing.current) void send(conversation.draft); }}>
        <button type="button" className={styles.micButton} aria-label="음성 대화 시작" disabled={!canType || pending || !!conversation.error} onClick={startVoice}><Mic size={20} /></button>
        <textarea ref={input} aria-label="테스에게 보낼 이야기" placeholder={canType ? '고민을 입력해보세요.' : '위 카드에서 마음을 골라주세요'} value={conversation.draft} maxLength={2000} rows={1}
          disabled={!canType || !!conversation.error} onFocus={() => { if (voice.active) voice.pause(); }} onChange={event => { if (voice.active && !voice.muted) voice.pause(); update({ draft:event.target.value }); }}
          onCompositionStart={() => { composing.current=true; }} onCompositionEnd={() => { composing.current=false; }}
          onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && !composing.current && event.keyCode !== 229) { event.preventDefault(); void send(conversation.draft); } }} />
        <button type="submit" aria-label="메시지 보내기" disabled={!canType || pending || !!conversation.error || !conversation.draft.trim()}><Send size={23} /></button>
      </form>
    </footer>
    {showVoice && <VoiceView onInfo={() => setInfo(true)} voice={voice} status={voiceStatus} draft={conversation.draft} onChat={() => { voice.pause(); setVoiceScreen(false); }} />}
    {confirmEnd && <Modal title="대화를 마무리할까요?" dismissible={!pending} onClose={() => setConfirmEnd(false)}>
      <div className={styles.endFlow}>
      <p className={styles.endDescription}>이야기를 정리한 뒤 마지막 마음 점수를 남기면 보관함에 저장돼요.<br />아직 보내지 않은 글은 기록에 포함되지 않아요.</p>
      {conversation.error && <p role="alert">{conversation.error}</p>}
      {turn?.nextInput === 'POST_INTENSITY' && <button className={styles.cardSubmit} disabled={pending} onClick={() => setConfirmEnd(false)}>점수 남기고 마무리하기</button>}
      {turn?.nextInput === 'MESSAGE' && !conversation.error && <button className={styles.cardSubmit} disabled={pending} onClick={() => { setConfirmEnd(false); void send('이제 대화를 마무리하고 싶어요.', false); }}>이야기 정리하기</button>}
      {turn?.nextInput === 'EMOTION_CARD' && <p>선택 중인 감정을 먼저 남기면 정리를 요청할 수 있어요.</p>}
      <button className={styles.continueConversation} disabled={pending} onClick={() => setConfirmEnd(false)}>계속 대화하기</button>
      <div className={styles.exitSection}>
        <p>잠시 나가면 이 탭에서 이어갈 수 있어요.<br />새로고침하거나 탭을 닫으면 진행 중인 대화는 사라져요.</p>
        <div className={styles.exitActions}><button disabled={pending} onClick={pause}>잠시 나가기</button><button className={styles.discardAction} disabled={pending} onClick={() => void discard()}>저장 없이 나가기</button></div>
      </div>
      </div>
    </Modal>}
    {info && <Modal title="음성 입력 안내" onClose={() => setInfo(false)}><p>말한 내용은 입력창에 적혀요. 채팅에서 내용을 확인하거나 수정한 뒤 전송 버튼을 눌러주세요.</p><p>채팅으로 돌아가면 듣기를 잠시 멈춰요. 마이크를 다시 켜면 작성한 글 뒤에 이어서 말할 수 있어요.</p></Modal>}
  </main>;
}
