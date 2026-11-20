import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent } from 'react';
import type { ToyType } from '../../lib/domain';
import { useToyPreferences } from './ToyPreferences';
import { TOY_DESIGNS } from './designs';
import { clearToy, configureShell, containsToyPoint, createToyModel, hasShell, hasSoftContact, moveToy, pressToy, releaseToy } from './physics';
import { hitsArtwork, loadToyArtwork } from './toyArtworkLoader';
import { isArtwork } from '../../lib/toyArtwork';
import { artworkMaterial } from './artworkDeformation';

/** Shared input ownership; animation runs in the canvas, outside React rendering. */
export function useToyInteraction(active: ToyType) {
  const { designs, audio } = useToyPreferences();
  const design = TOY_DESIGNS[active].find(value => value.id === designs[active])!;
  const model = useMemo(() => {
    const next = createToyModel(active, design.id), id = design.id;
    if (isArtwork(id)) next.hitTest = point => {
      const shell = next.type === 'WAKPPU' && hasShell(next);
      return hitsArtwork(id, point, { anchor: next.visualAnchor, pull: shell ? { x: 0, y: 0 } : next.visualPull, depth: shell ? 0 : next.opacity });
    };
    return next;
  }, [active, design.id]);
  const [, update] = useState(0);
  const [artworkReady, setArtworkReady] = useState<string | null>(null);
  useEffect(() => {
    const id = design.id; if (!isArtwork(id)) return;
    let cancelled = false;
    void loadToyArtwork(id).then(() => {
      if (cancelled) return;
      configureShell(model, point => hitsArtwork(id, point, { anchor: { x: 150, y: 132 }, pull: { x: 0, y: 0 }, depth: 0 }));
      setArtworkReady(id);
    }).catch(() => { if (!cancelled) setArtworkReady(null); });
    return () => { cancelled = true; };
  }, [design.id]);
  const [pull, setPull] = useState({ x: 0, y: 0 });
  const surface = useRef<HTMLButtonElement>(null);
  const impact = useRef<Animation | null>(null);
  const cancelImpact = useCallback(() => { impact.current?.cancel(); impact.current = null; }, []);
  function showImpact(point: { x: number; y: number }) {
    cancelImpact();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const canvas = surface.current?.querySelector('canvas'); if (!canvas) return;
    const x = Math.max(-2, Math.min(2, (150 - point.x) / 45));
    const y = Math.max(-1.5, Math.min(1.5, (145 - point.y) / 55)) || .8;
    const animation = canvas.animate([
      { transform:'translate(0,0) rotate(0deg)' },
      { transform:`translate(${x}px,${y}px) rotate(${x * .18}deg)`, offset:.22 },
      { transform:`translate(${-x * .55}px,${-y * .55}px) rotate(${-x * .08}deg)`, offset:.55 },
      { transform:`translate(${x * .2}px,${y * .2}px)`, offset:.8 },
      { transform:'translate(0,0) rotate(0deg)' },
    ], { duration:140, easing:'ease-out' });
    animation.id = 'wax-impact'; impact.current = animation;
    animation.onfinish = () => { if (impact.current === animation) impact.current = null; };
  }
  const pointer = useRef<{ id: number; x: number; y: number; box: DOMRect } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listeners = useRef(new Set<() => void>());
  const lastSound = useRef({ x: 0, y: 0, at: 0 });
  const subscribe = useCallback((listener: () => void) => { listeners.current.add(listener); return () => { listeners.current.delete(listener); }; }, []);
  const wake = () => listeners.current.forEach(listener => listener());
  function release() {
    if (active === 'SLANGI') audio.stopSlime();
    audio.cancelRecovery();
    const previous = pointer.current; pointer.current = null;
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (previous && surface.current?.hasPointerCapture(previous.id)) surface.current.releasePointerCapture(previous.id);
    releaseToy(model, performance.now()); setPull({ x: 0, y: 0 }); wake();
  }
  function finish() {
    const held = model.pointer;
    const strength = held ? Math.min(.9, model.baseDepth + (performance.now() - held.started) / 1700) : 0;
    release();
    if (held && (active === 'SQUISHY' || active === 'WAKPPU' && hasSoftContact(model))) audio.playRecovery(strength, artworkMaterial(design.id).wait);
  }
  function reset() { cancelImpact(); release(); clearToy(model); audio.stop(); update(value => value + 1); wake(); }
  useEffect(() => { setPull({ x: 0, y: 0 }); }, [model]);
  useEffect(() => {
    const stop = () => { cancelImpact(); release(); };
    const hidden = () => { if (document.hidden) stop(); };
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    motion.addEventListener('change', cancelImpact);
    window.addEventListener('blur', stop); document.addEventListener('visibilitychange', hidden);
    return () => {
      cancelImpact(); motion.removeEventListener('change', cancelImpact);
      if (timer.current) clearTimeout(timer.current);
      const previous = pointer.current; pointer.current = null;
      if (previous && surface.current?.hasPointerCapture(previous.id)) surface.current.releasePointerCapture(previous.id);
      releaseToy(model, performance.now()); audio.stop();
      window.removeEventListener('blur', stop); document.removeEventListener('visibilitychange', hidden);
    };
  }, [model, audio]);
  const pointAt = (x: number, y: number, box: DOMRect) => ({ x: Math.max(0, Math.min(300, (x - box.x) / box.width * 300)), y: Math.max(0, Math.min(290, (y - box.y) / box.height * 290)) });
  const playWax = (strength = .7) => audio.play('WAKPPU', strength);
  function begin(event: PointerEvent<HTMLButtonElement>) {
    if (pointer.current || event.button !== 0 || !event.isPrimary) return false;
    const box = event.currentTarget.querySelector('[data-toy-frame]')?.getBoundingClientRect() ?? event.currentTarget.getBoundingClientRect();
    const rawPoint = { x: (event.clientX - box.x) / box.width * 300, y: (event.clientY - box.y) / box.height * 290 };
    if (active === 'WAKPPU' && !containsToyPoint(model, rawPoint)) return false;
    if (isArtwork(design.id) && !model.hitTest?.(rawPoint)) return false;
    if (timer.current) clearTimeout(timer.current);
    pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY, box };
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointAt(event.clientX, event.clientY, box); lastSound.current = { ...point, at: performance.now() };
    const before = model.shards.map(shard => shard.brokenAt);
    pressToy(model, point, performance.now());
    if (active !== 'WAKPPU') audio.play(active);
    else if (model.shards.some((shard, i) => shard.brokenAt !== null && shard.brokenAt !== before[i])) { playWax(.45 + Math.min(1, event.pressure || .5) * .45); showImpact(point); }
    else if (hasSoftContact(model)) audio.play('SQUISHY', .5);
    update(value => value + 1); wake(); return true;
  }
  function move(event: PointerEvent<HTMLButtonElement>) {
    if (!pointer.current || pointer.current.id !== event.pointerId) return;
    const point = pointAt(event.clientX, event.clientY, pointer.current.box);
    moveToy(model, point);
    if (hasSoftContact(model)) {
      setPull({ x: Math.max(-85, Math.min(85, event.clientX - pointer.current.x)), y: Math.max(-60, Math.min(60, event.clientY - pointer.current.y)) });
      const distance = Math.hypot(point.x - lastSound.current.x, point.y - lastSound.current.y);
      if (active === 'SLANGI' && distance > .5) {
        const now = performance.now(), speed = distance / Math.max(16, now - lastSound.current.at);
        const stretch = Math.hypot(event.clientX - pointer.current.x, event.clientY - pointer.current.y) / Math.max(1, pointer.current.box.width * .35);
        audio.moveSlime(speed, stretch);
        lastSound.current = { ...point, at: now };
      } else if (active !== 'SLANGI' && distance > 12) {
        const now = performance.now(), speed = distance / Math.max(16, now - lastSound.current.at);
        audio.play(active === 'WAKPPU' ? 'SQUISHY' : active, Math.min(.9, .3 + speed * .7), true);
        lastSound.current = { ...point, at: now };
      }
    }
    wake();
  }
  function endPointer(event: PointerEvent<HTMLButtonElement>) {
    if (pointer.current?.id === event.pointerId) { if (event.type === 'pointerup') finish(); else { cancelImpact(); release(); } }
  }
  function keyboardPress(direction?: { x: number; y: number }) {
    if (pointer.current) return;
    const before = model.shards.map(shard => shard.brokenAt);
    pressToy(model, { x: 150, y: 132 }, performance.now());
    if (direction) moveToy(model, { x: 150 + direction.x, y: 132 + direction.y });
    if (active !== 'WAKPPU') audio.play(active);
    else if (model.waxMode === 'crumple') playWax();
    else if (model.shards.some((shard, i) => shard.brokenAt !== null && shard.brokenAt !== before[i])) { playWax(); showImpact({ x:150, y:132 }); }
    else if (hasSoftContact(model)) audio.play('SQUISHY', .5);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(finish, 250); update(value => value + 1); wake();
  }
  // Keep a small whole-body follow-through while the surface deforms locally.
  const transform: CSSProperties = { transform: isArtwork(design.id) ? 'none' : `translate(${pull.x * .3}px,${pull.y * .25}px)`, transformOrigin: '50% 65%' };
  const status = active === 'WAKPPU' && model.waxMode === 'crumple' ? '꾹 누르면 왁스가 벗겨져요. 손을 떼면 돌아와요.' : active === 'WAKPPU' ? '껍질을 모두 깨뜨린 뒤 꾹 눌러보세요. 잠시 쉬면 껍질이 돌아와요.' : `${model.touches}번 함께 쉬었어요`;
  return { surface, model, design, ready: !isArtwork(design.id) || artworkReady === design.id, subscribe, transform, status, begin, move, endPointer, release, reset, keyboardPress, cancelImpact };
}
