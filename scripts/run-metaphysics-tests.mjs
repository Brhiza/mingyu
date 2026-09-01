import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

function testFiles(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.test.ts'))
    .map((entry) => resolve(directory, entry.name));
}

const files = [
  ...testFiles(resolve('tests')),
  ...testFiles(resolve('tests', 'integration')),
  ...testFiles(resolve('tests', 'api')),
  ...testFiles(resolve('tests', 'mcp')),
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
