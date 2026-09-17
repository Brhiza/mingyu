import assert from 'node:assert/strict';
import test from 'node:test';
import { BaziAnalyzer } from '../packages/core/src/bazi/baziAnalysis';
import { formatUsefulGodFunctions } from '../packages/core/src/bazi/baziAnalysisFormatter';
import { baziCalculator } from '../packages/core/src/bazi/baziCalculator';
import { HIDDEN_STEMS } from '../packages/core/src/bazi/baziDefinitions';
import { CLIMATE_RULES } from '../packages/core/src/bazi/baziTherapeuticRules';
import { CLIMATE_RULE_RECOMMENDATION_STEMS } from '../packages/core/src/bazi/baziTherapeuticRules/climateRules/recommendationStems';
import type { HiddenStems, PatternAnalysis, Pillars } from '../packages/core/src/bazi/baziTypes';
import { determineUsefulGod } from '../packages/core/src/bazi/baziUsefulGodStrategy';
import { getSeasonStatus, getTenGod, getWuxing } from '../packages/core/src/bazi/baziUtils';
import { buildEnhancedPatternUsefulGodSection } from '../packages/core/src/minglu/bazi-enhancer';
import { formatBaziSchoolPrompt } from '../packages/core/src/prompt/bazi-school';

const analyzer = new BaziAnalyzer(getWuxing, getTenGod, getSeasonStatus);
const PILLAR_KEYS = ['year', 'month', 'day', 'hour'] as const;

function analyze(ganZhi: [string, string, string, string], monthCommander: string) {
  const pillars = Object.fromEntries(
    ganZhi.map((value, index) => [
      PILLAR_KEYS[index],
      { gan: value[0], zhi: value[1], ganZhi: value },
    ]),
  ) as Pillars;
  const hiddenStems = Object.fromEntries(
    PILLAR_KEYS.map((key) => [key, HIDDEN_STEMS[pillars[key].zhi]]),
  ) as HiddenStems;
  return analyzer.analyzeBaziChart(pillars, hiddenStems, monthCommander);
}

function makeBrokenPattern(
  patternName: string,
  label: string,
  stem: string,
  tenGod: string,
): PatternAnalysis {
  return {
    pattern: patternName,
    isSpecial: false,
    fulfillment: {
      patternName,
      status: '破格',
      basis: `${patternName}${label}规则`,
      contradiction: label,
      remedies: [],
      summary: `${stem}${tenGod}有效，救应不成立。`,
      activeBreakers: [
        {
          label,
          stems: [{ stem, tenGod, pillar: 'hour', pillarName: '时柱' }],
          repairStatus: '不满足',
          repairPathKeys: ['合绊或制化'],
          detail: `${stem}${tenGod}透干、有根且未见合绊。`,
        },
      ],
    },
  };
}

test('食神格破格只限制实际壬偏印，保留水五行基线与癸正印', () => {
  const broken = analyze(['丙申', '己巳', '甲子', '壬申'], '丙');
  const formed = analyze(['丙申', '己巳', '甲子', '庚申'], '丙');

  assert.equal(broken.dayMasterStrength.status, '身弱');
  assert.equal(broken.mingGe.pattern, '食神格');
  assert.equal(broken.mingGe.fulfillment?.status, '破格');
  assert.deepEqual(broken.mingGe.fulfillment?.activeBreakers, [
    {
      label: '枭神夺食',
      stems: [{ stem: '壬', tenGod: '偏印', pillar: 'hour', pillarName: '时柱' }],
      repairStatus: '不满足',
      repairPathKeys: ['财制偏印'],
      detail: '枭神夺食可用项：时柱透干壬（偏印），有稳定根气且未见合绊。',
    },
  ]);
  assert.deepEqual(broken.usefulGod.favorableWuxing, ['水', '木']);
  assert.equal(broken.usefulGod.primaryUseful, '正印');
  assert.equal(broken.usefulGod.useful, '正印');
  assert.deepEqual(broken.usefulGod.primaryFavorable, ['正印']);
  assert.ok(!broken.usefulGod.favorable.includes('偏印'));
  assert.ok(broken.usefulGod.unfavorable.includes('偏印'));
  assert.deepEqual(broken.usefulGod.conditionalUnfavorableStems, ['壬']);
  assert.match(formatUsefulGodFunctions(broken.usefulGod).join('；'), /格局破格所忌：壬偏印/);

  assert.equal(formed.dayMasterStrength.status, '身弱');
  assert.equal(formed.mingGe.pattern, '食神格');
  assert.equal(formed.mingGe.fulfillment?.status, '成格');
  assert.deepEqual(formed.mingGe.fulfillment?.activeBreakers, []);
  assert.deepEqual(formed.usefulGod.favorableWuxing, ['水', '木']);
  assert.equal(formed.usefulGod.primaryUseful, '印星');
  assert.ok(formed.usefulGod.favorable.includes('偏印'));
  assert.equal(formed.usefulGod.decisionEvidence?.patternBreakerRestrictions, undefined);
});

test('正官格伤官未获印制时从喜用十神中排除辛伤官', () => {
  const broken = analyze(['乙丑', '辛卯', '戊辰', '戊辰'], '乙');
  const formed = analyze(['乙丑', '己卯', '戊辰', '戊辰'], '乙');

  assert.equal(broken.dayMasterStrength.status, '偏强');
  assert.equal(broken.mingGe.pattern, '正官格');
  assert.equal(broken.mingGe.fulfillment?.status, '破格');
  assert.deepEqual(broken.mingGe.fulfillment?.activeBreakers?.[0]?.stems, [
    { stem: '辛', tenGod: '伤官', pillar: 'month', pillarName: '月柱' },
  ]);
  assert.equal(broken.mingGe.fulfillment?.activeBreakers?.[0]?.repairStatus, '不满足');
  assert.deepEqual(broken.usefulGod.favorableWuxing, ['木', '金', '水']);
  assert.ok(broken.usefulGod.favorable.includes('食神'));
  assert.ok(!broken.usefulGod.favorable.includes('伤官'));
  assert.ok(broken.usefulGod.unfavorable.includes('伤官'));
  assert.deepEqual(broken.usefulGod.conditionalUnfavorableStems, ['辛']);

  assert.equal(formed.dayMasterStrength.status, '偏强');
  assert.equal(formed.mingGe.fulfillment?.status, '成格');
  assert.deepEqual(formed.usefulGod.favorableWuxing, ['木', '金', '水']);
  assert.ok(formed.usefulGod.favorable.includes('伤官'));
});

test('已救应、待核与受合绊的无效破格干均不误加限制', () => {
  const rescued = analyze(['丁巳', '癸酉', '甲子', '辛酉'], '辛');
  assert.equal(rescued.mingGe.fulfillment?.status, '破而复成');
  assert.equal(rescued.mingGe.fulfillment?.activeBreakers?.[0]?.repairStatus, '满足');
  assert.equal(rescued.usefulGod.decisionEvidence?.patternBreakerRestrictions, undefined);
  assert.equal(rescued.usefulGod.conditionalUnfavorableStems, undefined);

  const uncertain = analyze(['癸巳', '辛酉', '甲申', '丁卯'], '辛');
  assert.equal(uncertain.mingGe.fulfillment?.status, '未判定');
  assert.equal(uncertain.mingGe.fulfillment?.activeBreakers?.[0]?.repairStatus, '资料不足');
  assert.equal(uncertain.usefulGod.decisionEvidence?.patternBreakerRestrictions, undefined);
  assert.equal(uncertain.usefulGod.conditionalUnfavorableStems, undefined);

  const partiallyBlocked = analyze(['戊午', '己亥', '甲申', '壬申'], '壬');
  assert.equal(partiallyBlocked.mingGe.fulfillment?.status, '未判定');
  assert.deepEqual(partiallyBlocked.mingGe.fulfillment?.activeBreakers?.[0]?.stems, [
    { stem: '戊', tenGod: '偏财', pillar: 'year', pillarName: '年柱' },
  ]);
  assert.ok(
    !partiallyBlocked.mingGe.fulfillment?.activeBreakers?.[0]?.stems.some(
      (item) => item.stem === '己',
    ),
  );
  assert.equal(partiallyBlocked.usefulGod.decisionEvidence?.patternBreakerRestrictions, undefined);
});

test('格局破格限制在调候合并后仍覆盖同一具体干', () => {
  const pattern: PatternAnalysis = {
    pattern: '食神格',
    isSpecial: false,
    fulfillment: {
      patternName: '食神格',
      status: '破格',
      basis: '食神格枭神夺食规则',
      contradiction: '枭神夺食',
      remedies: [],
      summary: '辛偏印有效，财制偏印不成立。',
      activeBreakers: [
        {
          label: '枭神夺食',
          stems: [{ stem: '辛', tenGod: '偏印', pillar: 'year', pillarName: '年柱' }],
          repairStatus: '不满足',
          repairPathKeys: ['财制偏印'],
          detail: '辛偏印透干、有根且未见合绊。',
        },
      ],
    },
  };
  const result = determineUsefulGod('身弱', pattern, '水', '巳', '丙', '癸', {
    strengthStatus: '身弱',
  });

  assert.deepEqual(result.favorableWuxing, ['金', '水']);
  assert.equal(result.primaryUseful, '正印');
  assert.ok(!result.favorable.includes('偏印'));
  assert.ok(result.unfavorable.includes('偏印'));
  assert.ok(!result.conditionalFavorableStems?.includes('辛'));
  assert.ok(result.conditionalUnfavorableStems?.includes('辛'));
  assert.deepEqual(
    result.decisionEvidence?.patternBreakerRestrictions,
    pattern.fulfillment?.activeBreakers,
  );
});

test('无 policy 的具体荐干规则同样服从格局限制，纯五行调候仍保留', () => {
  const exactPattern: PatternAnalysis = {
    pattern: '正官格',
    isSpecial: false,
    fulfillment: {
      patternName: '正官格',
      status: '破格',
      basis: '正官格官杀混杂规则',
      contradiction: '官杀混杂',
      remedies: [],
      summary: '庚七杀有效，救应不成立。',
      activeBreakers: [
        {
          label: '官杀混杂',
          stems: [{ stem: '庚', tenGod: '七杀', pillar: 'hour', pillarName: '时柱' }],
          repairStatus: '不满足',
          repairPathKeys: ['合杀留官'],
          detail: '庚七杀透干、有根且未见合绊。',
        },
      ],
    },
  };
  const exact = determineUsefulGod('偏强', exactPattern, '木', '辰', '戊', '甲', {
    strengthStatus: '偏强',
  });
  assert.deepEqual(exact.conditionalUnfavorableStems, ['庚']);
  assert.ok(!exact.matchedRules?.some((rule) => rule.id === 'chen-month-jia-geng-first'));
  assert.doesNotMatch(exact.strategyTrace?.join('；') ?? '', /先取庚金/);

  const genericPattern: PatternAnalysis = {
    ...exactPattern,
    fulfillment: {
      ...exactPattern.fulfillment!,
      contradiction: '伤官见官',
      summary: '丁伤官有效，救应不成立。',
      activeBreakers: [
        {
          label: '伤官见官',
          stems: [{ stem: '丁', tenGod: '伤官', pillar: 'hour', pillarName: '时柱' }],
          repairStatus: '不满足',
          repairPathKeys: ['印制伤官'],
          detail: '丁伤官透干、有根且未见合绊。',
        },
      ],
    },
  };
  const generic = determineUsefulGod('偏强', genericPattern, '木', '寅', '甲', undefined, {
    strengthStatus: '偏强',
  });
  assert.deepEqual(generic.conditionalUnfavorableStems, ['丁']);
  assert.ok(generic.matchedRules?.some((rule) => rule.id === 'spring-wood-fire-warm'));
  assert.match(generic.strategyTrace?.join('；') ?? '', /春木湿寒，宜火暖扶发生机/);
});

test('具体荐干目录覆盖不同日主规则并锁定全量分类', () => {
  const guiYin = determineUsefulGod(
    '身弱',
    makeBrokenPattern('食神格', '枭神夺食', '辛', '偏印'),
    '水',
    '寅',
    '甲',
    '癸',
    { strengthStatus: '身弱' },
  );
  assert.deepEqual(guiYin.conditionalUnfavorableStems, ['辛']);
  assert.ok(!guiYin.matchedRules?.some((rule) => rule.id === 'yin-month-gui-xin-bing'));
  assert.doesNotMatch(guiYin.strategyTrace?.join('；') ?? '', /辛金为主/);

  const renHai = determineUsefulGod(
    '身弱',
    makeBrokenPattern('食神格', '七杀扰格', '戊', '七杀'),
    '水',
    '亥',
    '甲',
    '壬',
    { strengthStatus: '身弱' },
  );
  assert.deepEqual(renHai.conditionalUnfavorableStems, ['戊']);
  assert.ok(!renHai.matchedRules?.some((rule) => rule.id === 'hai-month-ren-wu-bing'));
  assert.doesNotMatch(renHai.strategyTrace?.join('；') ?? '', /戊土为堤/);

  const rulesWithoutPolicy = CLIMATE_RULES.filter((rule) => !rule.policy);
  const rulesById = new Map(CLIMATE_RULES.map((rule) => [rule.id, rule]));
  assert.deepEqual(
    rulesWithoutPolicy
      .filter((rule) => !Object.hasOwn(CLIMATE_RULE_RECOMMENDATION_STEMS, rule.id))
      .map((rule) => rule.id),
    [],
    '无 policy 的调候规则必须逐条登记具体荐干或显式空数组',
  );
  assert.deepEqual(
    Object.keys(CLIMATE_RULE_RECOMMENDATION_STEMS).filter((ruleId) => {
      const rule = rulesById.get(ruleId);
      return !rule || Boolean(rule.policy);
    }),
    [],
    '具体荐干分类不得包含未知规则或已有 policy 的规则',
  );
  assert.deepEqual(
    Object.entries(CLIMATE_RULE_RECOMMENDATION_STEMS).flatMap(([ruleId, stems]) =>
      stems
        .filter((stem) => !'甲乙丙丁戊己庚辛壬癸'.includes(stem))
        .map((stem) => `${ruleId}:${stem}`),
    ),
    [],
    '具体荐干分类只允许十天干',
  );
});

test('核心格式与流派提示词共享格局破格干限制', () => {
  const chart = baziCalculator.calculateBazi({
    year: 2013,
    month: 9,
    day: 25,
    timeIndex: 3,
    gender: 'male',
  });
  assert.equal(chart.analysis.mingGe.fulfillment?.status, '破格');
  assert.deepEqual(chart.analysis.usefulGod.conditionalUnfavorableStems, ['丁']);
  const expected = '格局破格所忌：丁伤官（时柱）；伤官见官的救应明确不成立';
  assert.ok(formatUsefulGodFunctions(chart.analysis.usefulGod).includes(expected));
  assert.match(formatBaziSchoolPrompt(chart, 'ziping'), new RegExp(expected));
  assert.equal(
    chart.analysis.usefulGod.decisionEvidence?.patternBreakerRestrictions?.[0]?.stems[0]?.stem,
    '丁',
  );
  assert.ok(
    !chart.analysis.usefulGod.matchedRules?.some((rule) => rule.id === 'you-month-jia-fire-forge'),
  );
  assert.doesNotMatch(chart.analysis.usefulGod.strategyTrace?.join('；') ?? '', /先取丁火/);

  const minglu = buildEnhancedPatternUsefulGodSection(chart);
  assert.match(minglu.usefulGods.reasoning, /格局破格所忌：丁伤官/);
  assert.doesNotMatch(minglu.usefulGods.reasoning, /先取丁火/);
});
