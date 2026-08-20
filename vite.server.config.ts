import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@core': path.resolve(__dirname, 'packages/core/src'),
    },
  },
  build: {
    ssr: 'server/docker-server.ts',
    outDir: 'server-dist',
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      output: {
        entryFileNames: 'docker-server.mjs',
        chunkFileNames: 'chunks/[name]-[hash].mjs',
      },
    },
  },
  ssr: {
    noExternal: true,
  },
});
