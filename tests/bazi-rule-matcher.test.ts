import test from 'node:test';
import assert from 'node:assert/strict';

import { matchesRule } from '@core/bazi/baziRuleMatcher';

test('十神类别透干计数中，比劫不应把日主自身算作额外比劫', () => {
  const rule = {
    id: 'no-extra-companion',
    maxTenGodCategoryVisibleCounts: {
      比劫: 0,
    },
  };

  assert.equal(
    matchesRule(rule, {
      dayStem: '戊',
      visibleStems: ['甲', '乙', '戊', '癸'],
    }),
    true,
  );

  assert.equal(
    matchesRule(rule, {
      dayStem: '戊',
      visibleStems: ['甲', '乙', '戊', '己'],
    }),
    false,
  );
});

test('十神类别透干计数应能同时约束无比印与官杀透干数量', () => {
  const rule = {
    id: 'follow-kill-shape',
    minTenGodCategoryVisibleCounts: {
      官杀: 2,
    },
    maxTenGodCategoryVisibleCounts: {
      比劫: 0,
      印星: 0,
    },
  };

  assert.equal(
    matchesRule(rule, {
      dayStem: '戊',
      visibleStems: ['甲', '乙', '戊', '癸'],
    }),
    true,
  );

  assert.equal(
    matchesRule(rule, {
      dayStem: '戊',
      visibleStems: ['甲', '乙', '戊', '丙'],
    }),
    false,
  );
});

test('十神类别藏干计数应能识别暗藏印比，避免把有根有印误作无比印', () => {
  const rule = {
    id: 'no-hidden-resource-or-companion',
    maxTenGodCategoryHiddenCounts: {
      比劫: 0,
      印星: 0,
    },
  };

  assert.equal(
    matchesRule(rule, {
      dayStem: '己',
      hiddenStems: ['甲', '乙', '癸'],
    }),
    true,
  );

  assert.equal(
    matchesRule(rule, {
      dayStem: '己',
      hiddenStems: ['甲', '丙', '癸'],
    }),
    false,
  );
});

test('十神类别明暗合计计数应能把透干与藏干一起计算', () => {
  const rule = {
    id: 'no-resource-total',
    maxTenGodCategoryTotalCounts: {
      印星: 0,
    },
  };

  assert.equal(
    matchesRule(rule, {
      dayStem: '丁',
      visibleStems: ['庚', '戊', '丁', '癸'],
      hiddenStems: ['壬', '庚'],
    }),
    true,
  );

  assert.equal(
    matchesRule(rule, {
      dayStem: '丁',
      visibleStems: ['庚', '戊', '丁', '癸'],
      hiddenStems: ['壬', '乙', '甲'],
    }),
    false,
  );
});

test('十神类别透干异类计数应区分甲乙并透与甲甲重复，不可把重复透干误作会党', () => {
  const rule = {
    id: 'officer-party-visible-distinct',
    minTenGodCategoryVisibleDistinctCounts: {
      官杀: 2,
    },
  };

  assert.equal(
    matchesRule(rule, {
      dayStem: '戊',
      visibleStems: ['甲', '乙', '戊', '庚'],
    }),
    true,
  );

  assert.equal(
    matchesRule(rule, {
      dayStem: '戊',
      visibleStems: ['甲', '甲', '戊', '庚'],
    }),
    false,
  );
});

test('十神类别明暗异类计数应把乙透甲藏视作会党，不应只认双透', () => {
  const rule = {
    id: 'officer-party-total-distinct',
    minTenGodCategoryTotalDistinctCounts: {
      官杀: 2,
    },
  };

  assert.equal(
    matchesRule(rule, {
      dayStem: '戊',
      visibleStems: ['乙', '戊', '庚', '癸'],
      hiddenStems: ['甲', '乙'],
    }),
    true,
  );

  assert.equal(
    matchesRule(rule, {
      dayStem: '戊',
      visibleStems: ['乙', '戊', '庚', '癸'],
      hiddenStems: ['乙', '乙'],
    }),
    false,
  );
});

test('成局五行应能按日干映射到十神类别，避免把木局官杀、火局财星继续硬编码成固定五行名', () => {
  const rule = {
    id: 'formation-category-officer',
    requiredFormationTenGodCategories: ['官杀'],
    forbiddenFormationTenGodCategories: ['财星'],
  };

  assert.equal(
    matchesRule(rule, {
      dayStem: '戊',
      formationWuxings: ['木'],
    }),
    true,
  );

  assert.equal(
    matchesRule(rule, {
      dayStem: '戊',
      formationWuxings: ['火'],
    }),
    false,
  );

  assert.equal(
    matchesRule(rule, {
      dayStem: '癸',
      formationWuxings: ['水'],
    }),
    false,
  );
});

test('规则匹配应支持年干与时支条件，并支持精确干总量统计', () => {
  const rule = {
    id: 'gui-chou-night-party',
    yearStems: ['丁'],
    hourBranches: ['亥', '子', '丑'],
    minStemTotalCounts: {
      癸: 2,
      己: 1,
    },
  };

  assert.equal(
    matchesRule(rule, {
      yearStem: '丁',
      hourBranch: '亥',
      dayStem: '癸',
      visibleStems: ['丁', '癸', '己', '辛'],
      hiddenStems: ['癸', '己'],
    }),
    true,
  );

  assert.equal(
    matchesRule(rule, {
      yearStem: '丙',
      hourBranch: '亥',
      dayStem: '癸',
      visibleStems: ['丁', '癸', '己', '辛'],
      hiddenStems: ['癸', '己'],
    }),
    false,
  );

  assert.equal(
    matchesRule(rule, {
      yearStem: '丁',
      hourBranch: '巳',
      dayStem: '癸',
      visibleStems: ['丁', '癸', '己', '辛'],
      hiddenStems: ['癸', '己'],
    }),
    false,
  );
});

test('五行总量匹配应支持最大值约束，避免把支只一水误放宽成多水同论', () => {
  const rule = {
    id: 'single-water-only',
    minWuxingCounts: { 水: 1 },
    maxWuxingCounts: { 水: 1 },
  };

  assert.equal(
    matchesRule(rule, {
      dayStem: '癸',
      wuxingCounts: { 木: 0, 火: 3, 土: 2, 金: 1, 水: 1 },
    }),
    true,
  );

  assert.equal(
    matchesRule(rule, {
      dayStem: '癸',
      wuxingCounts: { 木: 0, 火: 2, 土: 2, 金: 1, 水: 2 },
    }),
    false,
  );
});

test('具体天干组应支持纯一与混杂判定，避免把一派己土与戊己混杂混为一谈', () => {
  const rule = {
    id: 'pure-ji-party',
    distinctStemGroupCounts: [
      {
        stems: ['戊', '己'],
        minDistinctCount: 1,
        maxDistinctCount: 1,
        scope: 'total',
      },
    ],
    minStemTotalCounts: { 己: 3 },
  };

  assert.equal(
    matchesRule(rule, {
      visibleStems: ['癸', '己', '己', '丙'],
      hiddenStems: ['己'],
    }),
    true,
  );

  assert.equal(
    matchesRule(rule, {
      visibleStems: ['癸', '己', '戊', '丙'],
      hiddenStems: ['己'],
    }),
    false,
  );
});

test('具体天干组应支持并见判定，避免把甲乙并见继续退化成单纯官杀计数', () => {
  const rule = {
    id: 'jia-yi-both-seen',
    distinctStemGroupCounts: [
      {
        stems: ['甲', '乙'],
        minDistinctCount: 2,
        scope: 'total',
      },
    ],
  };

  assert.equal(
    matchesRule(rule, {
      visibleStems: ['乙', '戊', '庚', '癸'],
      hiddenStems: ['甲'],
    }),
    true,
  );

  assert.equal(
    matchesRule(rule, {
      visibleStems: ['乙', '戊', '庚', '癸'],
      hiddenStems: ['乙'],
    }),
    false,
  );
});

test('具体天干组作用域应区分明透与暗藏，避免把藏辛误判成庚辛混杂透干', () => {
  const pureVisibleRule = {
    id: 'geng-xin-visible-pure',
    distinctStemGroupCounts: [
      {
        stems: ['庚', '辛'],
        minDistinctCount: 1,
        maxDistinctCount: 1,
        scope: 'visible',
      },
    ],
  };

  const mixedVisibleRule = {
    id: 'geng-xin-visible-mixed',
    distinctStemGroupCounts: [
      {
        stems: ['庚', '辛'],
        minDistinctCount: 2,
        scope: 'visible',
      },
    ],
  };

  assert.equal(
    matchesRule(pureVisibleRule, {
      visibleStems: ['庚', '庚', '丙', '甲'],
      hiddenStems: ['辛'],
    }),
    true,
  );

  assert.equal(
    matchesRule(mixedVisibleRule, {
      visibleStems: ['庚', '庚', '丙', '甲'],
      hiddenStems: ['辛'],
    }),
    false,
  );
});

test('具体天干组应支持庚辛纯一判定，避免把庚辛并透误作辛透不见庚', () => {
  const rule = {
    id: 'xin-without-geng',
    requiredVisibleStems: ['辛'],
    distinctStemGroupCounts: [
      {
        stems: ['庚', '辛'],
        minDistinctCount: 1,
        maxDistinctCount: 1,
        scope: 'visible',
      },
    ],
  };

  assert.equal(
    matchesRule(rule, {
      visibleStems: ['辛', '丙', '戊', '己'],
    }),
    true,
  );

  assert.equal(
    matchesRule(rule, {
      visibleStems: ['庚', '辛', '戊', '己'],
    }),
    false,
  );
});

test('具体天干组应支持独透判定，避免把无壬用癸退回手写单干排除', () => {
  const rule = {
    id: 'ren-gui-single-visible',
    requiredVisibleStems: ['癸'],
    distinctStemGroupCounts: [
      {
        stems: ['壬', '癸'],
        minDistinctCount: 1,
        maxDistinctCount: 1,
        scope: 'visible',
      },
    ],
  };

  assert.equal(
    matchesRule(rule, {
      visibleStems: ['癸', '丙', '辛', '戊'],
    }),
    true,
  );

  assert.equal(
    matchesRule(rule, {
      visibleStems: ['壬', '癸', '辛', '戊'],
    }),
    false,
  );
});

test('具体天干组应支持独壬判定，避免把壬癸并透误作独壬', () => {
  const rule = {
    id: 'ren-only-visible',
    requiredVisibleStems: ['壬'],
    maxVisibleStemCounts: {
      壬: 1,
    },
    distinctStemGroupCounts: [
      {
        stems: ['壬', '癸'],
        minDistinctCount: 1,
        maxDistinctCount: 1,
        scope: 'visible',
      },
    ],
  };

  assert.equal(
    matchesRule(rule, {
      visibleStems: ['壬', '丙', '甲', '戊'],
    }),
    true,
  );

  assert.equal(
    matchesRule(rule, {
      visibleStems: ['壬', '癸', '甲', '戊'],
    }),
    false,
  );
});

test('具体天干组应支持壬藏支不透判定，避免把癸透天干仍误作藏壬秀才', () => {
  const rule = {
    id: 'ren-hidden-no-visible-water',
    requiredHiddenStems: ['壬'],
    distinctStemGroupCounts: [
      {
        stems: ['壬', '癸'],
        maxDistinctCount: 0,
        scope: 'visible',
      },
    ],
  };

  assert.equal(
    matchesRule(rule, {
      visibleStems: ['丙', '甲', '戊', '乙'],
      hiddenStems: ['壬'],
    }),
    true,
  );

  assert.equal(
    matchesRule(rule, {
      visibleStems: ['丙', '癸', '戊', '乙'],
      hiddenStems: ['壬'],
    }),
    false,
  );
});

test('具体天干组应支持暗藏至少并见一类，避免把无壬癸藏支误作壬癸藏支页监', () => {
  const rule = {
    id: 'ren-gui-hidden-at-least-one',
    distinctStemGroupCounts: [
      {
        stems: ['甲', '壬', '癸'],
        maxDistinctCount: 0,
        scope: 'visible',
      },
      {
        stems: ['壬', '癸'],
        minDistinctCount: 1,
        scope: 'hidden',
      },
    ],
  };

  assert.equal(
    matchesRule(rule, {
      visibleStems: ['丙', '庚', '戊', '辛'],
      hiddenStems: ['壬'],
    }),
    true,
  );

  assert.equal(
    matchesRule(rule, {
      visibleStems: ['丙', '庚', '戊', '辛'],
      hiddenStems: ['丁'],
    }),
    false,
  );
});

test('具体天干组应支持明透至少见组内一类，避免把无壬癸仍误作庚戊困木水', () => {
  const rule = {
    id: 'visible-at-least-one-in-group',
    requiredVisibleStems: ['庚', '戊', '甲'],
    distinctStemGroupCounts: [
      {
        stems: ['壬', '癸'],
        minDistinctCount: 1,
        scope: 'visible',
      },
    ],
  };

  assert.equal(
    matchesRule(rule, {
      visibleStems: ['庚', '戊', '甲', '壬'],
    }),
    true,
  );

  assert.equal(
    matchesRule(rule, {
      visibleStems: ['庚', '戊', '甲', '丙'],
    }),
    false,
  );
});

test('具体天干组应支持壬甲两透判定，避免把单透单藏误作两透富贵', () => {
  const rule = {
    id: 'ren-jia-both-visible',
    distinctStemGroupCounts: [
      {
        stems: ['壬', '甲'],
        minDistinctCount: 2,
        scope: 'visible',
      },
    ],
  };

  assert.equal(
    matchesRule(rule, {
      visibleStems: ['壬', '甲', '辛', '戊'],
    }),
    true,
  );

  assert.equal(
    matchesRule(rule, {
      visibleStems: ['壬', '辛', '戊', '己'],
      hiddenStems: ['甲'],
    }),
    false,
  );
});

test('具体天干组应支持壬甲明暗分判，避免把甲透壬藏与壬透甲藏混作同一路数', () => {
  const renVisibleRule = {
    id: 'ren-visible-jia-hidden',
    requiredVisibleStems: ['壬'],
    requiredHiddenStems: ['甲'],
    distinctStemGroupCounts: [
      {
        stems: ['壬', '甲'],
        minDistinctCount: 1,
        maxDistinctCount: 1,
        scope: 'visible',
      },
    ],
  };

  const jiaVisibleRule = {
    id: 'jia-visible-ren-hidden',
    requiredVisibleStems: ['甲'],
    requiredHiddenStems: ['壬'],
    distinctStemGroupCounts: [
      {
        stems: ['壬', '甲'],
        minDistinctCount: 1,
        maxDistinctCount: 1,
        scope: 'visible',
      },
    ],
  };

  assert.equal(
    matchesRule(renVisibleRule, {
      visibleStems: ['壬', '辛', '戊', '己'],
      hiddenStems: ['甲'],
    }),
    true,
  );

  assert.equal(
    matchesRule(renVisibleRule, {
      visibleStems: ['甲', '辛', '戊', '己'],
      hiddenStems: ['壬'],
    }),
    false,
  );

  assert.equal(
    matchesRule(jiaVisibleRule, {
      visibleStems: ['甲', '辛', '戊', '己'],
      hiddenStems: ['壬'],
    }),
    true,
  );

  assert.equal(
    matchesRule(jiaVisibleRule, {
      visibleStems: ['壬', '辛', '戊', '己'],
      hiddenStems: ['甲'],
    }),
    false,
  );
});

test('具体天干组应支持全无判定，避免把甲壬癸俱无继续拆成多条禁用条件', () => {
  const rule = {
    id: 'jia-ren-gui-none',
    distinctStemGroupCounts: [
      {
        stems: ['甲', '壬', '癸'],
        maxDistinctCount: 0,
        scope: 'visible',
      },
      {
        stems: ['甲', '壬', '癸'],
        maxDistinctCount: 0,
        scope: 'hidden',
      },
    ],
  };

  assert.equal(
    matchesRule(rule, {
      visibleStems: ['丙', '庚', '戊', '辛'],
      hiddenStems: ['丁', '己'],
    }),
    true,
  );

  assert.equal(
    matchesRule(rule, {
      visibleStems: ['丙', '庚', '戊', '辛'],
      hiddenStems: ['癸'],
    }),
    false,
  );
});

test('规则匹配应支持按地支来源检查藏干，避免把他支藏壬误作亥中藏壬', () => {
  const rule = {
    id: 'ren-hidden-in-hai',
    requiredHiddenStemBranchPairs: [
      {
        branch: '亥',
        stem: '壬',
      },
    ],
  };

  assert.equal(
    matchesRule(rule, {
      hiddenStemSources: [
        { pillar: 'year', branch: '巳', stems: ['丙', '庚', '戊'] },
        { pillar: 'hour', branch: '亥', stems: ['壬', '甲'] },
      ],
    }),
    true,
  );

  assert.equal(
    matchesRule(rule, {
      hiddenStemSources: [
        { pillar: 'year', branch: '申', stems: ['庚', '壬', '戊'] },
        { pillar: 'hour', branch: '子', stems: ['癸'] },
      ],
    }),
    false,
  );
});

test('规则匹配应支持按柱位限制藏干来源，避免把别柱藏壬误当时支亥中得用', () => {
  const rule = {
    id: 'ren-hidden-in-hour-hai',
    requiredHiddenStemBranchPairs: [
      {
        branch: '亥',
        stem: '壬',
        pillars: ['hour'],
      },
    ],
  };

  assert.equal(
    matchesRule(rule, {
      hiddenStemSources: [
        { pillar: 'year', branch: '亥', stems: ['壬', '甲'] },
        { pillar: 'hour', branch: '酉', stems: ['辛'] },
      ],
    }),
    false,
  );

  assert.equal(
    matchesRule(rule, {
      hiddenStemSources: [
        { pillar: 'year', branch: '酉', stems: ['辛'] },
        { pillar: 'hour', branch: '亥', stems: ['壬', '甲'] },
      ],
    }),
    true,
  );
});

test('规则匹配应支持只按地支出现判定，避免把见子壬水退化成泛化见水', () => {
  const rule = {
    id: 'see-zi-branch',
    requiredBranchPillarPairs: [
      {
        branch: '子',
      },
    ],
    forbiddenBranchPillarPairs: [
      {
        branch: '午',
      },
    ],
  };

  assert.equal(
    matchesRule(rule, {
      hiddenStemSources: [
        { pillar: 'month', branch: '未', stems: ['己', '丁', '乙'] },
        { pillar: 'hour', branch: '子', stems: ['癸'] },
      ],
    }),
    true,
  );

  assert.equal(
    matchesRule(rule, {
      hiddenStemSources: [
        { pillar: 'month', branch: '未', stems: ['己', '丁', '乙'] },
        { pillar: 'hour', branch: '亥', stems: ['壬', '甲'] },
      ],
    }),
    false,
  );
});

test('规则匹配应支持按柱位限制地支出现，避免把别柱见子误当时支见子', () => {
  const rule = {
    id: 'see-zi-in-hour',
    requiredBranchPillarPairs: [
      {
        branch: '子',
        pillars: ['hour'],
      },
    ],
  };

  assert.equal(
    matchesRule(rule, {
      hiddenStemSources: [
        { pillar: 'year', branch: '子', stems: ['癸'] },
        { pillar: 'hour', branch: '酉', stems: ['辛'] },
      ],
    }),
    false,
  );

  assert.equal(
    matchesRule(rule, {
      hiddenStemSources: [
        { pillar: 'month', branch: '未', stems: ['己', '丁', '乙'] },
        { pillar: 'hour', branch: '子', stems: ['癸'] },
      ],
    }),
    true,
  );
});

test('规则匹配应支持按柱位识别明透天干，避免把年透甲与时透甲混作同一判据', () => {
  const rule = {
    id: 'jia-visible-in-hour',
    requiredVisibleStemPillarPairs: [
      {
        stem: '甲',
        pillars: ['hour'],
      },
    ],
    forbiddenVisibleStemPillarPairs: [
      {
        stem: '甲',
        pillars: ['year'],
      },
    ],
  };

  assert.equal(
    matchesRule(rule, {
      visibleStems: ['辛', '癸', '己', '甲'],
      visibleStemSources: [
        { pillar: 'year', stem: '辛' },
        { pillar: 'month', stem: '癸' },
        { pillar: 'day', stem: '己' },
        { pillar: 'hour', stem: '甲' },
      ],
    }),
    true,
  );

  assert.equal(
    matchesRule(rule, {
      visibleStems: ['甲', '癸', '己', '辛'],
      visibleStemSources: [
        { pillar: 'year', stem: '甲' },
        { pillar: 'month', stem: '癸' },
        { pillar: 'day', stem: '己' },
        { pillar: 'hour', stem: '辛' },
      ],
    }),
    false,
  );
});

test('规则匹配应支持识别同柱天干坐支，避免把别柱亥支误当壬坐亥', () => {
  const rule = {
    id: 'ren-sits-on-hai',
    requiredVisibleStemBranchPairs: [
      {
        stem: '壬',
        branch: '亥',
      },
    ],
  };

  assert.equal(
    matchesRule(rule, {
      visibleStems: ['壬', '辛', '丁', '乙'],
      visibleStemSources: [
        { pillar: 'year', stem: '壬' },
        { pillar: 'month', stem: '辛' },
        { pillar: 'day', stem: '丁' },
        { pillar: 'hour', stem: '乙' },
      ],
      hiddenStemSources: [
        { pillar: 'year', branch: '亥', stems: ['壬', '甲'] },
        { pillar: 'month', branch: '卯', stems: ['乙'] },
      ],
    }),
    true,
  );

  assert.equal(
    matchesRule(rule, {
      visibleStems: ['壬', '辛', '丁', '乙'],
      visibleStemSources: [
        { pillar: 'year', stem: '壬' },
        { pillar: 'month', stem: '辛' },
        { pillar: 'day', stem: '丁' },
        { pillar: 'hour', stem: '乙' },
      ],
      hiddenStemSources: [
        { pillar: 'hour', branch: '亥', stems: ['壬', '甲'] },
        { pillar: 'month', branch: '卯', stems: ['乙'] },
      ],
    }),
    false,
  );
});

test('规则匹配应支持明透天干隔位判定，避免把甲己相贴误作甲须隔位', () => {
  const rule = {
    id: 'jia-ji-separated',
    requiredVisibleStemDistancePairs: [
      {
        stems: ['甲', '己'],
        minDistance: 2,
      },
    ],
  };

  assert.equal(
    matchesRule(rule, {
      visibleStems: ['甲', '壬', '辛', '己'],
      visibleStemSources: [
        { pillar: 'year', stem: '甲' },
        { pillar: 'month', stem: '壬' },
        { pillar: 'day', stem: '辛' },
        { pillar: 'hour', stem: '己' },
      ],
    }),
    true,
  );

  assert.equal(
    matchesRule(rule, {
      visibleStems: ['甲', '己', '辛', '壬'],
      visibleStemSources: [
        { pillar: 'year', stem: '甲' },
        { pillar: 'month', stem: '己' },
        { pillar: 'day', stem: '辛' },
        { pillar: 'hour', stem: '壬' },
      ],
    }),
    false,
  );
});
