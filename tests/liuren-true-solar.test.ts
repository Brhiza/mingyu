import assert from 'node:assert/strict';
import test from 'node:test';
import { SolarTerm } from 'tyme4ts';
import { calculate, reprompt } from '../src/core';
import worker from '../src/worker';
import { getDivinationTime, getMonthLeaderByZhongqi, getSolarTermName } from '../src/systems/calendar';
import { trueSolarTime } from '../src/systems/astronomy/true-solar';
import { generateLiurenChart } from '../src/systems/liuren/chart';

test('真太阳时跨节气、中气和日时边界时，年月与月将仍取实际起课时刻', () => {
  let differentDayOrHour = 0, crossedTerm = 0;
  for (let index = 0; index < 24; index++) {
    const term = SolarTerm.fromIndex(2024, index).getJulianDay().getSolarTime();
    const instant = Date.UTC(term.getYear(), term.getMonth() - 1, term.getDay(), term.getHour() - 8, term.getMinute(), term.getSecond());
    for (const delta of [-1000, 1000]) for (const longitude of [75, 116.4, 150]) {
      const date = new Date(instant + delta), correction = trueSolarTime(date, longitude), adjusted = new Date(correction.effectiveTimestamp);
      const actual = generateLiurenChart(adjusted, date);
      assert.deepEqual([actual.ganzhi.year, actual.ganzhi.month], [getDivinationTime(date).ganzhi.year, getDivinationTime(date).ganzhi.month]);
      assert.deepEqual([actual.ganzhi.day, actual.ganzhi.hour], [getDivinationTime(adjusted).ganzhi.day, getDivinationTime(adjusted).ganzhi.hour]);
      assert.equal(actual.monthLeader, getMonthLeaderByZhongqi(date.getTime()));
      assert.ok(actual.lessonSummary?.includes(getSolarTermName(date.getTime())));
      if (actual.ganzhi.day !== getDivinationTime(date).ganzhi.day || actual.ganzhi.hour !== getDivinationTime(date).ganzhi.hour) differentDayOrHour++;
      if (getSolarTermName(adjusted.getTime()) !== getSolarTermName(date.getTime())) crossedTerm++;
    }
  }
  assert.ok(differentDayOrHour > 0 && crossedTerm > 0);
});

test('真太阳时起课及追问保留实际占时、经度并拒绝篡改', async () => {
  const input = { question: '工作如何', divinationTime: '2024-02-19T04:10:00Z', liuren: { timeStandard: 'true-solar', longitude: 75 } };
  const saved = JSON.parse(JSON.stringify(await calculate('liuren', input)));
  assert.equal(saved.data.timeContext.referenceTimestamp, Date.parse(input.divinationTime));
  assert.equal(saved.data.termReferenceTimestamp, Date.parse(input.divinationTime));
  assert.match(saved.prompt.text, /节气、年月及月将依据实际起课时刻，日时依据真太阳时/);
  assert.match((await reprompt({ method: 'liuren', result: saved, question: '继续问' })).prompt.text, /继续问/);
  for (const mutate of [
    (data: any) => { data.timeContext.longitude += 1; },
    (data: any) => { data.timeContext.totalCorrectionMinutes += 1; },
    (data: any) => { data.termReferenceTimestamp += 1000; },
    (data: any) => { data.timestamp += 1000; },
    (data: any) => { delete data.timeContext; },
  ]) {
    const bad = structuredClone(saved); mutate(bad.data);
    await assert.rejects(() => reprompt({ method: 'liuren', result: bad, question: '追问' }));
  }
  await assert.rejects(() => calculate('liuren', { question: '问题', liuren: { timeStandard: 'true-solar' } }));
  await assert.rejects(() => calculate('liuren', { question: '问题', liuren: { longitude: 116 } }));
  await assert.rejects(() => calculate('liuren', { question: '问题', liuren: { timeStandard: 'beijing', longitude: 116 } }));
});

test('Worker HTTP 与 MCP 使用同一真太阳时课盘和原课追问', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'liuren' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const input = { question: '工作如何', divinationTime: '2024-02-19T04:10:00Z', currentTime: '2025-01-01T00:00:00Z', liuren: { timeStandard: 'true-solar', longitude: 116.4 } };
  const response = await send('/api/calculate', { method: 'liuren', input });
  assert.equal(response.status, 200);
  const saved = await response.json();
  assert.equal((await send('/api/prompt', { method: 'liuren', result: saved, question: '追问' })).status, 200);
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'liuren', arguments: input } });
  assert.deepEqual((await mcp.json()).result.structuredContent.data, saved.data);
});
