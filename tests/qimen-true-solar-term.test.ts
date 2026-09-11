import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateQimenLifetime,
  normalizeQimenLifetimeTime,
} from '../packages/core/src/divination/algorithms/qimen';
import { getDivinationTime } from '../packages/core/src/calendar/timeManager';

test('太阳时钟表落入民用跳时缺口时保持原出生瞬时点', () => {
  const input = {
    birthDateTime: '2024-03-10T04:00:00',
    timeZoneId: 'America/New_York',
    timeStandard: 'trueSolar' as const,
    location: { longitude: -74 },
  };
  const normalized = normalizeQimenLifetimeTime(input);
  assert.equal(normalized.referenceDate.toISOString(), '2024-03-10T08:00:00.000Z');
  assert.equal(normalized.calculationParts.hour, 2);
  assert.equal(normalized.timezoneOffsetMinutes, -240);
  const result = calculateQimenLifetime(input);
  assert.equal(result.baseChart.ganzhi.hour.at(-1), '丑');
});

test('历史夏令时两种明确入口保留相同真实出生瞬时点', () => {
  const birth = {
    birthDateTime: '1990-05-15T12:00:00',
    timeStandard: 'trueSolar' as const,
    location: { longitude: 116.4 },
  };
  const fixed = normalizeQimenLifetimeTime({ ...birth, timezone: 8, applyChinaDst: true });
  const iana = normalizeQimenLifetimeTime({ ...birth, timeZoneId: 'Asia/Shanghai' });
  assert.equal(fixed.referenceDate.toISOString(), '1990-05-15T03:00:00.000Z');
  assert.equal(iana.referenceDate.toISOString(), fixed.referenceDate.toISOString());
});

for (const sample of [
  {
    birthDateTime: '2024-02-04T16:30:00',
    timezone: 8,
    longitude: 116.4,
    term: '立春',
    year: '甲辰',
    month: '丙寅',
  },
  {
    birthDateTime: '2024-02-04T16:20:00',
    timezone: 8,
    longitude: 135,
    term: '大寒',
    year: '癸卯',
    month: '乙丑',
  },
  {
    birthDateTime: '2024-02-04T03:30:00',
    timezone: -5,
    longitude: -74,
    term: '立春',
    year: '甲辰',
    month: '丙寅',
  },
]) {
  test(`真太阳时修正跨交节仍按真实瞬时点定年月：${sample.birthDateTime} UTC${sample.timezone}`, () => {
    const input = {
      birthDateTime: sample.birthDateTime,
      timezone: sample.timezone,
      location: { longitude: sample.longitude },
    };
    const civil = calculateQimenLifetime({ ...input, timeStandard: 'civil' });
    const normalizedCivil = normalizeQimenLifetimeTime({ ...input, timeStandard: 'civil' });
    const normalizedSolar = normalizeQimenLifetimeTime({ ...input, timeStandard: 'trueSolar' });
    const solar = calculateQimenLifetime({ ...input, timeStandard: 'trueSolar' });
    assert.equal(normalizedSolar.referenceDate.getTime(), normalizedCivil.normalizedDate.getTime());
    assert.notEqual(
      normalizedSolar.normalizedDate.getTime(),
      normalizedSolar.referenceDate.getTime(),
    );
    assert.equal(solar.basis.solarTerm, sample.term);
    assert.equal(solar.baseChart.timeInfo.solarTerm, sample.term);
    assert.equal(solar.baseChart.seasonality?.currentJieQi, sample.term);
    assert.equal(solar.baseChart.ganzhi.year, sample.year);
    assert.equal(solar.baseChart.ganzhi.month, sample.month);
    assert.equal(solar.baseChart.ganzhi.year, civil.baseChart.ganzhi.year);
    const corrected = getDivinationTime(
      normalizedSolar.normalizedDate,
      normalizedSolar.timezoneOffsetMinutes,
    );
    assert.equal(solar.baseChart.ganzhi.day, corrected.ganzhi.day);
    assert.equal(solar.baseChart.ganzhi.hour, corrected.ganzhi.hour);
  });
}
