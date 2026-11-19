import { useCallback, useEffect, useReducer, useRef, useState, useSyncExternalStore } from 'react';
import type { CSSProperties } from 'react';
import { Moon, Settings } from 'lucide-react';
import { Page } from '../../components/Page';
import { BottomSheet } from '../../components/BottomSheet';
import { IconButton } from '../../components/ui';
import { DESIGN_ASSETS } from '../../lib/assets';
import { formatRemaining, initialSleepState, remainingSeconds, sleepReducer, sleepSummary } from './model';
import type { SleepAction } from './model';
import { SleepAudio } from './sleepAudio';
import { SleepSettings } from './SleepSettings';
import styles from './Sleep.module.css';

type Phase = 'ready' | 'running' | 'off';
const PULL_OPEN = 64; // px of upward drag needed to open the settings sheet
const PULL_MAX = 220;

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
  const drag = useRef<{ id: number; y: number } | null>(null);
  const [pull, setPull] = useState(0);
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
  return <Page title="수면모드" titlePlacement={running ? 'hidden' : 'header'} className={`${styles.page} ${running ? styles.running : ''}`}
    action={<IconButton label="수면 설정 열기" aria-haspopup="dialog" aria-expanded={panel} onClick={openPanel}><Settings size={26} strokeWidth={1.8} /></IconButton>}>
    <div className={styles.stage} style={{ '--mood': settings.brightness / 100 } as CSSProperties}>
      <div className={styles.sheepWrap}>
        <span className={styles.lamp} aria-hidden="true" />
        <img className={styles.sheep} src={DESIGN_ASSETS.sleepSticker} width={1536} height={1024} decoding="async" fetchPriority="high" alt="수면 모자를 쓰고 잠든 양" />
      </div>
      {!running && <p className={styles.summary}>{sleepSummary(settings)}</p>}
      {running
        ? <button type="button" className={styles.endButton} onClick={() => stop('수면 모드를 종료했어요.')}><Moon size={20} fill="currentColor" strokeWidth={1.5} aria-hidden="true" />수면 모드 종료</button>
        : <button type="button" className={styles.runButton} onClick={run}><Moon size={20} fill="currentColor" strokeWidth={1.5} aria-hidden="true" />수면 모드 실행</button>}
      <p className={styles.message} role="status">{running ? '' : message}</p>
      {/* Figma shows no visible countdown; keep it readable for assistive tech without per-second announcements. */}
      {running && <p className={styles.srOnly} data-testid="sleep-remaining">남은 시간 {formatRemaining(left)}</p>}
      {running && sound.status === 'unavailable' && <p className={styles.message} role="alert">이 브라우저에서는 소리를 재생할 수 없어요. 무드등과 타이머만 동작해요.</p>}
      {running && sound.asmrFailed && settings.sounds.includes('MALANGI') && <p className={styles.message} role="alert">말랑이 ASMR 소리를 불러오지 못했어요. 다른 사운드는 계속 재생돼요.</p>}
      {running && sound.trackFailed && <p className={styles.message} role="alert">일부 수면 음원을 불러오지 못해 대체 소리로 재생하고 있어요.</p>}
    </div>
    {/* Pull-up handle: the sheet follows the finger and opens only after a real upward drag.
        A plain tap does nothing; keyboard activation (detail 0) still opens it, and the header gear is the tap alternative. */}
    {!running && <button type="button" className={`${styles.peek} ${pull ? styles.pulling : ''}`} aria-label="수면 설정 열기" aria-haspopup="dialog" aria-description="위로 끌어올려 설정을 열어요"
      style={{ '--pull': `${pull}px` } as CSSProperties}
      onPointerDown={event => { if (!event.isPrimary || event.button !== 0) return; drag.current = { id: event.pointerId, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerMove={event => { if (drag.current?.id === event.pointerId) setPull(Math.max(0, Math.min(PULL_MAX, drag.current.y - event.clientY))); }}
      onPointerUp={event => {
        if (drag.current?.id !== event.pointerId) return;
        const distance = drag.current.y - event.clientY; drag.current = null; setPull(0);
        if (distance >= PULL_OPEN) { event.currentTarget.focus(); openPanel(); }
      }}
      onPointerCancel={() => { drag.current = null; setPull(0); }} onLostPointerCapture={() => { drag.current = null; setPull(0); }}
      onClick={event => { if (event.detail === 0) openPanel(); }}>
      <span aria-hidden="true" />
    </button>}
    {panel && <BottomSheet id="sleep-settings" title="수면 설정" closeLabel="수면 설정 닫기" className={styles.panel} onClose={() => setPanel(false)}>
      <SleepSettings settings={settings} notice={state.notice} noticeSeq={state.noticeSeq} dispatch={dispatch} />
    </BottomSheet>}
    {phase === 'off' && <button ref={offButton} type="button" className={styles.off} onClick={() => { setPhase('ready'); setMessage('타이머가 끝나 수면 모드를 마쳤어요.'); }}>
      <span>화면을 누르면 돌아가요</span>
    </button>}
  </Page>;
}
