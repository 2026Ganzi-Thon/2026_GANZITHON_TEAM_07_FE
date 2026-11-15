import type { CSSProperties } from 'react';
import styles from './Malangi.module.css';

// Code-rendered visual placeholder. Replace this slot with the malangi team's renderer.
export function Malangi({ pressed = false, small = false, variant = 'ivory' }: { pressed?: boolean; small?: boolean; variant?: string }) {
  return <div className={`${styles.scene} ${small ? styles.small : ''} ${pressed ? styles.pressed : ''}`} aria-hidden="true" style={{ '--tint': variant === 'slate' ? '#d6dde6' : '#f3ede3' } as CSSProperties}>
    <div className={styles.shadow} />
    <div className={styles.float}>
      <div className={styles.body}>
        <span className={styles.highlight} />
        <div className={styles.face}><span className={styles.eye} /><span className={styles.eye} /><span className={styles.mouth} /><span className={`${styles.cheek} ${styles.left}`} /><span className={`${styles.cheek} ${styles.right}`} /></div>
      </div>
      <span className={`${styles.arm} ${styles.armLeft}`} /><span className={`${styles.arm} ${styles.armRight}`} />
    </div>
  </div>;
}
