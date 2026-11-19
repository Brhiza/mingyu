import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: false,
  define: { __MINGYU_BROWSER_ASSETS__: 'false', __MINGYU_WORKER_ASSETS__: 'false' },
  ssr: { target: 'node', noExternal: true },
  build: {
    ssr: 'src/cli.ts',
    outDir: 'dist-cli',
    target: 'node20',
    minify: 'esbuild',
    rollupOptions: {
      output: {
        entryFileNames: 'mingyu.mjs',
        inlineDynamicImports: true,
      },
    },
  },
});
