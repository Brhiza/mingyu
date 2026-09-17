import assert from 'node:assert/strict';
import test from 'node:test';
import { collectAdjudicatedRootFacts } from '@core/bazi/baziRootAdjudication';
import {
  analyzeConstraint,
  analyzeDayMasterStrength,
  analyzeFormation,
  analyzeRoot,
  analyzeSeasonalStatus,
  analyzeSupport,
} from '@core/bazi/baziStrengthAnalyzer';
import { HIDDEN_STEMS } from '@core/bazi/baziDefinitions';
import { getSeasonStatus, getWuxing as getElement } from '@core/bazi/baziUtils';
import type { HiddenStems, Pillars, Wuxing } from '@core/bazi/baziTypes';

const getWuxing = getElement as (value: string) => Wuxing;

// 合法干支组成的合成结构，用于隔离规则条件。
function fixture(names: readonly string[]) {
  const positions = ['year', 'month', 'day', 'hour'] as const;
  const pillars = Object.fromEntries(
    positions.map((position, index) => [position, { gan: names[index][0], zhi: names[index][1] }]),
  ) as Pillars;
  const hidden = Object.fromEntries(
    positions.map((position) => [position, HIDDEN_STEMS[pillars[position].zhi]]),
  ) as HiddenStems;
  return { pillars, hidden };
}

test('得令本气根受失令异类支冲时保留作用，月日同支一视同仁', () => {
  const { pillars, hidden } = fixture(['甲寅', '壬申', '庚申', '丙午']);
  const facts = collectAdjudicatedRootFacts(pillars, hidden, '金', getWuxing);
  assert.deepEqual(
    facts.map((root) => root.position),
    ['month', 'day'],
  );
  for (const root of facts) {
    assert.equal(root.hiddenRole, '本气');
    assert.equal(root.stable, false);
    assert.equal(root.actionable, true);
    assert.equal(root.clashStatus, '得令本气受失令异类冲');
    assert.deepEqual(root.clashSources, [{ position: 'year', branch: '寅', relation: '六冲' }]);
  }
  const roots = analyzeRoot('庚', pillars, hidden, getWuxing);
  assert.equal(roots.hasRoot, true);
  assert.equal(roots.strongRoot, false, '受冲事实不被改写成未受冲强根');
  assert.ok(roots.roots.every((root) => root.actionable));

  const seasonal = analyzeSeasonalStatus('庚', '申', getSeasonStatus, getWuxing);
  const formation = analyzeFormation('庚', pillars, getWuxing);
  const support = analyzeSupport('庚', pillars, hidden, getWuxing);
  const constraint = analyzeConstraint('庚', pillars, hidden, getWuxing);
  const before = analyzeDayMasterStrength(
    seasonal,
    formation,
    { ...roots, roots: roots.roots.map((root) => ({ ...root, actionable: false })) },
    support,
    constraint,
  );
  const after = analyzeDayMasterStrength(seasonal, formation, roots, support, constraint);
  assert.equal(before.status, '中和');
  assert.equal(after.status, '偏强', '只改变同一盘根的作用条件，不替换任何柱');
  assert.ok(after.details.ruleBasis.some((reason) => /本气得令.*冲源失令/.test(reason)));
});

test('失令根受旺支冲不套用旺根规则，独立未冲根仍保留', () => {
  for (const last of ['庚午', '乙卯']) {
    const { pillars, hidden } = fixture(['甲申', '壬申', '甲寅', last]);
    const facts = collectAdjudicatedRootFacts(pillars, hidden, '木', getWuxing);
    const clashed = facts.find((root) => root.position === 'day')!;
    assert.equal(clashed.actionable, false);
    assert.equal(clashed.clashStatus, '受冲待核');
    assert.equal(clashed.clashSources.length, 2);
    if (last === '乙卯') {
      assert.equal(facts.find((root) => root.position === 'hour')?.actionable, true);
    }
  }
});

test('库土本气同类冲动与库中非土分开记录', () => {
  // 《子平真诠·论墓库刑冲之说》：“四墓土自为冲，乃冲动之冲，非冲克之冲。”
  const { pillars, hidden } = fixture(['甲辰', '壬子', '戊戌', '丙午']);
  const earth = collectAdjudicatedRootFacts(pillars, hidden, '土', getWuxing);
  for (const position of ['year', 'day']) {
    const root = earth.find((entry) => entry.position === position)!;
    assert.equal(root.clashStatus, '库土本气同类冲动');
    assert.equal(root.actionable, true);
    assert.equal(root.stable, false);
  }
  const water = collectAdjudicatedRootFacts(pillars, hidden, '水', getWuxing);
  const hiddenWater = water.find((root) => root.branch === '辰')!;
  assert.equal(hiddenWater.hiddenRole, '余气');
  assert.equal(hiddenWater.clashStatus, '受冲待核');
  assert.equal(hiddenWater.actionable, false);
});

test('辰戌与丑未两组库土本气均按同类冲动处理，月令强弱另行保留', () => {
  const cases = [
    { names: ['甲辰', '壬辰', '戊戌', '丙午'] as const, monthStatus: '旺' },
    { names: ['乙丑', '丙子', '己未', '乙亥'] as const, monthStatus: '囚' },
  ];

  for (const item of cases) {
    const { pillars, hidden } = fixture(item.names);
    assert.equal(getSeasonStatus(pillars.month.zhi).土, item.monthStatus);
    const facts = collectAdjudicatedRootFacts(pillars, hidden, '土', getWuxing);
    const storageRoots = facts.filter((root) => ['辰', '戌', '丑', '未'].includes(root.branch));
    assert.ok(storageRoots.length >= 2);
    assert.ok(storageRoots.every((root) => root.clashStatus === '库土本气同类冲动'));
    assert.ok(storageRoots.every((root) => root.actionable && !root.stable));
  }
});

test('库土本气同类冲动不改写 strongRoot，也不把多冲源折算成额外作用', () => {
  const { pillars, hidden } = fixture(['甲辰', '壬辰', '戊戌', '丙午']);
  const facts = collectAdjudicatedRootFacts(pillars, hidden, '土', getWuxing);
  const dayRoot = facts.find((root) => root.position === 'day')!;
  assert.equal(dayRoot.clashStatus, '库土本气同类冲动');
  assert.equal(dayRoot.clashSources.length, 2);

  const roots = analyzeRoot('戊', pillars, hidden, getWuxing);
  assert.equal(roots.strongRoot, false);
  assert.ok(
    roots.roots
      .filter((root) => root.clashStatus === '库土本气同类冲动')
      .every((root) => root.actionable),
  );

  const seasonal = analyzeSeasonalStatus('戊', '辰', getSeasonStatus, getWuxing);
  const formation = analyzeFormation('戊', pillars, getWuxing);
  const support = analyzeSupport('戊', pillars, hidden, getWuxing);
  const constraint = analyzeConstraint('戊', pillars, hidden, getWuxing);
  const strength = analyzeDayMasterStrength(seasonal, formation, roots, support, constraint);
  assert.ok(
    strength.details.ruleBasis.some((reason) => /同类库土相冲.*保留其结构根气/.test(reason)),
  );
});

test('库中正库与余气反例不套用库土本气同类冲动', () => {
  const waterStorage = fixture(['甲戌', '壬子', '壬辰', '丙午']);
  const waterRoot = collectAdjudicatedRootFacts(
    waterStorage.pillars,
    waterStorage.hidden,
    '水',
    getWuxing,
  ).find((root) => root.branch === '辰')!;
  assert.equal(waterRoot.stem, '癸');
  assert.equal(waterRoot.hiddenRole, '余气');
  assert.equal(waterRoot.clashStatus, '受冲待核');
  assert.equal(waterRoot.actionable, false);

  const woodResidual = fixture(['甲辰', '壬子', '甲戌', '丙午']);
  const woodRoot = collectAdjudicatedRootFacts(
    woodResidual.pillars,
    woodResidual.hidden,
    '木',
    getWuxing,
  ).find((root) => root.branch === '辰')!;
  assert.equal(woodRoot.stem, '乙');
  assert.equal(woodRoot.hiddenRole, '中气');
  assert.equal(woodRoot.clashStatus, '受冲待核');
  assert.equal(woodRoot.actionable, false);
});

test('同一旺根裁决对生扶和克泄耗采用相同条件', () => {
  const resource = fixture(['丙午', '壬子', '甲寅', '乙卯']);
  const support = analyzeSupport('甲', resource.pillars, resource.hidden, getWuxing);
  for (const stem of ['壬', '子']) {
    const item = support.supporters.find(
      (entry) => entry.position === 'month' && entry.stem === stem,
    )!;
    assert.equal(item.stable, false);
    assert.equal(item.actionable, true);
  }
  const output = fixture(['甲寅', '庚申', '戊申', '丙午']);
  const constraint = analyzeConstraint('戊', output.pillars, output.hidden, getWuxing);
  for (const stem of ['庚', '申']) {
    const item = constraint.constraints.find(
      (entry) => entry.position === 'month' && entry.stem === stem,
    )!;
    assert.equal(item.stable, false);
    assert.equal(item.actionable, true);
  }
});
