export type ApiMode = 'mock' | 'real';

/**
 * real: auth, counseling and records use the backend; preview inventory stays local.
 * mock: every request is a local MSW example (`npm run dev:mock` / `build:mock`, i.e. Vite
 * `--mode mock`). An explicit VITE_API_MODE wins over the Vite mode. Unknown values fail at boot.
 */
export function readApiMode(value: string | undefined, viteMode?: string): ApiMode {
  const mode = value ?? (viteMode === 'mock' ? 'mock' : 'real');
  if (mode !== 'mock' && mode !== 'real') throw new Error(`지원하지 않는 VITE_API_MODE 값이에요: ${mode}`);
  return mode;
}

export const API_MODE: ApiMode = import.meta.env.VITE_API_MODE === 'mock' || (!import.meta.env.VITE_API_MODE && import.meta.env.MODE === 'mock') ? 'mock' : 'real';
/** Empty means same origin: Vite locally and vercel.json on Vercel proxy /api to the backend. */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');
