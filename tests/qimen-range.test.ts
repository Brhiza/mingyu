import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import { getDivinationTime } from '../src/systems/calendar';
import { calculateSolarTermEvidence } from '../src/systems/astronomy/solar-term-evidence';
import { trueSolarTime } from '../src/systems/astronomy/true-solar';
import { generateQimenRange } from '../src/systems/qimen/range';
import worker from '../src/worker';

const rain = { start: '2024-02-19T03:00:00Z', end: '2024-02-19T05:00:00Z' };
const currentTime = '2025-01-01T00:00:00Z';

test('全年所有交节、五日和十日边界正确切分', async () => {
  for (let index = 0; index < 24; index++) for (const day of [0, 5, 10]) {
    const timestamp = calculateSolarTermEvidence(2024, index).utcTimestamp + day * 86_400_000;
    const range = await generateQimenRange({ start: new Date(timestamp - 1000).toISOString(), end: new Date(timestamp + 1000).toISOString() }, { scope: 'hour', method: 'feipan', juMethod: 'zhirun' });
    assert.equal(range.branches.length, 2, `${index}/${day}`);
    assert.equal(range.branches[0].endTimestamp, timestamp);
  }
});

test('交节秒按半开区间切分四种层级，分支保持完整盘面及月相采样', async () => {
  for (const scope of ['hour', 'day', 'month', 'year']) {
    const result = await calculate('qimen', { question: '事业', currentTime, range: rain, qimen: { scope, method: 'feipan' } });
    const data = result.data as any;
    assert.equal(data.kind, 'range');
    assert.equal(data.status, 'conditional');
    assert.equal(data.branches.length, 2);
    assert.deepEqual(data.branches.map((branch: any) => branch.data.timeInfo.solarTerm), ['立春', '雨水']);
    assert.equal(data.branches[0].endTimestamp, Date.parse('2024-02-19T04:13:12Z'));
    assert.equal(data.branches[1].startTimestamp, data.branches[0].endTimestamp);
    assert.equal(data.branches[0].moonPhaseEvidence.start.utcTimestamp, Date.parse(rain.start));
    assert.equal(data.branches[1].moonPhaseEvidence.end.utcTimestamp, Date.parse(rain.end) - 1000);
    assert.match(result.prompt.text, /分支 1/);
    assert.match(result.prompt.text, /分支 2/);
    assert.match(result.prompt.text, /起点含、终点不含/);
    if (scope === 'hour' || scope === 'day') assert.match(result.prompt.text, /月相连续变化/);
  }
});

test('稳定时段合并，午夜、时辰及节气五日阶段在边界切分', async () => {
  async function run(start: string, end: string, scope = 'hour') {
    return (await calculate('qimen', { question: '问题', currentTime, range: { start, end }, qimen: { scope } })).data as any;
  }
  const stable = await run('2024-02-19T01:00:00Z', '2024-02-19T03:00:00Z');
  assert.equal(stable.status, 'stable');
  assert.equal(stable.branches.length, 1);
  const midnight = await run('2024-02-04T15:00:00Z', '2024-02-04T17:00:00Z');
  assert.deepEqual(midnight.branches.map((branch: any) => branch.endTimestamp), [Date.parse('2024-02-04T16:00:00Z'), Date.parse('2024-02-04T17:00:00Z')]);
  const hour = await run('2024-02-19T02:59:59Z', '2024-02-19T03:00:01Z');
  assert.equal(hour.branches.length, 2);
  assert.notEqual(hour.branches[0].data.ganzhi.hour, hour.branches[1].data.ganzhi.hour);
  const phase = calculateSolarTermEvidence(2024, 3).utcTimestamp + 5 * 86_400_000;
  const from = new Date(phase - 1000).toISOString(), to = new Date(phase + 1000).toISOString();
  const phased = await run(from, to);
  assert.deepEqual(phased.branches.map((branch: any) => branch.data.seasonality.jieQiPhase.phase), ['上元', '中元']);
  const monthly = await run(from, to, 'month');
  assert.equal(monthly.status, 'stable');
  const upper = await run('2200-01-20T07:17:07Z', '2200-01-20T07:17:09Z');
  assert.equal(upper.branches[0].endTimestamp, Date.parse('2200-01-20T07:17:08Z'));
});

test('可选四柱、区间限制与复用时篡改校验', async () => {
  const pillars = getDivinationTime(new Date(rain.start)).ganzhi;
  const result = await calculate('qimen', { question: '问题', currentTime, range: { ...rain, pillars } });
  const saved = JSON.parse(JSON.stringify(result));
  saved.data.branches[0].data.evidenceAnalysis.palaceFacts[0].promptText = '伪造证据';
  const next = await reprompt({ method: 'qimen', result: saved, question: '继续问' });
  assert.match(next.prompt.text, /继续问/);
  assert.doesNotMatch(next.prompt.text, /伪造证据/);
  for (const mutate of [
    (d: any) => { d.branches[0].data.zhiFu = '伪造值符'; },
    (d: any) => { d.branches[0].endTimestamp += 1000; },
    (d: any) => { d.branches[1].moonPhaseEvidence.end.illuminationPercent = -1; },
    (d: any) => { d.source.endExclusive = false; },
  ]) {
    const altered = structuredClone(saved); mutate(altered.data);
    await assert.rejects(() => reprompt({ method: 'qimen', result: altered, question: '继续问' }));
  }
  await assert.rejects(() => calculate('qimen', { question: '问题', range: { ...rain, pillars: { ...pillars, hour: '甲子' } } }));
  await assert.rejects(() => calculate('qimen', { question: '问题', range: { ...rain, end: '2024-02-19T05:00:01Z' } }));
  await assert.rejects(() => calculate('qimen', { question: '问题', range: { ...rain, start: '2024-02-19T03:00:00.500Z' } }));
  await assert.rejects(() => calculate('qimen', { question: '问题', range: rain, divinationTime: rain.start }));
  await assert.rejects(() => calculate('qimen', { question: '问题', range: rain, qimen: { timeStandard: 'true-solar' } }));
});

test('Worker HTTP 和 MCP 接收范围并可基于原区间追问', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'qimen' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const input = { question: '问题', currentTime, range: rain, qimen: { method: 'feipan', scope: 'hour' } };
  const response = await send('/api/calculate', { method: 'qimen', input });
  assert.equal(response.status, 200);
  const saved = await response.json();
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'qimen', arguments: input } });
  assert.equal(mcp.status, 200);
  assert.deepEqual((await mcp.json()).result.structuredContent.data, saved.data);
  assert.equal((await send('/api/prompt', { method: 'qimen', result: saved, question: '继续问' })).status, 200);
});

test('真太阳时范围逐秒覆盖修正时辰与日界，并保留真实交节', async () => {
  const cases = [
    { start: '2024-02-19T03:00:00Z', longitude: 116.4 },
    { start: '2024-02-04T15:00:00Z', longitude: 120 },
    { start: '2024-06-20T14:00:00Z', longitude: -180 },
    { start: '2024-12-21T09:00:00Z', longitude: 180 },
    { start: '2025-01-01T00:00:00Z', longitude: -73.9 },
  ];
  for (const { start, longitude } of cases) {
    const from = Date.parse(start), end = from + 2 * 3_600_000;
    const input = { question: '问题', currentTime, range: { start, end: new Date(end).toISOString() }, qimen: { timeStandard: 'true-solar', longitude } };
    const result = await calculate('qimen', input);
    const data = result.data as any;
    assert.match(result.prompt.text, /真太阳时/);
    for (const branch of data.branches) {
      const single = await calculate('qimen', { question: '问题', currentTime, divinationTime: new Date(branch.startTimestamp).toISOString(), qimen: input.qimen });
      assert.deepEqual(branch.data, single.data);
      assert.equal(branch.moonPhaseEvidence.start.utcTimestamp, branch.startTimestamp);
      assert.equal(branch.moonPhaseEvidence.end.utcTimestamp, branch.endTimestamp - 1000);
    }
    // Independent second-by-second check of all four pillars catches misplaced or missing cuts.
    for (let t = from; t < end; t += 1000) {
      const branch = data.branches.find((item: any) => item.startTimestamp <= t && t < item.endTimestamp);
      assert.ok(branch, `${start}/${longitude}/${t}`);
      const corrected = getDivinationTime(new Date(trueSolarTime(new Date(t), longitude).effectiveTimestamp)).ganzhi;
      const actual = getDivinationTime(new Date(t)).ganzhi;
      assert.deepEqual(branch.data.ganzhi, { ...corrected, year: actual.year, month: actual.month }, `${start}/${longitude}/${t}`);
    }
  }
  const result = await calculate('qimen', { question: '问题', currentTime, range: rain, qimen: { timeStandard: 'true-solar', longitude: 116.4 } });
  const branches = (result.data as any).branches;
  assert.deepEqual(branches.map((item: any) => item.startTimestamp), [Date.parse(rain.start), Date.parse('2024-02-19T03:28:17Z'), Date.parse('2024-02-19T04:13:12Z')]);
  const saved = JSON.parse(JSON.stringify(result));
  assert.match((await reprompt({ method: 'qimen', result: saved, question: '继续问' })).prompt.text, /继续问/);
  saved.data.branches[1].data.timeContext.longitude = 0;
  await assert.rejects(() => reprompt({ method: 'qimen', result: saved, question: '继续问' }));
  for (const scope of ['hour', 'day', 'month', 'year']) for (const method of ['zhuanpan', 'feipan']) {
    const scoped = await calculate('qimen', { question: '问题', currentTime, range: rain, qimen: { scope, method, timeStandard: 'true-solar', longitude: 116.4 } });
    for (const branch of (scoped.data as any).branches) {
      const single = await calculate('qimen', { question: '问题', currentTime, divinationTime: new Date(branch.startTimestamp).toISOString(), qimen: { scope, method, timeStandard: 'true-solar', longitude: 116.4 } });
      assert.deepEqual(branch.data, single.data);
    }
  }
});

test('Worker HTTP 和 MCP 使用相同的真太阳时范围盘与追问', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'qimen' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const input = { question: '问题', currentTime, range: rain, qimen: { timeStandard: 'true-solar', longitude: 116.4 } };
  const response = await send('/api/calculate', { method: 'qimen', input });
  assert.equal(response.status, 200);
  const saved = await response.json();
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'qimen', arguments: input } });
  assert.equal(mcp.status, 200);
  assert.deepEqual((await mcp.json()).result.structuredContent.data, saved.data);
  assert.equal((await send('/api/prompt', { method: 'qimen', result: saved, question: '继续问' })).status, 200);
});
