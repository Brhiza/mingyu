import { existsSync, readdirSync, readFileSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '../../..');
const testsDir = join(repoRoot, 'tests');

const CORE_IMPORT_PATTERNS = [/packages\/core\/src/, /mingyu-core/, /@core\//];
const INTEGRATION_TEST_PATHS = [/^tests\/mcp\//, /^tests\/public-api(?:-docs)?\.test\.ts$/];

function walkTests(dir) {
  const result = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...walkTests(fullPath));
      continue;
    }
    if (/\.test\.tsx?$/.test(entry.name)) {
      result.push(fullPath);
    }
  }
  return result;
}

if (!existsSync(testsDir)) {
  console.error('未找到 tests 目录，无法运行 mingyu-core 回归测试。');
  process.exit(1);
}

const files = walkTests(testsDir)
  .filter((filePath) => {
    const relativePath = relative(repoRoot, filePath).replace(/\\/g, '/');
    if (INTEGRATION_TEST_PATHS.some((pattern) => pattern.test(relativePath))) {
      return false;
    }
    const content = readFileSync(filePath, 'utf8');
    return CORE_IMPORT_PATTERNS.some((pattern) => pattern.test(content));
  })
  .map((filePath) => relative(repoRoot, filePath).replace(/\\/g, '/'))
  .sort();

if (files.length === 0) {
  console.error('未发现引用 mingyu-core 的测试文件，请检查测试发现规则。');
  process.exit(1);
}

console.log(`运行 ${files.length} 个 mingyu-core 单元与算法测试文件。`);
console.log('公开 API 与 MCP 集成测试由根目录 test:api、test:mcp 分层执行。');

console.log('先构建 mingyu-core，确保包导出测试使用最新 dist 产物。');
const buildResult = spawnSync('pnpm', ['--filter', 'mingyu-core', 'build'], {
  cwd: repoRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if ((buildResult.status ?? 1) !== 0) {
  process.exit(buildResult.status ?? 1);
}

const result = spawnSync(
  'pnpm',
  ['exec', 'tsx', '--tsconfig', 'tsconfig.app.json', '--test', ...files],
  {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  },
);

process.exit(result.status ?? 1);
