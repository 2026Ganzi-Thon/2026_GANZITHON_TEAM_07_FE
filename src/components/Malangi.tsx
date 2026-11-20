import { getArtwork } from '../lib/toyArtwork';
import type { ArtworkKey } from '../lib/toyArtwork';
import styles from './Malangi.module.css';

export function Malangi({ pressed = false, small = false, variant = 'ivory', artwork = 'sheep' }: { pressed?: boolean; small?: boolean; variant?: string; artwork?: ArtworkKey }) {
  return <div className={`${styles.scene} ${small ? styles.small : ''} ${pressed ? styles.pressed : ''}`} aria-hidden="true" data-variant={variant}>
    <img src={getArtwork(artwork).src} width={402} height={268} alt="" draggable={false} />
  </div>;
}
