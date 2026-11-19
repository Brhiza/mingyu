import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { calculate, reprompt } from '../src/core';
import { createServer } from '../src/mcp';
import { getDivinationTime } from '../src/systems/calendar';
import { trueSolarTime } from '../src/systems/astronomy/true-solar';
import { createTimezoneOffsetReader, getCivilDateTimeAtFixedOffset } from '../src/systems/huangji/civil-time';
import { calculateBaziPillars } from '../src/systems/bazi/pillars';
import worker from '../src/worker';

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
const question = '分析姓名';
const positions = ['year', 'month', 'day', 'hour'] as const;
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value));

test('交节、午夜、真太阳时与夏令时范围逐秒覆盖，代表盘与独立八字逐项一致', async () => {
  for (const range of cases) {
    const result = await calculate('chinese-name', { fullName: '张知远', birthRange: range, question });
    const context = result.data.birthContext!;
    const segments = context.segments, start = Date.parse(range.start), end = Date.parse(range.end);
    assert.equal(Date.parse(segments[0].start!), start);
    assert.equal(Date.parse(segments.at(-1)!.end!), end);
    const offsetAt = range.timeZoneId ? createTimezoneOffsetReader(range.timeZoneId) : () => range.timezone ?? 8;
    for (const [index, segment] of segments.entries()) {
      const a = Date.parse(segment.start!), b = Date.parse(segment.end!);
      if (index) assert.equal(Date.parse(segments[index - 1].end!), a);
      for (let instant = a; instant < b; instant += 1000) {
        const offset = offsetAt(instant), actual = getDivinationTime(new Date(instant));
        const corrected = range.timeStandard === 'true-solar' ? trueSolarTime(new Date(instant), range.longitude!).effectiveTimestamp + (480 - offset * 60) * 60_000 : instant;
        const local = getDivinationTime(new Date(corrected), offset * 60);
        assert.equal(segment.timezone, offset);
        assert.deepEqual(segment.pillars, [actual.ganzhi.year, actual.ganzhi.month, local.ganzhi.day, local.ganzhi.hour], `${range.start}/${new Date(instant).toISOString()}`);
      }
      for (const instant of [...new Set([a, b - 1000, a + Math.floor((b - a) / 2000) * 1000])]) {
        const offset = offsetAt(instant), local = getCivilDateTimeAtFixedOffset(new Date(instant), offset);
        const chart = await calculateBaziPillars({ year: local.year, month: local.month, day: local.day,
          clock: { kind: 'exact', hour: local.hour, minute: local.minute, second: local.second }, timezone: offset,
          ...(range.timeStandard === 'true-solar' ? { timeStandard: 'true-solar', longitude: range.longitude } : {}) });
        assert.deepEqual(segment.pillars, positions.map((key) => chart.pillars[key].ganZhi));
        assert.deepEqual(segment.favorable, chart.usefulBaseline.favorable);
        assert.equal(segment.strength, chart.strength.status);
      }
    }
    const stable = segments[0].favorable.filter((item) => segments.every((segment) => segment.favorable.includes(item)));
    assert.deepEqual(context.stableFavorable, stable);
    assert.match(result.prompt.text, /出生范围/);
    assert.match(result.prompt.text, /终点不含/);
  }
});

test('四柱反推来源仅允许标准北京时间并核对整个半开范围', async () => {
  const start = '2024-02-04T16:00:00+08:00', end = '2024-02-04T16:10:00+08:00';
  const seed = await calculate('chinese-name', { fullName: '张知远', birthRange: { start, end }, question });
  const [year, month, day, hour] = seed.data.birthContext!.segments[0].pillars;
  const pillars = { year, month, day, hour };
  const valid = { start, end, pillars };
  const result = await calculate('chinese-naming', { surname: '张', limit: 3, birthRange: valid, question });
  assert.match(result.prompt.text, /四柱来源/);
  assert.match(result.prompt.text, /已核对所有分段/);
  await assert.rejects(() => calculate('chinese-name', { fullName: '张知远', birthRange: { ...valid, pillars: { ...pillars, hour: '甲子' } }, question }), /不一致/);
  await assert.rejects(() => calculate('chinese-name', { fullName: '张知远', birthRange: { start: '2024-02-04T16:20:00+08:00', end: '2024-02-04T16:35:00+08:00', pillars }, question }), /不一致/);
  for (const range of [
    { ...valid, timeZoneId: 'Asia/Shanghai' }, { ...valid, timezone: 9 }, { ...valid, timeStandard: 'true-solar', longitude: 120 },
    { start, end: start }, { start, end: '2024-02-04T18:00:01+08:00' }, { start: '2024-02-04T16:00:00.500+08:00', end },
    { start, end, timezone: 8, timeZoneId: 'Asia/Shanghai' }, { start, end, timeStandard: 'true-solar' },
  ]) await assert.rejects(() => calculate('chinese-name', { fullName: '张知远', birthRange: range, question }));
  await assert.rejects(() => calculate('chinese-name', { fullName: '张知远', birthRange: valid, birth: { year: 2024, month: 2, day: 4, clock: { kind: 'unknown' } }, question }));
  const saved = plain(result), next = await reprompt({ method: 'chinese-naming', result: saved, question: '继续追问' });
  assert.match(next.prompt.text, /继续追问/);
  saved.data.birthContext!.segments[0].pillars[0] = '伪造';
  await assert.rejects(() => reprompt({ method: 'chinese-naming', result: saved, question }), /不一致/);
});

test('范围通过 HTTP 与 MCP 计算并基于原范围追问', async () => {
  const input = { fullName: '张知远', birthRange: cases[1], question, currentTime: '2025-01-01T00:00:00Z' };
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'chinese-name' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', body: JSON.stringify(body) }), env);
  const response = await send('/api/calculate', { method: 'chinese-name', input }); assert.equal(response.status, 200);
  const result = await response.json(); assert.equal((await send('/api/prompt', { method: 'chinese-name', result, question: '追问' })).status, 200);
  const [ct, st] = InMemoryTransport.createLinkedPair(), server = createServer(['chinese-name']), client = new Client({ name: 'naming-range-test', version: '1' });
  await Promise.all([server.connect(st), client.connect(ct)]);
  try {
    const mcp = await client.callTool({ name: 'chinese-name', arguments: input });
    assert.deepEqual(mcp.structuredContent?.data, result.data);
    const reply = await client.callTool({ name: 'reprompt', arguments: { method: 'chinese-name', result: mcp.structuredContent, question: '追问' } });
    assert.equal(reply.isError, undefined);
  } finally { await client.close(); await server.close(); }
});
