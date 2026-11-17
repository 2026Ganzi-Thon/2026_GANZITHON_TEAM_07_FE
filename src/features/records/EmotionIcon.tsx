import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { emotionImage } from './emotionAssets';
import styles from './EmotionIcon.module.css';

// Adjacent text (list) or the date button's accessible name describes the emotion.
export function EmotionIcon({ emotion }: { emotion: string | null }) {
  const src = emotionImage(emotion);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  return <span className={styles.icon} aria-hidden="true" title={emotion ?? '감정 미선택'}>
    {src && src !== failedSrc
      ? <img src={src} alt="" width={507} height={507} draggable={false} onError={() => setFailedSrc(src)} />
      : <MessageCircle className={styles.fallback} size={20} strokeWidth={1.5} />}
  </span>;
}
