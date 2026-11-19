import assert from 'node:assert/strict';
import test from 'node:test';
import { SolarTerm } from 'tyme4ts';
import { calculate, reprompt } from '../src/core';
import { getDivinationTime } from '../src/systems/calendar';
import { trueSolarTime } from '../src/systems/astronomy/true-solar';
import { generateTaiyi } from '../src/systems/taiyi/chart';
import worker from '../src/worker';

const currentTime = '2025-01-01T00:00:00Z';
const range = { start: '2024-06-20T18:00:00Z', end: '2024-06-20T20:00:00Z' };
const fingerprint = (result: ReturnType<typeof generateTaiyi>) => {
  const { dateTime: _date, termReferenceDateTime: _actual, prompt: _prompt, evidenceAnalysis: _evidence, ...facts } = result;
  return facts;
};

test('范围保留月、日、时计稳定分支，代表盘与单盘一致', async () => {
  for (const scope of ['month', 'day', 'hour'] as const) for (const solar of [false, true]) {
    const settings = { scope, ...(solar ? { timeStandard: 'true-solar' as const, longitude: 116.4 } : {}) };
    const result = await calculate('taiyi', { question: '问题', currentTime, range, taiyi: settings });
    const data = result.data as any;
    assert.equal(data.kind, 'range');
    assert.equal(data.branches[0].startTimestamp, Date.parse(range.start));
    assert.equal(data.branches.at(-1).endTimestamp, Date.parse(range.end));
    assert.match(result.prompt.text, /该分支起点的代表时刻/);
    for (const branch of data.branches) {
      const single = await calculate('taiyi', { question: '问题', currentTime, taiyi: { ...settings, date: new Date(branch.startTimestamp).toISOString() } });
      assert.deepEqual(branch.chart, single.data.chart);
    }
  }
});

test('时计阴阳遁在冬至与夏至实际交节秒切换', async () => {
  for (const [index, before, after] of [[0, '阴遁', '阳遁'], [12, '阳遁', '阴遁']] as const) {
    const t = SolarTerm.fromIndex(2024, index).getJulianDay().getSolarTime();
    const instant = Date.UTC(t.getYear(), t.getMonth() - 1, t.getDay(), t.getHour() - 8, t.getMinute(), t.getSecond());
    const result = await calculate('taiyi', { question: '问题', currentTime,
      range: { start: new Date(instant - 1000).toISOString(), end: new Date(instant + 1000).toISOString() },
      taiyi: { scope: 'hour', timeStandard: 'true-solar', longitude: 75 } });
    const branches = (result.data as any).branches;
    assert.equal(branches.length, 2);
    assert.equal(branches[0].endTimestamp, instant);
    assert.deepEqual(branches.map((branch: any) => branch.chart.yinYang), [before, after]);
  }
});

test('真太阳时范围逐秒验证本计干支并抽查完整盘面', async () => {
  const cases = [
    { start: '2024-06-20T18:00:00Z', longitude: 116.4 },
    { start: '2024-12-21T09:00:00Z', longitude: 180 },
    { start: '2024-12-31T15:00:00Z', longitude: 75 },
  ];
  for (const { start, longitude } of cases) for (const scope of ['month', 'day', 'hour'] as const) {
    const from = Date.parse(start), end = from + 7_200_000, endText = new Date(end).toISOString();
    const result = await calculate('taiyi', { question: '问题', currentTime, range: { start, end: endText }, taiyi: { scope, timeStandard: 'true-solar', longitude } });
    const branches = (result.data as any).branches;
    for (let timestamp = from; timestamp < end; timestamp += 1000) {
      const branch = branches.find((item: any) => item.startTimestamp <= timestamp && timestamp < item.endTimestamp);
      assert.ok(branch, `${scope}/${start}/${timestamp}`);
      const date = new Date(timestamp), corrected = new Date(trueSolarTime(date, longitude).effectiveTimestamp);
      const actual = getDivinationTime(date).ganzhi, clock = getDivinationTime(corrected).ganzhi;
      assert.equal(branch.chart.ganZhi, (scope === 'month' ? actual : clock)[scope], `${scope}/${timestamp}`);
      if ((timestamp - from) % 60_000 === 0) assert.deepEqual(fingerprint(branch.chart), fingerprint(generateTaiyi({ scope, date: corrected, termReferenceDate: date })), `${scope}/${timestamp}`);
    }
  }
});

test('范围与单盘追问校验输入、盘面和时间口径', async () => {
  const settings = { scope: 'hour', timeStandard: 'true-solar', longitude: 116.4 };
  const saved = JSON.parse(JSON.stringify(await calculate('taiyi', { question: '问题', currentTime, range, taiyi: settings })));
  saved.data.branches[0].chart.evidenceAnalysis = { fake: '伪造' };
  const next = await reprompt({ method: 'taiyi', result: saved, question: '继续问' });
  assert.match(next.prompt.text, /继续问/); assert.doesNotMatch(next.prompt.text, /伪造/);
  for (const mutate of [
    (data: any) => { data.branches[0].endTimestamp += 1000; },
    (data: any) => { data.branches[0].chart.bureau = 999; },
    (data: any) => { data.branches[0].chart.dateTime = '伪造'; },
    (data: any) => { data.source.endExclusive = false; },
  ]) {
    const bad = structuredClone(saved); mutate(bad.data);
    await assert.rejects(() => reprompt({ method: 'taiyi', result: bad, question: '追问' }));
  }
  const single = JSON.parse(JSON.stringify(await calculate('taiyi', { question: '问题', currentTime, taiyi: { ...settings, date: range.start } })));
  assert.match((await reprompt({ method: 'taiyi', result: single, question: '继续问' })).prompt.text, /经度 116.4°/);
  single.data.input.longitude = 0;
  await assert.rejects(() => reprompt({ method: 'taiyi', result: single, question: '追问' }));
  await assert.rejects(() => calculate('taiyi', { question: '问题', range, taiyi: { scope: 'year', year: 2024 } }));
  await assert.rejects(() => calculate('taiyi', { question: '问题', range, taiyi: { scope: 'hour', date: range.start } }));
  await assert.rejects(() => calculate('taiyi', { question: '问题', taiyi: { scope: 'year', year: 2024, timeStandard: 'true-solar', longitude: 116.4 } }));
  await assert.rejects(() => calculate('taiyi', { question: '问题', range, taiyi: { scope: 'hour', timeStandard: 'true-solar' } }));
  await assert.rejects(() => calculate('taiyi', { question: '问题', range: { ...range, pillars: { ...getDivinationTime(new Date(range.start)).ganzhi, hour: '甲子' } }, taiyi: { scope: 'hour' } }));
});

test('Worker HTTP 和 MCP 计算太乙范围并复用原区间', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'taiyi' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const input = { question: '问题', currentTime, range, taiyi: { scope: 'hour', timeStandard: 'true-solar', longitude: 116.4 } };
  const response = await send('/api/calculate', { method: 'taiyi', input });
  assert.equal(response.status, 200); const saved = await response.json();
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'taiyi', arguments: input } });
  assert.deepEqual((await mcp.json()).result.structuredContent.data, saved.data);
  assert.equal((await send('/api/prompt', { method: 'taiyi', result: saved, question: '追问' })).status, 200);
});
