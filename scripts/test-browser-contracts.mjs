import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build as buildWithVite } from 'vite';
import webpack from 'webpack';

const repositoryRoot = path.resolve(import.meta.dirname, '..');
const entry = path.join(repositoryRoot, 'tests/browser-contract/ziwei-entry.mjs');
const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'mingyu-browser-contract-'));
await writeFile(path.join(temporaryRoot, 'package.json'), '{"type":"module"}\n', 'utf8');

function assertContract(result, bundler) {
  assert.equal(typeof result.soul, 'string', `${bundler} 紫微命宫结果无效`);
  assert.equal(result.palaceCount, 12, `${bundler} 紫微宫位数量无效`);
  assert.ok(
    result.horoscopeAge !== undefined && result.horoscopeAge !== null,
    `${bundler} 紫微行运结果无效`,
  );
}

async function runViteContract() {
  const outDir = path.join(temporaryRoot, 'vite');
  await buildWithVite({
    configFile: false,
    root: repositoryRoot,
    logLevel: 'error',
    build: {
      outDir,
      emptyOutDir: true,
      target: 'es2022',
      lib: { entry, formats: ['es'], fileName: () => 'index.mjs' },
    },
  });
  const bundle = await import(`${pathToFileURL(path.join(outDir, 'index.mjs')).href}?vite`);
  assertContract(await bundle.runZiweiBrowserContract(), 'Vite');
}

async function runWebpackContract() {
  const outDir = path.join(temporaryRoot, 'webpack');
  const compiler = webpack({
    mode: 'production',
    target: ['web', 'es2022'],
    entry,
    devtool: false,
    experiments: { outputModule: true },
    output: {
      path: outDir,
      filename: 'index.mjs',
      chunkFilename: '[name].mjs',
      module: true,
      library: { type: 'module' },
      clean: true,
    },
  });
  await new Promise((resolve, reject) => {
    compiler.run((error, stats) => {
      compiler.close(() => undefined);
      if (error) return reject(error);
      if (stats?.hasErrors())
        return reject(new Error(stats.toString({ all: false, errors: true })));
      resolve(undefined);
    });
  });
  const bundle = await import(`${pathToFileURL(path.join(outDir, 'index.mjs')).href}?webpack`);
  assertContract(await bundle.runZiweiBrowserContract(), 'Webpack');
}

try {
  await runViteContract();
  await runWebpackContract();
  console.log('Vite 与 Webpack 紫微浏览器契约通过。');
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
