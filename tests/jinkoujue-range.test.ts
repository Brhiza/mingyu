import assert from 'node:assert/strict';
import test from 'node:test';
import { SolarTerm } from 'tyme4ts';
import { calculate, reprompt } from '../src/core';
import { getDivinationTime, getMonthLeaderByZhongqi } from '../src/systems/calendar';
import { trueSolarTime } from '../src/systems/astronomy/true-solar';
import worker from '../src/worker';

const currentTime = '2025-01-01T00:00:00Z';
const range = { start: '2024-02-19T03:00:00Z', end: '2024-02-19T05:00:00Z' };

test('四种起课方式与真太阳时范围均保留分支并使用代表课盘', async () => {
  for (const settings of [
    { method: 'time' }, { method: 'branch', branch: '午' }, { method: 'number', number: 47 }, { method: 'random' },
  ]) {
    for (const solar of [false, true]) {
      const options = { ...settings, ...(solar ? { timeStandard: 'true-solar', longitude: 116.4 } : {}) };
      const saved = JSON.parse(JSON.stringify(await calculate('jinkoujue', { question: '问题', currentTime, range, jinkoujue: options })));
      assert.ok(saved.data.branches.length > 1);
      assert.match(saved.prompt.text, /该分支起点的代表时刻/);
      if (settings.method === 'random') {
        assert.equal(new Set(saved.data.branches.map((branch: any) => branch.data.diFenBranch)).size, 1);
        assert.equal(new Set(saved.data.branches.map((branch: any) => branch.data.calculation.inputBase)).size, 1);
        assert.match(saved.prompt.text, /所有分支复用同一次选出的地分/);
        assert.doesNotMatch(JSON.stringify(saved), /"(?:seed|samples|randomTrace|randomTraceFact|randomFacts)"|随机轨迹|随机种子|\breplay\b/i);
      } else for (const branch of saved.data.branches) {
        const single = await calculate('jinkoujue', { question: '问题', currentTime, divinationTime: new Date(branch.startTimestamp).toISOString(), jinkoujue: options });
        assert.deepEqual(branch.data, JSON.parse(JSON.stringify(single.data)));
      }
      const follow = await reprompt({ method: 'jinkoujue', result: saved, question: '继续问' });
      assert.match(follow.prompt.text, /继续问/);
      if (settings.method === 'random') assert.ok(follow.prompt.text.includes(`地分${saved.data.branches[0].data.diFenBranch}`));
    }
  }
});

test('随机范围只采样一次，重复追问不再抽取地分', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  let calls = 0;
  try {
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { getRandomValues(values: Uint32Array) { calls++; values.fill(0); return values; } } });
    const saved = JSON.parse(JSON.stringify(await calculate('jinkoujue', { question: '问题', currentTime, range, jinkoujue: { method: 'random' } })));
    assert.equal(calls, 1);
    assert.ok(saved.data.branches.length > 1);
    assert.deepEqual([...new Set(saved.data.branches.map((branch: any) => branch.data.diFenBranch))], ['子']);
    await reprompt({ method: 'jinkoujue', result: saved, question: '追问一' });
    await reprompt({ method: 'jinkoujue', result: saved, question: '追问二' });
    assert.equal(calls, 1);
  } finally {
    if (original) Object.defineProperty(globalThis, 'crypto', original);
    else Reflect.deleteProperty(globalThis, 'crypto');
  }
});

test('单课真太阳时追问保留时间与经度，拒绝修改校正参数', async () => {
  const input = { question: '问题', currentTime, divinationTime: range.start, jinkoujue: { method: 'number', number: 47, timeStandard: 'true-solar', longitude: 116.4 } };
  const saved = JSON.parse(JSON.stringify(await calculate('jinkoujue', input)));
  assert.match(saved.prompt.text, /节气、年月及月将依据实际起课时刻，日时依据真太阳时/);
  assert.match((await reprompt({ method: 'jinkoujue', result: saved, question: '继续问' })).prompt.text, /继续问/);
  for (const mutate of [
    (data: any) => { data.timeContext.longitude += 1; },
    (data: any) => { data.timeContext.totalCorrectionMinutes += 1; },
    (data: any) => { data.termReferenceTimestamp += 1000; },
    (data: any) => { delete data.timeContext; },
  ]) {
    const bad = structuredClone(saved); mutate(bad.data);
    await assert.rejects(() => reprompt({ method: 'jinkoujue', result: bad, question: '追问' }));
  }
});

test('真太阳时范围逐秒核对日时和月将，且追问拒绝篡改', async () => {
  const settings = { method: 'random', timeStandard: 'true-solar', longitude: 116.4 };
  const saved = JSON.parse(JSON.stringify(await calculate('jinkoujue', { question: '问题', currentTime, range, jinkoujue: settings })));
  const start = Date.parse(range.start), end = Date.parse(range.end);
  for (let timestamp = start; timestamp < end; timestamp += 1000) {
    const branch = saved.data.branches.find((item: any) => item.startTimestamp <= timestamp && timestamp < item.endTimestamp);
    assert.ok(branch);
    const actual = getDivinationTime(new Date(timestamp)).ganzhi;
    const corrected = getDivinationTime(new Date(trueSolarTime(new Date(timestamp), settings.longitude).effectiveTimestamp)).ganzhi;
    assert.deepEqual(branch.data.ganzhi, { ...corrected, year: actual.year, month: actual.month });
    assert.equal(branch.data.monthLeader, getMonthLeaderByZhongqi(timestamp));
  }
  saved.data.branches[0].data.evidenceAnalysis = { fake: '伪造' };
  assert.doesNotMatch((await reprompt({ method: 'jinkoujue', result: saved, question: '追问' })).prompt.text, /伪造/);
  for (const mutate of [
    (data: any) => { data.branches[0].endTimestamp += 1000; },
    (data: any) => { data.branches[0].data.positions.diFen.branch = '伪造'; },
    (data: any) => { data.branches[0].data.calculation.inputBase = 13; },
    (data: any) => { data.branches[0].data.timeContext.longitude = 0; },
    (data: any) => { data.source.endExclusive = false; },
  ]) {
    const bad = structuredClone(saved); mutate(bad.data);
    await assert.rejects(() => reprompt({ method: 'jinkoujue', result: bad, question: '追问' }));
  }
  await assert.rejects(() => calculate('jinkoujue', { question: '问题', range, divinationTime: range.start }));
  await assert.rejects(() => calculate('jinkoujue', { question: '问题', range: { ...range, end: '2024-02-19T05:00:01Z' } }));
  await assert.rejects(() => calculate('jinkoujue', { question: '问题', jinkoujue: { timeStandard: 'true-solar' } }));
  await assert.rejects(() => calculate('jinkoujue', { question: '问题', jinkoujue: { longitude: 116 } }));
  const pillars = getDivinationTime(new Date(range.start)).ganzhi;
  await assert.rejects(() => calculate('jinkoujue', { question: '问题', range: { ...range, pillars: { ...pillars, hour: '甲子' } } }));
});

test('Worker HTTP 与 MCP 计算随机范围并可复用原结果', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'jinkoujue' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const input = { question: '问题', currentTime, range, jinkoujue: { method: 'random', timeStandard: 'true-solar', longitude: 116.4 } };
  const response = await send('/api/calculate', { method: 'jinkoujue', input });
  assert.equal(response.status, 200); const saved = await response.json();
  assert.equal((await send('/api/prompt', { method: 'jinkoujue', result: saved, question: '追问' })).status, 200);
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'jinkoujue', arguments: input } });
  const result = (await mcp.json()).result.structuredContent.data;
  assert.equal(result.kind, 'range');
  assert.equal(new Set(result.branches.map((branch: any) => branch.data.diFenBranch)).size, 1);
});
