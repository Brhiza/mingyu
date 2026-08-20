import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { resolveStaticFile } from '../server/docker-server';

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
