import assert from 'node:assert/strict';
import test from 'node:test';
import { SolarTerm } from 'tyme4ts';
import { calculate, reprompt } from '../src/core';
import { getDivinationTime, getMonthLeaderByZhongqi, getSolarTermName } from '../src/systems/calendar';
import { trueSolarTime } from '../src/systems/astronomy/true-solar';
import { generateLiurenRange } from '../src/systems/liuren';
import worker from '../src/worker';

const currentTime = '2025-01-01T00:00:00Z';
const rain = { start: '2024-02-19T03:00:00Z', end: '2024-02-19T05:00:00Z' };

test('全年二十四节气按实际交节秒分段，分支课盘等于独立单盘', async () => {
  for (let index = 0; index < 24; index++) {
    const t = SolarTerm.fromIndex(2024, index).getJulianDay().getSolarTime();
    const instant = Date.UTC(t.getYear(), t.getMonth() - 1, t.getDay(), t.getHour() - 8, t.getMinute(), t.getSecond());
    const range = { start: new Date(instant - 1000).toISOString(), end: new Date(instant + 1000).toISOString() };
    const settings = index % 2 ? { timeStandard: 'true-solar' as const, longitude: 75 } : {};
    const result = await calculate('liuren', { question: '问题', currentTime, range, liuren: settings });
    const data = result.data as any;
    assert.equal(data.branches.length, 2, String(index));
    assert.equal(data.branches[0].endTimestamp, instant);
    for (const branch of data.branches) {
      const single = await calculate('liuren', { question: '问题', currentTime, divinationTime: new Date(branch.startTimestamp).toISOString(), liuren: settings });
      assert.deepEqual(branch.data, single.data);
    }
  }
});

test('两小时范围逐秒覆盖北京时间和真太阳时的日时、节气与月将', async () => {
  const cases = [
    { start: rain.start, settings: {} },
    { start: rain.start, settings: { timeStandard: 'true-solar' as const, longitude: 116.4 } },
    { start: '2024-02-04T15:00:00Z', settings: { timeStandard: 'true-solar' as const, longitude: 75 } },
    { start: '2024-12-21T09:00:00Z', settings: { timeStandard: 'true-solar' as const, longitude: 180 } },
  ];
  for (const { start, settings } of cases) {
    const from = Date.parse(start), end = from + 7_200_000;
    const range = await generateLiurenRange({ start, end: new Date(end).toISOString() }, settings);
    assert.equal(range.branches[0].startTimestamp, from);
    assert.equal(range.branches.at(-1)?.endTimestamp, end);
    for (let i = 1; i < range.branches.length; i++) assert.equal(range.branches[i - 1].endTimestamp, range.branches[i].startTimestamp);
    for (let timestamp = from; timestamp < end; timestamp += 1000) {
      const branch = range.branches.find((item) => item.startTimestamp <= timestamp && timestamp < item.endTimestamp)!;
      const actual = getDivinationTime(new Date(timestamp)).ganzhi;
      const corrected = settings.timeStandard === 'true-solar' ? getDivinationTime(new Date(trueSolarTime(new Date(timestamp), settings.longitude).effectiveTimestamp)).ganzhi : actual;
      assert.deepEqual(branch.data.ganzhi, { ...corrected, year: actual.year, month: actual.month }, `${start}/${timestamp}`);
      assert.equal(branch.data.monthLeader, getMonthLeaderByZhongqi(timestamp));
      assert.ok(branch.data.lessonSummary?.includes(getSolarTermName(timestamp)));
    }
  }
});

test('范围追问复用所有分支，校验四柱、边界、时间口径及课盘', async () => {
  const settings = { timeStandard: 'true-solar', longitude: 116.4 };
  const saved = JSON.parse(JSON.stringify(await calculate('liuren', { question: '问题', currentTime, range: rain, liuren: settings })));
  assert.equal(saved.data.kind, 'range');
  assert.ok(saved.data.branches.length > 1);
  for (const branch of saved.data.branches) {
    assert.equal('evidence' in branch.data.evidenceAnalysis, false);
    assert.equal('promptText' in branch.data.evidenceAnalysis, false);
    assert.equal(branch.data.evidenceAnalysis.platePositionFacts.length, 12);
    assert.equal(branch.data.evidenceAnalysis.transmissions.length, 3);
  }
  assert.match(saved.prompt.text, /该分支起点的代表时刻/);
  saved.data.branches[0].data.evidenceAnalysis = { fake: '伪造' };
  const next = await reprompt({ method: 'liuren', result: saved, question: '继续问' });
  assert.match(next.prompt.text, /继续问/);
  assert.doesNotMatch(next.prompt.text, /伪造/);
  for (const mutate of [
    (data: any) => { data.branches[0].endTimestamp += 1000; },
    (data: any) => { data.branches[0].data.fourLessons[0].upper = '伪造'; },
    (data: any) => { data.branches[0].data.timeContext.longitude = 0; },
    (data: any) => { data.source.endExclusive = false; },
  ]) {
    const bad = structuredClone(saved); mutate(bad.data);
    await assert.rejects(() => reprompt({ method: 'liuren', result: bad, question: '追问' }));
  }
  const pillars = getDivinationTime(new Date(rain.start)).ganzhi;
  await assert.rejects(() => calculate('liuren', { question: '问题', range: { ...rain, pillars: { ...pillars, hour: '甲子' } } }));
  await assert.rejects(() => calculate('liuren', { question: '问题', range: rain, divinationTime: rain.start }));
  await assert.rejects(() => calculate('liuren', { question: '问题', range: { ...rain, end: '2024-02-19T05:00:01Z' } }));
  await assert.rejects(() => calculate('liuren', { question: '问题', range: { ...rain, start: '2024-02-19T03:00:00.500Z' } }));
  await assert.rejects(() => calculate('liuren', { question: '问题', range: rain, liuren: { timeStandard: 'true-solar' } }));
});

test('Worker HTTP 和 MCP 可计算范围并基于原区间追问', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'liuren' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const input = { question: '问题', currentTime, range: rain, liuren: { timeStandard: 'true-solar', longitude: 116.4 } };
  const response = await send('/api/calculate', { method: 'liuren', input });
  assert.equal(response.status, 200); const saved = await response.json();
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'liuren', arguments: input } });
  assert.deepEqual((await mcp.json()).result.structuredContent.data, saved.data);
  assert.equal((await send('/api/prompt', { method: 'liuren', result: saved, question: '追问' })).status, 200);
});
