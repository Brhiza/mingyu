import test from 'node:test';
import assert from 'node:assert/strict';
import { SixtyCycle } from 'tyme4ts';

import { calculateKongWang } from '@core/bazi/baziCalculatorHelpers';

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
