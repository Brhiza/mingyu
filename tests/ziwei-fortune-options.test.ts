import assert from 'node:assert/strict';
import test from 'node:test';
import { buildZiweiFortuneOptions } from '../packages/core/src/ziwei/fortune-options';
import { buildZiweiFortuneTimeline } from '../packages/core/src/ziwei/fortune-timeline';
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
  const selected = { startAge: 1, endAge: 3 };
  const buildOptions = { hourIndex: 4 };
  const pending = buildZiweiFortuneOptions(input, selected, buildOptions);
  selected.endAge = 4;
  buildOptions.hourIndex = 0;
  const options = await pending;

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
  assert.equal(selected.endAge, 4);
  assert.equal(buildOptions.hourIndex, 0);
});

test('紫微流年选项拒绝与当前命盘不一致的出生公历日期', async () => {
  const input = normalizeChartInput({
    name: '出生日期一致性',
    gender: '女',
    dateType: 'solar',
    birthDate: '1992-02-03',
    birthTimeIndex: 4,
  });

  await assert.rejects(
    buildZiweiFortuneOptions(
      input,
      { startAge: 1, endAge: 2 },
      {
        birthSolarDate: '1992-02-04',
      },
    ),
    /紫微运限出生公历日期与当前命盘不一致/,
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
      hourIndex: 4,
      selectedYearDateStr: '2023-03-22',
      selectedMonthDateStr: '2023-03-22',
    },
  );
  assert.equal(options.effectiveYearDateStr, '2023-01-22');
  assert.equal(options.effectiveMonthDateStr, '2023-02-20');
  const leapMonth = options.monthOptions.find((month) => month.month === 2);
  assert.equal(leapMonth?.dateStr, '2023-02-20');
  assert.equal(leapMonth?.endDateStr, '2023-04-05');
  assert.equal(options.monthOptions.find((month) => month.month === 3)?.dateStr, '2023-04-06');
  assert.equal(options.dayOptions.length, 45);
  assert.equal(options.dayOptions[0]?.dateStr, '2023-02-20');
  assert.equal(options.dayOptions.at(-1)?.dateStr, '2023-04-05');
});

test('紫微闰月后半段按引擎实际切月日生成流月与流日选项', async () => {
  const input = normalizeChartInput({
    name: '闰六月切月',
    gender: '女',
    dateType: 'solar',
    birthDate: '1990-05-15',
    birthTimeIndex: 4,
  });
  const options = await buildZiweiFortuneOptions(
    input,
    { startAge: 36, endAge: 36 },
    { hourIndex: 4, selectedYearDateStr: '2025-08-19', selectedMonthDateStr: '2025-08-19' },
  );
  const month = options.monthOptions.find(
    (item) => item.dateStr <= '2025-08-19' && item.endDateStr >= '2025-08-19',
  );
  assert.deepEqual(
    month && {
      month: month.month,
      dateStr: month.dateStr,
      endDateStr: month.endDateStr,
      ganZhi: month.ganZhi,
    },
    { month: 7, dateStr: '2025-08-09', endDateStr: '2025-09-21', ganZhi: '甲申' },
  );
  assert.equal(options.effectiveMonthDateStr, '2025-08-09');
  assert.ok(options.dayOptions.some((item) => item.dateStr === '2025-08-19'));
});

test('紫微末段虚岁选项支持 2100 年后的真实日期', async () => {
  const input = normalizeChartInput({
    name: '末段虚岁',
    gender: '女',
    dateType: 'solar',
    birthDate: '1992-08-21',
    birthTimeIndex: 4,
  });
  const options = await buildZiweiFortuneOptions(
    input,
    { startAge: 125, endAge: 125 },
    { hourIndex: 4 },
  );
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
      hourIndex: 4,
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

test('紫微流日选项省略目标时辰时采用当前流时，显式晚子时仍保留不同日柱', async (context) => {
  context.mock.timers.enable({ apis: ['Date'], now: new Date('2026-08-06T04:30:00Z') });
  const input = normalizeChartInput({
    name: '流日钟表与出生时辰分离',
    gender: '女',
    dateType: 'solar',
    birthDate: '1992-08-21',
    birthTimeIndex: 12,
    dayDivide: 'forward',
    ageDivide: 'normal',
    yearDivide: 'exact',
    horoscopeDivide: 'exact',
  });
  const selectedDate = '2025-02-02';
  const selectedDecadal = { startAge: 34, endAge: 34 };
  const selection = { selectedYearDateStr: selectedDate, selectedMonthDateStr: selectedDate };
  const currentTimeOptions = await buildZiweiFortuneOptions(input, selectedDecadal, selection);
  const lateZiOptions = await buildZiweiFortuneOptions(input, selectedDecadal, {
    ...selection,
    hourIndex: 12,
  });
  const timeline = await buildZiweiFortuneTimeline(input, { scope: 'day', dateStr: selectedDate });
  const selectedDay = currentTimeOptions.dayOptions.find((day) => day.dateStr === selectedDate);
  const explicitLateZiDay = lateZiOptions.dayOptions.find((day) => day.dateStr === selectedDate);
  const timelineDay = timeline.periods
    .flatMap((period) => period.years)
    .find((year) => year.targetDay)?.targetDay;

  assert.deepEqual(
    currentTimeOptions.yearOptions.map(({ dateStr, endDateStr, ganZhi }) => ({
      dateStr,
      endDateStr,
      ganZhi,
    })),
    [
      { dateStr: '2025-01-29', endDateStr: '2025-02-02', ganZhi: '甲辰' },
      { dateStr: '2025-02-03', endDateStr: '2026-02-03', ganZhi: '乙巳' },
      { dateStr: '2026-02-04', endDateStr: '2026-02-16', ganZhi: '丙午' },
    ],
  );
  assert.equal(timeline.targetHourIndex, 6);
  assert.equal(selectedDay?.ganZhi, '壬寅');
  assert.equal(
    selectedDay?.ganZhi,
    `${timelineDay?.layer.heavenlyStem}${timelineDay?.layer.earthlyBranch}`,
  );
  assert.equal(explicitLateZiDay?.ganZhi, '癸卯');
});
