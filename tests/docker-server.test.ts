import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { createDockerServer, resolveStaticFile } from '../server/docker-server';

test('Docker 静态服务只对前端路由回退首页，缺失资源返回空结果', async (t) => {
  const staticRoot = await mkdtemp(path.join(os.tmpdir(), 'mingyu-static-'));
  t.after(() => rm(staticRoot, { recursive: true, force: true }));

  await mkdir(path.join(staticRoot, 'assets'));
  await writeFile(path.join(staticRoot, 'index.html'), '<!doctype html>', 'utf8');
  await writeFile(path.join(staticRoot, 'assets', 'app.js'), 'export {};', 'utf8');

  const asset = await resolveStaticFile('/assets/app.js', staticRoot);
  assert.equal(asset?.filePath, path.join(staticRoot, 'assets', 'app.js'));
  assert.equal(asset?.isSpaFallback, false);

  const route = await resolveStaticFile('/records/personal', staticRoot);
  assert.equal(route?.filePath, path.join(staticRoot, 'index.html'));
  assert.equal(route?.isSpaFallback, true);

  assert.equal(await resolveStaticFile('/assets/missing.js', staticRoot), null);
  assert.equal(await resolveStaticFile('/missing.webmanifest', staticRoot), null);
  assert.equal(await resolveStaticFile('/%2e%2e/secret.txt', staticRoot), null);
});

test('Docker 在线计算读取独立 REST 与 MCP 预设，并使用配置的公共 origin 生成元数据', async (t) => {
  const keys = ['MINGYU_API_PRESET', 'MINGYU_MCP_PRESET', 'MINGYU_PUBLIC_ORIGIN'] as const;
  const previous = keys.map((key) => process.env[key]);
  t.after(() => {
    keys.forEach((key, index) => {
      if (previous[index] === undefined) delete process.env[key];
      else process.env[key] = previous[index];
    });
  });
  process.env.MINGYU_API_PRESET = 'online';
  process.env.MINGYU_MCP_PRESET = 'online';
  process.env.MINGYU_PUBLIC_ORIGIN = 'https://aov.cc';

  const staticRoot = await mkdtemp(path.join(os.tmpdir(), 'mingyu-public-'));
  t.after(() => rm(staticRoot, { recursive: true, force: true }));
  const catalog = JSON.stringify({ tools: [{ name: 'bazi_prompt' }] });
  await writeFile(path.join(staticRoot, 'mcp-tools.json'), catalog, 'utf8');
  const server = createDockerServer(staticRoot);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(
    () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  );
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const origin = `http://127.0.0.1:${address.port}`;

  const manifest = await fetch(`${origin}/api/v1/manifest`, {
    headers: { 'X-Forwarded-Host': 'evil.example', 'X-Forwarded-Proto': 'http' },
  });
  const metadata = await manifest.json();
  assert.equal(metadata.data.baseUrl, 'https://aov.cc/api/v1');
  assert.equal(metadata.data.mcpUrl, 'https://aov.cc/mcp');
  assert.equal(metadata.meta.service, 'aov.cc');

  for (const route of [
    '/api/v1/health',
    '/api/v1/manifest',
    '/api/v1/openapi.json',
    '/api/v1/foundation/capabilities',
    '/.well-known/aov-mingyu-api.json',
  ]) {
    const get = await fetch(`${origin}${route}`);
    const getBody = await get.text();
    const head = await fetch(`${origin}${route}`, { method: 'HEAD' });
    assert.equal(get.status, 200, route);
    assert.equal(head.status, get.status, route);
    for (const header of ['Content-Type', 'Access-Control-Allow-Origin', 'Cache-Control']) {
      assert.equal(head.headers.get(header), get.headers.get(header), `${route} ${header}`);
    }
    assert.equal(await head.text(), '', route);
    if (route.startsWith('/.well-known/')) {
      assert.equal(Number(head.headers.get('Content-Length')), Buffer.byteLength(getBody));
    }
  }

  const toolList = await fetch(`${origin}/mcp-tools.json`);
  assert.equal(toolList.status, 200);
  assert.equal(await toolList.text(), catalog);
  for (const method of ['GET', 'HEAD', 'OPTIONS']) {
    const response = await fetch(`${origin}/mcp-tools.json`, { method });
    assert.equal(response.status, method === 'OPTIONS' ? 204 : 200);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
    assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'GET,HEAD,OPTIONS');
    assert.equal(response.headers.get('Cache-Control'), 'public, max-age=300');
    assert.equal(response.headers.get('Content-Type'), 'application/json; charset=utf-8');
    assert.equal(await response.text(), method === 'GET' ? catalog : '');
  }

  const requestReverse = () =>
    fetch(`${origin}/api/v1/calendar/bazi-reverse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
  const online = await requestReverse();
  assert.equal(online.status, 400);
  assert.equal((await online.json()).error.code, 'RESOURCE_LIMIT');
  process.env.MINGYU_API_PRESET = 'full';
  assert.equal((await (await requestReverse()).json()).error.code, 'BAD_REQUEST');

  const batch = await fetch(`${origin}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([{ jsonrpc: '2.0', id: 1, method: 'tools/list' }]),
  });
  assert.equal(batch.status, 400);
  assert.equal((await batch.json()).error.code, -32600);

  const notification = await fetch(`${origin}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
  });
  assert.equal(notification.status, 202);
  assert.equal(await notification.text(), '');

  const legacy = await fetch(`${origin}/sse`);
  assert.equal(legacy.status, 200);
  assert.equal((await legacy.json()).code, 'USE_STREAMABLE_HTTP');
  const preflight = await fetch(`${origin}/sse`, { method: 'OPTIONS' });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), '*');
});
