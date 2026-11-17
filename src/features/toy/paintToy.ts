import type { ToyDesign, Point } from './designs';
import type { ToyModel } from './physics';

function shapePath(ctx: CanvasRenderingContext2D, points: Point[]) {
  const last = points[points.length - 1], first = points[0];
  ctx.beginPath(); ctx.moveTo((last.x + first.x) / 2, (last.y + first.y) / 2);
  points.forEach((point, i) => { const next = points[(i + 1) % points.length]; ctx.quadraticCurveTo(point.x, point.y, (point.x + next.x) / 2, (point.y + next.y) / 2); });
  ctx.closePath();
}
function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string | CanvasGradient, rotate = 0) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rotate, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
}
function polygon(ctx: CanvasRenderingContext2D, points: Point[]) {
  ctx.beginPath(); points.forEach((point, i) => i ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)); ctx.closePath();
}
let grain: HTMLCanvasElement | null = null;
function surfaceGrain(ctx: CanvasRenderingContext2D, alpha: number) {
  if (!grain) {
    grain = document.createElement('canvas'); grain.width = grain.height = 64;
    const tile = grain.getContext('2d');
    if (!tile) return;
    const pixels = tile.createImageData(64, 64);
    let seed = 0x51a7b;
    for (let i = 0; i < pixels.data.length; i += 4) {
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
      const value = 80 + ((seed >>> 0) % 150);
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value; pixels.data[i + 3] = 255;
    }
    tile.putImageData(pixels, 0, 0);
  }
  const pattern = ctx.createPattern(grain, 'repeat');
  if (pattern) { ctx.save(); ctx.globalAlpha = alpha; ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = pattern; ctx.fillRect(0, 0, 300, 260); ctx.restore(); }
}
export function paintToy(ctx: CanvasRenderingContext2D, model: ToyModel, design: ToyDesign, now: number, reduced: boolean) {
  ctx.clearRect(0, 0, 300, 290);
  const { pull, opacity: depth } = model;
  ctx.save(); ctx.translate(150, 258); ctx.scale(1, .18);
  const shadow = ctx.createRadialGradient(0, 0, 5, 0, 0, 100); shadow.addColorStop(0, '#655f5940'); shadow.addColorStop(1, '#655f5900');
  ellipse(ctx, 0, 0, 102, 102, shadow); ctx.restore();
  const arm = ctx.createLinearGradient(20, 130, 70, 200); arm.addColorStop(0, design.light); arm.addColorStop(1, design.shade);
  if (model.shape === 'drop' || model.shape === 'mochi') {
    ellipse(ctx, 39 + pull.x * .03, 174, 21, 32, arm, .5); ellipse(ctx, 263 + pull.x * .03, 174, 21, 32, arm, -.5);
  }
  shapePath(ctx, model.nodes);
  const body = ctx.createRadialGradient(94 + pull.x * .12, 68, 8, 139, 112, 170);
  body.addColorStop(0, design.light); body.addColorStop(.52, design.body); body.addColorStop(1, design.shade);
  ctx.fillStyle = body; ctx.fill(); ctx.strokeStyle = '#fffaf380'; ctx.lineWidth = 1; ctx.stroke();
  ctx.save(); shapePath(ctx, model.nodes); ctx.clip();
  if (model.shape === 'pudding') {
    const caramel = ctx.createLinearGradient(0, 25, 0, 70); caramel.addColorStop(0, '#a86f48'); caramel.addColorStop(1, '#d4a26388');
    ellipse(ctx, 150 + pull.x * .12, 44 + pull.y * .12, 111, 17, caramel);
  }
  if (model.shape === 'toast') {
    ctx.strokeStyle = '#b07f4b55'; ctx.lineWidth = 14; shapePath(ctx, model.nodes); ctx.stroke();
    for (let i = 0; i < 14; i++) ellipse(ctx, 73 + ((i * 43) % 156), 70 + ((i * 37) % 113), 1.3 + (i % 3) * .5, 1.1, '#b9986844');
  }
  surfaceGrain(ctx, model.type === 'SQUISHY' ? .16 : .06);
  const shine = ctx.createRadialGradient(100 + pull.x * .2, 68 + pull.y * .1, 2, 105, 76, 75);
  shine.addColorStop(0, '#ffffff70'); shine.addColorStop(.6, '#ffffff20'); shine.addColorStop(1, '#ffffff00');
  ellipse(ctx, 104, 74, 85, 69, shine, -.3);
  // A spatial dent/shadow stays at the finger contact, rather than scaling the entire image.
  if (depth > .001) {
    const x = model.anchor.x + pull.x * .52, y = model.anchor.y + pull.y * .52;
    ctx.globalAlpha = depth;
    const dent = ctx.createRadialGradient(x - 3, y - 3, 2, x, y, 43);
    dent.addColorStop(0, '#63596965'); dent.addColorStop(.45, '#75687830'); dent.addColorStop(.79, '#ffffff40'); dent.addColorStop(1, '#ffffff00');
    ellipse(ctx, x, y, 45, 36, dent, Math.atan2(pull.y, pull.x) * .1); ctx.globalAlpha = 1;
  }
  ctx.save(); ctx.translate(pull.x * .13 * model.recovery, pull.y * .13 * model.recovery + depth * 2);
  const cheek = (x: number) => { const g = ctx.createRadialGradient(x, 145, 0, x, 145, 14); g.addColorStop(0, '#d9949188'); g.addColorStop(1, '#d9949100'); ellipse(ctx, x, 145, 16, 9, g); };
  cheek(111); cheek(188);
  ctx.lineCap = 'round'; ctx.strokeStyle = '#665d57'; ctx.lineWidth = 2.8;
  for (const x of [125, 174]) { ctx.beginPath(); ctx.moveTo(x - 7, 126); ctx.quadraticCurveTo(x, 134 - depth * 3, x + 7, 126); ctx.stroke(); }
  ctx.lineWidth = 2.3; ctx.beginPath(); ctx.moveTo(144, 143); ctx.quadraticCurveTo(150, 150, 157, 143); ctx.stroke(); ctx.restore();
  if (model.type === 'WAKPPU') {
    if (model.cracks === 0) {
      const coating = ctx.createRadialGradient(94, 65, 5, 145, 126, 170);
      coating.addColorStop(0, design.light); coating.addColorStop(.55, design.wax); coating.addColorStop(1, design.shade);
      ctx.fillStyle = coating; ctx.fillRect(0, 0, 300, 260); surfaceGrain(ctx, .09);
    }
    model.shards.forEach((shard, i) => {
      if (model.cracks === 0 || shard.brokenAt !== null) return;
      const wax = ctx.createLinearGradient(shard.center.x - 25, shard.center.y - 30, shard.center.x + 40, shard.center.y + 45);
      wax.addColorStop(0, design.light); wax.addColorStop(.42, design.wax); wax.addColorStop(1, design.shade);
      polygon(ctx, shard.polygon); ctx.fillStyle = wax; ctx.fill();
      ctx.strokeStyle = model.cracks > 0 ? '#7f736577' : '#ffffff12'; ctx.lineWidth = model.cracks > 0 ? 1.35 : .5; ctx.stroke();
      if (model.cracks > 0 && i % 3 === 0) {
        ctx.beginPath(); ctx.moveTo(shard.center.x - 7, shard.center.y - 12); ctx.lineTo(shard.center.x + 2, shard.center.y - 3); ctx.lineTo(shard.center.x - 2, shard.center.y + 7); ctx.strokeStyle = '#6e625555'; ctx.lineWidth = .7; ctx.stroke();
      }
    });
  }
  ctx.restore();
  if (!reduced && model.type === 'WAKPPU') for (const shard of model.shards) {
    if (shard.brokenAt === null) continue;
    const t = (now - shard.brokenAt) / 650;
    if (t < 0 || t > 1) continue;
    ctx.save(); ctx.globalAlpha = (1 - t) * .85;
    ctx.translate(shard.center.x + (shard.center.x - 150) * t * .2, shard.center.y + t * t * 40);
    ctx.rotate(t * (shard.center.x > 150 ? .8 : -.8)); ctx.scale(.25 + (1 - t) * .35, .25 + (1 - t) * .35); ctx.translate(-shard.center.x, -shard.center.y);
    polygon(ctx, shard.polygon); ctx.fillStyle = design.wax; ctx.fill(); ctx.strokeStyle = design.shade; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
  }
}
