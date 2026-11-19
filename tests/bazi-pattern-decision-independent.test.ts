import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPillarFacts } from '../src/systems/bazi/pillars';
import { buildPatternEvidence } from '../src/systems/bazi/pattern-evidence';

test('财格救应成立后仍须检查身承财；特殊格不套用普通模型', () => {
  const pillars = buildPillarFacts({ year: '丁丑', month: '癸巳', day: '丙子', hour: '庚午' });
  const pattern = { pattern: '偏财格', source: '普通月令取格候选', limitation: '' };
  const strong = buildPatternEvidence(pillars, pattern, '戊', '身强').decision!;
  assert.equal(strong.status, '破而复成');
  assert.equal(strong.breakers[0].label, '比劫夺财');
  assert.equal(strong.breakers[0].repairStatus, '满足');
  const weak = buildPatternEvidence(pillars, pattern, '戊', '身弱').decision!;
  assert.equal(weak.status, '未判定');
  assert.equal(weak.wealthBearing, '不满足');
  assert.match(weak.reason, /有限格神结构为破而复成/);
  assert.equal(buildPatternEvidence(pillars, { ...pattern, source: '从财优先条件模型' }, '戊', '身弱').decision, null);
});
