import assert from 'node:assert/strict';
import test from 'node:test';
import type { CivilDateTimeParts } from '../packages/core/src/calendar/civil-time';
import { generateQimen } from '../packages/core/src/divination/algorithms/qimen';
import {
  buildLifetimeStages,
  type QimenLifetimeStageTimeContext,
} from '../packages/core/src/divination/algorithms/qimen/helpers/lifetime-stages';

const stageChartSeeds = new Map<string, ReturnType<typeof generateQimen>>();

function buildStageChart(birthDateTime: string) {
  let chart = stageChartSeeds.get(birthDateTime);
  if (!chart) {
    chart = generateQimen(new Date(birthDateTime), 'zhuanpan', 'hour', 'chaibu', 480);
    stageChartSeeds.set(birthDateTime, chart);
  }
  return structuredClone(chart);
}

function buildStages(
  birthDateTime: string,
  policy: Parameters<typeof buildLifetimeStages>[3],
  gender: 'male' | 'female' = 'male',
  birthCivilDate?: CivilDateTimeParts,
  timeContext?: QimenLifetimeStageTimeContext,
) {
  const birthDate = new Date(birthDateTime);
  const chart = buildStageChart(birthDateTime);
  return buildLifetimeStages(chart, [], [], policy, birthDate, gender, birthCivilDate, timeContext);
}

test('符使交替十年分段保留旧枚举但覆盖八个完整十年段', () => {
  const birthCivilDate = {
    year: 1990,
    month: 5,
    day: 15,
    hour: 14,
    minute: 30,
    second: 0,
  } satisfies CivilDateTimeParts;
  const stages = buildStages(
    '1990-05-15T14:30:00+08:00',
    { model: 'fuShiHexagramOrbit', anchorRule: 'birthInstant' },
    'male',
    birthCivilDate,
  );

  assert.equal(stages.length, 8);
  assert.deepEqual(
    stages.map((stage) => [stage.ageStart, stage.ageEnd]),
    [
      [0, 9],
      [10, 19],
      [20, 29],
      [30, 39],
      [40, 49],
      [50, 59],
      [60, 69],
      [70, 79],
    ],
  );
  assert.deepEqual(
    stages.map((stage) => [stage.calendarStart, stage.calendarEnd]),
    [
      ['1990-05-15', '2000-05-14'],
      ['2000-05-15', '2010-05-14'],
      ['2010-05-15', '2020-05-14'],
      ['2020-05-15', '2030-05-14'],
      ['2030-05-15', '2040-05-14'],
      ['2040-05-15', '2050-05-14'],
      ['2050-05-15', '2060-05-14'],
      ['2060-05-15', '2070-05-14'],
    ],
  );
  assert.ok(stages.every((stage) => stage.title.startsWith('符使交替')));
  assert.match(stages[0].limitations.join('；'), /不等同于《奇门遁甲统宗》/u);
  assert.doesNotMatch(stages[0].stageTheme, /真实卦爻推演/u);
});

test('九宫巡行的每段结束为下一段起始日前一天，并将闰日周年夹到月底', () => {
  const birthCivilDate = {
    year: 2020,
    month: 2,
    day: 29,
    hour: 12,
    minute: 0,
    second: 0,
  } satisfies CivilDateTimeParts;
  const stages = buildStages(
    '2020-02-29T12:00:00+08:00',
    { model: 'palaceWalk', yearsPerStage: 10, anchorRule: 'birthInstant' },
    'male',
    birthCivilDate,
  );

  assert.equal(stages.length, 9);
  assert.equal(stages[0].calendarStart, '2020-02-29');
  assert.equal(stages[0].calendarEnd, '2030-02-27');
  assert.equal(stages[1].calendarStart, '2030-02-28');
  assert.equal(stages[1].calendarEnd, '2040-02-28');
  assert.equal(stages[2].calendarStart, '2040-02-29');
  assert.equal(stages[2].calendarEnd, '2050-02-27');
  assert.equal(stages[8].calendarEnd, '2110-02-27');

  for (let index = 0; index < stages.length - 1; index += 1) {
    const expectedPreviousEnd = new Date(`${stages[index + 1].calendarStart}T00:00:00Z`);
    expectedPreviousEnd.setUTCDate(expectedPreviousEnd.getUTCDate() - 1);
    assert.equal(
      stages[index].calendarEnd,
      expectedPreviousEnd.toISOString().slice(0, 10),
      `第${index + 1}段必须在下一段起始日前一天结束`,
    );
  }
});

test('阶段锚点使用实际农历正月初一和立春日期而非固定月日', () => {
  const birthCivilDate = {
    year: 2025,
    month: 6,
    day: 15,
    hour: 12,
    minute: 0,
    second: 0,
  } satisfies CivilDateTimeParts;
  const lunarNewYearStages = buildStages(
    '2025-06-15T12:00:00+08:00',
    { model: 'palaceWalk', yearsPerStage: 10, anchorRule: 'lunarNewYear' },
    'male',
    birthCivilDate,
  );
  const solarTermStages = buildStages(
    '2025-06-15T12:00:00+08:00',
    { model: 'palaceWalk', yearsPerStage: 10, anchorRule: 'solarTermBoundary' },
    'male',
    birthCivilDate,
  );

  // 2025 年农历正月初一为公历 1 月 29 日，立春交节所在公历日为 2 月 3 日。
  assert.equal(lunarNewYearStages[0].calendarStart, '2025-01-29');
  assert.equal(solarTermStages[0].calendarStart, '2025-02-03');
});

test('立春锚点按实际瞬时点转换当地日期，支持中国与美国中部跨日', () => {
  const birthCivilDate = {
    year: 2026,
    month: 6,
    day: 15,
    hour: 12,
    minute: 0,
    second: 0,
  } satisfies CivilDateTimeParts;
  const chinaStages = buildStages(
    '2026-06-15T12:00:00+08:00',
    { model: 'palaceWalk', yearsPerStage: 10, anchorRule: 'solarTermBoundary' },
    'male',
    birthCivilDate,
    { timezone: 8 },
  );
  const fixedCentralStages = buildStages(
    '2026-06-15T12:00:00+08:00',
    { model: 'palaceWalk', yearsPerStage: 10, anchorRule: 'solarTermBoundary' },
    'male',
    birthCivilDate,
    { timezone: -6 },
  );
  const ianaCentralStages = buildStages(
    '2026-06-15T12:00:00+08:00',
    { model: 'palaceWalk', yearsPerStage: 10, anchorRule: 'solarTermBoundary' },
    'male',
    birthCivilDate,
    { timeZoneId: 'America/Chicago' },
  );

  // 2026 年立春为中国标准时 2 月 4 日凌晨，换算为美国中部标准时仍是 2 月 3 日。
  assert.equal(chinaStages[0].calendarStart, '2026-02-04');
  assert.equal(fixedCentralStages[0].calendarStart, '2026-02-03');
  assert.equal(ianaCentralStages[0].calendarStart, '2026-02-03');
});

test('四柱分限的天盘干定位包含天禽携带的伴随干', () => {
  const birthDate = new Date('2024-06-15T14:30:00+08:00');
  const chart = buildStageChart('2024-06-15T14:30:00+08:00');
  const target = chart.jiuGongGe.find((palace) => palace.gong === 9);
  assert.ok(target);

  // 将目标宫的天盘携干设置为乙，再把年干设为乙；辰支落四宫，故九宫的命中来自携干。
  target.tianPan.companionStem = '乙';
  chart.ganzhi.year = '乙辰';
  const stages = buildLifetimeStages(
    chart,
    [],
    [],
    { model: 'pillarFourLimits', anchorRule: 'birthInstant' },
    birthDate,
    'male',
    {
      year: 2024,
      month: 6,
      day: 15,
      hour: 14,
      minute: 30,
      second: 0,
    },
  );

  assert.ok(
    stages[0].dominantPalaces.some((palace) => palace.palace === 9),
    '年干应能通过天盘携干定位到九宫',
  );
});

test('直接调用旧阶段构建器不得伪算十年干支大运', () => {
  const birthDate = new Date('2024-06-15T14:30:00+08:00');
  const chart = buildStageChart('2024-06-15T14:30:00+08:00');

  assert.throws(
    () =>
      buildLifetimeStages(chart, [], [], { model: 'decadalGanzhi' }, birthDate, 'male', {
        year: 2024,
        month: 6,
        day: 15,
        hour: 14,
        minute: 30,
        second: 0,
      }),
    /十年干支大运请使用完整终身局入口/u,
  );
});
