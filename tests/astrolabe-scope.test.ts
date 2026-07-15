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

test('星盘本命分析对象只写入长期结构边界', () => {
  const context = buildAstrolabeScopeContext(astrolabeData, 'natal', '2028-06-01');

  assert.equal(context.displayText, '仅使用本命信息');
  assert.equal(context.dateStr, '');
  assert.match(context.promptText, /分析对象：本命盘。/);
  assert.match(context.promptText, /本命宫主星链条：第1宫/);
  assert.match(context.promptText, /宫主星链条只用于定位议题落点/);
  assert.match(context.promptText, /不得自行指定流年、流月、流日或具体应期/);
  assert.match(context.promptText, /资料范围：以本命盘结构、本命宫主星链条/);
  assert.doesNotMatch(context.promptText, /不包含太阳返照、次限推进、太阳弧/);
  assert.doesNotMatch(context.promptText, /行运落宫提示：/);
});

test('星盘完整输出版显示完整行运资料摘要', () => {
  const context = buildAstrolabeScopeContext(astrolabeData, 'full', '2028-06-01');

  assert.equal(context.scope, 'full');
  assert.equal(context.displayText, '本命盘与完整行运资料');
  assert.equal(context.dateStr, '');
  assert.match(context.promptText, /分析对象：本命盘与完整行运资料。/);
  assert.match(context.promptText, /本命宫主星链条：第1宫/);
});

test('星盘流年分析对象会生成行运证据和展示文本', () => {
  const context = buildAstrolabeScopeContext(astrolabeData, 'yearly', '2028');

  assert.equal(context.displayText, '流年 · 2028');
  assert.equal(context.dateStr, '2028');
  assert.match(context.promptText, /分析对象：流年2028。/);
  assert.match(context.promptText, /取样时间：2028-07-01 12:00/);
  assert.match(context.promptText, /本命宫主星链条：第1宫/);
  assert.match(context.promptText, /行运证据：/);
  assert.match(context.promptText, /行运落宫提示：/);
  assert.match(context.promptText, /太阳返照证据：/);
  assert.match(context.promptText, /搜索方法：粗搜步长2小时、二分细化至1分钟内/);
  assert.match(context.promptText, /太阳黄经残差\d+\.\d{4}°/);
  assert.match(context.promptText, /天文时间尺度：当地钟表时间/);
  assert.match(context.promptText, /JD\(UTC\)=/);
  assert.match(context.promptText, /ΔT≈/);
  assert.match(context.promptText, /不代表底层星历达到观测级精度/);
  assert.match(context.promptText, /次限证据（一岁一日）：/);
  assert.match(context.promptText, /太阳弧证据：/);
  assert.match(context.promptText, /落本命第\d+宫/);
  assert.doesNotMatch(context.promptText, /不包含太阳返照、次限推进、太阳弧/);
  assert.doesNotMatch(context.promptText, /未计算|技术限制|当前项目/);
  assert.match(context.promptText, /时间边界：本命盘只定长期结构/);
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
  assert.ok(
    [...evidence.calculationSteps, ...evidence.aspectFacts, ...evidence.limitationFacts].every(
      (item) => item.sources.length > 0 && item.limitation.length > 0,
    ),
  );
  assertPromptIsPortableTaskText(evidence.promptText);
});

test('次限与太阳弧应返回稳定键、计算链、相位事实和限制对象', () => {
  const secondary = calculateSecondaryProgressionEvidence(astrolabeData, 2028);
  const solarArc = calculateSolarArcEvidence(astrolabeData, 2028);

  assert.equal(secondary.key, 'secondary-progression:2028');
  assert.equal(secondary.status, 'calculated');
  assert.equal(secondary.calculationSteps.length, 4);
  assert.equal(secondary.limitations.length, secondary.limitationFacts.length);
  assert.ok(secondary.aspectFacts.every((item) => item.ownerStepKeys.length > 0));
  assertPromptIsPortableTaskText(secondary.promptText);

  assert.equal(solarArc.key, 'solar-arc:2028');
  assert.equal(solarArc.status, 'calculated');
  assert.equal(solarArc.calculationSteps.length, 5);
  assert.equal(solarArc.limitations.length, solarArc.limitationFacts.length);
  assert.ok(solarArc.aspectFacts.every((item) => item.ownerStepKeys.length > 0));
  assertPromptIsPortableTaskText(solarArc.promptText);

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

test('星盘流月与流日沿用同一选择器语义并写明应期层级', () => {
  const monthContext = buildAstrolabeScopeContext(astrolabeData, 'monthly', '2028-06');
  const dayContext = buildAstrolabeScopeContext(astrolabeData, 'daily', '2028-06-12');

  assert.equal(monthContext.displayText, '流月 · 2028-06');
  assert.equal(dayContext.displayText, '流日 · 2028-06-12');
  assert.match(monthContext.promptText, /分析对象：流月2028-06。/);
  assert.match(dayContext.promptText, /分析对象：流日2028-06-12。/);
  assert.match(monthContext.promptText, /行运落宫提示：/);
  assert.match(dayContext.promptText, /行运落宫提示：/);
  assert.match(monthContext.promptText, /所选流年、流月或流日只作为当前阶段触发与应期参考/);
  assert.match(dayContext.promptText, /不能把没有行运证据支持的年份、月份或日期硬说成确定应期/);
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
  assert.match(context.promptText, /行运落宫提示：/);
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

  assert.match(context.promptText, /行运落宫提示：本命宫头资料不足/);
  assert.doesNotThrow(() => buildAstrolabeScopeContext(incompleteData, 'daily', '2028-06-12'));
});
