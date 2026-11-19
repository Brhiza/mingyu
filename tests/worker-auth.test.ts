import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../src/worker';

const assets = { fetch: async () => new Response('public assets') };
const env = { ASSETS: assets, ACCESS_TOKEN: 'example-private-token' };
const request = (path: string, authorization?: string) => new Request(`https://example.test${path}`, {
  headers: authorization ? { authorization } : {},
});

test('Worker 可选择以令牌保护所有 API 和远程 MCP，静态页面仍可访问', async () => {
  for (const path of ['/api', '/api/methods', '/api/prompts', '/api/schema', '/api/calculate', '/api/prompt', '/api/unknown', '/mcp', '/mcp/unknown']) {
    for (const token of [undefined, 'Bearer wrong', 'Basic example-private-token', 'Bearer example-private-token extra']) {
      const response = await worker.fetch(request(path, token), env);
      assert.equal(response.status, 401, `${path}: ${token}`);
      assert.equal(response.headers.get('www-authenticate'), 'Bearer');
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.ok(!(await response.text()).includes(env.ACCESS_TOKEN));
    }
  }
  assert.equal((await worker.fetch(request('/'), env)).status, 200);
  assert.equal((await worker.fetch(request('/api/methods', 'Bearer example-private-token'), env)).status, 200);
  assert.equal((await worker.fetch(request('/api/methods', 'bearer example-private-token'), env)).status, 200);
  assert.equal((await worker.fetch(request('/api/methods'), { ASSETS: assets })).status, 200);
  for (const invalid of ['', '   ', 'contains space']) {
    assert.equal((await worker.fetch(request('/api/methods'), { ...env, ACCESS_TOKEN: invalid })).status, 500);
  }
});

test('带令牌的 MCP 可调用工具', async () => {
  const payload = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'xiaoliuren', arguments: { question: '工作如何', currentTime: '2025-01-01T00:00:00Z' } } };
  const response = await worker.fetch(new Request('https://example.test/mcp', {
    method: 'POST', headers: { authorization: 'Bearer example-private-token', 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify(payload),
  }), env);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.result.isError, undefined);
  assert.equal(body.result.structuredContent.method, 'xiaoliuren');
});
