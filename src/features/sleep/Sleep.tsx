import { useCallback, useEffect, useReducer, useRef, useState, useSyncExternalStore } from 'react';
import type { CSSProperties } from 'react';
import { ArrowLeft, Moon } from 'lucide-react';
import { Link } from 'react-router';
import { AppMenu } from '../../components/AppMenu';
import { ChatEntrySheet, useChatEntry } from '../chat/ChatEntrySheet';
import { SleepPanel } from './SleepPanel';
import { DESIGN_ASSETS } from '../../lib/assets';
import { clockRemaining, formatRemaining, initialSleepState, remainingSeconds, sleepReducer, sleepSummary } from './model';
import type { SleepAction } from './model';
import { SleepAudio } from './sleepAudio';
import { SleepSettings } from './SleepSettings';
import styles from './Sleep.module.css';

type Phase = 'ready' | 'running' | 'off';

/** DF03 sleep mode: ready → running → (timer) ready or dark "screen off" overlay. Settings live only in this tab. */
export function Sleep() {
  const [state, dispatchSettings] = useReducer(sleepReducer, initialSleepState);
  const { settings } = state;
  const [phase, setPhase] = useState<Phase>('ready');
  const [panel, setPanel] = useState(false);
  const [endAt, setEndAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [message, setMessage] = useState('');
  const [audio] = useState(() => new SleepAudio());
  const sound = useSyncExternalStore(audio.subscribe, audio.getSnapshot);
  const lifetime = useRef(0);
  const [chatOpen,setChatOpen] = useState(false);
  const entry = useChatEntry();
  const offButton = useRef<HTMLButtonElement>(null);

  const stop = useCallback((text: string) => { audio.stop(); setEndAt(null); setPhase('ready'); setMessage(text); }, [audio]);

  // Audio policy: leaving the page or hiding the tab ends playback; it never resumes on its own.
  useEffect(() => {
    const generation = ++lifetime.current;
    return () => { audio.stop(); queueMicrotask(() => { if (lifetime.current === generation) audio.dispose(); }); };
  }, [audio]);
  useEffect(() => {
    if (phase !== 'running') return;
    const hidden = () => { if (document.hidden) stop('화면을 벗어나 수면 모드를 멈췄어요. 다시 실행해 주세요.'); };
    const leave = () => stop('');
    document.addEventListener('visibilitychange', hidden); window.addEventListener('pagehide', leave);
    return () => { document.removeEventListener('visibilitychange', hidden); window.removeEventListener('pagehide', leave); };
  }, [phase, stop]);

  useEffect(() => { if (phase === 'running') audio.setSounds(settings.sounds); }, [audio, phase, settings.sounds]);

  useEffect(() => {
    if (phase !== 'running' || endAt === null) return;
    const tick = () => {
      const time = Date.now(); setNow(time);
      if (time < endAt) return;
      audio.fadeOut(4); setEndAt(null); setPanel(false);
      if (settings.screenOff) { setMessage(''); setPhase('off'); } else { setPhase('ready'); setMessage('타이머가 끝나 수면 모드를 마쳤어요.'); }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [audio, endAt, phase, settings.screenOff]);

  useEffect(() => { if (phase === 'off') offButton.current?.focus(); }, [phase]);

  const dispatch = (action: SleepAction) => {
    dispatchSettings(action);
    if (action.type === 'setTimer' && phase === 'running') setEndAt(Date.now() + action.minutes * 60_000);
  };
  const run = () => {
    // start() resumes the AudioContext synchronously inside this click (mobile autoplay policy).
    void audio.start(settings.sounds);
    const time = Date.now(); setNow(time); setEndAt(time + settings.minutes * 60_000); setMessage(''); setPhase('running');
  };
  const openPanel = () => { dispatchSettings({ type: 'clearNotice' }); setPanel(true); };

  const running = phase === 'running';
  const left = endAt === null ? 0 : remainingSeconds(endAt, now);
  return <main className={`${styles.page} ${running ? styles.running : ''}`} aria-label="수면모드">
    <header className={styles.sleepHeader} inert={running || panel || phase === 'off'} aria-hidden={running || panel || phase === 'off'}>
      <Link to="/" aria-label="뒤로가기"><ArrowLeft size={24}/></Link><h1>수면모드</h1>
      <AppMenu placement="top" subtle onChat={()=>setChatOpen(true)} />
    </header>
    <div className={styles.stage} inert={panel || phase === 'off'} style={{ '--mood': settings.brightness / 100 } as CSSProperties}>
      <div className={styles.timer} aria-hidden={!running} data-testid="sleep-remaining" aria-label={`남은 시간 ${formatRemaining(left)}`} role="timer">{clockRemaining(left)}</div>
      <div className={styles.sheepWrap}>
        <span className={styles.lamp} aria-hidden="true" />
        <img className={styles.sheep} src={DESIGN_ASSETS.sleepSticker} width={1536} height={1024} decoding="async" fetchPriority="high" alt="수면 모자를 쓰고 잠든 양" />
      </div>
      <p className={styles.summary} aria-hidden={running}>{sleepSummary(settings)}</p>
      {running
        ? <button type="button" className={styles.endButton} onClick={() => { audio.fadeOut(.6); setEndAt(null); setPhase('ready'); setMessage(''); }}><Moon size={20} fill="currentColor" strokeWidth={1.5} aria-hidden="true" />수면 모드 종료</button>
        : <button type="button" className={styles.runButton} onClick={run}><Moon size={20} fill="currentColor" strokeWidth={1.5} aria-hidden="true" />수면 모드 실행</button>}
      <p className={styles.message} role="status">{running ? '' : message}</p>
      {running && sound.status === 'unavailable' && <p className={styles.message} role="alert">이 브라우저에서는 소리를 재생할 수 없어요. 무드등과 타이머만 동작해요.</p>}
      {running && sound.asmrFailed && settings.sounds.includes('MALANGI') && <p className={styles.message} role="alert">말랑이 ASMR 소리를 불러오지 못했어요. 다른 사운드는 계속 재생돼요.</p>}
      {running && sound.trackFailed && <p className={styles.message} role="alert">일부 수면 음원을 재생하지 못했어요. 다시 실행해 주세요.</p>}
    </div>
    <SleepPanel open={panel} hidden={running || phase === 'off'} onOpen={openPanel} onClose={()=>setPanel(false)}>
      <SleepSettings settings={settings} notice={state.notice} noticeSeq={state.noticeSeq} dispatch={dispatch} />
    </SleepPanel>
    {chatOpen && <ChatEntrySheet id="sleep-chat-entry" entry={entry} onClose={()=>setChatOpen(false)} />}
    {phase === 'off' && <button ref={offButton} type="button" className={styles.off} onClick={() => { setPhase('ready'); setMessage('타이머가 끝나 수면 모드를 마쳤어요.'); }}>
      <span>화면을 누르면 돌아가요</span>
    </button>}
  </main>;
}
