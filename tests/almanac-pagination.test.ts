import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import worker from '../src/worker';

const input = { currentTime: '2025-01-01T00:00:00Z', topic: 'move', question: '如何安排', startDate: '2024-01-01', endDate: '2024-06-28' } as const;

test('180 天分七天逐页读取，与完整结果逐日一致', async () => {
  const whole = await calculate('almanac', input);
  const collected: typeof whole.data.days = [];
  let offset: number | null = 0;
  while (offset !== null) {
    const result = await calculate('almanac', { ...input, page: { offset, limit: 7 } });
    const page = result.data.page!;
    assert.equal(page.offset, offset); assert.equal(page.limit, 7); assert.equal(page.total, 180);
    assert.equal(result.data.days[0].date, whole.data.days[offset].date);
    assert.match(result.prompt.text, /只比较本页所列日期/);
    if (page.nextOffset !== null) assert.ok(result.prompt.text.includes(`page.offset=${page.nextOffset}`));
    collected.push(...result.data.days); offset = page.nextOffset;
  }
  assert.deepEqual(collected, whole.data.days);
  assert.equal(new Set(collected.map((day) => day.date)).size, 180);
  assert.equal('page' in whole.data, false);
});

test('分页复用相同参与人、月相、跨年及交节资料', async () => {
  const request = { ...input, startDate: '2024-12-30', endDate: '2025-01-07', includeMoonPhase: true,
    participants: [{ name: '甲', birth: { year: 1990, month: 5, day: 15, clock: { kind: 'exact', hour: 14, minute: 30, second: 0 }, timezone: 8 } }] };
  const whole = await calculate('almanac', request);
  const a = await calculate('almanac', { ...request, page: { limit: 5 } });
  const b = await calculate('almanac', { ...request, page: { offset: a.data.page!.nextOffset!, limit: 5 } });
  assert.deepEqual([...a.data.days, ...b.data.days], whole.data.days);
  assert.deepEqual(a.data.participants, whole.data.participants); assert.deepEqual(b.data.participants, whole.data.participants);
  assert.equal(b.data.page!.nextOffset, null); assert.equal(b.data.days.length, 4);
  assert.ok(b.data.days.some((day) => day.jieBoundary?.name === '小寒'));
  assert.ok(b.data.days.every((day) => day.moonPhase));
});

test('默认页长、边界、日期选择与原页追问', async () => {
  const base = { ...input, startDate: '2024-01-01', endDate: '2024-01-10' };
  const first = await calculate('almanac', { ...base, page: {} });
  assert.deepEqual(first.data.page, { offset: 0, limit: 7, total: 10, nextOffset: 7 });
  const last = await calculate('almanac', { ...base, page: { offset: 7 } });
  assert.deepEqual(last.data.page, { offset: 7, limit: 7, total: 10, nextOffset: null });
  assert.equal(last.data.days.length, 3); assert.match(last.prompt.text, /已到最后一页/);
  const follow = await reprompt({ method: 'almanac', result: first, question: '只看第二天', prompt: { dates: ['2024-01-02'] } });
  assert.match(follow.prompt.text, /2024-01-02 星期/); assert.doesNotMatch(follow.prompt.text, /2024-01-01 星期/);
  await assert.rejects(() => reprompt({ method: 'almanac', result: first, question: '跨页', prompt: { dates: ['2024-01-08'] } }), /当前结果页/);
  for (const page of [{ offset: 10 }, { offset: 0, limit: 0 }, { offset: -1 }, { offset: 1.5 }, { offset: 180 }, { limit: 181 }]) {
    await assert.rejects(() => calculate('almanac', { ...base, page }));
  }
  const altered = structuredClone(first); altered.data.page!.nextOffset = 8;
  await assert.rejects(() => reprompt({ method: 'almanac', result: altered, question: '继续' }), /不一致/);
});

test('HTTP 和 MCP 分页结果一致，文本结果完整可用于追问', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'almanac' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const args = { ...input, page: { offset: 7, limit: 7 }, includeMoonPhase: true };
  const http = await send('/api/calculate', { method: 'almanac', input: args }); assert.equal(http.status, 200);
  const saved: any = await http.json();
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'almanac', arguments: args } }); assert.equal(mcp.status, 200);
  const body: any = await mcp.json();
  assert.deepEqual(body.result.structuredContent, saved);
  assert.deepEqual(JSON.parse(body.result.content[0].text), saved);
  const follow = await send('/api/prompt', { method: 'almanac', result: JSON.parse(body.result.content[0].text), question: '追问' });
  assert.equal(follow.status, 200); assert.match((await follow.json() as any).prompt.text, /只比较本页/);
});
