import type { ToyType } from './domain';

export interface ArtworkRect { x: number; y: number; width: number; height: number }
const root = '/assets/design/';
export const TOY_ARTWORK = {
  sheep: { src: `${root}sheep-squishy.png`, rect: { x: 0, y: 45, width: 300, height: 200 } },
  'slime-lavender': { src: `${root}slime-lavender.png`, rect: { x: 22.891, y: 22.640, width: 248.623, height: 253.168 } },
  'slime-mint': { src: `${root}slime-mint.png`, rect: { x: 22.444, y: 15.621, width: 254.039, height: 258.684 } },
  'slime-pink': { src: `${root}slime-pink.png`, rect: { x: 34.402, y: 28.410, width: 236.519, height: 240.844 } },
  'pudding-squishy': { src: `${root}pudding-squishy.png`, rect: { x: 15.293, y: 58.159, width: 269.413, height: 179.681 } },
  dumpling: { src: `${root}dumpling.png`, rect: { x: -19.762, y: 31.205, width: 340.189, height: 226.941 } },
  butter: { src: `${root}butter.png`, rect: { x: 11.419, y: 51.860, width: 274.482, height: 182.988 } },
  heart: { src: `${root}heart.png`, rect: { x: 28.625, y: 27.740, width: 241.821, height: 224.362 } },
  'wax-cloud': { src: `${root}wax-cloud.png`, rect: { x: .194, y: 45.771, width: 297.674, height: 198.450 } },
} satisfies Record<string, { src: string; rect: ArtworkRect }>;
export type ArtworkId = keyof typeof TOY_ARTWORK;
export const isArtwork = (id: string): id is ArtworkId => Object.hasOwn(TOY_ARTWORK, id);
export const DEFAULT_ARTWORK: Record<ToyType, ArtworkId> = { SLANGI: 'slime-lavender', SQUISHY: 'sheep', WAKPPU: 'butter' };
