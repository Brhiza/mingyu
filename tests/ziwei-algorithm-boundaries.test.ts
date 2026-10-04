import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAstrolabeFromInput,
  buildHoroscope,
  buildHoroscopeFromInput,
} from '../packages/core/src/ziwei/iztro';
import { calculateZiweiChart } from '../packages/core/src/ziwei/runtime';
import { buildZiweiFortuneOptions } from '../packages/core/src/ziwei/fortune-options';
import { calculateNormalZiweiNominalAge } from '../packages/core/src/ziwei/iztro/decadal';
import type { ChartInput } from '../packages/core/src/types/chart';

function chartFacts(astrolabe: Awaited<ReturnType<typeof buildAstrolabeFromInput>>) {
  return {
    soul: astrolabe.earthlyBranchOfSoulPalace,
    body: astrolabe.earthlyBranchOfBodyPalace,
    fiveElementsClass: astrolabe.fiveElementsClass,
    chineseDate: astrolabe.chineseDate,
    rawLunarDate: {
      year: astrolabe.rawDates.lunarDate.lunarYear,
      month: astrolabe.rawDates.lunarDate.lunarMonth,
      day: astrolabe.rawDates.lunarDate.lunarDay,
    },
    palaces: astrolabe.palaces.map((palace) => ({
      index: palace.index,
      name: palace.name,
      heavenlyStem: palace.heavenlyStem,
      earthlyBranch: palace.earthlyBranch,
      isBodyPalace: palace.isBodyPalace,
      isOriginalPalace: palace.isOriginalPalace,
      ages: palace.ages,
      decadal: palace.decadal,
      majorStars: palace.majorStars.map((star) => ({ name: star.name, mutagen: star.mutagen })),
      minorStars: palace.minorStars.map((star) => ({ name: star.name, mutagen: star.mutagen })),
      adjectiveStars: palace.adjectiveStars.map((star) => ({
        name: star.name,
        mutagen: star.mutagen,
      })),
    })),
  };
}

const leapDateBase: ChartInput = {
  name: '晚子时边界',
  dateType: 'lunar',
  birthDate: '2023-02-15',
  isLeapMonth: true,
  birthTimeIndex: 12,
  gender: '男',
  fixLeap: true,
  algorithm: 'default',
  yearDivide: 'normal',
  horoscopeDivide: 'normal',
  ageDivide: 'normal',
};

test('紫微闰月十五日晚子时按次日分界时应与次日早子时盘一致并保留原始出生资料', async () => {
  const lateZi = await buildAstrolabeFromInput({ ...leapDateBase, dayDivide: 'forward' });
  const nextMorning = await buildAstrolabeFromInput({
    ...leapDateBase,
    birthDate: '2023-02-16',
    birthTimeIndex: 0,
    dayDivide: 'forward',
  });

  assert.deepEqual(chartFacts(lateZi), chartFacts(nextMorning));
  assert.equal(lateZi.solarDate, '2023-4-5');
  assert.equal(lateZi.lunarDate, '二〇二三年闰二月十五');
  assert.equal(lateZi.time, '晚子时');
  assert.equal(lateZi.timeRange, '23:00~00:00');
});

test('紫微晚子时当前日口径、关闭闰月修正及普通月输入应保持各自分界设置', async () => {
  const currentLateZi = await buildAstrolabeFromInput({ ...leapDateBase, dayDivide: 'current' });
  const sameMorning = await buildAstrolabeFromInput({
    ...leapDateBase,
    birthTimeIndex: 0,
    dayDivide: 'current',
  });
  assert.deepEqual(chartFacts(currentLateZi), chartFacts(sameMorning));

  const unadjustedLateZi = await buildAstrolabeFromInput({
    ...leapDateBase,
    birthTimeIndex: 12,
    fixLeap: false,
    dayDivide: 'forward',
  });
  const unadjustedNextMorning = await buildAstrolabeFromInput({
    ...leapDateBase,
    birthDate: '2023-02-16',
    birthTimeIndex: 0,
    fixLeap: false,
    dayDivide: 'forward',
  });
  assert.deepEqual(chartFacts(unadjustedLateZi), chartFacts(unadjustedNextMorning));

  const regularLateZi = await buildAstrolabeFromInput({
    ...leapDateBase,
    birthDate: '2023-03-10',
    isLeapMonth: false,
    birthTimeIndex: 12,
    dayDivide: 'forward',
  });
  const regularNextMorning = await buildAstrolabeFromInput({
    ...leapDateBase,
    birthDate: '2023-03-11',
    isLeapMonth: false,
    birthTimeIndex: 0,
    dayDivide: 'forward',
  });
  assert.deepEqual(chartFacts(regularLateZi), chartFacts(regularNextMorning));
  assert.equal(regularLateZi.solarDate, '2023-4-29');
  assert.equal(regularLateZi.lunarDate, '二〇二三年三月初十');
  assert.equal(regularLateZi.time, '晚子时');
});

test('紫微农历年末晚子时按次日计算四化与运限，同时保留原始出生日期展示', async () => {
  const lateZiInput: ChartInput = {
    ...leapDateBase,
    birthDate: '2023-12-30',
    isLeapMonth: false,
    birthTimeIndex: 12,
  };
  const lateZi = await buildAstrolabeFromInput({ ...lateZiInput, dayDivide: 'forward' });
  const nextNewYearMorning = await buildAstrolabeFromInput({
    ...lateZiInput,
    birthDate: '2024-01-01',
    birthTimeIndex: 0,
    dayDivide: 'forward',
  });
  const originalDateDisplay = await buildAstrolabeFromInput({
    ...lateZiInput,
    dayDivide: 'current',
  });

  assert.deepEqual(chartFacts(lateZi), chartFacts(nextNewYearMorning));
  assert.equal(lateZi.rawDates.lunarDate.lunarYear, 2024);
  assert.equal(lateZi.rawDates.lunarDate.lunarMonth, 1);
  assert.equal(lateZi.rawDates.lunarDate.lunarDay, 1);
  assert.equal(lateZi.solarDate, originalDateDisplay.solarDate);
  assert.equal(lateZi.lunarDate, originalDateDisplay.lunarDate);
  assert.equal(lateZi.time, originalDateDisplay.time);
  assert.equal(lateZi.timeRange, originalDateDisplay.timeRange);
  assert.equal(lateZi.sign, originalDateDisplay.sign);
  assert.equal(lateZi.zodiac, originalDateDisplay.zodiac);

  assert.equal(calculateNormalZiweiNominalAge(lateZi, '2024-02-10', 0), 1);
  assert.equal(calculateNormalZiweiNominalAge(nextNewYearMorning, '2024-02-10', 0), 1);
  assert.equal(buildHoroscope(lateZi, '2024-02-10', 0).age.nominalAge, 1);
  assert.equal(buildHoroscope(nextNewYearMorning, '2024-02-10', 0).age.nominalAge, 1);
});

test('春节前晚子跨年盘的完整运限与生日分界沿用次日安星日期', async () => {
  const lateZiInput: ChartInput = {
    name: '春节晚子',
    dateType: 'solar',
    birthDate: '2024-02-09',
    birthTimeIndex: 12,
    gender: '男',
    dayDivide: 'forward',
    ageDivide: 'normal',
  };
  const nextMorningInput: ChartInput = {
    ...lateZiInput,
    birthDate: '2024-02-10',
    birthTimeIndex: 0,
  };
  const context = { dateStr: '2025-01-28', hourIndex: 0 };
  const lateZi = await calculateZiweiChart(lateZiInput, {
    scopes: ['origin'],
    skipAnalysis: true,
    horoscopeContext: context,
    fortuneRange: { scope: 'year', ...context },
  });
  const nextMorning = await calculateZiweiChart(nextMorningInput, {
    scopes: ['origin'],
    skipAnalysis: true,
    horoscopeContext: context,
    fortuneRange: { scope: 'year', ...context },
  });
  assert.equal(lateZi.astrolabe.solarDate, '2024-02-09');
  assert.deepEqual(lateZi.decadalTimeline, nextMorning.decadalTimeline);
  assert.equal(lateZi.decadalTimeline[0]?.dateStr, '2024-02-10');
  assert.deepEqual(lateZi.fortuneTimeline?.periods, nextMorning.fortuneTimeline?.periods);

  const options = await buildZiweiFortuneOptions(
    lateZiInput,
    { startAge: 1, endAge: 2 },
    { hourIndex: 12 },
  );
  assert.deepEqual(
    options.yearOptions.map(({ age, dateStr }) => ({ age, dateStr })),
    [
      { age: 1, dateStr: '2024-02-10' },
      { age: 2, dateStr: '2025-01-29' },
    ],
  );

  const birthdayInput = { ...lateZiInput, ageDivide: 'birthday' as const };
  const birthdayAstrolabe = await buildAstrolabeFromInput(birthdayInput);
  const dayBefore = await buildHoroscopeFromInput(
    birthdayAstrolabe,
    birthdayInput,
    '2025-01-28',
    0,
  );
  const birthday = await buildHoroscopeFromInput(birthdayAstrolabe, birthdayInput, '2025-01-29', 0);
  assert.equal(dayBefore.age.nominalAge, 1);
  assert.equal(birthday.age.nominalAge, 2);
  const birthdayOptions = await buildZiweiFortuneOptions(
    birthdayInput,
    { startAge: 1, endAge: 2 },
    { hourIndex: 12 },
  );
  assert.deepEqual(
    birthdayOptions.yearOptions.map(({ age, dateStr }) => ({ age, dateStr })),
    [
      { age: 1, dateStr: '2024-02-10' },
      { age: 2, dateStr: '2025-01-29' },
    ],
  );
});

test('紫微出生日期校验范围不接受公元 0099 年输入', async () => {
  await assert.rejects(
    buildAstrolabeFromInput({
      ...leapDateBase,
      dateType: 'solar',
      birthDate: '0099-12-31',
      isLeapMonth: false,
      dayDivide: 'forward',
    }),
    /出生年份需在 1900-2100 之间/,
  );
});
