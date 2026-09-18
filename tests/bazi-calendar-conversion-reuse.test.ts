import assert from 'node:assert/strict';
import test from 'node:test';

import { baziCalculator } from '@core/bazi/baziCalculator';

function getPillars(result: ReturnType<typeof baziCalculator.calculateBazi>) {
  return Object.fromEntries(
    (['year', 'month', 'day', 'hour'] as const).map((position) => [
      position,
      result.pillars[position].ganZhi,
    ]),
  );
}

test('八字支持年份两端的完整四柱、命卦与节令事实保持稳定', () => {
  const cases = [
    {
      input: {
        year: 1900,
        month: 1,
        day: 1,
        birthHour: 0,
        birthMinute: 0,
        birthSecond: 0,
        gender: 'male' as const,
      },
      pillars: { year: '己亥', month: '丙子', day: '甲戌', hour: '甲子' },
      mingGua: { number: 2, gua: '坤' },
      currentJieqi: '冬至',
      monthCommander: '癸',
    },
    {
      input: {
        year: 2100,
        month: 12,
        day: 31,
        birthHour: 23,
        birthMinute: 59,
        birthSecond: 59,
        gender: 'female' as const,
      },
      pillars: { year: '庚申', month: '戊子', day: '戊申', hour: '壬子' },
      mingGua: { number: 7, gua: '兑' },
      currentJieqi: '冬至',
      monthCommander: '癸',
    },
  ];

  for (const item of cases) {
    const result = baziCalculator.calculateBazi(item.input);
    assert.deepEqual(getPillars(result), item.pillars);
    assert.deepEqual({ number: result.mingGua?.number, gua: result.mingGua?.gua }, item.mingGua);
    assert.equal(result.seasonInfo.currentJieqi, item.currentJieqi);
    assert.equal(result.monthCommander, item.monthCommander);
  }
});

test('标准时秒级立春边界继续同步切换年柱、月柱与命卦年', () => {
  const common = {
    year: 2024,
    month: 2,
    day: 4,
    birthHour: 16,
    birthMinute: 27,
    gender: 'male' as const,
  };
  const before = baziCalculator.calculateBazi({ ...common, birthSecond: 6 });
  const atBoundary = baziCalculator.calculateBazi({ ...common, birthSecond: 7 });

  assert.deepEqual(getPillars(before), {
    year: '癸卯',
    month: '乙丑',
    day: '戊戌',
    hour: '庚申',
  });
  assert.deepEqual(getPillars(atBoundary), {
    year: '甲辰',
    month: '丙寅',
    day: '戊戌',
    hour: '庚申',
  });
  assert.deepEqual([before.mingGua?.gua, atBoundary.mingGua?.gua], ['巽', '震']);
  assert.deepEqual(
    [before.seasonInfo.currentJieqi, atBoundary.seasonInfo.currentJieqi],
    ['大寒', '立春'],
  );
});

test('农历标准时复用日时轴，全球真太阳时仍独立使用真实瞬时节气轴', () => {
  const lunar = baziCalculator.calculateBazi({
    year: 2024,
    month: 1,
    day: 1,
    isLunar: true,
    birthHour: 12,
    birthMinute: 34,
    birthSecond: 56,
    gender: 'female',
  });
  const newYork = baziCalculator.calculateBazi({
    year: 2024,
    month: 2,
    day: 4,
    useTrueSolarTime: true,
    birthHour: 3,
    birthMinute: 20,
    birthSecond: 0,
    birthLongitude: -74.006,
    timeZoneId: 'America/New_York',
    gender: 'male',
  });

  assert.deepEqual(getPillars(lunar), {
    year: '甲辰',
    month: '丙寅',
    day: '甲辰',
    hour: '庚午',
  });
  assert.deepEqual(getPillars(newYork), {
    year: '癸卯',
    month: '乙丑',
    day: '戊戌',
    hour: '甲寅',
  });
  assert.equal(newYork.timing?.timeZoneId, 'America/New_York');
  assert.equal(newYork.seasonInfo.currentJieqi, '大寒');
  assert.equal(newYork.mingGua?.gua, '巽');
});
