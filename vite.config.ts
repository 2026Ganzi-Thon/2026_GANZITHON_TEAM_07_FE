import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import type { ProxyOptions } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  // Same-origin /api in local dev/preview, forwarded to the deployed backend by default (Railway, 2026-11-18).
  // Its CORS list allows localhost:5173 but not 127.0.0.1:5173 (our dev host), so the proxy drops the browser
  // Origin header. Set VITE_API_PROXY_TARGET=http://127.0.0.1:8080 to use a locally running backend instead.
  const api: ProxyOptions = {
    target: env.VITE_API_PROXY_TARGET || 'https://malangi.up.railway.app',
    changeOrigin: true,
    configure: proxy => { proxy.on('proxyReq', request => request.removeHeader('origin')); },
  };
  return {
    plugins: [react()],
    server: { proxy: { '/api': api } },
    preview: { proxy: { '/api': api } },
    test: { include: ['src/**/*.test.ts'] },
  };
});
