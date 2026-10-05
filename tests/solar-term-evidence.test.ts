import assert from 'node:assert/strict';
import test from 'node:test';

import { getYearMonthsGanZhi } from '@core/bazi/calendarTool';
import { calculateSeasonInfoFromDate } from '@core/bazi/baziCalculatorTime';
import { getJieQiPhaseByDate } from '@core/divination/algorithms/qimen/helpers/seasonality';
import {
  calculateSolarTermEvidence,
  calculateSolarTermsForYear,
  findCivilSolarTermEvidence,
  findSolarTermEvidence,
} from 'mingyu-core/calendar';

test('节气证据保留历表边界、结构化链路与各自UTC瞬时的独立残差', () => {
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
  // 独立数学定值：NOAA官方main.js的太阳视黄经公式按50位精度重算。
  // https://gml.noaa.gov/grad/solcalc/main.js
  // 固定UTC只定位数学核验输入，不作为外部交节时刻或观测精度金标。
  // 现模型附加的极小平近点角三次项与NOAA式在这些输入相差小于3e-10°。
  const cases = [
    {
      index: 3,
      adoptedUtc: '2024-02-04T08:27:07.000Z',
      modelUtc: '2024-02-04T08:21:25.000Z',
      adoptedResidual: 0.004005702071726603,
      modelResidual: 0.000009208280540663296,
    },
    {
      index: 6,
      adoptedUtc: '2024-03-20T03:06:25.000Z',
      modelUtc: '2024-03-20T03:04:17.000Z',
      adoptedResidual: 0.0014759315585743938,
      modelResidual: 0.000003813763612657926,
    },
    {
      index: 12,
      adoptedUtc: '2024-06-20T20:51:00.000Z',
      modelUtc: '2024-06-20T20:49:29.000Z',
      adoptedResidual: 0.001011429545935472,
      modelResidual: 0.000006338199408903046,
    },
    {
      index: 18,
      adoptedUtc: '2024-09-22T12:43:42.000Z',
      modelUtc: '2024-09-22T12:37:16.000Z',
      adoptedResidual: 0.004374823784849924,
      modelResidual: 0.000003404874123517093,
    },
  ];
  for (const row of cases) {
    const current = row.index === 3 ? evidence : calculateSolarTermEvidence(2024, row.index);
    const adopted = current.calculationSteps[1].result;
    const root = current.calculationSteps[2].result;
    assert.equal(current.utcDateTime, row.adoptedUtc);
    assert.equal(adopted.utcDateTime, row.adoptedUtc);
    assert.equal(adopted.utcTimestamp, current.utcTimestamp);
    assert.equal(adopted.solarLongitudeDegrees, current.solarLongitudeDegrees);
    assert.equal(adopted.residualDegrees, current.residualDegrees);
    assert.ok(Math.abs(current.residualDegrees - row.adoptedResidual) < 1e-8, current.name);
    assert.equal(root.modelRootUtcDateTime, row.modelUtc);
    assert.equal(root.modelRootUtcDateTime, current.modelRootUtcDateTime);
    assert.ok(
      Math.abs(Number(root.residualDegrees) - row.modelResidual) < 1e-8,
      `${current.name}模型根残差`,
    );
    assert.notEqual(root.residualDegrees, adopted.residualDegrees);
  }
});

test('多历元节气日期基准与全年二十四节气次序应通过核验', () => {
  const annualTerms = calculateSolarTermsForYear(2024);
  assert.equal(annualTerms.length, 24);
  assert.deepEqual(
    annualTerms.slice(0, 4).map((item) => item.name),
    ['小寒', '大寒', '立春', '雨水'],
  );
  assert.deepEqual(
    annualTerms.slice(0, 4).map((item) => item.targetLongitudeDegrees),
    [285, 300, 315, 330],
  );
  assert.deepEqual(
    annualTerms.slice(0, 4).map((item) => item.isJie),
    [true, false, true, false],
  );
  assert.equal(annualTerms.at(-1)?.name, '冬至');
  assert.match(annualTerms.at(-1)?.utcDateTime ?? '', /^2024-12/);

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
  const instant = new Date('2024-02-10T04:00:00.000Z');
  const baziSeason = calculateSeasonInfoFromDate(instant);
  const qimenPhase = getJieQiPhaseByDate(instant);

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

test('民用2200年末只读取编号2201的冬至，公共节气年份契约保持不变', () => {
  const winter = findCivilSolarTermEvidence('冬至', 2201);
  assert.equal(winter.name, '冬至');
  assert.equal(winter.index, 0);
  assert.equal(winter.targetLongitudeDegrees, 270);
  assert.match(winter.utcDateTime, /^2200-12-/);
  assert.equal(winter.utcTimestamp, Date.parse(winter.seedUtcDateTime));
  assert.equal(winter.status, '历表已采用并独立核验');
  assert.ok(winter.refinementIterations > 0);
  assert.equal(winter.verificationFact.adoptedStepKey, winter.calculationSteps[1].key);
  const phase = getJieQiPhaseByDate(new Date('2201-01-01T11:59:59Z'), -720);
  assert.equal(phase.jieQi, '冬至');
  assert.deepEqual(phase.solarTermEvidence, winter);
  assert.deepEqual(findCivilSolarTermEvidence('冬至', 2025), calculateSolarTermEvidence(2025, 0));
  for (const name of ['小寒', '立春', '大雪'] as const) {
    assert.throws(() => findCivilSolarTermEvidence(name, 2201), /1900-2200/);
  }
  assert.throws(() => findCivilSolarTermEvidence('冬至', 2202), /1900-2200/);
  assert.throws(() => findCivilSolarTermEvidence('冬至', Number.NaN), /1900-2200/);
  assert.throws(() => calculateSolarTermEvidence(2201, 0), /1900-2200/);
  assert.throws(() => findSolarTermEvidence('冬至', 2201), /1900-2200/);
  assert.throws(() => calculateSolarTermsForYear(2200), /1900-2199/);
});
