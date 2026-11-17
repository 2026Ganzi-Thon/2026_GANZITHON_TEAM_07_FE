import type { ToyType } from '../../lib/domain';

type SoundState = { enabled: boolean; volume: number; status: 'idle' | 'loading' | 'ready' | 'fallback' | 'unavailable' };
const FILES: Record<ToyType, string[]> = {
  SLANGI: ['slime-1', 'slime-2', 'slime-3'],
  SQUISHY: ['foam-1', 'foam-2', 'foam-3'],
  WAKPPU: ['crack-1', 'crack-2', 'crack-3'],
};
/** Local CC0 samples; one context, bounded voices, no autoplay or browser storage. */
export class TactileAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private voices = new Set<{ source: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode }>();
  private listeners = new Set<() => void>();
  private state: SoundState = { enabled: false, volume: .35, status: 'idle' };
  private loading: Promise<void> | null = null;
  private controller: AbortController | null = null;
  private sequence = 0;
  private lastPlayed = -Infinity;
  private noise: AudioBuffer | null = null;
  private disposed = false;
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<SoundState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener()); }
  async setEnabled(enabled: boolean) {
    if (this.disposed) return;
    this.update({ enabled });
    if (!enabled) { this.stop(); return; }
    try {
      if (!this.context) {
        const Constructor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Constructor) throw new Error('Audio unavailable');
        this.context = new Constructor(); this.master = this.context.createGain(); this.master.gain.value = this.state.volume * .65; this.master.connect(this.context.destination);
      }
      await this.context.resume();
      if (!this.state.enabled || this.disposed) return;
      if (!this.loading && this.buffers.size < Object.values(FILES).flat().length) this.loading = this.load();
      const pending = this.loading;
      await pending;
      if (this.loading === pending) this.loading = null;
    } catch { if (!this.disposed) this.update({ enabled: false, status: 'unavailable' }); }
  }
  private async load() {
    this.update({ status: 'loading' }); this.controller = new AbortController();
    const timeout = setTimeout(() => this.controller?.abort(), 8000);
    const names = Object.values(FILES).flat();
    try {
      await Promise.all(names.map(async name => {
        if (this.buffers.has(name)) return;
        try {
          const response = await fetch(`/assets/audio/${name}.wav`, { signal: this.controller!.signal });
          if (!response.ok) return;
          const buffer = await this.context!.decodeAudioData(await response.arrayBuffer());
          if (!this.disposed) this.buffers.set(name, buffer);
        } catch { /* Interaction still works with a short synthesized fallback. */ }
      }));
      if (!this.disposed) this.update({ status: this.buffers.size === names.length ? 'ready' : 'fallback' });
    } finally { clearTimeout(timeout); }
  }
  setVolume(volume: number) {
    const safe = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0;
    this.update({ volume: safe });
    if (this.master && this.context) this.master.gain.setTargetAtTime(safe * .65, this.context.currentTime, .015);
    if (!safe) this.stop();
  }
  play(type: ToyType, strength = .7, drag = false) {
    const context = this.context;
    if (!context || !this.master || !this.state.enabled || !this.state.volume || document.hidden || this.disposed) return;
    // This call originates in pointer/keyboard events, allowing resume after a background interruption.
    if (context.state !== 'running') { void context.resume().catch(() => this.update({ enabled: false, status: 'unavailable' })); return; }
    const now = context.currentTime;
    if (now - this.lastPlayed < (drag ? .14 : .045)) return;
    this.lastPlayed = now;
    if (this.voices.size >= 4) this.endVoice(this.voices.values().next().value!);
    const names = FILES[type]; const name = names[this.sequence++ % names.length];
    const sample = this.buffers.get(name);
    if (!sample && !this.noise) {
      this.noise = context.createBuffer(1, Math.ceil(context.sampleRate * .22), context.sampleRate);
      const data = this.noise.getChannelData(0); let previous = 0;
      for (let i = 0; i < data.length; i++) { previous = (previous + (Math.random() * 2 - 1) * .16) / 1.16; data[i] = previous; }
    }
    const source = context.createBufferSource(); source.buffer = sample ?? this.noise;
    source.playbackRate.value = drag ? .86 : .95 + (this.sequence % 3) * .045;
    const gain = context.createGain(), filter = context.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = type === 'WAKPPU' ? 5400 : type === 'SQUISHY' ? 2600 : 3800;
    const duration = Math.min(source.buffer!.duration / source.playbackRate.value, drag ? .23 : .8);
    const peak = Math.max(.03, Math.min(.75, strength * (drag ? .28 : .66)));
    gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(peak, now + .012);
    gain.gain.setValueAtTime(peak, now + Math.max(.015, duration - .06)); gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    source.connect(filter); filter.connect(gain); gain.connect(this.master);
    const voice = { source, filter, gain }; this.voices.add(voice);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); this.voices.delete(voice); };
    source.start(now); source.stop(now + duration + .01);
  }
  private endVoice(voice: { source: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode }) {
    if (!this.context) return;
    const now = this.context.currentTime;
    voice.gain.gain.cancelScheduledValues(now); voice.gain.gain.setTargetAtTime(.0001, now, .005);
    try { voice.source.stop(now + .025); } catch { /* An already-ended voice is harmless. */ }
    this.voices.delete(voice);
  }
  stop() { [...this.voices].forEach(voice => this.endVoice(voice)); this.lastPlayed = -Infinity; }
  dispose() { this.disposed = true; this.controller?.abort(); this.stop(); void this.context?.close().catch(() => {}); this.buffers.clear(); this.listeners.clear(); }
}
