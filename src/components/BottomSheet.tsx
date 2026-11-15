import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './ui';
import styles from './BottomSheet.module.css';

export function BottomSheet({ id, title, children, onClose }: { id: string; title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const gesture = useRef<{ id: number; y: number } | null>(null);
  const closingRef = useRef(false);
  const [offset, setOffset] = useState(0);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement;
    const anchor = previous instanceof HTMLElement ? previous.closest('main') : null;
    const bodyOverflow = document.body.style.overflow;
    const viewport = window.visualViewport;
    const place = () => {
      const rect = anchor?.getBoundingClientRect();
      const visibleBottom = (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight);
      dialog.style.setProperty('--sheet-left', `${rect?.left ?? 0}px`);
      dialog.style.setProperty('--sheet-width', `${rect?.width ?? window.innerWidth}px`);
      dialog.style.setProperty('--sheet-bottom', `${Math.max(0, window.innerHeight - Math.min(rect?.bottom ?? window.innerHeight, visibleBottom))}px`);
      dialog.style.maxHeight = `${Math.max(100, (viewport?.height ?? window.innerHeight) - 16)}px`;
    };
    place(); dialog.showModal(); document.body.style.overflow = 'hidden';
    const observer = new ResizeObserver(place); if (anchor) observer.observe(anchor);
    window.addEventListener('resize', place); viewport?.addEventListener('resize', place); viewport?.addEventListener('scroll', place);
    return () => {
      observer.disconnect(); window.removeEventListener('resize', place); viewport?.removeEventListener('resize', place); viewport?.removeEventListener('scroll', place);
      dialog.close(); document.body.style.overflow = bodyOverflow;
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(onClose, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 200);
    return () => clearTimeout(timer);
  }, [closing, onClose]);
  const close = () => { closingRef.current = true; setClosing(true); };
  return <dialog id={id} ref={ref} aria-labelledby={`${id}-title`} className={`${styles.sheet} ${closing ? styles.closing : ''}`} style={{ translate: `0 ${offset}px` }}
    onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const items = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter(el => el.getClientRects().length > 0);
      const first = items[0]; const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}
    onCancel={event => { event.preventDefault(); close(); }} onClick={event => { if (event.target === event.currentTarget) close(); }}>
    <div className={styles.inner}>
      <div className={styles.dragHandle} aria-hidden="true" data-testid="sheet-drag-handle"
        onPointerDown={event => { if (gesture.current || event.button !== 0) return; gesture.current = { id: event.pointerId, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={event => { if (gesture.current?.id === event.pointerId) setOffset(Math.max(0, event.clientY - gesture.current.y)); }}
        onPointerUp={event => { if (gesture.current?.id !== event.pointerId) return; const distance = event.clientY - gesture.current.y; gesture.current = null; if (distance > 64) close(); else setOffset(0); }}
        onPointerCancel={() => { gesture.current = null; setOffset(0); }} onLostPointerCapture={() => { gesture.current = null; if (!closingRef.current) setOffset(0); }}><span /></div>
      <header className={styles.header}><h2 id={`${id}-title`}>{title}</h2><IconButton label="대화창 닫기" onClick={close}><X size={20} /></IconButton></header>
      {children}
    </div>
  </dialog>;
}
