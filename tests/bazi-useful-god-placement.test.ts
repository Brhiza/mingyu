import assert from 'node:assert/strict';
import test from 'node:test';

import { analyzeUsefulGodPlacement } from '@core/bazi/usefulGodPlacement';

const pillars = [
  { gan: '甲', zhi: '寅' },
  { gan: '庚', zhi: '申' },
  { gan: '丙', zhi: '子' },
  { gan: '乙', zhi: '酉' },
];

test('喜忌落位只记录归属和显藏位置，不从归属推断力量或制约', () => {
  const result = analyzeUsefulGodPlacement(pillars, '丙', (stem) => stem, ['木'], ['金']);

  assert.deepEqual(
    result.items.map(({ pillar, stem, status, evidence }) => ({ pillar, stem, status, evidence })),
    [
      { pillar: 'year', stem: '甲', status: '喜用五行透出', evidence: '甲透于year' },
      { pillar: 'year', stem: '甲', status: '喜用五行藏支', evidence: '甲藏于寅' },
      { pillar: 'year', stem: '丙', status: '中性', evidence: '丙藏于寅' },
      { pillar: 'year', stem: '戊', status: '中性', evidence: '戊藏于寅' },
      { pillar: 'month', stem: '庚', status: '忌神五行透出', evidence: '庚透于month' },
      { pillar: 'month', stem: '庚', status: '忌神五行藏支', evidence: '庚藏于申' },
      { pillar: 'month', stem: '壬', status: '中性', evidence: '壬藏于申' },
      { pillar: 'month', stem: '戊', status: '中性', evidence: '戊藏于申' },
      { pillar: 'day', stem: '丙', status: '中性', evidence: '丙透于day' },
      { pillar: 'day', stem: '癸', status: '中性', evidence: '癸藏于子' },
      { pillar: 'hour', stem: '乙', status: '喜用五行透出', evidence: '乙透于hour' },
      { pillar: 'hour', stem: '辛', status: '忌神五行藏支', evidence: '辛藏于酉' },
    ],
  );
  assert.equal(result.favorableCount, 3);
  assert.equal(result.unfavorableCount, 3);
});

test('同一五行同时列为喜用和忌神时报告冲突且不计入任一归属', () => {
  const result = analyzeUsefulGodPlacement(pillars, '丙', (stem) => stem, ['木', '金'], ['金']);

  assert.deepEqual(
    result.items.filter(({ status }) => status === '喜忌冲突').map(({ stem }) => stem),
    ['庚', '庚', '辛'],
  );
  assert.equal(result.favorableCount, 3);
  assert.equal(result.unfavorableCount, 0);
});
