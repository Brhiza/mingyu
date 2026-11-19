import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import { locateBaziFortune } from '../src/systems/bazi/fortune';
import worker from '../src/worker';

const birth = { year: 1990, month: 5, day: 15, clock: { kind: 'exact', hour: 14, minute: 30, second: 0 }, timezone: 8 };
const base = { birth, gender: 'male', question: '这一年的流月如何？', currentTime: '2025-01-01T00:00:00Z' };
// 台北市立天文科学教育馆《2024 天文年鉴》节气表，UTC+8，分钟级。
const jie = [
  ['立春', '2024-02-04T16:27:00+08:00', '寅'], ['惊蛰', '2024-03-05T10:23:00+08:00', '卯'],
  ['清明', '2024-04-04T15:02:00+08:00', '辰'], ['立夏', '2024-05-05T08:10:00+08:00', '巳'],
  ['芒种', '2024-06-05T12:10:00+08:00', '午'], ['小暑', '2024-07-06T22:20:00+08:00', '未'],
  ['立秋', '2024-08-07T08:09:00+08:00', '申'], ['白露', '2024-09-07T11:11:00+08:00', '酉'],
  ['寒露', '2024-10-08T03:00:00+08:00', '戌'], ['立冬', '2024-11-07T06:20:00+08:00', '亥'],
  ['大雪', '2024-12-06T23:17:00+08:00', '子'],
] as const;

test('立春年包含十二流月，以年鉴交节时刻及月支核对', async () => {
  const result = await calculate('bazi', { ...base, timelineYear: 2024 });
  const timeline = result.data.timeline!;
  assert.equal(timeline.year, 2024); assert.equal(timeline.timezone, 'UTC+08:00');
  assert.equal(timeline.segments.length, 12);
  for (const [index, [name, time, branch]] of jie.entries()) {
    const segment = timeline.segments[index];
    assert.equal(segment.jie.name, name);
    assert.ok(Math.abs(segment.startTimestamp - Date.parse(time)) < 60_000, name);
    assert.equal(segment.year.ganZhi, '甲辰'); assert.equal(segment.month.zhi, branch);
    assert.equal(segment.endTimestamp, timeline.segments[index + 1].startTimestamp);
  }
  const last = timeline.segments.at(-1)!;
  assert.equal(last.jie.name, '小寒'); assert.equal(last.month.zhi, '丑');
  assert.equal(last.endTimestamp, timeline.yearEndTimestamp);
  assert.match(result.prompt.text, /【2024立春年流月时间线】/);
  assert.match(result.prompt.text, /不代表整段内的流日、流时/);
});

test('出生、童限、交运和末运边界裁剪并与单时刻定位一致', async () => {
  for (const year of [1990, 1997, 2017, 2100, 2117]) {
    const result = await calculate('bazi', { ...base, timelineYear: year });
    const { timeline, chart, fortune } = result.data;
    assert.ok(timeline && chart && fortune);
    assert.equal(timeline.startTimestamp, Math.max(timeline.yearStartTimestamp, fortune.birthTimestamp));
    assert.equal(timeline.endTimestamp, Math.min(timeline.yearEndTimestamp, fortune.cycles.at(-1)!.endTimestamp));
    assert.equal(timeline.segments[0].startTimestamp, timeline.startTimestamp);
    assert.equal(timeline.segments.at(-1)!.endTimestamp, timeline.endTimestamp);
    for (const [index, segment] of timeline.segments.entries()) {
      if (index) assert.equal(segment.startTimestamp, timeline.segments[index - 1].endTimestamp);
      assert.ok(segment.startTimestamp < segment.endTimestamp);
      for (const timestamp of [segment.startTimestamp, segment.endTimestamp - 1000]) {
        const exact = locateBaziFortune(chart, fortune, timestamp);
        assert.equal(segment.year.ganZhi, exact.year.ganZhi, `${year}/${timestamp}`);
        assert.equal(segment.month.ganZhi, exact.month.ganZhi, `${year}/${timestamp}`);
        assert.equal(segment.cycle?.index ?? null, exact.cycle?.index ?? null, `${year}/${timestamp}`);
        assert.equal(segment.childhood, exact.inChildhood, `${year}/${timestamp}`);
        const relevant = exact.evidence.comparisons.filter((pair) => ['dayun', 'year', 'month'].includes(pair.source));
        assert.deepEqual(segment.evidence.comparisons, relevant, `${year}/${timestamp}`);
      }
    }
    if (year === 1990) assert.equal(timeline.startTimestamp, fortune.birthTimestamp);
    if (year === 2017) assert.ok(timeline.segments.some((segment, index) => index && segment.jie.name === timeline.segments[index - 1].jie.name && segment.cycle?.index !== timeline.segments[index - 1].cycle?.index));
    if (year === 2117) assert.equal(timeline.endTimestamp, fortune.cycles.at(-1)!.endTimestamp);
  }
});

test('输入边界、保存追问和作用范围明确', async () => {
  for (const invalid of [
    { ...base, timelineYear: 1989 }, { ...base, timelineYear: 2118 }, { ...base, timelineYear: 2200 }, { ...base, timelineYear: 2024.5 },
    { ...base, gender: undefined, timelineYear: 2024 },
    { ...base, birth: { ...birth, clock: { kind: 'unknown' } }, timelineYear: 2024 },
    { ...base, birth: undefined, birthRange: { start: '1990-05-15T06:30:00Z', end: '1990-05-15T06:31:00Z', timezone: 8 }, timelineYear: 2024 },
  ]) await assert.rejects(() => calculate('bazi', invalid));
  const saved = JSON.parse(JSON.stringify(await calculate('bazi', { ...base, timelineYear: 2024 })));
  const reply = await reprompt({ method: 'bazi', result: saved, question: '继续比较' });
  assert.match(reply.prompt.text, /2024立春年流月时间线/); assert.match(reply.prompt.text, /继续比较/);
  const natal = await reprompt({ method: 'bazi', result: saved, question: '只看本命', prompt: { scope: 'natal' } });
  assert.doesNotMatch(natal.prompt.text, /流月时间线/);
  saved.data.timeline.segments[0].month.ganZhi = '甲子';
  await assert.rejects(() => reprompt({ method: 'bazi', result: saved, question: '继续' }), /不一致/);
});

test('支持年份两端，最后一个流月可跨公历年', async () => {
  for (const [birthYear, timelineYear] of [[1900, 1900], [2080, 2199]] as const) {
    const result = await calculate('bazi', { ...base, birth: { ...birth, year: birthYear, month: 6 }, timelineYear });
    const timeline = result.data.timeline!;
    assert.ok(timeline.segments.length > 0);
    assert.equal(new Date(timeline.yearEndTimestamp + 8 * 3_600_000).getUTCFullYear(), timelineYear + 1);
    assert.equal(timeline.segments.at(-1)!.endTimestamp, timeline.endTimestamp);
  }
});

test('HTTP、MCP 返回相同时间线并支持原盘追问', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'bazi' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const input = { ...base, timelineYear: 2024 };
  const http = await send('/api/calculate', { method: 'bazi', input }); assert.equal(http.status, 200); const saved: any = await http.json();
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'bazi', arguments: input } });
  const response: any = await mcp.json();
  assert.deepEqual(response.result.structuredContent.data.timeline, saved.data.timeline);
  const follow = await send('/api/prompt', { method: 'bazi', result: saved, question: '继续' });
  assert.equal(follow.status, 200); assert.match((await follow.json() as any).prompt.text, /流月时间线/);
});
