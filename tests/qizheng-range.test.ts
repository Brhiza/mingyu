import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import worker from '../src/worker';

const birth = { year: 2024, month: 2, day: 19, hour: 11, minute: 24, second: 48, latitude: 39.9, longitude: 116.4, timezone: 8 };
const range = { start: '2024-02-19T11:24:48+08:00', end: '2024-02-19T11:24:54+08:00' };
const input = { question: '有哪些候选？', birth, range };

test('逐秒分支覆盖月宫、太阳宫位、日出与日落边界', async () => {
  for (const [hour, minute, second, field] of [[11,24,48,'moon'], [12,12,57,'sun'], [7,3,8,'rise'], [17,53,57,'set']] as const) {
    const local = `2024-02-19T${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:${String(second).padStart(2,'0')}+08:00`;
    const result = await calculate('qizheng-range', { question: '问题', birth: { ...birth, hour, minute, second }, range: { start: local, end: new Date(Date.parse(local) + 2000).toISOString() } });
    assert.equal(result.data.range.complete, true); assert.equal(result.data.branches.length, 2, field);
    assert.deepEqual(result.data.branches.map((item: any) => [item.startIndex, item.endIndex]), [[0, 1], [1, 2]]);
    const [a, b] = result.data.branches.map((item: any) => item.first);
    if (field === 'moon') assert.notEqual(a.shenGong, b.shenGong);
    if (field === 'sun') assert.notEqual(a.mingGong, b.mingGong);
    if (field === 'rise') assert.deepEqual([a.enNan.sect, b.enNan.sect], ['夜生', '昼生']);
    if (field === 'set') assert.deepEqual([a.enNan.sect, b.enNan.sect], ['昼生', '夜生']);
  }
});

test('分页无遗漏，与逐秒单盘一致，可识别跨页相邻分支及连续指标范围', async () => {
  const pages = [];
  let cursor: number | null = 0;
  while (cursor !== null) {
    const result = await calculate('qizheng-range', { ...input, range: { ...range, cursor, pageSize: 2 } });
    pages.push(result.data); cursor = result.data.range.nextCursor;
  }
  assert.deepEqual(pages.map((page) => [page.range.startIndex, page.range.endIndex, page.range.nextCursor]), [[0,2,2],[2,4,4],[4,6,null]]);
  assert.ok(pages.every((page) => page.range.complete === false));
  const branches = pages.flatMap((page) => page.branches);
  assert.equal(branches[1].fingerprint, branches[2].fingerprint);
  for (const branch of branches) {
    const values = [];
    for (let i = branch.startIndex; i < branch.endIndex; i++) {
      const sample = await calculate('qizheng', { question: '问题', birth: { ...birth, second: birth.second + i } });
      values.push(sample.data.stars[0].longitude);
      if (i === branch.startIndex) assert.equal(branch.first.basis.utcTimestamp, sample.data.basis.utcTimestamp);
      if (i === branch.endIndex - 1) assert.equal(branch.last.basis.utcTimestamp, sample.data.basis.utcTimestamp);
    }
    const metric = branch.metrics['stars.太阳.longitude'];
    assert.ok(Math.abs(metric.min - Math.min(...values)) < 1e-9); assert.ok(Math.abs(metric.max - Math.max(...values)) < 1e-9);
  }
  const full = await calculate('qizheng-range', input);
  assert.equal(full.data.range.complete, true); assert.equal(full.data.branches.length, 2);
  assert.match(full.prompt.text, /连续指标范围见结构化结果/);
});

test('夏令时回拨按真实瞬时取偏移，真太阳时及非法输入明确处理', async () => {
  const dst = await calculate('qizheng-range', { question: '问题', birth: { year: 2024, month: 11, day: 3, hour: 1, minute: 59, second: 59, latitude: 40.7, longitude: -74, timeZoneId: 'America/New_York', timezone: -4 }, range: { start: '2024-11-03T01:59:59-04:00', end: '2024-11-03T01:00:01-05:00' } });
  assert.deepEqual(dst.data.branches.map((branch: any) => branch.first.basis.timezone), [-4, -5]);
  assert.deepEqual(dst.data.branches.map((branch: any) => branch.first.basis.localDateTime), ['2024-11-03T01:59:59', '2024-11-03T01:00:00']);
  const solar = await calculate('qizheng-range', { ...input, birth: { ...birth, timeStandard: 'true-solar' } });
  assert.equal(solar.data.branches[0].first.basis.palaceTimeStandard, 'true-solar');
  for (const invalid of [
    { ...input, range: { ...range, start: '2024-02-19T11:24:49+08:00' } },
    { ...input, range: { ...range, end: range.start } },
    { ...input, range: { ...range, end: '2024-02-19T13:24:49+08:00' } },
    { ...input, range: { ...range, start: '2024-02-19T11:24:48.100+08:00' } },
    { ...input, range: { ...range, cursor: 6 } },
    { ...input, range: { ...range, pageSize: 31 } },
    { ...input, birth: { ...birth, year: 2200, month: 12, day: 31, hour: 23, minute: 59, second: 59 }, range: { start: '2200-12-31T23:59:59+08:00', end: '2201-01-01T00:00:01+08:00' } },
    { ...input, gender: 'male' },
    { ...input, periodEvents: true },
    { ...input, flow: { kind: 'year', year: 2026 }, periodEvents: true, range: { ...range, pageSize: 5 } },
  ]) await assert.rejects(() => calculate('qizheng-range', invalid));
});

test('保存追问及 HTTP、MCP 共用同一范围结果并拒绝篡改', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'qizheng-range' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const limited = { ...input, range: { ...range, pageSize: 2 } };
  const response = await send('/api/calculate', { method: 'qizheng-range', input: limited }); assert.equal(response.status, 200);
  const saved = await response.json();
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'qizheng-range', arguments: limited } });
  assert.deepEqual((await mcp.json()).result.structuredContent.data, saved.data);
  const followup = await reprompt({ method: 'qizheng-range', result: saved, question: '追问' });
  assert.match(followup.prompt.text, /追问/); assert.match(followup.prompt.text, /本页不能代表完整区间/);
  assert.equal((await send('/api/prompt', { method: 'qizheng-range', result: saved, question: '追问' })).status, 200);
  saved.data.branches[0].metrics['stars.太阳.longitude'].max += 1;
  assert.equal((await send('/api/prompt', { method: 'qizheng-range', result: saved, question: '追问' })).status, 400);
});

test('客户端逐页收集并合并为完整区间，连续指标与直接计算一致', async () => {
  const { collectQizhengRange } = await import('../src/qizheng-range-client');
  const progress: number[] = [];
  const source = { ...input, range: { ...range, pageSize: 2 } };
  const collected = await collectQizhengRange(source, async (value) => (await calculate('qizheng-range', value)).data, { onProgress: (done) => progress.push(done) });
  const direct = await calculate('qizheng-range', { ...input, range: { ...range, pageSize: 6 } });
  assert.deepEqual(progress, [2, 4, 6]);
  assert.equal(collected.data.range.complete, true); assert.equal(collected.data.range.nextCursor, null);
  assert.deepEqual(collected.data.branches, direct.data.branches);
  assert.match(collected.prompt.text, /已覆盖整个区间/);
  assert.doesNotMatch(collected.prompt.text, /本页不能代表完整区间/);
});

test('客户端拒绝缺页、重复页、不同出生资料、错误分支或中途取消', async () => {
  const { collectQizhengRange } = await import('../src/qizheng-range-client');
  const source = { ...input, range: { ...range, pageSize: 2 } };
  const getPage = async (value: any) => (await calculate('qizheng-range', value)).data;
  const first = await getPage({ ...source, range: { ...source.range, cursor: 0 } });
  await assert.rejects(() => collectQizhengRange({ ...source, range: { ...source.range, cursor: 2 } }, getPage), /游标 0/);
  await assert.rejects(() => collectQizhengRange(source, async () => first), /分页输入不一致/);
  await assert.rejects(() => collectQizhengRange(source, async (value) => { const page = await getPage(value); page.input.birth.latitude++; return page; }), /输入不一致/);
  await assert.rejects(() => collectQizhengRange(source, async (value) => { const page = await getPage(value); page.branches[0].startIndex++; return page; }), /分支不连续/);
  await assert.rejects(() => collectQizhengRange(source, async (value) => { const page = await getPage(value); page.branches[0].first.mingGong++; return page; }), /盘面或指标/);
  for (const mutate of [
    (metrics: any, key: string) => { metrics[key].first += 0.001; metrics[key].min = Math.min(metrics[key].min, metrics[key].first); metrics[key].max = Math.max(metrics[key].max, metrics[key].first); },
    (metrics: any, key: string) => { delete metrics[key]; },
    (metrics: any, key: string) => { metrics[key].circularPeriod = 24; },
    (metrics: any, key: string) => { metrics[key].min -= 1; },
  ]) {
    const single = { ...source, range: { ...source.range, pageSize: 1 } };
    await assert.rejects(() => collectQizhengRange(single, async (value) => { const page = await getPage(value); const metrics = page.branches[0].metrics; mutate(metrics, Object.keys(metrics)[0]); return page; }), /盘面或指标/);
  }
  await assert.rejects(() => collectQizhengRange(source, async (value) => {
    const page = await getPage(value), branch = page.branches.find((item: any) => item.endIndex - item.startIndex > 1);
    if (branch) { const metric = Object.values(branch.metrics)[0] as any; metric.last += 0.001; metric.max = Math.max(metric.max, metric.last); }
    return page;
  }), /盘面或指标/);
  const controller = new AbortController();
  await assert.rejects(() => collectQizhengRange(source, getPage, { signal: controller.signal, onProgress: () => controller.abort() }), /已取消/);
});

test('跨页圆周指标按末值连接，保留多次跨零范围', async () => {
  const { mergeRangeMetric } = await import('../src/qizheng-range-client');
  const first = { first: 350, last: 370, min: 350, max: 370, circularPeriod: 360 };
  const second = { first: 10, last: 190, min: 10, max: 190, circularPeriod: 360 };
  const third = { first: 190, last: 380, min: 190, max: 380, circularPeriod: 360 };
  assert.deepEqual(mergeRangeMetric(mergeRangeMetric(first, second), third), { first: 350, last: 740, min: 350, max: 740, circularPeriod: 360 });
  assert.throws(() => mergeRangeMetric(first, { ...second, circularPeriod: 24 }), /周期不一致/);
});

test('分支指标校验接受圆周跨零，并拒绝与首末盘不一致的值', async () => {
  const { validateBranchMetrics } = await import('../src/range-client');
  const metric = { longitude: { first: 359, last: 361, min: 359, max: 361, circularPeriod: 360 } };
  assert.equal(validateBranchMetrics(metric, [['longitude', 359, 360]], [['longitude', 1, 360]], 2), true);
  assert.equal(validateBranchMetrics(metric, [['longitude', 359, 360]], [['longitude', 2, 360]], 2), false);
  assert.equal(validateBranchMetrics(metric, [['longitude', 359, 360]], [['longitude', 1, 360]], 1), false);
});

test('出生范围的年、月、日和指定瞬时流曜与逐秒单盘一致，并保留条件行限', async () => {
  const flows = [
    { kind: 'year', year: 2026 }, { kind: 'month', year: 2026, month: 6 },
    { kind: 'day', year: 2026, month: 6, day: 15 }, { kind: 'instant', at: '2026-06-15T04:00:00Z' },
  ] as const;
  for (const flow of flows) {
    const source = { ...input, gender: 'female', flow, range: { ...range, end: '2024-02-19T11:24:50+08:00' } };
    const result = await calculate('qizheng-range', source);
    assert.equal(result.data.range.complete, true); assert.equal(result.data.branches.length, 2);
    for (let i = 0; i < 2; i++) {
      const chart = result.data.branches[i].first;
      const independent = await calculate('qizheng', { question: input.question, birth: { ...birth, second: birth.second + i }, gender: 'female', flow });
      assert.deepEqual(chart.flowing, independent.data.flowing);
      assert.deepEqual(chart.timeLords, independent.data.timeLords);
      assert.equal(chart.flowing.stars.length, 11); assert.equal(chart.timeLords.majorLimitStatus, '命度与交限待核定');
      const transit = chart.flowing.transits[0];
      assert.equal(result.data.branches[i].metrics[`flowing.transits.${transit.star1}.${transit.star2}.${transit.type}.orb`].first, transit.orb);
    }
    assert.match(result.prompt.text, /【流曜取样】/); assert.match(result.prompt.text, /未扫描周期事件/);
  }
});

test('流曜分页收集、追问及跨页输入一致性', async () => {
  const { collectQizhengRange } = await import('../src/qizheng-range-client');
  const source = { ...input, gender: 'male', flow: { kind: 'year', year: 2026 }, range: { ...range, pageSize: 2 }, prompt: { topicId: 'timing', scope: 'yearly' } };
  const page = async (value: any) => (await calculate('qizheng-range', value)).data;
  const collected = await collectQizhengRange(source, page);
  const direct = await calculate('qizheng-range', { ...source, range: { ...range, pageSize: 6 } });
  assert.deepEqual(collected.data.branches, direct.data.branches);
  assert.deepEqual(collected.data.input.flow, source.flow); assert.equal(collected.data.input.gender, 'male');
  assert.match(collected.prompt.text, /【流曜取样】/);
  const first = await calculate('qizheng-range', source);
  assert.match((await reprompt({ method: 'qizheng-range', result: JSON.parse(JSON.stringify(first)), question: '继续' })).prompt.text, /【流曜取样】/);
  const altered = structuredClone(first); altered.data.branches[0].first.flowing.stars[0].longitude++;
  await assert.rejects(() => reprompt({ method: 'qizheng-range', result: altered, question: '继续' }), /不一致/);
  await assert.rejects(() => collectQizhengRange(source, async (value) => { const data = await page(value); data.input.flow.year++; return data; }), /输入不一致/);
  await assert.rejects(() => calculate('qizheng-range', { ...source, flow: { kind: 'year', year: 2020 } }), /不得早于/);
  await assert.rejects(() => calculate('qizheng-range', { ...source, prompt: { scope: 'monthly' } }), /范围/);
});

test('跨夏令时的出生范围流曜使用目标时刻的偏移', async () => {
  const source = { question: '问题', birth: { year: 2024, month: 11, day: 3, hour: 1, minute: 59, second: 59, latitude: 40.7, longitude: -74, timeZoneId: 'America/New_York', timezone: -4 }, range: { start: '2024-11-03T01:59:59-04:00', end: '2024-11-03T01:00:01-05:00' }, flow: { kind: 'month', year: 2026, month: 7 }, gender: 'female' };
  const result = await calculate('qizheng-range', source);
  assert.deepEqual(result.data.branches.map((item: any) => item.first.basis.timezone), [-4, -5]);
  assert.deepEqual(result.data.branches.map((item: any) => item.first.flowing.time.timezone), [-4, -4]);
  assert.deepEqual(result.data.branches.map((item: any) => item.first.flowing.time.utcDateTime), ['2026-07-15T16:00:00.000Z', '2026-07-15T16:00:00.000Z']);
});

test('HTTP 与 MCP 接受流曜范围并可追问', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'qizheng-range' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const source = { ...input, gender: 'female', flow: { kind: 'day', year: 2026, month: 6, day: 15 }, range: { ...range, pageSize: 2 } };
  const response = await send('/api/calculate', { method: 'qizheng-range', input: source }); assert.equal(response.status, 200);
  const data = await response.json();
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'qizheng-range', arguments: source } });
  assert.deepEqual((await mcp.json()).result.structuredContent.data, data.data);
  assert.equal((await send('/api/prompt', { method: 'qizheng-range', result: data, question: '追问' })).status, 200);
});

test('出生范围逐秒扫描年、月、日周期事件并记录每项事件时间范围', async () => {
  const { qizhengPeriodEventOccurrences } = await import('../src/systems/qizheng-range');
  const { collectQizhengRange } = await import('../src/qizheng-range-client');
  const { sameJsonValue } = await import('../src/json-value');
  const person = { ...birth, minute: 25, second: 0 };
  const periodRange = { start: '2024-02-19T11:25:00+08:00', end: '2024-02-19T11:25:02+08:00' };
  for (const flow of [{ kind: 'year', year: 2026 }, { kind: 'month', year: 2026, month: 6 }, { kind: 'day', year: 2026, month: 6, day: 15 }] as const) {
    const source = { question: '问题', birth: person, range: periodRange, flow, periodEvents: true };
    const firstPage = await calculate('qizheng-range', source);
    assert.equal(firstPage.data.range.endIndex, 1); assert.equal(firstPage.data.range.nextCursor, 1);
    assert.ok(firstPage.data.branches[0].first.flowing.period.events.length > 0);
    const direct = await calculate('qizheng-range', { ...source, range: { ...periodRange, pageSize: 2 } });
    const progress: number[] = [];
    const all = await collectQizhengRange(source, async (value) => (await calculate('qizheng-range', value)).data, { onProgress: (value) => progress.push(value) });
    assert.deepEqual(progress, [1, 2]); assert.equal(all.data.range.complete, true);
    assert.ok(sameJsonValue(all.data.branches, direct.data.branches, 1e-9));
    assert.match(all.prompt.text, /【周期事件出生范围】/);
    const snapshots = [];
    for (let second = 0; second < 2; second++) {
      const sample = await calculate('qizheng', { question: '问题', birth: { ...person, second }, flow, periodEvents: true });
      snapshots.push(new Map(qizhengPeriodEventOccurrences(sample.data.flowing.period.events).map((entry) => [entry.identity, entry.event.utcTimestamp])));
    }
    for (const branch of all.data.branches) {
      for (const { identity } of qizhengPeriodEventOccurrences(branch.first.flowing.period.events)) {
        const values = snapshots.slice(branch.startIndex, branch.endIndex).map((sample) => sample.get(identity));
        assert.ok(values.every((value) => typeof value === 'number'));
        const metric = branch.metrics[`period.events.${identity}.utcTimestamp`];
        assert.equal(metric.min, Math.min(...values as number[])); assert.equal(metric.max, Math.max(...values as number[]));
      }
    }
  }
});

test('周期事件范围的追问、分页输入和范围选项校验', async () => {
  const { collectQizhengRange } = await import('../src/qizheng-range-client');
  const source = { ...input, range: { ...range, end: '2024-02-19T11:24:50+08:00' }, flow: { kind: 'day', year: 2026, month: 6, day: 15 }, periodEvents: true };
  const page = await calculate('qizheng-range', source);
  const saved = JSON.parse(JSON.stringify(page));
  const followup = await reprompt({ method: 'qizheng-range', result: saved, question: '全部事件', prompt: { eventDetail: 'full' } });
  assert.match(followup.prompt.text, /周期事件出生范围/);
  saved.data.branches[0].first.flowing.period.events[0].utcTimestamp += 1000;
  await assert.rejects(() => reprompt({ method: 'qizheng-range', result: saved, question: '问题' }), /不一致/);
  await assert.rejects(() => collectQizhengRange(source, async (value) => { const data = (await calculate('qizheng-range', value)).data; data.input.periodEvents = false; return data; }), /输入不一致/);
  await assert.rejects(() => calculate('qizheng-range', { ...source, periodEvents: false, prompt: { eventDetail: 'full' } }), /事件明细/);
  await assert.rejects(() => calculate('qizheng-range', { ...source, prompt: { scope: 'natal', eventDetail: 'full' } }), /事件明细/);
});

test('HTTP、MCP 周期事件分页返回相同事实，单页结果可追问', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'qizheng-range' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const source = { ...input, range: { ...range, end: '2024-02-19T11:24:50+08:00' }, flow: { kind: 'day', year: 2026, month: 6, day: 15 }, periodEvents: true };
  const response = await send('/api/calculate', { method: 'qizheng-range', input: source }); assert.equal(response.status, 200);
  const result = await response.json(); assert.equal(result.data.range.nextCursor, 1);
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'qizheng-range', arguments: source } });
  assert.deepEqual((await mcp.json()).result.structuredContent.data, result.data);
  assert.equal((await send('/api/prompt', { method: 'qizheng-range', result, question: '追问' })).status, 200);
  const altered = structuredClone(result); altered.data.branches[0].first.flowing.period.events[0].utcTimestamp += 1000;
  assert.equal((await send('/api/prompt', { method: 'qizheng-range', result: altered, question: '追问' })).status, 400);
});
