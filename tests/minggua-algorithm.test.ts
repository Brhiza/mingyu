import test from 'node:test';
import assert from 'node:assert/strict';

import { baziCalculator } from '@core/bazi/baziCalculator';
import { calculateMingGua } from '../packages/core/src/bazi/mingGua';

test('八宅命卦公式应按年命数计算并处理五黄寄宫', () => {
  assert.deepEqual(calculateMingGua(2000, 'male'), {
    number: 9,
    gua: '离',
    star: '九紫右弼',
    element: '火',
    eastWest: '东四命',
  });

  assert.deepEqual(calculateMingGua(2023, 'male'), {
    number: 4,
    gua: '巽',
    star: '四绿文曲',
    element: '木',
    eastWest: '东四命',
  });

  assert.deepEqual(calculateMingGua(2023, 'female'), {
    number: 2,
    gua: '坤',
    star: '二黑巨门',
    element: '土',
    eastWest: '西四命',
  });

  assert.deepEqual(calculateMingGua(2022, 'male'), {
    number: 2,
    gua: '坤',
    star: '二黑巨门',
    element: '土',
    eastWest: '西四命',
  });

  assert.deepEqual(calculateMingGua(2026, 'female'), {
    number: 8,
    gua: '艮',
    star: '八白左辅',
    element: '土',
    eastWest: '西四命',
  });
});

test('八字排盘结果应输出命卦，并按立春年界取年', () => {
  const beforeLichun = baziCalculator.calculateBazi({
    year: 2024,
    month: 2,
    day: 3,
    timeIndex: 6,
    gender: 'male',
  });
  const afterLichun = baziCalculator.calculateBazi({
    year: 2024,
    month: 2,
    day: 5,
    timeIndex: 6,
    gender: 'male',
  });

  assert.equal(beforeLichun.pillars.year.ganZhi, '癸卯');
  assert.equal(beforeLichun.mingGua.number, 4);
  assert.equal(beforeLichun.mingGua.gua, '巽');

  assert.equal(afterLichun.pillars.year.ganZhi, '甲辰');
  assert.equal(afterLichun.mingGua.number, 3);
  assert.equal(afterLichun.mingGua.gua, '震');
});
