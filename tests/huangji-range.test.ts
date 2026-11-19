import assert from 'node:assert/strict';
import test from 'node:test';
import { SolarTerm } from 'tyme4ts';
import { calculate, reprompt } from '../src/core';
import { createUtcTimestamp } from '../src/systems/huangji/civil-time';
import { resolveCalendar } from '../src/systems/huangji/datetime';
import { trueSolarTime } from '../src/systems/astronomy/true-solar';
import { getDivinationTime } from '../src/systems/calendar';
import worker from '../src/worker';

const now = '2025-01-01T00:00:00Z';
function termTime(year: number, index: number) {
  const t = SolarTerm.fromIndex(year, index).getJulianDay().getSolarTime();
  return createUtcTimestamp(t.getYear(), t.getMonth() - 1, t.getDay(), t.getHour() - 8, t.getMinute(), t.getSecond());
}

test('皇极真太阳时以实际占时定节气和皇极日序', async () => {
  for (let index = 0; index < 24; index++) for (const delta of [-1000, 1000]) for (const longitude of [75, 116.4, 150]) {
    const date = new Date(termTime(2024, index) + delta), corrected = new Date(trueSolarTime(date, longitude).effectiveTimestamp);
    const result = await calculate('huangji-jingshi', { question: '问题', currentTime: now, huangji: { mode: 'datetime', date: date.toISOString(), timeStandard: 'true-solar', longitude } });
    const actual = result.data.chart.dateTimeForecast;
    assert.match(result.prompt.text, /真太阳时钟表/);
    assert.match(result.prompt.text, /节气、皇极年及日序依据实际占时/);
    assert.doesNotMatch(actual.calculationChain[0], /按北京时间起盘/);
  }
});

test('皇极日序在交节后每个真实 24 小时边界切分', async () => {
  for (let index = 0; index < 24; index++) for (const day of [0, 1, 5, 10, 13]) {
    const at = termTime(2024, index) + day * 86_400_000;
    const result = await calculate('huangji-jingshi', { question: '问题', currentTime: now,
      range: { start: new Date(at - 1000).toISOString(), end: new Date(at + 1000).toISOString() }, huangji: { mode: 'datetime' } });
    const branches = (result.data as any).branches;
    assert.equal(branches.length, 2, `${index}/${day}`);
    assert.equal(branches[0].endTimestamp, at);
    assert.notDeepEqual(branches[0].chart.dateTimeForecast.calendar, branches[1].chart.dateTimeForecast.calendar);
  }
});

test('范围逐秒验证四小时时段、交节及皇极日序，分支首盘等于单盘', async () => {
  const cases = [
    { start: '2024-02-19T03:00:00Z', settings: { mode: 'datetime' as const } },
    { start: '2024-02-19T03:00:00Z', settings: { mode: 'datetime' as const, timeStandard: 'true-solar' as const, longitude: 116.4 } },
    { start: '2024-02-04T15:00:00Z', settings: { mode: 'datetime' as const, timeStandard: 'true-solar' as const, longitude: 75 } },
  ];
  for (const { start, settings } of cases) {
    const from = Date.parse(start), end = from + 7_200_000, range = { start, end: new Date(end).toISOString() };
    const result = await calculate('huangji-jingshi', { question: '问题', currentTime: now, range, huangji: settings });
    const branches = (result.data as any).branches;
    assert.match(result.prompt.text, /该分支起点的代表时刻/);
    for (const branch of branches) {
      const single = await calculate('huangji-jingshi', { question: '问题', currentTime: now, huangji: { ...settings, date: new Date(branch.startTimestamp).toISOString() } });
      assert.deepEqual(branch.chart, single.data.chart);
    }
    for (let timestamp = from; timestamp < end; timestamp += 1000) {
      const branch = branches.find((item: any) => item.startTimestamp <= timestamp && timestamp < item.endTimestamp);
      assert.ok(branch, `${start}/${timestamp}`);
      const actual = new Date(timestamp), adjusted = settings.timeStandard === 'true-solar' ? new Date(trueSolarTime(actual, settings.longitude).effectiveTimestamp) : actual;
      const expected = resolveCalendar(adjusted, actual), calendar = branch.chart.dateTimeForecast.calendar;
      for (const key of ['forecastYear', 'activeSolarTerm', 'actualDayInSolarTerm', 'mappedDayInSolarTerm', 'monthIndex', 'dayOfMonth', 'dayOfYear', 'hourSegment'] as const) assert.equal(calendar[key], expected[key], `${start}/${timestamp}/${key}`);
    }
  }
});

test('保存范围和单盘可追问，拒绝篡改、错误时间口径及不支持的组合', async () => {
  const range = { start: '2024-02-19T03:00:00Z', end: '2024-02-19T05:00:00Z' }, settings = { mode: 'datetime', timeStandard: 'true-solar', longitude: 116.4 };
  const saved = JSON.parse(JSON.stringify(await calculate('huangji-jingshi', { question: '问题', currentTime: now, range, huangji: settings })));
  assert.equal(saved.data.kind, 'range');
  assert.match((await reprompt({ method: 'huangji-jingshi', result: saved, question: '继续问' })).prompt.text, /继续问/);
  for (const mutate of [
    (data: any) => { data.branches[0].endTimestamp += 1000; },
    (data: any) => { data.branches[0].chart.dateTimeForecast.calendar.hourSegment = 99; },
    (data: any) => { data.branches[0].chart.timeContext.longitude += 1; },
    (data: any) => { data.source.endExclusive = false; },
  ]) {
    const bad = structuredClone(saved); mutate(bad.data);
    await assert.rejects(() => reprompt({ method: 'huangji-jingshi', result: bad, question: '追问' }));
  }
  const single = JSON.parse(JSON.stringify(await calculate('huangji-jingshi', { question: '问题', currentTime: now, huangji: { ...settings, date: range.start } })));
  assert.match((await reprompt({ method: 'huangji-jingshi', result: single, question: '追问' })).prompt.text, /真太阳时/);
  single.data.input.longitude = 0;
  await assert.rejects(() => reprompt({ method: 'huangji-jingshi', result: single, question: '追问' }));
  await assert.rejects(() => calculate('huangji-jingshi', { question: '问题', huangji: { mode: 'datetime' } }));
  await assert.rejects(() => calculate('huangji-jingshi', { question: '问题', range, huangji: { mode: 'datetime', date: range.start } }));
  await assert.rejects(() => calculate('huangji-jingshi', { question: '问题', range, huangji: { mode: 'year', year: 2024 } }));
  await assert.rejects(() => calculate('huangji-jingshi', { question: '问题', range, huangji: { mode: 'datetime', timeStandard: 'true-solar' } }));
  const pillars = getDivinationTime(new Date(range.start)).ganzhi;
  await assert.rejects(() => calculate('huangji-jingshi', { question: '问题', range: { ...range, pillars: { ...pillars, hour: '甲子' } }, huangji: { mode: 'datetime' } }));
});

test('Worker HTTP 和 MCP 提供真太阳时范围及原盘追问', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'huangji-jingshi' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const input = { question: '问题', currentTime: now, range: { start: '2024-02-19T03:00:00Z', end: '2024-02-19T05:00:00Z' }, huangji: { mode: 'datetime', timeStandard: 'true-solar', longitude: 116.4 } };
  const response = await send('/api/calculate', { method: 'huangji-jingshi', input }); assert.equal(response.status, 200);
  const saved = await response.json();
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'huangji-jingshi', arguments: input } });
  assert.deepEqual((await mcp.json()).result.structuredContent.data, saved.data);
  assert.equal((await send('/api/prompt', { method: 'huangji-jingshi', result: saved, question: '追问' })).status, 200);
});
