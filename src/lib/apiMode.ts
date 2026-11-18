export type ApiMode = 'mock' | 'real';

/** mock: every request is a local MSW example. real: auth uses the backend; features not yet connected stay on MSW examples. */
export function readApiMode(value: string | undefined): ApiMode {
  const mode = value ?? 'mock';
  if (mode !== 'mock' && mode !== 'real') throw new Error(`지원하지 않는 VITE_API_MODE 값이에요: ${mode}`);
  return mode;
}

export const API_MODE: ApiMode = import.meta.env.VITE_API_MODE === 'real' ? 'real' : 'mock';
/** Empty means same origin: the Vite dev/preview proxy forwards /api to the backend. */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');
