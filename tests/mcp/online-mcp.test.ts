import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../../functions/mcp.js';

test('在线 MCP 端点 (functions/mcp.ts) 应正确处理 OPTIONS、GET 健康检查与 JSON-RPC 工具请求', async () => {
  // 1. OPTIONS CORS 预检
  const optionsRes = await onRequest({
    request: new Request('https://aov.cc/mcp', {
      method: 'OPTIONS',
    }),
  });
  assert.equal(optionsRes.status, 204);
  assert.equal(optionsRes.headers.get('access-control-allow-origin'), '*');

  // 2. 浏览器直接访问 GET /mcp
  const getRes = await onRequest({
    request: new Request('https://aov.cc/mcp', {
      method: 'GET',
      headers: {
        Accept: 'text/html,application/xhtml+xml',
      },
    }),
  });
  assert.equal(getRes.status, 200);
  const getJson = await getRes.json();
  assert.equal(getJson.status, 'ok');
  assert.equal(getJson.service, 'mingyu-mcp-server');
  assert.equal(getJson.endpoint, '/mcp');

  // 3. POST initialize 初始化协议
  const initRes = await onRequest({
    request: new Request('https://aov.cc/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'online-test-client', version: '1.0.0' },
        },
      }),
    }),
  });
  assert.equal(initRes.status, 200);
  const initJson = await initRes.json();
  assert.equal(initJson.jsonrpc, '2.0');
  assert.equal(initJson.id, 1);
  assert.equal(initJson.result?.serverInfo?.name, 'mingyu-mcp-server');

  // 4. POST tools/list 获取工具列表
  const listRes = await onRequest({
    request: new Request('https://aov.cc/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {},
      }),
    }),
  });
  assert.equal(listRes.status, 200);
  const listJson = await listRes.json();
  assert.ok(Array.isArray(listJson.result?.tools));
  assert.equal(listJson.result.tools.length >= 63, true);

  // 5. POST tools/call 执行排盘工具
  const callRes = await onRequest({
    request: new Request('https://aov.cc/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'foundation_capabilities',
          arguments: {},
        },
      }),
    }),
  });
  assert.equal(callRes.status, 200);
  const callJson = await callRes.json();
  assert.equal(callJson.result?.isError, undefined);
  assert.ok(callJson.result?.structuredContent || callJson.result?.content);
});
