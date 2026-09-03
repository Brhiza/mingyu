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
    ssr: 'mcp/src/server.ts',
    outDir: 'packages/mcp/dist',
    emptyOutDir: true,
    target: 'node18',
    rollupOptions: {
      output: {
        entryFileNames: 'server.js',
      },
    },
  },
  ssr: {
    noExternal: true,
  },
});
