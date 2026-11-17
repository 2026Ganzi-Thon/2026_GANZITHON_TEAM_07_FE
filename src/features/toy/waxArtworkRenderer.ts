import { createArtworkRenderer } from './artworkRenderer';
import { centroid, splitWaxCell, waxChipPose, crumplePose, heartPeel } from './waxFragments';
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
  // Rasterize the full-size PNG once; small chips reuse this screen-sized texture.
  const shell = document.createElement('canvas'); shell.width = 600; shell.height = 580;
  const shellInk = shell.getContext('2d')!; shellInk.scale(2, 2); shellInk.drawImage(image, rect.x, rect.y, rect.width, rect.height);
  const core = document.createElement('canvas'); core.width = 600; core.height = 580;
  const coreInk = core.getContext('2d')!; coreInk.scale(2, 2); coreInk.drawImage(texture, rect.x, rect.y, rect.width, rect.height);
  // Lazily cache contacted alpha-clipped chips, so idle selection stays inexpensive.
  function chip(points: Point[], foldFace?: number) {
    const center = centroid(points);
    const x = Math.floor(Math.min(...points.map(p => p.x))) - 1, y = Math.floor(Math.min(...points.map(p => p.y))) - 1;
    const width = Math.ceil(Math.max(...points.map(p => p.x))) - x + 1, height = Math.ceil(Math.max(...points.map(p => p.y))) - y + 1;
    const tile = document.createElement('canvas'); tile.width = width * 2; tile.height = height * 2;
    const ink = tile.getContext('2d')!; ink.scale(2, 2); ink.translate(-x, -y);
    polygon(ink, points); ink.clip(); ink.drawImage(shell, 0, 0, 300, 290);
    ink.globalCompositeOperation = 'source-atop';
    if (foldFace !== undefined) {
      ink.fillStyle = foldFace % 3 === 0 ? 'rgba(255,255,255,.15)' : foldFace % 3 === 1 ? 'rgba(95,36,52,.12)' : 'rgba(95,36,52,.035)';
      ink.fillRect(x, y, width, height);
    }
    ink.strokeStyle = foldFace === undefined ? 'rgba(255,249,230,.8)' : 'rgba(255,245,246,.5)';
    ink.lineWidth = foldFace === undefined ? .85 : .5; ink.stroke();
    return { tile, center, x, y, width, height };
  }
  let chipSource: ToyModel['shards'] | null = null;
  let brokenChips: ReturnType<typeof chip>[][] = [];
  const folds: { points: Point[]; center: Point; face: number; piece?: ReturnType<typeof chip> }[] = [];
  if (design.id === 'heart') {
    const grid: Point[][] = Array.from({ length: 16 }, (_, row) => Array.from({ length: 16 }, (_, col) => ({
      x: col * 20 + (col > 0 && col < 15 ? Math.sin(row * 3 + col * 7) * 4 : 0),
      y: row * 20 + (row > 0 && row < 15 ? Math.cos(row * 7 + col * 3) * 4 : 0),
    })));
    for (let row = 0; row < 15; row++) for (let col = 0; col < 15; col++) {
      const a = grid[row][col], b = grid[row][col + 1], c = grid[row + 1][col], d = grid[row + 1][col + 1];
      folds.push({ points: [a, b, c], center: centroid([a, b, c]), face: row * 15 + col }, { points: [b, d, c], center: centroid([b, d, c]), face: row * 15 + col + 1 });
    }
  }
  return { kind: 'canvas' as const, draw(model: ToyModel, now: number, reduced: boolean) {
    if (model.waxMode === 'crumple') {
      ctx.setTransform(canvas.width / 300, 0, 0, canvas.height / 290, 0, 0); ctx.clearRect(0, 0, 300, 290);
      ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height);
      if (model.crumple > .001) folds.forEach((fold, i) => {
        const pose = crumplePose(fold.center, model.visualAnchor, model.crumple, i);
        if (pose.weight < .005) return;
        const piece = fold.piece ??= chip(fold.points, fold.face);
        const peeled = heartPeel(fold.center, model.visualAnchor, model.peel ?? 0, i);
        if (peeled > 0) {
          // Replace only this face with the alpha-masked inner colour, then lift its shell above it.
          ctx.save(); polygon(ctx, fold.points); ctx.clip(); ctx.globalAlpha = Math.min(1, peeled * 2);
          ctx.drawImage(core, 0, 0, 300, 290); ctx.restore();
        }
        ctx.save(); ctx.translate(piece.center.x + pose.x, piece.center.y + pose.y);
        ctx.translate(peeled * (i % 2 ? 9 : -9), -peeled * 9);
        ctx.rotate(pose.rotation + peeled * (i % 2 ? .8 : -.8)); ctx.scale(1, pose.scaleY * (1 - peeled * .7)); ctx.translate(-piece.center.x, -piece.center.y);
        ctx.shadowColor = `rgba(78,35,41,${pose.weight * .25})`; ctx.shadowBlur = 1.5; ctx.shadowOffsetY = pose.weight * 2;
        ctx.globalAlpha = Math.min(1, pose.weight * 5) * (1 - peeled * .8);
        ctx.drawImage(piece.tile, piece.x, piece.y, piece.width, piece.height); ctx.restore();
        if (!reduced && model.pointer && peeled > .55) {
          const flutter = ((now - model.pointer.started + i * 83) % 720) / 720;
          ctx.save(); ctx.globalAlpha = peeled * (1 - flutter) * .6;
          ctx.translate(piece.center.x + (i % 2 ? 1 : -1) * flutter * 12, piece.center.y + flutter * flutter * 25);
          ctx.rotate(flutter * (i % 2 ? 1 : -1)); ctx.scale(.3, .3);
          ctx.drawImage(piece.tile, -piece.width / 2, -piece.height / 2, piece.width, piece.height); ctx.restore();
        }
      });
      return;
    }
    if (design.id === 'butter' && chipSource !== model.shards) {
      brokenChips.forEach(pieces => pieces.forEach(piece => { piece.tile.width = 0; }));
      brokenChips = model.shards.map(() => []); chipSource = model.shards;
    }
    soft.draw({ anchor: model.visualAnchor, pull: model.visualPull, depth: model.opacity, shape: design.id });
    ctx.setTransform(canvas.width / 300, 0, 0, canvas.height / 290, 0, 0); ctx.clearRect(0, 0, 300, 290);
    ctx.drawImage(inner, 0, 0, 300, 290);
    if (!model.cracks) { ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height); return; }
    for (const [index, shard] of model.shards.entries()) {
      if (shard.brokenAt === null) {
        ctx.save(); polygon(ctx, shard.polygon); ctx.clip();
        ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height);
        ctx.restore();
      } else if (!reduced && design.id === 'butter') {
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
        polygon(ctx, shard.polygon); ctx.clip(); ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height); ctx.restore();
      }
    }
    if (model.shellRestore > 0) {
      ctx.save(); ctx.globalAlpha = model.shellRestore;
      ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height); ctx.restore();
    }
  }, dispose() { brokenChips.flat().forEach(piece => { piece.tile.width = 0; }); folds.forEach(fold => { if (fold.piece) fold.piece.tile.width = 0; }); soft.dispose(); texture.width = inner.width = shell.width = core.width = 0; } };
}
