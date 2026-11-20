import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { X } from 'lucide-react';
import styles from './Sleep.module.css';

/** One persistent panel: its contents move with the handle, including before release. */
export function SleepPanel({ open, hidden, onOpen, onClose, children }: { open:boolean; hidden:boolean; onOpen:()=>void; onClose:()=>void; children:ReactNode }) {
  const root = useRef<HTMLElement>(null), handle = useRef<HTMLButtonElement>(null), close = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ id:number; y:number; open:boolean } | null>(null);
  const moved = useRef(false);
  const [offset,setOffset] = useState(0), [dragging,setDragging] = useState(false);
  useEffect(() => {
    if (!open) return;
    close.current?.focus({preventScroll:true});
    return () => { if (!hidden) handle.current?.focus({preventScroll:true}); };
  },[open]);
  useEffect(() => { if(hidden) { drag.current=null;setOffset(0);setDragging(false); } },[hidden]);
  return <>
    {open && <button tabIndex={-1} className={styles.panelShade} aria-label="수면 설정 닫기" onClick={onClose} />}
    <section ref={root} className={styles.drawer} data-open={open} data-hidden={hidden} data-dragging={dragging}
      role={open ? 'dialog' : undefined} aria-modal={open || undefined} aria-label={open ? '수면 설정' : undefined}
      inert={hidden} style={{'--drag':`${offset}px`} as CSSProperties}
      onKeyDown={event=>{
        if(!open) return;
        if(event.key==='Escape') { event.preventDefault();onClose(); }
        if(event.key!=='Tab') return;
        const items=[...root.current!.querySelectorAll<HTMLElement>('button:not([disabled]), input')].filter(el=>el.getClientRects().length);
        if(event.shiftKey && document.activeElement===items[0]) {event.preventDefault();items.at(-1)?.focus();}
        else if(!event.shiftKey && document.activeElement===items.at(-1)) {event.preventDefault();items[0]?.focus();}
      }}>
      <button ref={handle} className={styles.drawerHandle} aria-label={open ? '수면 설정 접기' : '수면 설정 열기'} aria-expanded={open}
        onPointerDown={event=>{if(!event.isPrimary||event.button!==0)return;drag.current={id:event.pointerId,y:event.clientY,open};moved.current=false;setDragging(true);event.currentTarget.setPointerCapture(event.pointerId);}}
        onPointerMove={event=>{const start=drag.current;if(!start||start.id!==event.pointerId)return;const dy=event.clientY-start.y;if(Math.abs(dy)>8)moved.current=true;const safe=parseFloat(getComputedStyle(root.current!).getPropertyValue('--safe-bottom'))||0;const height=Math.max(0,(root.current?.clientHeight??600)-49-safe);setOffset(start.open?Math.max(0,Math.min(height,dy)):Math.min(0,Math.max(-height,dy)));}}
        onPointerUp={event=>{const start=drag.current;if(!start||start.id!==event.pointerId)return;const dy=event.clientY-start.y;drag.current=null;setDragging(false);setOffset(0);if(!start.open&&dy < -64)onOpen();else if(start.open&&dy>64)onClose();}}
        onPointerCancel={()=>{drag.current=null;setDragging(false);setOffset(0);moved.current=true;}}
        onLostPointerCapture={()=>{drag.current=null;setDragging(false);setOffset(0);}}
        onClick={()=>{if(moved.current){moved.current=false;return;}if(open)onClose();else onOpen();}}><span /></button>
      <div className={styles.drawerContent} inert={!open} aria-hidden={!open}>
        <button ref={close} className={styles.drawerClose} aria-label="수면 설정 닫기" onClick={onClose}><X size={20}/></button>
        {children}
      </div>
    </section>
  </>;
}
