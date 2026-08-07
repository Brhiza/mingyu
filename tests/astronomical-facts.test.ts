import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ASTRONOMY_FACT_MODEL,
  queryAstronomicalFacts,
} from '../packages/core/src/calendar/astronomical-facts';

const JPL_HORIZONS_DE441_2000_01_01_1200_UTC = {
  Sun: { longitude: 280.3689092, latitude: 0.0002381 },
  Moon: { longitude: 223.323786, latitude: 5.1707422 },
  Mercury: { longitude: 271.8892699, latitude: -0.994819 },
  Venus: { longitude: 241.5657794, latitude: 2.0663548 },
  Mars: { longitude: 327.9632921, latitude: -1.0677752 },
  Jupiter: { longitude: 25.2530685, latitude: -1.2621868 },
  Saturn: { longitude: 40.3956366, latitude: -2.4448533 },
  Uranus: { longitude: 314.809168, latitude: -0.658324 },
  Neptune: { longitude: 303.1930007, latitude: 0.2350026 },
  Pluto: { longitude: 251.4547644, latitude: 10.8552605 },
} as const;

test('公共天文事实应与 JPL Horizons DE441 固定样本一致', () => {
  const facts = queryAstronomicalFacts({
    year: 2000,
    month: 1,
    day: 1,
    hour: 12,
    minute: 0,
    timezone: 0,
  });

  assert.equal(facts.utcDateTime, '2000-01-01T12:00:00.000Z');
  assert.equal(facts.julianDateUtc, 2451545);
  assert.equal(facts.bodies.length, 10);
  assert.equal(facts.model.validation.ephemeris, 'DE441');
  assert.match(facts.model.validation.sourceUrl, /jpl\.nasa\.gov/);

  for (const body of facts.bodies) {
    const expected = JPL_HORIZONS_DE441_2000_01_01_1200_UTC[body.name];
    assert.ok(
      Math.abs(body.longitudeDegrees - expected.longitude) <=
        ASTRONOMY_FACT_MODEL.validation.longitudeToleranceDegrees,
      `${body.name}黄经偏差超限`,
    );
    assert.ok(
      Math.abs(body.latitudeDegrees - expected.latitude) <=
        ASTRONOMY_FACT_MODEL.validation.latitudeToleranceDegrees,
      `${body.name}黄纬偏差超限`,
    );
  }
});

test('公共天文事实应正确换算时区、月相与逆行状态', () => {
  const facts = queryAstronomicalFacts({
    year: 2000,
    month: 1,
    day: 1,
    hour: 20,
    minute: 0,
    timezone: 8,
    latitude: 39.9,
    longitude: 116.4,
  });

  assert.equal(facts.utcDateTime, '2000-01-01T12:00:00.000Z');
  assert.equal(facts.localDateTime, '2000-01-01T20:00:00+08:00');
  assert.ok(facts.moonPhase.elongationDegrees > 300);
  assert.ok(facts.moonPhase.illuminationFraction > 0 && facts.moonPhase.illuminationFraction < 1);
  assert.equal(facts.bodies.find((body) => body.name === 'Saturn')?.isRetrograde, true);
});

test('公共天文事实应复用 IANA 历史时区并拒绝冲突偏移', () => {
  const facts = queryAstronomicalFacts({
    year: 1990,
    month: 7,
    day: 1,
    hour: 12,
    minute: 0,
    timeZoneId: 'Asia/Shanghai',
  });

  assert.equal(facts.timezone, 9);
  assert.equal(facts.timeZoneId, 'Asia/Shanghai');
  assert.equal(facts.utcDateTime, '1990-07-01T03:00:00.000Z');
  assert.equal(facts.localDateTime, '1990-07-01T12:00:00+09:00');
  assert.equal(facts.timezoneEvidence?.resolvedOffsetHours, 9);
  assert.throws(
    () =>
      queryAstronomicalFacts({
        year: 1990,
        month: 7,
        day: 1,
        hour: 12,
        minute: 0,
        timezone: 8,
        timeZoneId: 'Asia/Shanghai',
      }),
    /固定偏移.*历史偏移不一致/,
  );
});

test('公共天文事实应对坏日期、坏时区和未验证年代失败关闭', () => {
  const base = { year: 2000, month: 1, day: 1, hour: 12, minute: 0, timezone: 0 };
  assert.throws(() => queryAstronomicalFacts({ ...base, day: 32 }), /不存在/);
  assert.throws(() => queryAstronomicalFacts({ ...base, timezone: 15 }), /timezone|时区/);
  assert.throws(() => queryAstronomicalFacts({ ...base, year: 1700 }), /1800-2200/);
});
