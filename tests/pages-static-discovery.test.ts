import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  generatePagesDiscoveryAssets,
  PAGES_DISCOVERY_PATHS,
} from '../scripts/generate-pages-discovery';

test('Pages 静态发现产物与免调用路由一致，预览和自部署使用当前站点相对地址', async () => {
  const output = await mkdtemp(path.join(os.tmpdir(), 'mingyu-discovery-'));
  try {
    await generatePagesDiscoveryAssets(output);
    const routes = JSON.parse(await readFile('public/_routes.json', 'utf8'));
    const documents = await Promise.all(
      PAGES_DISCOVERY_PATHS.map(async (route) => {
        assert.ok(routes.exclude.includes(route), `${route} 应由静态资产直接处理`);
        return JSON.parse(await readFile(path.join(output, route.slice(1)), 'utf8'));
      }),
    );
    const [health, manifest, openapi, capabilities, wellKnown] = documents;
    assert.equal(health.data.status, 'ok');
    assert.equal(health.data.timestampKind, 'build');
    assert.ok(Number.isFinite(Date.parse(health.data.timestamp)));
    assert.equal(manifest.data.baseUrl, '/api/v1');
    assert.equal(manifest.data.mcpUrl, '/mcp');
    assert.deepEqual(openapi.data.servers, [{ url: '/api/v1' }]);
    assert.ok(Object.keys(openapi.data.paths).length > 50);
    assert.ok(capabilities.ok);
    assert.deepEqual(wellKnown, manifest.data);
    assert.ok(routes.include.includes('/mcp'));
    assert.ok(routes.include.includes('/api/v1/*'));
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});
