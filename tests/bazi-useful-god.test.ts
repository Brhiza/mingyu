import test from 'node:test';
import assert from 'node:assert/strict';

import * as baziApi from '@core/bazi/index';
import { baziCalculator } from '@core/bazi/baziCalculator';

test('未校自动用神和落点规则不得作为公共算法或新结果输出', () => {
  const result = baziCalculator.calculateBazi({
    year: 1995,
    month: 8,
    day: 15,
    timeIndex: 8,
    gender: 'female',
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });

  assert.equal('determineUsefulGod' in baziApi, false);
  assert.equal('analyzeUsefulGodPlacement' in baziApi, false);
  assert.equal('usefulGod' in result.analysis, false);
  assert.ok(result.analysis.dayMasterStrength.details.ruleBasis.length > 0);
  assert.ok(result.analysis.mingGe.basis);
});
