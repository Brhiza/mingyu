import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';

function runStep(label, command, args, extraEnv = {}) {
  console.log(`\n==> [${label}]`);
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env: { ...process.env, ...extraEnv },
    });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} failed (${signal ?? code})`));
    });
  });
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

async function waitForServerReady(url, proc) {
  for (let i = 0; i < 100; i++) {
    if (proc.exitCode !== null) {
      throw new Error(`预览服务意外提前退出（code=${proc.exitCode}）`);
    }
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`等待预览服务就绪超时：${url}`);
}

const testFiles = readdirSync('tests')
  .filter((file) => file.endsWith('.test.ts'))
  .sort()
  .map((file) => join('tests', file));

await runStep('typecheck', './node_modules/.bin/tsc', ['--noEmit']);
await runStep('test', process.execPath, ['--import', 'tsx', '--test', ...testFiles]);
await runStep('build', process.execPath, ['./node_modules/vite/bin/vite.js', 'build']);
await runStep('build:mcp', process.execPath, [
  './node_modules/vite/bin/vite.js',
  'build',
  '--config',
  'vite.mcp.config.ts',
]);
await runStep('build:cli', process.execPath, [
  './node_modules/vite/bin/vite.js',
  'build',
  '--config',
  'vite.cli.config.ts',
]);
await runStep('check:mcp-profile', process.execPath, ['scripts/check-mcp-profile.mjs']);
await runStep('check:worker-profile', process.execPath, ['scripts/check-worker-profile.mjs']);

const port = await getFreePort();
const origin = `http://127.0.0.1:${port}/`;
console.log(`\n==> [preview] ${origin}`);
const preview = spawn(
  process.execPath,
  ['./node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  { stdio: 'ignore' },
);

try {
  await waitForServerReady(origin, preview);
  await runStep('check:browser-ai', process.execPath, ['scripts/check-browser-ai.mjs'], {
    MINGYU_BROWSER_TEST_URL: origin,
  });
  await runStep('check:browser-form', process.execPath, ['scripts/check-browser-form.mjs'], {
    MINGYU_BROWSER_TEST_URL: origin,
  });
} finally {
  if (preview.exitCode === null) {
    const closed = new Promise((resolve) => preview.once('exit', resolve));
    preview.kill('SIGTERM');
    await Promise.race([closed, new Promise((r) => setTimeout(r, 1500))]);
    if (preview.exitCode === null) preview.kill('SIGKILL');
  }
}

console.log('\n全套质检（类型检查 + 单元测试 + 三端构建 + MCP/Worker + 端到端浏览器）全部通过。');
