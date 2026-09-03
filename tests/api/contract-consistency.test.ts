import test from 'node:test';
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
    'public/skills/aov-mingyu-api/references/providers/aov-mingyu.md',
  );
  const providerRefContent = readFileSync(providerRefPath, 'utf8');

  // 匹配表格中的所有端点: `/calendar/...`, `/divination/...`, `/metaphysics/...`, `/bazi/...`, `/ziwei/...`
  const endpointRegex =
    /`\/(?:calendar|foundation|instant|bazi|ziwei|bazi-ziwei|divination|metaphysics|ai)\/[^`]+`/g;
  const matches = providerRefContent.match(endpointRegex) || [];

  assert.ok(matches.length > 20, '应当解析出至少 20 个提供方端点映射');

  for (const raw of matches) {
    const apiPath = raw.replace(/`/g, '');
    const isPost = (PUBLIC_API_ENDPOINTS as readonly string[]).includes(`POST /api/v1${apiPath}`);
    const isGet = (PUBLIC_API_ENDPOINTS as readonly string[]).includes(`GET /api/v1${apiPath}`);
    assert.ok(
      isPost || isGet,
      `Skill 适配文档列出了端点 ${apiPath}，但在 PUBLIC_API_ENDPOINTS 中未找到对应 GET 或 POST 路由！`,
    );
  }
});

test('MCP Server 必须完整覆盖所有已公开的核心术式工具', () => {
  const mcpServerPath = join(process.cwd(), 'mcp/src/server.ts');
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
