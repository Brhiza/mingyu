import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMingyuMcpServer } from '../../mcp/src/create-server';
import { handlePublicApiRequest } from '../../src/lib/public-api/handler';

async function callApi(path: string, payload: Record<string, unknown>) {
  const response = await handlePublicApiRequest(
    new Request(`https://example.test/api/v1/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  );
  const text = await response.text();
  return {
    response,
    body: JSON.parse(text) as Record<string, any>,
    bytes: new TextEncoder().encode(text).byteLength,
  };
}

const HTTP_POINT = {
  name: '公开点输入分页样例',
  gender: 'male',
  dateType: 'solar',
  year: '1990',
  month: '6',
  day: '14',
  birthHour: '10',
  birthMinute: '59',
  birthSecond: 59,
  timeIndex: 5,
  scopeDate: '2025-01-01',
  scopeHourIndex: 6,
  algorithm: 'default',
  birthPlace: '公开合成地点',
  birthLongitude: '120.5',
  birthLatitude: 30.25,
  detailMode: 'full',
};

const MCP_POINT = {
  name: HTTP_POINT.name,
  gender: HTTP_POINT.gender,
  dateType: HTTP_POINT.dateType,
  year: HTTP_POINT.year,
  month: HTTP_POINT.month,
  day: HTTP_POINT.day,
  birthHour: HTTP_POINT.birthHour,
  birthMinute: HTTP_POINT.birthMinute,
  birthSecond: String(HTTP_POINT.birthSecond),
  timeIndex: HTTP_POINT.timeIndex,
  scopeDate: HTTP_POINT.scopeDate,
  scopeHourIndex: HTTP_POINT.scopeHourIndex,
  algorithm: HTTP_POINT.algorithm,
};

test('公开点输入显式 scopeBatch 只返回当前 scope 并提供续取游标', async () => {
  const first = await callApi('ziwei/calculate', {
    ...HTTP_POINT,
    promptScope: 'full',
    scopeBatch: {},
  });
  assert.equal(first.response.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.ok, true);
  assert.ok(first.bytes < 1024 * 1024);
  assert.deepEqual(first.body.data.scopeNames, ['origin', 'decadal']);
  assert.deepEqual(Object.keys(first.body.data.payloadByScope), first.body.data.scopeNames);
  assert.deepEqual(first.body.data.batch.scopeBatch, {
    requestedScope: 'full',
    scopes: ['origin', 'decadal'],
    startIndex: 0,
    endIndexExclusive: 1,
    totalScopes: 5,
    nextIndex: 1,
  });
  assert.deepEqual(first.body.data.batch.scopeContext, {
    dateStr: '2025-01-01',
    hourIndex: 6,
  });
  assert.equal(first.body.data.fortuneTimeline.batch.unit, 'age-year');
  assert.equal(first.body.data.fortuneTimeline.batch.startIndex, 0);

  const next = await callApi('ziwei/calculate', {
    ...HTTP_POINT,
    promptScope: 'full',
    scopeBatch: { startIndex: first.body.data.batch.scopeBatch.nextIndex },
  });
  assert.equal(next.response.status, 200, JSON.stringify(next.body));
  assert.ok(next.bytes < 1024 * 1024);
  assert.deepEqual(next.body.data.scopeNames, ['origin', 'yearly']);
  assert.equal(next.body.data.payloadByScope.decadal, undefined);
  assert.equal(next.body.data.batch.scopeBatch.startIndex, 1);
  assert.equal(next.body.data.batch.scopeBatch.nextIndex, 2);
});

test('公开点输入显式 fortuneBatch 只计算请求年龄年，旧点输入不增加 batch 字段', async () => {
  const point = await callApi('ziwei/calculate', {
    ...HTTP_POINT,
    promptScope: 'decadal',
  });
  assert.equal(point.response.status, 200, JSON.stringify(point.body));
  assert.equal(point.body.data.batch, undefined);
  assert.deepEqual(point.body.data.scopeNames, ['origin', 'decadal']);
  assert.equal(point.body.data.fortuneTimeline.batch, undefined);

  const page = await callApi('ziwei/calculate', {
    ...HTTP_POINT,
    promptScope: 'decadal',
    fortuneBatch: {},
  });
  assert.equal(page.response.status, 200, JSON.stringify(page.body));
  assert.ok(page.bytes < 1024 * 1024);
  assert.equal(page.body.data.batch.fortuneBatch.unit, 'age-year');
  assert.equal(page.body.data.batch.fortuneBatch.startIndex, 0);
  assert.equal(page.body.data.fortuneTimeline.batch.endIndexExclusive, 1);
  assert.equal(page.body.data.fortuneTimeline.batch.nextIndex, 1);

  const fullFortune = await callApi('ziwei/calculate', {
    ...HTTP_POINT,
    promptScope: 'full',
    fortuneBatch: {},
  });
  assert.equal(fullFortune.response.status, 200, JSON.stringify(fullFortune.body));
  assert.ok(fullFortune.bytes < 1024 * 1024);
  assert.deepEqual(fullFortune.body.data.scopeNames, ['origin', 'decadal']);
  assert.deepEqual(fullFortune.body.data.batch.scopeBatch.scopes, ['origin', 'decadal']);
  assert.equal(fullFortune.body.data.batch.fortuneBatch.startIndex, 0);
});

test('公开紫微提示词与八字紫微合参提示词透传点输入分页元数据', async () => {
  const ziweiPrompt = await callApi('ziwei/prompt', {
    ...HTTP_POINT,
    promptScope: 'full',
    scopeBatch: {},
    question: '请解释当前返回的紫微资料。',
    responseMode: 'prompt-only',
  });
  assert.equal(ziweiPrompt.response.status, 200, JSON.stringify(ziweiPrompt.body));
  assert.equal(typeof ziweiPrompt.body.data.prompt, 'string');
  assert.deepEqual(ziweiPrompt.body.data.batch.scopeBatch.scopes, ['origin', 'decadal']);
  assert.deepEqual(ziweiPrompt.body.data.batch.scopeContext, {
    dateStr: '2025-01-01',
    hourIndex: 6,
  });
  assert.match(ziweiPrompt.body.data.prompt, /本命(?:盘)?与本次所列运限/);
  assert.doesNotMatch(
    ziweiPrompt.body.data.prompt,
    /分析范围：完整输出|【完整运限资料】|完整紫微运限资料：|所列完整运限|完整运限范围/,
  );

  const combinedPrompt = await callApi('bazi-ziwei/prompt', {
    ...HTTP_POINT,
    year: 1990,
    month: 6,
    day: 14,
    birthHour: 10,
    birthMinute: 59,
    birthSecond: 59,
    promptScope: 'full',
    scopeBatch: {},
    question: '请结合八字和紫微说明本次所列运限。',
    responseMode: 'summary',
  });
  assert.equal(combinedPrompt.response.status, 200, JSON.stringify(combinedPrompt.body));
  assert.equal(typeof combinedPrompt.body.data.prompt, 'string');
  assert.equal(combinedPrompt.body.data.batch.scopeBatch.startIndex, 0);
  assert.match(combinedPrompt.body.data.prompt, /本命(?:盘)?与本次所列运限/);
  assert.doesNotMatch(
    combinedPrompt.body.data.prompt,
    /分析范围：完整输出|【完整运限资料】|完整紫微运限资料：|所列完整运限|完整运限范围/,
  );
  assert.ok(combinedPrompt.body.data.resultSummary.ziwei);

  const thematicPrompt = await callApi('consultation/thematic/prompt', {
    ...HTTP_POINT,
    system: 'ziwei',
    promptScope: 'full',
    scopeBatch: {},
    topic: 'career',
    question: '请结合本次所列运限说明事业主题。',
    responseMode: 'prompt-only',
  });
  assert.equal(thematicPrompt.response.status, 200, JSON.stringify(thematicPrompt.body));
  assert.equal(typeof thematicPrompt.body.data.prompt, 'string');
  assert.match(thematicPrompt.body.data.prompt, /本命(?:盘)?与本次所列运限/);
  assert.doesNotMatch(
    thematicPrompt.body.data.prompt,
    /分析范围：完整输出|【完整运限资料】|完整紫微运限资料：|完整资料|所列完整运限|完整运限范围/,
  );
});

test('公开点输入拒绝与范围不匹配的分页游标', async () => {
  const invalidScope = await callApi('ziwei/calculate', {
    ...HTTP_POINT,
    promptScope: 'decadal',
    scopeBatch: {},
  });
  assert.equal(invalidScope.response.status, 400);

  const invalidFortune = await callApi('ziwei/calculate', {
    ...HTTP_POINT,
    promptScope: 'yearly',
    fortuneBatch: {},
  });
  assert.equal(invalidFortune.response.status, 400);

  const invalidCursor = await callApi('ziwei/calculate', {
    ...HTTP_POINT,
    promptScope: 'decadal',
    fortuneBatch: { startIndex: 100000 },
  });
  assert.equal(invalidCursor.response.status, 400);
});

const mcpServer = createMingyuMcpServer();
const mcpClient = new Client({ name: 'ziwei-pagination-test', version: '1.0.0' });

before(async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await mcpServer.connect(serverTransport);
  await mcpClient.connect(clientTransport);
});

after(async () => {
  await mcpClient.close();
  await mcpServer.close();
});

test('MCP 紫微点输入显式 scopeBatch 与 fortuneBatch 使用同一分页语义', async () => {
  const result = await mcpClient.callTool({
    name: 'ziwei_calculate',
    arguments: {
      ...MCP_POINT,
      promptScope: 'full',
      scopeBatch: {},
    },
  });
  assert.equal(result.isError, undefined);
  const data = result.structuredContent as Record<string, any>;
  assert.deepEqual(data.scopeNames, ['origin', 'decadal']);
  assert.deepEqual(data.batch.scopeBatch.scopes, ['origin', 'decadal']);
  assert.deepEqual(data.batch.scopeContext, { dateStr: '2025-01-01', hourIndex: 6 });
  assert.equal(data.fortuneTimeline.batch.startIndex, 0);

  const fortune = await mcpClient.callTool({
    name: 'ziwei_prompt',
    arguments: {
      ...MCP_POINT,
      promptScope: 'decadal',
      fortuneBatch: {},
      question: '请解释当前大限。',
    },
  });
  assert.equal(fortune.isError, undefined);
  const promptData = fortune.structuredContent as Record<string, any>;
  assert.equal(promptData.batch.fortuneBatch.unit, 'age-year');
  assert.equal(typeof promptData.prompt, 'string');

  const fullFortune = await mcpClient.callTool({
    name: 'ziwei_calculate',
    arguments: {
      ...MCP_POINT,
      promptScope: 'full',
      fortuneBatch: {},
    },
  });
  assert.equal(fullFortune.isError, undefined);
  const fullData = fullFortune.structuredContent as Record<string, any>;
  assert.deepEqual(fullData.scopeNames, ['origin', 'decadal']);
  assert.equal(fullData.batch.fortuneBatch.startIndex, 0);

  const fullPrompt = await mcpClient.callTool({
    name: 'ziwei_prompt',
    arguments: {
      ...MCP_POINT,
      promptScope: 'full',
      scopeBatch: {},
      question: '请解释本次所列运限。',
    },
  });
  assert.equal(fullPrompt.isError, undefined);
  const fullPromptData = fullPrompt.structuredContent as Record<string, any>;
  assert.match(fullPromptData.prompt, /本命(?:盘)?与本次所列运限/);
  assert.doesNotMatch(
    fullPromptData.prompt,
    /分析范围：完整输出|【完整运限资料】|完整紫微运限资料：|所列完整运限|完整运限范围/,
  );
});
