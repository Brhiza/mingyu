import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { startHttpServer, type HttpServerInstance } from '../../mcp/src/http-server.js';

test('Remote MCP HTTP 服务端应支持 Streamable HTTP 与 SSE 双传输通道及跨域', async () => {
  // 1. 启动测试 HTTP 实例
  const instance: HttpServerInstance = await startHttpServer({ port: 0, host: '127.0.0.1' });
  assert.ok(instance.port > 0);
  assert.ok(instance.url.startsWith('http://127.0.0.1:'));

  try {
    // 2. 验证 GET /health 与 CORS
    const healthRes = await fetch(`${instance.url}/health`);
    assert.equal(healthRes.status, 200);
    assert.equal(healthRes.headers.get('access-control-allow-origin'), '*');
    const healthJson = await healthRes.json();
    assert.equal(healthJson.status, 'ok');
    assert.equal(healthJson.server, 'mingyu-mcp-server');
    assert.deepEqual(healthJson.transports, ['streamable-http', 'sse', 'stdio']);

    // 3. 验证 OPTIONS 预检
    const optionsRes = await fetch(`${instance.url}/mcp`, { method: 'OPTIONS' });
    assert.equal(optionsRes.status, 204);
    assert.equal(optionsRes.headers.get('access-control-allow-origin'), '*');
    assert.match(
      optionsRes.headers.get('access-control-allow-headers') ?? '',
      /mcp-protocol-version/i,
    );
    assert.match(optionsRes.headers.get('access-control-expose-headers') ?? '', /mcp-session-id/i);

    // 4. 验证 Streamable HTTP 客户端通信
    const streamableClient = new Client({ name: 'test-streamable-client', version: '1.0.0' });
    const streamableTransport = new StreamableHTTPClientTransport(new URL(`${instance.url}/mcp`));
    await streamableClient.connect(streamableTransport);

    const secondStreamableClient = new Client({
      name: 'test-streamable-client-2',
      version: '1.0.0',
    });
    const secondStreamableTransport = new StreamableHTTPClientTransport(
      new URL(`${instance.url}/mcp`),
    );
    await secondStreamableClient.connect(secondStreamableTransport);

    const streamableTools = await streamableClient.listTools();
    assert.equal(streamableTools.tools.length >= 63, true);
    assert.equal((await secondStreamableClient.listTools()).tools.length >= 63, true);

    const callResult1 = await streamableClient.callTool({
      name: 'foundation_capabilities',
      arguments: {},
    });
    assert.equal(callResult1.isError, undefined);
    assert.ok(callResult1.structuredContent);
    await streamableClient.close();
    const secondCallResult = await secondStreamableClient.callTool({
      name: 'foundation_capabilities',
      arguments: {},
    });
    assert.equal(secondCallResult.isError, undefined);
    await secondStreamableClient.close();

    // 5. 验证 SSE 客户端通信
    const sseClient = new Client({ name: 'test-sse-client', version: '1.0.0' });
    const sseTransport = new SSEClientTransport(new URL(`${instance.url}/sse`));
    await sseClient.connect(sseTransport);

    const sseTools = await sseClient.listTools();
    assert.equal(sseTools.tools.length >= 63, true);

    const callResult2 = await sseClient.callTool({
      name: 'calendar_moon_phase',
      arguments: { utcDateTime: '2026-09-04T00:00:00Z' },
    });
    assert.equal(callResult2.isError, undefined);
    assert.ok(callResult2.structuredContent);
    await sseClient.close();
  } finally {
    await instance.close();
  }
});

test('Streamable HTTP 删除会话后旧 session id 必须失效', async () => {
  const instance: HttpServerInstance = await startHttpServer({ port: 0, host: '127.0.0.1' });
  const headers = {
    accept: 'application/json, text/event-stream',
    'content-type': 'application/json',
  };

  try {
    const initialize = await fetch(`${instance.url}/mcp`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'delete-session-test', version: '1.0.0' },
        },
      }),
    });
    assert.equal(initialize.status, 200);
    const sessionId = initialize.headers.get('mcp-session-id');
    assert.ok(sessionId);
    await initialize.text();

    const sessionHeaders = { ...headers, 'mcp-session-id': sessionId };
    const deleted = await fetch(`${instance.url}/mcp`, {
      method: 'DELETE',
      headers: sessionHeaders,
    });
    assert.ok([200, 204].includes(deleted.status));
    await deleted.text();

    const followup = await fetch(`${instance.url}/mcp`, {
      method: 'POST',
      headers: sessionHeaders,
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
    });
    assert.equal(followup.status, 404);
    await followup.text();
  } finally {
    await instance.close();
  }
});

test('Streamable HTTP 拒绝未初始化请求后应释放临时服务端', { timeout: 10000 }, async (t) => {
  const instance = await startHttpServer({ port: 0, host: '127.0.0.1' });
  const originalClose = McpServer.prototype.close;
  let notifyClosed!: () => void;
  const closed = new Promise<void>((resolve) => {
    notifyClosed = resolve;
  });
  t.mock.method(McpServer.prototype, 'close', async function (this: McpServer) {
    await originalClose.call(this);
    notifyClosed();
  });

  try {
    const rejected = await fetch(`${instance.url}/mcp`, {
      method: 'POST',
      headers: {
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
    });
    assert.equal(rejected.status, 400);
    assert.equal(rejected.headers.get('mcp-session-id'), null);
    await rejected.text();
    await closed;
  } finally {
    await instance.close();
  }
});

test('SSE 断开连接后应移除消息投递会话', { timeout: 10000 }, async (t) => {
  const instance = await startHttpServer({ port: 0, host: '127.0.0.1' });
  const controller = new AbortController();
  const originalClose = McpServer.prototype.close;
  let notifyClosed!: () => void;
  const closed = new Promise<void>((resolve) => {
    notifyClosed = resolve;
  });
  t.mock.method(McpServer.prototype, 'close', async function (this: McpServer) {
    await originalClose.call(this);
    notifyClosed();
  });

  try {
    const response = await fetch(`${instance.url}/sse`, { signal: controller.signal });
    assert.equal(response.status, 200);
    assert.ok(response.body);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let frame = '';
    while (!frame.includes('\n\n')) {
      const chunk = await reader.read();
      assert.equal(chunk.done, false);
      frame += decoder.decode(chunk.value, { stream: true });
    }
    const endpoint = /^data: (\/message\?sessionId=\S+)$/m.exec(frame)?.[1];
    assert.ok(endpoint);
    controller.abort();
    await closed;

    const rejected = await fetch(`${instance.url}${endpoint}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
    });
    assert.equal(rejected.status, 404);
    await rejected.text();
  } finally {
    controller.abort();
    await instance.close();
  }
});
