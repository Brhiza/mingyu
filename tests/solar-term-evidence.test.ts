import assert from 'node:assert/strict';
import test from 'node:test';

import { getYearMonthsGanZhi } from '@core/bazi/calendarTool';
import { calculateLiuyue, calculateSeasonInfo } from '@core/bazi/baziCalculatorTime';
import { getMeihuaSeasonByJieQi } from '@core/divination/algorithms/meihua/helpers/analysis';
import { getSolarTermContextByDate } from '@core/divination/algorithms/qimen/helpers/seasonality';
import { calculateSolarTermEvidence, calculateSolarTermsForYear } from 'mingyu-core/calendar';
import { SolarTime } from 'tyme4ts';
import { assertPromptIsPortableTaskText } from './prompt-assertions';

test('节气证据应采用历表边界并保留太阳视黄经独立核验', () => {
  const evidence = calculateSolarTermEvidence(2024, 3);

  assert.equal(evidence.name, '立春');
  assert.equal(evidence.isJie, true);
  assert.equal(evidence.targetLongitudeDegrees, 315);
  assert.equal(evidence.utcDateTime, '2024-02-04T08:27:07.000Z');
  assert.ok(Math.abs(evidence.seedDifferenceSeconds) < 10 * 60);
  assert.ok(evidence.residualDegrees < 0.01);
  assert.ok(evidence.refinementIterations > 0);
  assert.match(evidence.promptText, /排盘采用 tyme4ts 历表/);
  assert.match(evidence.promptText, /独立模型求根/);
  assert.match(evidence.promptText, /不等于观测级一秒精度/);
  assert.equal(evidence.key, 'solar-term:2024:3:立春');
  assert.equal(evidence.status, '历表已采用并独立核验');
  assert.deepEqual(
    evidence.calculationSteps.map((item) => item.stage),
    ['目标黄经', '历表时刻', '独立求根', '差值核验'],
  );
  assert.deepEqual(
    evidence.calculationChain,
    evidence.calculationSteps.map((item) => item.promptText),
  );
  assert.equal(evidence.calculationSteps[0].result.isJie, true);
  assert.deepEqual(evidence.calculationSteps[3].dependsOnStepKeys, [
    evidence.calculationSteps[1].key,
    evidence.calculationSteps[2].key,
  ]);
  assert.equal(evidence.verificationFact.adoptedStepKey, evidence.calculationSteps[1].key);
  assert.equal(evidence.verificationFact.modelStepKey, evidence.calculationSteps[2].key);
  assert.equal(evidence.limitations.length, evidence.limitationFacts.length);
  assert.equal(evidence.summaryFact.calculationStepCount, evidence.calculationSteps.length);
  assert.equal(evidence.summaryFact.verificationFactCount, 1);
  assert.equal(evidence.summaryFact.limitationFactCount, evidence.limitationFacts.length);
  assert.deepEqual(evidence.summaryFact.factKeys, [
    ...evidence.calculationSteps.map((item) => item.key),
    evidence.verificationFact.key,
    ...evidence.limitationFacts.map((item) => item.key),
  ]);
  const factKeys = new Set(evidence.summaryFact.factKeys);
  const stepKeys = new Set(evidence.calculationSteps.map((item) => item.key));
  assert.ok(
    evidence.limitationFacts.every(
      (item) =>
        item.ownerFactKeys.length > 0 &&
        item.ownerFactKeys.every((key) => factKeys.has(key)) &&
        item.ownerStepKeys.length > 0 &&
        item.ownerStepKeys.every((key) => stepKeys.has(key)),
    ),
  );
  assert.match(evidence.promptText, /证据汇总：/);
  assert.ok(
    [
      ...evidence.calculationSteps,
      evidence.verificationFact,
      evidence.summaryFact,
      ...evidence.limitationFacts,
    ].every((item) => item.sources.length > 0 && item.limitation.length > 0),
  );
  assertPromptIsPortableTaskText(evidence.promptText);
});

test('全年二十四节气应保持名称、黄经和节气属性顺序', () => {
  const terms = calculateSolarTermsForYear(2024);

  assert.equal(terms.length, 24);
  assert.deepEqual(
    terms.slice(0, 4).map((item) => item.name),
    ['小寒', '大寒', '立春', '雨水'],
  );
  assert.deepEqual(
    terms.slice(0, 4).map((item) => item.targetLongitudeDegrees),
    [285, 300, 315, 330],
  );
  assert.deepEqual(
    terms.slice(0, 4).map((item) => item.isJie),
    [true, false, true, false],
  );
  assert.equal(terms.at(-1)?.name, '冬至');
  assert.match(terms.at(-1)?.utcDateTime ?? '', /^2024-12/);
});

test('1900至2100年全部流月应取得完整交节边界，不再回退到月初或月中', () => {
  for (let year = 1900; year <= 2100; year++) {
    for (let month = 1; month <= 12; month++) {
      const result = calculateLiuyue(year, month, '甲');
      assert.match(result.startDateTime, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
      assert.match(result.endDateTime, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
      assert.ok(result.startTermName.length > 0);
      assert.ok(result.endTermName.length > 0);
      assert.equal(result.jieqi.filter((item) => item.name === result.startTermName).length, 1);
    }
  }
});

test('梅花二十四节气应全部映射四时，未知节气直接拒绝', () => {
  const terms = calculateSolarTermsForYear(2024);
  const seasons = terms.map((item) => getMeihuaSeasonByJieQi(item.name));

  assert.equal(seasons.length, 24);
  assert.ok(seasons.every((season) => ['春', '夏', '秋', '冬'].includes(season)));
  assert.throws(() => getMeihuaSeasonByJieQi('假节气'), /无法识别梅花易数节气/);
});

test('八字节令月应携带起止交节的结构化证据', () => {
  const firstMonth = getYearMonthsGanZhi(2024)[0];

  assert.equal(firstMonth.startTermName, '立春');
  assert.equal(firstMonth.startTermEvidence?.utcDateTime, '2024-02-04T08:27:07.000Z');
  assert.equal(firstMonth.endTermName, '惊蛰');
  assert.equal(firstMonth.endTermEvidence?.name, '惊蛰');
  assert.match(firstMonth.startTermEvidence?.source ?? '', /太阳视黄经/);
});

test('八字本命节令与奇门节令背景应复用同一节气证据', () => {
  const baziSeason = calculateSeasonInfo(SolarTime.fromYmdHms(2024, 2, 10, 12, 0, 0));
  const qimenTerm = getSolarTermContextByDate(new Date(2024, 1, 10, 12, 0, 0));

  assert.equal(baziSeason.currentJieqi, '立春');
  assert.equal(baziSeason.previousTermEvidence?.name, '立春');
  assert.equal(qimenTerm.jieQi, '立春');
  assert.equal(
    qimenTerm.solarTermEvidence.utcDateTime,
    baziSeason.previousTermEvidence?.utcDateTime,
  );
});

test('节气证据应拒绝越界年份和索引', () => {
  assert.throws(() => calculateSolarTermEvidence(1899, 3), /1900-2200/);
  assert.throws(() => calculateSolarTermEvidence(2024, 24), /0-23/);
});
