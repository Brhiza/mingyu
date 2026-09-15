import test from 'node:test';
import assert from 'node:assert/strict';

import {
  collectClimateRuleCandidates,
  resolveClimateFavorableOrder,
} from '@core/bazi/baziTherapeuticStrategy';
import { determineUsefulGod } from '@core/bazi/baziUsefulGodStrategy';

function context(visibleStems: string[]) {
  return {
    monthBranch: '寅',
    dayMaster: '金',
    dayStem: '庚',
    visibleStems,
    hiddenStems: [],
    visibleStemSources: visibleStems.map((stem, index) => ({
      pillar: (['year', 'month', 'day', 'hour'] as const)[index],
      stem,
    })),
    hiddenStemSources: [],
    formationWuxings: [],
    wuxingCounts: { 木: 0, 火: 0, 土: 0, 金: 1, 水: 0 },
  };
}

test('庚日寅月丙甲两透优先丙火，未见丙仍按先甲次丁', () => {
  const withBingJia = collectClimateRuleCandidates(context(['丙', '甲', '庚', '辛']));
  const withoutBing = collectClimateRuleCandidates(context(['甲', '庚', '辛', '壬']));
  const withoutJia = collectClimateRuleCandidates(context(['丙', '庚', '辛', '壬']));
  const withDingJia = collectClimateRuleCandidates(context(['丁', '甲', '庚', '辛']));

  const specialized = withBingJia.find(
    (candidate) => candidate.rule.id === 'yin-month-geng-bing-jia',
  );
  assert.equal(specialized?.status, '满足');
  assert.equal(specialized?.rule.priority, 120);
  assert.deepEqual(
    resolveClimateFavorableOrder(
      '金',
      undefined,
      '庚',
      '寅',
      undefined,
      false,
      undefined,
      ['丙', '甲', '庚', '辛'],
      [],
      [],
      [],
      [],
      { 木: 0, 火: 0, 土: 0, 金: 1, 水: 0 },
    ),
    ['火', '木'],
  );
  assert.deepEqual(
    resolveClimateFavorableOrder(
      '金',
      undefined,
      '庚',
      '寅',
      undefined,
      false,
      undefined,
      ['甲', '庚', '辛', '壬'],
      [],
      [],
      [],
      [],
      { 木: 0, 火: 0, 土: 0, 金: 1, 水: 0 },
    ),
    ['木', '火'],
  );
  assert.equal(
    withoutBing.some(
      (candidate) => candidate.rule.id === 'yin-month-geng-bing-jia' && candidate.status === '满足',
    ),
    false,
  );
  assert.equal(
    withoutJia.some(
      (candidate) => candidate.rule.id === 'yin-month-geng-bing-jia' && candidate.status === '满足',
    ),
    false,
  );
  assert.equal(
    withDingJia.find((candidate) => candidate.rule.id === 'yin-month-geng-jia-bing-xin')?.status,
    '满足',
  );

  const usefulGod = determineUsefulGod(
    '身弱',
    { pattern: '普通格', isSpecial: false },
    '金',
    '寅',
    undefined,
    '庚',
    {
      visibleStems: ['甲', '庚', '辛', '壬'],
      hiddenStems: [],
      formationWuxings: [],
      wuxingCounts: { 木: 1, 火: 0, 土: 0, 金: 3, 水: 1 },
    },
  );
  assert.deepEqual(usefulGod.favorableWuxing, ['土', '金']);
  assert.equal(usefulGod.primaryReason, '扶抑');
});

test('木火两旺及身强才旺有根规则不在身弱时命中', () => {
  const weakWoodFire = {
    ...context(['庚', '甲', '乙', '丙']),
    strengthStatus: '身弱',
    wuxingCounts: { 木: 3, 火: 2, 土: 0, 金: 1, 水: 0 },
  };
  const strongWoodFire = { ...weakWoodFire, strengthStatus: '身强' };
  assert.equal(
    collectClimateRuleCandidates(weakWoodFire).find(
      (candidate) => candidate.rule.id === 'yin-month-geng-wood-fire-both',
    )?.status,
    '不满足',
  );
  assert.equal(
    collectClimateRuleCandidates(strongWoodFire).find(
      (candidate) => candidate.rule.id === 'yin-month-geng-wood-fire-both',
    )?.status,
    '满足',
  );

  const strengthGatedRules = [
    {
      id: 'yin-month-ding-jia-geng-all',
      monthBranch: '寅',
      dayMaster: '火',
      dayStem: '丁',
      stems: ['甲', '庚', '丁'],
    },
    {
      id: 'yin-month-geng-wu-xin-ji',
      monthBranch: '寅',
      dayMaster: '金',
      dayStem: '庚',
      stems: ['戊', '壬', '丁', '庚'],
    },
    {
      id: 'shen-month-geng-jia-ding-all',
      monthBranch: '申',
      dayMaster: '金',
      dayStem: '庚',
      stems: ['甲', '丁', '庚'],
    },
    {
      id: 'yin-month-ren-bing-geng-jia',
      monthBranch: '寅',
      dayMaster: '水',
      dayStem: '壬',
      stems: ['丙', '庚', '甲', '壬'],
    },
    {
      id: 'mao-month-ren-bing-jia-all',
      monthBranch: '卯',
      dayMaster: '水',
      dayStem: '壬',
      stems: ['丙', '甲', '壬'],
    },
  ] as const;

  for (const ruleCase of strengthGatedRules) {
    const base = {
      ...context(ruleCase.stems),
      monthBranch: ruleCase.monthBranch,
      dayMaster: ruleCase.dayMaster,
      dayStem: ruleCase.dayStem,
    };
    const weak = collectClimateRuleCandidates({ ...base, strengthStatus: '身弱' });
    const strong = collectClimateRuleCandidates({ ...base, strengthStatus: '身强' });
    assert.equal(
      weak.find((candidate) => candidate.rule.id === ruleCase.id)?.status,
      '不满足',
      `${ruleCase.id} 不应在身弱命中`,
    );
    assert.equal(
      strong.find((candidate) => candidate.rule.id === ruleCase.id)?.status,
      '满足',
      `${ruleCase.id} 应在身强命中`,
    );
  }
});
