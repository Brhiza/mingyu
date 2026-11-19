import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { SolarTerm } from 'tyme4ts';
import { calculate, reprompt } from '../src/core';
import catalog from '../src/prompt-catalog.json';
import worker from '../src/worker';

const currentTime = '2025-01-01T00:00:00Z';
const question = '整体变化如何';
const sixDayTime = '2026-08-24T15:30:00+08:00';
const epoch = '2026-08-20T00:00:00+08:00';

test('值年提示词包含各层卦辞爻象和断法，自定义纪元不虚构值年卦', async () => {
  const result = await calculate('huangji-jingshi', {
    currentTime, question, huangji: { mode: 'year', year: 2025 },
    prompt: { topicId: 'timing', subtopicId: 'decision', schools: ['yuanhui', 'guaqi'], includeClassics: true },
  });
  const chart = result.data.chart;
  for (const key of ['governing', 'yun', 'sixtyYear', 'decade'] as const) {
    const hexagram = chart.forecast!.hexagrams[key].hexagram;
    assert.ok(result.prompt.text.includes(hexagram.name));
    assert.ok(result.prompt.text.includes(hexagram.judgment));
  }
  for (const hexagram of Object.values(chart.forecast!.relatedHexagrams)) {
    assert.ok(result.prompt.text.includes(hexagram.name));
    assert.ok(result.prompt.text.includes(hexagram.judgment));
  }
  for (const text of ['值年卦爻象', '初爻', '上爻', '决策时机', '元会运世法', '值年卦气法', '分别分析', '经典依据']) {
    assert.ok(result.prompt.text.includes(text), text);
  }
  const coordinate = await calculate('huangji-jingshi', { currentTime, question, huangji: { mode: 'coordinate', epochYear: 500, elapsedYears: 360 }, prompt: { schools: ['guaqi'] } });
  assert.match(coordinate.prompt.text, /没有通行值年卦/);
  assert.equal(coordinate.data.chart.forecast, undefined);
  const beforeEra = await calculate('huangji-jingshi', { currentTime, question, huangji: { mode: 'year', year: -1 } });
  assert.match(beforeEra.prompt.text, /目标年：公元前1年/);
  assert.match(beforeEra.prompt.text, /公元纪年（无公元0年）/);
});

test('年月日时及两种六日逐爻模型保留历元、时区与卦位', async () => {
  for (const date of ['2024-12-20T12:00:00Z', '2024-12-21T12:00:00Z', '2026-08-24T15:30:00+08:00']) {
    const result = await calculate('huangji-jingshi', { currentTime, question, huangji: { mode: 'datetime', date } });
    assert.ok(result.data.chart.dateTimeForecast?.hexagrams.hourJing.name);
  }
  for (const model of ['six-day-seven-part', 'six-day-explicit-epoch'] as const) {
    const settings = { mode: 'six-day' as const, dateTime: sixDayTime, calendarModel: model, ...(model === 'six-day-explicit-epoch' ? { epochDateTime: epoch } : {}) };
    const result = await calculate('huangji-jingshi', { currentTime, question, huangji: settings });
    assert.equal(result.data.chart.sixDayCycle?.calendar.model, model);
    assert.ok(result.prompt.text.includes(result.data.chart.sixDayCycle!.hexagrams.hourly.name));
  }
});

test('年月日时覆盖节气交接及四小时时段，保留经纬层级的资料', async () => {
  const timestamps: number[] = [];
  for (const year of [1900, 2024, 2199]) {
    for (let index = 0; index < 24; index++) {
      const time = SolarTerm.fromIndex(year, index).getJulianDay().getSolarTime();
      const date = new Date(0);
      date.setUTCFullYear(time.getYear(), time.getMonth() - 1, time.getDay());
      date.setUTCHours(time.getHour() - 8, time.getMinute(), time.getSecond(), 0);
      timestamps.push(date.getTime() - 1, date.getTime(), date.getTime() + 1);
    }
  }
  for (const hour of [0, 3, 4, 7, 8, 11, 12, 15, 16, 19, 20, 23]) {
    timestamps.push(Date.UTC(2024, 1, 29, hour - 8, 30));
  }
  for (const timestamp of timestamps) {
    const date = new Date(timestamp).toISOString();
    const result = await calculate('huangji-jingshi', { currentTime, question, huangji: { mode: 'datetime', date } });
    const detail = result.data.chart.dateTimeForecast!;
    for (const key of ['monthJing', 'xunWei', 'daily', 'hourJing'] as const) {
      assert.ok(result.prompt.text.includes(detail.hexagrams[key].name), `${date} ${key}`);
      assert.ok(result.prompt.text.includes(detail.hexagrams[key].judgment), `${date} ${key} 卦辞`);
    }
    assert.ok(result.prompt.text.includes(detail.calendar.hourRange), date);
    assert.match(result.prompt.text, /映射/);
  }
});

test('原盘追问保留起法及历元，拒绝修改盘面和错误组合', async () => {
  const modes = [
    { mode: 'year', year: 2025 },
    { mode: 'datetime', date: '2026-08-24T15:30:00+08:00' },
    { mode: 'coordinate', epochYear: 500, elapsedYears: 11845 },
    { mode: 'six-day', dateTime: sixDayTime, calendarModel: 'six-day-seven-part' },
    { mode: 'six-day', dateTime: sixDayTime, calendarModel: 'six-day-explicit-epoch', epochDateTime: epoch },
  ];
  for (const huangji of modes) {
    const saved = JSON.parse(JSON.stringify(await calculate('huangji-jingshi', { currentTime, question, huangji })));
    const next = await reprompt({ method: 'huangji-jingshi', result: saved, question: '新的问题', prompt: { schools: ['yuanhui', 'guaqi'], includeClassics: true } });
    assert.match(next.prompt.text, /新的问题/);
    assert.match(next.prompt.text, /元会运世法/);
    assert.match(next.prompt.text, /值年卦气法/);
    assert.match(next.prompt.text, /经典依据/);
    const bad = structuredClone(saved); bad.data.chart.position.shi.indexInYun = 999;
    await assert.rejects(() => reprompt({ method: 'huangji-jingshi', result: bad, question: '追问' }), /不一致/);
  }
  for (const invalid of [
    { mode: 'year', year: 0 }, { mode: 'year', year: 2025, epochYear: 1000 },
    { mode: 'datetime', date: '2026-08-24' }, { mode: 'coordinate', epochYear: 1000 },
    { mode: 'coordinate', epochYear: 1000, year: 2025, elapsedYears: 1025 },
    { mode: 'six-day', dateTime: sixDayTime, calendarModel: 'six-day-explicit-epoch' },
    { mode: 'six-day', dateTime: sixDayTime, calendarModel: 'six-day-seven-part', epochDateTime: epoch },
  ]) await assert.rejects(() => calculate('huangji-jingshi', { currentTime, question, huangji: invalid }));
  await assert.rejects(() => calculate('huangji-jingshi', { currentTime, question, huangji: { mode: 'year', year: 2025 }, prompt: { scope: 'yearly' } }));
  const baseline = JSON.parse(readFileSync(new URL('../docs/v2-capability-baseline.json', import.meta.url), 'utf8'));
  const original = baseline.promptCapabilities.find((item: any) => item.methodId === 'huangji-jingshi');
  assert.deepEqual(catalog['huangji-jingshi'].topicIds, original.topicIds);
  assert.deepEqual(catalog['huangji-jingshi'].subtopics, original.subtopics);
  const saved = JSON.parse(JSON.stringify(await calculate('huangji-jingshi', { currentTime, question, huangji: { mode: 'year', year: 2025 } })));
  for (const [topicId, choices] of Object.entries(catalog['huangji-jingshi'].subtopics)) for (const choice of choices as { id: string; label: string }[]) {
    const response = await reprompt({ method: 'huangji-jingshi', result: saved, question: '追问', prompt: { topicId, subtopicId: choice.id } });
    assert.ok(response.prompt.text.includes(choice.label));
  }
});

test('Worker HTTP 与 MCP 使用同一皇极盘面及提示词', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'huangji-jingshi' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const input = { currentTime, question, huangji: { mode: 'year', year: 2025 } };
  const response = await send('/api/calculate', { method: 'huangji-jingshi', input });
  assert.equal(response.status, 200);
  const saved = await response.json();
  assert.equal((await send('/api/prompt', { method: 'huangji-jingshi', result: saved, question: '追问' })).status, 200);
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'huangji-jingshi', arguments: input } });
  assert.equal(mcp.status, 200);
  assert.equal((await mcp.json()).result.structuredContent.data.chart.input.year, 2025);
  const timed = { currentTime, question, huangji: { mode: 'datetime', date: '2024-12-21T12:00:00Z' } };
  const httpTimed = await send('/api/calculate', { method: 'huangji-jingshi', input: timed });
  assert.equal(httpTimed.status, 200);
  const timedResult = await httpTimed.json();
  const continued = await send('/api/prompt', { method: 'huangji-jingshi', result: timedResult, question: '继续分析时经卦' });
  assert.equal(continued.status, 200);
  assert.ok((await continued.json()).prompt.text.includes(timedResult.data.chart.dateTimeForecast.hexagrams.hourJing.name));
  const mcpTimed = await send('/mcp', { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'huangji-jingshi', arguments: timed } });
  assert.equal(mcpTimed.status, 200);
  assert.deepEqual((await mcpTimed.json()).result.structuredContent.data.chart, timedResult.data.chart);
});
