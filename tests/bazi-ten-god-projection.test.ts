import assert from 'node:assert/strict';
import test from 'node:test';
import { baziCalculator } from '@core/bazi/baziCalculator';
import { getTenGod } from '@core/bazi/baziUtils';
import { analyzeTenGodStructure } from '@core/bazi/tenGodAnalysis';
import { TEN_GODS_DEFINITIONS } from '@core/bazi/baziElementData';
import { buildEnhancedTenGodsSection } from '@core/minglu/bazi-enhancer';

test('命录十神透藏统计与核心结构一致，四柱保留全部藏干且日干标记为自身', () => {
  const chart = baziCalculator.calculateBazi({
    year: 1990,
    month: 5,
    day: 15,
    timeIndex: 5,
    gender: 'male',
  });
  const keys = ['year', 'month', 'day', 'hour'] as const;
  const structure = analyzeTenGodStructure(
    keys.map((key) => ({
      gan: chart.pillars[key].gan,
      zhi: chart.pillars[key].zhi,
      hiddenStems: chart.hiddenStems[key],
    })),
    chart.dayMaster.gan,
    getTenGod,
  );
  const section = buildEnhancedTenGodsSection(chart);

  for (const god of section.godsList) {
    const distribution = structure.distributions.find((item) => item.tenGod === god.tenGod);
    assert.ok(distribution);
    assert.equal(god.count, distribution.totalCount, god.tenGod);
    assert.equal(god.isExposed, distribution.visibleCount > 0, god.tenGod);
    assert.equal(god.isHidden, distribution.hiddenCount > 0, god.tenGod);
    assert.equal(god.psychology, TEN_GODS_DEFINITIONS[god.tenGod].description);
  }

  assert.ok(keys.some((key) => chart.hiddenTenGods[key].length > 1));
  for (const key of keys) {
    const house = section.housesSixKin.find((item) => item.pillar === key);
    assert.ok(house);
    assert.deepEqual(house.actualTenGods, [
      key === 'day' ? '日元自身' : chart.tenGods[key],
      ...chart.hiddenTenGods[key],
    ]);
    assert.doesNotMatch(house.ageRange, /\d/);
  }
});
