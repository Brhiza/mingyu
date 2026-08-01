import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAstrolabeScopeContext,
  calculateSecondaryProgressionEvidence,
  calculateSolarArcEvidence,
  calculateSolarReturnEvidence,
} from 'mingyu-core/divination/astrolabe-scope';
import { generateAstrolabe } from 'mingyu-core/divination/astrolabe';
import type { AstrolabeData } from 'mingyu-core/types';
import { assertPromptIsPortableTaskText } from './prompt-assertions';

const astrolabeData = generateAstrolabe({
  name: '本人',
  gender: '女',
  year: '1995',
  month: '5',
  day: '20',
  hour: '12',
  minute: '30',
  latitude: '39.9042',
  longitude: '116.4074',
  timezone: '8',
  locationName: '北京',
});

type AdvancedEvidence =
  | ReturnType<typeof calculateSolarReturnEvidence>
  | ReturnType<typeof calculateSecondaryProgressionEvidence>
  | ReturnType<typeof calculateSolarArcEvidence>;

function assertAdvancedEvidenceReferences(evidence: AdvancedEvidence) {
  const stepKeys = new Set(evidence.calculationSteps.map((item) => item.key));
  const factKeys = new Set([evidence.summaryFact.key, ...evidence.summaryFact.factKeys]);
  assert.deepEqual(
    evidence.calculationChain,
    evidence.calculationSteps.map((item) => item.promptText),
  );
  assert.equal(evidence.summaryFact.calculationStepCount, evidence.calculationSteps.length);
  assert.equal(evidence.summaryFact.aspectFactCount, evidence.aspectFacts.length);
  assert.equal(evidence.summaryFact.limitationFactCount, evidence.limitationFacts.length);
  assert.ok(evidence.summaryFact.factKeys.includes(evidence.aspectSummaryFact.key));
  assert.ok(evidence.aspectSummaryFact.factKeys.every((key) => factKeys.has(key)));
  assert.ok(
    evidence.aspectFacts.every(
      (item) =>
        item.ownerFactKeys.length > 0 &&
        item.ownerFactKeys.every((key) => factKeys.has(key)) &&
        item.ownerStepKeys.every((key) => stepKeys.has(key)) &&
        item.ownerFactKeys.join('|') === item.ownerStepKeys.join('|') &&
        !('closeness' in item) &&
        !('normalizedOrbRatio' in item) &&
        item.promptText.includes('实际夹角') &&
        item.promptText.includes('精确角') &&
        item.promptText.includes('偏差') &&
        item.promptText.includes('采用容许度'),
    ),
  );
  assert.ok(
    evidence.limitationFacts.every(
      (item) =>
        item.ownerFactKeys.length > 0 &&
        item.ownerFactKeys.every((key) => factKeys.has(key)) &&
        item.ownerStepKeys.every((key) => stepKeys.has(key)) &&
        item.ownerFactKeys.join('|') === item.ownerStepKeys.join('|'),
    ),
  );
  assert.ok(
    [
      ...evidence.calculationSteps,
      ...evidence.aspectFacts,
      evidence.aspectSummaryFact,
      evidence.summaryFact,
      ...evidence.limitationFacts,
    ].every((item) => item.sources.length > 0 && item.limitation.length > 0),
  );
  assert.match(evidence.promptText, /计算链：/);
  assert.match(evidence.promptText, /证据汇总：/);
  assertPromptIsPortableTaskText(evidence.promptText);
}

test('星盘本命分析对象只写入本命资料', () => {
  const context = buildAstrolabeScopeContext(astrolabeData, 'natal', '2028-06-01');

  assert.equal(context.displayText, '仅使用本命信息');
  assert.equal(context.dateStr, '');
  assert.match(context.promptText, /分析对象：本命盘。/);
  assert.match(context.promptText, /本命宫主星：第1宫/);
  assert.doesNotMatch(context.promptText, /不得|资料范围|时间边界|证据/);
  assert.doesNotMatch(context.promptText, /行运落宫：/);
});

test('星盘完整输出版显示完整行运资料摘要', () => {
  const context = buildAstrolabeScopeContext(astrolabeData, 'full', '2028-06-01');

  assert.equal(context.scope, 'full');
  assert.equal(context.displayText, '本命盘与完整行运资料');
  assert.equal(context.dateStr, '');
  assert.match(context.promptText, /分析对象：本命盘与完整行运资料。/);
  assert.match(context.promptText, /本命宫主星：第1宫/);
});

test('星盘流年分析对象会生成行运证据和展示文本', () => {
  const context = buildAstrolabeScopeContext(astrolabeData, 'yearly', '2028');

  assert.equal(context.displayText, '流年 · 2028');
  assert.equal(context.dateStr, '2028');
  assert.match(context.promptText, /分析对象：流年2028。/);
  assert.match(context.promptText, /取样时间：2028-07-01 12:00/);
  assert.match(context.promptText, /本命宫主星：第1宫/);
  assert.match(context.promptText, /主要行运相位：/);
  assert.match(context.promptText, /行运落宫：/);
  assert.match(context.promptText, /太阳返照：/);
  assert.match(context.promptText, /次限推进：/);
  assert.match(context.promptText, /太阳弧：/);
  assert.match(context.promptText, /落本命第\d+宫/);
  assert.match(
    context.promptText,
    /已穷举10个行运星体与24个本命点的240组组合，完整列出(\d+)组命中项/,
  );
  const transitCount = Number(/完整列出(\d+)组命中项/.exec(context.promptText)?.[1]);
  assert.ok(transitCount > 10);
  assert.match(context.promptText, /主要行运相位：[\s\S]*实际夹角.*精确角.*偏差.*采用容许度/);
  assert.doesNotMatch(context.promptText, /紧密等级|中等等级|宽松等级|归一化容许度/);
  assert.doesNotMatch(context.promptText, /计算链|证据汇总|解释限制|时间边界|不得|不代表/);
  assert.equal(context.solarReturnEvidence?.status, 'exact');
  assert.equal(context.secondaryProgressionEvidence?.status, 'calculated');
  assert.equal(context.solarArcEvidence?.status, 'calculated');
  assert.ok((context.solarReturnEvidence?.calculationSteps.length ?? 0) >= 5);
  assert.ok((context.secondaryProgressionEvidence?.calculationSteps.length ?? 0) >= 4);
  assert.ok((context.solarArcEvidence?.calculationSteps.length ?? 0) >= 5);
});

test('太阳返照应返回可复核的求根过程和精度边界', () => {
  const evidence = calculateSolarReturnEvidence(astrolabeData, 2028);

  assert.equal(evidence.status, 'exact');
  assert.match(evidence.dateTime ?? '', /^2028-05-\d{2} \d{2}:\d{2}$/);
  assert.ok((evidence.residualDegrees ?? 1) < 0.001);
  assert.equal(evidence.coarseStepHours, 2);
  assert.equal(evidence.refinementToleranceMinutes, 1);
  assert.ok(evidence.refinementIterations > 0);
  assert.match(evidence.source, /二分法/);
  assert.equal(evidence.timeScale?.utcDateTime.endsWith('Z'), true);
  assert.ok((evidence.timeScale?.julianDayTtApprox ?? 0) > 2400000);
  assert.ok(evidence.limitations.some((item) => item.includes('观测级精度')));
  assert.equal(evidence.key, 'solar-return:2028');
  assert.equal(evidence.calculationSteps.length, 5);
  assert.equal(evidence.limitations.length, evidence.limitationFacts.length);
  assert.equal(evidence.aspectSummaryFact.factKeys.length, evidence.aspectFacts.length);
  assert.equal(evidence.aspects.length, evidence.aspectFacts.length);
  assert.ok(evidence.aspectFacts.length > 8);
  assert.equal(evidence.summaryFact.status, '证据链完整');
  assert.ok(evidence.summaryFact.factKeys.includes(evidence.timeScale?.summaryFact.key ?? ''));
  assert.deepEqual(
    evidence.limitationFacts.map((item) => item.ownerStepKeys),
    [
      [evidence.calculationSteps[1].key, evidence.calculationSteps[2].key],
      [evidence.calculationSteps[2].key],
      [evidence.calculationSteps[4].key],
    ],
  );
  assertAdvancedEvidenceReferences(evidence);
});

test('次限与太阳弧应返回稳定键、计算链、相位事实和限制对象', () => {
  const secondary = calculateSecondaryProgressionEvidence(astrolabeData, 2028);
  const solarArc = calculateSolarArcEvidence(astrolabeData, 2028);

  assert.equal(secondary.key, 'secondary-progression:2028');
  assert.equal(secondary.status, 'calculated');
  assert.equal(secondary.calculationSteps.length, 4);
  assert.equal(secondary.limitations.length, secondary.limitationFacts.length);
  assert.equal(secondary.summaryFact.status, '证据链完整');
  assert.equal(secondary.aspects.length, secondary.aspectFacts.length);
  assert.ok(secondary.aspectFacts.length > 8);
  assert.deepEqual(
    secondary.limitationFacts.map((item) => item.ownerStepKeys),
    [
      [secondary.calculationSteps[1].key],
      [secondary.calculationSteps[2].key],
      [secondary.calculationSteps[3].key],
    ],
  );
  assertAdvancedEvidenceReferences(secondary);

  assert.equal(solarArc.key, 'solar-arc:2028');
  assert.equal(solarArc.status, 'calculated');
  assert.equal(solarArc.calculationSteps.length, 5);
  assert.equal(solarArc.limitations.length, solarArc.limitationFacts.length);
  assert.equal(solarArc.summaryFact.status, '证据链完整');
  assert.equal(solarArc.aspects.length, solarArc.aspectFacts.length);
  assert.ok(solarArc.aspectFacts.length > 6);
  assert.deepEqual(
    solarArc.limitationFacts.map((item) => item.ownerStepKeys),
    [
      [solarArc.calculationSteps[1].key],
      [solarArc.calculationSteps[2].key, solarArc.calculationSteps[3].key],
      [solarArc.calculationSteps[4].key],
    ],
  );
  assertAdvancedEvidenceReferences(solarArc);

  assert.throws(
    () => calculateSecondaryProgressionEvidence(astrolabeData, 2201),
    /目标年份需在 1900-2200/,
  );
  assert.throws(() => calculateSolarArcEvidence(astrolabeData, 1899), /目标年份需在 1900-2200/);
  assert.throws(
    () => calculateSolarReturnEvidence(astrolabeData, 2028.5),
    /目标年份需在 1900-2200/,
  );
});

test('高级时限应忽略派生出生时间污染，并对出生前目标年返回不适用证据', () => {
  const polluted = structuredClone(astrolabeData) as AstrolabeData;
  polluted.birth.standardDateTime = '';
  polluted.birth.dateTime = '';
  polluted.planets = [];
  polluted.angles = [];
  polluted.houses = [];
  assert.deepEqual(
    calculateSolarReturnEvidence(polluted, 2028),
    calculateSolarReturnEvidence(astrolabeData, 2028),
  );
  assert.deepEqual(
    calculateSecondaryProgressionEvidence(polluted, 2028),
    calculateSecondaryProgressionEvidence(astrolabeData, 2028),
  );
  assert.deepEqual(
    calculateSolarArcEvidence(polluted, 2028),
    calculateSolarArcEvidence(astrolabeData, 2028),
  );

  const beforeBirthEvidence = [
    calculateSolarReturnEvidence(astrolabeData, 1990),
    calculateSecondaryProgressionEvidence(astrolabeData, 1990),
    calculateSolarArcEvidence(astrolabeData, 1990),
  ];
  beforeBirthEvidence.forEach((evidence) => {
    assert.equal(evidence.status, 'not-applicable');
    assert.equal(evidence.summaryFact.status, '不适用');
    assertAdvancedEvidenceReferences(evidence);
  });
});

test('星盘流月与流日沿用同一选择器语义并写入对应行运资料', () => {
  const monthContext = buildAstrolabeScopeContext(astrolabeData, 'monthly', '2028-06');
  const dayContext = buildAstrolabeScopeContext(astrolabeData, 'daily', '2028-06-12');

  assert.equal(monthContext.displayText, '流月 · 2028-06');
  assert.equal(dayContext.displayText, '流日 · 2028-06-12');
  assert.match(monthContext.promptText, /分析对象：流月2028-06。/);
  assert.match(dayContext.promptText, /分析对象：流日2028-06-12。/);
  assert.match(monthContext.promptText, /主要行运相位：/);
  assert.match(dayContext.promptText, /主要行运相位：/);
  assert.match(monthContext.promptText, /行运落宫：/);
  assert.match(dayContext.promptText, /行运落宫：/);
  assert.doesNotMatch(`${monthContext.promptText}\n${dayContext.promptText}`, /不得|时间边界|证据/);
});

test('星盘范围日期不存在时不应夹到另一天', () => {
  const invalidDayContext = buildAstrolabeScopeContext(astrolabeData, 'daily', '2028-02-31');
  const invalidMonthContext = buildAstrolabeScopeContext(astrolabeData, 'monthly', '2028-13');

  assert.notEqual(invalidDayContext.dateStr, '2028-02-29');
  assert.notEqual(invalidMonthContext.dateStr, '2028-12');
});

test('星盘行运范围应支持 2100 年以后的有效年份', () => {
  const yearlyContext = buildAstrolabeScopeContext(astrolabeData, 'yearly', '2101');
  const monthlyContext = buildAstrolabeScopeContext(astrolabeData, 'monthly', '2101-02');
  const dailyContext = buildAstrolabeScopeContext(astrolabeData, 'daily', '2101-02-28');

  assert.equal(yearlyContext.dateStr, '2101');
  assert.equal(monthlyContext.dateStr, '2101-02');
  assert.equal(dailyContext.dateStr, '2101-02-28');
});

test('星盘行运取样应使用出生地点在目标日期的历史时区', () => {
  const newYorkData = generateAstrolabe({
    name: '本人',
    gender: '女',
    year: '1995',
    month: '5',
    day: '20',
    hour: '12',
    minute: '30',
    latitude: '40.7128',
    longitude: '-74.006',
    timezone: '-4',
    timeZoneId: 'America/New_York',
    locationName: '纽约',
  });
  const context = buildAstrolabeScopeContext(newYorkData, 'yearly', '2028');

  assert.match(context.promptText, /取样时间：2028-07-01 12:00.*UTC-4/);
  assert.doesNotMatch(context.promptText, /北京时间|UTC\+8/);
});

test('星盘范围入口应忽略本命点和宫头污染，缺少可信来源时失败关闭', () => {
  const polluted = structuredClone(astrolabeData) as AstrolabeData;
  polluted.planets = polluted.planets.map((item) => ({ ...item, longitude: Number.NaN }));
  polluted.angles = polluted.angles.map((item) => ({ ...item, longitude: Number.NaN }));
  polluted.houses = polluted.houses.map((item) => ({ ...item, longitude: Number.NaN }));
  polluted.birth.timezone = -12;

  assert.deepEqual(
    buildAstrolabeScopeContext(polluted, 'daily', '2028-06-12'),
    buildAstrolabeScopeContext(astrolabeData, 'daily', '2028-06-12'),
  );

  const legacy = structuredClone(astrolabeData) as Partial<AstrolabeData>;
  delete legacy.generation;
  assert.throws(
    () => buildAstrolabeScopeContext(legacy as AstrolabeData, 'daily', '2028-06-12'),
    /缺少可信原始出生输入/,
  );
});
