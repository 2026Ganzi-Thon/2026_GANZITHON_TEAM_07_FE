import { ArrowLeft, MessageSquare, Mic, MicOff, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { DESIGN_ASSETS } from '../../lib/assets';
import type { useVoice } from './useVoice';
import styles from './VoiceView.module.css';

export function VoiceView({ voice, status, onChat }: { voice: ReturnType<typeof useVoice>; status: string; onChat: () => void }) {
  const back = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    back.current?.focus();
    return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, []);
  const time = `${String(Math.floor(voice.elapsed / 60)).padStart(2, '0')}:${String(voice.elapsed % 60).padStart(2, '0')}`;
  return <section className={styles.view} aria-label="음성 대화" onKeyDown={event => { if (event.key === 'Escape') onChat(); }}>
    <button ref={back} className={styles.back} onClick={onChat} aria-label="음성 대화 중 채팅 보기"><ArrowLeft size={22} strokeWidth={1.6} /></button>
    <img className={styles.statue} src={DESIGN_ASSETS.socratesWithToy} width={471} height={707} alt="말랑이를 안고 있는 테스" />
    <div className={styles.panel}>
      <time className={styles.time} aria-label="음성 대화 시간">{time}</time>
      <p role="status">{status}</p>
      {voice.interim && <p className={styles.transcript} aria-label="인식 중인 이야기">{voice.interim}</p>}
      {voice.error && <div className={styles.error} role="alert"><p>{voice.error}</p><button onClick={voice.retry}>다시 시도하기</button><button onClick={() => { voice.stop(); voice.dismissError(); onChat(); }}>글로 계속하기</button></div>}
      <div className={styles.controls}>
        <button onClick={voice.stop} aria-label="음성 대화 중단"><X size={27} strokeWidth={1.5} /></button>
        <button className={styles.microphone} onClick={voice.toggleMute} aria-label={voice.muted ? '마이크 켜기' : '마이크 음소거'} aria-pressed={voice.muted}>{voice.muted ? <MicOff size={36} strokeWidth={1.5} /> : <Mic size={36} strokeWidth={1.5} />}</button>
        <button onClick={onChat} aria-label="음성 대화 중 채팅 보기"><MessageSquare size={24} strokeWidth={1.5} /></button>
      </div>
    </div>
  </section>;
}
