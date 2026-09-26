import test from 'node:test';
import assert from 'node:assert/strict';

import { baziCalculator } from '../packages/core/src/bazi/baziCalculator.ts';
import { buildEnhancedLuckChronicleSection } from '../packages/core/src/minglu/bazi-enhancer.ts';

test('立春前跨公历年交运，前后两运均保留交运节令年的实际区间', () => {
  const result = baziCalculator.calculateBazi({
    gender: 'male',
    year: 1990,
    month: 2,
    day: 10,
    timeIndex: 6,
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });
  const chronicle = buildEnhancedLuckChronicleSection(result);
  const child = chronicle.cycles.find((cycle) => cycle.isXiaoyun)!;
  const firstDayun = chronicle.cycles.find((cycle) => !cycle.isXiaoyun)!;
  const childYear = child.annualYears.find((year) => year.year === 1997)!;
  const dayunYear = firstDayun.annualYears.find((year) => year.year === 1997)!;

  assert.equal(chronicle.startYear, 1998);
  assert.equal(firstDayun.startYear, 1997);
  assert.equal(firstDayun.startDateTime, '1998-01-01 02:36:00');
  assert.equal(child.endDateTime, firstDayun.startDateTime);
  assert.equal(childYear.endDateTime, firstDayun.startDateTime);
  assert.equal(dayunYear.startDateTime, firstDayun.startDateTime);
  assert.equal(childYear.months.at(-1)?.endDateTime, firstDayun.startDateTime);
  assert.equal(dayunYear.months[0]?.startDateTime, firstDayun.startDateTime);
  assert.equal(childYear.xiaoyun?.ganZhi, result.luckInfo.cycles[0]?.years.at(-1)?.xiaoyun?.ganZhi);
  assert.deepEqual(dayunYear.taiSuiShensha, []);
});

test('立春前出生的童限从实际出生时刻起，保留上一节令年', () => {
  const result = baziCalculator.calculateBazi({
    gender: 'male',
    year: 1990,
    month: 1,
    day: 15,
    timeIndex: 6,
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });
  const child = buildEnhancedLuckChronicleSection(result).cycles.find((cycle) => cycle.isXiaoyun)!;
  const firstYear = child.annualYears[0]!;

  assert.equal(child.startYear, 1989);
  assert.equal(firstYear.year, 1989);
  assert.equal(firstYear.age, 1);
  assert.equal(firstYear.startDateTime, child.startDateTime);
  assert.equal(firstYear.months[0]?.startDateTime, child.startDateTime);
  assert.equal(firstYear.xiaoyun?.ganZhi, result.luckInfo.cycles[0]?.years[0]?.xiaoyun?.ganZhi);
});

test('不足十年的童限在交运当月截止，后运从同一秒接续', () => {
  const result = baziCalculator.calculateBazi({
    gender: 'female',
    year: 2012,
    month: 12,
    day: 21,
    timeIndex: 3,
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });
  const chronicle = buildEnhancedLuckChronicleSection(result);
  const child = chronicle.cycles.find((cycle) => cycle.isXiaoyun)!;
  const dayun = chronicle.cycles.find((cycle) => !cycle.isXiaoyun)!;
  const childYear = child.annualYears.at(-1)!;
  const dayunYear = dayun.annualYears[0]!;

  assert.ok(child.annualYears.length < 10);
  assert.equal(child.careerAdvice, '');
  assert.equal(dayun.startDateTime, '2017-09-13 16:08:00');
  assert.equal(child.endDateTime, dayun.startDateTime);
  assert.equal(childYear.year, 2017);
  assert.equal(dayunYear.year, 2017);
  assert.equal(childYear.endDateTime, dayunYear.startDateTime);
  assert.equal(childYear.months.at(-1)?.monthIndex, dayunYear.months[0]?.monthIndex);
  assert.equal(childYear.months.at(-1)?.endDateTime, dayunYear.months[0]?.startDateTime);
  assert.equal(child.endYear, childYear.year);
  assert.equal(child.endAge, childYear.age);
  assert.equal(dayun.startYear, dayunYear.year);
  assert.equal(dayun.startAge, dayunYear.age);
});

test('远期大运逐年仍使用真实节令月边界，月数随实际区间变化', () => {
  const result = baziCalculator.calculateBazi({
    gender: 'male',
    year: 2000,
    month: 5,
    day: 15,
    timeIndex: 5,
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });
  const chronicle = buildEnhancedLuckChronicleSection(result);
  const futureCycle = chronicle.cycles.find((cycle) => cycle.startYear > 2100)!;
  const futureYear = futureCycle.annualYears[0]!;

  assert.ok(futureYear.months.length > 0);
  assert.ok(futureYear.months.length <= 12);
  assert.equal(futureYear.startDateTime, futureYear.months[0]?.startDateTime);
  assert.ok(futureYear.months.every((month) => month.endDateTime <= futureYear.endDateTime));
  assert.ok(futureYear.months.every((month) => month.startDateTime < month.endDateTime));
});
