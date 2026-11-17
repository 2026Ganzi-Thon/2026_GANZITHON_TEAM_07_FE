import { TOY_ARTWORK } from '../../lib/toyArtwork';
import type { ArtworkId } from '../../lib/toyArtwork';
import { undeformArtwork } from './artworkDeformation';
import type { ArtworkPose } from './artworkDeformation';
import type { Point } from './designs';

const pending = new Map<ArtworkId, Promise<HTMLImageElement>>();
const masks = new Map<ArtworkId, Uint8ClampedArray>();
const WIDTH = 192, HEIGHT = 192;
export function loadToyArtwork(id: ArtworkId) {
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
          resolve(image);
        } catch (error) { pending.delete(id); reject(error); }
      };
      image.onerror = () => { pending.delete(id); reject(new Error('Toy artwork unavailable')); };
      image.src = TOY_ARTWORK[id].src;
    });
    pending.set(id, task);
  }
  return task;
}
export function hitsArtwork(id: ArtworkId, point: Point, pose: ArtworkPose) {
  const alpha = masks.get(id); if (!alpha) return false;
  const rest = undeformArtwork(point, { ...pose, shape: id }), rect = TOY_ARTWORK[id].rect;
  const x = Math.floor((rest.x - rect.x) / rect.width * WIDTH), y = Math.floor((rest.y - rect.y) / rect.height * HEIGHT);
  return x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT && alpha[(y * WIDTH + x) * 4 + 3] > 80;
}
