/** Overlap short texture grains, avoiding repeated playback of the original attack. */
export function slimeTexture(input: Float32Array, sampleRate: number) {
  const output = new Float32Array(Math.round(sampleRate * 6));
  let seed = 6201;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let at = 0; at < output.length; at += Math.round(sampleRate * (.032 + random() * .018))) {
    const length = Math.round(sampleRate * (.11 + random() * .045));
    const offset = sampleRate * (.03 + random() * .08), rate = .58 + random() * .14;
    const weight = .65 + random() * .35;
    for (let i = 0; i < length; i++) {
      const position = Math.min(input.length - 2, offset + i * rate), index = Math.floor(position);
      const value = input[index] + (input[index + 1] - input[index]) * (position - index);
      const window = Math.sin(Math.PI * i / (length - 1)) ** 2;
      output[(at + i) % output.length] += value * window * weight;
    }
  }
  let mean = 0;
  for (const value of output) mean += value / output.length;
  let peak = 0, energy = 0;
  for (let i = 0; i < output.length; i++) { output[i] -= mean; peak = Math.max(peak, Math.abs(output[i])); energy += output[i] ** 2; }
  const gain = Math.min(.6 / Math.max(peak, .00001), .12 / Math.max(Math.sqrt(energy / output.length), .00001));
  for (let i = 0; i < output.length; i++) output[i] *= gain;
  return output;
}

/** One continuously controlled voice, with inactivity/release/mute cleanup. */
export class SlimeDragSound {
  private buffer: AudioBuffer | null = null;
  private voice: { source: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode } | null = null;
  private idle: ReturnType<typeof setTimeout> | null = null;
  constructor(private context: AudioContext, private destination: AudioNode, private original: AudioBuffer) {}
  move(speed: number, stretch: number) {
    if (!Number.isFinite(speed) || !Number.isFinite(stretch) || speed <= 0) return;
    const context = this.context, now = context.currentTime;
    if (!this.buffer) {
      const mono = new Float32Array(this.original.length);
      for (let channel = 0; channel < this.original.numberOfChannels; channel++) {
        const data = this.original.getChannelData(channel);
        for (let i = 0; i < mono.length; i++) mono[i] += data[i] / this.original.numberOfChannels;
      }
      const pcm = slimeTexture(mono, this.original.sampleRate);
      this.buffer = context.createBuffer(1, pcm.length, this.original.sampleRate);
      this.buffer.getChannelData(0).set(pcm);
    }
    if (!this.voice) {
      const source = context.createBufferSource(), gain = context.createGain(), filter = context.createBiquadFilter();
      source.buffer = this.buffer; source.loop = true;
      gain.gain.setValueAtTime(.0001, now);
      filter.type = 'lowpass'; filter.frequency.value = 1900; filter.Q.value = .35;
      source.connect(filter); filter.connect(gain); gain.connect(this.destination);
      const voice = { source, gain, filter }; this.voice = voice;
      source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); if (this.voice === voice) this.voice = null; };
      source.start(now, Math.random() * this.buffer.duration);
    }
    const movement = Math.min(1, speed / .7), pull = Math.min(1, Math.max(0, stretch));
    const { source, gain, filter } = this.voice;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setTargetAtTime(.09 + movement * .36 + pull * .09, now, .045);
    // No further pointer events: decay on the audio clock instead of a sound restart.
    gain.gain.setTargetAtTime(.0001, now + .12, .10);
    filter.frequency.setTargetAtTime(1400 + movement * 1300 - pull * 450, now, .10);
    source.playbackRate.setTargetAtTime(.94 - pull * .12, now, .12);
    if (this.idle !== null) clearTimeout(this.idle);
    this.idle = setTimeout(() => this.stop(), 850);
  }
  stop() {
    if (this.idle !== null) clearTimeout(this.idle); this.idle = null;
    const voice = this.voice; this.voice = null;
    if (!voice) return;
    const now = this.context.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setTargetAtTime(.0001, now, .018);
    try { voice.source.stop(this.context.state === 'running' ? now + .09 : now); } catch { /* Already ended. */ }
  }
}
