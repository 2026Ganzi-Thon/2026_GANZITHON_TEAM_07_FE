import { describe, expect, it } from 'vitest';
import { noiseSamples, SleepAudio } from './sleepAudio';

function seeded(seed = 7) { return () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; }

describe('sleep ambient noise', () => {
  it.each(['white', 'pink', 'brown'] as const)('keeps %s noise within a safe amplitude', kind => {
    const data = noiseSamples(kind, 48_000, seeded());
    const peak = data.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
    expect(peak).toBeGreaterThan(.01);
    expect(peak).toBeLessThanOrEqual(1);
  });

  it('reports unavailable instead of pretending to play when Web Audio is missing', async () => {
    const original = globalThis.window;
    Object.defineProperty(globalThis, 'window', { value: {}, configurable: true });
    try {
      const audio = new SleepAudio();
      await audio.start(['RAIN']);
      expect(audio.getSnapshot().status).toBe('unavailable');
      audio.dispose();
    } finally { Object.defineProperty(globalThis, 'window', { value: original, configurable: true }); }
  });
});
