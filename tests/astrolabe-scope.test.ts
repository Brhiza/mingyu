import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAstrolabeFullScopeContexts,
  buildAstrolabeScopeContext,
  calculateSecondaryProgressionEvidence,
  calculateSolarArcEvidence,
  calculateSolarReturnEvidence,
} from 'mingyu-core/divination/astrolabe-scope';
import { generateAstrolabe } from 'mingyu-core/divination/astrolabe';
import type { AstrolabeData } from 'mingyu-core/types';

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
        item.ownerFactKeys.join('|') === item.ownerStepKeys.join('|'),
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
}

test('星盘本命分析对象只写入本命资料', () => {
  const context = buildAstrolabeScopeContext(astrolabeData, 'natal', '2028-06-01');

  assert.equal(context.displayText, '仅使用本命信息');
  assert.equal(context.dateStr, '');
  assert.match(context.promptText, /分析对象：本命盘。/);
  assert.doesNotMatch(context.promptText, /宫主星落宫/);
  assert.doesNotMatch(context.promptText, /不得|资料范围|时间边界|证据/);
  assert.doesNotMatch(context.promptText, /行运落宫：/);
});

test('星盘完整输出版显示完整行运资料摘要', () => {
  const context = buildAstrolabeScopeContext(astrolabeData, 'full', '2028-06-01');

  assert.equal(context.scope, 'full');
  assert.equal(context.displayText, '本命盘与完整行运资料 · 2028-06-01');
  assert.equal(context.dateStr, '2028-06-01');
  assert.match(context.promptText, /以2028-06-01为基准的完整行运资料/);
  assert.doesNotMatch(context.promptText, /宫主星落宫/);

  const contexts = buildAstrolabeFullScopeContexts(astrolabeData, '2028-06-01');
  assert.equal(contexts.yearly.dateStr, '2028');
  assert.equal(contexts.monthly.dateStr, '2028-06');
  assert.equal(contexts.daily.dateStr, '2028-06-01');
});

test('星盘流年分析对象会生成行运证据和展示文本', () => {
  const context = buildAstrolabeScopeContext(astrolabeData, 'yearly', '2028');

  assert.equal(context.displayText, '流年 · 2028');
  assert.equal(context.dateStr, '2028');
  assert.match(context.promptText, /分析对象：流年2028。/);
  assert.doesNotMatch(context.promptText, /宫主星落宫/);
  assert.match(context.promptText, /行运取样：2028-07-01 12:00（UTC\+8）/);
  assert.match(context.promptText, /主要行运相位：/);
  assert.match(context.promptText, /行运落宫：/);
  assert.match(context.promptText, /太阳返照（.+）：/);
  assert.match(context.promptText, /次限相位：/);
  assert.match(context.promptText, /太阳弧相位：/);
  assert.match(context.promptText, /落本命第\d+宫/);
  assert.doesNotMatch(context.promptText, /次限推进：|太阳弧：\d|行运基准：/);
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

test('高级时限不可用与出生前目标年应返回可追溯的缺口或不适用证据', () => {
  const incomplete = structuredClone(astrolabeData) as AstrolabeData;
  incomplete.birth.standardDateTime = '';
  incomplete.birth.dateTime = '';

  const unavailableEvidence = [
    calculateSolarReturnEvidence(incomplete, 2028),
    calculateSecondaryProgressionEvidence(incomplete, 2028),
    calculateSolarArcEvidence(incomplete, 2028),
  ];
  unavailableEvidence.forEach((evidence) => {
    assert.equal(evidence.status, 'unavailable');
    assert.equal(evidence.summaryFact.status, '证据链有缺口');
    assertAdvancedEvidenceReferences(evidence);
  });

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

test('星盘行运范围应拒绝缺失、错格式和不存在的日期', () => {
  assert.throws(
    () => buildAstrolabeScopeContext(astrolabeData, 'daily', '2028-02-31'),
    /流日日期无效/,
  );
  assert.throws(
    () => buildAstrolabeScopeContext(astrolabeData, 'monthly', '2028-13'),
    /流月日期无效/,
  );
  assert.throws(() => buildAstrolabeScopeContext(astrolabeData, 'yearly', ''), /流年必须提供 YYYY/);
  assert.throws(
    () => buildAstrolabeScopeContext(astrolabeData, 'monthly', '2028-6'),
    /流月必须提供 YYYY-MM/,
  );
  assert.throws(
    () => buildAstrolabeScopeContext(astrolabeData, 'full', ''),
    /完整输出必须提供 YYYY-MM-DD/,
  );
});

test('星盘行运范围应支持 2100 年以后的有效年份', () => {
  const yearlyContext = buildAstrolabeScopeContext(astrolabeData, 'yearly', '2101');
  const monthlyContext = buildAstrolabeScopeContext(astrolabeData, 'monthly', '2101-02');
  const dailyContext = buildAstrolabeScopeContext(astrolabeData, 'daily', '2101-02-28');

  assert.equal(yearlyContext.dateStr, '2101');
  assert.equal(monthlyContext.dateStr, '2101-02');
  assert.equal(dailyContext.dateStr, '2101-02-28');
});

test('星盘资料缺少经度时应退回保守提示而不是报错', () => {
  const incompleteData = {
    ...astrolabeData,
    planets: astrolabeData.planets.map((item) => ({
      ...item,
      longitude: Number.NaN,
    })),
    angles: astrolabeData.angles.map((item) => ({
      ...item,
      longitude: Number.NaN,
    })),
  } satisfies AstrolabeData;
  const context = buildAstrolabeScopeContext(incompleteData, 'daily', '2028-06-12');

  assert.equal(context.displayText, '流日 · 2028-06-12');
  assert.match(context.promptText, /本命点经度资料不足/);
  assert.match(context.promptText, /行运落宫：/);
  assert.match(context.promptText, /落本命第\d+宫/);
  assert.doesNotThrow(() => buildAstrolabeScopeContext(incompleteData, 'daily', '2028-06-12'));
});

test('星盘资料缺少宫头经度时应禁止行运落宫证据', () => {
  const incompleteData = {
    ...astrolabeData,
    houses: astrolabeData.houses.map((item) => ({
      ...item,
      longitude: Number.NaN,
    })),
  } satisfies AstrolabeData;
  const context = buildAstrolabeScopeContext(incompleteData, 'daily', '2028-06-12');

  assert.match(context.promptText, /行运落宫：本命宫头资料不足/);
  assert.doesNotThrow(() => buildAstrolabeScopeContext(incompleteData, 'daily', '2028-06-12'));
});

test('星盘行运应使用目标日期的出生地时区而不是固定北京时间', () => {
  const newYorkData = generateAstrolabe({
    name: '本人',
    gender: '女',
    year: '1995',
    month: '5',
    day: '20',
    hour: '12',
    minute: '30',
    latitude: '40.7128',
    longitude: '-74.0060',
    timeZoneId: 'America/New_York',
    locationName: '纽约',
  });
  const summer = buildAstrolabeScopeContext(newYorkData, 'daily', '2028-07-12');
  const winter = buildAstrolabeScopeContext(newYorkData, 'daily', '2028-01-12');

  assert.match(summer.promptText, /America\/New_York（UTC-4）/);
  assert.match(summer.promptText, /行运落宫：取样时区UTC-4/);
  assert.match(winter.promptText, /America\/New_York（UTC-5）/);
  assert.match(winter.promptText, /行运落宫：取样时区UTC-5/);
  assert.doesNotMatch(`${summer.promptText}\n${winter.promptText}`, /按北京时间|取样时区UTC\+8/);
});

test('星盘行运缺少真实经纬度时不得静默使用零度坐标', () => {
  const incompleteData = structuredClone(astrolabeData) as AstrolabeData;
  delete incompleteData.birth.latitude;
  delete incompleteData.birth.longitude;
  incompleteData.birth.location = '未知地点';

  assert.throws(
    () => buildAstrolabeScopeContext(incompleteData, 'daily', '2028-06-12'),
    /缺少有效出生地经纬度/,
  );
});
