import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import worker from '../src/worker';

const warning = /香港天文台预测中相差一天/;
const currentTime = '2057-09-27T00:00:00Z';
const question = '比较情况';

test('黄历按实际结果页标记受影响的日期，筛选和追问保留限制', async () => {
  const base = { question, currentTime, topic: 'travel', startDate: '2057-09-27', endDate: '2057-09-29' };
  const outside = await calculate('almanac', { ...base, page: { offset: 0, limit: 1 } });
  assert.doesNotMatch(outside.prompt.text, warning); assert.equal(outside.data.days[0].lunarDateWarning, undefined);
  const page = await calculate('almanac', { ...base, page: { offset: 1, limit: 2 } });
  assert.equal(page.data.days.length, 2);
  for (const day of page.data.days) assert.match(day.lunarDateWarning!, warning);
  assert.match(page.prompt.text, warning); assert.ok(page.summary.lines.some((line) => warning.test(line)));
  const saved = JSON.parse(JSON.stringify(page));
  const follow = await reprompt({ method: 'almanac', result: saved, question: '仅看后一天', prompt: { dates: ['2057-09-29'] } });
  assert.match(follow.prompt.text, warning); assert.match(follow.prompt.text, /2057-09-29 星期/);
  saved.data.days[0].lunarDateWarning = '伪造';
  await assert.rejects(() => reprompt({ method: 'almanac', result: saved, question }), /不一致/);
});

test('六爻范围跨当地午夜时，按每个分支的当地日期标记历法背景', async () => {
  for (const [timezoneOffsetMinutes, start, end] of [
    [480, '2057-09-27T15:30:00Z', '2057-09-27T16:30:00Z'],
    [-300, '2057-09-28T04:30:00Z', '2057-09-28T05:30:00Z'],
  ] as const) {
    const result = await calculate('liuyao', { question, currentTime, range: { start, end }, liuyao: { method: 'manual', yaos: [6, 7, 8, 9, 7, 8], timezoneOffsetMinutes } });
    const branches = result.data.branches;
    assert.ok(branches.length >= 2);
    assert.equal(branches[0].background.solar.day, 27); assert.equal(branches[0].background.lunarDateWarning, undefined);
    assert.equal(branches.at(-1)!.background.solar.day, 28); assert.match(branches.at(-1)!.background.lunarDateWarning!, warning);
    assert.match(result.prompt.text, warning); assert.ok(result.summary.lines.some((line) => warning.test(line)));
    const follow = await reprompt({ method: 'liuyao', result: JSON.parse(JSON.stringify(result)), question: '继续问' });
    assert.match(follow.prompt.text, warning);
  }
});

test('奇门单局和范围保留所用钟表日期的月相历表差异', async () => {
  const before = await calculate('qimen', { question, currentTime, divinationTime: '2057-09-27T04:00:00Z', qimen: { scope: 'hour' } });
  assert.doesNotMatch(before.prompt.text, warning);
  const after = await calculate('qimen', { question, currentTime, divinationTime: '2057-09-28T04:00:00Z', qimen: { scope: 'hour' } });
  assert.match(after.data.seasonality!.lunarDateWarning!, warning); assert.match(after.prompt.text, warning);
  for (const scope of ['hour', 'month', 'year'] as const) {
    const result = await calculate('qimen', { question, currentTime, range: { start: '2057-09-27T15:30:00Z', end: '2057-09-27T16:30:00Z' }, qimen: { scope } });
    assert.ok(result.data.branches.length >= 2, scope);
    assert.equal(result.data.branches[0].data.seasonality!.lunarDateWarning, undefined);
    assert.match(result.data.branches.at(-1)!.data.seasonality!.lunarDateWarning!, warning);
    assert.match(result.prompt.text, warning);
    const follow = await reprompt({ method: 'qimen', result: JSON.parse(JSON.stringify(result)), question: '继续问' });
    assert.match(follow.prompt.text, warning);
  }
  for (const [start, end, setting] of [
    ['2057-09-28T04:30:00Z', '2057-09-28T05:30:00Z', { scope: 'hour', timeStandard: 'civil', timezone: -5 }],
    ['2057-09-27T15:30:00Z', '2057-09-27T16:30:00Z', { scope: 'hour', timeStandard: 'true-solar', longitude: 120 }],
  ] as const) {
    const result = await calculate('qimen', { question, currentTime, range: { start, end }, qimen: setting });
    assert.ok(result.data.branches.length >= 2);
    assert.equal(result.data.branches[0].data.seasonality!.lunarDateWarning, undefined);
    assert.match(result.data.branches.at(-1)!.data.seasonality!.lunarDateWarning!, warning);
    assert.match(result.prompt.text, warning);
    assert.match((await reprompt({ method: 'qimen', result: JSON.parse(JSON.stringify(result)), question })).prompt.text, warning);
  }
});

test('奇门终身局按本命盘所用钟表日期提示，追问及出生范围候选复用同一提示', async () => {
  const birth = { year: 2057, month: 9, day: 27, hour: 23, minute: 59, second: 59, timezone: 8 };
  const range = { start: '2057-09-27T15:59:59Z', end: '2057-09-27T16:00:01Z' };
  const first = await calculate('qimen-lifetime', { question, currentTime, birth, birthRange: range });
  const next = await calculate('qimen-lifetime', { question, currentTime, birth, birthRange: { ...range, index: 1 } });
  assert.equal(first.data.baseChart.seasonality!.lunarDateWarning, undefined);
  assert.doesNotMatch(first.prompt.text, warning);
  assert.match(next.data.baseChart.seasonality!.lunarDateWarning!, warning);
  assert.match(next.prompt.text, warning);
  assert.ok(next.summary.lines.some((line) => warning.test(line)));
  const follow = await reprompt({ method: 'qimen-lifetime', result: JSON.parse(JSON.stringify(next)), question: '继续问', prompt: { scope: 'natal' } });
  assert.match(follow.prompt.text, warning);
  for (const [input, expected] of [
    [{ ...birth, day: 28, hour: 0, minute: 0, second: 0, timezone: -5 }, true],
    [{ ...birth, minute: 50, second: 0, timeStandard: 'true-solar', longitude: 120 }, false],
    [{ ...birth, minute: 59, second: 0, timeStandard: 'true-solar', longitude: 120 }, true],
    [{ ...birth, month: 10, day: 28, hour: 0, minute: 0, second: 0 }, false],
  ] as const) {
    const result = await calculate('qimen-lifetime', { question, currentTime, birth: input });
    assert.equal(warning.test(result.prompt.text), expected);
    assert.equal(result.summary.lines.some((line) => warning.test(line)), expected);
  }
});

test('黄历、六爻与奇门的 HTTP 和 MCP 返回相同的分歧提示', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'almanac,liuyao,qimen,qimen-lifetime' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const cases = [
    ['almanac', { question, currentTime, topic: 'travel', startDate: '2057-09-28', endDate: '2057-09-28' }],
    ['liuyao', { question, currentTime, range: { start: '2057-09-27T15:30:00Z', end: '2057-09-27T16:30:00Z' }, liuyao: { method: 'manual', yaos: [6, 7, 8, 9, 7, 8] } }],
    ['qimen', { question, currentTime, range: { start: '2057-09-27T15:30:00Z', end: '2057-09-27T16:30:00Z' }, qimen: { scope: 'month' } }],
    ['qimen-lifetime', { question, currentTime, birth: { year: 2057, month: 9, day: 28, hour: 12, minute: 0, second: 0, timezone: 8 } }],
  ] as const;
  for (const [method, input] of cases) {
    const http = await send('/api/calculate', { method, input }); assert.equal(http.status, 200); const saved: any = await http.json();
    const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: method, arguments: input } });
    const body: any = await mcp.json();
    assert.deepEqual(body.result.structuredContent.data, saved.data);
    assert.match(body.result.structuredContent.prompt.text, warning);
    const follow = await send('/api/prompt', { method, result: saved, question: '继续问' });
    assert.equal(follow.status, 200); assert.match((await follow.json() as any).prompt.text, warning);
  }
});
