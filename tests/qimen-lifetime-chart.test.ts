import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateLifetime } from '../src/systems/qimen/lifetime/chart';

test('本命时局与出生资料、主题宫和四种阶段模型组合', async () => {
  const birth = { year: 1990, month: 5, day: 15, hour: 14, minute: 30, second: 0, timezone: 8 };
  for (const model of ['pillarFourLimits', 'palaceWalk', 'fushiAlternating', 'decadalGanzhi'] as const) {
    const result = await calculateLifetime({ birth, gender: 'male', stagePolicy: { model }, topics: ['career', 'marriage'] });
    assert.equal(result.baseChart.ganzhi.year, '庚午');
    assert.equal(result.basis.birthTimestamp, Date.parse('1990-05-15T06:30:00Z'));
    assert.deepEqual(result.topicCandidates.map((t) => t.topic), ['career', 'marriage']);
    assert.ok(result.personalMarkers.some((m) => m.markerType === 'yearStem'));
    assert.equal(result.stages.length, model === 'pillarFourLimits' ? 4 : model === 'palaceWalk' ? 9 : model === 'fushiAlternating' ? 8 : 13);
    if (model === 'decadalGanzhi') assert.equal(result.basis.decadalLuck?.direction, 'forward');
  }
});

test('公历、农历、时区及真太阳时保留同一真实出生瞬时', async () => {
  const civil = await calculateLifetime({ birth: { year: 1990, month: 5, day: 15, hour: 14, minute: 30, second: 0, timezone: 8 } });
  const lunar = await calculateLifetime({ birth: { year: 1990, month: 4, day: 21, hour: 14, minute: 30, second: 0, timezone: 8, calendar: 'lunar' } });
  const london = await calculateLifetime({ birth: { year: 1990, month: 5, day: 15, hour: 7, minute: 30, second: 0, timeZoneId: 'Europe/London' } });
  const solar = await calculateLifetime({ birth: { year: 1990, month: 5, day: 15, hour: 14, minute: 30, second: 0, timezone: 8, timeStandard: 'true-solar', longitude: 105 } });
  for (const result of [lunar, london, solar]) assert.equal(result.basis.birthTimestamp, civil.basis.birthTimestamp);
  assert.deepEqual(lunar.baseChart, civil.baseChart);
  assert.equal(london.baseChart.timezoneOffsetMinutes, 60);
  assert.equal(solar.baseChart.termReferenceTimestamp, civil.basis.birthTimestamp);
  assert.equal(solar.baseChart.timeContext?.longitude, 105);
});

test('无效出生资料、夏令时歧义和缺少顺逆取法明确拒绝', async () => {
  const base = { year: 2024, month: 1, day: 1, hour: 12, minute: 0, second: 0 };
  await assert.rejects(() => calculateLifetime({ birth: { ...base, month: 2, day: 30 } }));
  await assert.rejects(() => calculateLifetime({ birth: { ...base, leapMonth: true } }));
  await assert.rejects(() => calculateLifetime({ birth: { ...base, timeStandard: 'true-solar' } }));
  await assert.rejects(() => calculateLifetime({ birth: base, stagePolicy: { model: 'decadalGanzhi' } }));
  await assert.rejects(() => calculateLifetime({ birth: base, topics: ['unknown' as any] }));
  await assert.rejects(() => calculateLifetime({ birth: { ...base, month: 11, day: 3, hour: 1, minute: 30, timeZoneId: 'America/New_York' } }));
  await assert.rejects(() => calculateLifetime({ birth: { ...base, month: 3, day: 10, hour: 2, minute: 30, timeZoneId: 'America/New_York' } }));
});
