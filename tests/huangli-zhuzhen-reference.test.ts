import test from 'node:test';
import assert from 'node:assert/strict';
import { generateAlmanacSelection } from '../packages/core/src/divination/algorithms/almanac';

test('未月戊午日不将与逐阵同列时仍保留嫁娶避忌', () => {
  // 《协纪辨方书》阴阳不将条：六月戊午为逐阵不可用。
  // https://www.shidianguji.com/book/SK1619/chapter/1l9llprtui2pg
  const day = generateAlmanacSelection({
    topic: 'marriage',
    startDate: '2029-07-27',
    endDate: '2029-07-27',
  }).days[0];
  assert.equal(day.ganzhi.month, '辛未');
  assert.equal(day.ganzhi.day, '戊午');
  assert.ok(day.gods.includes('不将'));
  assert.ok(day.gods.includes('逐阵'));
  assert.ok(day.avoids.includes('嫁娶'));
  assert.equal(day.recommends.includes('嫁娶'), false);
  assert.ok(day.cautions.includes('黄历忌项触及订婚结婚'));
});
