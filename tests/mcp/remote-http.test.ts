import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
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

    // 4. 验证 Streamable HTTP 客户端通信
    const streamableClient = new Client({ name: 'test-streamable-client', version: '1.0.0' });
    const streamableTransport = new StreamableHTTPClientTransport(new URL(`${instance.url}/mcp`));
    await streamableClient.connect(streamableTransport);

    const streamableTools = await streamableClient.listTools();
    assert.equal(streamableTools.tools.length >= 63, true);

    const callResult1 = await streamableClient.callTool({
      name: 'foundation_capabilities',
      arguments: {},
    });
    assert.equal(callResult1.isError, undefined);
    assert.ok(callResult1.structuredContent);
    await streamableClient.close();

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
