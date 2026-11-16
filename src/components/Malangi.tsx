import { DESIGN_ASSETS } from '../lib/assets';
import styles from './Malangi.module.css';

// The current Figma uses the same supplied lamb illustration for recommendation previews.
export function Malangi({ pressed = false, small = false, variant = 'ivory' }: { pressed?: boolean; small?: boolean; variant?: string }) {
  return <div className={`${styles.scene} ${small ? styles.small : ''} ${pressed ? styles.pressed : ''}`} aria-hidden="true" data-variant={variant}>
    <img src={DESIGN_ASSETS.lamb} width={402} height={268} alt="" draggable={false} />
  </div>;
}
