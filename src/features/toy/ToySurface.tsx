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
  return <button ref={interaction.surface} className={className} disabled={!interaction.ready} aria-busy={!interaction.ready} aria-label={label ?? `${TOYS[active].name} 누르기 또는 드래그`} data-testid="toy-interaction"
    onPointerDown={event => { if (interaction.begin(event)) onActivate?.(); }}
    onPointerMove={interaction.move} onPointerUp={interaction.endPointer} onPointerCancel={interaction.endPointer}
    onLostPointerCapture={interaction.endPointer} onBlur={interaction.release}
    onKeyDown={event => {
      const moves: Record<string, { x: number; y: number }> = { ArrowLeft: { x: -60, y: 0 }, ArrowRight: { x: 60, y: 0 }, ArrowUp: { x: 0, y: -55 }, ArrowDown: { x: 0, y: 55 } };
      if (moves[event.key]) { event.preventDefault(); onActivate?.(); interaction.keyboardPress(moves[event.key]); }
    }}
    onClick={event => { if (event.detail === 0) { onActivate?.(); interaction.keyboardPress(); } }}>
    <div className={styles.deform} style={interaction.transform}>
      <ToyCanvas model={interaction.model} design={interaction.design} subscribe={interaction.subscribe} visible={playing} />
    </div>
  </button>;
}
