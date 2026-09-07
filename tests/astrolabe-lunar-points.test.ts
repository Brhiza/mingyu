import assert from 'node:assert/strict';
import test from 'node:test';

import { generateAstrolabe } from 'mingyu-core/divination/astrolabe';
import type { AstrolabeBirthInput } from 'mingyu-core/types';
import { getApparentPosition, toJulianDate } from '../packages/core/src/astrology/engine';

// 参考值取自 Swiss Ephemeris 2.10（se1 星历文件，SE_OSCU_APOG=13、SE_TRUE_NODE=11）。
// 容差为不同星历模型保留余量，并远小于会造成占星落位误判的角度。
const LILITH_TOLERANCE_DEG = 0.25;
const NODE_TOLERANCE_DEG = 0.01;

const baseInput = {
  name: '参考用例',
  latitude: '39.9042',
  longitude: '116.4074',
  timezone: '8',
  locationName: '北京',
};

const cases: Array<{
  label: string;
  input: AstrolabeBirthInput;
  lilith: number;
  northNode: number;
}> = [
  {
    label: '1990-01-01 10:30 UTC',
    input: { ...baseInput, year: '1990', month: '1', day: '1', hour: '18', minute: '30' },
    lilith: 230.1155,
    northNode: 316.8689,
  },
  {
    label: '2008-08-08 12:00 UTC',
    input: { ...baseInput, year: '2008', month: '8', day: '8', hour: '20', minute: '0' },
    lilith: 252.3543,
    northNode: 318.5629,
  },
  {
    label: '1937-07-07 15:30 UTC',
    input: { ...baseInput, year: '1937', month: '7', day: '7', hour: '23', minute: '30' },
    lilith: 257.2845,
    northNode: 254.9239,
  },
  {
    label: '2026-08-31 00:00 UTC',
    input: { ...baseInput, year: '2026', month: '8', day: '31', hour: '8', minute: '0' },
    lilith: 267.6543,
    northNode: 329.8161,
  },
];

function angularDifference(first: number, second: number): number {
  const difference = Math.abs(first - second) % 360;
  return difference > 180 ? 360 - difference : difference;
}

for (const reference of cases) {
  test(`真莉莉丝与真交点应对齐 Swiss Ephemeris：${reference.label}`, () => {
    const chart = generateAstrolabe(reference.input);
    const lilith = chart.planets.find((point) => point.name === 'True Lilith');
    const northNode = chart.planets.find((point) => point.name === 'North Node');
    const southNode = chart.planets.find((point) => point.name === 'South Node');

    assert.ok(lilith);
    assert.ok(northNode);
    assert.ok(southNode);
    assert.ok(angularDifference(lilith.longitude, reference.lilith) <= LILITH_TOLERANCE_DEG);
    assert.ok(angularDifference(northNode.longitude, reference.northNode) <= NODE_TOLERANCE_DEG);
    assert.ok(angularDifference(southNode.longitude, northNode.longitude + 180) <= 1e-6);
  });
}

test('相位几何量应由最终真莉莉丝和真交点黄经计算', () => {
  const chart = generateAstrolabe({
    ...baseInput,
    year: '1949',
    month: '10',
    day: '1',
    hour: '15',
    minute: '0',
  });
  const points = new Map(chart.planets.map((point) => [point.label, point]));

  for (const aspect of chart.aspects) {
    const first = points.get(aspect.body1);
    const second = points.get(aspect.body2);
    assert.ok(first, `缺少相位主体 ${aspect.body1}`);
    assert.ok(second, `缺少相位主体 ${aspect.body2}`);
    assert.notEqual(aspect.actualAngle, undefined);
    assert.notEqual(aspect.exactAngle, undefined);
    const actualAngle = angularDifference(first.longitude, second.longitude);
    assert.ok(Math.abs((aspect.actualAngle as number) - actualAngle) <= 0.0001);
    assert.equal(
      aspect.orb,
      Number(Math.abs(actualAngle - (aspect.exactAngle as number)).toFixed(2)),
    );
  }
});

test('完整星盘交点与莉莉丝逆行标志保留底层星历方向', () => {
  const chart = generateAstrolabe({
    ...baseInput,
    year: '2026',
    month: '1',
    day: '1',
    hour: '20',
    minute: '0',
  });
  const jd = toJulianDate({ year: 2026, month: 1, day: 1, hour: 20, minute: 0, timezone: 8 });
  for (const [name, id] of [
    ['North Node', 'true_node'],
    ['South Node', 'true_node'],
    ['True Lilith', 'true_lilith'],
  ] as const) {
    const point = chart.planets.find((item) => item.name === name)!;
    assert.equal(point.retrograde, getApparentPosition(id, jd).speed < 0, name);
  }
});
