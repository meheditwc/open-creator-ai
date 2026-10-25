import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const DAEMON_URL = process.env.OPENCREATOR_DAEMON_URL ?? 'http://127.0.0.1:9861';

const allowedHosts = (process.env.OPENCREATOR_ALLOWED_HOSTS ?? '')
  .split(',')
  .map((host) => host.trim())
  .filter(Boolean);

// `*` allows any hostname — handy in sandboxed preview environments where the
// public hostname is dynamic. A leading dot (`".e2b.app"`) matches subdomains.
const allowAnyHost = allowedHosts.includes('*');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@open-creator/shared': fileURLToPath(
        new URL('../../packages/shared/src/index.ts', import.meta.url),
      ),
    },
  },
  server: {
    port: Number(process.env.PORT ?? 19861),
    host: true,
    // Extra hostnames the dev server should answer to (e.g. a preview domain).
    // Empty means Vite's default localhost-only policy.
    ...(allowAnyHost
      ? { allowedHosts: true as const }
      : allowedHosts.length
        ? { allowedHosts }
        : {}),
    proxy: {
      '/api': {
        target: DAEMON_URL,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
});
