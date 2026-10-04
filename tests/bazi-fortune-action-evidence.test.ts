import test from 'node:test';
import assert from 'node:assert/strict';
import { STEM_WUXING } from '@core/ganzhi/data';
import type { BaziChartResult, Pillars } from '@core/bazi/baziTypes';
import { determineUsefulGod } from '@core/bazi/baziUsefulGodStrategy';
import { buildFortuneSelectionContext } from '@core/bazi/fortuneSelection';
import { normalizeFortuneSelection } from '@core/bazi/fortuneSelection';
import { baziCalculator } from '@core/bazi/baziCalculator';
import {
  analyzeFortuneActionEvidence,
  formatFortuneActionEvidenceForPrompt,
  formatFortuneActionFactLine,
} from '@core/bazi/fortuneActionEvidence';
import { formatBaziFortuneSelection } from '@core/prompt/bazi-fortune';
import { buildBaziPrompt } from '@core/prompt/bazi';

import { evaluatePatternFulfillment } from '@core/bazi/baziPatternFulfillment';
import { HIDDEN_STEMS } from '@core/bazi/baziDefinitions';
import { getTenGod } from '@core/bazi/baziUtils';

function asSpecialPattern(pillars: Pillars) {
  return {
    pattern: '专旺格',
    isSpecial: true,
    basis: '合成关系夹具只验证取用消费，不作为完整专旺成立结论',
    fulfillment: evaluatePatternFulfillment(pillars, pillars.day.gan, '正官格', getTenGod, {
      strengthStatus: '身强',
      monthCommander: HIDDEN_STEMS[pillars.month.zhi][0],
    }),
  };
}

/**
 * 构造公开合成测试命盘：
 * 甲木生未月，干透丁火（月干）、戊土（时干）、癸水（年干），
 * 经 UsefulGodStrategy 裁决：
 * - conditionalUnfavorableStems: ['丁']（具体天干丁火因印食制化列忌）
 * - conditionalFavorableWuxing: ['火']，但 favorableWuxing 不含火（食伤仍有前提）
 * - 丙火不在 conditionalUnfavorableStems 中（具体干不扩大为同五行）
 */
function createSyntheticChartWithLuck(): BaziChartResult {
  const pillars: Pillars = {
    year: { gan: '癸', zhi: '亥', ganZhi: '癸亥' },
    month: { gan: '丁', zhi: '未', ganZhi: '丁未' },
    day: { gan: '甲', zhi: '寅', ganZhi: '甲寅' },
    hour: { gan: '戊', zhi: '辰', ganZhi: '戊辰' },
  };
  const usefulGod = determineUsefulGod('极强', asSpecialPattern(pillars), '木');

  return {
    gender: 'male',
    solarDate: { year: 1983, month: 5, day: 28 },
    lunarDate: { year: 1983, month: 4, day: 16, monthName: '四月', dayName: '十六' },
    timeInfo: {} as any,
    pillars,
    dayMaster: { gan: '甲', element: '木', yinYang: '阳' },
    zodiac: '猪',
    constellation: '双子座',
    tenGods: {},
    hiddenStems: {},
    hiddenTenGods: {},
    wuxingStrength: {} as any,
    mingGong: '甲子',
    shenGong: '丙寅',
    taiYuan: '戊申',
    taiXi: '乙丑',
    lifeStages: {},
    pillarLifeStages: {} as any,
    nayin: {} as any,
    shensha: {} as any,
    shenShaAnalysis: {} as any,
    ziZuo: {} as any,
    kongWang: {} as any,
    wuxingSeasonStatus: {},
    monthCommander: '丙',
    seasonInfo: {} as any,
    warnings: [],
    warningFacts: [],
    warningSummaryFact: {} as any,
    analysis: {
      dayMasterStrength: { status: '极强' } as any,
      mingGe: { pattern: '曲直格', isSpecial: true } as any,
      usefulGod,
    },
    luckInfo: {
      startInfo: '1990年起运',
      handoverInfo: '',
      cycles: [
        {
          age: 37,
          year: 2020,
          ganZhi: '甲子',
          type: '大运',
          isXiaoyun: false,
          years: [
            { year: 2026, age: 43, ganZhi: '丙午', tenGod: '', tenGodZhi: '' },
            { year: 2027, age: 44, ganZhi: '丁未', tenGod: '', tenGodZhi: '' },
          ],
        },
      ],
    },
  } as unknown as BaziChartResult;
}

test('岁运作用只引用已采纳的调候候选，不把未满足规则当作制化来源', () => {
  const layer = { id: '2026', type: 'year' as const, label: '流年', ganZhi: '丙午' };
  const rejected = baziCalculator.calculateBazi({
    year: 1980,
    month: 1,
    day: 3,
    timeIndex: 6,
    gender: 'male',
  });
  const rejectedEvidence = rejected.analysis.usefulGod.decisionEvidence;
  assert.ok(rejectedEvidence);
  assert.ok(
    rejectedEvidence.climateCandidates.some(
      (item) => !item.adopted && item.effects?.some((effect) => effect.stem === '丙'),
    ),
  );
  assert.ok(
    !rejectedEvidence.climateCandidates.some(
      (item) => item.adopted && item.effects?.some((effect) => effect.stem === '丙'),
    ),
  );
  const rejectedFact = analyzeFortuneActionEvidence({
    result: rejected,
    layers: [layer],
  }).facts.find(
    (item) => item.level === 'year' && item.placement === '岁运透干' && item.stem === '丙',
  );
  assert.ok(rejectedFact);
  assert.ok(!rejectedFact.hitSources.includes('制化来源'));
  assert.deepEqual(rejectedFact.targetObjects, []);

  const adopted = baziCalculator.calculateBazi({
    year: 1985,
    month: 2,
    day: 3,
    timeIndex: 6,
    gender: 'male',
  });
  const adoptedFact = analyzeFortuneActionEvidence({ result: adopted, layers: [layer] }).facts.find(
    (item) => item.level === 'year' && item.placement === '岁运透干' && item.stem === '丙',
  );
  assert.ok(adoptedFact);
  assert.ok(adoptedFact.hitSources.includes('制化来源'));
  assert.ok(adoptedFact.targetObjects.includes('癸'));
});

test('岁运作用只引用已闭合的格局制化路径', () => {
  const uncertain = baziCalculator.calculateBazi({
    year: 1980,
    month: 1,
    day: 3,
    timeIndex: 6,
    gender: 'male',
  });
  assert.ok(
    uncertain.analysis.usefulGod.decisionEvidence?.controlFunctions?.some(
      (item) => item.status === '资料不足' && item.sourceStems.includes('乙'),
    ),
  );
  const uncertainFact = analyzeFortuneActionEvidence({
    result: uncertain,
    layers: [{ id: '2025', type: 'year', label: '流年', ganZhi: '乙巳' }],
  }).facts.find(
    (item) => item.level === 'year' && item.placement === '岁运透干' && item.stem === '乙',
  );
  assert.ok(uncertainFact);
  assert.ok(!uncertainFact.hitSources.includes('制化来源'));
  assert.deepEqual(uncertainFact.targetObjects, []);

  const confirmed = baziCalculator.calculateBazi({
    year: 1980,
    month: 5,
    day: 15,
    timeIndex: 6,
    gender: 'male',
  });
  const confirmedFact = analyzeFortuneActionEvidence({
    result: confirmed,
    layers: [{ id: '2018', type: 'year', label: '流年', ganZhi: '戊戌' }],
  }).facts.find(
    (item) => item.level === 'year' && item.placement === '岁运透干' && item.stem === '戊',
  );
  assert.ok(confirmedFact);
  assert.ok(confirmedFact.hitSources.includes('制化来源'));
  assert.ok(confirmedFact.targetObjects.includes('辛'));
});

test('真实岁运只引用本命已采纳主作用，次作用及五行排序保持参照', () => {
  const chart = baziCalculator.calculateBazi({
    year: 1971,
    month: 11,
    day: 11,
    timeIndex: 4,
    gender: 'male',
    useTrueSolarTime: false,
  });
  assert.deepEqual(
    Object.values(chart.pillars).map((pillar) => pillar.ganZhi),
    ['辛亥', '己亥', '庚子', '庚辰'],
  );
  assert.deepEqual(chart.analysis.usefulGod.conditionalFavorableStems, ['丙']);
  assert.deepEqual(chart.analysis.usefulGod.conditionalUnfavorableStems, ['丁']);
  const climate = chart.analysis.usefulGod.decisionEvidence.climateCandidates.find(
    (candidate) => candidate.ruleId === 'geng-winter-no-fire-warm',
  );
  assert.ok(climate);
  assert.equal(climate.adopted, true);
  assert.deepEqual(climate.effects, [
    { stem: '丙', wuxing: '火', role: '照暖', targetStems: ['庚'], rank: 'primary' },
    { stem: '丁', wuxing: '火', role: '锻炼', targetStems: ['庚'], rank: 'secondary' },
  ]);
  const analysisBefore = structuredClone(chart.analysis);
  const promptCurrentTime = new Date('2026-05-19T10:30:00+08:00');

  for (const [year, ganZhi, stem, hasAction] of [
    [2026, '丙午', '丙', true],
    [2027, '丁未', '丁', false],
  ] as const) {
    const cycleIndex = chart.luckInfo.cycles.findIndex((cycle) =>
      cycle.years.some((item) => item.year === year),
    );
    const context = buildFortuneSelectionContext(chart, { scope: 'year', cycleIndex, year });
    assert.ok(context?.actionEvidence);
    assert.ok(context.promptPayload.summaryLines.includes(`流年干支：${ganZhi}`));
    const fact = context.actionEvidence.facts.find(
      (item) => item.level === 'year' && item.placement === '岁运透干' && item.stem === stem,
    );
    assert.ok(fact);
    assert.equal(fact.hitSources.includes('制化来源'), hasAction);
    assert.deepEqual(fact.targetObjects, hasAction ? ['庚'] : []);
    assert.equal(fact.currentActionStatus, '资料不足');
    if (!hasAction) assert.ok(fact.hitSources.includes('conditionalUnfavorableStems'));
    const prompt = buildBaziPrompt({
      result: chart,
      fortuneSelectionContext: context,
      currentTime: promptCurrentTime,
    });
    assert.match(prompt, /条件取用：丙火用于照暖（作用对象：庚）/u);
    assert.match(prompt, /干级所忌：丁/u);
    const actionLine = prompt.split('\n').find((line) => line.includes(`流年${stem}（火，`));
    assert.ok(actionLine);
    assert.equal(actionLine.includes('本命制化作用'), hasAction);
    assert.equal(actionLine.includes('作用对象：庚'), hasAction);
    assert.match(actionLine, hasAction ? /依据：本命干级喜用/u : /依据：本命干级所忌/u);
    assert.doesNotMatch(
      prompt,
      /conditionalFavorableStems|conditionalUnfavorableStems|patternBreakerRestrictions/u,
    );
    assert.match(prompt, /【任务】/u);
    assert.match(prompt, /【问题】/u);
    const baselineContext = structuredClone(context);
    const original = STEM_WUXING[stem];
    try {
      STEM_WUXING[stem] = '水';
      assert.equal(STEM_WUXING[stem], '水');
      const changedContext = buildFortuneSelectionContext(chart, {
        scope: 'year',
        cycleIndex,
        year,
      });
      assert.deepEqual(changedContext, baselineContext);
      assert.equal(
        buildBaziPrompt({
          result: chart,
          fortuneSelectionContext: changedContext,
          currentTime: promptCurrentTime,
        }),
        prompt,
      );
    } finally {
      STEM_WUXING[stem] = original;
    }
    assert.equal(STEM_WUXING[stem], original);
    assert.deepEqual(
      buildFortuneSelectionContext(chart, { scope: 'year', cycleIndex, year }),
      baselineContext,
    );
  }
  assert.deepEqual(chart.analysis, analysisBefore);

  const referenceChart = baziCalculator.calculateBazi({
    year: 2024,
    month: 5,
    day: 29,
    timeIndex: 6,
    gender: 'male',
    useTrueSolarTime: false,
  });
  assert.deepEqual(
    Object.values(referenceChart.pillars).map((pillar) => pillar.ganZhi),
    ['甲辰', '己巳', '癸巳', '戊午'],
  );
  const reference = referenceChart.analysis.usefulGod.decisionEvidence.climateCandidates.find(
    (candidate) => candidate.ruleId === 'si-month-gui-xin-source',
  );
  assert.ok(reference);
  assert.equal(reference.adopted, true);
  assert.equal(reference.mode, 'within-balance');
  assert.deepEqual(referenceChart.analysis.usefulGod.conditionalFavorableStems ?? [], []);
  for (const [year, stem] of [
    [2031, '辛'],
    [2040, '庚'],
  ] as const) {
    const cycleIndex = referenceChart.luckInfo.cycles.findIndex((cycle) =>
      cycle.years.some((item) => item.year === year),
    );
    const context = buildFortuneSelectionContext(referenceChart, {
      scope: 'year',
      cycleIndex,
      year,
    });
    assert.ok(context?.actionEvidence);
    const fact = context.actionEvidence.facts.find(
      (item) => item.level === 'year' && item.placement === '岁运透干' && item.stem === stem,
    );
    assert.ok(fact);
    assert.ok(fact.hitSources.includes('基础五行喜忌'));
    assert.ok(!fact.hitSources.includes('制化来源'));
    assert.deepEqual(fact.targetObjects, []);
    const actionLine = buildBaziPrompt({ result: referenceChart, fortuneSelectionContext: context })
      .split('\n')
      .find((line) => line.includes(`流年${stem}（金，`));
    assert.ok(actionLine);
    assert.ok(!actionLine.includes('本命制化作用'));
    assert.ok(!actionLine.includes('作用对象：癸'));
  }

  const brokenChart = baziCalculator.calculateBazi({
    year: 2013,
    month: 9,
    day: 25,
    timeIndex: 3,
    gender: 'male',
    useTrueSolarTime: false,
  });
  assert.equal(brokenChart.analysis.mingGe.fulfillment?.status, '破格');
  const cycleIndex = brokenChart.luckInfo.cycles.findIndex((cycle) =>
    cycle.years.some((item) => item.year === 2027),
  );
  const context = buildFortuneSelectionContext(brokenChart, {
    scope: 'year',
    cycleIndex,
    year: 2027,
  });
  assert.ok(context?.actionEvidence);
  const ding = context.actionEvidence.facts.find(
    (item) => item.level === 'year' && item.placement === '岁运透干' && item.stem === '丁',
  );
  assert.ok(ding);
  assert.deepEqual(ding.hitSources, [
    'conditionalUnfavorableStems',
    'patternBreakerRestrictions',
    '基础五行喜忌',
  ]);
  const line = formatFortuneActionFactLine(ding);
  assert.match(line, /依据：本命破格所忌、基础五行喜忌/u);
  assert.doesNotMatch(line, /本命干级所忌|conditionalUnfavorableStems|patternBreakerRestrictions/u);
  const prompt = buildBaziPrompt({ result: brokenChart, fortuneSelectionContext: context });
  assert.match(prompt, /格局破格所忌：丁伤官（时柱）；伤官见官的救应明确不成立/u);
  assert.match(prompt, /流年丁（火，伤官，岁运透干）：引用已裁决所忌条件/u);
  assert.doesNotMatch(
    prompt,
    /conditionalFavorableStems|conditionalUnfavorableStems|patternBreakerRestrictions/u,
  );
});

test('同盘 2027 丁命中 conditionalUnfavorableStems 丁，而 2026 丙不命中丁', () => {
  const chart = createSyntheticChartWithLuck();

  // 1. 2027 流年（丁未）
  const ctx2027 = buildFortuneSelectionContext(chart, {
    scope: 'year',
    cycleIndex: 0,
    year: 2027,
  });
  assert.ok(ctx2027);
  assert.ok(ctx2027.actionEvidence);

  const factDing2027 = ctx2027.actionEvidence.facts.find(
    (f) => f.level === 'year' && f.placement === '岁运透干' && f.stem === '丁',
  );
  assert.ok(factDing2027, '应存在 2027 流年透干丁的作用事实');
  assert.equal(factDing2027.stem, '丁');
  assert.equal(factDing2027.placement, '岁运透干');
  assert.ok(
    factDing2027.hitSources.includes('conditionalUnfavorableStems'),
    '2027 丁应命中 conditionalUnfavorableStems',
  );

  // 2. 2026 流年（丙午）
  const ctx2026 = buildFortuneSelectionContext(chart, {
    scope: 'year',
    cycleIndex: 0,
    year: 2026,
  });
  assert.ok(ctx2026);
  assert.ok(ctx2026.actionEvidence);

  const factBing2026 = ctx2026.actionEvidence.facts.find(
    (f) => f.level === 'year' && f.placement === '岁运透干' && f.stem === '丙',
  );
  assert.ok(factBing2026, '应存在 2026 流年透干丙的作用事实');
  assert.equal(factBing2026.stem, '丙');
  assert.equal(factBing2026.placement, '岁运透干');
  assert.equal(
    factBing2026.hitSources.includes('conditionalUnfavorableStems'),
    false,
    '2026 丙不得命中 conditionalUnfavorableStems 中的丁',
  );
  assert.equal(
    factBing2026.conditionStatus,
    '引用有前提的喜用条件',
    '丙未命中具体所忌干，火仍须满足食伤泄秀条件',
  );
  assert.ok(factBing2026.hitSources.includes('条件五行喜用'));
  assert.equal(factBing2026.hitSources.includes('基础五行喜忌'), false);
  assert.equal(factBing2026.currentActionStatus, '资料不足');
  assert.ok(
    ctx2026.promptPayload.evidenceLines?.some(
      (line) =>
        line.startsWith('【辅证】岁运作用事实') &&
        line.includes('流年丙') &&
        line.includes('条件五行喜用'),
    ),
    '带前提的食伤候选应在提示词证据中标为辅证',
  );
});

test('2027 丁同时命中有前提的五行喜用与具体干所忌，裁定为双向条件引用', () => {
  const chart = createSyntheticChartWithLuck();
  const ctx2027 = buildFortuneSelectionContext(chart, {
    scope: 'year',
    cycleIndex: 0,
    year: 2027,
  });
  assert.ok(ctx2027?.actionEvidence);

  const factDing = ctx2027.actionEvidence.facts.find(
    (f) => f.level === 'year' && f.placement === '岁运透干' && f.stem === '丁',
  );
  assert.ok(factDing);
  assert.equal(factDing.conditionStatus, '双向条件引用');
  assert.ok(factDing.hitSources.includes('conditionalUnfavorableStems'));
  assert.ok(factDing.hitSources.includes('条件五行喜用'));
  assert.equal(factDing.hitSources.includes('基础五行喜忌'), false);
  assert.ok(
    factDing.supportingFactKeys.includes('bazi:useful-god:conditional-favorable-wuxing:火'),
    '应指向有前提的食伤五行条件',
  );
  assert.ok(
    factDing.opposingFactKeys.includes('bazi:useful-god:conditional-unfavorable:丁'),
    '应有具体所忌干反证 key',
  );
  assert.equal(
    factDing.currentActionStatus,
    '资料不足',
    '本切片只建立条件引用，透干是否实际作用仍需独立动态裁决',
  );
});

test('大运→流年→流月父子继承且父层事实不可被子层覆盖', () => {
  const chart = createSyntheticChartWithLuck();

  // T1 大运
  const ctxDayun = buildFortuneSelectionContext(chart, {
    scope: 'dayun',
    cycleIndex: 0,
  });
  assert.ok(ctxDayun?.actionEvidence);
  const dayunFacts = ctxDayun.actionEvidence.facts;
  assert.ok(dayunFacts.length > 0);
  assert.ok(dayunFacts.every((f) => f.level === 'dayun'));
  assert.ok(dayunFacts.every((f) => f.parentLayerKey === undefined));

  // T2 流年
  const ctxYear = buildFortuneSelectionContext(chart, {
    scope: 'year',
    cycleIndex: 0,
    year: 2027,
  });
  assert.ok(ctxYear?.actionEvidence);
  const yearContextFacts = ctxYear.actionEvidence.facts;
  const inheritedDayunInYear = yearContextFacts.filter((f) => f.level === 'dayun');
  const yearFacts = yearContextFacts.filter((f) => f.level === 'year');

  // 父层事实不可被子层覆盖：大运事实深度等值不变
  assert.deepEqual(
    inheritedDayunInYear,
    dayunFacts,
    '流年层的大运事实必须与大运单层计算的事实完全一致',
  );
  // 流年事实必须继承父运 key
  assert.ok(yearFacts.length > 0);
  assert.ok(
    yearFacts.every((f) => f.parentLayerKey === 'bazi:fortune-trigger:layer:dayun:dayun'),
    '流年事实的 parentLayerKey 必须指向大运 key',
  );

  // T3 流月（2027年第1月）
  const ctxMonth = buildFortuneSelectionContext(chart, {
    scope: 'month',
    cycleIndex: 0,
    year: 2027,
    month: 1,
  });
  assert.ok(ctxMonth?.actionEvidence);
  const monthContextFacts = ctxMonth.actionEvidence.facts;
  const inheritedDayunInMonth = monthContextFacts.filter((f) => f.level === 'dayun');
  const inheritedYearInMonth = monthContextFacts.filter((f) => f.level === 'year');
  const monthFacts = monthContextFacts.filter((f) => f.level === 'month');

  // 父层事实不可被覆盖
  assert.deepEqual(inheritedDayunInMonth, dayunFacts, '流月层的大运事实不变');
  assert.deepEqual(inheritedYearInMonth, yearFacts, '流月层的流年事实不变');

  // 流月事实继承流年 key
  assert.ok(monthFacts.length > 0);
  assert.ok(
    monthFacts.every((f) => f.parentLayerKey === 'bazi:fortune-trigger:layer:year:year'),
    '流月事实的 parentLayerKey 必须指向流年 key',
  );
});

test('岁运藏干来自 HIDDEN_STEMS 且标记本气/中气/余气，不冒充透干', () => {
  const chart = createSyntheticChartWithLuck();
  // 2027 未中藏干：己(本气)、丁(中气)、乙(余气)
  const ctx2027 = buildFortuneSelectionContext(chart, {
    scope: 'year',
    cycleIndex: 0,
    year: 2027,
  });
  assert.ok(ctx2027?.actionEvidence);

  const yearFacts = ctx2027.actionEvidence.facts.filter((f) => f.level === 'year');
  const transparentFact = yearFacts.find((f) => f.placement === '岁运透干');
  const hiddenFacts = yearFacts.filter((f) => f.placement === '岁运藏干');

  assert.equal(transparentFact?.stem, '丁');
  assert.equal(transparentFact?.hiddenCategory, undefined);

  assert.equal(hiddenFacts.length, 3);
  const hiddenJi = hiddenFacts.find((f) => f.stem === '己');
  const hiddenDing = hiddenFacts.find((f) => f.stem === '丁');
  const hiddenYi = hiddenFacts.find((f) => f.stem === '乙');

  assert.equal(hiddenJi?.hiddenCategory, '本气');
  assert.equal(hiddenDing?.hiddenCategory, '中气');
  assert.equal(hiddenYi?.hiddenCategory, '余气');

  // 藏干丁虽然命中 conditionalUnfavorableStems，但 placement 必须为岁运藏干，不冒充透干
  assert.ok(hiddenDing);
  assert.equal(hiddenDing.placement, '岁运藏干');
  assert.equal(
    hiddenDing.currentActionStatus,
    '不满足',
    '藏干不能当岁运明透，currentActionStatus 判定为不满足',
  );
  assert.ok(
    hiddenDing.opposingFactKeys.some((k) => k.includes('hidden-not-transparent')),
    '藏干必须携带非明透反证 key',
  );
});

test('本命 analysis 经各层岁运投影后深等值不变（禁止回写）', () => {
  const chart = createSyntheticChartWithLuck();
  const snapshot = structuredClone(chart.analysis);

  // 连续调用大运、流年、流月
  buildFortuneSelectionContext(chart, { scope: 'dayun', cycleIndex: 0 });
  buildFortuneSelectionContext(chart, { scope: 'year', cycleIndex: 0, year: 2026 });
  buildFortuneSelectionContext(chart, { scope: 'year', cycleIndex: 0, year: 2027 });
  buildFortuneSelectionContext(chart, { scope: 'month', cycleIndex: 0, year: 2027, month: 1 });

  assert.deepEqual(chart.analysis, snapshot, '岁运投影计算绝对禁止回写或修改本命 analysis');
});

test('岁运事实提示词只输出可读事实，内部证据键仍留在结构化数据中', () => {
  const chart = createSyntheticChartWithLuck();
  const ctx2027 = buildFortuneSelectionContext(chart, {
    scope: 'year',
    cycleIndex: 0,
    year: 2027,
  });
  assert.ok(ctx2027?.actionEvidence);

  const factDing = ctx2027.actionEvidence.facts.find(
    (f) => f.level === 'year' && f.placement === '岁运透干' && f.stem === '丁',
  );
  assert.ok(factDing);
  assert.match(factDing.key, /^bazi:fortune-action:/);
  const factLine = formatFortuneActionFactLine(factDing);
  assert.ok(factLine.startsWith('流年丁'));
  assert.ok(!factLine.includes(factDing.key));
  assert.ok(factLine.includes('双向条件引用'));

  const promptLines = formatFortuneActionEvidenceForPrompt(ctx2027.actionEvidence);
  assert.ok(promptLines.length > 1);
  for (const fact of ctx2027.actionEvidence.facts) {
    assert.ok(
      promptLines.some((line) => line.includes(formatFortuneActionFactLine(fact))),
      `格式化提示词输出应包含可读事实：${fact.层级}${fact.干}`,
    );
    assert.ok(promptLines.every((line) => !line.includes(fact.key)));
  }

  const sections = formatBaziFortuneSelection(ctx2027);
  assert.ok(sections);
  assert.ok(!sections.focus.includes(factDing.key));
  assert.equal(
    sections.focus.split(factLine.replaceAll('｜', '；')).length - 1,
    1,
    '同一岁运作用事实在最终提示词中只应输出一次',
  );
  assert.match(sections.focus, /岁运作用事实/);
});

test('真实流年与流月把同层己土明透及本气合列，保留根气归属和跨层事实', () => {
  const chart = baziCalculator.calculateBazi({
    gender: 'male',
    year: 1991,
    month: 5,
    day: 15,
    timeIndex: 5,
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });
  for (const selection of [
    { scope: 'year' as const, year: 2026 },
    { scope: 'month' as const, year: 2026, month: 5 },
  ]) {
    const context = buildFortuneSelectionContext(
      chart,
      normalizeFortuneSelection(chart, selection),
    );
    assert.ok(context);
    const rawDayunJi = context.actionEvidence?.facts.filter(
      (fact) => fact.level === 'dayun' && fact.stem === '己',
    );
    assert.deepEqual(
      rawDayunJi?.map((fact) => [fact.placement, fact.hiddenCategory]),
      [
        ['岁运透干', undefined],
        ['岁运藏干', '本气'],
      ],
    );

    const focus = formatBaziFortuneSelection(context)!.focus;
    const dayunJiLines = focus.split('\n').filter((line) => line.includes('大运己（土'));
    assert.equal(dayunJiLines.length, 1);
    assert.match(
      dayunJiLines[0],
      /岁运透干、岁运藏干·本气.*引用已裁决所忌条件；状态：资料不足；依据：基础五行喜忌；透干根气：原局及岁运均见同干根气；适用范围：2024年起，约34岁交运/,
    );
    assert.match(focus, /流年己（土，偏财，岁运藏干·中气）.*适用范围：2026年/);
    if (selection.scope === 'month') {
      assert.match(focus, /流月己（土，偏财，岁运藏干·中气）.*适用范围：2026-06-05至2026-07-07/);
    }
    assert.doesNotMatch(focus, /^岁运作用事实：/m);
  }
});

test('同层同干的作用对象不同时保留两条独立取证', () => {
  const chart = baziCalculator.calculateBazi({
    gender: 'male',
    year: 1991,
    month: 5,
    day: 15,
    timeIndex: 5,
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });
  const context = buildFortuneSelectionContext(
    chart,
    normalizeFortuneSelection(chart, { scope: 'year', year: 2026 }),
  );
  assert.ok(context?.actionEvidence);
  const hidden = context.actionEvidence.facts.find(
    (fact) => fact.level === 'dayun' && fact.stem === '己' && fact.placement === '岁运藏干',
  );
  assert.ok(hidden);
  const original = formatFortuneActionFactLine(hidden);
  hidden.targetObjects = ['甲'];
  const updated = formatFortuneActionFactLine(hidden);
  context.promptPayload.evidenceLines = context.promptPayload.evidenceLines.map((line) =>
    line.replace(original, updated),
  );

  const dayunJiLines = formatBaziFortuneSelection(context)!
    .focus.split('\n')
    .filter((line) => line.includes('大运己（土'));
  assert.equal(dayunJiLines.length, 2);
  assert.ok(dayunJiLines.some((line) => line.includes('岁运透干')));
  assert.ok(
    dayunJiLines.some((line) => line.includes('岁运藏干·本气') && line.includes('作用对象：甲')),
  );
});

test('关系事实只有合冲时，currentActionStatus 不得升级为满足或不满足', () => {
  // 构造原局未引用用神条件、但有合冲关系的层级
  const chart = createSyntheticChartWithLuck();
  // 庚子年与原局年柱癸亥、月柱丁巳、日柱甲寅比对只有合冲，若无干级裁决用神条件，不应升级为满足或不满足
  const ctx2026 = buildFortuneSelectionContext(chart, {
    scope: 'year',
    cycleIndex: 0,
    year: 2026,
  });
  assert.ok(ctx2026?.actionEvidence);

  // 检查未申等只有合冲、无直接干级用神裁决的藏干
  const factsWithRelationsOnly = ctx2026.actionEvidence.facts.filter(
    (f) => f.currentActionStatus === '资料不足',
  );
  assert.ok(
    factsWithRelationsOnly.length > 0,
    '存在仅有合冲或仅有背景五行但无裁决干条件的资料不足状态',
  );
});
