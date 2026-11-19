import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import worker from '../src/worker';

const birth = { year: 2024, month: 2, day: 19, hour: 11, minute: 0, second: 0, timezone: 8 };
const birthRange = { start: '2024-02-19T03:00:00Z', end: '2024-02-19T05:00:00Z' };
const currentTime = '2025-01-01T00:00:00Z';
const base = { birth, birthRange, gender: 'male', stagePolicy: { model: 'decadalGanzhi' }, question: '事业如何？', currentTime };

test('出生范围逐秒跨交节，保留完整来源与分页位置', async () => {
  const first = await calculate('qimen-lifetime', base);
  const transition = await calculate('qimen-lifetime', { ...base, birthRange: { ...birthRange, index: 4392 } });
  const last = await calculate('qimen-lifetime', { ...base, birthRange: { ...birthRange, index: 7199 } });
  assert.equal(first.data.birthRange!.totalSamples, 7200);
  assert.equal(first.data.birthRange!.nextIndex, 1);
  assert.equal(first.data.birthRange!.endExclusive, true);
  assert.equal(first.data.baseChart.timeInfo.solarTerm, '立春');
  assert.equal(transition.data.baseChart.timeInfo.solarTerm, '雨水');
  assert.equal(transition.data.basis.birthTimestamp, Date.parse('2024-02-19T04:13:12Z'));
  assert.equal(last.data.birthRange!.timestamp, Date.parse(birthRange.end) - 1000);
  assert.equal(last.data.birthRange!.nextIndex, null);
  assert.match(transition.prompt.text, /第 4393 个候选秒，共 7200 个/);
  assert.match(transition.prompt.text, /不把本次结果当作整个出生区间的确定结论/);
  const point = await calculate('qimen-lifetime', { ...base, birthRange: undefined, birth: { ...birth, hour: 12, minute: 13, second: 12 } });
  assert.deepEqual(transition.data.baseChart, point.data.baseChart);
  assert.deepEqual(transition.data.stages, point.data.stages);
  assert.deepEqual(transition.data.personalMarkers, point.data.personalMarkers);
  assert.deepEqual(transition.data.input.birth, birth);
  const dynamicRange = { startDate: '2026-01-01', endDate: '2026-12-31' };
  const rangedDynamic = await calculate('qimen-lifetime', { ...base, birthRange: { ...birthRange, index: 4392 }, periodRange: dynamicRange });
  const pointDynamic = await calculate('qimen-lifetime', { ...base, birthRange: undefined, birth: { ...birth, hour: 12, minute: 13, second: 12 }, periodRange: dynamicRange });
  assert.deepEqual(rangedDynamic.data.dynamicFacts, pointDynamic.data.dynamicFacts);
  assert.match((await reprompt({ method: 'qimen-lifetime', result: JSON.parse(JSON.stringify(rangedDynamic)), question: '继续问' })).prompt.text, /动态时间事实/);
});

test('夏令时回拨候选按真实瞬时读取对应偏移，真太阳时仍保留实际出生', async () => {
  const start = { year: 2024, month: 11, day: 3, hour: 1, minute: 59, second: 59, timezone: -4, timeZoneId: 'America/New_York', timeStandard: 'true-solar', longitude: -74 };
  const input = { question: '问题', currentTime, birth: start, birthRange: { start: '2024-11-03T05:59:59Z', end: '2024-11-03T06:00:01Z', index: 1 } };
  const result = await calculate('qimen-lifetime', input);
  assert.equal(result.data.basis.localDateTime, '2024-11-03T01:00:00');
  assert.equal(result.data.basis.timezone, -5);
  assert.equal(result.data.basis.birthTimestamp, Date.parse('2024-11-03T06:00:00Z'));
  assert.equal(result.data.baseChart.timeContext?.referenceTimestamp, Date.parse('2024-11-03T06:00:00Z'));
  const point = await calculate('qimen-lifetime', { question: '问题', currentTime, birth: { ...start, hour: 1, minute: 0, second: 0, timezone: -5 } });
  assert.deepEqual(result.data.baseChart, point.data.baseChart);
  assert.deepEqual(result.data.stages, point.data.stages);
});

test('农历闰月起点可用于范围，候选秒仍按实际时区换算', async () => {
  const lunar = { year: 2023, month: 2, day: 1, hour: 12, minute: 0, second: 0, calendar: 'lunar', leapMonth: true, timezone: 8 };
  const result = await calculate('qimen-lifetime', { question: '问题', birth: lunar, birthRange: { start: '2023-03-22T04:00:00Z', end: '2023-03-22T04:00:02Z', index: 1 } });
  assert.equal(result.data.basis.localDateTime, '2023-03-22T12:00:01');
  assert.equal(result.data.basis.calendar, 'lunar');
  assert.equal(result.data.input.birth.leapMonth, true);
});

test('出生范围和原始输入不一致、无效索引及篡改结果均被拒绝', async () => {
  for (const invalid of [
    { ...birthRange, index: -1 }, { ...birthRange, index: 7200 }, { ...birthRange, index: 1.5 },
    { ...birthRange, end: '2024-02-19T05:00:01Z' }, { ...birthRange, end: birthRange.start },
    { ...birthRange, start: '2024-02-19T03:00:00.500Z' }, { ...birthRange, start: '2024-02-19T03:00:01Z' },
  ]) await assert.rejects(() => calculate('qimen-lifetime', { ...base, birthRange: invalid }));
  const result = await calculate('qimen-lifetime', { ...base, birthRange: { ...birthRange, index: 4392 } });
  const saved = JSON.parse(JSON.stringify(result));
  const next = await reprompt({ method: 'qimen-lifetime', result: saved, question: '继续问' });
  assert.match(next.prompt.text, /第 4393 个候选秒/);
  for (const mutate of [(d: any) => d.birthRange.index++, (d: any) => d.birthRange.endTimestamp += 1000, (d: any) => d.baseChart.zhiFu = '伪造']) {
    const altered = structuredClone(saved); mutate(altered.data);
    await assert.rejects(() => reprompt({ method: 'qimen-lifetime', result: altered, question: '继续问' }), /不一致/);
  }
});

test('Worker HTTP 和 MCP 对范围候选及原盘追问保持一致', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'qimen-lifetime' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const input = { ...base, birthRange: { ...birthRange, index: 4392 } };
  const http = await send('/api/calculate', { method: 'qimen-lifetime', input });
  assert.equal(http.status, 200); const saved = await http.json();
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'qimen-lifetime', arguments: input } });
  assert.deepEqual((await mcp.json()).result.structuredContent.data, saved.data);
  assert.equal((await send('/api/prompt', { method: 'qimen-lifetime', result: saved, question: '继续问' })).status, 200);
});
