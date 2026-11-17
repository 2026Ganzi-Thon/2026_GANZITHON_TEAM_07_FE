import { afterEach, expect, it, vi } from 'vitest';
import { SlimeDragSound, slimeTexture } from './slimeDragSound';

const parameter = () => ({ value: 0, setValueAtTime: vi.fn(), setTargetAtTime: vi.fn(), cancelScheduledValues: vi.fn() });
function setup() {
  vi.useFakeTimers();
  const sources: { buffer: AudioBuffer | null; loop: boolean; playbackRate: ReturnType<typeof parameter>; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; onended: (() => void) | null }[] = [];
  const gains: { gain: ReturnType<typeof parameter>; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }[] = [];
  const context = {
    currentTime: 1, state: 'running',
    createBuffer: (_: number, length: number, rate: number) => { const pcm = new Float32Array(length); return { duration: length / rate, getChannelData: () => pcm }; },
    createBufferSource: () => { const node = { buffer: null, loop: false, playbackRate: parameter(), connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null }; sources.push(node); return node; },
    createGain: () => { const node = { gain: parameter(), connect: vi.fn(), disconnect: vi.fn() }; gains.push(node); return node; },
    createBiquadFilter: () => ({ type: '', frequency: parameter(), Q: parameter(), connect: vi.fn(), disconnect: vi.fn() }),
  };
  const pcm = new Float32Array(5760).map((_, i) => Math.sin(i * .13) * .2);
  const original = { length: pcm.length, sampleRate: 10000, numberOfChannels: 1, getChannelData: () => pcm };
  const sound = new SlimeDragSound(context as unknown as AudioContext, {} as AudioNode, original as unknown as AudioBuffer);
  return { sound, context, sources, gains };
}
afterEach(() => vi.useRealTimers());

it('updates one continuous voice instead of restarting the original on every move', () => {
  const { sound, sources, gains, context } = setup();
  sound.move(.1, .1); const quiet = gains[0].gain.setTargetAtTime.mock.calls[0][0];
  context.currentTime += .1; sound.move(.7, 1);
  expect(sources).toHaveLength(1); expect(sources[0].loop).toBe(true);
  expect(sources[0].buffer?.duration).toBe(6); expect(sources[0].start).toHaveBeenCalledOnce();
  expect(gains[0].gain.setTargetAtTime.mock.calls[2][0]).toBeGreaterThan(quiet);
  expect(vi.getTimerCount()).toBe(1);
  sound.stop(); expect(vi.getTimerCount()).toBe(0);
  expect(sources[0].stop).toHaveBeenCalledOnce();
  sources[0].onended?.(); expect(sources[0].disconnect).toHaveBeenCalledOnce();
});

it('stops idle/released voices without delayed restarting and allows a new gesture', async () => {
  const { sound, sources } = setup(); sound.move(.5, .5);
  await vi.advanceTimersByTimeAsync(851); expect(sources[0].stop).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(5000); expect(sources).toHaveLength(1);
  sound.move(.2, .2); expect(sources).toHaveLength(2);
  sound.stop(); await vi.advanceTimersByTimeAsync(5000);
  expect(sources[1].stop).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
});

it('keeps silence silent, bounds texture peaks, and rejects invalid motion', () => {
  expect(slimeTexture(new Float32Array(5760), 10000).every(x => x === 0)).toBe(true);
  const input = new Float32Array(5760).map((_, i) => Math.sin(i * .19));
  const pcm = slimeTexture(input, 10000);
  expect(pcm.length).toBe(60000);
  expect(pcm.every(x => Number.isFinite(x) && Math.abs(x) <= .601)).toBe(true);
  const { sound, sources } = setup(); sound.move(NaN, 1); sound.move(0, 1); sound.move(1, Infinity);
  expect(sources).toHaveLength(0);
});
