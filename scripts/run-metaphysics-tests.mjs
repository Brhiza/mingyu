import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const excludedUnitTests = new Set([
  'astrolabe-algorithm.test.ts',
  'astrolabe-chart.test.ts',
  'astrolabe-lunar-points.test.ts',
  'astrolabe-native-reference.test.ts',
  'astrolabe-scope-modal.test.tsx',
  'astrolabe-scope.test.ts',
  'astrolabe-synastry.test.ts',
  'astronomical-facts.test.ts',
  'astronomical-time.test.ts',
  'moon-phase-evidence.test.ts',
  'solar-illumination-evidence.test.ts',
]);

function testFiles(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.test.ts'))
    .map((entry) => resolve(directory, entry.name));
}

const unitFiles = testFiles(resolve('tests')).filter(
  (file) => !excludedUnitTests.has(file.split(/[\\/]/).at(-1)),
);
const files = [
  ...unitFiles,
  ...testFiles(resolve('tests', 'integration')),
  ...testFiles(resolve('tests', 'exhaustive')),
];

if (files.length === 0) throw new Error('没有找到术数测试文件。');

const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const result = spawnSync(
  pnpm,
  ['exec', 'tsx', '--tsconfig', 'tsconfig.app.json', '--test', '--test-concurrency=1', ...files],
  { stdio: 'inherit' },
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
