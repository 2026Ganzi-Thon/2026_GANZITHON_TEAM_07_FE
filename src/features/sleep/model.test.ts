import { describe, expect, it } from 'vitest';
import { DEFAULT_SLEEP_SETTINGS, formatRemaining, initialSleepState, remainingSeconds, sleepReducer, sleepSummary, timerLabel } from './model';

describe('sleep settings', () => {
  it('starts from the Figma ready-screen default', () => {
    expect(sleepSummary(DEFAULT_SLEEP_SETTINGS)).toBe('빗소리 · 30분 타이머로 설정했어요');
  });

  it('allows at most two sounds and keeps selection order', () => {
    let state = sleepReducer(initialSleepState, { type: 'toggleSound', sound: 'WHITE' });
    expect(state.settings.sounds).toEqual(['RAIN', 'WHITE']);
    state = sleepReducer(state, { type: 'toggleSound', sound: 'NATURE' });
    expect(state.settings.sounds).toEqual(['RAIN', 'WHITE']);
    expect(state.notice).toBe('limit');
    expect(state.noticeSeq).toBe(1);
    state = sleepReducer(state, { type: 'toggleSound', sound: 'NATURE' });
    expect(state.noticeSeq).toBe(2);
    state = sleepReducer(state, { type: 'toggleSound', sound: 'RAIN' });
    expect(state).toEqual({ settings: { ...DEFAULT_SLEEP_SETTINGS, sounds: ['WHITE'] }, notice: null, noticeSeq: 2 });
    state = sleepReducer(state, { type: 'toggleSound', sound: 'MALANGI' });
    expect(sleepSummary({ ...state.settings, minutes: 120 })).toBe('백색소음 및 말랑이 ASMR · 2시간 타이머로 설정했어요');
  });

  it('does not select a sound whose track has not been supplied', () => {
    const state = sleepReducer({ ...initialSleepState, settings: { ...DEFAULT_SLEEP_SETTINGS, sounds: [] } }, { type: 'toggleSound', sound: 'MUSIC' });
    expect(state.settings.sounds).toEqual([]);
    expect(state.notice).toBe('unavailable');
    expect(sleepSummary(state.settings)).toBe('사운드 없이 · 30분 타이머로 설정했어요');
  });

  it('clamps brightness and ignores unknown timers', () => {
    let state = sleepReducer(initialSleepState, { type: 'setBrightness', value: 140 });
    expect(state.settings.brightness).toBe(100);
    state = sleepReducer(state, { type: 'setBrightness', value: Number.NaN });
    expect(state.settings.brightness).toBe(100);
    state = sleepReducer(state, { type: 'setTimer', minutes: 45 as never });
    expect(state.settings.minutes).toBe(30);
    expect(timerLabel(60)).toBe('1시간');
  });

  it('formats remaining time for the status text', () => {
    expect(remainingSeconds(10_500, 10_000)).toBe(1);
    expect(remainingSeconds(10_000, 12_000)).toBe(0);
    expect(formatRemaining(30 * 60)).toBe('30분');
    expect(formatRemaining(2 * 3600)).toBe('2시간');
    expect(formatRemaining(89)).toBe('1분 29초');
    expect(formatRemaining(0)).toBe('0초');
  });
});
