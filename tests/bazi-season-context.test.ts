import assert from 'node:assert/strict';
import test from 'node:test';
import { baziCalculator } from '@core/bazi/baziCalculator';
import { calculateSeasonInfoFromDate } from '@core/bazi/baziCalculatorTime';
import { calculateSolarTermEvidence } from '@core/calendar/solar-term-evidence';

function chartAt(timestamp: number) {
  const civil = new Date(timestamp + 8 * 3600000);
  return baziCalculator.calculateBazi({
    year: civil.getUTCFullYear(),
    month: civil.getUTCMonth() + 1,
    day: civil.getUTCDate(),
    birthHour: civil.getUTCHours(),
    birthMinute: civil.getUTCMinutes(),
    birthSecond: civil.getUTCSeconds(),
    gender: 'male',
    isLunar: false,
  });
}

function termAt(year: number, index: number) {
  return calculateSolarTermEvidence(year + Math.floor(index / 24), ((index % 24) + 24) % 24);
}

test('完整排盘的共用节气事实保留交接前后一秒、冬至跨年及二十四节气顺序', () => {
  for (const year of [1901, 2024, 2100]) {
    for (let index = 0; index < 24; index++) {
      const term = termAt(year, index);
      for (const seconds of [-1, 1]) {
        const instant = term.utcTimestamp + seconds * 1000;
        const chart = chartAt(instant);
        const seasonInfo = chart.seasonInfo;
        assert.deepEqual(seasonInfo, calculateSeasonInfoFromDate(new Date(instant)));
        assert.equal(seasonInfo.currentJieqi, termAt(year, seconds < 0 ? index - 1 : index).name);
        assert.equal(seasonInfo.nextJieqi, termAt(year, seconds < 0 ? index : index + 1).name);
        assert.equal(seasonInfo.previousTermEvidence?.name, seasonInfo.currentJieqi);
        assert.equal(seasonInfo.nextTermEvidence?.name, seasonInfo.nextJieqi);
        const civilYear = new Date(instant + 8 * 3600000).getUTCFullYear();
        assert.deepEqual(
          seasonInfo.jieqiList,
          Array.from({ length: 24 }, (_, i) => {
            const expected = termAt(civilYear, i);
            const date = new Date(expected.utcTimestamp + 8 * 3600000).toISOString().slice(0, 10);
            return { name: expected.name, date };
          }),
        );
      }
    }
  }
});

test('完整排盘保留十二月支司权在节后天数边界的前后判断', () => {
  const transitions: [number, string, number, string, string][] = [
    [1, '丑', 9, '癸', '辛'],
    [1, '丑', 12, '辛', '己'],
    [3, '寅', 7, '戊', '丙'],
    [3, '寅', 14, '丙', '甲'],
    [5, '卯', 10, '甲', '乙'],
    [7, '辰', 9, '乙', '癸'],
    [7, '辰', 12, '癸', '戊'],
    [9, '巳', 5, '戊', '庚'],
    [9, '巳', 14, '庚', '丙'],
    [11, '午', 10, '丙', '己'],
    [11, '午', 19, '己', '丁'],
    [13, '未', 9, '丁', '乙'],
    [13, '未', 12, '乙', '己'],
    [15, '申', 7, '戊', '壬'],
    [15, '申', 14, '壬', '庚'],
    [17, '酉', 10, '庚', '辛'],
    [19, '戌', 9, '辛', '丁'],
    [19, '戌', 12, '丁', '戊'],
    [21, '亥', 7, '戊', '甲'],
    [21, '亥', 14, '甲', '壬'],
    [23, '子', 10, '壬', '癸'],
  ];
  for (const [index, branch, days, before, after] of transitions) {
    const boundary = termAt(2024, index).utcTimestamp + days * 86400000;
    for (const [offset, expected] of [
      [-1000, before],
      [1000, after],
    ] as const) {
      const chart = chartAt(boundary + offset);
      assert.equal(chart.pillars.month.zhi, branch);
      assert.equal(chart.monthCommander, expected, `${branch}月节后${days}日${offset}毫秒`);
    }
  }
});
