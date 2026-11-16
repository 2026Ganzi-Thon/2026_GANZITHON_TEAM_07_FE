import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Menu, Moon, Notebook, Pencil, Settings, X } from 'lucide-react';
import { Modal } from './ui';
import styles from './AppMenu.module.css';
export function AppMenu({ onChat, placement = 'bottom' }: { onChat?: () => void; placement?: 'top' | 'bottom' }) {
  const [open, setOpen] = useState(false); const [sleep, setSleep] = useState(false);
  const root = useRef<HTMLDivElement>(null); const trigger = useRef<HTMLButtonElement>(null); const first = useRef<HTMLButtonElement>(null);
  const id = useId(); const navigate = useNavigate();
  function close() { setOpen(false); trigger.current?.focus({ preventScroll: true }); }
  useEffect(() => {
    if (!open) return;
    first.current?.focus({ preventScroll: true });
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); close(); } };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  return <div className={styles.dock} data-placement={placement} ref={root} onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false); }}>
    <div id={id} className={styles.bubble} role="dialog" aria-label="메뉴" data-open={open} aria-hidden={!open} inert={!open}>
      <button ref={first} onClick={() => { close(); setSleep(true); }}><Moon size={20} fill="currentColor" strokeWidth={1.5} aria-hidden="true" />수면 모드</button>
      <button onClick={() => { close(); if (onChat) onChat(); else navigate('/chat'); }}><Pencil size={20} strokeWidth={2} aria-hidden="true" />감정 기록</button>
      <button onClick={() => { close(); navigate('/archive'); }}><Notebook size={20} strokeWidth={2} aria-hidden="true" />마음 보관함</button>
      <button className={styles.settingsItem} onClick={() => { close(); navigate('/settings'); }}><Settings size={20} strokeWidth={2} aria-hidden="true" />설정/MY</button>
    </div>
    <button ref={trigger} className={`${styles.trigger} ${open ? styles.active : ''}`} aria-label={open ? '메뉴 닫기' : '메뉴 열기'} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(!open)}>{open ? <X size={29} strokeWidth={1.8} /> : <Menu size={24} strokeWidth={2.5} />}</button>
    {sleep && <Modal title="수면 모드" onClose={() => setSleep(false)}><p>수면 모드는 아직 준비 중이에요.</p><p>지금은 대화와 말랑이 체험을 이용할 수 있어요.</p></Modal>}
  </div>;
}
