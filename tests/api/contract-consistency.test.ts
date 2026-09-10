import test from 'node:test';
import { getToolCatalog } from '../../mcp/src/catalog/tool-catalog';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
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
    'public/skills/aov-mingyu-api/references/providers/aov-mingyu.md',
  );
  const providerRefContent = readFileSync(providerRefPath, 'utf8');

  const rows = [
    ...providerRefContent.matchAll(
      /\| `(?<method>GET|POST) (?<path>\/[^`]+)` \| `(?<id>[^`]+)` \|/g,
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

test('MCP Server 必须完整覆盖所有已公开的核心术式工具', () => {
  const mcpServerPath = existsSync(join(process.cwd(), 'mcp/src/create-server.ts'))
    ? join(process.cwd(), 'mcp/src/create-server.ts')
    : join(process.cwd(), 'mcp/src/server.ts');
  const serverContent = readFileSync(mcpServerPath, 'utf8');

  const requiredToolRegisters = [
    'registerBaziTool',
    'registerZiweiTool',
    'registerBaziZiweiTool',
    'registerLiuyaoTool',
    'registerMeihuaTool',
    'registerXiaoliurenTool',
    'registerJinkoujueTool',
    'registerQimenTool',
    'registerLiurenTool',
    'registerTarotTool',
    'registerSsgwTool',
    'registerAlmanacTool',
    'registerLenormandTool',
    'registerAstrolabeTool',
    'registerBaZhaiTool',
    'registerZodiacTool',
    'registerTaiyiTool',
    'registerWuyunLiuqiTool',
    'registerHuangjiJingshiTool',
    'registerQizhengTool',
    'registerXuanKongTool',
    'registerResidentialFengshuiTool',
    'registerFoundationTools',
    'registerCalendarTools',
    'registerInstantTool',
  ];

  for (const reg of requiredToolRegisters) {
    assert.ok(
      serverContent.includes(reg),
      `MCP Server 中缺失关键工具注册: ${reg}，导致部分术式无法被 MCP 客户端调用`,
    );
  }
});

test('MCP 使用说明中的工具清单必须与真实目录完整对应', () => {
  const readme = readFileSync('mcp/README.md', 'utf8');
  const ids = [...readme.matchAll(/^\| `([^`]+)` \|/gm)].map((match) => match[1]);
  assert.deepEqual(
    ids.sort(),
    getToolCatalog()
      .map((tool) => tool.id)
      .sort(),
  );
});
