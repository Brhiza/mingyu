import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateSolarTermEvidence, getDivinationTime } from 'mingyu-core/calendar';
import { generateJinkoujue } from '../packages/core/src/divination/algorithms/jinkoujue';
import { generateLiuren } from '../packages/core/src/divination/algorithms/liuren';

const rainWater = Date.parse('2024-02-19T12:13:12+08:00');
const springEquinox = Date.parse('2024-03-20T11:06:25+08:00');

test('大六壬在雨水整秒边界前后切换月将', () => {
  const before = new Date(rainWater - 1000);
  const after = new Date(rainWater);
  assert.equal(generateLiuren(before).monthLeader, '子', '雨水前仍为大寒月将子');
  assert.equal(generateLiuren(after).monthLeader, '亥', '雨水整秒起为月将亥');
  assert.equal(after.getUTCMinutes(), before.getUTCMinutes());
});

test('金口诀在雨水整秒边界前后切换月将', () => {
  const before = new Date(rainWater - 1000);
  const after = new Date(rainWater);
  assert.equal(generateJinkoujue({ customDate: before }).monthLeader, '子');
  assert.equal(generateJinkoujue({ customDate: after }).monthLeader, '亥');
  assert.equal(after.getUTCMinutes(), before.getUTCMinutes());
});

test('固定中气交接秒与共享历法采用时刻一致', () => {
  for (const [index, boundary, previousTerm, nextTerm] of [
    [4, rainWater, '立春', '雨水'],
    [6, springEquinox, '惊蛰', '春分'],
  ] as const) {
    assert.equal(calculateSolarTermEvidence(2024, index).utcTimestamp, boundary);
    assert.equal(getDivinationTime(new Date(boundary - 1000)).timeInfo.jieQi, previousTerm);
    assert.equal(getDivinationTime(new Date(boundary)).timeInfo.jieQi, nextTerm);
  }
});

test('春分的小数秒向下舍入用例在共享历法整秒即切换两种月将', () => {
  // 此交接时刻用于覆盖原始天文小数时刻晚于采用整秒时刻的边界。
  const before = new Date(springEquinox - 1000);
  const after = new Date(springEquinox);
  assert.equal(generateLiuren(before).monthLeader, '亥');
  assert.equal(generateLiuren(after).monthLeader, '戌');
  assert.equal(generateJinkoujue({ customDate: before }).monthLeader, '亥');
  assert.equal(generateJinkoujue({ customDate: after }).monthLeader, '戌');
  assert.equal(after.getUTCMinutes(), before.getUTCMinutes());
});
