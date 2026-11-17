import { expect, it } from 'vitest';
import { waxFracture } from './waxSound';

it('produces finite bounded, tapered cracks at both device sample rates', () => {
  for (const rate of [32000, 48000]) for (const strength of [0, .7, 1, NaN]) {
    const data = waxFracture(rate, strength);
    expect(data.length / rate).toBeGreaterThanOrEqual(.24);
    expect(data.length / rate).toBeLessThanOrEqual(.341);
    expect(data.every(Number.isFinite)).toBe(true);
    expect(Math.max(...data.map(Math.abs))).toBeLessThanOrEqual(.721);
    expect(data[0]).toBe(0); expect(Math.abs(data.at(-1)!)).toBeLessThan(.001);
    const rms = (samples: Float32Array) => Math.sqrt(samples.reduce((sum, sample) => sum + sample ** 2, 0) / samples.length);
    expect(rms(data)).toBeGreaterThan(.055);
    expect(rms(data.slice(-Math.floor(rate * .03)))).toBeLessThan(rms(data.slice(0, Math.floor(rate * .03))) * .1);
  }
});
it('varies successive fractures instead of repeating an identical recording', () => {
  expect(waxFracture(32000, .7)).not.toEqual(waxFracture(32000, .7));
});
