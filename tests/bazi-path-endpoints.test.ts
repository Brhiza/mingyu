import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluatePatternFulfillment } from '../packages/core/src/bazi/baziPatternFulfillment';
import { getTenGod } from '../packages/core/src/bazi/baziUtils';
import type { Pillars } from '../packages/core/src/bazi/baziTypes';

test('一端仅藏待核时，另一端明确无根仍使制化路径不满足', () => {
  // 结构夹具：寅藏丙、子藏癸，四支均无金根；只验证路径必要条件。
  const pillars = {
    year: { gan: '辛', zhi: '卯' },
    month: { gan: '庚', zhi: '寅' },
    day: { gan: '甲', zhi: '寅' },
    hour: { gan: '甲', zhi: '子' },
  } as Pillars;
  const result = evaluatePatternFulfillment(pillars, '甲', '七杀格', getTenGod);
  assert.equal(
    result.rootEvidence!.find((item) => item.stem === '庚' && item.placement === '透干')?.rooted,
    false,
  );
  for (const key of ['食神制杀', '七杀生印']) {
    const path = result.pathEvaluations!.find((item) => item.key === key)!;
    assert.equal(path.status, '不满足', key);
    assert.match(path.detail, /无稳定根/);
  }

  // 将年支换成金根后，明确失败的条件消失；仅藏端仍须保持待核。
  const rooted = evaluatePatternFulfillment(
    { ...pillars, year: { ...pillars.year, zhi: '酉' } },
    '甲',
    '七杀格',
    getTenGod,
  );
  for (const key of ['食神制杀', '七杀生印']) {
    assert.equal(rooted.pathEvaluations!.find((item) => item.key === key)?.status, '资料不足');
  }
});

test('路径柱位只描述通过根气和作用条件筛选的端点', () => {
  // 柱位条件夹具，不作为出生历法样本：月柱癸受丑本气己制，时柱壬可承接。
  const pillars = {
    year: { gan: '庚', zhi: '午' },
    month: { gan: '癸', zhi: '丑' },
    day: { gan: '甲', zhi: '辰' },
    hour: { gan: '壬', zhi: '申' },
  } as Pillars;
  const result = evaluatePatternFulfillment(pillars, '甲', '七杀格', getTenGod);
  const path = result.pathEvaluations!.find((item) => item.key === '七杀生印')!;
  assert.equal(path.status, '资料不足');
  assert.deepEqual(path.sourceStems, ['庚']);
  assert.deepEqual(path.targetStems, ['壬']);
  assert.match(path.detail, /隔位/);
  assert.equal(path.position, '隔位');
  assert.ok(path.positionPairs.every((item) => !item.includes('月柱')));
});
