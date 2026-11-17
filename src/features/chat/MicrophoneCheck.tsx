import { useEffect, useRef, useState } from 'react';

/** Local input-level check only. No recording, storage, playback or upload. */
export function MicrophoneCheck() {
  const [status, setStatus] = useState('');
  const [checking, setChecking] = useState(false);
  const [level, setLevel] = useState(0);
  const cancel = useRef<() => void>(() => {});
  useEffect(() => {
    const hidden = () => { if (document.hidden) { cancel.current(); setChecking(false); setLevel(0); } };
    document.addEventListener('visibilitychange', hidden);
    return () => { cancel.current(); document.removeEventListener('visibilitychange', hidden); };
  }, []);
  async function check() {
    cancel.current(); setChecking(true); setLevel(0); setStatus('마이크 권한을 확인하고 있어요.');
    let cancelled = false, stream: MediaStream | undefined, context: AudioContext | undefined;
    let timer: ReturnType<typeof setInterval> | undefined, deadline: ReturnType<typeof setTimeout> | undefined;
    const stop = () => { cancelled = true; clearInterval(timer); clearTimeout(deadline); stream?.getTracks().forEach(track => track.stop()); void context?.close().catch(() => {}); };
    cancel.current = stop;
    deadline = setTimeout(() => { stop(); setChecking(false); setLevel(0); setStatus('마이크 확인 시간이 지났어요. 권한을 확인한 뒤 다시 시도해 주세요.'); }, 15000);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new DOMException('', 'NotSupportedError');
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (cancelled) { stream.getTracks().forEach(track => track.stop()); return; }
      context = new AudioContext(); await context.resume();
      if (cancelled) return;
      const analyser = context.createAnalyser(); analyser.fftSize = 1024;
      context.createMediaStreamSource(stream).connect(analyser);
      const data = new Float32Array(analyser.fftSize); let peak = 0, ticks = 0;
      setStatus('짧게 말해보세요. 입력 크기만 확인하며 녹음하거나 전송하지 않아요.');
      timer = setInterval(() => {
        analyser.getFloatTimeDomainData(data);
        const rms = Math.sqrt(data.reduce((sum, value) => sum + value * value, 0) / data.length);
        peak = Math.max(peak, rms); setLevel(Math.min(100, Math.round(rms * 1000)));
        if (++ticks >= 60) {
          stop(); setChecking(false); setLevel(0);
          setStatus(peak > .008 ? '마이크 소리가 들어와요. 전사가 안 되면 음성 인식 서비스 연결을 확인해야 해요.' : '마이크는 연결됐지만 소리가 작아요. 입력 장치와 음소거 상태를 확인해 주세요.');
        }
      }, 100);
    } catch (error) {
      if (cancelled) return;
      stop(); setChecking(false); setLevel(0);
      const name = error instanceof DOMException ? error.name : '';
      setStatus(name === 'NotAllowedError' ? '마이크 권한이 꺼져 있어요. 브라우저 설정에서 허용해 주세요.' : name === 'NotFoundError' ? '연결된 마이크가 없어요.' : '마이크를 열지 못했어요. 다른 앱의 사용 여부와 브라우저 설정을 확인해 주세요.');
    }
  }
  return <div>
    <button type="button" onClick={checking ? () => { cancel.current(); setChecking(false); setLevel(0); setStatus('마이크 확인을 멈췄어요.'); } : check}>{checking ? '마이크 확인 중단' : '마이크 확인하기'}</button>
    {checking && <meter aria-label="마이크 입력 크기" min={0} max={100} value={level} style={{ display: 'block', width: '100%', margin: '8px 0' }} />}
    {status && <p role="status">{status}</p>}
  </div>;
}
