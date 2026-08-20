import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entryPath = path.join(projectRoot, 'server-dist', 'docker-server.mjs');
const port = await getAvailablePort();
const origin = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, [entryPath], {
  cwd: projectRoot,
  env: {
    ...process.env,
    HOST: '127.0.0.1',
    PORT: String(port),
    AI_BUILTIN_ENABLED: 'false',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
child.stdout.on('data', (chunk) => {
  output += chunk.toString('utf8');
});
child.stderr.on('data', (chunk) => {
  output += chunk.toString('utf8');
});

try {
  await waitUntilReady(`${origin}/api/v1/health`, child);

  const missingAsset = await fetch(`${origin}/assets/definitely-missing.js`);
  assert.equal(missingAsset.status, 404);
  assert.match(missingAsset.headers.get('content-type') ?? '', /^text\/plain/);
  assert.equal(missingAsset.headers.get('cache-control'), 'no-store');
  assert.doesNotMatch(await missingAsset.text(), /<!doctype html>/i);

  const spaRoute = await fetch(`${origin}/records`);
  assert.equal(spaRoute.status, 200);
  assert.match(spaRoute.headers.get('content-type') ?? '', /^text\/html/);
  assert.equal(spaRoute.headers.get('cache-control'), 'no-cache');

  const unsupportedMethod = await fetch(`${origin}/`, { method: 'POST' });
  assert.equal(unsupportedMethod.status, 405);
  assert.equal(unsupportedMethod.headers.get('allow'), 'GET,HEAD');

  console.log('Docker 运行时静态资源、SPA 回退和请求方法检查通过。');
} catch (error) {
  if (output.trim()) console.error(output.trim());
  throw error;
} finally {
  child.kill();
  await Promise.race([once(child, 'exit'), delay(3000)]);
  if (child.exitCode === null) child.kill('SIGKILL');
}

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const selectedPort = typeof address === 'object' && address ? address.port : 0;
      server.close((error) => (error ? reject(error) : resolve(selectedPort)));
    });
  });
}

async function waitUntilReady(url, serverProcess) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (serverProcess.exitCode !== null) {
      throw new Error(`Docker 运行时提前退出，退出码 ${serverProcess.exitCode}。`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // 服务仍在启动。
    }
    await delay(100);
  }
  throw new Error('等待 Docker 运行时启动超时。');
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
