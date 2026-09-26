import assert from 'node:assert/strict';
import test from 'node:test';
import { buildZiweiFortuneOptions } from '../packages/core/src/ziwei/fortune-options';
import {
  buildAstrolabeFromInput,
  buildHoroscopeFromInput,
  normalizeChartInput,
} from '../packages/core/src/ziwei/iztro/runtime-helpers';

test('紫微春节前出生的流年选项按实际虚岁分界，不漏同公历年的下一岁', async () => {
  const input = normalizeChartInput({
    name: '春节前出生',
    gender: '女',
    dateType: 'solar',
    birthDate: '1992-02-03',
    birthTimeIndex: 4,
  });
  const astrolabe = await buildAstrolabeFromInput(input);
  const options = await buildZiweiFortuneOptions(input, { startAge: 1, endAge: 3 });

  assert.deepEqual(
    options.yearOptions.map(({ age, year, dateStr, ganZhi }) => ({ age, year, dateStr, ganZhi })),
    [
      { age: 1, year: 1992, dateStr: '1992-02-03', ganZhi: '辛未' },
      { age: 2, year: 1992, dateStr: '1992-02-04', ganZhi: '壬申' },
      { age: 3, year: 1993, dateStr: '1993-01-23', ganZhi: '癸酉' },
    ],
  );
  for (const { age, dateStr } of options.yearOptions) {
    const horoscope = await buildHoroscopeFromInput(astrolabe, input, dateStr, 4);
    assert.equal(horoscope.age.nominalAge, age, dateStr);
  }
  assert.equal(options.yearOptions[0]?.endDateStr, '1992-02-03');
  assert.equal(options.yearOptions[1]?.endDateStr, '1993-01-22');
  assert.deepEqual(
    options.monthOptions.map(({ month, dateStr, endDateStr }) => ({ month, dateStr, endDateStr })),
    [{ month: 12, dateStr: '1992-02-03', endDateStr: '1992-02-03' }],
  );
  assert.deepEqual(
    options.dayOptions.map((day) => day.dateStr),
    ['1992-02-03'],
  );
});

test('紫微闰月流月选项覆盖引擎连续月段，流日可跨公历月', async () => {
  const input = normalizeChartInput({
    name: '闰月跨月',
    gender: '女',
    dateType: 'solar',
    birthDate: '1990-05-15',
    birthTimeIndex: 4,
  });
  const options = await buildZiweiFortuneOptions(
    input,
    { startAge: 34, endAge: 34 },
    {
      selectedYearDateStr: '2023-03-22',
      selectedMonthDateStr: '2023-03-22',
    },
  );
  assert.equal(options.effectiveYearDateStr, '2023-01-22');
  assert.equal(options.effectiveMonthDateStr, '2023-02-20');
  const leapMonth = options.monthOptions.find((month) => month.month === 2);
  assert.equal(leapMonth?.dateStr, '2023-02-20');
  assert.equal(leapMonth?.endDateStr, '2023-04-19');
  assert.equal(options.dayOptions.length, 59);
  assert.equal(options.dayOptions[0]?.dateStr, '2023-02-20');
  assert.equal(options.dayOptions.at(-1)?.dateStr, '2023-04-19');
});

test('紫微末段虚岁选项支持 2100 年后的真实日期', async () => {
  const input = normalizeChartInput({
    name: '末段虚岁',
    gender: '女',
    dateType: 'solar',
    birthDate: '1992-08-21',
    birthTimeIndex: 4,
  });
  const options = await buildZiweiFortuneOptions(input, { startAge: 125, endAge: 125 });
  assert.deepEqual(
    options.yearOptions.map(({ age, dateStr, endDateStr }) => ({ age, dateStr, endDateStr })),
    [{ age: 125, dateStr: '2116-02-14', endDateStr: '2117-02-01' }],
  );
  assert.equal(options.monthOptions[0]?.dateStr, '2116-02-14');
});

test('紫微生日分界与节令分年交错时，同虚岁按实际流年分段并裁切流月', async () => {
  const input = normalizeChartInput({
    name: '生日与节令交界',
    gender: '女',
    dateType: 'solar',
    birthDate: '1990-05-15',
    birthTimeIndex: 4,
    ageDivide: 'birthday',
    horoscopeDivide: 'exact',
    yearDivide: 'exact',
  });
  const options = await buildZiweiFortuneOptions(
    input,
    { startAge: 35, endAge: 35 },
    {
      selectedYearDateStr: '2025-02-03',
    },
  );
  assert.deepEqual(
    options.yearOptions.map(({ age, dateStr, endDateStr, ganZhi }) => ({
      age,
      dateStr,
      endDateStr,
      ganZhi,
    })),
    [
      { age: 35, dateStr: '2024-05-28', endDateStr: '2025-02-02', ganZhi: '甲辰' },
      { age: 35, dateStr: '2025-02-03', endDateStr: '2025-05-17', ganZhi: '乙巳' },
    ],
  );
  assert.equal(options.monthOptions[0]?.dateStr, '2025-02-03');
  assert.equal(options.monthOptions[0]?.endDateStr, '2025-02-03');
  assert.equal(options.monthOptions[0]?.label, '上年12月末');
  assert.equal(options.monthOptions[1]?.dateStr, '2025-02-04');
  assert.equal(options.monthOptions.at(-1)?.endDateStr, '2025-05-17');
  assert.deepEqual(
    options.dayOptions.map((day) => day.dateStr),
    ['2025-02-03'],
  );
});
