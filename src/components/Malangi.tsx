import { TOY_ARTWORK } from '../lib/toyArtwork';
import type { ArtworkId } from '../lib/toyArtwork';
import styles from './Malangi.module.css';

export function Malangi({ pressed = false, small = false, variant = 'ivory', artwork = 'sheep' }: { pressed?: boolean; small?: boolean; variant?: string; artwork?: ArtworkId }) {
  return <div className={`${styles.scene} ${small ? styles.small : ''} ${pressed ? styles.pressed : ''}`} aria-hidden="true" data-variant={variant}>
    <img src={TOY_ARTWORK[artwork].src} width={402} height={268} alt="" draggable={false} />
  </div>;
}
