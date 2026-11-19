import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPillarFacts } from '../src/systems/bazi/pillars';
import { buildPatternEvidence } from '../src/systems/bazi/pattern-evidence';

test('无破冲的合绊与外干冲破分开，月令同神和司权均可提供门槛', () => {
  const pillars = buildPillarFacts({ year: '壬申', month: '癸丑', day: '甲午', hour: '癸酉' });
  const value = buildPatternEvidence(pillars, { pattern: '正印格', source: '普通月令取格候选', limitation: '' }, '己');
  assert.equal(value.monthGate?.status, '满足');
  assert.equal(value.visible.find((item) => item.position === 'month')?.effective, false);
  assert.equal(value.visible.find((item) => item.position === 'hour')?.effective, true);
});
