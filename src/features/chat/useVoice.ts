import { useEffect, useRef, useState } from 'react';

interface RecognitionResult { isFinal: boolean; 0: { transcript: string } }
interface Recognition {
  lang: string; interimResults: boolean; continuous: boolean;
  onstart: (() => void) | null;
  onresult: ((event: { results: ArrayLike<RecognitionResult> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; abort(): void;
}
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
const recognitionConstructor = () => (window as SpeechWindow).SpeechRecognition ?? (window as SpeechWindow).webkitSpeechRecognition;

/** Browser speech adapter. Interim text is UI-only; only a final utterance enters the conversation. */
export function useVoice({ ready, reply, onFinal, onDraft }: {
  ready: boolean; reply: { id: string; text: string } | undefined;
  onFinal: (text: string) => void; onDraft: (text: string) => void;
}) {
  const [active, setActive] = useState(false);
  const [muted, setMuted] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [readAloud, setReadAloud] = useState(true);
  const [cycle, setCycle] = useState(0);
  const engine = useRef<Recognition | null>(null);
  const live = useRef('');
  const callbacks = useRef({ onFinal, onDraft }); callbacks.current = { onFinal, onDraft };
  const spoken = useRef<string | undefined>(undefined);
  const generation = useRef(0);
  const emptyEnds = useRef(0);
  const startedAt = useRef<number | null>(null);
  const supported = !!recognitionConstructor();
  // This render is about to start TTS; do not briefly start a microphone using stale speaking state.
  const awaitingSpeech = active && readAloud && !!reply && spoken.current !== reply.id
    && !!window.speechSynthesis && typeof SpeechSynthesisUtterance !== 'undefined';
  function cancelCapture(preserve = false) {
    const current = engine.current; engine.current = null;
    if (current) { current.onstart = null; current.onresult = null; current.onerror = null; current.onend = null; current.abort(); }
    if (preserve && live.current.trim()) callbacks.current.onDraft(live.current.trim());
    live.current = ''; setInterim(''); setListening(false);
  }
  function cancelSpeech() { generation.current++; window.speechSynthesis?.cancel(); setSpeaking(false); }
  function stop() { cancelCapture(true); cancelSpeech(); setActive(false); setMuted(false); }
  function start() {
    setError('');
    if (!supported) { setError('이 브라우저에서는 음성 인식을 사용할 수 없어요. 글로 이야기를 이어가 주세요.'); return; }
    if (!window.isSecureContext) { setError('음성 대화는 보안 연결(HTTPS)에서 사용할 수 있어요.'); return; }
    emptyEnds.current = 0; spoken.current = reply?.id; startedAt.current = null; setElapsed(0); setMuted(false); setActive(true);
  }
  function toggleMute() { if (!muted) cancelCapture(true); setMuted(!muted); }
  useEffect(() => {
    if (!active || error) return;
    const timer = window.setInterval(() => { if (startedAt.current !== null) setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)); }, 1000);
    const hidden = () => { if (document.hidden) stop(); };
    document.addEventListener('visibilitychange', hidden);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', hidden); };
  }, [active, error]);
  useEffect(() => {
    if (!active || !readAloud || !reply || spoken.current === reply.id) return;
    spoken.current = reply.id;
    if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') return;
    cancelCapture(); cancelSpeech();
    const token = generation.current;
    const utterance = new SpeechSynthesisUtterance(reply.text);
    utterance.lang = 'ko-KR'; utterance.rate = 0.94;
    const voice = window.speechSynthesis.getVoices().find(item => item.lang.startsWith('ko'));
    if (voice) utterance.voice = voice;
    utterance.onend = utterance.onerror = () => { if (generation.current === token) setSpeaking(false); };
    setSpeaking(true); window.speechSynthesis.speak(utterance);
    return () => { generation.current++; window.speechSynthesis?.cancel(); };
  }, [active, readAloud, reply?.id]);
  useEffect(() => {
    if (!active || muted || speaking || awaitingSpeech || !ready || error) return;
    const Constructor = recognitionConstructor(); if (!Constructor) return;
    const recognition = new Constructor(); engine.current = recognition;
    let finished = false; let failed = false; let timer: ReturnType<typeof setTimeout> | undefined;
    const connectionTimer = setTimeout(() => {
      if (engine.current !== recognition) return;
      failed = true; setError('음성 인식 서비스가 응답하지 않아요. 다시 시도하거나 채팅으로 이어가 주세요.'); cancelCapture(true);
    }, 10000);
    recognition.lang = 'ko-KR'; recognition.interimResults = true; recognition.continuous = false;
    recognition.onstart = () => { if (engine.current === recognition) { clearTimeout(connectionTimer); startedAt.current ??= Date.now(); setListening(true); } };
    recognition.onresult = event => {
      if (finished || engine.current !== recognition) return;
      const results = Array.from(event.results);
      const text = results.map(item => item[0].transcript).join(' ').trim();
      if (text) emptyEnds.current = 0;
      live.current = text; setInterim(text);
      if (text.length > 2000) {
        failed = true; setError('이야기가 길어졌어요. 채팅에서 내용을 나누어 보내 주세요.'); cancelCapture(true); return;
      }
      if (text && results.every(item => item.isFinal)) {
        finished = true;
        cancelCapture(); callbacks.current.onFinal(text);
      }
    };
    recognition.onerror = event => {
      if (engine.current !== recognition || event.error === 'aborted') return;
      failed = true; clearTimeout(connectionTimer);
      const messages: Record<string, string> = {
        'not-allowed': '마이크 사용이 허용되지 않았어요. 브라우저의 마이크 권한을 확인해 주세요.',
        'service-not-allowed': '브라우저에서 음성 인식 서비스를 사용할 수 없어요. 글로 이어가 주세요.',
        'audio-capture': '마이크를 찾을 수 없어요. 연결 상태를 확인해 주세요.',
        'network': '브라우저의 음성 인식 서비스에 연결하지 못했어요. 다시 시도하거나 채팅으로 이어가 주세요.',
        'no-speech': '목소리가 들리지 않았어요. 준비되면 다시 시작해 주세요.',
      };
      setError(messages[event.error] ?? '음성을 인식하지 못했어요. 다시 시도하거나 글로 이어가 주세요.');
      cancelCapture(true);
    };
    recognition.onend = () => {
      if (engine.current !== recognition) return;
      cancelCapture(true);
      if (!finished && !failed) {
        emptyEnds.current++;
        if (emptyEnds.current >= 2) setError('음성 인식이 중단됐어요. 다시 시도하거나 채팅으로 이어가 주세요.');
        else timer = setTimeout(() => setCycle(value => value + 1), 400);
      }
    };
    try { recognition.start(); } catch { setError('마이크를 시작하지 못했어요. 다시 시도해 주세요.'); cancelCapture(); }
    return () => { clearTimeout(connectionTimer); clearTimeout(timer); if (engine.current === recognition) cancelCapture(true); };
  }, [active, muted, speaking, awaitingSpeech, ready, error, cycle]);
  useEffect(() => () => { cancelCapture(); generation.current++; window.speechSynthesis?.cancel(); }, []);
  return { active, muted, listening, speaking, interim, error, elapsed, readAloud, supported, start, stop, toggleMute,
    retry: () => { emptyEnds.current = 0; startedAt.current = null; setElapsed(0); setError(''); setCycle(value => value + 1); },
    dismissError: () => setError(''),
    setReadAloud: (value: boolean) => { setReadAloud(value); if (!value) cancelSpeech(); },
  };
}
