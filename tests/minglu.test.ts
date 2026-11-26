import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import { createServer } from '../src/mcp';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import worker from '../src/worker';

const exactBirth = {
  year: 1990,
  month: 5,
  day: 15,
  clock: { kind: 'exact' as const, hour: 14, minute: 30, second: 0 },
  timezone: 8,
};

test('minglu 聚合八字、紫微、西洋星盘与八宅并生成分节 Markdown 与提示词', async () => {
  const result = await calculate('minglu', {
    question: '请综合整理我的命录资料。',
    birth: exactBirth,
    gender: 'female',
    referenceTime: '2026-06-15T04:00:00Z',
    location: { latitude: 39.9, longitude: 116.4, locationName: '北京' },
    house: { kind: 'mountain', sitMountain: '子' },
    prompt: { topic: 'career', detailMode: 'full' },
  });
  assert.equal(result.method, 'minglu');
  assert.ok(result.data.bazi);
  assert.ok(result.data.ziwei);
  assert.ok(result.data.astrolabe);
  assert.ok(result.data.bazhai);
  assert.deepEqual(result.data.omitted, []);
  assert.equal(result.data.sections.length, 4);
  assert.ok(result.data.crossSynthesis);
  assert.equal(result.data.crossSynthesis.dimensions.length, 3);
  assert.ok(result.data.crossSynthesis.baziZiweiCorroboration);
  assert.ok(result.data.matchedGlossary.length > 0);
  assert.match(result.data.markdown, /^# 命录综合资料/m);
  assert.match(result.prompt.text, /【跨体系同题合参对照/);
  assert.match(result.prompt.text, /【盘面命中核心术语释义/);
  assert.match(result.prompt.text, /事业与职业路径/);
  assert.match(result.prompt.text, /【局势要点】/);

  const followed = await reprompt({
    method: 'minglu',
    result: JSON.parse(JSON.stringify(result)),
    question: '改看财富配置',
    prompt: { topic: 'wealth', detailMode: 'compact' },
  });
  assert.match(followed.prompt.text, /财富与资源配置/);

  const tampered = JSON.parse(JSON.stringify(result));
  tampered.data.omitted.push({ system: '伪造', reason: '测试' });
  await assert.rejects(() => reprompt({ method: 'minglu', result: tampered, question: '追问' }), /不一致/);
});

test('minglu 在未知时辰或缺少经纬度时不虚构星盘并明确记录未计算原因', async () => {
  const result = await calculate('minglu', {
    question: '时辰未知如何查看？',
    birth: { year: 1990, month: 5, day: 15, clock: { kind: 'unknown' }, timezone: 8 },
    gender: 'male',
  });
  assert.ok(result.data.bazi);
  assert.ok(result.data.ziwei);
  assert.equal(result.data.astrolabe, null);
  assert.ok(result.data.omitted.some((item: { system: string }) => item.system === '西洋星盘'));
  assert.match(result.prompt.text, /未计算项目与原因/);
});

test('minglu 通过 Worker HTTP 与 MCP 返回一致结果并支持追问', async () => {
  const env = { ASSETS: { fetch: async () => new Response('not found', { status: 404 }) } };
  const payload = {
    question: '总览',
    birth: exactBirth,
    gender: 'female',
    location: { latitude: 39.9, longitude: 116.4 },
  };
  const httpRes = await worker.fetch(new Request('https://local/api/calculate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ method: 'minglu', input: payload }),
  }), env);
  assert.equal(httpRes.status, 200);
  const httpJson = await httpRes.json() as { method: string; data: { markdown: string } };
  assert.equal(httpJson.method, 'minglu');
  assert.match(httpJson.data.markdown, /八字资料/);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createServer(['minglu']);
  const client = new Client({ name: 'minglu-test', version: '1' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  try {
    const toolRes = await client.callTool({ name: 'minglu', arguments: payload });
    assert.equal(toolRes.isError, undefined);
    const followRes = await client.callTool({ name: 'reprompt', arguments: { method: 'minglu', result: toolRes.structuredContent, question: '继续' } });
    assert.equal(followRes.isError, undefined);
  } finally {
    await client.close();
    await server.close();
  }
});

test('minglu 在南半球出生时补充节令寒暖对照说明，北半球默认不变', async () => {
  const south = await calculate('minglu', {
    question: '南半球季节怎么看？',
    birth: { year: 1990, month: 5, day: 15, clock: { kind: 'exact', hour: 14, minute: 30, second: 0 }, timezone: 10 },
    gender: 'male',
    location: { latitude: -33.8688, longitude: 151.2093, locationName: '悉尼' },
  });
  assert.match(south.data.southernHemisphereNote, /巳月.*对应季节月令约为亥月/);
  assert.match(south.prompt.text, /【南半球节令对照说明】/);
});
