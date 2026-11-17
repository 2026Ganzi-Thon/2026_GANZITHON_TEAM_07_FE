import { useEffect, useRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { X, Flower2 } from 'lucide-react';
import styles from './ui.module.css';
import { DESIGN_ASSETS } from '../lib/assets';

export function IconButton({ label, children, className = '', onClick, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button type="button" aria-label={label} title={label} className={`${styles.iconButton} ${className}`} {...props} onClick={event => { event.currentTarget.focus({ preventScroll: true }); onClick?.(event); }}>{children}</button>;
}
export function Brand() { return <span className={styles.brand}><Flower2 size={21} strokeWidth={1.4} aria-hidden="true" />테슬랑<span className={styles.brandEnglish}>TESLANG</span></span>; }
export function Avatar({ large = false }: { large?: boolean }) {
  return <span className={`${styles.avatar} ${large ? styles.avatarLarge : ''}`}><img src={DESIGN_ASSETS.socrates} alt="소크라테스 석상으로 표현한 테스" /></span>;
}
export function Modal({ title, children, onClose, menu = false, dismissible = true }: { title: string; children: ReactNode; onClose: () => void; menu?: boolean; dismissible?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    dialog?.showModal();
    return () => { dialog?.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, []);
  return <dialog ref={ref} className={`${styles.dialog} ${menu ? styles.menuDialog : ''}`} aria-label={title} aria-busy={!dismissible} onCancel={e => { e.preventDefault(); if (dismissible) onClose(); }} onClick={e => { if (dismissible && e.target === e.currentTarget) onClose(); }}>
    <div className={styles.dialogInner}>
      <div className={styles.dialogHandle} />
      <header className={styles.dialogHeader}><h2>{title}</h2><IconButton label="닫기" onClick={onClose} disabled={!dismissible}><X size={20} /></IconButton></header>
      {children}
    </div>
  </dialog>;
}
export function PreviewNote({ children }: { children?: ReactNode }) { return <p className={styles.previewNote}>{children ?? '화면 미리보기 · 예시 데이터로 진행해요'}</p>; }
