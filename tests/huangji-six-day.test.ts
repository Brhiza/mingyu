import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate, reprompt } from '../src/core';
import { calculateHuangjiSixDayCycle } from '../src/systems/huangji/six-day';
import worker from '../src/worker';

const currentTime = '2025-01-01T00:00:00Z';
const question = '此时变化如何？';

test('书绪言扫描例的复卦六日及四小时变爻', () => {
  // 《书绪言》中华书局聚珍仿宋本第二册第 10 页：复初变坤，次变临，历明夷震屯颐。
  const daily = ['坤', '临', '明夷', '震', '屯', '颐', '剥'];
  for (const [elapsedDays, name] of daily.entries()) {
    const result = calculateHuangjiSixDayCycle({ elapsedDays, hour: 0 });
    assert.equal(result.hexagrams.jing.shortName, elapsedDays < 6 ? '复' : '颐');
    assert.equal(result.hexagrams.daily.shortName, name);
  }
  for (const [index, name] of ['复', '师', '谦', '豫', '比', '剥'].entries()) {
    assert.equal(calculateHuangjiSixDayCycle({ elapsedDays: 0, hour: index * 4 }).hexagrams.hourly.shortName, name);
  }
});

test('两种六日逐爻模型保留历元、时区、毫秒和冬至边界', async () => {
  const cases = [
    { mode: 'six-day', calendarModel: 'six-day-seven-part', dateTime: '2026-08-24T15:30:00+08:00' },
    { mode: 'six-day', calendarModel: 'six-day-explicit-epoch', dateTime: '2026-08-24T15:30:00+08:00', epochDateTime: '2026-08-20T00:00:00+08:00' },
    { mode: 'six-day', calendarModel: 'six-day-explicit-epoch', dateTime: '2026-03-09T00:00:00', epochDateTime: '2026-03-07T00:00:00', timeZoneId: 'America/New_York' },
    { mode: 'six-day', calendarModel: 'six-day-explicit-epoch', dateTime: '2026-11-01T01:30:00-04:00', epochDateTime: '2026-03-07T00:00:00-05:00', timeZoneId: 'America/New_York' },
    { mode: 'six-day', calendarModel: 'six-day-explicit-epoch', dateTime: '2026-11-01T01:30:00-05:00', epochDateTime: '2026-03-07T00:00:00-05:00', timeZoneId: 'America/New_York' },
    { mode: 'six-day', calendarModel: 'six-day-explicit-epoch', dateTime: '2016-11-06T00:00:00.001-05:00', epochDateTime: '2016-11-06T00:00:00-05:00', timeZoneId: 'America/Havana' },
    { mode: 'six-day', calendarModel: 'six-day-seven-part', dateTime: '1974-12-22T12:00:00', timeZoneId: 'America/Montevideo' },
    { mode: 'six-day', calendarModel: 'six-day-seven-part', dateTime: '1900-01-02T12:00:00', timeZoneId: 'Asia/Shanghai' },
    { mode: 'six-day', calendarModel: 'six-day-seven-part', dateTime: '0001-12-24T00:00:00+08:00' },
    { mode: 'six-day', calendarModel: 'six-day-seven-part', dateTime: '9999-01-07T00:00:00+08:00' },
    { mode: 'six-day', calendarModel: 'six-day-seven-part', dateTime: '2025-12-22T05:03:04+14:00' },
    { mode: 'six-day', calendarModel: 'six-day-seven-part', dateTime: '2025-12-22T05:03:05+14:00' },
    { mode: 'six-day', calendarModel: 'six-day-seven-part', dateTime: '2025-12-21T05:03:04-10:00' },
    { mode: 'six-day', calendarModel: 'six-day-seven-part', dateTime: '2025-12-21T05:03:05-10:00' },
  ] as const;
  for (const settings of cases) {
    const { dateTime, calendarModel } = settings;
    const result = await calculate('huangji-jingshi', { currentTime, question, huangji: settings });
    const cycle = result.data.chart.sixDayCycle!;
    for (const hexagram of Object.values(cycle.hexagrams)) {
      assert.ok(result.prompt.text.includes(hexagram.name), dateTime);
      assert.ok(result.prompt.text.includes(hexagram.judgment), dateTime);
    }
    assert.ok(result.prompt.text.includes(cycle.anchor.dateTime), dateTime);
    assert.ok(result.prompt.text.includes(cycle.hourRange), dateTime);
    assert.ok(cycle.limitations.every((line) => result.prompt.text.includes(line)), dateTime);
    const next = await reprompt({ method: 'huangji-jingshi', result: JSON.parse(JSON.stringify(result)), question: '继续追问' });
    assert.match(next.prompt.text, /继续追问/);
    assert.ok(next.prompt.text.includes(cycle.hexagrams.hourly.name));
  }
});

test('不存在或未消歧的当地时刻、时区冲突及历元越界均被拒绝', async () => {
  const cases = [
    { mode: 'six-day', calendarModel: 'six-day-seven-part', dateTime: '2026-03-08T02:30:00', timeZoneId: 'America/New_York' },
    { mode: 'six-day', calendarModel: 'six-day-seven-part', dateTime: '2026-11-01T01:30:00', timeZoneId: 'America/New_York' },
    { mode: 'six-day', calendarModel: 'six-day-seven-part', dateTime: '2026-07-01T12:00:00-05:00', timeZoneId: 'America/New_York' },
    { mode: 'six-day', calendarModel: 'six-day-explicit-epoch', dateTime: '2026-01-01T00:00:00+08:00', epochDateTime: '2026-01-02T00:00:00+08:00' },
    { mode: 'six-day', calendarModel: 'six-day-explicit-epoch', dateTime: '2027-01-01T00:00:00+08:00', epochDateTime: '2026-01-01T00:00:00+08:00' },
    { mode: 'six-day', calendarModel: 'six-day-seven-part', dateTime: '2026-02-30T12:00:00+08:00' },
  ];
  for (const huangji of cases) await assert.rejects(() => calculate('huangji-jingshi', { currentTime, question, huangji }), undefined, JSON.stringify(huangji));
});

test('Worker 与 MCP 在六日逐爻上返回同一盘面并可追问', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'huangji-jingshi' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const input = { currentTime, question, huangji: { mode: 'six-day', calendarModel: 'six-day-seven-part', dateTime: '2026-07-01T12:00:00', timeZoneId: 'America/New_York' } };
  const response = await send('/api/calculate', { method: 'huangji-jingshi', input });
  assert.equal(response.status, 200);
  const saved = await response.json();
  assert.equal((await send('/api/prompt', { method: 'huangji-jingshi', result: saved, question: '追问' })).status, 200);
  const called = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'huangji-jingshi', arguments: input } });
  assert.equal(called.status, 200);
  assert.deepEqual((await called.json()).result.structuredContent.data.chart, saved.data.chart);
});
