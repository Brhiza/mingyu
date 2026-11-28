import { cp, mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:net';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const temporary = await mkdtemp(join(tmpdir(), 'mingyu-clean-build-'));
const files = ['src', 'public', 'scripts', 'docs', 'skills', 'examples', 'README.md', 'index.html', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml',
  'tsconfig.json', 'vite.config.ts', 'vite.mcp.config.ts', 'vite.cli.config.ts', 'wrangler.jsonc'];
async function checkDev() {
  const socket = createServer();
  await new Promise((resolve, reject) => { socket.once('error', reject); socket.listen(0, '127.0.0.1', resolve); });
  const port = socket.address().port;
  await new Promise((resolve, reject) => socket.close((error) => error ? reject(error) : resolve()));
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: temporary, stdio: 'ignore' });
  const origin = `http://127.0.0.1:${port}`;
  try {
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (server.exitCode !== null) throw new Error('干净目录开发服务器意外退出。');
      try { if ((await fetch(origin)).ok) { ready = true; break; } } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(ready, '干净目录开发服务器未启动。');
    const core = await fetch(`${origin}/src/core.ts`);
    assert.equal(core.status, 200);
    const script = await core.text();
    assert.doesNotMatch(script, /legacy-dispatch|independent-no-legacy|__MINGYU_INDEPENDENT_ONLY__|packages\/core/);
    const { version } = JSON.parse(await readFile(join(temporary, 'src/data/characters/version.json'), 'utf8'));
    const shard = await fetch(`${origin}/character-data/${version}/definitions-00.json`);
    assert.equal(shard.status, 200); assert.match(shard.headers.get('content-type'), /application\/json/);
    assert.deepEqual(await shard.json(), JSON.parse(await readFile(join(temporary, 'src/data/characters/definitions-00.json'), 'utf8')));
    assert.equal((await fetch(`${origin}/character-data/${'0'.repeat(64)}/definitions-00.json`)).status, 404);
    const asteroidVersion = JSON.parse(await readFile(join(temporary, 'src/systems/astrology/data/version.json'), 'utf8')).version;
    const asteroidUrl = `${origin}/asteroid-data/${asteroidVersion}/ceres.json`;
    const asteroid = await fetch(asteroidUrl);
    assert.equal(asteroid.status, 200); assert.match(asteroid.headers.get('content-type'), /application\/json/);
    assert.ok(Array.isArray((await asteroid.json()).segments));
    assert.equal((await fetch(asteroidUrl, { method: 'HEAD' })).status, 200);
    assert.equal((await fetch(`${origin}/asteroid-data/${'0'.repeat(64)}/ceres.json`)).status, 404);
    assert.equal((await fetch(`${origin}/asteroid-data/${asteroidVersion}/unknown.json`)).status, 404);
    const staticVersion = JSON.parse(await readFile(join(temporary, 'src/data/static-data-version.json'), 'utf8')).version;
    const yilinUrl = `${origin}/static-data/${staticVersion}/yilin.json`;
    const yilinAsset = await fetch(yilinUrl);
    assert.equal(yilinAsset.status, 200); assert.match(yilinAsset.headers.get('content-type'), /application\/json/);
    assert.equal((await yilinAsset.json()).hexagrams.length, 64);
    assert.equal((await fetch(`${origin}/static-data/${'0'.repeat(64)}/yilin.json`)).status, 404);
    console.log('干净目录检查通过：开发网页、按需字库与静态典籍');
  } finally {
    if (server.exitCode === null) {
      const stopped = new Promise((resolve) => server.once('exit', resolve));
      server.kill('SIGTERM'); await stopped;
    }
  }
}
try {
  for (const file of files) await cp(join(root, file), join(temporary, file), { recursive: true,
    filter: (path) => !/^legacy-.*\.ts$/.test(basename(path)) });
  await mkdir(join(temporary, 'tests'));
  const independentTests = (await readdir(join(root, 'tests'))).filter((file) => file.endsWith('.test.ts'));
  assert.ok(independentTests.length, '缺少独立测试文件。');
  for (const file of independentTests) await cp(join(root, 'tests', file), join(temporary, 'tests', file));
  await cp(join(root, 'tests/fixtures'), join(temporary, 'tests/fixtures'), { recursive: true });
  const steps = [
    ['install', '--offline', '--frozen-lockfile'],
    ['test'],
    ['typecheck'], ['build'], ['build:mcp'], ['check:worker-profile'], ['check:mcp-profile'],
  ];
  const runPnpm = (args) => {
    const options = { cwd: temporary, encoding: 'utf8', stdio: 'pipe', timeout: 180_000, maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, FORCE_COLOR: '0' } };
    const candidates = [
      ['pnpm', args],
      ['corepack', ['pnpm', ...args]],
      [join(dirname(process.execPath), 'corepack'), ['pnpm', ...args]],
    ];
    let lastError;
    for (const [command, commandArgs] of candidates) {
      try {
        return execFileSync(command, commandArgs, options);
      } catch (error) {
        lastError = error;
        if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'ENOENT') throw error;
      }
    }
    throw lastError;
  };
  for (const args of steps) {
    try {
      runPnpm(args);
      console.log(`干净目录检查通过：pnpm ${args.join(' ')}`);
      if (args[0] === 'install') {
        const check = `import assert from 'node:assert/strict';import {calculate} from './src/core.ts';import {methodIds} from './src/schema.ts';import {methodExamples} from './scripts/method-examples.mjs';assert.deepEqual(methodIds,Object.keys(methodExamples));const r=await calculate('zhouyi',{query:{kind:'hexagram',id:1}});assert.equal(r.data.result.hexagram.id,1);`;
        execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', check], { cwd: temporary, encoding: 'utf8', stdio: 'pipe', timeout: 30_000 });
        console.log('干净目录检查通过：Node 源码默认独立运行');
        await checkDev();
      }
    } catch (error) {
      if (error && typeof error === 'object') {
        if ('stdout' in error && error.stdout) process.stderr.write(String(error.stdout));
        if ('stderr' in error && error.stderr) process.stderr.write(String(error.stderr));
      }
      throw error;
    }
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
