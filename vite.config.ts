import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createReadStream, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

// Review-only media is served from ignored artifacts, never copied into dist/public.
function localWaxAudio() {
  const serve = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const name = /^\/__local-wax__\/(crunch-[123]\.wav)$/.exec(req.url ?? '')?.[1];
    if (!name) return next();
    const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '');
    const file = resolve('artifacts/wax-reference', name);
    if (!local || !existsSync(file)) { res.statusCode = 404; res.end(); return; }
    res.setHeader('Content-Type', 'audio/wav'); res.setHeader('Cache-Control', 'no-store');
    const stream = createReadStream(file); stream.on('error', () => { res.destroy(); }); stream.pipe(res);
  };
  return { name: 'local-wax-audio', configureServer(server: { middlewares: { use: (handler: typeof serve) => void } }) { server.middlewares.use(serve); }, configurePreviewServer(server: { middlewares: { use: (handler: typeof serve) => void } }) { server.middlewares.use(serve); } };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(loadEnv(mode, process.cwd(), 'VITE_').VITE_LOCAL_WAX_REFERENCE === 'true' ? [localWaxAudio()] : [])],
  test: { include: ['src/**/*.test.ts'] },
}));
