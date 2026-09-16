import assert from 'node:assert/strict';
import test from 'node:test';
import { baziCalculator } from '../packages/core/src/bazi/baziCalculator';
import { HIDDEN_STEMS } from '../packages/core/src/bazi/baziDefinitions';
import {
  analyzeConstraint,
  analyzeDayMasterStrength,
} from '../packages/core/src/bazi/baziStrengthAnalyzer';
import { getSeasonStatus, getTenGod, getWuxing } from '../packages/core/src/bazi/baziUtils';
import { analyzeExposedStemProfile } from '../packages/core/src/bazi/stemRootAnalysis';
import type { HiddenStems, Wuxing } from '../packages/core/src/bazi/baziTypes';

test('透干克泄耗区分有根与浮干，不因属于异党便默认有效', () => {
  const chart = baziCalculator.calculateBazi({
    year: 2056,
    month: 2,
    day: 22,
    timeIndex: 2,
    gender: 'male',
  });
  const hiddenStems = Object.fromEntries(
    Object.entries(chart.pillars).map(([position, pillar]) => [position, HIDDEN_STEMS[pillar.zhi]]),
  ) as unknown as HiddenStems;
  assert.ok(
    !Object.values(hiddenStems)
      .flat()
      .some((stem) => ['庚', '辛'].includes(stem)),
  );
  assert.ok(Object.values(hiddenStems).flat().includes('丙'));
  const result = analyzeConstraint(
    '甲',
    chart.pillars,
    hiddenStems,
    getWuxing as (value: string) => Wuxing,
  );
  assert.equal(result.constraints.find((item) => item.stem === '庚')?.stable, false);
  assert.ok(result.constraints.filter((item) => item.stem === '丙').every((item) => item.stable));
  assert.equal(result.hasConstraint, true);
});

test('浮干异党保留事实，不能因未计入得势便直接晋级极强', () => {
  const result = analyzeDayMasterStrength(
    { status: '旺', score: 4, isTimely: true },
    { formations: [], totalStrength: 0 },
    {
      roots: [{ position: 'month', branch: '卯', stable: true, strength: 2 }],
      hasRoot: true,
      strongRoot: true,
      totalStrength: 2,
    },
    { supporters: [], totalStrength: 0, hasSupport: false },
    {
      constraints: [{ position: 'year', stem: '庚', stable: false, strength: 1.4 }],
      totalStrength: 1.4,
      hasConstraint: true,
    },
  );
  assert.equal(result.status, '身强');
  assert.equal(result.details.hasConstraint, true);
});

test('十干十二月的透干画像与核心月令事实一致，说明使用中文柱位', () => {
  for (const stem of '甲乙丙丁戊己庚辛壬癸') {
    for (const [index, branch] of [...'子丑寅卯辰巳午未申酉戌亥'].entries()) {
      const pillars = [
        { gan: '甲', zhi: '子' },
        { gan: index % 2 ? '乙' : '甲', zhi: branch },
        { gan: stem, zhi: '甲丙戊庚壬'.includes(stem) ? '子' : '丑' },
        { gan: '壬', zhi: '子' },
      ];
      const profile = analyzeExposedStemProfile(pillars, stem, getWuxing, getTenGod);
      const expected = getSeasonStatus(branch)[getWuxing(stem)];
      assert.equal(profile.items[2].seasonStatus, expected, `${stem}/${branch}`);
      assert.ok(profile.items[2].summary.includes(`${stem}透于日柱`));
      assert.doesNotMatch(
        profile.items.map((item) => item.summary).join('；'),
        /year|month|day|hour/,
      );
    }
  }
});
