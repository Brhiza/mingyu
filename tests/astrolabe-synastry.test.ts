import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeAstrolabeSynastry } from 'mingyu-core/divination/astrolabe-synastry';
import type { AstrolabeData, AstrolabePoint } from 'mingyu-core/types';

function point(name: string, label: string, longitude: number, house = 1): AstrolabePoint {
  return {
    name,
    label,
    longitude,
    sign: '测试星座',
    degree: 0,
    minute: 0,
    house,
    formatted: `${longitude}°`,
  };
}

function chart(name: string, sun: number, moon: number): AstrolabeData {
  return {
    birth: {
      name,
      gender: '女',
      dateTime: '2000-01-01 12:00',
      location: '测试地点',
      timezone: 8,
    },
    planets: [point('Sun', '太阳', sun), point('Moon', '月亮', moon)],
    angles: [point('Ascendant', '上升', 15)],
    houses: Array.from({ length: 12 }, (_, index) =>
      point(`House ${index + 1}`, `第${index + 1}宫`, index * 30, index + 1),
    ),
    aspects: [],
    summary: { elements: {}, modalities: {}, retrograde: [], patterns: [] },
    timestamp: 0,
  };
}

test('西占双盘应按黄经最小夹角识别主要相位并保留计算口径', () => {
  const result = analyzeAstrolabeSynastry(chart('甲', 359, 120), chart('乙', 1, 210));
  const conjunction = result.aspects.find(
    (item) => item.point1 === '太阳' && item.point2 === '太阳',
  );
  const square = result.aspects.find((item) => item.point1 === '月亮' && item.point2 === '月亮');

  assert.equal(conjunction?.type, '合相');
  assert.equal(conjunction?.actualAngle, 2);
  assert.equal(conjunction?.orb, 2);
  assert.equal(square?.type, '刑相');
  assert.equal(square?.orb, 0);
  assert.equal(result.methodology.defaultOrbs.合相, 8);
  assert.match(result.promptText, /此处只记录跨盘相位事实，不单独推导关系吉凶/);
  assert.match(result.promptText, /不得把单一和谐相位写成必然适合/);
});

test('西占双盘应计算双方星体落入对方宫位', () => {
  const result = analyzeAstrolabeSynastry(chart('甲', 35, 125), chart('乙', 65, 215));
  const overlay = result.houseOverlays.find(
    (item) => item.owner === '甲' && item.visitor === '乙' && item.point === '太阳',
  );

  assert.equal(overlay?.house, 3);
  assert.equal(overlay?.houseStart, 60);
  assert.equal(overlay?.houseEnd, 90);
});

test('西占双盘应允许显式调整容许度并拒绝非法参数', () => {
  const first = chart('甲', 0, 120);
  const second = chart('乙', 7, 210);

  assert.ok(
    analyzeAstrolabeSynastry(first, second).aspects.some(
      (item) => item.point1 === '太阳' && item.point2 === '太阳',
    ),
  );
  assert.ok(
    !analyzeAstrolabeSynastry(first, second, { aspectOrbs: { 合相: 5 } }).aspects.some(
      (item) => item.point1 === '太阳' && item.point2 === '太阳',
    ),
  );
  assert.throws(
    () => analyzeAstrolabeSynastry(first, second, { aspectOrbs: { 合相: 20 } }),
    /合相容许度需在 0 到 15 度之间/,
  );
  assert.throws(
    () => analyzeAstrolabeSynastry(first, second, { maxAspects: 0 }),
    /最大相位数需为 1 到 200 之间的整数/,
  );
});
