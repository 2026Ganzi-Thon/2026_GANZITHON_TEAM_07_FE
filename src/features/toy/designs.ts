import type { ToyType } from '../../lib/domain';

export type Shape = 'drop' | 'pudding' | 'cloud' | 'mochi' | 'toast' | 'star' | 'pearl' | 'heart' | 'gem';
export interface ToyDesign { id: Shape; label: string; light: string; body: string; shade: string; wax: string }
export const TOY_DESIGNS: Record<ToyType, readonly ToyDesign[]> = {
  SLANGI: [
    { id: 'drop', label: '물방울', light: '#fffefb', body: '#f3ede3', shade: '#c8c0b3', wax: '#e7dcca' },
    { id: 'pudding', label: '푸딩', light: '#fff8d8', body: '#e9cb8b', shade: '#b39161', wax: '#e7dcca' },
    { id: 'cloud', label: '구름', light: '#f6fcff', body: '#c9dce5', shade: '#8ba6b5', wax: '#e7dcca' },
  ],
  SQUISHY: [
    { id: 'mochi', label: '모찌', light: '#f5f3ff', body: '#cbd1e1', shade: '#8c93ae', wax: '#e7dcca' },
    { id: 'toast', label: '식빵', light: '#fff4d7', body: '#efdbb8', shade: '#bd936c', wax: '#e7dcca' },
    { id: 'star', label: '별', light: '#fff4ef', body: '#e9bfb5', shade: '#bc8c85', wax: '#e7dcca' },
  ],
  WAKPPU: [
    { id: 'pearl', label: '진주', light: '#f9f6ff', body: '#c7bfdb', shade: '#8b819f', wax: '#e8dfd2' },
    { id: 'heart', label: '하트', light: '#fff2f0', body: '#e6acae', shade: '#ac727a', wax: '#e5c6c1' },
    { id: 'gem', label: '조약돌', light: '#ecf9f6', body: '#aed0c5', shade: '#719c91', wax: '#ccd7d4' },
  ],
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
