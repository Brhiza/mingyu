import assert from 'node:assert/strict';
import test from 'node:test';

import { baziCalculator } from '@core/bazi/baziCalculator';
import { BaziAnalyzer } from '@core/bazi/baziAnalysis';
import { formatBaziForPrompt, formatUsefulGodFunctions } from '@core/bazi/baziAnalysisFormatter';
import { HIDDEN_STEMS } from '@core/bazi/baziDefinitions';
import type { BaziChartResult, HiddenStems, Pillars } from '@core/bazi/baziTypes';
import { getSeasonStatus, getTenGod, getWuxing } from '@core/bazi/baziUtils';
import { analyzeFortuneActionEvidence } from '@core/bazi/fortuneActionEvidence';
import {
  formatAvoidGodPrioritySummary,
  formatUsefulGodPrioritySummary,
} from '../src/pages/ResultPage/ResultPage.helpers';

test('中和正印成格记录原局庚印作用，参考调候不补造整五行喜忌', () => {
  const chart = baziCalculator.calculateBazi({
    year: 1990,
    month: 9,
    day: 5,
    timeIndex: 6,
    gender: 'male',
    isLunar: false,
  });
  const { mingGe, dayMasterStrength, usefulGod } = chart.analysis;

  assert.deepEqual(
    Object.values(chart.pillars).map((pillar) => pillar.ganZhi),
    ['庚午', '甲申', '癸酉', '戊午'],
  );
  assert.equal(dayMasterStrength.status, '中和');
  assert.equal(mingGe.pattern, '正印格');
  assert.equal(mingGe.fulfillment?.status, '成格');
  assert.deepEqual(
    usefulGod.decisionEvidence?.natalFunctions
      ?.filter((item) => item.role === '格神')
      .map((item) => [item.stem, item.placement]),
    [['庚', '透干']],
  );
  assert.equal(usefulGod.incrementStatus, '待判');
  assert.deepEqual(usefulGod.favorableWuxing, []);
  assert.deepEqual(usefulGod.unfavorableWuxing, []);
  assert.deepEqual(usefulGod.favorable, []);
  assert.deepEqual(usefulGod.unfavorable, []);
  assert.equal(usefulGod.primaryUseful, '待判');
  assert.equal(usefulGod.primaryAvoid, '待判');
  assert.ok(
    usefulGod.decisionEvidence?.climateCandidates.some(
      (candidate) =>
        candidate.status === '满足' && candidate.mode === 'reference' && !candidate.adopted,
    ),
  );
  assert.match(formatUsefulGodFunctions(usefulGod).join('；'), /原局格神作用：庚正印/);
  assert.match(formatBaziForPrompt(chart), /增补五行喜忌: 待判/);
  assert.match(
    formatBaziForPrompt(chart),
    /取用依据: 日主旺衰中和，正印格当前成格；增补五行喜忌结合司令、根气与制化作用待判/,
  );
});

test('同一天干在年、月两柱均参与成格时保留各自柱位', () => {
  // 合成四柱只隔离重复透干的柱位证据，不对应实际出生时刻。
  const values = ['庚午', '庚申', '癸酉', '戊午'];
  const positions = ['year', 'month', 'day', 'hour'] as const;
  const pillars = Object.fromEntries(
    positions.map((position, index) => [
      position,
      { gan: values[index][0], zhi: values[index][1], ganZhi: values[index] },
    ]),
  ) as Pillars;
  const hiddenStems = Object.fromEntries(
    positions.map((position) => [position, HIDDEN_STEMS[pillars[position].zhi]]),
  ) as HiddenStems;
  const analysis = new BaziAnalyzer(getWuxing, getTenGod, getSeasonStatus).analyzeBaziChart(
    pillars,
    hiddenStems,
    '庚',
  );

  assert.equal(analysis.mingGe.fulfillment?.status, '成格');
  assert.deepEqual(
    analysis.usefulGod.decisionEvidence?.natalFunctions
      ?.filter((item) => item.role === '格神' && item.stem === '庚')
      .map((item) => [item.pillar, item.placement]),
    [
      ['year', '透干'],
      ['month', '透干'],
    ],
  );
});

test('破格与未判定普通格不记录已成立的原局格神或制化路径', () => {
  for (const [date, expectedStatus] of [
    [{ year: 2013, month: 9, day: 25, timeIndex: 3 }, '破格'],
    [{ year: 1980, month: 1, day: 12, timeIndex: 6 }, '未判定'],
  ] as const) {
    const chart = baziCalculator.calculateBazi({ ...date, gender: 'male', isLunar: false });
    assert.equal(chart.analysis.mingGe.fulfillment?.status, expectedStatus);
    assert.deepEqual(chart.analysis.usefulGod.decisionEvidence?.natalFunctions, []);
  }
});

test('部分判定仅有单侧增补结论时另一侧明确待判', () => {
  const chart = baziCalculator.calculateBazi({
    year: 1990,
    month: 9,
    day: 5,
    timeIndex: 6,
    gender: 'male',
    isLunar: false,
  });
  const useful = chart.analysis.usefulGod;
  useful.incrementStatus = '部分判定';
  useful.favorableWuxing = ['木'];
  useful.primaryFavorableWuxing = '木';
  useful.unfavorableWuxing = [];
  useful.primaryUnfavorableWuxing = '';
  assert.match(formatBaziForPrompt(chart), /取用: 主用木.*；增补所忌待判/);
  assert.equal(formatAvoidGodPrioritySummary(chart), '增补五行所忌待判');

  useful.favorableWuxing = [];
  useful.primaryFavorableWuxing = '';
  useful.unfavorableWuxing = ['金'];
  useful.primaryUnfavorableWuxing = '金';
  assert.match(formatBaziForPrompt(chart), /取用: 增补喜用待判；忌金/);
  assert.equal(formatUsefulGodPrioritySummary(chart), '增补五行取用待判');
});

test('偏强正印格保留原局格神功能与扶抑增补结论的不同作用域', () => {
  const chart = baziCalculator.calculateBazi({
    year: 1988,
    month: 7,
    day: 24,
    timeIndex: 6,
    gender: 'male',
    isLunar: false,
  });
  const { mingGe, dayMasterStrength, usefulGod } = chart.analysis;

  assert.equal(dayMasterStrength.status, '偏强');
  assert.equal(mingGe.pattern, '正印格');
  assert.equal(mingGe.fulfillment?.status, '成格');
  assert.ok(
    usefulGod.decisionEvidence?.natalFunctions?.some(
      (item) => item.stem === '己' && item.role === '格神',
    ),
  );
  assert.ok(usefulGod.unfavorableWuxing?.includes('土'));
  assert.equal(usefulGod.conditionalFavorableStems?.includes('己') ?? false, false);
});

test('成格制化路径只记录原局具体作用，不把路径来源干升级为新来干喜', () => {
  // 合成四柱只隔离格局与取用算法，不对应实际公历时刻。
  const values = ['丙午', '庚申', '甲辰', '壬申'];
  const positions = ['year', 'month', 'day', 'hour'] as const;
  const pillars = Object.fromEntries(
    positions.map((position, index) => [
      position,
      { gan: values[index][0], zhi: values[index][1], ganZhi: values[index] },
    ]),
  ) as Pillars;
  const hiddenStems = Object.fromEntries(
    positions.map((position) => [position, HIDDEN_STEMS[pillars[position].zhi]]),
  ) as HiddenStems;
  const analysis = new BaziAnalyzer(getWuxing, getTenGod, getSeasonStatus).analyzeBaziChart(
    pillars,
    hiddenStems,
    '庚',
  );
  const path = analysis.mingGe.fulfillment?.pathEvaluations?.find(
    (item) => item.key === '食神制杀' && item.status === '满足',
  );
  assert.ok(path);
  assert.equal(analysis.mingGe.fulfillment?.status, '成格');
  assert.ok(
    analysis.usefulGod.decisionEvidence?.natalFunctions?.some(
      (item) => item.stem === '丙' && item.role === '制化来源',
    ),
  );
  assert.equal(analysis.usefulGod.conditionalFavorableStems?.includes('丙') ?? false, false);
  const action = analyzeFortuneActionEvidence({
    result: {
      pillars,
      dayMaster: { gan: '甲', element: '木', yinYang: '阳' },
      analysis,
    } as BaziChartResult,
    layers: [{ id: 'test-year', type: 'year', label: '流年', ganZhi: '丙午' }],
  });
  const incomingBing = action.facts.find(
    (fact) => fact.stem === '丙' && fact.placement === '岁运透干',
  );
  assert.ok(incomingBing?.hitSources.includes('制化来源'));
  assert.equal(incomingBing?.conditionStatus, '引用已裁决所忌条件');
});
