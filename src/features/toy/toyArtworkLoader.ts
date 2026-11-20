import { getArtwork } from '../../lib/toyArtwork';
import type { ArtworkKey } from '../../lib/toyArtwork';
import { undeformArtwork } from './artworkDeformation';
import type { ArtworkPose } from './artworkDeformation';
import type { Point } from './designs';

const pending = new Map<ArtworkKey, Promise<HTMLImageElement>>();
const loaded = new Map<ArtworkKey, HTMLImageElement>();
export const cachedToyArtwork = (id: ArtworkKey) => loaded.get(id) ?? null;
const masks = new Map<ArtworkKey, Uint8ClampedArray>();
const WIDTH = 192, HEIGHT = 192;
export function loadToyArtwork(id: ArtworkKey) {
  let task = pending.get(id);
  if (!task) {
    task = new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        try {
          const canvas = document.createElement('canvas'); canvas.width = WIDTH; canvas.height = HEIGHT;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) throw new Error('Toy hit mask unavailable');
          ctx.drawImage(image, 0, 0, WIDTH, HEIGHT); masks.set(id, ctx.getImageData(0, 0, WIDTH, HEIGHT).data);
          loaded.set(id, image); resolve(image);
        } catch (error) { pending.delete(id); reject(error); }
      };
      image.onerror = () => { pending.delete(id); reject(new Error('Toy artwork unavailable')); };
      image.src = getArtwork(id).src;
    });
    pending.set(id, task);
  }
  return task;
}
export function hitsArtwork(id: ArtworkKey, point: Point, pose: ArtworkPose) {
  const alpha = masks.get(id); if (!alpha) return false;
  const rest = undeformArtwork(point, { ...pose, shape: id }), rect = getArtwork(id).rect;
  const x = Math.floor((rest.x - rect.x) / rect.width * WIDTH), y = Math.floor((rest.y - rect.y) / rect.height * HEIGHT);
  return x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT && alpha[(y * WIDTH + x) * 4 + 3] > 80;
}

export function forgetToyArtwork(id: ArtworkKey) { pending.delete(id); loaded.delete(id); masks.delete(id); }
