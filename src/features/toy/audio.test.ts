import { afterEach, describe, expect, it, vi } from 'vitest';
import { TactileAudio } from './audio';

const param = () => ({ value: 0, setTargetAtTime: vi.fn(), setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), cancelScheduledValues: vi.fn() });
const gainNode = () => ({ gain: param(), connect: vi.fn(), disconnect: vi.fn() });
const sourceNode = () => ({ buffer: null as unknown, playbackRate: param(), connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null as (() => void) | null });
class Context {
  static instances: Context[] = [];
  currentTime = 1; sampleRate = 32000; state = 'running'; destination = {};
  sources: ReturnType<typeof sourceNode>[] = [];
  gains: ReturnType<typeof gainNode>[] = [];
  constructor() { Context.instances.push(this); }
  resume = vi.fn(async () => {}); close = vi.fn(async () => {});
  createGain() { const node = gainNode(); this.gains.push(node); return node; }
  createBiquadFilter() { return { type: '', frequency: param(), connect: vi.fn(), disconnect: vi.fn() }; }
  createBufferSource() { const node = sourceNode(); this.sources.push(node); return node; }
  createBuffer(_: number, length: number, rate: number) { return { duration: length / rate, getChannelData: () => new Float32Array(length) }; }
  decodeAudioData = vi.fn(async () => ({ duration: .5 }));
}
function setup(fail = false) {
  Context.instances = []; vi.stubGlobal('window', { AudioContext: Context }); vi.stubGlobal('document', { hidden: false });
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(8), { status: fail ? 503 : 200 })));
  return new TactileAudio();
}
afterEach(() => vi.unstubAllGlobals());
describe('tactile audio lifecycle', () => {
  it('never creates audio or downloads until explicitly enabled', async () => {
    const audio = setup(); audio.play('SLANGI'); expect(Context.instances).toHaveLength(0); expect(fetch).not.toHaveBeenCalled();
    await audio.setEnabled(true); expect(Context.instances).toHaveLength(1); expect(fetch).toHaveBeenCalledTimes(9);
    expect(audio.getSnapshot().status).toBe('ready'); audio.dispose();
  });
  it('bounds repeated input, fades the oldest voice, and stops all voices on mute', async () => {
    const audio = setup(); await audio.setEnabled(true); const ctx = Context.instances[0];
    audio.play('SLANGI'); audio.play('SLANGI'); expect(ctx.sources).toHaveLength(1);
    for (let i = 0; i < 5; i++) { ctx.currentTime += .05; audio.play('SLANGI'); }
    expect(ctx.sources).toHaveLength(6); expect(ctx.sources[0].stop).toHaveBeenCalledTimes(2);
    await audio.setEnabled(false); const count = ctx.sources.length; ctx.currentTime++; audio.play('WAKPPU'); expect(ctx.sources).toHaveLength(count);
    expect(ctx.sources.every(source => source.stop.mock.calls.length >= 2)).toBe(true); audio.dispose();
  });
  it('does not play at zero volume or while hidden and cleans audio nodes', async () => {
    const audio = setup(); await audio.setEnabled(true); const ctx = Context.instances[0];
    audio.setVolume(0); audio.play('SQUISHY'); expect(ctx.sources).toHaveLength(0);
    audio.setVolume(1); vi.stubGlobal('document', { hidden: true }); audio.play('SQUISHY'); expect(ctx.sources).toHaveLength(0);
    vi.stubGlobal('document', { hidden: false }); audio.play('SQUISHY'); ctx.sources[0].onended!(); expect(ctx.sources[0].disconnect).toHaveBeenCalledOnce();
    audio.dispose(); expect(ctx.close).toHaveBeenCalledOnce();
  });
  it('uses a short fallback if recordings fail and rejects nonfinite volume', async () => {
    const audio = setup(true); await audio.setEnabled(true); expect(audio.getSnapshot().status).toBe('fallback');
    audio.play('WAKPPU'); expect(Context.instances[0].sources[0].buffer).toMatchObject({ duration: .22 });
    audio.setVolume(NaN); expect(audio.getSnapshot().volume).toBe(0); audio.dispose();
  });
  it('retries failed downloads when re-enabled but reuses successfully decoded buffers', async () => {
    const audio = setup(true); await audio.setEnabled(true); await audio.setEnabled(false);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(8))));
    await audio.setEnabled(true); expect(audio.getSnapshot().status).toBe('ready'); expect(fetch).toHaveBeenCalledTimes(9);
    await audio.setEnabled(false); await audio.setEnabled(true); expect(fetch).toHaveBeenCalledTimes(9); audio.dispose();
  });
  it('reports unsupported audio without breaking toy interaction', async () => {
    const audio = setup(); vi.stubGlobal('window', {}); await audio.setEnabled(true);
    expect(audio.getSnapshot()).toMatchObject({ enabled: false, status: 'unavailable' }); audio.dispose();
  });
});
