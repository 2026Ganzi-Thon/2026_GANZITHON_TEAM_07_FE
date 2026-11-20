import { useState } from 'react';
import { ArrowRight, Check, Plus } from 'lucide-react';
import { SAMPLE_EMOTIONS } from './model';
import { EmotionIcon } from '../records/EmotionIcon';
import styles from './Chat.module.css';

export function EmotionCard({ onSubmit, primaryOptions = SAMPLE_EMOTIONS, secondaryOptions = SAMPLE_EMOTIONS }: { primaryOptions?: string[]; secondaryOptions?: string[]; onSubmit: (primary: string, secondary: string | null) => void }) {
  const [primary, setPrimary] = useState<string | null>(null);
  const [secondary, setSecondary] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  return <section className={styles.inputCard} aria-label="감정 선택">
    <span className={styles.cardEyebrow}>CHECK IN · 01</span><h2>가장 가까운 마음을 골라주세요</h2><p className={styles.cardDescription}>대표 감정 하나면 충분해요.</p>
    <div className={styles.emotions} role="group" aria-label="대표 감정">
      {primaryOptions.map(emotion => <button key={emotion} aria-pressed={primary === emotion} onClick={() => { setPrimary(emotion); if (secondary === emotion) setSecondary(null); }} className={primary === emotion ? styles.selectedEmotion : ''}><span className={styles.emotionArtwork}><EmotionIcon emotion={emotion} /></span>{emotion}{primary === emotion && <Check size={13} />}</button>)}
    </div>
    <button className={styles.expandSecondary} onClick={() => { setExpanded(!expanded); if (expanded) setSecondary(null); }} aria-expanded={expanded}><Plus size={13} />함께 느낀 감정도 있어요 <span>선택</span></button>
    {expanded && <div className={styles.secondaryOptions} role="group" aria-label="부가 감정"><p>있다면 하나 더 골라주세요.</p>{secondaryOptions.filter(e => e !== primary).map(emotion => <button key={emotion} aria-pressed={secondary === emotion} onClick={() => setSecondary(secondary === emotion ? null : emotion)}>{emotion}{secondary === emotion && <Check size={12} />}</button>)}</div>}
    <button className={styles.cardSubmit} disabled={!primary} onClick={() => primary && onSubmit(primary, secondary)}>이 마음으로 이어가기 <ArrowRight size={16} /></button>
  </section>;
}

export function IntensityCard({ after, onSubmit, allowSkip = true }: { allowSkip?: boolean; after: boolean; onSubmit: (value: number | null) => void }) {
  const [value, setValue] = useState<number | null>(null);
  return <section className={styles.inputCard} aria-label={after ? '사후 강도 선택' : '사전 강도 선택'}>
    <div className={styles.cardHeading}><div><span className={styles.cardEyebrow}>{after ? 'CHECK OUT' : 'CHECK IN · 02'}</span><h2>{after ? '지금 마음의 무게는요?' : '그 감정의 크기는 어떤가요?'}</h2></div><span className={styles.scoreValue} aria-live="polite">{value ?? '—'}<small>/ 10</small></span></div>
    <p className={styles.cardDescription}>느껴지는 만큼, 직접 골라주세요.</p>
    <div className={styles.scores} role="group" aria-label="0부터 10까지 강도">{Array.from({ length: 11 }, (_, n) => <button key={n} aria-label={`${n}점`} aria-pressed={value === n} className={value === n ? styles.selectedScore : ''} onClick={() => setValue(n)}>{n}</button>)}</div>
    <div className={styles.scale} aria-hidden="true" /><div className={styles.scoreLabels}><span>0 · 전혀 느껴지지 않음</span><span>10 · 매우 강하게 느껴짐</span></div>
    <button className={styles.cardSubmit} disabled={value === null} onClick={() => onSubmit(value)}>{after ? '대화 마무리하기' : '천천히 이어가기'}<ArrowRight size={16} /></button>
    {after && allowSkip && <><button className={styles.skip} onClick={() => onSubmit(null)}>점수 없이 마무리할게요</button></>}
  </section>;
}
