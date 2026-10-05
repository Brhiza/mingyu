import assert from 'node:assert/strict';
import test from 'node:test';
import { queryAstronomicalFacts } from '../packages/core/src/calendar/astronomical-facts';
import { generateAstrolabe } from '../packages/core/src/divination/algorithms/astrolabe';
import { generateQimen } from '../packages/core/src/divination/algorithms/qimen';
import {
  birthProfileToAstrolabeInput,
  birthProfileToQizhengInput,
} from '../packages/core/src/profile';
import { generateQizheng } from '../packages/core/src/qi_zheng';

test('奇门当地年界的月相保留实际瞬时，超出当地年份仍拒绝', () => {
  for (const [utc, offset, year] of [
    ['1899-12-31T10:00:00.000Z', 840, 1900],
    ['1899-12-31T16:00:00.000Z', 480, 1900],
    ['2201-01-01T11:59:59.000Z', -720, 2200],
    ['2200-12-31T12:00:00.000Z', 0, 2200],
  ] as const) {
    const result = generateQimen(new Date(utc), 'zhuanpan', 'hour', 'chaibu', offset);
    assert.equal(new Date(result.timestamp + offset * 60_000).getUTCFullYear(), year);
    const moon = result.seasonality!.moonPhaseEvidence;
    assert.equal(moon.utcDateTime, utc);
    assert.ok(moon.previousPrincipalPhase.utcTimestamp < Date.parse(utc));
    assert.ok(moon.nextPrincipalPhase.utcTimestamp > Date.parse(utc));
    assert.match(moon.source, /Caelus/);
  }
  assert.throws(
    () => generateQimen(new Date('1899-12-31T23:00:00Z'), 'zhuanpan', 'hour', 'chaibu', 0),
    /1900-2200 年的当地钟表/,
  );
  assert.throws(
    () => generateQimen(new Date('2201-01-01T12:00:00Z'), 'zhuanpan', 'hour', 'chaibu', -720),
    /1900-2200 年的当地钟表/,
  );
});

test('公共出生画像与星盘在1900当地年初保留UTC1899星历和光照', () => {
  const profile = {
    name: '当地年界样本',
    gender: 'male' as const,
    calendarType: 'solar' as const,
    year: 1900,
    month: 1,
    day: 1,
    hour: 0,
    minute: 0,
    second: 0,
    location: { timezone: 14, latitude: 0, longitude: 180 },
  };
  const utc = '1899-12-31T10:00:00.000Z';
  const astrolabe = generateAstrolabe(birthProfileToAstrolabeInput(profile));
  const qizheng = generateQizheng(birthProfileToQizhengInput(profile));
  const facts = queryAstronomicalFacts({ ...profile, ...profile.location });
  assert.equal(facts.utcDateTime, utc);
  assert.equal(astrolabe.solarIllumination!.astronomicalTime.unixMilliseconds, Date.parse(utc));
  assert.equal(qizheng.calculationContext.moonPhase.utcDateTime, utc);
  for (const name of ['Sun', 'Moon']) {
    const actual = astrolabe.planets.find((planet) => planet.name === name)!;
    const expected = facts.bodies.find((body) => body.name === name)!;
    assert.ok(Math.abs(actual.longitude - expected.longitudeDegrees) < 1e-7);
  }
});
