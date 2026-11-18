import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import type { ProxyOptions } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  // Same-origin /api in local dev/preview. The backend's CORS list does not include 127.0.0.1:5173,
  // so the proxy drops the browser Origin header; deployed builds use VITE_API_BASE_URL + backend CORS instead.
  const api: ProxyOptions = {
    target: env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8080',
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
