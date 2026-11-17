import { useEffect, useRef, useState } from 'react';
import type { ToyModel } from './physics';
import { nextToyWakeAt, stepToy } from './physics';
import { paintToy } from './paintToy';
import type { ToyDesign } from './designs';
import { Malangi } from '../../components/Malangi';
import { loadToyArtwork } from './toyArtworkLoader';
import { TOY_ARTWORK, isArtwork } from '../../lib/toyArtwork';
import { createWaxRenderer } from './waxArtworkRenderer';
import { createArtworkRenderer } from './artworkRenderer';
import { TOYS } from '../../lib/domain';
import styles from './Toy.module.css';

export function ToyCanvas({ model, design, subscribe, visible }: { model: ToyModel; design: ToyDesign; subscribe: (notify: () => void) => () => void; visible: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [available, setAvailable] = useState(true);
  const [lamb, setLamb] = useState<{ id: string; image: HTMLImageElement } | null>(null);
  const [forceCanvas, setForceCanvas] = useState(false);
  useEffect(() => {
    const id = design.id; if (!isArtwork(id)) return;
    let cancelled = false;
    void loadToyArtwork(id).then(image => { if (!cancelled) setLamb({ id, image }); }).catch(() => { if (!cancelled) setAvailable(false); });
    return () => { cancelled = true; };
  }, [design.id]);
  const artwork = isArtwork(design.id) ? TOY_ARTWORK[design.id] : null;
  const loaded = lamb?.id === design.id ? lamb.image : null;
  const ready = available && (!artwork || loaded !== null);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    if (artwork && !loaded) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    element.width = Math.round(300 * ratio); element.height = Math.round(290 * ratio);
    const wax = artwork && model.type === 'WAKPPU' ? createWaxRenderer(element, loaded!, artwork.rect, design) : null;
    const renderer = artwork && model.type !== 'WAKPPU' ? createArtworkRenderer(element, loaded!, forceCanvas, artwork.rect) : null;
    const ctx = artwork ? null : element.getContext('2d');
    if (!ctx && !renderer && !wax) {
      if (artwork && !forceCanvas) setForceCanvas(true);
      else setAvailable(false);
      return;
    }
    ctx?.setTransform(ratio, 0, 0, ratio, 0, 0); setAvailable(true);
    element.dataset.renderer = renderer?.kind ?? 'canvas';
    const paint = (now: number, reduced: boolean) => {
      if (wax) wax.draw(model, now, reduced);
      else if (renderer) renderer.draw({ anchor: model.visualAnchor, pull: model.visualPull, depth: model.opacity, shape: design.id });
      else paintToy(ctx!, model, design, now, reduced);
    };
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0, timer: ReturnType<typeof setTimeout> | undefined, previous = performance.now(), disposed = false;
    function stop() { cancelAnimationFrame(frame); frame = 0; clearTimeout(timer); element!.dataset.running = 'false'; }
    function render(now: number) {
      frame = 0;
      if (disposed || !visible || document.hidden) { stop(); return; }
      const moving = stepToy(model, (now - previous) / 1000, now, media.matches); previous = now;
      paint(now, media.matches);
      element!.dataset.renderedDesign = design.id;
      element!.dataset.waxMode = model.waxMode; element!.dataset.crumple = model.crumple.toFixed(3);
      element!.dataset.peel = (model.peel ?? 0).toFixed(3);
      element!.dataset.depth = model.opacity.toFixed(3); element!.dataset.broken = String(model.cracks);
      element!.dataset.shellCycles = String(model.shellCycles); element!.dataset.shellRestore = model.shellRestore.toFixed(3);
      element!.dataset.brokenCells = model.shards.flatMap((shard, i) => shard.brokenAt !== null ? [i] : []).join(',');
      element!.dataset.shellRemaining = String(model.shards.filter(shard => shard.brokenAt === null).length);
      element!.dataset.phase = model.pointer ? 'pressed' : model.recovery < 1 && model.depth > 0 ? 'recovering' : model.depth > 0 ? 'resting' : 'idle';
      if (moving) { element!.dataset.running = 'true'; frame = requestAnimationFrame(render); }
      else {
        element!.dataset.running = 'false';
        const wakeAt = nextToyWakeAt(model, now);
        if (wakeAt !== undefined) timer = setTimeout(wake, wakeAt - now + 20);
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
    const lost = (event: Event) => { event.preventDefault(); stop(); setForceCanvas(true); };
    element.addEventListener('webglcontextlost', lost);
    document.addEventListener('visibilitychange', visibility); media.addEventListener('change', motion);
    // Keep the selected design visible on the idle main screen without an animation loop.
    if (visible) wake();
    else { stepToy(model, 0, performance.now(), media.matches); paint(performance.now(), media.matches); element.dataset.renderedDesign = design.id; element.dataset.running = 'false'; }
    return () => { disposed = true; stop(); unsubscribe(); renderer?.dispose(); wax?.dispose(); document.removeEventListener('visibilitychange', visibility); media.removeEventListener('change', motion); element.removeEventListener('webglcontextlost', lost); };
  }, [model, design, subscribe, visible, loaded, artwork, forceCanvas]);
  return <div className={styles.toyVisual}>
    <div className={styles.toyFallback} data-visible={!ready}><Malangi variant={TOYS[model.type].tint} artwork={isArtwork(design.id) ? design.id : undefined} /></div>
    <canvas key={`${design.id}-${forceCanvas}`} ref={canvas} className={styles.toyCanvas} data-visible={ready} data-artwork={artwork ? (loaded ? (design.id === 'sheep' ? 'lamb' : design.id) : 'loading') : 'procedural'} data-design={design.id} aria-hidden="true" />
  </div>;
}
