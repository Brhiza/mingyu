import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveZiweiTrueSolarBirth } from 'mingyu-core/ziwei/true-solar-input';
import { buildZiweiChartInput } from '../src/lib/full-chart-engine/ziwei';
import { calculateEquationOfTimeMinutes, calculateTrueSolarTime } from '@core/bazi/trueSolarTime';
import { getTimeIndexFromClock } from 'mingyu-core/calendar';

test('紫微真太阳时排盘应改用修正后的公历日期与时辰', () => {
  const corrected = calculateTrueSolarTime(
    {
      year: 1990,
      month: 4,
      day: 15,
      hour: 1,
      minute: 20,
    },
    73.5,
  ).correctedTime;

  const result = resolveZiweiTrueSolarBirth({
    dateType: 'solar',
    year: '1990',
    month: '04',
    day: '15',
    isLeapMonth: false,
    birthHour: '1',
    birthMinute: '20',
    birthLongitude: '73.5',
  });

  assert.equal(
    result.birthDate,
    `${corrected.year}-${String(corrected.month).padStart(2, '0')}-${String(corrected.day).padStart(2, '0')}`,
  );
  assert.equal(result.birthTimeIndex, getTimeIndexFromClock(corrected.hour, corrected.minute));
  assert.equal(result.trueSolarEvidence.summaryFact.status, '证据链完整');
  assert.equal(
    result.trueSolarEvidence.calculationChain.length,
    result.trueSolarEvidence.calculationSteps.length,
  );
  assert.match(result.trueSolarEvidence.promptText, /证据汇总：/);
});

test('紫微农历输入启用真太阳时跨日时应改用校正后的公历日期排盘', () => {
  const corrected = calculateTrueSolarTime(
    {
      year: 2020,
      month: 8,
      day: 1,
      hour: 0,
      minute: 40,
    },
    75.98,
  ).correctedTime;
  const input = buildZiweiChartInput({
    name: '测试',
    gender: 'male',
    dateType: 'lunar',
    year: '2020',
    month: '6',
    day: '12',
    timeIndex: '',
    isLeapMonth: false,
    useTrueSolarTime: true,
    birthHour: '0',
    birthMinute: '40',
    birthLongitude: '75.98',
  });

  assert.equal(input.dateType, 'solar');
  assert.equal(
    input.birthDate,
    `${corrected.year}-${String(corrected.month).padStart(2, '0')}-${String(corrected.day).padStart(2, '0')}`,
  );
  assert.equal(input.birthTimeIndex, getTimeIndexFromClock(corrected.hour, corrected.minute));
});

test('紫微农历闰月输入启用真太阳时时应转为公历并清除闰月标记', () => {
  const corrected = calculateTrueSolarTime(
    {
      year: 2023,
      month: 3,
      day: 25,
      hour: 9,
      minute: 0,
    },
    120,
  ).correctedTime;
  const input = buildZiweiChartInput({
    name: '测试',
    gender: 'female',
    dateType: 'lunar',
    year: '2023',
    month: '2',
    day: '4',
    timeIndex: '',
    isLeapMonth: true,
    useTrueSolarTime: true,
    birthHour: '9',
    birthMinute: '0',
    birthLongitude: '120',
  });

  assert.equal(input.dateType, 'solar');
  assert.equal(
    input.birthDate,
    `${corrected.year}-${String(corrected.month).padStart(2, '0')}-${String(corrected.day).padStart(2, '0')}`,
  );
  assert.equal(input.birthTimeIndex, getTimeIndexFromClock(corrected.hour, corrected.minute));
  assert.equal(input.isLeapMonth, false);
});

test('紫微真太阳时缺少经度时应直接报错', () => {
  assert.throws(
    () =>
      resolveZiweiTrueSolarBirth({
        dateType: 'solar',
        year: '1990',
        month: '04',
        day: '15',
        isLeapMonth: false,
        birthHour: '1',
        birthMinute: '20',
        birthLongitude: '',
      }),
    /真太阳时缺少精准时间或经度/,
  );
});

test('紫微真太阳时应先拒绝无效出生日期和时空参数', () => {
  const baseInput = {
    dateType: 'solar' as const,
    year: '1990',
    month: '04',
    day: '15',
    isLeapMonth: false,
    birthHour: '1',
    birthMinute: '20',
    birthLongitude: '73.5',
  };
  const invalidCases: Array<[Partial<typeof baseInput>, RegExp]> = [
    [{ year: '0000' }, /出生年份需在 1900-2100 之间/],
    [{ year: '9999' }, /出生年份需在 1900-2100 之间/],
    [{ month: '13' }, /出生月份需在 1-12 之间/],
    [{ day: '31', month: '02' }, /日期需在 1-28 之间/],
    [{ birthHour: '24' }, /出生小时需在 0-23 之间/],
    [{ birthMinute: '60' }, /出生分钟需在 0-59 之间/],
    [{ birthLongitude: '181' }, /出生经度需在 -180 到 180 之间/],
  ];

  for (const [overrides, messagePattern] of invalidCases) {
    assert.throws(() => resolveZiweiTrueSolarBirth({ ...baseInput, ...overrides }), messagePattern);
  }
});

test('真太阳时计算应拒绝无效日期和时空参数', () => {
  const baseTime = {
    year: 2026,
    month: 2,
    day: 28,
    hour: 1,
    minute: 20,
  };
  const invalidCases: Array<[Parameters<typeof calculateTrueSolarTime>[0], number, RegExp]> = [
    [{ ...baseTime, year: 1899 }, 73.5, /年份需在 1900-2100 之间/],
    [{ ...baseTime, month: 13 }, 73.5, /月份需在 1-12 之间/],
    [{ ...baseTime, day: 31 }, 73.5, /日期需在 1-28 之间/],
    [{ ...baseTime, hour: 24 }, 73.5, /小时需在 0-23 之间/],
    [{ ...baseTime, minute: 60 }, 73.5, /分钟需在 0-59 之间/],
    [baseTime, 181, /经度需在 -180 到 180 之间/],
  ];

  for (const [standardTime, longitude, messagePattern] of invalidCases) {
    assert.throws(() => calculateTrueSolarTime(standardTime, longitude), messagePattern);
  }
});

test('均时差计算应拒绝无效日期', () => {
  assert.throws(() => calculateEquationOfTimeMinutes(2026, 2, 31), /日期需在 1-28 之间/);
});
