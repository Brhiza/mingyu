import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import { generateQimen as generateV2Qimen } from '../src/systems/qimen/chart';
import { getMonthQimenJuShu, getYearQimenJuShu } from '../src/systems/qimen/year-month';
import { arrangeJiuGongGe, resolveZhiShiLandingPalace, getZhiFuZhiShiByGanZhi as newFuShi, checkSpecialHourConditions, getDunJiaStem } from '../src/systems/qimen/layout';
import { getQimenPatternTags, buildPatternDetails, buildPalaceInsights } from '../src/systems/qimen/patterns';
import { getStemRelations } from '../src/systems/qimen/stem-relations';
import { getClassicPatterns } from '../src/systems/qimen/classic-patterns';
import { detectQimenPatternCombos } from '../src/systems/qimen/pattern-combos';
import { branchPalaces } from '../src/systems/qimen/palace';
import { getQimenJuShu } from '../src/systems/qimen/jushu';
import { getQimenActiveSpecialConditionText } from '../src/systems/qimen/evidence';
import { getDivinationTime, getSolarTermName, getVoidBranches } from '../src/systems/calendar';
import { SolarTerm } from 'tyme4ts';
import { estimateYingQi } from '../src/systems/qimen/ying-qi';
import { analyzeGanzhiInteractions } from '../src/systems/qimen/interactions';
import { buildSeasonality } from '../src/systems/qimen/seasonality';
import { trueSolarTime } from '../src/systems/astronomy/true-solar';
import catalog from '../src/prompt-catalog.json';
import worker from '../src/worker';

const currentTime = '2025-01-01T00:00:00Z';
const input = { question: '工作如何', currentTime, qimen: { scope: 'hour', method: 'zhuanpan', juMethod: 'chaibu' } };

test('真太阳时跨交节、日界和年界时保留真实瞬时', async () => {
  const cases = [
    ['2024-02-04T08:30:00Z', 116.4], ['2024-02-04T08:20:00Z', 135],
    ['2024-06-20T14:55:00Z', 75], ['2024-12-31T15:50:00Z', 150],
    ['2025-01-01T15:10:00Z', 60], ['2025-06-21T02:00:00Z', 0],
  ] as const;
  for (const [instant, longitude] of cases) {
    const actual = new Date(instant), correction = trueSolarTime(actual, longitude), timestamp = correction.effectiveTimestamp;
    for (const scope of ['hour', 'day', 'month', 'year'] as const) for (const method of ['zhuanpan', 'feipan'] as const) {
      const juMethod = scope === 'hour' || scope === 'day' ? 'zhirun' as const : undefined;
      const corrected = new Date(timestamp);
      const chart = generateV2Qimen(corrected, method, scope, juMethod, actual);
      assert.equal(chart.timeInfo.solarTerm, getSolarTermName(actual.getTime()));
      assert.deepEqual([chart.ganzhi.year, chart.ganzhi.month], [getDivinationTime(actual).ganzhi.year, getDivinationTime(actual).ganzhi.month]);
    }
    const saved = JSON.parse(JSON.stringify(await calculate('qimen', { question: '工作', divinationTime: instant, qimen: { timeStandard: 'true-solar', longitude, method: 'feipan', juMethod: 'zhirun' } })));
    assert.equal(saved.data.timestamp, timestamp);
    assert.match(saved.prompt.text, /真太阳时/);
    assert.match((await reprompt({ method: 'qimen', result: saved, question: '追问' })).prompt.text, /追问/);
    for (const change of [
      (data: any) => { data.timeContext.longitude += 1; },
      (data: any) => { data.termReferenceTimestamp += 1000; },
      (data: any) => { data.timeContext.totalCorrectionMinutes += 1; },
    ]) {
      const altered = structuredClone(saved); change(altered.data);
      await assert.rejects(() => reprompt({ method: 'qimen', result: altered, question: '追问' }));
    }
  }
  await assert.rejects(() => calculate('qimen', { question: '问题', qimen: { timeStandard: 'true-solar' } }));
  await assert.rejects(() => calculate('qimen', { question: '问题', qimen: { timeStandard: 'beijing', longitude: 116 } }));
});

test('追问核对原始盘面，忽略缓存证据并拒绝被修改的盘面', async () => {
  const saved = JSON.parse(JSON.stringify(await calculate('qimen', input)));
  saved.data.evidenceAnalysis.palaceFacts[0].promptText = '伪造证据';
  const next = await reprompt({ method: 'qimen', result: saved, question: '追问', prompt: { topicId: 'career', subtopicId: 'job-change', schools: ['gongwei', 'geju'], includeClassics: true } });
  assert.doesNotMatch(next.prompt.text, /伪造证据/);
  assert.match(next.prompt.text, /工作变动/);
  assert.match(next.prompt.text, /多口径合参/);
  assert.match(next.prompt.text, /经典依据/);
  for (const mutate of [
    (d: any) => { d.jiuGongGe[0].renPan.door = '伪造门'; },
    (d: any) => { d.zhiFu = '伪造值符'; },
    (d: any) => { d.ganzhi.day = '甲子'; },
    (d: any) => { d.timestamp += 86400000; },
    (d: any) => { d.patternTags.push('伪造格局'); },
    (d: any) => { d.directions.goodDirections.push({ gong: 1, name: '伪造方位', direction: '北', use: '伪造', reasons: [] }); },
    (d: any) => { d.specialConditions.description = '伪造特殊条件'; },
  ]) {
    const altered = structuredClone(saved); mutate(altered.data);
    await assert.rejects(() => reprompt({ method: 'qimen', result: altered, question: '追问' }));
  }
  for (const topic of catalog.qimen.topicIds) {
    const subtopics = (catalog.qimen.subtopics as Record<string, { id: string; label: string }[]>)[topic] ?? [];
    for (const subtopic of subtopics) {
      const selected = await reprompt({ method: 'qimen', result: saved, question: '追问', prompt: { topicId: topic, subtopicId: subtopic.id } });
      assert.ok(selected.prompt.text.split('【任务】')[1].includes(subtopic.label), `${topic}/${subtopic.id}`);
    }
  }
});

test('Worker HTTP 和 MCP 计算及复用奇门盘面', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'qimen' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const http = await send('/api/calculate', { method: 'qimen', input });
  assert.equal(http.status, 200);
  const saved = await http.json();
  const next = await send('/api/prompt', { method: 'qimen', result: saved, question: '追问' });
  assert.equal(next.status, 200);
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'qimen', arguments: input } });
  assert.equal(mcp.status, 200);
  assert.equal((await mcp.json()).result.structuredContent.data.zhiFu, saved.data.zhiFu);
});
test('六十干支、九局和阴阳遁的转飞盘均有九个不同宫位', () => {
  const stems = '甲乙丙丁戊己庚辛壬癸', branches = '子丑寅卯辰巳午未申酉戌亥';
  for (let i = 0; i < 60; i++) for (let juShu = 1; juShu <= 9; juShu++) for (const isYangDun of [true, false]) {
    const hour = stems[i % 10] + branches[i % 12];
    const { zhiFu, zhiShi, xunShouPalace } = newFuShi(hour, { juShu, isYangDun });
    for (const method of ['zhuanpan', 'feipan'] as const) {
      const board = arrangeJiuGongGe(isYangDun, juShu, zhiFu, zhiShi, { hour }, method);
      assert.equal(board.length, 9);
      assert.deepEqual(board.map((palace) => palace.gong).sort(), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
      assert.ok(board.some((palace) => palace.tianPan.star === zhiFu || palace.tianPan.companionStar === zhiFu));
      assert.ok(board.some((palace) => palace.gong === resolveZhiShiLandingPalace(isYangDun, zhiShi, hour, xunShouPalace, method)));
    }
  }
  assert.throws(() => arrangeJiuGongGe(true, 0, '天蓬', '休门', { hour: '甲子' }));
});

test('奇门置闰法按主流满九日门槛：2015 大雪超神 8 天不置闰，2016 芒种超神 10 天闰芒种', async () => {
  const { getQimenJuShu } = await import('../src/systems/qimen/jushu');
  const dec2015 = getQimenJuShu({ year: 2015, month: 12, day: 15, hour: 12, minute: 0, second: 0 }, 'zhirun');
  assert.equal(dec2015.isZhiRun, false);
  const jun2016 = getQimenJuShu({ year: 2016, month: 6, day: 12, hour: 12, minute: 0, second: 0 }, 'zhirun');
  assert.equal(jun2016.isZhiRun, true);
  assert.equal(jun2016.jieQi, '芒种');
});
