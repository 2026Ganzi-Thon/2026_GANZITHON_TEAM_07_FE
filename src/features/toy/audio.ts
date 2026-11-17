import type { ToyType } from '../../lib/domain';
import { waxFracture } from './waxSound';
import { SlimeDragSound } from './slimeDragSound';

type SoundState = { enabled: boolean; volume: number; status: 'idle' | 'loading' | 'ready' | 'fallback' | 'unavailable' };
const FILES: Record<ToyType, string[]> = {
  SLANGI: ['slime-original'],
  SQUISHY: ['touch-foam-1', 'touch-foam-2', 'touch-foam-3'],
  WAKPPU: ['touch-wax-1', 'touch-wax-2', 'touch-wax-3'],
};
const RELEASE = ['touch-release-1', 'touch-release-2', 'touch-release-3'];
const ALL_FILES = [...Object.values(FILES).flat(), ...RELEASE];
const AUDIO_REVISION = 'material-20261118';
/** Supplied material samples; synthesis only when decoding fails. No autoplay. */
export class TactileAudio {
  private get files() { return ALL_FILES; }
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private voices = new Set<{ source: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode }>();
  private listeners = new Set<() => void>();
  private state: SoundState = { enabled: true, volume: .35, status: 'idle' };
  private loading: Promise<void> | null = null;
  private controller: AbortController | null = null;
  private lastSample = new Map<string, number>();
  private lastPlayed = -Infinity;
  private noise: AudioBuffer | null = null;
  private disposed = false;
  private slimeDrag: SlimeDragSound | null = null;
  moveSlime(speed: number, stretch: number) {
    if (!this.state.enabled || !this.state.volume || document.hidden || this.disposed || this.context?.state !== 'running' || !this.master) return;
    const original = this.buffers.get('slime-original');
    if (!original) return;
    this.slimeDrag ??= new SlimeDragSound(this.context, this.master, original);
    this.slimeDrag.move(speed, stretch);
  }
  stopSlime() { this.slimeDrag?.stop(); }
  private recoveryTimer: ReturnType<typeof setTimeout> | null = null;
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
          const extension = name === 'slime-original' ? 'mp3' : 'wav';
          const response = await fetch(`/assets/audio/${name}.${extension}?v=${AUDIO_REVISION}`, { signal: this.controller!.signal });
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
  play(type: ToyType, strength = .7, drag = false, recovery = false) {
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
    if (!recovery && now - this.lastPlayed < (drag ? .24 : .065)) return;
    this.lastPlayed = now;
    if (this.voices.size >= 4) this.endVoice(this.voices.values().next().value!);
    const names = recovery ? RELEASE : FILES[type];
    const fracture = type === 'WAKPPU' && !recovery;
    const key = names[0] ?? 'wax-synthesis', previous = this.lastSample.get(key) ?? -1;
    const index = names.length ? (previous + 1 + Math.floor(Math.random() * (names.length - 1))) % names.length : 0;
    this.lastSample.set(key, index);
    const name = names[index];
    let sample = this.buffers.get(name);
    // Loading is not a decode failure. Do not substitute a different texture or
    // replay this touch later after the user has already released the surface.
    if (!sample && this.state.status === 'loading') return;
    const recorded = !!sample;
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
    source.playbackRate.value = recorded ? 1 : .97 + Math.random() * .06;
    const originalSlime = recorded && type === 'SLANGI' && !recovery;
    const gain = context.createGain(), filter = context.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = recorded ? (type === 'SQUISHY' ? 10000 : 14000) : type === 'WAKPPU' ? 5400 : 7000;
    const duration = originalSlime ? source.buffer!.duration : Math.min(source.buffer!.duration / source.playbackRate.value, recorded ? (fracture ? 1.1 : .85) : .35);
    const peak = Math.max(.03, Math.min(.75, strength * (recovery ? .38 : drag ? .28 : .66)));
    if (originalSlime) {
      // Exact supplied MP3: no EQ, pitch change, slice, reconstruction or envelope.
      // Normal interaction/master volume and explicit mute/stop still apply.
      gain.gain.setValueAtTime(peak, now); source.connect(gain);
    } else {
      gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(peak, now + (fracture ? .001 : recovery ? Math.min(.06, duration / 3) : .012));
      gain.gain.setValueAtTime(peak, now + Math.max(.015, duration - .06)); gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
      source.connect(filter); filter.connect(gain);
    }
    gain.connect(this.master);
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
  stop() { this.stopSlime(); this.cancelRecovery(); [...this.voices].forEach(voice => this.endVoice(voice)); this.lastPlayed = -Infinity; }
  dispose() { this.disposed = true; this.controller?.abort(); this.stop(); void this.context?.close().catch(() => {}); this.buffers.clear(); this.listeners.clear(); }
}
