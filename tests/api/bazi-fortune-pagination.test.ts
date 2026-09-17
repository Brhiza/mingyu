import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMingyuMcpServer } from '../../mcp/src/create-server';
import { handlePublicApiRequest } from '../../src/lib/public-api/handler';

const input = {
  dateType: 'solar',
  gender: 'female',
  year: 1992,
  month: 8,
  day: 21,
  timeIndex: 4,
  birthHour: 8,
  birthMinute: 23,
  birthSecond: 47,
  baziFortuneScope: 'full',
  question: '解释本次所列流年。',
};

async function callApi(overrides: Record<string, unknown>) {
  const response = await handlePublicApiRequest(
    new Request('https://example.test/api/v1/bazi/prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...input, ...overrides }),
    }),
  );
  return { status: response.status, body: (await response.json()) as any };
}

test('八字完整命限显式逐年分页，提示词和结构结果均仅返回本年', async () => {
  const first = await callApi({ fortuneBatch: {}, responseMode: 'full' });
  assert.equal(first.status, 200, JSON.stringify(first.body));
  const data = first.body.data;
  assert.equal(data.batch.fortuneBatch.unit, 'cycle-year');
  assert.equal(data.batch.fortuneBatch.startIndex, 0);
  assert.equal(data.batch.fortuneBatch.nextIndex, 1);
  assert.equal(data.result.luckInfo.cycles.length, 1);
  assert.equal(data.result.luckInfo.cycles[0].years.length, 1);
  assert.equal(data.result.luckInfo.cycles[0].years[0].year, data.batch.fortuneBatch.year);
  assert.equal((data.prompt.match(/^\d+年\(/gm) ?? []).length, 1);
  assert.match(data.prompt, /分析对象：本命盘与本次所列大运流年/);
  assert.doesNotMatch(data.prompt, /完整大运流年：/);
  const next = await callApi({ fortuneBatch: { startIndex: data.batch.fortuneBatch.nextIndex } });
  assert.equal(next.status, 200);
  assert.equal(next.body.data.batch.fortuneBatch.startIndex, 1);
  assert.equal(
    next.body.data.batch.fortuneBatch.totalEntries,
    data.batch.fortuneBatch.totalEntries,
  );
  const original = await callApi({});
  assert.equal(original.status, 200);
  assert.equal(original.body.data.batch, undefined);
  assert.match(original.body.data.prompt, /完整大运流年：/);
  assert.ok(data.prompt.length < original.body.data.prompt.length);
});

test('八字分批拒绝范围冲突和越界输入', async () => {
  for (const overrides of [
    { fortuneBatch: {}, baziFortuneScope: 'natal' },
    { fortuneBatch: {}, scopeBatch: {} },
    { fortuneBatch: { limit: 2 } },
    { fortuneBatch: { startIndex: 10000 } },
    { fortuneBatch: { startIndex: -1 } },
  ]) {
    const response = await callApi(overrides);
    assert.equal(response.status, 400, JSON.stringify(response.body));
    assert.match(JSON.stringify(response.body), /fortuneBatch|续取|startIndex|limit/);
  }
});

test('交运年相邻两页通过去重年份字段仍能分别读取各自运段', async () => {
  const before = await callApi({ fortuneBatch: { startIndex: 5 }, responseMode: 'full' });
  const after = await callApi({ fortuneBatch: { startIndex: 6 }, responseMode: 'full' });
  assert.equal(before.status, 200);
  assert.equal(after.status, 200);
  const first = before.body.data;
  const second = after.body.data;
  assert.equal(first.batch.fortuneBatch.year, second.batch.fortuneBatch.year);
  assert.notEqual(first.batch.fortuneBatch.cycleIndex, second.batch.fortuneBatch.cycleIndex);
  for (const [startIndex, data] of [
    [5, first],
    [6, second],
  ] as const) {
    const cycle = data.result.luckInfo.cycles[0];
    assert.deepEqual(
      (cycle.resolvedYears ?? cycle.years).map((year: { year: number }) => year.year),
      [data.batch.fortuneBatch.year],
    );
    assert.deepEqual(data.result.liunian, cycle.years);

    const summary = await callApi({ fortuneBatch: { startIndex }, responseMode: 'summary' });
    assert.equal(summary.status, 200, JSON.stringify(summary.body));
    const summaryCycle = summary.body.data.resultSummary.luckInfo.cycles[0];
    assert.deepEqual(summaryCycle.years, cycle.years);
    assert.deepEqual(summaryCycle.resolvedYears, cycle.resolvedYears);
    assert.deepEqual(summary.body.data.resultSummary.liunian, data.result.liunian);
  }
});

test('MCP 与 HTTP 八字分批使用相同游标和单年命限', async () => {
  const server = createMingyuMcpServer();
  const client = new Client({ name: '八字分批验证', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    const http = await callApi({ fortuneBatch: { startIndex: 2 }, responseMode: 'full' });
    const mcp = await client.callTool({
      name: 'bazi_prompt',
      arguments: { ...input, fortuneBatch: { startIndex: 2 } },
    });
    assert.ok(!mcp.isError, JSON.stringify(mcp));
    const data = mcp.structuredContent as any;
    assert.deepEqual(data.batch, http.body.data.batch);
    assert.deepEqual(data.result.luckInfo, http.body.data.result.luckInfo);
    assert.equal((data.prompt.match(/^\d+年\(/gm) ?? []).length, 1);
    assert.doesNotMatch(data.prompt, /完整大运流年：/);
  } finally {
    await client.close();
    await server.close();
  }
});
