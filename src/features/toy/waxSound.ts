/** Original granular wax crunch. The reference's recordings and code are not bundled. */
export function waxFracture(sampleRate: number, strength: number, random = Math.random) {
  const pressure = Math.max(0, Math.min(1, Number.isFinite(strength) ? strength : .7));
  const duration = .24 + pressure * .10;
  const samples = new Float32Array(Math.ceil(sampleRate * duration));
  const grains = 20 + Math.floor(pressure * 14);
  // Dense overlapping noise grains supply the thick crunch. There are no pitched
  // sine oscillators: those made the earlier fracture sound light and electronic.
  for (let grain = 0; grain < grains; grain++) {
    const position = grain / grains;
    const at = grain === 0 ? 0 : duration * .72 * position + random() * .006;
    const length = .009 + random() * .025;
    const start = Math.floor(at * sampleRate), count = Math.ceil(length * sampleRate);
    const coarse = grain % 3 !== 1;
    const cutoff = coarse ? 550 + random() * 650 : 2100 + random() * 1800;
    const smoothing = 1 - Math.exp(-2 * Math.PI * cutoff / sampleRate);
    const bassSmoothing = 1 - Math.exp(-2 * Math.PI * 430 / sampleRate);
    const weight = (.55 + random() * .55) * (1 - position * .65);
    let low = 0, bass = 0;
    for (let i = 0; i < count && start + i < samples.length; i++) {
      const phase = i / count, noise = random() * 2 - 1;
      low += (noise - low) * smoothing;
      bass += (noise - bass) * bassSmoothing;
      const texture = coarse ? low * 1.7 : (low - bass) * .85;
      // Rounded grain attack, then a dry broken-off tail; uneven overlaps avoid a metronomic rattle.
      const envelope = Math.min(1, phase / .12) * (1 - phase) ** 1.4;
      samples[start + i] += Math.tanh(texture * 1.6) * weight * envelope;
    }
  }
  let peak = 0, energy = 0;
  for (let i = 0; i < samples.length; i++) {
    samples[i] = Math.tanh(samples[i] * 1.1) * Math.min(1, i / (sampleRate * .0015));
    peak = Math.max(peak, Math.abs(samples[i])); energy += samples[i] ** 2;
  }
  // Keep perceived density consistent while leaving headroom for repeated presses.
  const rms = Math.sqrt(energy / samples.length);
  const scale = Math.min(.72 / Math.max(.001, peak), .14 / Math.max(.001, rms));
  for (let i = 0; i < samples.length; i++) samples[i] *= scale;
  return samples;
}
