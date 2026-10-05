import assert from 'node:assert/strict';
import test from 'node:test';
import { baziCalculator } from '../packages/core/src/bazi/baziCalculator';

test('一项官星已有效且救应不成立时，不因同组另一透干待核掩盖伤官格破格', () => {
  const chart = baziCalculator.calculateBazi({
    year: 2000,
    month: 8,
    day: 19,
    timeIndex: 0,
    gender: 'male',
  });
  assert.deepEqual(
    Object.values(chart.pillars).map((pillar) => pillar.ganZhi),
    ['庚辰', '甲申', '己酉', '甲子'],
  );
  assert.equal(chart.analysis.dayMasterStrength.status, '偏弱');
  assert.equal(chart.analysis.mingGe.pattern, '伤官格');

  const fulfillment = chart.analysis.mingGe.fulfillment;
  assert.ok(fulfillment);
  assert.equal(
    fulfillment.conditionFacts?.find((fact) => fact.key === 'pattern.target')?.status,
    '满足',
  );
  assert.equal(
    fulfillment.conditionFacts?.find((fact) => fact.key === 'pattern.breaker.1')?.status,
    '资料不足',
  );
  assert.deepEqual(fulfillment.activeBreakers?.[0]?.stems, [
    { stem: '甲', tenGod: '正官', pillar: 'hour', pillarName: '时柱' },
  ]);
  assert.equal(fulfillment.activeBreakers?.[0]?.repairStatus, '不满足');
  assert.equal(fulfillment.status, '破格');
  assert.deepEqual(chart.analysis.usefulGod.conditionalUnfavorableStems, ['甲']);
  assert.equal(chart.analysis.usefulGod.primaryUseful, '印星');
});

test('格神自身未透干时，仍按目标条件资料不足保留未判定', () => {
  const chart = baziCalculator.calculateBazi({
    year: 1990,
    month: 7,
    day: 13,
    timeIndex: 12,
    gender: 'male',
  });
  assert.deepEqual(
    Object.values(chart.pillars).map((pillar) => pillar.ganZhi),
    ['庚午', '癸未', '庚辰', '丙子'],
  );
  assert.equal(chart.analysis.mingGe.pattern, '正官格');
  assert.equal(
    chart.analysis.mingGe.fulfillment?.conditionFacts?.find((fact) => fact.key === 'pattern.target')
      ?.status,
    '资料不足',
  );
  assert.equal(chart.analysis.mingGe.fulfillment?.status, '未判定');
  assert.equal(chart.analysis.usefulGod.conditionalUnfavorableStems, undefined);
});
