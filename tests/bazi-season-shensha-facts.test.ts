import assert from 'node:assert/strict';
import test from 'node:test';

import { baziCalculator } from '@core/bazi/baziCalculator';
import { formatBaziForPrompt } from '@core/bazi/baziAnalysisFormatter';
import { getCategorizedYearShenSha } from '@core/bazi/baziCalculatorTime';
import { calculateSolarTermEvidence } from '@core/calendar/solar-term-evidence';

type BaziInput = Parameters<typeof baziCalculator.calculateBazi>[0];

function chinaDstClock(timestamp: number) {
  const clock = new Date(timestamp + 9 * 60 * 60 * 1000);
  return {
    year: clock.getUTCFullYear(),
    month: clock.getUTCMonth() + 1,
    day: clock.getUTCDate(),
    birthHour: clock.getUTCHours(),
    birthMinute: clock.getUTCMinutes(),
    birthSecond: clock.getUTCSeconds(),
  };
}

test('中国历史夏令时交节前后，节令、司权与四柱共用同一出生瞬时', () => {
  const xiaoshu = calculateSolarTermEvidence(1988, 13);
  for (const [offsetMinutes, expectedJieqi] of [
    [-15, '夏至'],
    [15, '小暑'],
  ] as const) {
    const clock = chinaDstClock(xiaoshu.utcTimestamp + offsetMinutes * 60 * 1000);
    const base: BaziInput = {
      ...clock,
      timeIndex: 6,
      gender: 'male',
      useTrueSolarTime: false,
    };
    const fixed = baziCalculator.calculateBazi({ ...base, timezone: 8, applyChinaDst: true });
    const iana = baziCalculator.calculateBazi({ ...base, timeZoneId: 'Asia/Shanghai' });

    assert.equal(fixed.seasonInfo.currentJieqi, expectedJieqi);
    assert.deepEqual(iana.pillars, fixed.pillars);
    assert.deepEqual(iana.seasonInfo, fixed.seasonInfo);
    assert.equal(iana.monthCommander, fixed.monthCommander);
    assert.match(formatBaziForPrompt(iana), new RegExp(`节令: 夏令 \\| ${expectedJieqi}后`));
  }
});

test('真太阳时跨日时，提示词分别注明出生钟表日期和校正后的排盘历法', () => {
  const chart = baziCalculator.calculateBazi({
    year: 2020,
    month: 8,
    day: 1,
    timeIndex: 0,
    gender: 'male',
    useTrueSolarTime: true,
    birthHour: 0,
    birthMinute: 40,
    birthLongitude: 75.98,
  });
  const prompt = formatBaziForPrompt(chart);

  assert.match(prompt, /出生钟表时间: 2020年8月1日 0:40/);
  assert.match(prompt, /排盘历法: 阳历2020年7月31日/);
});

test('流年神煞分类只取流年柱，不将整局神煞冒充流年柱神煞', () => {
  const result = getCategorizedYearShenSha(
    { ganZhi: '甲子' },
    {
      gender: 'male',
      pillars: {
        year: { gan: '乙', zhi: '丑', ganZhi: '乙丑' },
        month: { gan: '丙', zhi: '寅', ganZhi: '丙寅' },
        day: { gan: '丁', zhi: '卯', ganZhi: '丁卯' },
        hour: { gan: '戊', zhi: '辰', ganZhi: '戊辰' },
      },
    } as Parameters<typeof getCategorizedYearShenSha>[1],
    () => ({ year: ['天乙贵人'], month: [], day: [], hour: [], global: ['三奇贵人'] }),
    (name) => (name === '天乙贵人' ? '吉' : '中性'),
  );

  assert.deepEqual(result, { lucky: ['天乙贵人'], unlucky: [], neutral: [] });
});
