import { describe, expect, it } from 'vitest';
import { readApiMode } from './apiMode';

describe('api mode', () => {
  it('defaults to real and switches to mock with Vite --mode mock unless VITE_API_MODE says otherwise', () => {
    expect(readApiMode(undefined, 'development')).toBe('real');
    expect(readApiMode(undefined, 'production')).toBe('real');
    expect(readApiMode(undefined, 'mock')).toBe('mock');
    expect(readApiMode('real', 'mock')).toBe('real');
    expect(() => readApiMode('demo')).toThrow();
  });
});
