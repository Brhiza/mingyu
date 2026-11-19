import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessClimateRule } from '../src/systems/bazi/climate-match';

test('缺失输入不等于空集合，未知条件不静默通过', () => {
  assert.equal(assessClimateRule({ id: 'example', forbiddenVisibleStems: ['丙'] }, {}).status, '资料不足');
  assert.equal(assessClimateRule({ id: 'example', forbiddenVisibleStems: ['丙'] }, { visibleStems: [] }).status, '满足');
  assert.throws(() => assessClimateRule({ id: 'example', unsupportedCondition: true }, {}), /未知调候规则条件/);
});
