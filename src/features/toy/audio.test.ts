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
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it('loads all samples from bundled assets and preserves the complete wax crunch tail', async () => {
  const audio = setup();
  const loading = audio.setEnabled(true);
  const ctx = Context.instances[0];
  ctx.decodeAudioData.mockImplementation(async () => ({ duration: .96 }));
  await loading;
  const urls = vi.mocked(fetch).mock.calls.map(([url]) => String(url));
  expect(urls.filter(url => url.startsWith('/assets/audio/touch-wax-'))).toHaveLength(3);
  expect(urls.filter(url => url.startsWith('/assets/audio/'))).toHaveLength(10);
  audio.play('WAKPPU');
  expect(ctx.sources.at(-1)!.playbackRate.value).toBe(1);
  expect(ctx.sources.at(-1)!.stop).toHaveBeenCalledWith(ctx.currentTime + .97);
  audio.dispose();
});

describe('tactile audio lifecycle', () => {
  it('does not schedule repeated fracture sounds while a shell contact is held', async () => {
    const audio = setup(); await audio.setEnabled(true); vi.useFakeTimers();
    const ctx = Context.instances[0]; audio.play('WAKPPU');
    await vi.advanceTimersByTimeAsync(3000);
    expect(ctx.sources).toHaveLength(1); expect(vi.getTimerCount()).toBe(0); audio.dispose();
  });
  it('uses supplied wax recordings at original rate and does not fetch old shell recordings', async () => {
    const audio = setup(); await audio.setEnabled(true); const ctx = Context.instances[0];
    expect(vi.mocked(fetch).mock.calls.every(([url]) => !String(url).includes('shell-'))).toBe(true);
    audio.play('WAKPPU', .7); const first = ctx.sources.at(-1)!.buffer;
    expect(first).toMatchObject({ duration: .5 });
    expect(ctx.sources.at(-1)!.playbackRate.value).toBe(1);
    ctx.currentTime += .1; audio.play('WAKPPU', .7);
    expect(ctx.sources.at(-1)!.buffer).not.toBe(first);
    await audio.setEnabled(false); ctx.currentTime += .1; audio.play('WAKPPU');
    expect(ctx.sources).toHaveLength(2); audio.dispose();
  });
  it('plays one softer natural-rate recovery voice at the material delay, without creating audio on its own', async () => {
    const audio = setup(); audio.playRecovery(.9, 90); expect(Context.instances).toHaveLength(0);
    await audio.setEnabled(true); vi.useFakeTimers(); const ctx = Context.instances[0];
    audio.playRecovery(.9, 90); await vi.advanceTimersByTimeAsync(89); expect(ctx.sources).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1); expect(ctx.sources).toHaveLength(1);
    expect(ctx.sources[0].playbackRate.value).toBe(1);
    expect(ctx.sources[0].playbackRate.exponentialRampToValueAtTime).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2000); expect(ctx.sources).toHaveLength(1); audio.dispose();
  });
  it('cancels pending recovery on a new press, mute, zero volume, stop and disposal', async () => {
    const audio = setup(); await audio.setEnabled(true); vi.useFakeTimers(); const ctx = Context.instances[0];
    audio.playRecovery(.9, 180); audio.play('SQUISHY'); await vi.advanceTimersByTimeAsync(200); expect(ctx.sources).toHaveLength(1);
    audio.playRecovery(.9, 180); await audio.setEnabled(false); await vi.advanceTimersByTimeAsync(200); expect(ctx.sources).toHaveLength(1);
    await audio.setEnabled(true); audio.playRecovery(.9, 180); audio.setVolume(0); await vi.advanceTimersByTimeAsync(200); expect(ctx.sources).toHaveLength(1);
    audio.setVolume(.35); audio.playRecovery(.9, 180); audio.stop(); await vi.advanceTimersByTimeAsync(200); expect(ctx.sources).toHaveLength(1);
    audio.playRecovery(.9, 180); audio.dispose(); await vi.advanceTimersByTimeAsync(200); expect(ctx.sources).toHaveLength(1);
  });
  it('defaults on but waits for the first actual gesture to create audio', async () => {
    const audio = setup(); expect(audio.getSnapshot().enabled).toBe(true); expect(Context.instances).toHaveLength(0); expect(fetch).not.toHaveBeenCalled();
    audio.play('SLANGI'); expect(Context.instances[0].sources).toHaveLength(0); expect(Context.instances).toHaveLength(1); expect(fetch).toHaveBeenCalledTimes(10);
    await vi.waitFor(() => expect(audio.getSnapshot().status).toBe('ready'));
    expect(Context.instances[0].sources).toHaveLength(0);
    Context.instances[0].currentTime += .1; audio.play('SLANGI');
    expect(Context.instances[0].sources).toHaveLength(1); audio.dispose();
  });
  it('bounds repeated input, fades the oldest voice, and stops all voices on mute', async () => {
    const audio = setup(); await audio.setEnabled(true); const ctx = Context.instances[0];
    audio.play('SLANGI'); audio.play('SLANGI'); expect(ctx.sources).toHaveLength(1);
    for (let i = 0; i < 5; i++) { ctx.currentTime += .08; audio.play('SLANGI'); }
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
    audio.play('SLANGI'); expect(Context.instances[0].sources[0].buffer).toMatchObject({ duration: .22 });
    audio.setVolume(NaN); expect(audio.getSnapshot().volume).toBe(0); audio.dispose();
  });
  it('retries failed downloads when re-enabled but reuses successfully decoded buffers', async () => {
    const audio = setup(true); await audio.setEnabled(true); await audio.setEnabled(false);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(8))));
    await audio.setEnabled(true); expect(audio.getSnapshot().status).toBe('ready'); expect(fetch).toHaveBeenCalledTimes(10);
    await audio.setEnabled(false); await audio.setEnabled(true); expect(fetch).toHaveBeenCalledTimes(10); audio.dispose();
  });
  it('reports unsupported audio without breaking toy interaction', async () => {
    const audio = setup(); vi.stubGlobal('window', {}); await audio.setEnabled(true);
    expect(audio.getSnapshot()).toMatchObject({ enabled: false, status: 'unavailable' }); audio.dispose();
  });
});


it('does not replay an activation-pending touch after mute or leaving the surface', async () => {
  const audio = setup();
  let resume!: () => void;
  await audio.setEnabled(true);
  const ctx = Context.instances[0]; ctx.state = 'suspended';
  ctx.resume = vi.fn(() => new Promise<void>(resolve => { resume = () => { ctx.state = 'running'; resolve(); }; }));
  audio.play('SQUISHY'); audio.stop(); resume();
  await new Promise(resolve => setTimeout(resolve, 10));
  expect(ctx.sources).toHaveLength(1);
  expect(ctx.sources[0].stop).toHaveBeenLastCalledWith();
  expect(ctx.gains[ctx.gains.length - 1].disconnect).toHaveBeenCalled(); audio.dispose();
});


it('uses separate release recordings and does not repeat the same press sample consecutively', async () => {
  const audio = setup();
  audio.play('SQUISHY');
  const ctx = Context.instances[0];
  let decoded = 0;
  ctx.decodeAudioData.mockImplementation(async () => ({ duration: .65, sample: decoded++ }));
  await audio.setEnabled(true);
  ctx.currentTime += 1; audio.play('SQUISHY'); const press = ctx.sources.at(-1)!.buffer;
  ctx.currentTime += 1; audio.play('SQUISHY'); expect(ctx.sources.at(-1)!.buffer).not.toBe(press);
  vi.useFakeTimers(); audio.playRecovery(.8, 90); await vi.advanceTimersByTimeAsync(90);
  const recovery = ctx.sources.at(-1)!.buffer as { sample: number };
  expect(recovery.sample).toBeGreaterThanOrEqual(7); expect(recovery.sample).toBeLessThan(10);
  audio.dispose();
});


it('uses synthesis only when the supplied wax recording cannot load', async () => {
  const audio = setup(true); await audio.setEnabled(true);
  expect(vi.mocked(fetch).mock.calls.every(([url]) => String(url).startsWith('/assets/audio/'))).toBe(true);
  audio.play('WAKPPU', .7);
  expect(Context.instances[0].sources.at(-1)!.buffer).toMatchObject({ duration: .31 });
  audio.dispose();
});


it('plays the unmodified slime MP3 fully without filters, envelopes or pitch changes', async () => {
  const audio = setup(); await audio.setEnabled(true);
  const ctx = Context.instances[0]; audio.play('SLANGI');
  expect(vi.mocked(fetch).mock.calls.some(([url]) => new URL(String(url), 'http://localhost').pathname === '/assets/audio/slime-original.mp3')).toBe(true);
  expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('touch-slime'))).toBe(false);
  const source = ctx.sources.at(-1)!;
  expect(source.playbackRate.value).toBe(1);
  expect(source.connect).toHaveBeenCalledWith(ctx.gains.at(-1));
  expect(ctx.gains.at(-1)!.gain.exponentialRampToValueAtTime).not.toHaveBeenCalled();
  expect(source.stop).toHaveBeenCalledWith(ctx.currentTime + .51);
  audio.dispose();
});
