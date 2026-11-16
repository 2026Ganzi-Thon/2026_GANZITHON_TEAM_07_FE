import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { IconButton } from '../../components/ui';
import type { ToyType } from '../../lib/domain';
import { TactileAudio } from './audio';
import { DESIGN_ASSETS } from '../../lib/assets';
import { TOY_DESIGNS, outline, outlinePath } from './designs';
import type { Shape } from './designs';
import styles from './Toy.module.css';

interface Preferences { audio: TactileAudio; designs: Record<ToyType, Shape>; choose: (type: ToyType, shape: Shape) => void }
const PreferencesContext = createContext<Preferences | null>(null);
export function ToyPreferencesProvider({ children }: { children: ReactNode }) {
  const [audio] = useState(() => new TactileAudio());
  const lifetime = useRef(0);
  const [designs, setDesigns] = useState<Record<ToyType, Shape>>({ SLANGI: 'drop', SQUISHY: 'mochi', WAKPPU: 'pearl' });
  useEffect(() => {
    const generation = ++lifetime.current;
    const stop = () => audio.stop();
    const visibility = () => { if (document.hidden) stop(); };
    window.addEventListener('blur', stop); window.addEventListener('pagehide', stop); document.addEventListener('visibilitychange', visibility);
    return () => {
      stop(); window.removeEventListener('blur', stop); window.removeEventListener('pagehide', stop); document.removeEventListener('visibilitychange', visibility);
      // Ignore StrictMode's synchronous effect replay, but close the context on a real unmount.
      queueMicrotask(() => { if (lifetime.current === generation) audio.dispose(); });
    };
  }, [audio]);
  return <PreferencesContext.Provider value={{ audio, designs, choose: (type, shape) => { if (TOY_DESIGNS[type].some(design => design.id === shape)) setDesigns(previous => ({ ...previous, [type]: shape })); } }}>{children}</PreferencesContext.Provider>;
}
export function useToyPreferences() { const value = useContext(PreferencesContext); if (!value) throw new Error('ToyPreferencesProvider required'); return value; }
export function SoundButton() {
  const { audio } = useToyPreferences(); const state = useSyncExternalStore(audio.subscribe, audio.getSnapshot);
  return <IconButton label={state.enabled ? '효과음 끄기' : '효과음 켜기'} aria-pressed={state.enabled} onClick={() => { void audio.setEnabled(!state.enabled); }}>{state.enabled ? <Volume2 size={19} /> : <VolumeX size={19} />}</IconButton>;
}
export function SoundSettings() {
  const { audio } = useToyPreferences(); const state = useSyncExternalStore(audio.subscribe, audio.getSnapshot);
  return <div className={styles.soundSettings}>
    <div><span>효과음</span><SoundButton /></div>
    <label>음량 <output>{Math.round(state.volume * 100)}%</output><input aria-label="효과음 음량" type="range" min="0" max="100" value={Math.round(state.volume * 100)} onChange={event => audio.setVolume(Number(event.target.value) / 100)} /></label>
    {state.status === 'loading' && state.enabled && <p role="status">소리를 불러오는 중이에요.</p>}
    {state.status === 'fallback' && state.enabled && <p role="status">일부 소리를 불러오지 못해 기본 효과음을 사용해요.</p>}
    {state.status === 'unavailable' && <p role="status">소리를 재생하지 못했어요. 다시 켜거나 기기의 소리 설정을 확인해 주세요.</p>}
  </div>;
}
export function ToyDesignPicker({ active, disabled = false }: { active: ToyType; disabled?: boolean }) {
  const { designs, choose } = useToyPreferences();
  return <fieldset className={styles.designPicker} disabled={disabled}><legend>모양</legend><div>{TOY_DESIGNS[active].map(design => <button type="button" key={design.id} aria-label={`${design.label} 모양`} aria-pressed={designs[active] === design.id} onClick={() => choose(active, design.id)}>
    {design.id === 'drop' ? <img src={DESIGN_ASSETS.lamb} alt="" /> : <svg viewBox="0 0 300 290" aria-hidden="true"><path d={outlinePath(outline(design.id))} fill={active === 'WAKPPU' ? design.wax : design.body} stroke={design.shade} strokeWidth="3" /><path d="M120 126q6 7 12 0M169 126q6 7 12 0M144 144q6 7 12 0" fill="none" stroke="#665d57" strokeWidth="3" strokeLinecap="round" /></svg>}
    <span>{design.label}</span>
  </button>)}</div></fieldset>;
}
