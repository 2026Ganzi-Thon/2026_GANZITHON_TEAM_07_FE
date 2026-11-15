import { useEffect, useRef, useState } from 'react';
import type { ToyModel } from './physics';
import { recoveryAt, stepToy } from './physics';
import { paintToy } from './paintToy';
import type { ToyDesign } from './designs';
import { Malangi } from '../../components/Malangi';
import { TOYS } from '../../lib/domain';
import styles from './Toy.module.css';

export function ToyCanvas({ model, design, subscribe, visible }: { model: ToyModel; design: ToyDesign; subscribe: (notify: () => void) => () => void; visible: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [available, setAvailable] = useState(true);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const ctx = element.getContext('2d');
    if (!ctx) { setAvailable(false); return; }
    setAvailable(true);
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    element.width = Math.round(300 * ratio); element.height = Math.round(290 * ratio); ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0, timer: ReturnType<typeof setTimeout> | undefined, previous = performance.now(), disposed = false;
    function stop() { cancelAnimationFrame(frame); frame = 0; clearTimeout(timer); element!.dataset.running = 'false'; }
    function render(now: number) {
      frame = 0;
      if (disposed || !visible || document.hidden) { stop(); return; }
      const moving = stepToy(model, (now - previous) / 1000, now, media.matches); previous = now;
      paintToy(ctx!, model, design, now, media.matches);
      element!.dataset.renderedDesign = design.id;
      element!.dataset.depth = model.opacity.toFixed(3); element!.dataset.broken = String(model.cracks);
      element!.dataset.phase = model.pointer ? 'pressed' : model.recovery < 1 && model.depth > 0 ? 'recovering' : model.depth > 0 ? 'resting' : 'idle';
      if (moving) { element!.dataset.running = 'true'; frame = requestAnimationFrame(render); }
      else {
        element!.dataset.running = 'false';
        const wakeAt = recoveryAt(model);
        if (!media.matches && model.depth > 0 && wakeAt !== null && wakeAt >= now) timer = setTimeout(wake, wakeAt - now + 20);
      }
    }
    function wake() {
      if (disposed || !visible || document.hidden) return;
      clearTimeout(timer);
      if (!frame) { previous = performance.now(); frame = requestAnimationFrame(render); }
    }
    const unsubscribe = subscribe(wake);
    const visibility = () => { if (document.hidden) stop(); else wake(); };
    const motion = () => wake();
    document.addEventListener('visibilitychange', visibility); media.addEventListener('change', motion);
    // Keep the selected design visible on the idle main screen without an animation loop.
    if (visible) wake();
    else { stepToy(model, 0, performance.now(), media.matches); paintToy(ctx, model, design, performance.now(), media.matches); element.dataset.renderedDesign = design.id; element.dataset.running = 'false'; }
    return () => { disposed = true; stop(); unsubscribe(); document.removeEventListener('visibilitychange', visibility); media.removeEventListener('change', motion); };
  }, [model, design, subscribe, visible]);
  return <div className={styles.toyVisual}>
    <div className={styles.toyFallback} data-visible={!available}><Malangi variant={TOYS[model.type].tint} /></div>
    <canvas ref={canvas} className={styles.toyCanvas} data-visible={available} data-design={design.id} aria-hidden="true" />
  </div>;
}
