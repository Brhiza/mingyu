import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: false,
  define: { __MINGYU_BROWSER_ASSETS__: 'false', __MINGYU_WORKER_ASSETS__: 'false' },
  ssr: { target: 'node', noExternal: true },
  build: {
    ssr: 'src/mcp-stdio.ts',
    outDir: 'dist-mcp',
    target: 'node20',
    manifest: true,
    rollupOptions: { output: { entryFileNames: 'server.mjs', chunkFileNames: 'chunks/[name]-[hash].mjs' } },
  },
});
