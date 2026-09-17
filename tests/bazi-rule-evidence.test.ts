import test from 'node:test';
import assert from 'node:assert/strict';
import { assessRuleMatch, matchFirstRule } from '@core/bazi/baziRuleMatcher';

test('未提供透干资料不能推导为无癸，已核查空数组才满足无癸条件', () => {
  const rule = { id: 'no-gui', forbiddenVisibleStems: ['癸'] };
  assert.equal(assessRuleMatch(rule, {}).status, '资料不足');
  assert.equal(assessRuleMatch(rule, { visibleStems: [] }).status, '满足');
  assert.equal(assessRuleMatch(rule, { visibleStems: ['癸'] }).status, '不满足');
});

test('数量上限与成局排除条件同样需要实际核查证据', () => {
  const excludedFormation = { id: 'exclude-water', forbiddenFormationWuxings: ['水'] };
  assert.equal(assessRuleMatch(excludedFormation, {}).status, '资料不足');
  assert.equal(assessRuleMatch(excludedFormation, { formationWuxings: [] }).status, '满足');
  assert.equal(assessRuleMatch(excludedFormation, { formationWuxings: ['水'] }).status, '不满足');
  assert.equal(
    assessRuleMatch({ id: 'max', maxHiddenStemCounts: { 癸: 0 } }, {}).status,
    '资料不足',
  );
  assert.equal(
    assessRuleMatch(
      { id: 'formation', forbiddenFormationTenGodCategories: ['印星'] },
      { dayStem: '甲' },
    ).status,
    '资料不足',
  );
});

test('高优先级规则证据不足时保留基础规则，不把缺资料当作命中', () => {
  const fallback = { id: 'base', months: ['午'], priority: 1 };
  assert.equal(
    matchFirstRule(
      [{ id: 'conditional', months: ['午'], forbiddenVisibleStems: ['癸'], priority: 2 }, fallback],
      { monthBranch: '午' },
    )?.id,
    fallback.id,
  );
});

test('已知月份不符即可排除规则，不受其他条件缺资料影响', () => {
  assert.equal(
    assessRuleMatch(
      { id: 'summer-no-gui', months: ['午'], forbiddenVisibleStems: ['癸'] },
      { monthBranch: '子' },
    ).status,
    '不满足',
  );
});

test('只查透干种类的条件不要求藏干资料，全局条件需要两类资料', () => {
  const rule = {
    id: 'distinct',
    distinctStemGroupCounts: [
      { stems: ['甲', '乙'], minDistinctCount: 1, scope: 'visible' as const },
    ],
  };
  assert.equal(assessRuleMatch(rule, { visibleStems: ['甲'] }).status, '满足');
  assert.equal(
    assessRuleMatch(
      {
        ...rule,
        distinctStemGroupCounts: [{ ...rule.distinctStemGroupCounts[0], scope: 'total' }],
      },
      { visibleStems: ['甲'] },
    ).status,
    '资料不足',
  );
});

test('复合种类条件中已有反证时，不因另一组藏干资料缺失而保留候选', () => {
  assert.equal(
    assessRuleMatch(
      {
        id: 'mixed-distinct',
        distinctStemGroupCounts: [
          { stems: ['甲', '乙'], minDistinctCount: 1, scope: 'visible' },
          { stems: ['壬', '癸'], minDistinctCount: 1, scope: 'hidden' },
        ],
      },
      { visibleStems: ['丙'] },
    ).status,
    '不满足',
  );
});

test('完整资料同时遵守全含、任一与排除条件，未知资料仍保持三态区别', () => {
  const rule = {
    id: 'combined-all-any-not',
    requiredVisibleStems: ['甲', '丙'],
    optionalHiddenStems: ['庚', '辛'],
    forbiddenFormationWuxings: ['水'],
  };

  assert.deepEqual(
    assessRuleMatch(rule, {
      visibleStems: ['甲', '丙', '戊'],
      hiddenStems: ['辛'],
      formationWuxings: [],
    }),
    { ruleId: rule.id, status: '满足', missingInputs: [] },
  );
  assert.equal(
    assessRuleMatch(rule, {
      visibleStems: ['甲', '丙'],
      hiddenStems: ['壬'],
      formationWuxings: [],
    }).status,
    '不满足',
  );
  assert.equal(
    assessRuleMatch(rule, {
      visibleStems: ['甲', '丙'],
      hiddenStems: ['庚'],
      formationWuxings: ['水'],
    }).status,
    '不满足',
  );
  assert.equal(
    assessRuleMatch(rule, {
      visibleStems: ['甲', '丙'],
      hiddenStems: ['庚'],
      formationWuxings: undefined,
    }).status,
    '资料不足',
  );
});
