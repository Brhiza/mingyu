import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runPnpm } from '../scripts/run-pnpm.mjs';
import { getCoreTestFiles } from '../packages/core/scripts/run-core-tests.mjs';
import { getCiTestFiles } from '../scripts/run-ci-tests.mjs';

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

test('CI 分轨保持原完整集合，仅省略同源码领域文件的第二次调度', () => {
  const manifest = JSON.parse(readFileSync(join(repositoryRoot, 'package.json'), 'utf8'));
  assert.deepEqual(
    [...manifest.scripts['test:ci:run'].matchAll(/"([^"]+)"/gu)].map((match) => match[1]),
    [
      'tests/*.test.ts',
      'tests/*.test.tsx',
      'tests/integration/*.test.ts',
      'tests/api/*.test.ts',
      'tests/mcp/*.test.ts',
    ],
  );
  const expectedFiles = ['', 'integration', 'api', 'mcp']
    .flatMap((directory) =>
      readdirSync(join(repositoryRoot, 'tests', directory), { withFileTypes: true })
        .filter(
          (entry) =>
            entry.isFile() &&
            (directory ? entry.name.endsWith('.test.ts') : /\.test\.tsx?$/u.test(entry.name)),
        )
        .map((entry) => ['tests', directory, entry.name].filter(Boolean).join('/')),
    )
    .sort();
  const all = getCiTestFiles();
  const core = getCoreTestFiles();
  const application = getCiTestFiles({ applicationOnly: true });
  assert.deepEqual(all, expectedFiles);
  assert.equal(new Set(core).size, core.length);
  assert.equal(new Set(application).size, application.length);
  assert.deepEqual([...new Set([...core, ...application])].sort(), all);
  const coreSet = new Set(core);
  const overlap = application.filter((file: string) => coreSet.has(file));
  assert.equal(overlap.length, 55);
  assert.ok(overlap.includes('tests/fortune-selection.test.ts'));
  assert.ok(overlap.includes('tests/core-compatibility-bundle.test.ts'));
  assert.equal(application.includes('tests/core-birth-bundle.test.ts'), false);
  assert.equal(application.includes('tests/qimen-lifetime-timezone.test.ts'), false);
  assert.ok(application.includes('tests/prompt-application-contract.test.ts'));
  const workflow = readFileSync(join(repositoryRoot, '.github/workflows/ci.yml'), 'utf8');
  assert.match(workflow, /pnpm test:core:run\s+- run: pnpm test:app:run/u);
  const listed = spawnSync(
    process.execPath,
    [join(repositoryRoot, 'scripts/run-ci-tests.mjs'), '--application', '--list'],
    { cwd: tmpdir(), encoding: 'utf8' },
  );
  assert.equal(listed.status, 0, listed.stderr);
  assert.deepEqual(listed.stdout.trim().split(/\r?\n/u), application);
});

test('CI 入口经符号链接仍可列出测试，导入模块不会执行测试或准备数据', () => {
  const directory = mkdtempSync(join(tmpdir(), 'mingyu-runner-link-'));
  try {
    for (const [entry, expected] of [
      ['scripts/run-ci-tests.mjs', getCiTestFiles()],
      ['packages/core/scripts/run-core-tests.mjs', getCoreTestFiles()],
    ] as const) {
      const target = join(repositoryRoot, entry);
      const alias = join(directory, entry.startsWith('scripts/') ? 'app.mjs' : 'core.mjs');
      symlinkSync(target, alias);
      const listed = spawnSync(process.execPath, [alias, '--list'], {
        cwd: directory,
        encoding: 'utf8',
      });
      assert.equal(listed.status, 0, listed.stderr);
      assert.deepEqual(listed.stdout.trim().split(/\r?\n/u), expected);
      const imported = spawnSync(
        process.execPath,
        [
          '--input-type=module',
          '-e',
          `await import(${JSON.stringify(pathToFileURL(target).href)})`,
          'non-path-argument',
        ],
        { cwd: directory, encoding: 'utf8' },
      );
      assert.equal(imported.status, 0, imported.stderr);
      assert.equal(imported.stdout, '');
      assert.equal(imported.stderr, '');
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
