import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMingyuMcpServer } from '../../mcp/src/create-server';
import { findTool } from '../../mcp/src/catalog/tool-catalog';
import { handlePublicApiRequest } from '../../src/lib/public-api/handler';

const server = createMingyuMcpServer();
const client = new Client({ name: 'huangji-reference-tables-test', version: '1.0.0' });

before(async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
});

after(async () => {
  await client.close();
  await server.close();
});

async function callHttp(input: Record<string, unknown>) {
  const response = await handlePublicApiRequest(
    new Request('https://aov.cc/api/v1/metaphysics/huangji-jingshi/references', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
  );
  return { response, body: await response.json() } as {
    response: Response;
    body: { ok: boolean; data?: Record<string, unknown>; error?: { message?: string } };
  };
}

test('皇极扩展资料公开 API 与 MCP 返回同一声音律吕表', async () => {
  assert.equal(
    findTool('huangji_reference_tables')?.endpoint,
    '/metaphysics/huangji-jingshi/references',
  );
  const input = { table: 'sound-rhythm', detailMode: 'full' };
  const http = await callHttp(input);
  assert.equal(http.response.status, 200, JSON.stringify(http.body));
  assert.equal(http.body.data?.table, 'sound-rhythm');
  assert.equal((http.body.data?.bodyCounts as { heavenlyUseSound?: number }).heavenlyUseSound, 112);
  assert.deepEqual(
    (http.body.data?.diagramCounts as { value: number }[]).map((item) => item.value),
    [1064, 560],
  );

  const mcp = await client.callTool({ name: 'huangji_reference_tables', arguments: input });
  assert.notEqual(mcp.isError, true, JSON.stringify(mcp));
  assert.deepEqual((mcp.structuredContent as { result: unknown }).result, http.body.data);
});

test('皇极历史纪年公开 API 与 MCP 保留经辰原文字和三十年序列', async () => {
  const input = { table: 'historical-era', shiIndex: 2190, detailMode: 'full' };
  const http = await callHttp(input);
  assert.equal(http.response.status, 200, JSON.stringify(http.body));
  assert.equal(http.body.data?.sourceBranch, '己');
  assert.equal(http.body.data?.branch, '巳');
  assert.equal((http.body.data?.rows as unknown[]).length, 30);
  assert.deepEqual(
    (
      http.body.data?.namedEntries as Array<{ label: string; rowIndex: number; sourceText: string }>
    )[0],
    { rowIndex: 24, ganzhi: '丁巳', label: '商武丁', sourceText: '商武丁' },
  );

  const mcp = await client.callTool({ name: 'huangji_reference_tables', arguments: input });
  assert.notEqual(mcp.isError, true, JSON.stringify(mcp));
  assert.deepEqual((mcp.structuredContent as { result: unknown }).result, http.body.data);
});

test('皇极扩展资料入口拒绝不匹配的经辰参数', async () => {
  const invalid = await callHttp({ table: 'sound-rhythm', shiIndex: 2190 });
  assert.equal(invalid.response.status, 400);
  assert.match(JSON.stringify(invalid.body), /shiIndex 只可与 historical-era/);
});
