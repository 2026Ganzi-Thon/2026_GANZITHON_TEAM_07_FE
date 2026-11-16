import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent } from 'react';
import type { ToyType } from '../../lib/domain';
import { useToyPreferences } from './ToyPreferences';
import { TOY_DESIGNS } from './designs';
import { clearToy, containsToyPoint, createToyModel, moveToy, pressToy, releaseToy } from './physics';

/** Shared input ownership; animation runs in the canvas, outside React rendering. */
export function useToyInteraction(active: ToyType) {
  const { designs, audio } = useToyPreferences();
  const design = TOY_DESIGNS[active].find(value => value.id === designs[active])!;
  const model = useMemo(() => createToyModel(active, design.id), [active, design.id]);
  const [, update] = useState(0);
  const [pull, setPull] = useState({ x: 0, y: 0 });
  const surface = useRef<HTMLButtonElement>(null);
  const pointer = useRef<{ id: number; x: number; y: number; box: DOMRect } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listeners = useRef(new Set<() => void>());
  const lastSound = useRef({ x: 0, y: 0 });
  const subscribe = useCallback((listener: () => void) => { listeners.current.add(listener); return () => { listeners.current.delete(listener); }; }, []);
  const wake = () => listeners.current.forEach(listener => listener());
  function release() {
    const previous = pointer.current; pointer.current = null;
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (previous && surface.current?.hasPointerCapture(previous.id)) surface.current.releasePointerCapture(previous.id);
    releaseToy(model, performance.now()); setPull({ x: 0, y: 0 }); wake();
  }
  function reset() { release(); clearToy(model); audio.stop(); update(value => value + 1); wake(); }
  useEffect(() => { setPull({ x: 0, y: 0 }); }, [model]);
  useEffect(() => {
    const hidden = () => { if (document.hidden) release(); };
    window.addEventListener('blur', release); document.addEventListener('visibilitychange', hidden);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      const previous = pointer.current; pointer.current = null;
      if (previous && surface.current?.hasPointerCapture(previous.id)) surface.current.releasePointerCapture(previous.id);
      releaseToy(model, performance.now()); audio.stop();
      window.removeEventListener('blur', release); document.removeEventListener('visibilitychange', hidden);
    };
  }, [model, audio]);
  const pointAt = (x: number, y: number, box: DOMRect) => ({ x: Math.max(5, Math.min(295, (x - box.x) / box.width * 300)), y: Math.max(5, Math.min(255, (y - box.y) / box.height * 290)) });
  function begin(event: PointerEvent<HTMLButtonElement>) {
    if (pointer.current || event.button !== 0 || !event.isPrimary) return false;
    const box = event.currentTarget.querySelector('canvas')?.getBoundingClientRect() ?? event.currentTarget.getBoundingClientRect();
    const rawPoint = { x: (event.clientX - box.x) / box.width * 300, y: (event.clientY - box.y) / box.height * 290 };
    if (active === 'WAKPPU' && !containsToyPoint(model, rawPoint)) return false;
    if (timer.current) clearTimeout(timer.current);
    pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY, box };
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointAt(event.clientX, event.clientY, box); lastSound.current = point;
    const shell = active === 'WAKPPU' && model.cracks < 6;
    pressToy(model, point, performance.now()); audio.play(shell ? 'WAKPPU' : active === 'WAKPPU' ? 'SQUISHY' : active);
    update(value => value + 1); wake(); return true;
  }
  function move(event: PointerEvent<HTMLButtonElement>) {
    if (!pointer.current || pointer.current.id !== event.pointerId) return;
    const point = pointAt(event.clientX, event.clientY, pointer.current.box);
    moveToy(model, point);
    if (active !== 'WAKPPU' || model.cracks >= 6) {
      setPull({ x: Math.max(-85, Math.min(85, event.clientX - pointer.current.x)), y: Math.max(-60, Math.min(60, event.clientY - pointer.current.y)) });
      if (Math.hypot(point.x - lastSound.current.x, point.y - lastSound.current.y) > 12) { audio.play(active === 'WAKPPU' ? 'SQUISHY' : active, .5, true); lastSound.current = point; }
    }
    wake();
  }
  function endPointer(event: PointerEvent<HTMLButtonElement>) { if (pointer.current?.id === event.pointerId) release(); }
  function keyboardPress(direction?: { x: number; y: number }) {
    if (pointer.current) return;
    const shell = active === 'WAKPPU' && model.cracks < 6;
    pressToy(model, { x: 150, y: 132 }, performance.now());
    if (direction) moveToy(model, { x: 150 + direction.x, y: 132 + direction.y });
    audio.play(shell ? 'WAKPPU' : active === 'WAKPPU' ? 'SQUISHY' : active);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(release, 250); update(value => value + 1); wake();
  }
  // Keep a small whole-body follow-through while the surface deforms locally.
  const transform: CSSProperties = { transform: `translate(${pull.x * .3}px,${pull.y * .25}px)`, transformOrigin: '50% 65%' };
  const status = active === 'WAKPPU' ? model.cracks < 6 ? `껍질 ${model.cracks} / 6 · 톡톡 두드려 주세요` : '껍질이 모두 깨졌어요. 이제 꾹 눌러보세요.' : `${model.touches}번 함께 쉬었어요`;
  return { surface, model, design, subscribe, transform, status, begin, move, endPointer, release, reset, keyboardPress };
}
