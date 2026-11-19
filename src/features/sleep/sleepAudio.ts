import type { SleepSound } from './model';

export type SleepAudioStatus = 'idle' | 'playing' | 'unavailable';
export interface SleepAudioState { status: SleepAudioStatus; asmrFailed: boolean; trackFailed: boolean }

type Noise = 'white' | 'pink' | 'brown';
interface Layer { gain: GainNode; nodes: AudioNode[]; sources: AudioScheduledSourceNode[]; timer?: ReturnType<typeof setTimeout> }

/**
 * Team-supplied ambient tracks (2026-11-19, see public/assets/audio/LICENSES.md), looped from a random offset.
 * WHITE plays the supplied wave recording (user decision: "파도 소리" goes in the 백색소음 slot).
 */
const AMBIENT_TRACKS: Record<Exclude<SleepSound, 'MALANGI' | 'MUSIC'>, { file: string; level: number }> = {
  WHITE: { file: 'sleep/waves.mp3', level: .8 },
  RAIN: { file: 'sleep/rain.mp3', level: .8 },
  NATURE: { file: 'sleep/nature.mp3', level: .8 },
};
/** Fallback only, used when a supplied track cannot be loaded or decoded. */
const NOISE_RECIPES: Record<Exclude<SleepSound, 'MALANGI' | 'MUSIC'>, { noise: Noise; level: number; highpass?: number; lowpass: number; swell?: { rate: number; depth: number } }> = {
  WHITE: { noise: 'white', level: .12, lowpass: 8000 },
  RAIN: { noise: 'pink', level: .26, highpass: 450, lowpass: 7000, swell: { rate: .23, depth: .05 } },
  NATURE: { noise: 'brown', level: .55, lowpass: 900, swell: { rate: .08, depth: .3 } },
};
/** Existing licensed squishy samples (see public/assets/audio/LICENSES.md), replayed softly at random gaps. */
const ASMR_FILES = ['touch-foam-1', 'touch-foam-2', 'touch-foam-3', 'touch-release-1', 'touch-release-2', 'touch-release-3'];
const MASTER_LEVEL = .35;

export function noiseSamples(kind: Noise, length: number, random: () => number = Math.random) {
  const data = new Float32Array(length);
  let b0 = 0, b1 = 0, b2 = 0, brown = 0;
  for (let i = 0; i < length; i++) {
    const white = random() * 2 - 1;
    if (kind === 'white') data[i] = white * .5;
    else if (kind === 'pink') {
      b0 = .99765 * b0 + white * .099046; b1 = .963 * b1 + white * .2965; b2 = .57 * b2 + white * 1.0526;
      data[i] = (b0 + b1 + b2 + white * .1848) * .11;
    } else { brown = (brown + .02 * white) / 1.02; data[i] = brown * 3.5; }
  }
  return data;
}

/** Plays only after an explicit user gesture (the run button). The page stops it on exit/hidden/timer end. */
export class SleepAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private layers = new Map<SleepSound, Layer>();
  private noise = new Map<Noise, AudioBuffer>();
  private samples: AudioBuffer[] = [];
  private loading: Promise<void> | null = null;
  private stopTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<() => void>();
  private state: SleepAudioState = { status: 'idle', asmrFailed: false, trackFailed: false };
  private tracks = new Map<SleepSound, Promise<AudioBuffer | null>>();
  private disposed = false;
  private generation = 0;

  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<SleepAudioState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener()); }

  private ensureContext() {
    if (this.context) return true;
    try {
      const Constructor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Constructor) throw new Error('Audio unavailable');
      this.context = new Constructor();
      this.master = this.context.createGain(); this.master.gain.value = 0; this.master.connect(this.context.destination);
      return true;
    } catch { this.update({ status: 'unavailable' }); return false; }
  }

  /** Must be called synchronously from a click so mobile browsers allow resume(). */
  async start(sounds: SleepSound[]) {
    if (this.disposed) return;
    this.clearStopTimer();
    const generation = ++this.generation;
    if (!this.ensureContext()) return;
    const context = this.context!, master = this.master!;
    try { await context.resume(); } catch { this.update({ status: 'unavailable' }); return; }
    // A stop/exit during resume() wins; never start sound after the user already ended it.
    if (this.disposed || generation !== this.generation) return;
    const now = context.currentTime;
    master.gain.cancelScheduledValues(now); master.gain.setValueAtTime(master.gain.value, now); master.gain.linearRampToValueAtTime(MASTER_LEVEL, now + 2);
    this.update({ status: 'playing' });
    this.setSounds(sounds);
  }

  setSounds(sounds: SleepSound[]) {
    if (this.state.status !== 'playing' || !this.context) return;
    for (const id of [...this.layers.keys()]) if (!sounds.includes(id)) this.removeLayer(id, 1.2);
    for (const id of sounds) if (!this.layers.has(id)) this.addLayer(id);
  }

  private addLayer(id: SleepSound) {
    const context = this.context!, now = context.currentTime;
    const gain = context.createGain(); gain.gain.setValueAtTime(0, now); gain.connect(this.master!);
    const layer: Layer = { gain, nodes: [gain], sources: [] };
    if (id === 'MALANGI') {
      gain.gain.linearRampToValueAtTime(1, now + 1);
      this.layers.set(id, layer);
      void this.loadSamples().then(() => { if (this.layers.get(id) === layer) this.scheduleAsmr(layer); });
      return;
    }
    if (id === 'MUSIC') return;
    this.layers.set(id, layer);
    void this.loadTrack(id).then(buffer => {
      if (this.layers.get(id) !== layer || !this.context) return; // deselected or stopped while loading
      if (buffer) this.startTrack(layer, buffer, AMBIENT_TRACKS[id].level);
      else { this.update({ trackFailed: true }); this.startNoise(layer, id); }
    });
  }

  private loadTrack(id: Exclude<SleepSound, 'MALANGI' | 'MUSIC'>) {
    let pending = this.tracks.get(id);
    if (!pending) {
      const context = this.context!;
      pending = fetch(`/assets/audio/${AMBIENT_TRACKS[id].file}`)
        .then(response => response.ok ? response.arrayBuffer() : Promise.reject(new Error(String(response.status))))
        .then(bytes => context.decodeAudioData(bytes))
        .catch(() => { this.tracks.delete(id); return null; }); // a later run may retry the download
      this.tracks.set(id, pending);
    }
    return pending;
  }

  private startTrack(layer: Layer, buffer: AudioBuffer, level: number) {
    const context = this.context!, now = context.currentTime;
    const source = context.createBufferSource(); source.buffer = buffer; source.loop = true;
    const gain = context.createGain(); gain.gain.value = level;
    source.connect(gain); gain.connect(layer.gain); layer.nodes.push(gain);
    source.start(now, Math.random() * Math.max(0, buffer.duration - 1)); layer.sources.push(source);
    layer.gain.gain.cancelScheduledValues(now); layer.gain.gain.setValueAtTime(0, now); layer.gain.gain.linearRampToValueAtTime(1, now + 1.5);
  }

  private startNoise(layer: Layer, id: Exclude<SleepSound, 'MALANGI' | 'MUSIC'>) {
    const context = this.context!, now = context.currentTime, gain = layer.gain;
    const recipe = NOISE_RECIPES[id];
    const source = context.createBufferSource(); source.buffer = this.noiseBuffer(recipe.noise); source.loop = true;
    let tail: AudioNode = source;
    if (recipe.highpass) { const filter = context.createBiquadFilter(); filter.type = 'highpass'; filter.frequency.value = recipe.highpass; tail.connect(filter); tail = filter; layer.nodes.push(filter); }
    const lowpass = context.createBiquadFilter(); lowpass.type = 'lowpass'; lowpass.frequency.value = recipe.lowpass; tail.connect(lowpass); layer.nodes.push(lowpass);
    const level = context.createGain(); level.gain.value = recipe.level; lowpass.connect(level); level.connect(gain); layer.nodes.push(level);
    if (recipe.swell) {
      const lfo = context.createOscillator(), depth = context.createGain();
      lfo.frequency.value = recipe.swell.rate; depth.gain.value = recipe.level * recipe.swell.depth;
      lfo.connect(depth); depth.connect(level.gain); lfo.start(now); layer.sources.push(lfo); layer.nodes.push(depth);
    }
    source.start(now, Math.random() * (source.buffer!.duration - .1)); layer.sources.push(source);
    gain.gain.cancelScheduledValues(now); gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(1, now + 1.5);
  }

  private noiseBuffer(kind: Noise) {
    const cached = this.noise.get(kind);
    if (cached) return cached;
    const context = this.context!, length = context.sampleRate * 6;
    const buffer = context.createBuffer(1, length, context.sampleRate);
    buffer.getChannelData(0).set(noiseSamples(kind, length));
    this.noise.set(kind, buffer);
    return buffer;
  }

  private loadSamples() {
    if (this.samples.length) return Promise.resolve();
    this.loading ??= (async () => {
      const context = this.context!;
      const decoded = await Promise.all(ASMR_FILES.map(async name => {
        try {
          const response = await fetch(`/assets/audio/${name}.wav`);
          return response.ok ? await context.decodeAudioData(await response.arrayBuffer()) : null;
        } catch { return null; }
      }));
      this.samples = decoded.filter((buffer): buffer is AudioBuffer => !!buffer);
      if (!this.samples.length && !this.disposed) this.update({ asmrFailed: true });
    })().finally(() => { this.loading = null; });
    return this.loading;
  }

  private scheduleAsmr(layer: Layer) {
    if (this.disposed || !this.samples.length || this.state.status !== 'playing' || !this.context) return;
    const context = this.context, source = context.createBufferSource(), voice = context.createGain();
    source.buffer = this.samples[Math.floor(Math.random() * this.samples.length)];
    source.playbackRate.value = .9 + Math.random() * .12;
    voice.gain.value = .22 + Math.random() * .12;
    source.connect(voice); voice.connect(layer.gain);
    source.onended = () => { source.disconnect(); voice.disconnect(); layer.sources = layer.sources.filter(item => item !== source); };
    source.start(); layer.sources.push(source);
    layer.timer = setTimeout(() => this.scheduleAsmr(layer), 1800 + Math.random() * 2600);
  }

  private removeLayer(id: SleepSound, seconds: number) {
    const layer = this.layers.get(id);
    if (!layer || !this.context) return;
    this.layers.delete(id);
    if (layer.timer) clearTimeout(layer.timer);
    const now = this.context.currentTime;
    layer.gain.gain.cancelScheduledValues(now); layer.gain.gain.setValueAtTime(layer.gain.gain.value, now); layer.gain.gain.linearRampToValueAtTime(0, now + seconds);
    for (const source of layer.sources) { try { source.stop(now + seconds + .05); } catch { /* Already stopped. */ } }
    setTimeout(() => layer.nodes.forEach(node => node.disconnect()), (seconds + .2) * 1000);
  }

  /** Timer end: fade everything out, then release the audio graph. */
  fadeOut(seconds = 4) {
    if (this.state.status !== 'playing' || !this.context || !this.master) { this.stop(); return; }
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now); this.master.gain.setValueAtTime(this.master.gain.value, now); this.master.gain.linearRampToValueAtTime(0, now + seconds);
    this.clearStopTimer();
    this.stopTimer = setTimeout(() => this.stop(), seconds * 1000);
  }

  stop() {
    this.generation++;
    this.clearStopTimer();
    for (const id of [...this.layers.keys()]) this.removeLayer(id, .15);
    if (this.context && this.master) { const now = this.context.currentTime; this.master.gain.cancelScheduledValues(now); this.master.gain.setTargetAtTime(0, now, .05); }
    if (this.state.status === 'playing') this.update({ status: 'idle' });
  }

  private clearStopTimer() { if (this.stopTimer !== null) clearTimeout(this.stopTimer); this.stopTimer = null; }

  dispose() {
    this.stop(); this.disposed = true;
    void this.context?.close().catch(() => {});
    this.context = null; this.master = null; this.noise.clear(); this.tracks.clear(); this.samples = []; this.listeners.clear();
  }
}
