import assert from 'node:assert/strict';
import test from 'node:test';
import { generateQimen } from '../src/systems/qimen/chart';
import { buildLifetimeStages } from '../src/systems/qimen/lifetime/stages';

const civil = (year: number, month: number, day: number) => ({ year, month, day, hour: 12, minute: 0, second: 0 });

test('闰日周年、末限和不同锚点均有正确的包含式日期边界', () => {
  const chart = generateQimen(new Date('2020-02-29T04:00:00Z'));
  const stages = buildLifetimeStages(chart, { birthCivilDate: civil(2020, 2, 29), timezone: 8, gender: 'male', policy: { model: 'palaceWalk' } });
  assert.deepEqual(stages.slice(0, 3).map((s) => [s.calendarStart, s.calendarEnd]), [['2020-02-29', '2030-02-27'], ['2030-02-28', '2040-02-28'], ['2040-02-29', '2050-02-27']]);
  assert.equal(stages[8].dominantPalaces[0].palace, stages[0].dominantPalaces[0].palace);
  assert.match(stages[0].limitations[0], /八宫循环/);
  const four = buildLifetimeStages(chart, { birthCivilDate: civil(2020, 2, 29), policy: { model: 'pillarFourLimits' } });
  assert.equal(four[3].calendarEnd, '2101-02-27');
  const input = { birthCivilDate: civil(2026, 6, 15), gender: 'male' as const, policy: { model: 'palaceWalk' as const, anchorRule: 'solarTermBoundary' as const } };
  assert.equal(buildLifetimeStages(chart, { ...input, timezone: 8 })[0].calendarStart, '2026-02-04');
  assert.equal(buildLifetimeStages(chart, { ...input, timezone: -6 })[0].calendarStart, '2026-02-03');
  assert.equal(buildLifetimeStages(chart, { ...input, timeZoneId: 'America/Chicago' })[0].calendarStart, '2026-02-03');
  assert.equal(buildLifetimeStages(chart, { ...input, birthCivilDate: civil(2025, 6, 15), policy: { ...input.policy, anchorRule: 'lunarNewYear' } })[0].calendarStart, '2025-01-29');
});

test('不完整、冲突和不支持的运限参数被拒绝', () => {
  const chart = generateQimen(new Date('2024-01-01T00:00:00Z'));
  const birthCivilDate = civil(2024, 1, 1);
  assert.throws(() => buildLifetimeStages(chart, { birthCivilDate, policy: { model: 'palaceWalk' } }), /性别/);
  for (const yearsPerStage of [0, -1, 1.5, Number.NaN, Infinity, 101]) assert.throws(() => buildLifetimeStages(chart, { birthCivilDate, gender: 'male', policy: { model: 'palaceWalk', yearsPerStage } }));
  assert.throws(() => buildLifetimeStages(chart, { birthCivilDate, policy: { model: 'pillarFourLimits', yearsPerStage: 10 } }));
  assert.throws(() => buildLifetimeStages(chart, { birthCivilDate: civil(2024, 2, 30), policy: { model: 'pillarFourLimits' } }));
  assert.throws(() => buildLifetimeStages(chart, { birthCivilDate: { ...civil(2024, 3, 10), hour: 2, minute: 30 }, timeZoneId: 'America/New_York', policy: { model: 'pillarFourLimits' } }), /不存在/);
  assert.throws(() => buildLifetimeStages(chart, { birthCivilDate: { ...civil(2024, 11, 3), hour: 1, minute: 30 }, timeZoneId: 'America/New_York', policy: { model: 'pillarFourLimits' } }), /歧义/);
  const resolved = buildLifetimeStages(chart, { birthCivilDate: { ...civil(2024, 11, 3), hour: 1, minute: 30 }, timeZoneId: 'America/New_York', timezone: -4, policy: { model: 'pillarFourLimits' } });
  assert.equal(resolved[0].calendarStart, '2024-11-03');
});
