import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import { astrolabeRangeFingerprint, astrolabePeriodOccurrences, renderAstrolabeRange } from '../src/systems/astrolabe-range';
import { houseAt } from '../src/systems/astrology/geometry';
import worker from '../src/worker';
import { collectAstrolabeRange } from '../src/astrolabe-range-client';

const birth = { year: 2024, month: 3, day: 20, hour: 11, minute: 6, second: 20, latitude: 39.9, longitude: 116.4, timezone: 8 };
const input = { question: '出生范围有什么变化？', birth, range: { start: '2024-03-20T11:06:20+08:00', end: '2024-03-20T11:06:32+08:00', pageSize: 20 } };
const clockAt = (timestamp: number) => { const d = new Date(timestamp + 8 * 3_600_000); return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour: d.getUTCHours(), minute: d.getUTCMinutes(), second: d.getUTCSeconds() }; };

test('宫头按左闭右开处理，并消除四轴浮点抖动', async () => {
  const cusps = Array.from({ length: 12 }, (_, i) => (i * 30 + 13.456) % 360);
  assert.equal(houseAt(cusps[6] - 1e-12, cusps), 7); assert.equal(houseAt(cusps[6] - 1e-6, cusps), 6);
  const result = await calculate('astrolabe-range', { ...input, birth: { ...birth, month: 2, day: 19, minute: 24, second: 48 }, range: { start: '2024-02-19T11:24:48+08:00', end: '2024-02-19T11:24:58+08:00' } });
  for (const branch of result.data.branches) for (const chart of [branch.first, branch.last]) assert.deepEqual(chart.angles.map((point) => point.house), [1, 7, 10, 4]);
  assert.equal(result.data.branches.length, 1);
});

test('逐秒记录太阳换座及连续指标，不将首秒当作完整范围', async () => {
  const result = await calculate('astrolabe-range', input), data = result.data;
  assert.equal(data.range.complete, true); assert.equal(data.range.totalSeconds, 12);
  const transitions = new Set(data.branches.map((branch) => branch.first.points.find((point) => point.id === 'sun')!.sign));
  assert.deepEqual([...transitions], ['双鱼', '白羊']);
  const start = Date.parse(input.range.start);
  for (let index = 0; index < 12; index++) {
    const actual = await calculate('astrolabe', { birth: { ...birth, ...clockAt(start + index * 1000) }, question: '问题' });
    const branch = data.branches.find((item) => index >= item.startIndex && index < item.endIndex)!;
    assert.ok(branch); assert.equal(branch.fingerprint, astrolabeRangeFingerprint(actual.data));
    const sun = actual.data.points.find((point) => point.id === 'sun')!.longitude, metric = branch.metrics['points.sun.longitude'];
    const normalized = sun + Math.round((metric.first - sun) / 360) * 360;
    assert.ok(normalized >= metric.min - 1e-9 && normalized <= metric.max + 1e-9);
  }
  assert.match(result.prompt.text, /首秒盘/); assert.match(result.prompt.text, /不能|不代表/);
});

test('星群成员变化切分出生范围并记录格局偏差', async () => {
  const person = { year: 1990, month: 5, day: 15, hour: 12, minute: 55, second: 50, latitude: 39.9, longitude: 116.4, timezone: 8 };
  const result = await calculate('astrolabe-range', { birth: person, question: '问题', range: { start: '1990-05-15T12:55:50+08:00', end: '1990-05-15T12:55:54+08:00' } });
  const first = result.data.branches.find((branch) => branch.startIndex === 0)!;
  const last = result.data.branches.find((branch) => branch.endIndex === 4)!;
  const group = (chart: typeof first.first) => chart.patterns.find((pattern) => pattern.type === 'stellium_house' && pattern.house === 5)!.members.map((member) => member.id);
  assert.deepEqual(group(first.first), ['moon', 'neptune', 'saturn', 'uranus']);
  assert.deepEqual(group(last.last), ['moon', 'neptune', 'saturn']);
  for (const branch of result.data.branches) for (const pattern of branch.first.patterns) {
    if (pattern.maxOrb === null) continue;
    const key = `patterns.${JSON.stringify([pattern.type, pattern.members.map((m) => m.id), pattern.apex?.id ?? null, pattern.sign ?? null, pattern.house ?? null])}.maxOrb`;
    assert.ok(branch.metrics[key]); assert.ok(branch.metrics[key].min <= pattern.maxOrb && pattern.maxOrb <= branch.metrics[key].max);
  }
});

test('分页准确续取，不把末页误称完整区间', async () => {
  let cursor = 0, count = 0;
  do {
    const result = await calculate('astrolabe-range', { ...input, range: { ...input.range, pageSize: 3, cursor } });
    assert.equal(result.data.range.startIndex, cursor); assert.equal(result.data.range.complete, false);
    count += result.data.range.endIndex - cursor;
    if (result.data.range.nextCursor === null) { assert.match(result.prompt.text, /没有下一页/); break; }
    cursor = result.data.range.nextCursor;
  } while (true);
  assert.equal(count, 12);
});

test('完整收集合并相邻分支并保持逐秒指标，拒绝不一致分页', async () => {
  const source = { ...input, range: { ...input.range, pageSize: 3 } }, progress: number[] = [];
  const fetchPage = async (value: any) => (await calculate('astrolabe-range', value)).data;
  const all = await collectAstrolabeRange(source, fetchPage, { onProgress: (done) => progress.push(done) });
  const direct = await calculate('astrolabe-range', input);
  assert.equal(all.data.range.complete, true); assert.deepEqual(progress, [3, 6, 9, 12]);
  assert.deepEqual(all.data.branches, direct.data.branches); assert.match(all.prompt.text, /已覆盖整个区间/);
  await assert.rejects(() => collectAstrolabeRange({ ...source, range: { ...source.range, cursor: 3 } }, fetchPage), /游标 0/);
  const first = await fetchPage({ ...source, range: { ...source.range, cursor: 0 } });
  await assert.rejects(() => collectAstrolabeRange(source, async () => first), /分页输入不一致/);
  await assert.rejects(() => collectAstrolabeRange(source, async (value) => { const page = await fetchPage(value); page.branches[0].startIndex++; return page; }), /分支不连续/);
  await assert.rejects(() => collectAstrolabeRange(source, async (value) => { const page = await fetchPage(value); page.branches[0].first.points[0].longitude += 40; return page; }), /盘面或指标/);
  for (const mutate of [
    (metrics: any, key: string) => { metrics[key].last += 0.001; metrics[key].min = Math.min(metrics[key].min, metrics[key].last); metrics[key].max = Math.max(metrics[key].max, metrics[key].last); },
    (metrics: any, key: string) => { delete metrics[key]; },
    (metrics: any, key: string) => { metrics[key].circularPeriod = 24; },
    (metrics: any, key: string) => { metrics[key].max += 1; },
  ]) {
    const single = { ...source, range: { ...source.range, pageSize: 1 } };
    await assert.rejects(() => collectAstrolabeRange(single, async (value) => { const page = await fetchPage(value); const metrics = page.branches[0].metrics; mutate(metrics, Object.keys(metrics)[0]); return page; }), /盘面或指标/);
  }
  await assert.rejects(() => collectAstrolabeRange(source, async (value) => {
    const page = await fetchPage(value), branch = page.branches.find((item: any) => item.endIndex - item.startIndex > 1);
    if (branch) { const metric = Object.values(branch.metrics)[0] as any; metric.first += 0.001; metric.max = Math.max(metric.max, metric.first); }
    return page;
  }), /盘面或指标/);
  const controller = new AbortController();
  await assert.rejects(() => collectAstrolabeRange(source, fetchPage, { signal: controller.signal, onProgress: () => controller.abort() }), /已取消/);
});

test('夏令时回拨保留真实时间和两个当地偏移', async () => {
  const ny = { ...birth, year: 2024, month: 11, day: 3, hour: 1, minute: 59, second: 58, latitude: 40.7, longitude: -74, timezone: -4, timeZoneId: 'America/New_York' };
  const result = await calculate('astrolabe-range', { question: '问题', birth: ny, range: { start: '2024-11-03T05:59:58Z', end: '2024-11-03T06:00:02Z' } });
  assert.deepEqual(result.data.branches.map((branch) => branch.first.basis.timezone), [-4, -5]);
  assert.deepEqual(result.data.branches.map((branch) => [branch.startIndex, branch.endIndex]), [[0, 2], [2, 4]]);
  assert.equal(result.data.branches[1].first.input.birth.hour, 1); assert.equal(result.data.branches[1].first.input.birth.minute, 0);
});

test('跨日出时按实际昼夜盘切分', async () => {
  let left = Date.parse('1990-05-19T19:00:00Z'), right = Date.parse('1990-05-20T00:00:00Z');
  const dayAt = async (timestamp: number) => (await calculate('astrolabe', { question: '问题', birth: { ...birth, ...clockAt(timestamp) } })).data.basis.dayChart;
  assert.equal(await dayAt(left), false); assert.equal(await dayAt(right), true);
  while (right - left > 1000) { const mid = left + Math.floor((right - left) / 2000) * 1000; if (await dayAt(mid)) right = mid; else left = mid; }
  const start = left - 1000, end = right + 2000, person = { ...birth, ...clockAt(start) };
  const result = await calculate('astrolabe-range', { birth: person, question: '问题', range: { start: new Date(start).toISOString(), end: new Date(end).toISOString() } });
  assert.deepEqual(result.data.branches.map((branch) => branch.first.basis.dayChart), [false, true]);
  assert.equal(result.data.branches[1].startIndex, (right - start) / 1000);
});

test('动态范围对每个出生秒独立计算返照、次限与太阳弧', async () => {
  const request = { ...input, range: { ...input.range, end: '2024-03-20T11:06:22+08:00', pageSize: 2 }, flow: { reference: { kind: 'day', year: 2025, month: 6, day: 1 }, techniques: ['solar-return', 'secondary', 'solar-arc'] } };
  const result = await calculate('astrolabe-range', request);
  assert.equal(result.data.range.totalSeconds, 2);
  for (const branch of result.data.branches) {
    assert.equal(branch.first.flow!.secondary!.status, 'calculated'); assert.equal(branch.last.flow!.solarReturn!.status, 'calculated');
    assert.ok(branch.metrics['flow.secondary.progressedTimestamp']); assert.ok(branch.metrics['flow.solarArc.arcDegrees']); assert.ok(branch.metrics['flow.solarReturn.0.timestamp']);
    assert.ok(branch.metrics['flow.solarReturn.0.timestamp'].min <= branch.metrics['flow.solarReturn.0.timestamp'].max);
  }
  assert.match(result.prompt.text, /太阳返照/);
  await assert.rejects(() => calculate('astrolabe-range', { ...request, range: { ...request.range, pageSize: 3 } }));
  await assert.rejects(() => calculate('astrolabe-range', { ...request, flow: { ...request.flow, period: { start: '2025-01-01T00:00:00Z', end: '2025-01-02T00:00:00Z', pageDays: 1 } } }));
  await assert.rejects(() => calculate('astrolabe-range', { ...request, range: { ...request.range, pageSize: 1 }, flow: { ...request.flow, period: { start: '2025-01-01T00:00:00Z', end: '2025-01-03T00:00:00Z', pageDays: 2 } } }));
});

test('出生秒逐一重算周期事件并汇总每项时间范围，两个游标相互独立', async () => {
  const period = { start: '2025-03-01T00:00:00Z', end: '2025-03-03T00:00:00Z', pageDays: 1, bodies: ['sun', 'moon', 'mercury'], kinds: ['transit_aspect', 'sky_aspect', 'house_ingress', 'moon_phase'] };
  const source = { ...input, range: { ...input.range, end: '2024-03-20T11:06:24+08:00', pageSize: 1 }, flow: { reference: { kind: 'year', year: 2025 }, techniques: ['transit'], period }, prompt: { eventDetail: 'full' } };
  const fetchPage = async (value: any) => (await calculate('astrolabe-range', value)).data;
  const collection = await collectAstrolabeRange(source, fetchPage), data = collection.data;
  assert.equal(data.range.complete, true); assert.match(collection.prompt.text, /周期事件出生范围/); assert.match(collection.prompt.text, /下一周期页游标：/);
  const sampleCharts = [];
  for (let i = 0; i < 4; i++) {
    const timestamp = Date.parse(source.range.start) + i * 1000;
    const single = await calculate('astrolabe', { question: '问题', birth: { ...birth, ...clockAt(timestamp) }, flow: source.flow, prompt: source.prompt });
    sampleCharts.push(single.data);
    const branch = data.branches.find((item) => item.startIndex <= i && item.endIndex > i)!;
    assert.equal(branch.fingerprint, astrolabeRangeFingerprint(single.data));
    for (const { identity, event } of astrolabePeriodOccurrences(single.data.flow!.period!.events)) {
      const metric = branch.metrics[`flow.period.events.${identity}.utcTimestamp`];
      assert.ok(metric); assert.ok(metric.min <= event.utcTimestamp && event.utcTimestamp <= metric.max);
    }
  }
  assert.ok(data.branches.some((branch) => Object.entries(branch.metrics).some(([key, value]) => key.startsWith('flow.period.events.') && key.endsWith('.utcTimestamp') && value.min < value.max)));
  for (const branch of data.branches) for (const { identity } of astrolabePeriodOccurrences(branch.first.flow!.period!.events)) {
    const times = sampleCharts.slice(branch.startIndex, branch.endIndex).flatMap((chart) => astrolabePeriodOccurrences(chart.flow!.period!.events).filter((item) => item.identity === identity).map((item) => item.event.utcTimestamp));
    const metric = branch.metrics[`flow.period.events.${identity}.utcTimestamp`];
    assert.equal(metric.min, Math.min(...times)); assert.equal(metric.max, Math.max(...times));
  }
  const nextPeriod = data.branches[0].first.flow!.period!.page.nextCursor!;
  const later = await fetchPage({ ...source, flow: { ...source.flow, period: { ...period, cursor: nextPeriod } } });
  assert.equal(later.range.nextCursor, 1); assert.equal(later.branches[0].first.flow!.period!.page.nextCursor, null);
  const page = await calculate('astrolabe-range', source);
  assert.match((await reprompt({ method: 'astrolabe-range', result: page, question: '继续问', prompt: { eventDetail: 'full' } })).prompt.text, /周期事件出生范围/);
  const altered = structuredClone(page), eventMetric = Object.keys(altered.data.branches[0].metrics).find((key) => key.startsWith('flow.period.events.') && key.endsWith('.utcTimestamp'))!;
  altered.data.branches[0].metrics[eventMetric].min += 1000;
  await assert.rejects(() => reprompt({ method: 'astrolabe-range', result: altered, question: '继续问' }), /不一致/);
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'astrolabe-range' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const http = await send('/api/calculate', { method: 'astrolabe-range', input: source }); assert.equal(http.status, 200);
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'astrolabe-range', arguments: source } }); assert.equal(mcp.status, 200);
  const json: any = await mcp.json(); assert.equal(json.result.structuredContent.data.branches[0].first.flow.period.page.nextCursor, nextPeriod);
});

test('范围提示词默认限量展示周期事件，可显式展开全部', async () => {
  const source = { ...input, range: { ...input.range, end: '2024-03-20T11:06:21+08:00', pageSize: 1 }, flow: { reference: { kind: 'year', year: 2025 }, techniques: ['transit'], period: { start: '2025-03-14T00:00:00Z', end: '2025-03-15T00:00:00Z', pageDays: 1, kinds: ['moon_phase'] } } };
  const value = await calculate('astrolabe-range', source), data = structuredClone(value.data), branch = data.branches[0], period = branch.first.flow!.period!;
  const template = { ...period.events[0], touches: [] };
  period.events = Array.from({ length: 25 }, (_, i) => ({ ...template, utcTimestamp: template.utcTimestamp + i * 1000 }));
  for (const { identity, event } of astrolabePeriodOccurrences(period.events)) branch.metrics[`flow.period.events.${identity}.utcTimestamp`] = { first: event.utcTimestamp, last: event.utcTimestamp, min: event.utcTimestamp, max: event.utcTimestamp };
  assert.match(renderAstrolabeRange(data, '问题').text, /共 25 项，列出 20 项/);
  assert.match(renderAstrolabeRange(data, '问题', { eventDetail: 'full' }).text, /共 25 项，列出 25 项/);
});

test('月食与满月分别保留，本命触及跨容许度时切分分支', async () => {
  const person = { year: 1990, month: 5, day: 15, hour: 14, minute: 30, latitude: 39.9, longitude: 116.4, timezone: 8 };
  const source = { question: '问题', birth: person, range: { start: '1990-05-15T14:30:00+08:00', end: '1990-05-15T14:30:20+08:00' },
    flow: { reference: { kind: 'year', year: 2025 }, techniques: ['transit'], period: { start: '2025-03-14T00:00:00Z', end: '2025-03-15T00:00:00Z', pageDays: 1, kinds: ['moon_phase', 'eclipse'] } }, prompt: { eventDetail: 'full' } };
  const all = await collectAstrolabeRange(source, async (value) => (await calculate('astrolabe-range', value)).data);
  assert.deepEqual(all.data.branches.map((branch) => [branch.startIndex, branch.endIndex]), [[0, 9], [9, 20]]);
  const first = all.data.branches[0], second = all.data.branches[1];
  const moon = astrolabePeriodOccurrences(first.first.flow!.period!.events).find((item) => item.event.kind === 'moon_phase')!;
  assert.equal(moon.event.touches![0].point, 'mc');
  const deviation = first.metrics[`flow.period.events.${moon.identity}.touch.mc.刑相.deviation`];
  assert.ok(deviation.min < deviation.max); assert.ok(deviation.max <= 3);
  assert.deepEqual(second.first.flow!.period!.events.find((event) => event.kind === 'moon_phase')!.touches, []);
  assert.ok(first.first.flow!.period!.events.some((event) => event.eclipse === 'lunar_total'));
  assert.match(all.prompt.text, /天顶刑相偏差/); assert.match(all.prompt.text, /月相/); assert.match(all.prompt.text, /交食/);
});

test('动态范围不同分页大小收集的分支和连续指标一致', async () => {
  const source = { ...input, range: { ...input.range, end: '2024-03-20T11:06:24+08:00', pageSize: 1 }, flow: { reference: { kind: 'year', year: 2025 }, techniques: ['secondary', 'solar-arc', 'solar-return'] } };
  const fetchPage = async (value: any) => (await calculate('astrolabe-range', value)).data;
  const first = await collectAstrolabeRange(source, fetchPage), second = await collectAstrolabeRange({ ...source, range: { ...source.range, pageSize: 2 } }, fetchPage);
  assert.deepEqual(first.data.branches, second.data.branches); assert.equal(first.data.range.complete, true);
});

test('范围边界、保存追问、篡改拒绝和 HTTP/MCP 调用', async () => {
  await assert.rejects(() => calculate('astrolabe-range', { ...input, range: { ...input.range, end: input.range.start } }));
  await assert.rejects(() => calculate('astrolabe-range', { ...input, range: { ...input.range, end: '2024-03-20T13:06:21+08:00' } }));
  await assert.rejects(() => calculate('astrolabe-range', { ...input, birth: { ...birth, second: 19 } }));
  await assert.rejects(() => calculate('astrolabe-range', { ...input, range: { ...input.range, cursor: 12 } }));
  const result = await calculate('astrolabe-range', input), saved = JSON.parse(JSON.stringify(result));
  const next = await reprompt({ method: 'astrolabe-range', result: saved, question: '继续问' }); assert.match(next.prompt.text, /继续问/);
  saved.data.branches[0].metrics['points.sun.longitude'].min += 1; await assert.rejects(() => reprompt({ method: 'astrolabe-range', result: saved, question: '追问' }), /不一致/);
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'astrolabe-range' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const http = await send('/api/calculate', { method: 'astrolabe-range', input }); assert.equal(http.status, 200);
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'astrolabe-range', arguments: input } }); assert.equal(mcp.status, 200);
  const json: any = await mcp.json(); assert.equal(json.result.structuredContent.data.range.totalSeconds, 12);
});
