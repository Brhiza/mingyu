import assert from 'node:assert/strict';
import test from 'node:test';
import { baziCalculator } from '../packages/core/src/bazi/baziCalculator';
import { HIDDEN_STEMS } from '../packages/core/src/bazi/baziDefinitions';
import {
  analyzeConstraint,
  analyzeRoot,
  analyzeSupport,
} from '../packages/core/src/bazi/baziStrengthAnalyzer';
import { evaluatePatternFulfillment } from '../packages/core/src/bazi/baziPatternFulfillment';
import {
  collectSameElementRootFacts,
  type RootPillars,
} from '../packages/core/src/bazi/baziRootFacts';
import { analyzeStemRootProfile } from '../packages/core/src/bazi/stemRootAnalysis';
import { getTenGod, getWuxing } from '../packages/core/src/bazi/baziUtils';
import type { HiddenStems } from '../packages/core/src/bazi/baziTypes';

function getHiddenStems(chart: {
  pillars: {
    year: { zhi: string };
    month: { zhi: string };
    day: { zhi: string };
    hour: { zhi: string };
  };
}): HiddenStems {
  return {
    year: HIDDEN_STEMS[chart.pillars.year.zhi],
    month: HIDDEN_STEMS[chart.pillars.month.zhi],
    day: HIDDEN_STEMS[chart.pillars.day.zhi],
    hour: HIDDEN_STEMS[chart.pillars.hour.zhi],
  };
}

test('同支重复的冲方按柱位保留，未受冲的替代根独立保留', () => {
  const pillars: RootPillars = {
    year: { zhi: '寅' },
    month: { zhi: '申' },
    day: { zhi: '申' },
    hour: { zhi: '亥' },
  };
  const facts = collectSameElementRootFacts(pillars, getHiddenStems({ pillars }), '木', getWuxing);
  assert.deepEqual(facts, [
    {
      position: 'year',
      branch: '寅',
      stem: '甲',
      hiddenIndex: 0,
      hiddenRole: '本气',
      stable: false,
      clashSources: [
        { position: 'month', branch: '申', relation: '六冲' },
        { position: 'day', branch: '申', relation: '六冲' },
      ],
    },
    {
      position: 'hour',
      branch: '亥',
      stem: '甲',
      hiddenIndex: 1,
      hiddenRole: '中气',
      stable: true,
      clashSources: [],
    },
  ]);
});

test('真实历法夹具共享同类根与六冲来源，保留根事实和受冲状态', () => {
  const chart = baziCalculator.calculateBazi({
    year: 1989,
    month: 8,
    day: 22,
    timeIndex: 9,
    gender: 'male',
  });
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(chart.pillars).map(([position, pillar]) => [position, pillar.ganZhi]),
    ),
    {
      year: '己巳',
      month: '壬申',
      day: '甲寅',
      hour: '癸酉',
    },
  );

  const hiddenStems = getHiddenStems(chart);
  const rootPillars: RootPillars = chart.pillars;
  const woodRoots = collectSameElementRootFacts(
    rootPillars,
    hiddenStems,
    getWuxing('甲'),
    getWuxing,
  );
  const dayRoot = woodRoots.find((root) => root.position === 'day' && root.stem === '甲');
  assert.equal(dayRoot?.stable, false);
  assert.deepEqual(dayRoot?.clashSources, [{ position: 'month', branch: '申', relation: '六冲' }]);

  const rootAnalysis = analyzeRoot('甲', chart.pillars, hiddenStems, getWuxing);
  assert.deepEqual(
    rootAnalysis.roots.find((root) => root.position === 'day' && root.branch === '寅'),
    {
      position: 'day',
      branch: '寅',
      stable: false,
      actionable: false,
      clashStatus: '受冲待核',
      clashSources: ['月柱申'],
      strength: 2,
    },
  );
  assert.equal(rootAnalysis.hasRoot, true);

  const supportAnalysis = analyzeSupport('甲', chart.pillars, hiddenStems, getWuxing);
  assert.deepEqual(
    supportAnalysis.supporters.find((item) => item.position === 'month' && item.stem === '壬'),
    {
      position: 'month',
      stem: '壬',
      stable: false,
      actionable: false,
      clashSources: ['日柱寅'],
      strength: 1,
    },
  );

  const constraintAnalysis = analyzeConstraint('甲', chart.pillars, hiddenStems, getWuxing);
  assert.deepEqual(
    constraintAnalysis.constraints.find((item) => item.position === 'month' && item.stem === '申'),
    {
      position: 'month',
      stem: '申',
      stable: false,
      actionable: true,
      clashSources: ['日柱寅'],
      strength: 1.6,
    },
  );
});

test('透干画像与格局根证据复用同一根源及六冲柱位', () => {
  const chart = baziCalculator.calculateBazi({
    year: 1989,
    month: 8,
    day: 22,
    timeIndex: 9,
    gender: 'male',
  });

  const stemProfile = analyzeStemRootProfile(
    Object.values(chart.pillars).map((pillar) => ({
      gan: pillar.gan,
      zhi: pillar.zhi,
    })),
    '甲',
    getWuxing,
    getTenGod,
  );
  const dayStem = stemProfile.items.find((item) => item.pillar === 'day');
  assert.equal(dayStem?.status, '有本根');
  assert.ok(dayStem?.rootPositions?.includes('日柱寅藏甲（本气）'));
  assert.ok(dayStem?.clashedRootPositions?.includes('日柱寅藏甲（本气）'));
  assert.deepEqual(dayStem?.clashSourcePositions, ['月柱申']);

  const pattern = evaluatePatternFulfillment(chart.pillars, '甲', '其他格局', getTenGod);
  const dayEvidence = pattern.rootEvidence?.find(
    (item) => item.pillar === 'day' && item.stem === '甲',
  );
  assert.ok(dayEvidence);
  assert.ok(dayEvidence?.rootPositions.includes('日柱寅藏甲（本气）'));
  assert.ok(dayEvidence?.clashedRootPositions.includes('日柱寅藏甲（本气）'));
  assert.deepEqual(dayEvidence?.clashSourcePositions, ['月柱申']);
});
