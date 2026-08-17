import assert from 'node:assert/strict';
import test from 'node:test';

import { getYearMonthsGanZhi } from '@core/bazi/calendarTool';
import { calculateSeasonInfo } from '@core/bazi/baziCalculatorTime';
import { getJieQiPhaseByDate } from '@core/divination/algorithms/qimen/helpers/seasonality';
import { calculateSolarTermEvidence, calculateSolarTermsForYear } from 'mingyu-core/calendar';
import { SolarTime } from 'tyme4ts';

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

test('唯一采用的 tyme4ts 节气日期应通过香港天文台多历元基准核验', () => {
  // 基准来源：https://www.hko.gov.hk/tc/gts/time/calendar/text/files/T{year}c.txt
  const expectedDates = {
    1901: { 立春: '02-04', 春分: '03-21', 夏至: '06-22', 秋分: '09-24', 冬至: '12-22' },
    1950: { 立春: '02-04', 春分: '03-21', 夏至: '06-22', 秋分: '09-23', 冬至: '12-22' },
    2000: { 立春: '02-04', 春分: '03-20', 夏至: '06-21', 秋分: '09-23', 冬至: '12-21' },
    2026: { 立春: '02-04', 春分: '03-20', 夏至: '06-21', 秋分: '09-23', 冬至: '12-22' },
    2100: { 立春: '02-04', 春分: '03-20', 夏至: '06-21', 秋分: '09-23', 冬至: '12-22' },
  } as const;
  const hongKongDate = (utcDateTime: string) => {
    const parts = new Intl.DateTimeFormat('en', {
      timeZone: 'Asia/Hong_Kong',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(utcDateTime));
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  };

  for (const [yearText, expectedTerms] of Object.entries(expectedDates)) {
    const year = Number(yearText);
    const terms = calculateSolarTermsForYear(year);

    for (const [name, monthDay] of Object.entries(expectedTerms)) {
      const term = terms.find((item) => item.name === name);
      assert.ok(term, `${year} 年应包含${name}`);
      assert.equal(hongKongDate(term.utcDateTime), `${year}-${monthDay}`, `${year} 年${name}`);
    }
  }
});

test('八字节令月应携带起止交节的结构化证据', () => {
  const firstMonth = getYearMonthsGanZhi(2024)[0];

  assert.equal(firstMonth.startTermName, '立春');
  assert.equal(firstMonth.startTermEvidence?.utcDateTime, '2024-02-04T08:27:07.000Z');
  assert.equal(firstMonth.endTermName, '惊蛰');
  assert.equal(firstMonth.endTermEvidence?.name, '惊蛰');
  assert.match(firstMonth.startTermEvidence?.source ?? '', /太阳视黄经/);
});

test('八字本命节令与奇门节令阶段应复用同一节气证据', () => {
  const baziSeason = calculateSeasonInfo(SolarTime.fromYmdHms(2024, 2, 10, 12, 0, 0));
  const qimenPhase = getJieQiPhaseByDate(new Date(2024, 1, 10, 12, 0, 0));

  assert.equal(baziSeason.currentJieqi, '立春');
  assert.equal(baziSeason.previousTermEvidence?.name, '立春');
  assert.equal(qimenPhase.jieQi, '立春');
  assert.equal(
    qimenPhase.solarTermEvidence.utcDateTime,
    baziSeason.previousTermEvidence?.utcDateTime,
  );
});

test('节气证据应拒绝越界年份和索引', () => {
  assert.throws(() => calculateSolarTermEvidence(1899, 3), /1900-2200/);
  assert.throws(() => calculateSolarTermEvidence(2024, 24), /0-23/);
});
