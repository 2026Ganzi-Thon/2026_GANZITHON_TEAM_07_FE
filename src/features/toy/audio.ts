import type { ToyType } from '../../lib/domain';
import { waxFracture } from './waxSound';

type SoundState = { enabled: boolean; volume: number; status: 'idle' | 'loading' | 'ready' | 'fallback' | 'unavailable' };
const FILES: Record<ToyType, string[]> = {
  SLANGI: ['slime-1', 'slime-2', 'slime-3'],
  SQUISHY: ['foam-1', 'foam-2', 'foam-3'],
  WAKPPU: [],
};
const RELEASE = ['foam-release-1', 'foam-release-2', 'foam-release-3'];
const BUBBLES = ['bubble-1', 'bubble-2', 'bubble-3'];
const ALL_FILES = [...Object.values(FILES).flat(), ...RELEASE, ...BUBBLES];
/** Local CC0 soft samples and original wax synthesis; bounded voices, no autoplay. */
export class TactileAudio {
  constructor(private readonly reference = import.meta.env.VITE_LOCAL_WAX_REFERENCE === 'true' && ['127.0.0.1', 'localhost', '[::1]'].includes(window.location?.hostname ?? '')) {}
  private get files() { return this.reference ? [...ALL_FILES, 'local-wax-1', 'local-wax-2', 'local-wax-3'] : ALL_FILES; }
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private voices = new Set<{ source: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode }>();
  private listeners = new Set<() => void>();
  private state: SoundState = { enabled: true, volume: .35, status: 'idle' };
  private loading: Promise<void> | null = null;
  private controller: AbortController | null = null;
  private sequence = 0;
  private lastSample = new Map<string, number>();
  private lastPlayed = -Infinity;
  private noise: AudioBuffer | null = null;
  private disposed = false;
  private recoveryTimer: ReturnType<typeof setTimeout> | null = null;
  private waxHoldTimer: ReturnType<typeof setTimeout> | null = null;
  /** Called only after a real press. Samples overlap slightly rather than restarting every frame. */
  startWaxHold(contact: () => boolean) {
    this.stopWaxHold();
    if (!this.state.enabled || !this.state.volume || document.hidden || this.disposed) return;
    const tick = () => {
      this.waxHoldTimer = null;
      if (!this.state.enabled || !this.state.volume || document.hidden || this.disposed) return;
      if (contact()) this.play('WAKPPU', .62, false, false, true);
      this.waxHoldTimer = setTimeout(tick, 520);
    };
    this.waxHoldTimer = setTimeout(tick, 520);
  }
  private stopWaxHold() { if (this.waxHoldTimer !== null) clearTimeout(this.waxHoldTimer); this.waxHoldTimer = null; }
  cancelRecovery() { if (this.recoveryTimer !== null) clearTimeout(this.recoveryTimer); this.recoveryTimer = null; }
  playRecovery(strength: number, delay: number) {
    this.cancelRecovery();
    if (!this.context || !this.state.enabled || !this.state.volume || document.hidden || this.disposed) return;
    this.recoveryTimer = setTimeout(() => {
      this.recoveryTimer = null;
      this.play('SQUISHY', strength, false, true);
    }, delay);
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<SoundState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener()); }
  async setEnabled(enabled: boolean) {
    if (this.disposed) return;
    this.update({ enabled });
    if (!enabled) { this.stop(); return; }
    await this.activate();
    await this.loading;
  }
  private ensureContext() {
    try {
      if (!this.context) {
        const Constructor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Constructor) throw new Error('Audio unavailable');
        this.context = new Constructor(); this.master = this.context.createGain(); this.master.gain.value = this.state.volume * .65; this.master.connect(this.context.destination);
      }
      return true;
    } catch { if (!this.disposed) this.update({ enabled: false, status: 'unavailable' }); return false; }
  }
  /** Only called from a user gesture; default ON never starts audio on mount. */
  private async activate() {
    if (!this.ensureContext()) return;
    try {
      const resume = this.context!.resume();
      if (!this.loading && this.buffers.size < this.files.length) this.loading = this.load();
      await resume;
    } catch { if (!this.disposed) { this.stop(); this.update({ enabled: false, status: 'unavailable' }); } }
  }
  private async load() {
    this.update({ status: 'loading' }); this.controller = new AbortController();
    const timeout = setTimeout(() => this.controller?.abort(), 8000);
    const names = this.files;
    try {
      await Promise.all(names.map(async name => {
        if (this.buffers.has(name)) return;
        try {
          const response = await fetch(name.startsWith('local-wax-') ? `/__local-wax__/crunch-${name.at(-1)}.wav` : `/assets/audio/${name}.wav`, { signal: this.controller!.signal });
          if (!response.ok) return;
          const buffer = await this.context!.decodeAudioData(await response.arrayBuffer());
          if (!this.disposed) this.buffers.set(name, buffer);
        } catch { /* Interaction still works with a short synthesized fallback. */ }
      }));
      if (!this.disposed) this.update({ status: this.buffers.size === names.length ? 'ready' : 'fallback' });
    } finally { clearTimeout(timeout); this.loading = null; }
  }
  setVolume(volume: number) {
    const safe = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0;
    this.update({ volume: safe });
    if (this.master && this.context) this.master.gain.setTargetAtTime(safe * .65, this.context.currentTime, .015);
    if (!safe) this.stop();
  }
  play(type: ToyType, strength = .7, drag = false, recovery = false, reference = false) {
    if (!recovery) this.cancelRecovery();
    if (!this.state.enabled || !this.state.volume || document.hidden || this.disposed) return;
    const first = !this.context;
    if (!this.ensureContext()) return;
    const context = this.context!;
    // Schedule on the audio clock immediately, even while resume is pending.
    // There is no delayed JS replay; mute/exit can cancel the queued source itself.
    if (first || context.state !== 'running') {
      if (context.state !== 'running') this.stop();
      void this.activate();
    }
    if (!this.master) return;
    const now = context.currentTime;
    if (!recovery && now - this.lastPlayed < (drag ? .14 : .045)) return;
    this.lastPlayed = now;
    if (this.voices.size >= 4) this.endVoice(this.voices.values().next().value!);
    // Slow slime motion stays sticky; a fast pull occasionally produces one small bubble.
    const useReference = this.reference && reference && type === 'WAKPPU';
    const names = useReference ? ['local-wax-1', 'local-wax-2', 'local-wax-3'] : recovery ? RELEASE : type === 'SLANGI' && drag && strength > .65 && this.sequence % 3 === 0 ? BUBBLES : FILES[type];
    const fracture = type === 'WAKPPU' && !recovery;
    const key = names[0] ?? 'wax-synthesis', previous = this.lastSample.get(key) ?? -1;
    const index = names.length ? (previous + 1 + Math.floor(Math.random() * (names.length - 1))) % names.length : 0;
    this.lastSample.set(key, index); this.sequence++;
    const name = names[index];
    let sample = this.buffers.get(name);
    const recorded = useReference && !!sample;
    if (fracture && !recorded) {
      const pcm = waxFracture(context.sampleRate, strength);
      sample = context.createBuffer(1, pcm.length, context.sampleRate);
      sample.getChannelData(0).set(pcm);
    }
    if (!sample && !this.noise) {
      this.noise = context.createBuffer(1, Math.ceil(context.sampleRate * .22), context.sampleRate);
      const data = this.noise.getChannelData(0); let previous = 0;
      for (let i = 0; i < data.length; i++) { previous = (previous + (Math.random() * 2 - 1) * .16) / 1.16; data[i] = previous; }
    }
    const source = context.createBufferSource(); source.buffer = sample ?? this.noise;
    source.playbackRate.value = recorded || recovery ? 1 : drag ? .78 + Math.min(1, strength) * .28 : .94 + Math.random() * .09;
    if (recovery) { source.playbackRate.setValueAtTime(1, now); source.playbackRate.exponentialRampToValueAtTime(1.18, now + .24); }
    const gain = context.createGain(), filter = context.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = recorded ? 16000 : type === 'WAKPPU' ? 5400 : type === 'SQUISHY' ? (recovery ? 1900 : 2300) : 3800;
    const duration = Math.min(source.buffer!.duration / (recovery ? 1.18 : source.playbackRate.value), recorded ? 1.2 : recovery ? .58 : drag ? .30 : .8);
    const peak = Math.max(.03, Math.min(.75, strength * (recovery ? .38 : drag ? .28 : .66)));
    gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(peak, now + (fracture ? .001 : recovery ? Math.min(.06, duration / 3) : .012));
    gain.gain.setValueAtTime(peak, now + Math.max(.015, duration - .06)); gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    source.connect(filter); filter.connect(gain); gain.connect(this.master);
    const voice = { source, filter, gain }; this.voices.add(voice);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); this.voices.delete(voice); };
    source.start(now); source.stop(now + duration + .01);
  }
  private endVoice(voice: { source: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode }) {
    if (!this.context) return;
    if (this.context.state !== 'running') {
      try { voice.source.stop(); } catch { /* Already stopped. */ }
      voice.gain.disconnect(); this.voices.delete(voice); return;
    }
    const now = this.context.currentTime;
    voice.gain.gain.cancelScheduledValues(now); voice.gain.gain.setTargetAtTime(.0001, now, .005);
    try { voice.source.stop(now + .025); } catch { /* An already-ended voice is harmless. */ }
    this.voices.delete(voice);
  }
  stop() { this.stopWaxHold(); this.cancelRecovery(); [...this.voices].forEach(voice => this.endVoice(voice)); this.lastPlayed = -Infinity; }
  dispose() { this.disposed = true; this.controller?.abort(); this.stop(); void this.context?.close().catch(() => {}); this.buffers.clear(); this.listeners.clear(); }
}
