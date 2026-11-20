import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { AppMenu } from '../../components/AppMenu';
import { SoundButton, ToyDesignPicker } from './ToyPreferences';
import { TOYS } from '../../lib/domain';
import type { ToyType } from '../../lib/domain';
import styles from './ToyChrome.module.css';

/** Shared controls for all play entry points. Sound wraps only when the controls cannot fit. */
export function ToyToolbar({ active, playing = true, disabled = false, onSelect, onChat }: {
  active: ToyType; playing?: boolean; disabled?: boolean; onSelect: (type: ToyType) => void; onChat: () => void;
}) {
  return <header className={styles.header}>
    <div className={styles.toolbar}>
      <div className={styles.tabs} data-playing={playing} inert={!playing} aria-hidden={!playing} role="group" aria-label="말랑이 종류">
        {(['SLANGI', 'SQUISHY', 'WAKPPU'] as const).map(type => <button key={type} disabled={disabled} aria-pressed={type === active} onClick={() => onSelect(type)}>{TOYS[type].name}</button>)}
      </div>
      <div className={styles.sound} data-playing={playing} inert={!playing} aria-hidden={!playing}><SoundButton /></div>
      <div className={styles.menu}><AppMenu placement="top" onChat={onChat} subtle /></div>
    </div>
  </header>;
}

export function ToyStage({ children, className = '', resting = false }: { children: ReactNode; className?: string; resting?: boolean }) {
  return <div className={`${styles.stage} ${className}`} data-resting={resting}>{children}</div>;
}

export function ToyVariants({ active, playing = true, disabled = false }: { active: ToyType; playing?: boolean; disabled?: boolean }) {
  return <div className={styles.variants} data-playing={playing} inert={!playing} aria-hidden={!playing}><ToyDesignPicker active={active} disabled={disabled} /></div>;
}

export function ToyFinish({ onFinish, playing = true, status }: { onFinish: () => void; playing?: boolean; status: string }) {
  return <div className={styles.finish} data-playing={playing} inert={!playing} aria-hidden={!playing}>
    <button aria-label="말랑이 체험 마치기" onClick={onFinish}><ArrowLeft size={17} aria-hidden="true" />체험 마치기</button>
    <span role="status" className="sr-only">{playing ? status : ''}</span>
  </div>;
}

export function toyReturnFrom(value: unknown): { to: string; state?: unknown } {
  if (value && typeof value === 'object' && 'toyReturn' in value) {
    const origin = value.toyReturn;
    if (origin && typeof origin === 'object' && 'to' in origin && typeof origin.to === 'string'
      && /^\/(?:results|records)\/[^/?#]+(?:\?[^#]*)?$/.test(origin.to)) {
      return { to: origin.to, state: 'state' in origin ? origin.state : undefined };
    }
  }
  return { to: '/' };
}
