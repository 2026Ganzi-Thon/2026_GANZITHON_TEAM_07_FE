import { backend } from './backend';
import { decodeTurn, decodeCompletionId } from './counselingContracts';
export interface EmotionInput { primaryEmotion: string; secondaryEmotion: string | null; preIntensity: number; triggerFactor?: string }
const path = (id: string) => `counseling/sessions/${encodeURIComponent(id)}`;
export const counselingApi = {
  start: async (message: string, signal?: AbortSignal) => decodeTurn(await backend('counseling/sessions', { auth:true, method:'POST', body:{ message }, signal })),
  message: async (id: string, message: string, signal?: AbortSignal) => decodeTurn(await backend(`${path(id)}/messages`, { auth:true, method:'POST', body:{ message }, signal })),
  emotion: async (id: string, input: EmotionInput, signal?: AbortSignal) => decodeTurn(await backend(`${path(id)}/emotion`, { auth:true, method:'POST', body:input, signal })),
  complete: async (id: string, postIntensity: number, missingEmotion?: EmotionInput, signal?: AbortSignal) => decodeCompletionId(await backend(`${path(id)}/complete`, { auth:true, method:'POST', body:{ postIntensity, ...(missingEmotion ?? {}) }, signal })),
  abort: (id: string) => backend(`${path(id)}/abort`, { auth:true, method:'POST' }),
};
