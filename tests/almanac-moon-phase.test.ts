import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import worker from '../src/worker';

const input = { question: '搬家如何安排？', topic: 'move', startDate: '2024-04-08', endDate: '2024-04-09', includeMoonPhase: true } as const;

test('可选正午月相跨朔日保留真实时刻，不改变择日初筛', async () => {
  const withPhase = await calculate('almanac', input);
  const withoutPhase = await calculate('almanac', { ...input, includeMoonPhase: false });
  assert.equal(withPhase.data.days.length, 2);
  for (const [index, day] of withPhase.data.days.entries()) {
    assert.equal(day.moonPhase!.utcDateTime, `${day.date}T04:00:00.000Z`);
    assert.ok(day.moonPhase!.illuminationFraction >= 0 && day.moonPhase!.illuminationFraction <= 1);
    assert.deepEqual(day.screening, withoutPhase.data.days[index].screening);
    assert.deepEqual(day.hours, withoutPhase.data.days[index].hours);
    assert.ok(!('moonPhase' in withoutPhase.data.days[index]));
  }
  const [before, after] = withPhase.data.days.map((day) => day.moonPhase!);
  assert.equal(before.waxing, false); assert.equal(after.waxing, true);
  assert.equal(before.next.name, '朔'); assert.deepEqual(before.next, after.previous);
  // USNO 以分钟列出 2024-04-08 18:21 UTC 朔；这里容许一分钟，避免把参考表精度当成秒级精度。
  assert.ok(Math.abs(Date.parse(before.next.utcDateTime) - Date.parse('2024-04-08T18:21:00Z')) <= 60_000);
  assert.match(withPhase.prompt.text, /北京时间正午月相背景/);
  assert.match(withPhase.prompt.text, /不参与初筛/);
  assert.doesNotMatch(withoutPhase.prompt.text, /北京时间正午月相背景/);
});

test('朔弦望四正时刻与美国海军天文台分钟表对照', async () => {
  // https://aa.usno.navy.mil/calculated/moon/phases?date=2024-04-06&nump=4
  for (const [date, name, event] of [
    ['2024-04-08', '朔', '2024-04-08T18:21:00Z'],
    ['2024-04-15', '上弦', '2024-04-15T19:13:00Z'],
    ['2024-04-23', '望', '2024-04-23T23:49:00Z'],
    ['2024-05-01', '下弦', '2024-05-01T11:27:00Z'],
  ] as const) {
    const result = await calculate('almanac', { ...input, startDate: date, endDate: date });
    const actual = result.data.days[0].moonPhase!.next;
    assert.equal(actual.name, name);
    assert.ok(Math.abs(Date.parse(actual.utcDateTime) - Date.parse(event)) <= 60_000, `${name}/${actual.utcDateTime}`);
  }
});

test('日期筛选与追问沿用月相，伪造月相被拒绝', async () => {
  const result = await calculate('almanac', { ...input, prompt: { dates: ['2024-04-08'] } });
  assert.equal(result.data.days.length, 2);
  assert.equal((result.prompt.text.match(/北京时间正午月相背景/g) ?? []).length, 1);
  const next = await reprompt({ method: 'almanac', result, question: '只看九号', prompt: { dates: ['2024-04-09'] } });
  assert.match(next.prompt.text, /2024-04-09 星期二/);
  assert.doesNotMatch(next.prompt.text, /2024-04-08 星期一/);
  assert.match(next.prompt.text, /北京时间正午月相背景/);
  const altered = structuredClone(result); altered.data.days[0].moonPhase!.illuminationFraction = 0.9;
  await assert.rejects(() => reprompt({ method: 'almanac', result: altered, question: '追问' }), /不一致/);
});

test('180 天按需计算都有各日正午月相和前后事件', async () => {
  const result = await calculate('almanac', { ...input, startDate: '2024-01-01', endDate: '2024-06-28', prompt: { dates: ['2024-01-01'] } });
  assert.equal(result.data.days.length, 180);
  for (const day of result.data.days) {
    const phase = day.moonPhase!;
    assert.equal(phase.utcDateTime, `${day.date}T04:00:00.000Z`);
    assert.ok(Date.parse(phase.previous.utcDateTime) < Date.parse(phase.utcDateTime));
    assert.ok(Date.parse(phase.next.utcDateTime) > Date.parse(phase.utcDateTime));
  }
  assert.equal((result.prompt.text.match(/北京时间正午月相背景/g) ?? []).length, 1);
});

test('HTTP 与 MCP 返回相同月相，追问沿用原始选项', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'almanac' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const http = await send('/api/calculate', { method: 'almanac', input }); assert.equal(http.status, 200);
  const saved: any = await http.json();
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'almanac', arguments: input } }); assert.equal(mcp.status, 200);
  const body: any = await mcp.json();
  assert.deepEqual(body.result.structuredContent.data.days.map((day: any) => day.moonPhase), saved.data.days.map((day: any) => day.moonPhase));
  const follow = await send('/api/prompt', { method: 'almanac', result: saved, question: '继续问' });
  assert.equal(follow.status, 200); assert.match((await follow.json() as any).prompt.text, /北京时间正午月相背景/);
});
