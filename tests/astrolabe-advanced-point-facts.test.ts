import test from 'node:test';
import assert from 'node:assert/strict';

import { generateAstrolabe } from 'mingyu-core/divination/astrolabe';
import {
  calculateSecondaryProgressionEvidence,
  calculateSolarArcEvidence,
  calculateSolarReturnEvidence,
} from 'mingyu-core/divination/astrolabe-scope';

const data = generateAstrolabe({
  name: '高级点位合成验证',
  gender: '男',
  year: '2024',
  month: '3',
  day: '20',
  hour: '11',
  minute: '0',
  second: '0',
  latitude: '39.9042',
  longitude: '116.416334',
  timezone: '8',
  locationName: '北京',
});

test('三种高级时限保留全部移动点和完整候选相位关联', () => {
  const evidence = [
    calculateSecondaryProgressionEvidence(data, 2028),
    calculateSolarArcEvidence(data, 2028),
    calculateSolarReturnEvidence(data, 2028),
  ];
  for (const [index, item] of evidence.entries()) {
    assert.ok(['calculated', 'exact', 'approximate'].includes(item.status));
    assert.equal(item.movingPointFacts.length, [5, 14, 14][index]);
    const points = new Map(item.movingPointFacts.map((point) => [point.key, point]));
    const all = new Map(item.candidateAspectFacts.map((fact) => [fact.key, fact]));
    assert.equal(all.size, item.candidateAspectFacts.length);
    for (const fact of item.candidateAspectFacts) {
      assert.ok(points.has(fact.movingPointKey));
      assert.ok(fact.natalPointKey.startsWith('natal-point:'));
      assert.ok(Math.abs(Math.abs(fact.actualAngle - fact.exactAngle) - fact.deviation) < 2e-6);
    }
    assert.deepEqual(item.aspectFacts, item.candidateAspectFacts.slice(0, index === 1 ? 6 : 8));
    for (const point of item.movingPointFacts) {
      assert.ok(Number.isFinite(point.longitude));
      assert.ok(point.longitude >= 0 && point.longitude < 360);
      assert.deepEqual(
        point.candidateAspectFactKeys,
        item.candidateAspectFacts
          .filter((fact) => fact.movingPointKey === point.key)
          .map((fact) => fact.key),
      );
      assert.deepEqual(
        point.aspectFactKeys,
        item.aspectFacts
          .filter((fact) => fact.movingPointKey === point.key)
          .map((fact) => fact.key),
      );
      if (index === 1) {
        assert.equal(point.house, undefined);
        assert.equal(point.sourceName, point.name);
        for (const key of ['latitude', 'distance', 'longitudeSpeed', 'retrograde'] as const) {
          assert.equal(point[key], undefined);
        }
        const original = [...data.planets, ...data.angles].find(
          (candidate) => candidate.name === point.name,
        )!;
        const arc = (item as ReturnType<typeof calculateSolarArcEvidence>).arcDegrees!;
        assert.ok(Math.abs(((original.longitude + arc) % 360) - point.longitude) < 1e-6);
      } else if (index === 0 || !data.angles.some((angle) => angle.name === point.name)) {
        assert.equal(typeof point.retrograde, 'boolean');
        assert.ok(Number.isFinite(point.latitude));
        assert.ok(point.distance! > 0);
        assert.ok(Number.isFinite(point.longitudeSpeed));
        if (index === 0) assert.equal(point.house, undefined);
        else assert.ok(point.house! >= 1 && point.house! <= 12);
      } else {
        assert.equal(point.house, undefined);
        assert.equal(point.retrograde, undefined);
      }
    }
  }
});

test('无相位点与超出展示上限的相位仍保留原始事实', () => {
  const sun = data.planets.find((point) => point.name === 'Sun')!;
  const shifted = {
    ...data,
    planets: data.planets.map((point) => ({ ...point, longitude: (sun.longitude + 17) % 360 })),
    angles: data.angles.map((point) => ({ ...point, longitude: (sun.longitude + 17) % 360 })),
  };
  const sparse = calculateSecondaryProgressionEvidence(shifted, 2024);
  assert.equal(sparse.status, 'calculated');
  assert.equal(sparse.movingPointFacts.length, 5);
  const movingSun = sparse.movingPointFacts.find((point) => point.name === 'Sun')!;
  assert.deepEqual(movingSun.candidateAspectFactKeys, []);
  assert.deepEqual(movingSun.aspectFactKeys, []);

  const aligned = {
    ...data,
    planets: data.planets.map((point) => ({ ...point, longitude: sun.longitude })),
    angles: data.angles.map((point) => ({ ...point, longitude: sun.longitude })),
  };
  const dense = calculateSecondaryProgressionEvidence(aligned, 2024);
  assert.equal(dense.status, 'calculated');
  assert.equal(dense.aspectFacts.length, 8);
  assert.ok(dense.candidateAspectFacts.length > dense.aspectFacts.length);
  assert.ok(dense.candidateAspectFacts.every((fact) => Number.isFinite(fact.actualAngle)));
});

test('不适用和不可用状态保留空事实，年龄零的次限位置等于本命真实位置', () => {
  for (const calculate of [
    calculateSecondaryProgressionEvidence,
    calculateSolarArcEvidence,
    calculateSolarReturnEvidence,
  ]) {
    const earlier = calculate(data, 2023);
    assert.equal(earlier.status, 'not-applicable');
    assert.deepEqual(earlier.movingPointFacts, []);
    assert.deepEqual(earlier.candidateAspectFacts, []);
    const incomplete = calculate(
      { ...data, birth: { ...data.birth, standardDateTime: '无效时间' } },
      2028,
    );
    assert.equal(incomplete.status, 'unavailable');
    assert.deepEqual(incomplete.movingPointFacts, []);
    assert.deepEqual(incomplete.candidateAspectFacts, []);
  }
  const current = calculateSecondaryProgressionEvidence(data, 2024);
  for (const point of current.movingPointFacts) {
    const natal = data.planets.find((candidate) => candidate.name === point.name)!;
    assert.equal(point.longitude, natal.longitude);
    assert.equal(point.latitude, natal.latitude);
    assert.equal(point.distance, natal.distance);
    assert.equal(point.longitudeSpeed, natal.longitudeSpeed);
    assert.equal(point.retrograde, natal.retrograde);
  }
});
