export type SleepSound = 'WHITE' | 'RAIN' | 'NATURE' | 'MALANGI' | 'MUSIC';
export type SleepTimer = 15 | 30 | 60 | 120;

/** Reference order. WHITE is the legacy internal key for the supplied wave recording. */
export const SLEEP_SOUNDS: readonly { id: SleepSound; label: string; available: boolean }[] = [
  { id: 'WHITE', label: '파도소리', available: true },
  { id: 'RAIN', label: '빗소리', available: true },
  { id: 'NATURE', label: '자연음', available: true },
  { id: 'MALANGI', label: '말랑이 ASMR', available: true },
  { id: 'MUSIC', label: '수면 유도 음악', available: true },
];
export const SLEEP_TIMERS: readonly SleepTimer[] = [15, 30, 60, 120];
export const MAX_SLEEP_SOUNDS = 2;

export interface SleepSettings { sounds: SleepSound[]; minutes: SleepTimer; brightness: number; screenOff: boolean }
/** Matches the ready-screen copy in Figma: "빗소리 · 30분 타이머로 설정했어요". */
export const DEFAULT_SLEEP_SETTINGS: SleepSettings = { sounds: ['RAIN'], minutes: 30, brightness: 40, screenOff: true };

export type SleepNotice = 'limit' | 'unavailable' | null;
/** noticeSeq increases on every rejected tap so the UI can replay the "not allowed" shake. */
export interface SleepState { settings: SleepSettings; notice: SleepNotice; noticeSeq: number }
export type SleepAction =
  | { type: 'toggleSound'; sound: SleepSound }
  | { type: 'setTimer'; minutes: SleepTimer }
  | { type: 'setBrightness'; value: number }
  | { type: 'setScreenOff'; value: boolean }
  | { type: 'clearNotice' };

export const initialSleepState: SleepState = { settings: DEFAULT_SLEEP_SETTINGS, notice: null, noticeSeq: 0 };

export function sleepReducer(state: SleepState, action: SleepAction): SleepState {
  const { settings } = state;
  switch (action.type) {
    case 'toggleSound': {
      const sound = SLEEP_SOUNDS.find(item => item.id === action.sound);
      if (!sound) return state;
      if (settings.sounds.includes(action.sound)) return { ...state, settings: { ...settings, sounds: settings.sounds.filter(id => id !== action.sound) }, notice: null };
      if (!sound.available) return { ...state, notice: 'unavailable', noticeSeq: state.noticeSeq + 1 };
      if (settings.sounds.length >= MAX_SLEEP_SOUNDS) return { ...state, notice: 'limit', noticeSeq: state.noticeSeq + 1 };
      return { ...state, settings: { ...settings, sounds: [...settings.sounds, action.sound] }, notice: null };
    }
    case 'setTimer': return SLEEP_TIMERS.includes(action.minutes) ? { ...state, settings: { ...settings, minutes: action.minutes } } : state;
    case 'setBrightness': {
      const value = Number.isFinite(action.value) ? Math.round(Math.max(0, Math.min(100, action.value))) : settings.brightness;
      return { ...state, settings: { ...settings, brightness: value } };
    }
    case 'setScreenOff': return { ...state, settings: { ...settings, screenOff: action.value } };
    case 'clearNotice': return state.notice ? { ...state, notice: null } : state;
  }
}

export function timerLabel(minutes: SleepTimer) { return minutes < 60 ? `${minutes}분` : `${minutes / 60}시간`; }
export function soundLabel(id: SleepSound) { return SLEEP_SOUNDS.find(sound => sound.id === id)?.label ?? id; }

/** Selection order, joined like the Figma copy: "수면 유도 음악 및 말랑이 ASMR · 2시간 타이머로 설정했어요". */
export function sleepSummary(settings: SleepSettings) {
  const sounds = settings.sounds.length ? settings.sounds.map(soundLabel).join(' 및 ') : '사운드 없이';
  return `${sounds} · ${timerLabel(settings.minutes)} 타이머로 설정했어요`;
}

export function remainingSeconds(endAt: number, now: number) { return Math.max(0, Math.ceil((endAt - now) / 1000)); }
export function clockRemaining(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  return `${Math.floor(value / 60).toString().padStart(2, '0')}:${(value % 60).toString().padStart(2, '0')}`;
}
export function formatRemaining(seconds: number) {
  const hours = Math.floor(seconds / 3600), minutes = Math.floor((seconds % 3600) / 60), rest = seconds % 60;
  return [hours ? `${hours}시간` : '', minutes ? `${minutes}분` : '', !hours && rest ? `${rest}초` : ''].filter(Boolean).join(' ') || '0초';
}
