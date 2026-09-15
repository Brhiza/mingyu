import assert from 'node:assert/strict';
import test from 'node:test';
import { identifyClassicPattern } from '@core/bazi/baziEnhancement/classicPatterns';
import {
  collectCompleteBranchFormations,
  collectEstablishedBranchFormations,
} from '@core/bazi/baziFormationUtils';
import { HIDDEN_STEMS } from '@core/bazi/baziDefinitions';
import type { HiddenStems, Pillars } from '@core/bazi/baziTypes';

function makePillars(values: string[]): Pillars {
  return Object.fromEntries(
    ['year', 'month', 'day', 'hour'].map((key, index) => [
      key,
      { gan: values[index][0], zhi: values[index][1], ganZhi: values[index] },
    ]),
  ) as Pillars;
}
function identify(pillars: Pillars) {
  const hidden = Object.fromEntries(
    Object.entries(pillars).map(([key, pillar]) => [key, HIDDEN_STEMS[pillar.zhi]]),
  ) as HiddenStems;
  return identifyClassicPattern(pillars.day.gan, pillars.month.zhi, pillars, hidden, '普通格局');
}

const structures = [
  { name: '润下格', values: ['戊子', '庚申', '壬辰', '庚子'], breaker: '戊寅' },
  { name: '炎上格', values: ['丙午', '乙巳', '丁未', '乙卯'], breaker: '癸亥' },
  { name: '从革格', values: ['壬戌', '庚申', '辛酉', '癸亥'], breaker: '乙卯' },
  { name: '曲直格', values: ['戊辰', '甲寅', '乙卯', '丁亥'], breaker: '辛酉' },
];

for (const { name, values, breaker } of structures) {
  test(`${name}的会合结构必须得月令支持且未被局外支冲破`, () => {
    const intact = makePillars(values);
    const broken = makePillars([...values.slice(0, 3), breaker]);
    assert.equal(collectCompleteBranchFormations(intact).length, 1);
    assert.equal(collectEstablishedBranchFormations(intact).length, 1);
    assert.equal(identify(intact)?.name, name);
    assert.equal(collectCompleteBranchFormations(broken).length, 1);
    assert.equal(collectEstablishedBranchFormations(broken).length, 0);
    assert.notEqual(identify(broken)?.name, name);
  });
}

test('卯月水局虽齐全且水干多见，仍不能只按计数判润下', () => {
  const pillars = makePillars(['壬申', '癸卯', '壬子', '甲辰']);
  assert.equal(collectCompleteBranchFormations(pillars).length, 1);
  assert.equal(collectEstablishedBranchFormations(pillars).length, 0);
  assert.notEqual(identify(pillars)?.name, '润下格');
});

test('辰月寅冲申的普通格局不会被扩展分析升级成润下格', () => {
  const pillars = makePillars(['戊申', '丙辰', '壬子', '壬寅']);
  assert.equal(collectCompleteBranchFormations(pillars).length, 1);
  assert.equal(collectEstablishedBranchFormations(pillars).length, 0);
  assert.notEqual(identify(pillars)?.name, '润下格');
});
