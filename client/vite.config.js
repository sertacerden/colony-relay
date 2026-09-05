import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  server: { host: '0.0.0.0', port: 5173, fs: { allow: ['..'] }, proxy: {
    '/socket.io': { target: 'http://localhost:3001', ws: true }
  } },
  build: { target: 'es2022', chunkSizeWarningLimit: 2200 }
});
