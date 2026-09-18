import test from 'node:test';
import assert from 'node:assert/strict';
import type { BaziChartResult, Pillars } from '@core/bazi/baziTypes';
import { determineUsefulGod } from '@core/bazi/baziUsefulGodStrategy';
import { buildFortuneSelectionContext } from '@core/bazi/fortuneSelection';
import {
  formatFortuneActionEvidenceForPrompt,
  formatFortuneActionFactLine,
} from '@core/bazi/fortuneActionEvidence';
import { formatBaziFortuneSelection } from '@core/prompt/bazi-fortune';

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
 * - conditionalFavorableWuxing: ['火'] / favorableWuxing 含火（基础五行火为喜用）
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
    '引用已裁决喜用条件',
    '丙未命中具体所忌干，仅随基础五行火为喜用',
  );
});

test('2027 丁同时命中基础五行喜用与具体干所忌，裁定为双向条件引用', () => {
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
  assert.ok(factDing.hitSources.includes('基础五行喜忌'));
  assert.ok(
    factDing.supportingFactKeys.some((k) => k.includes('favorable')),
    '应有基础喜用支持事实 key',
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

test('formatter 输出直接引用 action fact key 而不靠中文文本解析', () => {
  const chart = createSyntheticChartWithLuck();
  const ctx2027 = buildFortuneSelectionContext(chart, {
    scope: 'year',
    cycleIndex: 0,
    year: 2027,
  });
  assert.ok(ctx2027?.actionEvidence);

  // 1. formatFortuneActionFactLine 必须包含稳定 key
  const factDing = ctx2027.actionEvidence.facts.find(
    (f) => f.level === 'year' && f.placement === '岁运透干' && f.stem === '丁',
  );
  assert.ok(factDing);
  const factLine = formatFortuneActionFactLine(factDing);
  assert.ok(factLine.startsWith(`[${factDing.key}]`));
  assert.ok(factLine.includes('双向条件引用'));

  // 2. formatFortuneActionEvidenceForPrompt
  const promptLines = formatFortuneActionEvidenceForPrompt(ctx2027.actionEvidence);
  assert.ok(promptLines.length > 1);
  for (const fact of ctx2027.actionEvidence.facts) {
    assert.ok(
      promptLines.some((line) => line.includes(`[${fact.key}]`)),
      `格式化提示词输出必须包含 key: ${fact.key}`,
    );
  }

  // 3. formatBaziFortuneSelection 任务书输出亦包含 action fact key
  const sections = formatBaziFortuneSelection(ctx2027);
  assert.ok(sections);
  assert.ok(sections.focus.includes(`[${factDing.key}]`));
  assert.equal(
    sections.focus.split(`[${factDing.key}]`).length - 1,
    1,
    '同一 action fact key 在最终提示词中只应输出一次',
  );
  assert.match(sections.focus, /岁运作用事实/);
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
