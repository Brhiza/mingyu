import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** 源码领域测试与事实审计共用；发布包契约不使用此解析方式。 */
export function runCoreSource(args) {
  const coreDirectory = join(repositoryRoot, 'packages/core');
  const coreManifest = JSON.parse(readFileSync(join(coreDirectory, 'package.json'), 'utf8'));
  const paths = Object.fromEntries(
    Object.entries(coreManifest.exports).map(([subpath, target]) => [
      subpath === '.' ? coreManifest.name : `${coreManifest.name}${subpath.slice(1)}`,
      [
        resolve(
          coreDirectory,
          target.types.replace('./dist/', './src/').replace(/\.d\.ts$/, '.ts'),
        ),
      ],
    ]),
  );
  const temporaryDirectory = mkdtempSync(join(tmpdir(), 'mingyu-core-source-'));
  const tsconfig = join(temporaryDirectory, 'tsconfig.json');
  try {
    writeFileSync(
      tsconfig,
      JSON.stringify({
        extends: join(repositoryRoot, 'tsconfig.app.json'),
        compilerOptions: {
          baseUrl: repositoryRoot,
          paths: {
            '@/*': [join(repositoryRoot, 'src/*')],
            '@core/*': [join(coreDirectory, 'src/*')],
            ...paths,
          },
        },
      }),
    );
    const result = spawnSync(
      process.execPath,
      [join(repositoryRoot, 'node_modules/tsx/dist/cli.mjs'), '--tsconfig', tsconfig, ...args],
      {
        cwd: repositoryRoot,
        env: { ...process.env, TSX_TSCONFIG_PATH: tsconfig },
        stdio: 'inherit',
      },
    );
    if (result.error) console.error(result.error.message);
    return result.status ?? 1;
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.exitCode = runCoreSource(process.argv.slice(2));
}
