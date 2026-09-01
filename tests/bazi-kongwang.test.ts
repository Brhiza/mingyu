import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateKongWang, calculateKongWangBranches } from '@core/bazi/kongWang';

test('旬空计算应符合六旬固定真值', () => {
  const samples = {
    甲子: ['戌', '亥'],
    乙卯: ['子', '丑'],
    癸巳: ['午', '未'],
    丁丑: ['申', '酉'],
    庚辰: ['申', '酉'],
  } as const;

  for (const [ganZhi, expected] of Object.entries(samples)) {
    const actual = calculateKongWang({
      year: { gan: ganZhi[0], zhi: ganZhi[1], ganZhi },
      month: { gan: ganZhi[0], zhi: ganZhi[1], ganZhi },
      day: { gan: ganZhi[0], zhi: ganZhi[1], ganZhi },
      hour: { gan: ganZhi[0], zhi: ganZhi[1], ganZhi },
    }).year;

    assert.deepEqual(actual, [...expected]);
  }
});

test('空亡计算遇到非法干支应明确报错，不能降级成空结果', () => {
  assert.throws(() => calculateKongWangBranches('甲', '甲'), /空亡干支地支无效/);
});
