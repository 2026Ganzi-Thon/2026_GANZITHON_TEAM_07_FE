import { AudioWaveform, CloudRain, Hand, Leaf, Moon, Music, Sun } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { CSSProperties, Dispatch } from 'react';
import { MAX_SLEEP_SOUNDS, SLEEP_SOUNDS, SLEEP_TIMERS, timerLabel } from './model';
import type { SleepAction, SleepNotice, SleepSettings as Settings, SleepSound } from './model';
import styles from './Sleep.module.css';

const ICONS: Record<SleepSound, typeof Moon> = { WHITE: AudioWaveform, RAIN: CloudRain, NATURE: Leaf, MALANGI: Hand, MUSIC: Music };
const NOTICES: Record<Exclude<SleepNotice, null>, string> = {
  limit: `사운드는 최대 ${MAX_SLEEP_SOUNDS}개까지 고를 수 있어요.`,
  unavailable: '수면 유도 음악은 음원이 준비되면 들을 수 있어요.',
};

/** A subtle side-to-side nudge of the whole panel signals "not allowed"; skipped for reduced motion. */
const SHAKE: Keyframe[] = [0, -4, 3, -2, 1, 0].map(x => ({ transform: `translateX(${x}px)` }));

export function SleepSettings({ settings, notice, noticeSeq, dispatch }: { settings: Settings; notice: SleepNotice; noticeSeq: number; dispatch: Dispatch<SleepAction> }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (notice !== 'limit' || !noticeSeq) return;
    const target = root.current;
    if (!target || typeof target.animate !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const animation = target.animate(SHAKE, { duration: 240, easing: 'ease-out' });
    return () => animation.cancel();
  }, [notice, noticeSeq]);
  return <div ref={root} className={styles.settings} data-shake={notice === 'limit' ? noticeSeq : undefined}>
    <section aria-labelledby="sleep-sound-title">
      <div className={styles.row}><h3 id="sleep-sound-title">수면 사운드</h3><span>{SLEEP_SOUNDS.length}가지 중 최대 {MAX_SLEEP_SOUNDS}개</span></div>
      <div className={styles.chips} role="group" aria-labelledby="sleep-sound-title">
        {SLEEP_SOUNDS.map(sound => {
          const Icon = ICONS[sound.id];
          return <button key={sound.id} type="button" className={styles.chip} aria-pressed={settings.sounds.includes(sound.id)} aria-disabled={!sound.available || undefined}
            onClick={() => dispatch({ type: 'toggleSound', sound: sound.id })}>
            {sound.id === 'WHITE' ? <img src="/assets/design/sleep-waves-icon.png" width={17} height={17} alt="" /> : <Icon size={17} strokeWidth={2} aria-hidden="true" />}{sound.label}{!sound.available && <small>준비 중</small>}
          </button>;
        })}
      </div>
      <p className={styles.notice} role="status">{notice ? NOTICES[notice] : ''}</p>
    </section>
    <section aria-labelledby="sleep-timer-title">
      <div className={styles.row}><h3 id="sleep-timer-title">타이머</h3><span>{timerLabel(settings.minutes)} 후 종료</span></div>
      <div className={styles.segments} role="group" aria-labelledby="sleep-timer-title">
        {SLEEP_TIMERS.map(minutes => <button key={minutes} type="button" aria-pressed={settings.minutes === minutes} onClick={() => dispatch({ type: 'setTimer', minutes })}>{timerLabel(minutes)}</button>)}
      </div>
      <p className={styles.hint}>타이머가 끝나면 사운드와 무드등이 함께 꺼져요</p>
    </section>
    <section aria-labelledby="sleep-light-title">
      <div className={styles.row}><h3 id="sleep-light-title">무드등 밝기</h3><output htmlFor="sleep-light">{settings.brightness}%</output></div>
      <div className={styles.range}>
        <Moon size={14} fill="currentColor" aria-hidden="true" />
        <input id="sleep-light" type="range" min={0} max={100} step={10} value={settings.brightness} aria-labelledby="sleep-light-title" aria-valuetext={`${settings.brightness}%`}
          style={{ '--fill': `${settings.brightness}%` } as CSSProperties} onChange={event => dispatch({ type: 'setBrightness', value: Number(event.target.value) })} />
        <Sun size={15} aria-hidden="true" />
      </div>
      <div className={styles.rangeLabels} aria-hidden="true"><span>은은하게</span><span>밝게</span></div>
    </section>
    <section className={styles.switchRow}>
      <div><h3 id="sleep-off-title">타이머 종료 후 화면 끄기</h3><p id="sleep-off-hint" className={styles.hint}>잠든 뒤 불빛이 남지 않도록 꺼져요</p></div>
      <button type="button" role="switch" className={styles.switch} aria-checked={settings.screenOff} aria-labelledby="sleep-off-title" aria-describedby="sleep-off-hint"
        onClick={() => dispatch({ type: 'setScreenOff', value: !settings.screenOff })}><span /></button>
    </section>
  </div>;
}
