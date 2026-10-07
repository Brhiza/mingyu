import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ListToolsResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { onRequest } from '../../functions/mcp.js';
import {
  generatePagesDiscoveryAssets,
  MCP_TOOL_LIST_PATH,
} from '../../scripts/generate-pages-discovery.js';

function createRequest(message: unknown) {
  return new Request('https://preview.example/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  });
}

test('Pages 首个工具目录请求读取构建产物并保持 SDK 协议校验，无需运行时注册工具', async (t) => {
  const output = await mkdtemp(path.join(os.tmpdir(), 'mingyu-mcp-tools-'));
  try {
    await generatePagesDiscoveryAssets(output);
    const json = await readFile(path.join(output, MCP_TOOL_LIST_PATH.slice(1)), 'utf8');
    const catalog = ListToolsResultSchema.parse(JSON.parse(json));
    assert.ok(catalog.tools.length > 70);
    assert.ok(catalog.tools.find((tool) => tool.name === 'bazi_prompt')?.inputSchema);
    assert.equal(
      catalog.tools.find((tool) => tool.name === 'tarot_prompt')?.annotations?.idempotentHint,
      false,
    );

    let registrationCount = 0;
    t.mock.method(McpServer.prototype, 'registerTool', () => {
      registrationCount += 1;
      throw new Error('静态工具目录请求不应注册工具');
    });
    let fetchCount = 0;
    const assets = {
      async fetch(request: Request) {
        fetchCount += 1;
        assert.equal(request.url, 'https://preview.example/mcp-tools.json');
        return new Response(json, { headers: { 'Content-Type': 'application/json' } });
      },
    };
    const invalid = await onRequest({
      request: createRequest({ jsonrpc: 'invalid', id: 1, method: 'tools/list' }),
      env: { ASSETS: assets },
    });
    assert.equal(invalid.status, 400);
    assert.equal(fetchCount, 0);

    const invalidParams = await onRequest({
      request: createRequest({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: { cursor: 1 },
      }),
      env: { ASSETS: assets },
    });
    assert.equal((await invalidParams.json()).error?.code, -32603);
    assert.equal(fetchCount, 0);

    for (const id of [3, 4]) {
      const response = await onRequest({
        request: createRequest({ jsonrpc: '2.0', id, method: 'tools/list' }),
        env: { ASSETS: assets },
      });
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.id, id);
      assert.deepEqual(body.result, JSON.parse(json));
    }
    assert.equal(fetchCount, 1);
    assert.equal(registrationCount, 0);
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});

test('Pages 静态目录缺失时返回可操作错误，后续请求可重新读取修复后的资源', async () => {
  let fetchCount = 0;
  const assets = {
    async fetch() {
      fetchCount += 1;
      return fetchCount === 1 ? new Response(null, { status: 404 }) : Response.json({ tools: [] });
    },
  };
  for (const id of [1, 2]) {
    const response = await onRequest({
      request: createRequest({ jsonrpc: '2.0', id, method: 'tools/list' }),
      env: { ASSETS: assets },
    });
    const body = await response.json();
    if (id === 1) {
      assert.equal(body.error?.code, -32603);
      assert.match(body.error?.message ?? '', /mcp-tools\.json/);
    } else {
      assert.deepEqual(body.result, { tools: [] });
    }
  }
  assert.equal(fetchCount, 2);
});
