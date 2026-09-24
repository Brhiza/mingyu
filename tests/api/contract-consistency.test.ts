import test from 'node:test';
import { getToolCatalog } from '../../mcp/src/catalog/tool-catalog';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PUBLIC_API_ENDPOINTS,
  DEFAULT_PUBLIC_API_RUNTIME,
} from '../../src/lib/public-api/metadata';
import { getPublicApiOpenApiDocument } from '../../src/lib/public-api/handler';

test('公开 API 端点与 OpenAPI 规范定义必须 100% 双向对齐', () => {
  const doc = getPublicApiOpenApiDocument(DEFAULT_PUBLIC_API_RUNTIME);
  const openApiPaths = Object.keys(doc.paths);

  // 1. 验证 OpenAPI paths 都在 PUBLIC_API_ENDPOINTS 中登记
  for (const path of openApiPaths) {
    // 例如 '/divination/{method}/prompt' 是通配模板，在 PUBLIC_API_ENDPOINTS 中展开为各具体 method
    if (path.includes('{method}')) continue;

    const methods = Object.keys((doc.paths as Record<string, unknown>)[path] || {});
    for (const m of methods) {
      const entry = `${m.toUpperCase()} /api/v1${path}`;
      assert.ok(
        (PUBLIC_API_ENDPOINTS as readonly string[]).includes(entry),
        `OpenAPI 声明了端点 ${entry}，但未在 PUBLIC_API_ENDPOINTS 白名单中登记`,
      );
    }
  }

  // 2. 验证 PUBLIC_API_ENDPOINTS 里的业务端点都在 OpenAPI 中有对应路由定义
  for (const endpoint of PUBLIC_API_ENDPOINTS) {
    const [, fullUrl] = endpoint.split(' ');
    // 忽略非 /api/v1 路径
    if (!fullUrl.startsWith('/api/v1/')) continue;
    const subPath = fullUrl.replace('/api/v1', '');

    const hasExact = openApiPaths.includes(subPath);
    const hasWildcard =
      subPath.startsWith('/divination/') &&
      subPath.endsWith('/prompt') &&
      openApiPaths.includes('/divination/{method}/prompt');

    assert.ok(
      hasExact || hasWildcard,
      `PUBLIC_API_ENDPOINTS 登记了 ${endpoint}，但在 OpenAPI paths 中缺失相应路由定义`,
    );
  }
});

test('Skill 数据提供方适配文档中的端点必须全部在 PUBLIC_API_ENDPOINTS 中合法有效', () => {
  const providerRefPath = join(
    process.cwd(),
    'public/skills/mingyu/references/providers/aov-mingyu.md',
  );
  const providerRefContent = readFileSync(providerRefPath, 'utf8');

  const rows = [
    ...providerRefContent.matchAll(
      /\|\s*`(?<method>GET|POST) (?<path>\/[^`]+)`\s*\|\s*`(?<id>[^`]+)`\s*\|/g,
    ),
  ];
  const catalog = getToolCatalog();
  assert.deepEqual(rows.map((row) => row.groups!.id).sort(), catalog.map((tool) => tool.id).sort());
  for (const row of rows) {
    const { method, path, id } = row.groups!;
    assert.ok(
      (PUBLIC_API_ENDPOINTS as readonly string[]).includes(`${method} /api/v1${path}`),
      `${id} HTTP 方法或路径失效`,
    );
    assert.equal(catalog.find((tool) => tool.id === id)?.endpoint, path, `${id} 映射不一致`);
  }
});

test('MCP 使用说明中的工具清单必须与真实目录完整对应', () => {
  const readme = readFileSync('mcp/README.md', 'utf8');
  const ids = [...readme.matchAll(/^\| `([^`]+)`\s*\|/gm)].map((match) => match[1]);
  assert.deepEqual(
    ids.sort(),
    getToolCatalog()
      .map((tool) => tool.id)
      .sort(),
  );
});
