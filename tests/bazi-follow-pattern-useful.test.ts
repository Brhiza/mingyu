import assert from 'node:assert/strict';
import test from 'node:test';

import { BaziAnalyzer } from '@core/bazi/baziAnalysis';
import { baziCalculator } from '@core/bazi/baziCalculator';
import { HIDDEN_STEMS } from '@core/bazi/baziDefinitions';
import type { HiddenStems, Pillars } from '@core/bazi/baziTypes';
import { getSeasonStatus, getTenGod, getWuxing } from '@core/bazi/baziUtils';

function analyzeSyntheticPillars(values: [string, string, string, string], commander: string) {
  const positions = ['year', 'month', 'day', 'hour'] as const;
  const pillars = Object.fromEntries(
    positions.map((position, index) => [
      position,
      { gan: values[index][0], zhi: values[index][1], ganZhi: values[index] },
    ]),
  ) as Pillars;
  const hiddenStems = Object.fromEntries(
    positions.map((position) => [position, HIDDEN_STEMS[pillars[position].zhi]]),
  ) as HiddenStems;
  return new BaziAnalyzer(getWuxing, getTenGod, getSeasonStatus).analyzeBaziChart(
    pillars,
    hiddenStems,
    commander,
  );
}

test('从杀格以官杀顺势、财生杀，食伤制杀列忌', () => {
  // 合成四柱：仅用有效六十甲子隔离格局取用，不对应某个出生时刻。
  const analysis = analyzeSyntheticPillars(['辛酉', '辛酉', '乙酉', '辛酉'], '辛');

  assert.equal(analysis.dayMasterStrength.status, '极弱');
  assert.equal(analysis.mingGe.pattern, '从杀格');
  assert.deepEqual(analysis.usefulGod.favorableWuxing, ['金', '土']);
  assert.deepEqual(analysis.usefulGod.unfavorableWuxing, ['火', '水', '木']);
  assert.equal(analysis.usefulGod.primaryUseful, '官杀');
  assert.equal(analysis.usefulGod.primaryAvoid, '食伤');
});

test('从财格以财为主，食伤生财为辅', () => {
  const chart = baziCalculator.calculateBazi({
    year: 2018,
    month: 5,
    day: 3,
    timeIndex: 10,
    gender: 'male',
    isLunar: false,
  });

  assert.deepEqual(
    Object.values(chart.pillars).map((pillar) => pillar.ganZhi),
    ['戊戌', '丙辰', '乙未', '丙戌'],
  );
  assert.equal(chart.analysis.mingGe.pattern, '从财格');
  assert.deepEqual(chart.analysis.usefulGod.favorableWuxing, ['土', '火']);
  assert.deepEqual(chart.analysis.usefulGod.unfavorableWuxing, ['水', '木']);
  assert.equal(chart.analysis.usefulGod.primaryUseful, '财星');
});

test('从势格保留异党多路取用，不套从杀顺序', () => {
  // 合成四柱：财、官杀、食伤同见，用于核验混杂从势分支。
  const analysis = analyzeSyntheticPillars(['戊午', '辛酉', '甲午', '庚午'], '辛');

  assert.equal(analysis.dayMasterStrength.status, '极弱');
  assert.equal(analysis.mingGe.pattern, '从势格');
  assert.deepEqual(analysis.usefulGod.favorableWuxing, ['火', '土', '金']);
  assert.deepEqual(analysis.usefulGod.unfavorableWuxing, ['水', '木']);
});
