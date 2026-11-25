import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import { calculateBaziPillars } from '../src/systems/bazi/pillars';
import { createTimezoneOffsetReader, getCivilDateTimeAtFixedOffset } from '../src/systems/huangji/civil-time';
import worker from '../src/worker';

const question = '分析出生范围';
const cases = [
  { start: '2024-02-04T16:20:00+08:00', end: '2024-02-04T16:35:00+08:00', timezone: 8 },
  { start: '2024-06-15T22:45:00+08:00', end: '2024-06-15T23:15:00+08:00', timezone: 8 },
  { start: '2024-06-15T23:59:30+08:00', end: '2024-06-16T00:00:30+08:00', timezone: 8 },
  { start: '2024-06-15T22:45:00+08:00', end: '2024-06-15T23:15:00+08:00', timezone: 8, timeStandard: 'true-solar' as const, longitude: 121.5 },
  { start: '2024-11-03T05:30:00Z', end: '2024-11-03T07:00:00Z', timeZoneId: 'America/New_York' },
  { start: '2024-03-10T06:30:00Z', end: '2024-03-10T08:00:00Z', timeZoneId: 'America/New_York' },
  { start: '2011-12-30T09:59:58Z', end: '2011-12-30T10:00:02Z', timeZoneId: 'Pacific/Apia' },
  { start: '2024-01-01T00:00:00Z', end: '2024-01-01T00:00:01Z', timezone: 8 },
];

test('指定范围逐段覆盖交节、换日、夏令时和真太阳时，并与精确排盘核对', async () => {
  for (const birthRange of cases) {
    const result = await calculate('bazi', { birthRange, gender: 'female', question });
    const unknown = result.data.unknown!, segments = unknown.segments;
    assert.equal(result.data.chart, null); assert.equal(result.data.fortune, null); assert.equal(result.data.located, null);
    assert.equal(segments[0].startTimestamp, Date.parse(birthRange.start));
    assert.equal(segments.at(-1)!.endTimestamp, Date.parse(birthRange.end));
    assert.match(result.prompt.text, /指定出生范围/); assert.match(result.prompt.text, /终点不含/);
    assert.match(result.prompt.text, /不得将某个候选时段当作已确定出生时间/);
    const offsetAt = birthRange.timeZoneId ? createTimezoneOffsetReader(birthRange.timeZoneId) : () => birthRange.timezone ?? 8;
    for (const [index, segment] of segments.entries()) {
      if (index) assert.equal(segments[index - 1].endTimestamp, segment.startTimestamp);
      assert.equal(segment.shensha.included.length, 56);
      for (const timestamp of new Set([segment.startTimestamp, segment.endTimestamp - 1000, segment.startTimestamp + Math.floor((segment.endTimestamp - segment.startTimestamp) / 2000) * 1000])) {
        const offset = offsetAt(timestamp), local = getCivilDateTimeAtFixedOffset(new Date(timestamp), offset);
        const exact = await calculateBaziPillars({ year: local.year, month: local.month, day: local.day, clock: { kind: 'exact', hour: local.hour, minute: local.minute, second: local.second }, timezone: offset,
          ...(birthRange.timeStandard === 'true-solar' ? { timeStandard: 'true-solar', longitude: birthRange.longitude } : {}) }, 'female');
        assert.deepEqual(segment.pillars, exact.pillars, `${birthRange.start}/${timestamp}`);
        assert.deepEqual(segment.shensha, exact.shensha, `${birthRange.start}/${timestamp}`);
      }
    }
    const reply = await reprompt({ method: 'bazi', result: JSON.parse(JSON.stringify(result)), question: '继续比较' });
    assert.match(reply.prompt.text, /继续比较/);
  }
});

test('反推候选可直接用于八字并核对来源，错误范围和岁运参数明确拒绝', async () => {
  const pillars = { year: '甲辰', month: '丙寅', day: '戊戌', hour: '庚申' };
  const reverse = await calculate('bazi-reverse', { pillars, startYear: 2024, endYear: 2024 });
  const birthRange = reverse.data.candidates[0].birthRange;
  const result = await calculate('bazi', { birthRange, question });
  assert.ok(result.data.unknown!.segments.every((segment) => Object.entries(pillars).every(([key, value]) => segment.pillars[key as keyof typeof pillars].ganZhi === value)));
  assert.match(result.prompt.text, /四柱来源已核对所有分段/);
  assert.match(reverse.prompt.text, /用于八字、姓名分析或起名/);
  await assert.rejects(() => calculate('bazi', { birthRange: { ...birthRange, pillars: { ...pillars, hour: '甲子' } }, question }), /不一致/);
  for (const invalid of [
    { question }, { question, birthRange, birth: { year: 2024, month: 2, day: 4, clock: { kind: 'unknown' } } },
    { question, birthRange, gender: 'female', referenceTime: '2025-01-01T00:00:00Z' },
    { question, birthRange, prompt: { scope: 'year' } },
    { question, birthRange: { ...birthRange, end: birthRange.start } },
    { question, birthRange: { ...birthRange, timezone: 9 } },
    { question, birthRange: { ...birthRange, timeZoneId: 'Asia/Shanghai' } },
    { question, birthRange: { ...birthRange, timeStandard: 'true-solar' } },
    { question, birthRange: { start: '2100-12-31T23:59:59+08:00', end: '2101-01-01T00:00:01+08:00', timezone: 8 } },
    { question, birthRange: { start: '1899-12-31T23:59:59+08:00', end: '1900-01-01T00:00:01+08:00', timezone: 8 } },
  ]) await assert.rejects(() => calculate('bazi', invalid));
  const bad = structuredClone(result); bad.data.unknown!.segments[0].pillars.day.ganZhi = '伪造';
  await assert.rejects(() => reprompt({ method: 'bazi', result: bad, question }), /不一致/);
});

test('出生范围的 HTTP、MCP 和保存追问返回一致结果', async () => {
  const input = { birthRange: cases[0], gender: 'male', question, currentTime: '2025-01-01T00:00:00Z' };
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'bazi' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const http = await send('/api/calculate', { method: 'bazi', input }); assert.equal(http.status, 200); const saved = await http.json();
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'bazi', arguments: input } });
  assert.deepEqual((await mcp.json()).result.structuredContent.data, saved.data);
  assert.equal((await send('/api/prompt', { method: 'bazi', result: saved, question: '追问' })).status, 200);
});
