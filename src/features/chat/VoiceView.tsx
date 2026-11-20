import { MicrophoneCheck } from './MicrophoneCheck';
import { ArrowLeft, Info, Mic, MicOff, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { DESIGN_ASSETS } from '../../lib/assets';
import type { useVoice } from './useVoice';
import styles from './VoiceView.module.css';

export function VoiceView({ voice, status, draft, onChat, onInfo }: { voice: ReturnType<typeof useVoice>; status: string; draft: string; onChat: () => void; onInfo: () => void }) {
  const back = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    back.current?.focus();
    return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, []);
  const time = `${String(Math.floor(voice.elapsed / 60)).padStart(2, '0')}:${String(voice.elapsed % 60).padStart(2, '0')}`;
  return <section className={styles.view} aria-label="음성 대화" onKeyDown={event => { if (event.key === 'Escape') onChat(); }}>
    <button ref={back} className={styles.back} onClick={onChat} aria-label="음성 대화 중 채팅 보기"><ArrowLeft size={22} strokeWidth={1.6} /></button>
    <button className={`${styles.back} ${styles.info}`} onClick={event => { event.currentTarget.focus({ preventScroll: true }); onInfo(); }} aria-label="음성 입력 안내"><Info size={22} strokeWidth={1.6} /></button>
    <img className={styles.statue} src={DESIGN_ASSETS.voiceStatue} width={402} height={682} alt="말랑이를 안고 있는 테스" />
    <div className={styles.panel}>
      <div className={styles.heading}>
        <time className={styles.time} aria-label="음성 대화 시간">{time}</time>
        <p role="status">{status}</p>
      </div>
      <div className={styles.content}>
        {!voice.error && (draft
          ? <div><p className={styles.transcript} aria-label="전사된 이야기">{draft}</p><p className={styles.hint}>채팅에서 확인하고 보내주세요.</p></div>
          : <p className={styles.hint}>{voice.muted ? '마이크를 켜면 다시 말할 수 있어요.' : '말한 내용을 채팅에서 확인한 뒤 보내주세요.'}</p>)}
        {voice.error && <div className={styles.error} role="alert"><p>{voice.error}</p><MicrophoneCheck /><button onClick={voice.retry}>다시 시도하기</button><button onClick={() => { voice.stop(); voice.dismissError(); onChat(); }}>글로 계속하기</button></div>}
      </div>
      <div className={styles.controls}>
        <button onClick={voice.stop} aria-label="음성 대화 중단"><X size={27} strokeWidth={1.5} /></button>
        <button className={styles.microphone} onClick={voice.toggleMute} aria-label={voice.muted ? '마이크 켜기' : '마이크 음소거'} aria-pressed={voice.muted}>{voice.muted ? <MicOff size={36} strokeWidth={1.5} /> : <Mic size={36} strokeWidth={1.5} />}</button>
        <button onClick={onChat} aria-label="음성 대화 중 채팅 보기"><img src={DESIGN_ASSETS.voiceChatIcon} width={29} height={28} alt="" /></button>
      </div>
    </div>
  </section>;
}
