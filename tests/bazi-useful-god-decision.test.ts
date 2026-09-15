import assert from 'node:assert/strict';
import test from 'node:test';

import { determinePattern } from '@core/bazi/baziPatternStrategy';
import { getTenGod } from '@core/bazi/baziUtils';
import type { Pillars } from '@core/bazi/baziTypes';
import type { PatternAnalysis } from '@core/bazi/baziTypes';
import {
  applyClimateCandidates,
  collectClimateRuleCandidates,
} from '@core/bazi/baziTherapeuticStrategy';
import type {
  ClimateRule,
  ClimateRuleEffect,
  ClimateRulePolicy,
} from '@core/bazi/baziTherapeuticRules/types';
import { CLIMATE_RULES } from '@core/bazi/baziTherapeuticRules';
import type { RuleMatchContext } from '@core/bazi/baziRuleMatcher';
import { determineUsefulGod } from '@core/bazi/baziUsefulGodStrategy';

const SOURCE = {
  title: '测试来源',
  section: '测试条目',
  excerpt: '测试原文',
  url: 'https://example.com/test-source',
};

const BASE_CONTEXT: RuleMatchContext = {
  strengthStatus: '身弱',
  monthBranch: '未',
  dayMaster: '木',
  dayStem: '甲',
  visibleStems: [],
  hiddenStems: [],
  formationWuxings: [],
  wuxingCounts: { 木: 1, 火: 0, 土: 0, 金: 0, 水: 0 },
};

function makeRule(
  id: string,
  policy: ClimateRulePolicy,
  effects: ClimateRuleEffect[] = policy.effects,
  extra: Partial<ClimateRule> = {},
): ClimateRule {
  return {
    id,
    label: id,
    description: id,
    priority: 100,
    months: ['未'],
    dayMasters: ['木'],
    dayStems: ['甲'],
    usefulWuxing: '火',
    favorableOrder: ['火'],
    hint: id,
    ...extra,
    policy: { ...policy, effects },
  };
}

function state(favorableWuxing = ['水', '木'], unfavorableWuxing = ['火', '土', '金']) {
  return {
    favorableWuxing,
    unfavorableWuxing,
    trace: [],
    primaryReason: '扶抑',
  };
}

test('相同合成结构按司令透干分层取格，调候参考不覆盖扶抑基线', () => {
  const pillars = Object.fromEntries(
    ['戊戌', '己未', '甲午', '丁卯'].map((ganZhi, index) => [
      ['year', 'month', 'day', 'hour'][index],
      { gan: ganZhi[0], zhi: ganZhi[1], ganZhi },
    ]),
  ) as Pillars;
  const fireCommander = determinePattern(pillars, '身弱', getTenGod, '丁');
  const earthCommander = determinePattern(pillars, '身弱', getTenGod, '己');
  assert.match(fireCommander.basis ?? '', /分日司权为丁（伤官）/);
  assert.match(earthCommander.basis ?? '', /本气为己（正财）.*分日司权同为己/);
  assert.notEqual(fireCommander.pattern, earthCommander.pattern);
  const result = determineUsefulGod('身弱', earthCommander, '木', '未', '己', '甲');
  assert.deepEqual(result.favorableWuxing, ['水', '木']);
  assert.deepEqual(result.unfavorableWuxing, ['火', '土', '金']);
  const climate = result.decisionEvidence?.climateCandidates.find(
    (candidate) => candidate.ruleId === 'wei-month-jia-ding-geng',
  );
  assert.equal(climate?.mode, 'within-balance');
  assert.equal(climate?.adopted, true);
  assert.deepEqual(result.decisionEvidence?.climateReferenceOrder, ['火', '金', '水']);
});

test('没有 policy 的旧调候规则只能留下参考证据，不能覆盖扶抑或跳过病药', () => {
  const result = determineUsefulGod(
    '身弱',
    { pattern: '正官格', isSpecial: false },
    '木',
    '酉',
    undefined,
    '甲',
  );

  assert.deepEqual(result.favorableWuxing, ['水', '木']);
  assert.deepEqual(result.unfavorableWuxing, ['火', '土', '金']);
  assert.equal(result.primaryReason, '扶抑');
  const climate = result.decisionEvidence?.climateCandidates.find(
    (candidate) => candidate.ruleId === 'you-month-jia-fire-forge',
  );
  assert.equal(climate?.mode, 'reference');
  assert.equal(climate?.adopted, false);
  assert.equal(result.decisionEvidence?.climateAppliedRuleId, undefined);
});

test('within-balance 只在扶抑已有喜神中排序，不把口诀顺序新增为喜神', () => {
  const policy: ClimateRulePolicy = {
    mode: 'within-balance',
    source: SOURCE,
    effects: [{ stem: '丁', wuxing: '火', role: '制金', targetStems: ['庚'], rank: 'primary' }],
  };
  const rule = makeRule('within-balance-test', policy, policy.effects, {
    favorableOrder: ['火', '金', '水'],
  });
  const candidates = collectClimateRuleCandidates(BASE_CONTEXT, { rules: [rule] });
  const applied = applyClimateCandidates(state(), candidates);

  assert.equal(candidates[0].status, '满足');
  assert.deepEqual(applied.state.favorableWuxing, ['水', '木']);
  assert.deepEqual(applied.state.unfavorableWuxing, ['火', '土', '金']);
  assert.equal(applied.appliedCandidate?.rule.id, 'within-balance-test');
});

test('conditional 单干作用不投影为整五行，并拆出另一阴阳干的基线忌性', () => {
  const policy: ClimateRulePolicy = {
    mode: 'conditional',
    source: SOURCE,
    effects: [{ stem: '丙', wuxing: '火', role: '照暖', targetStems: ['甲'], rank: 'primary' }],
  };
  const rule = makeRule('conditional-single-stem', policy);
  const applied = applyClimateCandidates(
    state(),
    collectClimateRuleCandidates(BASE_CONTEXT, { rules: [rule] }),
  );

  assert.deepEqual(applied.state.favorableWuxing, ['水', '木']);
  assert.deepEqual(applied.state.unfavorableWuxing, ['土', '金']);
  assert.deepEqual(applied.state.conditionalFavorableStems, ['丙']);
  assert.deepEqual(applied.state.conditionalUnfavorableStems, ['丁']);
  assert.deepEqual(applied.state.conditionalFavorableWuxing, ['火']);
  assert.equal(applied.state.primaryReason, '调候');
  assert.match(applied.state.trace.at(-1) || '', /未将火整五行改喜/);
});

test('conditional 的丙丁主作用可并列保留，只有同一干的不同作用才冲突', () => {
  const bing: ClimateRulePolicy = {
    mode: 'conditional',
    source: SOURCE,
    effects: [{ stem: '丙', wuxing: '火', role: '照暖', targetStems: ['甲'], rank: 'primary' }],
  };
  const ding: ClimateRulePolicy = {
    mode: 'conditional',
    source: SOURCE,
    effects: [{ stem: '丁', wuxing: '火', role: '制金', targetStems: ['庚'], rank: 'primary' }],
  };
  const parallel = applyClimateCandidates(
    state(),
    collectClimateRuleCandidates(BASE_CONTEXT, {
      rules: [makeRule('parallel-bing', bing), makeRule('parallel-ding', ding)],
    }),
  );
  assert.equal(parallel.appliedCandidates?.length, 2);
  assert.deepEqual(parallel.state.favorableWuxing, ['火', '水', '木']);
  assert.deepEqual(parallel.state.unfavorableWuxing, ['土', '金']);
  assert.deepEqual(parallel.conflicts, []);

  const conflictingRole: ClimateRulePolicy = {
    mode: 'conditional',
    source: SOURCE,
    effects: [{ stem: '丙', wuxing: '火', role: '制金', targetStems: ['庚'], rank: 'primary' }],
  };
  const conflict = applyClimateCandidates(
    state(),
    collectClimateRuleCandidates(BASE_CONTEXT, {
      rules: [makeRule('conflict-a', bing), makeRule('conflict-b', conflictingRole)],
    }),
  );
  assert.equal(conflict.appliedCandidates, undefined);
  assert.match(conflict.conflicts[0] || '', /conflict-a、conflict-b/);
  assert.deepEqual(conflict.state.favorableWuxing, ['水', '木']);
});

test('conditional 作用项须与天干五行一致，来源字段齐全不能单独授予执行权', () => {
  const invalid = makeRule('invalid-effect', {
    mode: 'conditional',
    source: SOURCE,
    effects: [{ stem: '丙', wuxing: '水', role: '错误映射', rank: 'primary' }],
  });
  const candidate = collectClimateRuleCandidates(BASE_CONTEXT, { rules: [invalid] })[0];

  assert.equal(candidate.status, '满足');
  assert.equal(candidate.actionable, false);
  assert.match(candidate.policyIssue || '', /作用项/);
  const applied = applyClimateCandidates(state(), [candidate]);
  assert.equal(applied.appliedCandidate, undefined);
  assert.deepEqual(applied.state.favorableWuxing, ['水', '木']);
  assert.deepEqual(applied.state.unfavorableWuxing, ['火', '土', '金']);
});

test('负条件缺少原局数组时保持资料不足，不能把未知当成没有', () => {
  const rule = makeRule(
    'missing-negative-input',
    {
      mode: 'conditional',
      source: SOURCE,
      effects: [{ stem: '丙', wuxing: '火', role: '照暖', targetStems: ['甲'], rank: 'primary' }],
    },
    undefined,
    { maxStemTotalCounts: { 丙: 0, 丁: 0 } },
  );
  const candidate = collectClimateRuleCandidates(
    { monthBranch: '未', dayMaster: '木', dayStem: '甲' },
    { rules: [rule] },
  )[0];

  assert.equal(candidate.status, '资料不足');
  assert.deepEqual(candidate.missingInputs.sort(), ['hiddenStems', 'visibleStems']);
  assert.equal(candidate.actionable, false);
});

test('甲木丑月庚透缺丁规则降为 within-balance，无根时也不能条件性新增火', () => {
  const rule = CLIMATE_RULES.find((item) => item.id === 'jia-chou-geng-present-no-ding');
  assert.ok(rule);
  const candidates = collectClimateRuleCandidates(
    {
      strengthStatus: '身弱',
      monthBranch: '丑',
      dayMaster: '木',
      dayStem: '甲',
      visibleStems: ['甲', '庚'],
      hiddenStems: [],
      formationWuxings: [],
      wuxingCounts: { 木: 1, 火: 0, 土: 1, 金: 1, 水: 0 },
    },
    { rules: [rule] },
  );
  const candidate = candidates[0];
  assert.equal(candidate?.status, '满足');
  assert.equal(candidate?.mode, 'within-balance');
  assert.equal(candidate?.actionable, true);

  const applied = applyClimateCandidates(state(), candidates);
  assert.equal(applied.appliedCandidate?.mode, 'within-balance');
  assert.deepEqual(applied.state.favorableWuxing, ['水', '木']);
  assert.equal(applied.state.conditionalFavorableStems, undefined);
});

test('条件火已在原局时，甲子缺火 conditional 候选应明确不满足而非继续当作缺火', () => {
  const rule = CLIMATE_RULES.find((item) => item.id === 'jia-zi-ren-repeated-no-fire');
  assert.ok(rule);
  const candidates = collectClimateRuleCandidates(
    {
      strengthStatus: '身弱',
      monthBranch: '子',
      dayMaster: '木',
      dayStem: '甲',
      visibleStems: ['甲', '丙'],
      hiddenStems: [],
      formationWuxings: [],
      wuxingCounts: { 木: 1, 火: 1, 土: 0, 金: 0, 水: 2 },
    },
    { rules: [rule] },
  );
  const candidate = candidates[0];
  assert.equal(candidate?.mode, 'conditional');
  assert.equal(candidate?.status, '不满足');
  assert.deepEqual(candidate?.missingInputs, []);
  assert.equal(candidate?.actionable, false);
  const applied = applyClimateCandidates(state(), candidates);
  assert.equal(applied.appliedCandidate, undefined);
  assert.deepEqual(applied.state.favorableWuxing, ['水', '木']);
});

test('候选集保留满足、不满足、资料不足三态，执行层只消费满足项', () => {
  const satisfied = makeRule('three-state-satisfied', {
    mode: 'within-balance',
    source: SOURCE,
    effects: [],
  });
  const notSatisfied = makeRule(
    'three-state-not-satisfied',
    {
      mode: 'conditional',
      source: SOURCE,
      effects: [{ stem: '丙', wuxing: '火', role: '照暖', rank: 'primary' }],
    },
    undefined,
    { dayStems: ['乙'] },
  );
  const missing = makeRule(
    'three-state-missing',
    {
      mode: 'within-balance',
      source: SOURCE,
      effects: [{ stem: '丙', wuxing: '火', role: '照暖', rank: 'primary' }],
    },
    undefined,
    { maxStemTotalCounts: { 丙: 0 } },
  );
  const candidates = collectClimateRuleCandidates(BASE_CONTEXT, {
    rules: [satisfied, notSatisfied, missing],
  });

  assert.deepEqual(
    candidates.map((candidate) => [candidate.rule.id, candidate.status]),
    [
      ['three-state-satisfied', '满足'],
      ['three-state-not-satisfied', '不满足'],
      ['three-state-missing', '满足'],
    ],
  );
  const incompleteContext = { ...BASE_CONTEXT, visibleStems: undefined, hiddenStems: undefined };
  const incompleteCandidates = collectClimateRuleCandidates(incompleteContext, {
    rules: [satisfied, notSatisfied, missing],
  });
  assert.equal(
    incompleteCandidates.find((item) => item.rule.id === 'three-state-missing')?.status,
    '资料不足',
  );
  const applied = applyClimateCandidates(state(), candidates);
  assert.equal(applied.appliedCandidate?.rule.id, 'three-state-satisfied');
});

test('strengths 条件使用真实旺衰上下文，不把季节规则重新简化成五行计数', () => {
  const rule = makeRule(
    'strength-gated',
    {
      mode: 'conditional',
      source: SOURCE,
      effects: [{ stem: '丙', wuxing: '火', role: '照暖', rank: 'primary' }],
    },
    undefined,
    { strengths: ['身强'] },
  );
  const weak = collectClimateRuleCandidates(BASE_CONTEXT, { rules: [rule] })[0];
  const strong = collectClimateRuleCandidates(
    { ...BASE_CONTEXT, strengthStatus: '身强' },
    { rules: [rule] },
  )[0];
  assert.equal(weak.status, '不满足');
  assert.equal(strong.status, '满足');
  assert.equal(strong.actionable, true);
});

test('特殊格局跳过普通调候候选，并保留制化路径的原干证据', () => {
  const special = determineUsefulGod('极弱', { pattern: '从格', isSpecial: true }, '火', '子');
  assert.deepEqual(special.decisionEvidence?.climateCandidates, []);

  const pattern: PatternAnalysis = {
    pattern: '正官格',
    isSpecial: false,
    fulfillment: {
      patternName: '正官格',
      status: '成格',
      basis: '测试',
      contradiction: '',
      remedies: [
        { stem: '壬', pillar: 'month', tenGod: '偏印', effect: '化杀', placement: '透干' },
      ],
      summary: '测试',
      pathEvaluations: [
        {
          key: '印化杀',
          label: '印化杀',
          status: '满足',
          source: ['壬'],
          target: ['庚'],
          sourceStems: ['壬'],
          targetStems: ['庚'],
          position: '紧贴',
          positionPairs: ['月柱->日柱'],
          detail: '测试原局作用路径',
        },
      ],
    },
  };
  const result = determineUsefulGod('身弱', pattern, '木');
  assert.deepEqual(result.favorableWuxing, ['水', '木']);
  assert.equal(result.decisionEvidence?.controlPaths?.[0]?.status, '满足');
  assert.equal(result.decisionEvidence?.controlRemedies?.[0]?.stem, '壬');
  assert.deepEqual(result.decisionEvidence?.controlFunctions?.[0]?.sourceStems, ['壬']);
  assert.deepEqual(result.decisionEvidence?.controlFunctions?.[0]?.targetStems, ['庚']);
  assert.deepEqual(result.decisionEvidence?.controlFunctions?.[0]?.baseFavorableStems, ['壬']);
  assert.deepEqual(result.decisionEvidence?.controlFunctions?.[0]?.baseUnfavorableStems, ['庚']);
  assert.match(result.strategyTrace?.join('；') || '', /印化杀\[壬 -> 庚\]/);
});

test('五行与阴阳日主的扶抑基线均有互斥候选，未提供月令时不虚构调候执行', () => {
  for (const dmWuxing of ['木', '火', '土', '金', '水']) {
    for (const strengthStatus of ['身强', '身弱']) {
      const result = determineUsefulGod(
        strengthStatus,
        { pattern: '普通格', isSpecial: false },
        dmWuxing,
      );
      assert.ok(result.favorableWuxing && result.favorableWuxing.length > 0);
      assert.ok(result.unfavorableWuxing && result.unfavorableWuxing.length > 0);
      assert.equal(
        result.favorableWuxing?.some((wuxing) => result.unfavorableWuxing?.includes(wuxing)),
        false,
      );
      assert.deepEqual(result.decisionEvidence?.climateCandidates, []);
    }
  }
});
