import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runPnpm } from '../scripts/run-pnpm.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function withPnpmEntry(entry: string, run: () => void) {
  const previous = process.env.npm_execpath;
  process.env.npm_execpath = entry;
  try {
    run();
  } finally {
    if (previous === undefined) delete process.env.npm_execpath;
    else process.env.npm_execpath = previous;
  }
}

test('包管理器调用直接运行原生可执行入口并传递目录、参数和环境', () => {
  const directory = mkdtempSync(join(tmpdir(), 'mingyu-native-entry-'));
  try {
    withPnpmEntry(process.execPath, () => {
      const output = runPnpm(
        [
          '-e',
          'console.log(JSON.stringify([process.cwd(), process.argv[1], process.env.MINGYU_RUNNER_TEST]))',
          '含空格的参数',
        ],
        directory,
        { MINGYU_RUNNER_TEST: 'forwarded' },
      );
      assert.deepEqual(JSON.parse(output), [realpathSync(directory), '含空格的参数', 'forwarded']);
      assert.throws(
        () => runPnpm(['-e', 'console.error("fixture failed"); process.exit(7)'], directory),
        /fixture failed/,
      );
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('包管理器 JS 入口无需 shebang 或执行位，且使用当前 Node', () => {
  const directory = mkdtempSync(join(tmpdir(), 'mingyu-js-entry-'));
  try {
    for (const extension of ['js', 'cjs', 'mjs']) {
      const entry = join(directory, `pnpm fixture.${extension}`);
      writeFileSync(
        entry,
        'console.log(JSON.stringify([process.execPath, ...process.argv.slice(2)]));\n',
        { mode: 0o644 },
      );
      withPnpmEntry(entry, () => {
        assert.deepEqual(
          JSON.parse(runPnpm(['--version', '含空格的参数'], directory, { PATH: directory })),
          [process.execPath, '--version', '含空格的参数'],
        );
      });
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('源码测试与事实审计的包入口、相对源码入口复用同一模块实例', () => {
  const directory = mkdtempSync(join(tmpdir(), 'mingyu-source-contract-'));
  try {
    const fixture = join(directory, 'identity.ts');
    const source = pathToFileURL(
      join(repositoryRoot, 'packages/core/src/bazi/baziCalculator.ts'),
    ).href;
    writeFileSync(
      fixture,
      `
      import assert from 'node:assert/strict';
      import { baziCalculator as direct } from ${JSON.stringify(source)};
      import { baziCalculator as publicApi } from 'mingyu-core/bazi';
      assert.equal(direct, publicApi);
      console.log('shared source instance');
    `,
    );
    const result = spawnSync(
      process.execPath,
      [join(repositoryRoot, 'scripts/run-core-source.mjs'), fixture],
      {
        cwd: directory,
        encoding: 'utf8',
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /shared source instance/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
