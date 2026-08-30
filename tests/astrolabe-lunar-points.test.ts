import test from 'node:test';
import assert from 'node:assert/strict';

import { generateAstrolabe } from 'mingyu-core/divination/astrolabe';
import type { AstrolabeBirthInput } from 'mingyu-core/types';

// 参考值取自 Swiss Ephemeris 2.10（se1 星历文件，SE_OSCU_APOG=13 / SE_TRUE_NODE=11，
// flag=2 即星历文件生效）。本地复核脚本对照 20 个 1900-2100 年用例：
// 修正后真莉莉丝最大偏差 425″（≈0.12°），真北交点最大偏差 12″（≈0.0034°）。
// 断言容差取 0.25°（莉莉丝）与 0.01°（交点），为不同星历源间残差留余量。
const LILITH_TOLERANCE_DEG = 0.25;
const NODE_TOLERANCE_DEG = 0.01;

interface ReferenceCase {
  label: string;
  input: AstrolabeBirthInput;
  expectedLilithLongitude: number;
  expectedNorthNodeLongitude: number;
}

const baseInput = {
  name: '参考用例',
  latitude: '39.9042',
  longitude: '116.4074',
  timezone: '8',
  locationName: '北京',
};

const cases: ReferenceCase[] = [
  {
    label: '1990-01-01 10:30 UTC（北京时间 18:30）',
    input: { ...baseInput, year: '1990', month: '1', day: '1', hour: '18', minute: '30' },
    expectedLilithLongitude: 230.1155,
    expectedNorthNodeLongitude: 316.8689,
  },
  {
    label: '2008-08-08 12:00 UTC（北京时间 20:00）',
    input: { ...baseInput, year: '2008', month: '8', day: '8', hour: '20', minute: '0' },
    expectedLilithLongitude: 252.3543,
    expectedNorthNodeLongitude: 318.5629,
  },
  {
    label: '1937-07-07 15:30 UTC（北京时间 23:30）',
    input: { ...baseInput, year: '1937', month: '7', day: '7', hour: '23', minute: '30' },
    expectedLilithLongitude: 257.2845,
    expectedNorthNodeLongitude: 254.9239,
  },
  {
    label: '2026-08-31 00:00 UTC（北京时间 08:00）',
    input: { ...baseInput, year: '2026', month: '8', day: '31', hour: '8', minute: '0' },
    expectedLilithLongitude: 267.6543,
    expectedNorthNodeLongitude: 329.8161,
  },
];

function angularDifferenceDeg(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

for (const { label, input, expectedLilithLongitude, expectedNorthNodeLongitude } of cases) {
  test(`真莉莉丝与真交点应对齐 Swiss Ephemeris：${label}`, () => {
    const astrolabe = generateAstrolabe(input);

    const lilith = astrolabe.planets.find((point) => point.name === 'True Lilith');
    const northNode = astrolabe.planets.find((point) => point.name === 'North Node');
    const southNode = astrolabe.planets.find((point) => point.name === 'South Node');

    assert.ok(lilith, '星盘应包含真莉莉丝');
    assert.ok(northNode, '星盘应包含北交点');
    assert.ok(southNode, '星盘应包含南交点');

    const lilithDiff = angularDifferenceDeg(lilith.longitude, expectedLilithLongitude);
    assert.ok(
      lilithDiff <= LILITH_TOLERANCE_DEG,
      `真莉莉丝黄经 ${lilith.longitude.toFixed(4)}° 与 Swiss Ephemeris ${expectedLilithLongitude.toFixed(4)}° 偏差 ${lilithDiff.toFixed(4)}° 超出容差 ${LILITH_TOLERANCE_DEG}°`,
    );

    const nodeDiff = angularDifferenceDeg(northNode.longitude, expectedNorthNodeLongitude);
    assert.ok(
      nodeDiff <= NODE_TOLERANCE_DEG,
      `真北交点黄经 ${northNode.longitude.toFixed(4)}° 与 Swiss Ephemeris ${expectedNorthNodeLongitude.toFixed(4)}° 偏差 ${nodeDiff.toFixed(4)}° 超出容差 ${NODE_TOLERANCE_DEG}°`,
    );

    const southDiff = angularDifferenceDeg(southNode.longitude, northNode.longitude + 180);
    assert.ok(southDiff <= 1e-6, '南交点应与北交点严格相差 180°');
  });
}

test('真莉莉丝修正后不应再出现整星座级别的错位', () => {
  // 修复前该用例真莉莉丝偏差约 16.8°（celestine 给出白羊 16.69°，实际应为双鱼 29.93°），
  // 星座落位直接错位；修复后应 <0.25° 且星座一致。
  const astrolabe = generateAstrolabe({
    ...baseInput,
    year: '1949',
    month: '10',
    day: '1',
    hour: '15',
    minute: '0',
  });
  const lilith = astrolabe.planets.find((point) => point.name === 'True Lilith');
  assert.ok(lilith, '星盘应包含真莉莉丝');
  const expectedSign = Math.floor(359.9288 / 30);
  assert.equal(
    Math.floor(lilith.longitude / 30),
    expectedSign,
    `真莉莉丝应落在与 Swiss Ephemeris 相同的星座（索引 ${expectedSign}）`,
  );
  const diff = angularDifferenceDeg(lilith.longitude, 359.9288);
  assert.ok(diff <= LILITH_TOLERANCE_DEG, `真莉莉丝偏差 ${diff.toFixed(4)}° 超出容差`);
});
