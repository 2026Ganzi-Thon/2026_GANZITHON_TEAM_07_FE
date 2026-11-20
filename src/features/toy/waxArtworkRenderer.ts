import { createArtworkRenderer } from './artworkRenderer';
import { centroid, splitWaxCell, waxChipPose } from './waxFragments';
import type { ToyModel } from './physics';
import type { ToyDesign, Point } from './designs';
import type { ArtworkRect } from '../../lib/toyArtwork';

function polygon(ctx: CanvasRenderingContext2D, points: Point[]) {
  ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath();
}
/** Supplied PNG is the shell. The soft inner layer is a procedural, alpha-masked fill. */
export function createWaxRenderer(canvas: HTMLCanvasElement, image: HTMLImageElement, rect: ArtworkRect, design: ToyDesign) {
  const ctx = canvas.getContext('2d'); if (!ctx) return null;
  const texture = document.createElement('canvas'); texture.width = image.naturalWidth; texture.height = image.naturalHeight;
  const fill = texture.getContext('2d')!; fill.drawImage(image, 0, 0); fill.globalCompositeOperation = 'source-in';
  const gradient = fill.createRadialGradient(texture.width * .3, texture.height * .2, 0, texture.width * .5, texture.height * .5, texture.width * .7);
  gradient.addColorStop(0, design.light); gradient.addColorStop(.6, design.body); gradient.addColorStop(1, design.shade);
  fill.fillStyle = gradient; fill.fillRect(0, 0, texture.width, texture.height);
  const inner = document.createElement('canvas'); inner.width = canvas.width; inner.height = canvas.height;
  const soft = createArtworkRenderer(inner, texture, true, rect)!;
  // Cloud-only shell tint. Keep the original inner gradient and PNG alpha;
  // a light overlay preserves the shell's highlights and shaded texture.
  const cloudShell = design.id === 'wax-cloud' ? document.createElement('canvas') : null;
  if (cloudShell) {
    cloudShell.width = image.naturalWidth; cloudShell.height = image.naturalHeight;
    const ink = cloudShell.getContext('2d')!;
    ink.drawImage(image, 0, 0); ink.globalCompositeOperation = 'source-atop';
    ink.fillStyle = 'rgba(102,145,199,.12)'; ink.fillRect(0, 0, cloudShell.width, cloudShell.height);
  }
  const shellImage = cloudShell ?? image;
  // Rasterize the full-size PNG once; small chips reuse this screen-sized texture.
  const shell = document.createElement('canvas'); shell.width = 600; shell.height = 580;
  const shellInk = shell.getContext('2d')!; shellInk.scale(2, 2); shellInk.drawImage(shellImage, rect.x, rect.y, rect.width, rect.height);
  // Lazily cache contacted alpha-clipped chips, so idle selection stays inexpensive.
  function chip(points: Point[]) {
    const center = centroid(points);
    const x = Math.floor(Math.min(...points.map(p => p.x))) - 1, y = Math.floor(Math.min(...points.map(p => p.y))) - 1;
    const width = Math.ceil(Math.max(...points.map(p => p.x))) - x + 1, height = Math.ceil(Math.max(...points.map(p => p.y))) - y + 1;
    const tile = document.createElement('canvas'); tile.width = width * 2; tile.height = height * 2;
    const ink = tile.getContext('2d')!; ink.scale(2, 2); ink.translate(-x, -y);
    polygon(ink, points); ink.clip(); ink.drawImage(shell, 0, 0, 300, 290);
    ink.globalCompositeOperation = 'source-atop';
    ink.strokeStyle = 'rgba(255,249,230,.8)';
    ink.lineWidth = .85; ink.stroke();
    return { tile, center, x, y, width, height };
  }
  let chipSource: ToyModel['shards'] | null = null;
  let brokenChips: ReturnType<typeof chip>[][] = [];
  return { kind: 'canvas' as const, draw(model: ToyModel, now: number, reduced: boolean) {
    if ((design.id === 'butter' || design.id === 'heart') && chipSource !== model.shards) {
      brokenChips.forEach(pieces => pieces.forEach(piece => { piece.tile.width = 0; }));
      brokenChips = model.shards.map(() => []); chipSource = model.shards;
    }
    soft.draw({ anchor: model.visualAnchor, pull: model.visualPull, depth: model.opacity, shape: design.id });
    ctx.setTransform(canvas.width / 300, 0, 0, canvas.height / 290, 0, 0); ctx.clearRect(0, 0, 300, 290);
    ctx.drawImage(inner, 0, 0, 300, 290);
    if (!model.cracks) { ctx.drawImage(shellImage, rect.x, rect.y, rect.width, rect.height); return; }
    for (const [index, shard] of model.shards.entries()) {
      if (shard.brokenAt === null) {
        ctx.save(); polygon(ctx, shard.polygon); ctx.clip();
        ctx.drawImage(shellImage, rect.x, rect.y, rect.width, rect.height);
        ctx.restore();
      } else if (!reduced && (design.id === 'butter' || design.id === 'heart')) {
        const origin = centroid(shard.polygon);
        if (!brokenChips[index].length) brokenChips[index] = splitWaxCell(shard.polygon).map(points => chip(points));
        brokenChips[index].forEach((piece, i) => {
          const pose = waxChipPose(piece.center, origin, i, now - shard.brokenAt!);
          if (pose.alpha <= 0) return;
          ctx.save(); ctx.globalAlpha = pose.alpha;
          ctx.translate(piece.center.x + pose.x, piece.center.y + pose.y); ctx.rotate(pose.rotation);
          ctx.scale(1, pose.scaleY); ctx.translate(-piece.center.x, -piece.center.y);
          ctx.shadowColor = 'rgba(77,57,23,.16)'; ctx.shadowBlur = 1.5; ctx.shadowOffsetY = 1;
          ctx.drawImage(piece.tile, piece.x, piece.y, piece.width, piece.height); ctx.restore();
        });
      } else if (!reduced) {
        const t = (now - shard.brokenAt) / 650;
        if (t < 0 || t >= 1) continue;
        ctx.save(); ctx.globalAlpha = (1 - t) * .9;
        ctx.translate(shard.center.x + (shard.center.x - 150) * t * .12, shard.center.y + t * t * 28);
        ctx.rotate(t * (shard.center.x > 150 ? .4 : -.4)); ctx.scale(1 - t * .35, 1 - t * .35); ctx.translate(-shard.center.x, -shard.center.y);
        polygon(ctx, shard.polygon); ctx.clip(); ctx.drawImage(shellImage, rect.x, rect.y, rect.width, rect.height); ctx.restore();
      }
    }
    if (model.shellRestore > 0) {
      ctx.save(); ctx.globalAlpha = model.shellRestore;
      ctx.drawImage(shellImage, rect.x, rect.y, rect.width, rect.height); ctx.restore();
    }
  }, dispose() { brokenChips.flat().forEach(piece => { piece.tile.width = 0; }); soft.dispose(); texture.width = inner.width = shell.width = 0; if (cloudShell) cloudShell.width = 0; } };
}
