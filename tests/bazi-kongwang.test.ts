import test from 'node:test';
import assert from 'node:assert/strict';
import { SixtyCycle } from 'tyme4ts';

import { calculateKongWang, calculateKongWangBranches } from '@core/bazi/kongWang';

test('旬空计算应与 tyme4ts 的空亡结果一致', () => {
  const samples = ['甲子', '乙卯', '癸巳', '丁丑', '庚辰'];

  for (const ganZhi of samples) {
    const expected = SixtyCycle.fromName(ganZhi)
      .getExtraEarthBranches()
      .map((item) => item.getName());
    const actual = calculateKongWang({
      year: { gan: ganZhi[0], zhi: ganZhi[1], ganZhi },
      month: { gan: ganZhi[0], zhi: ganZhi[1], ganZhi },
      day: { gan: ganZhi[0], zhi: ganZhi[1], ganZhi },
      hour: { gan: ganZhi[0], zhi: ganZhi[1], ganZhi },
    }).year;

    assert.deepEqual(actual, expected);
  }
});

test('空亡计算遇到非法干支应明确报错，不能降级成空结果', () => {
  assert.throws(() => calculateKongWangBranches('甲', '甲'), /空亡干支地支无效/);
});
