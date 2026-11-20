import { useRef } from 'react';
import { ToyCanvas } from './ToyCanvas';
import { TOYS } from '../../lib/domain';
import type { ToyType } from '../../lib/domain';
import type { useToyInteraction } from './useToyInteraction';
import styles from './Toy.module.css';

export function ToySurface({ active, interaction, className = styles.play, label, onActivate, playing = true }: {
  active: ToyType;
  interaction: ReturnType<typeof useToyInteraction>;
  className?: string;
  label?: string;
  onActivate?: () => void;
  playing?: boolean;
}) {
  const entryPointer = useRef<number | null>(null);
  const readyAt = useRef(0);
  function enter() { readyAt.current = performance.now() + 350; onActivate?.(); }
  return <button ref={interaction.surface} className={className} disabled={!interaction.ready} aria-busy={!interaction.ready} aria-label={label ?? `${TOYS[active].name} 누르기 또는 드래그`} data-testid="toy-interaction"
    onPointerDown={event => {
      if (!event.isPrimary || event.button !== 0) return;
      if (!playing) { entryPointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); enter(); return; }
      if (entryPointer.current !== null || performance.now() < readyAt.current) return;
      interaction.begin(event);
    }}
    onPointerMove={event => { if (entryPointer.current === null) interaction.move(event); }}
    onPointerUp={event => { if (entryPointer.current === event.pointerId) { entryPointer.current = null; return; } interaction.endPointer(event); }}
    onPointerCancel={event => { entryPointer.current = null; interaction.endPointer(event); }}
    onLostPointerCapture={event => { entryPointer.current = null; interaction.endPointer(event); }} onBlur={() => { entryPointer.current = null; interaction.cancelImpact(); interaction.release(); }}
    onKeyDown={event => {
      const moves: Record<string, { x: number; y: number }> = { ArrowLeft: { x: -60, y: 0 }, ArrowRight: { x: 60, y: 0 }, ArrowUp: { x: 0, y: -55 }, ArrowDown: { x: 0, y: 55 } };
      if (moves[event.key]) { event.preventDefault(); if (!playing) { enter(); return; } if (performance.now() >= readyAt.current) interaction.keyboardPress(moves[event.key]); }
    }}
    onClick={event => { if (event.detail === 0) { if (!playing) enter(); else if (performance.now() >= readyAt.current) interaction.keyboardPress(); } }}>
    <div data-toy-frame className={styles.deform} style={interaction.transform}>
      <ToyCanvas model={interaction.model} design={interaction.design} subscribe={interaction.subscribe} visible={playing} />
    </div>
  </button>;
}
