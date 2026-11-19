import { defineConfig, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { characterVersion } from './scripts/character-version.mjs';
import { asteroidAssets } from './scripts/asteroid-version.mjs';
import { generateApiDocsHtml, generateApiDocsMarkdown } from './scripts/generate-api-docs';
import { generateOpenApiDocument } from './scripts/generate-openapi';
import { buildSkillZipBuffer } from './scripts/build-skill-package.mjs';

interface VersionedAssetSpec {
  name: string;
  urlPrefix: string;
  outputPrefix: string;
  directory: string;
  mismatchMessage: string;
  filePattern: RegExp;
  loadAssets: (directory: string) => { version: string; files: Record<string, string | Buffer> };
}

function versionedJsonAssetsPlugin(spec: VersionedAssetSpec): Plugin {
  const verify = () => {
    const { version } = JSON.parse(readFileSync(join(spec.directory, 'version.json'), 'utf8')) as { version: string };
    const loaded = spec.loadAssets(spec.directory);
    if (!/^[a-f0-9]{64}$/.test(version) || loaded.version !== version) {
      throw new Error(spec.mismatchMessage);
    }
    return loaded;
  };
  return {
    name: spec.name,
    configureServer(server: ViteDevServer) {
      const { version, files } = verify();
      server.middlewares.use(spec.urlPrefix, (request, response) => {
        const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
        const match = new RegExp(`^/([a-f0-9]{64})/(${spec.filePattern.source})$`).exec(pathname);
        if (!['GET', 'HEAD'].includes(request.method ?? '') || !match || match[1] !== version || !Object.hasOwn(files, match[2])) {
          response.statusCode = 404;
          response.end('Not found');
          return;
        }
        response.setHeader('content-type', 'application/json; charset=utf-8');
        response.setHeader('cache-control', 'no-store');
        response.end(request.method === 'HEAD' ? undefined : files[match[2]]);
      });
    },
    generateBundle() {
      const { version, files } = verify();
      for (const [name, source] of Object.entries(files)) {
        this.emitFile({ type: 'asset', fileName: `${spec.outputPrefix}/${version}/${name}`, source });
      }
    },
  };
}

// Worker 与独立网页共用静态字库和小行星星历；本地 MCP 按需加载本地模块。
const characterAssets = versionedJsonAssetsPlugin({
  name: 'character-dictionary-assets',
  urlPrefix: '/character-data/',
  outputPrefix: 'character-data',
  directory: fileURLToPath(new URL('./src/data/characters/', import.meta.url)),
  mismatchMessage: '字库版本与内容不一致；运行 pnpm data:character-version 更新。',
  filePattern: /(?:definitions|references)-(?:0\d|[12]\d|3[01])\.json/,
  loadAssets: (directory) => ({
    version: characterVersion(directory),
    files: Object.fromEntries(
      readdirSync(directory)
        .filter((file) => /^(definitions|references)-\d\d\.json$/.test(file))
        .map((file) => [file, readFileSync(join(directory, file))]),
    ),
  }),
});

const asteroidData = versionedJsonAssetsPlugin({
  name: 'asteroid-data-assets',
  urlPrefix: '/asteroid-data/',
  outputPrefix: 'asteroid-data',
  directory: fileURLToPath(new URL('./src/systems/astrology/data/', import.meta.url)),
  mismatchMessage: '小行星星历版本与内容不一致；运行 node scripts/asteroid-version.mjs --write。',
  filePattern: /(?:ceres|pallas|juno|vesta)\.json/,
  loadAssets: (directory) => {
    const { version, assets } = asteroidAssets(directory);
    return { version, files: assets as Record<string, string> };
  },
});

function aiConnectArtifactsPlugin(): Plugin {
  const rootDir = dirname(fileURLToPath(import.meta.url));
  let cachedZip: Buffer | undefined;

  return {
    name: 'mingyu-ai-connect-artifacts',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((request, response, next) => {
        const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
        const method = request.method ?? 'GET';
        if (!['GET', 'HEAD'].includes(method)) {
          next();
          return;
        }
        if (pathname === '/api-docs' || pathname === '/api-docs/' || pathname === '/api-docs/index.html') {
          const html = generateApiDocsHtml();
          response.setHeader('content-type', 'text/html; charset=utf-8');
          response.setHeader('cache-control', 'no-store');
          response.end(method === 'HEAD' ? undefined : html);
          return;
        }
        if (pathname === '/api-docs.md') {
          const host = request.headers.host;
          const base = host ? `http://${host}` : 'https://your-mingyu-domain.example';
          const md = generateApiDocsMarkdown(base);
          response.setHeader('content-type', 'text/markdown; charset=utf-8');
          response.setHeader('cache-control', 'no-store');
          response.end(method === 'HEAD' ? undefined : md);
          return;
        }
        if (pathname === '/openapi.json') {
          const host = request.headers.host;
          const base = host ? `http://${host}` : 'https://your-mingyu-domain.example';
          const spec = JSON.stringify(generateOpenApiDocument(base), null, 2);
          response.setHeader('content-type', 'application/json; charset=utf-8');
          response.setHeader('access-control-allow-origin', '*');
          response.setHeader('cache-control', 'no-store');
          response.end(method === 'HEAD' ? undefined : spec);
          return;
        }
        if (pathname === '/downloads/mingyu-skill.zip') {
          if (!cachedZip) {
            cachedZip = buildSkillZipBuffer(rootDir, { rebuildCli: true });
          }
          response.setHeader('content-type', 'application/zip');
          response.setHeader('content-disposition', 'attachment; filename="mingyu-skill.zip"');
          response.setHeader('content-length', String(cachedZip.length));
          response.setHeader('cache-control', 'no-store');
          response.end(method === 'HEAD' ? undefined : cachedZip);
          return;
        }
        next();
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'api-docs/index.html', source: generateApiDocsHtml() });
      this.emitFile({ type: 'asset', fileName: 'api-docs.md', source: generateApiDocsMarkdown() });
      this.emitFile({ type: 'asset', fileName: 'openapi.json', source: JSON.stringify(generateOpenApiDocument(), null, 2) });
      const zipBuffer = buildSkillZipBuffer(rootDir, { rebuildCli: true });
      this.emitFile({ type: 'asset', fileName: 'downloads/mingyu-skill.zip', source: zipBuffer });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), characterAssets, asteroidData, aiConnectArtifactsPlugin()],
  define: { __MINGYU_BROWSER_ASSETS__: 'true', __MINGYU_WORKER_ASSETS__: 'false' },
  worker: { format: 'es' },
  build: {
    outDir: 'dist-independent',
    manifest: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) {
            return 'vendor-react';
          }
          if (id.includes('/@radix-ui/') || id.includes('/lucide-react/')) {
            return 'vendor-ui';
          }
          if (id.includes('/astronomy-engine/') || id.includes('/caelus/')) {
            return 'vendor-astronomy';
          }
          if (id.includes('/tyme4ts/')) {
            return 'vendor-tyme';
          }
          if (id.includes('/zod/')) {
            return 'vendor-zod';
          }
          return 'vendor-misc';
        },
      },
    },
  },
});
