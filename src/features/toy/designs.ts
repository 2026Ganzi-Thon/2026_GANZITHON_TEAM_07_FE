import type { ArtworkId } from '../../lib/toyArtwork';
import type { ToyType } from '../../lib/domain';

export type Shape = ArtworkId | 'sheep' | 'drop' | 'pudding' | 'cloud' | 'mochi' | 'toast' | 'star' | 'pearl' | 'heart' | 'gem';
export interface ToyDesign { id: Shape; label: string; light: string; body: string; shade: string; wax: string }
const design = (id: Shape, label: string, body: string, shade: string): ToyDesign => ({ id, label, body, shade, light: '#fffaf5', wax: body });
export const TOY_DESIGNS: Record<ToyType, readonly ToyDesign[]> = {
  SLANGI: [design('slime-lavender', '슬랑이 1', '#d4c4ed', '#9985bb'), design('slime-mint', '슬랑이 2', '#cce6d6', '#91b6a3'), design('slime-pink', '슬랑이 3', '#f4c5d5', '#c78eaa')],
  SQUISHY: [design('sheep', '양', '#f3ede3', '#c8c0b3'), design('pudding-squishy', '푸딩', '#ffe3aa', '#c99851'), design('dumpling', '만두', '#f4e6d7', '#c8ac91')],
  WAKPPU: [design('butter', '버터', '#ffe99b', '#c4a348'), design('heart', '하트', '#ffc5db', '#cc8ca6'), design('wax-cloud', '구름', '#c6dffd', '#86a7d0')],
};
export interface Point { x: number; y: number }
export const TOY_SIZE = { width: 300, height: 290 };
export const CENTER: Point = { x: 150, y: 132 };

/** Original procedural outlines. These are not exported models from the reference site. */
export function outline(shape: Shape, count = 48): Point[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = i / count * Math.PI * 2 - Math.PI / 2;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    if (shape === 'heart') {
      const t = i / count * Math.PI * 2;
      return { x: 150 + 7.1 * 16 * Math.sin(t) ** 3, y: 139 - 6.8 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) };
    }
    let x = cos * 119, y = sin * 102;
    if (shape === 'drop') { x *= 1 - .12 * -sin; y = sin * (sin < 0 ? 105 : 94); }
    if (shape === 'pudding' || shape === 'toast') {
      x = Math.sign(cos) * Math.abs(cos) ** .65 * 108;
      y = Math.sign(sin) * Math.abs(sin) ** .65 * 92;
      if (shape === 'pudding') x *= 1 + sin * .12;
      else if (sin < -.4) y -= 8 * Math.sin((cos + 1) * Math.PI / 2);
    }
    if (shape === 'cloud') { const wave = 1 + .085 * Math.cos(angle * 6); x *= wave; y *= wave * .79; }
    if (shape === 'mochi') y *= .83;
    if (shape === 'star') { const wave = .82 + .18 * Math.cos((angle + Math.PI / 2) * 5); x *= wave; y *= wave; }
    if (shape === 'pearl') { x *= .91; y *= 1.04; }
    if (shape === 'gem') { const wave = 1 + .04 * Math.cos(angle * 6); x *= wave * .95; y *= wave * .95; }
    return { x: CENTER.x + x, y: CENTER.y + y };
  });
}
export function outlinePath(points: Point[]) {
  const mid = (a: Point, b: Point) => `${(a.x + b.x) / 2},${(a.y + b.y) / 2}`;
  return `M${mid(points[points.length - 1], points[0])} ${points.map((p, i) => `Q${p.x},${p.y} ${mid(p, points[(i + 1) % points.length])}`).join(' ')} Z`;
}
