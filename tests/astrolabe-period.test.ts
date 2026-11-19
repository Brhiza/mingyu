import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import worker from '../src/worker';
import { scanAstrolabePeriod } from '../src/systems/astrolabe-period';

const birth = { year: 1990, month: 5, day: 15, hour: 14, minute: 30, latitude: 39.9, longitude: 116.4, timezone: 8 };
const input = { birth, question: '周期如何？', flow: { reference: { kind: 'month', year: 2025, month: 3 }, techniques: ['transit'], period: { start: '2025-02-28T16:00:00Z', end: '2025-03-31T16:00:00Z', bodies: ['jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'true_node', 'mars', 'venus', 'mercury', 'sun'] } } };
async function pages(source: any, pageDays: number) {
  let cursor: string | undefined, events: any[] = [], last = Date.parse(source.flow.period.start), pageCount = 0;
  do {
    const result = await calculate('astrolabe', { ...source, flow: { ...source.flow, period: { ...source.flow.period, pageDays, ...(cursor ? { cursor } : {}) } } });
    const period = result.data.flow!.period!;
    assert.equal(Date.parse(period.page.start), last); assert.ok(Date.parse(period.page.end) > last); assert.ok(Date.parse(period.page.end) - last <= pageDays * 86_400_000);
    assert.ok(period.events.every((event) => event.utcTimestamp >= last && event.utcTimestamp < Date.parse(period.page.end)));
    events.push(...period.events); last = Date.parse(period.page.end); cursor = period.page.nextCursor ?? undefined; pageCount++;
  } while (cursor);
  assert.equal(last, Date.parse(source.flow.period.end));
  return { events, pageCount };
}
const eventKey = (x: any) => [x.kind, x.moving, x.target, x.aspect, x.direction, x.sign, x.house, x.phase, x.eclipse].join(':');

test('单盘周期提示词可选择摘要或完整事件', async () => {
  const result = await calculate('astrolabe', { ...input, flow: { ...input.flow, period: { ...input.flow.period, bodies: undefined } }, prompt: { eventDetail: 'summary' } });
  const count = result.data.flow!.period!.events.length;
  assert.ok(count > 20); assert.match(result.prompt.text, new RegExp(`共 ${count} 项，列出 20 项`));
  const full = await reprompt({ method: 'astrolabe', result, question: '继续问', prompt: { eventDetail: 'full' } });
  assert.match(full.prompt.text, new RegExp(`共 ${count} 项，列出 ${count} 项`));
});

test('周期分页完整覆盖且不同分页大小不重复、不漏事件', async () => {
  const source = { ...input, flow: { ...input.flow, period: { start: '2025-03-01T00:00:00Z', end: '2025-03-15T00:00:00Z' } } };
  const one = await pages(source, 1), seven = await pages(source, 7);
  assert.equal(one.pageCount, 14); assert.equal(seven.pageCount, 2); assert.equal(one.events.length, seven.events.length);
  for (const event of one.events) assert.equal(seven.events.filter((other) => eventKey(event) === eventKey(other) && Math.abs(event.utcTimestamp - other.utcTimestamp) < 1000).length, 1, eventKey(event));
  assert.ok(one.events.some((event) => event.kind === 'station')); assert.ok(one.events.some((event) => event.kind === 'moon_phase'));
});

test('事件恰落分页边界时只归入后一页', async () => {
  const sample = await calculate('astrolabe', { ...input, flow: { ...input.flow, period: { start: '2025-03-01T00:00:00Z', end: '2025-03-08T00:00:00Z' } } });
  const target = sample.data.flow!.period!.events.find((event) => event.kind === 'transit_aspect')!;
  const start = new Date(target.utcTimestamp - 7 * 86_400_000).toISOString(), end = new Date(target.utcTimestamp + 7 * 86_400_000).toISOString();
  const source = { ...input, flow: { ...input.flow, period: { start, end, pageDays: 7 } } };
  const first = await calculate('astrolabe', source), page1 = first.data.flow!.period!;
  const second = await calculate('astrolabe', { ...source, flow: { ...source.flow, period: { ...source.flow.period, cursor: page1.page.nextCursor! } } });
  const page2 = second.data.flow!.period!;
  assert.equal(page1.events.filter((event) => eventKey(event) === eventKey(target) && Math.abs(event.utcTimestamp - target.utcTimestamp) <= 1000).length, 0);
  assert.equal(page2.events.filter((event) => eventKey(event) === eventKey(target) && event.utcTimestamp === target.utcTimestamp).length, 1);
});

test('停逆前后越过同一位置两次时保留两次相位与落宫', () => {
  const cusp = 177.5121;
  const natal = { basis: { julianDay: 2_440_587.5, utcDateTime: '1970-01-01T00:00:00.000Z', houseSystem: 'placidus' as const },
    points: [{ id: 'sun', name: '太阳', longitude: cusp }, { id: 'moon', name: '月亮', longitude: 20 }],
    derived: [], angles: [{ id: 'asc', name: '上升', longitude: 40 }],
    houses: Array.from({ length: 12 }, (_, index) => ({ house: index + 1, longitude: (cusp + index * 30) % 360 })) };
  const result = scanAstrolabePeriod({ start: '2028-01-12T00:00:00Z', end: '2028-01-13T00:00:00Z', bodies: ['jupiter'], kinds: ['transit_aspect', 'house_ingress', 'station'] }, { ...birth, timezone: 0 }, natal);
  const conjunctions = result.events.filter((event) => event.kind === 'transit_aspect' && event.target === 'sun' && event.aspect === 'conjunction');
  const houses = result.events.filter((event) => event.kind === 'house_ingress');
  const stations = result.events.filter((event) => event.kind === 'station');
  assert.equal(conjunctions.length, 2); assert.deepEqual(houses.map((event) => event.house), [1, 12]); assert.equal(stations.length, 1);
  assert.ok(Math.abs(stations[0].utcTimestamp - Date.parse('2028-01-12T08:53:41Z')) < 2 * 60_000);
  assert.ok(conjunctions[0].utcTimestamp < stations[0].utcTimestamp && stations[0].utcTimestamp < conjunctions[1].utcTimestamp);
});

test('夏令时、事件筛选、游标和非法范围处理', async () => {
  const ny = { ...birth, timezone: undefined, timeZoneId: 'America/New_York', latitude: 40.7, longitude: -74 };
  const period = { start: '2025-03-09T00:00:00Z', end: '2025-03-10T00:00:00Z', bodies: ['moon'], kinds: ['transit_aspect', 'house_ingress', 'sign_ingress'] };
  const result = await calculate('astrolabe', { birth: ny, question: '问题', flow: { reference: { kind: 'year', year: 2025 }, techniques: ['transit'], period } });
  const events = result.data.flow!.period!.events;
  assert.ok(events.some((event) => event.timezone === -5)); assert.ok(events.some((event) => event.timezone === -4));
  assert.ok(events.every((event) => event.moving === 'moon' && period.kinds.includes(event.kind)));
  assert.match(result.prompt.text, /周期事件/); assert.match(result.prompt.text, /本次范围已扫描完毕/);
  const bad = (value: any) => calculate('astrolabe', { ...input, flow: { ...input.flow, period: value } });
  await assert.rejects(() => bad({ ...period, end: period.start }));
  await assert.rejects(() => bad({ ...period, start: '2023-01-01T00:00:00Z' }));
  await assert.rejects(() => bad({ ...period, pageDays: 8 }));
  await assert.rejects(() => bad({ ...input.flow.period, cursor: '2025-03-02T16:00:00Z' }));
  await assert.rejects(() => bad({ ...period, kinds: ['station', 'station'] }));
});

test('周期结果保存追问、篡改拒绝及 HTTP/MCP', async () => {
  const source = { ...input, flow: { ...input.flow, period: { ...input.flow.period, end: '2025-03-05T16:00:00Z' } } };
  const result = await calculate('astrolabe', source), saved = JSON.parse(JSON.stringify(result));
  const next = await reprompt({ method: 'astrolabe', result: saved, question: '继续问' });
  assert.match(next.prompt.text, /继续问/); assert.match(next.prompt.text, /周期事件/);
  saved.data.flow.period.events[0].utcTimestamp += 5000;
  await assert.rejects(() => reprompt({ method: 'astrolabe', result: saved, question: '追问' }), /不一致/);
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'astrolabe' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const http = await send('/api/calculate', { method: 'astrolabe', input: source }); assert.equal(http.status, 200);
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'astrolabe', arguments: source } }); assert.equal(mcp.status, 200);
  const json: any = await mcp.json(); assert.ok(json.result.structuredContent.data.flow.period.events.length > 0);
});
