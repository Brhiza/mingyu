import assert from 'node:assert/strict';
import test from 'node:test';

import { baziCalculator } from '../packages/core/src/bazi/baziCalculator';
import { CLIMATE_RULES } from '../packages/core/src/bazi/baziTherapeuticRules/climateRules';

// 原文：https://zh.wikisource.org/w/index.php?title=穷通宝鉴&oldid=2294674
test('甲乙木与庚金指定月令的实盘基础调候依本月原文列干和先后', () => {
  const cases = [
    {
      month: 8,
      day: 18,
      dayStem: '甲',
      monthBranch: '申',
      ruleId: 'shen-month-jia-bing-gui-first',
      stems: ['丁', '庚'],
      order: ['火', '金'],
      wording: /丁火为尊.*庚金次之/u,
    },
    {
      month: 11,
      day: 16,
      dayStem: '甲',
      monthBranch: '亥',
      ruleId: 'hai-month-jia-bing-gui-first',
      stems: ['庚', '丁', '丙'],
      order: ['金', '火'],
      wording: /庚金与丁火为要.*丙火次之/u,
    },
    {
      month: 11,
      day: 17,
      dayStem: '乙',
      monthBranch: '亥',
      ruleId: 'hai-month-yi-bing-gui-first',
      stems: ['丙', '戊'],
      order: ['火', '土'],
      wording: /丙火为用.*戊土次之/u,
    },
    {
      month: 8,
      day: 14,
      dayStem: '庚',
      monthBranch: '申',
      ruleId: 'shen-month-geng-jia-bing-first',
      stems: ['丁', '甲'],
      order: ['火', '木'],
      wording: /丁火煅炼.*甲木引丁/u,
    },
    {
      month: 10,
      day: 13,
      dayStem: '庚',
      monthBranch: '戌',
      ruleId: 'xu-month-geng-jia-ren',
      stems: ['甲', '壬'],
      order: ['木', '水'],
      wording: /甲木疏厚土为先.*壬水洗金为后/u,
    },
  ] as const;

  for (const sample of cases) {
    const chart = baziCalculator.calculateBazi({
      year: 2024,
      month: sample.month,
      day: sample.day,
      timeIndex: 6,
      gender: 'male',
      useTrueSolarTime: false,
    });
    assert.equal(chart.dayMaster.gan, sample.dayStem);
    assert.equal(chart.pillars.month.zhi, sample.monthBranch);

    const rule = CLIMATE_RULES.find((entry) => entry.id === sample.ruleId);
    assert.ok(rule, sample.ruleId);
    assert.deepEqual(rule.recommendationStems, sample.stems);
    assert.deepEqual(rule.favorableOrder, sample.order);
    assert.match(rule.description, sample.wording);

    const candidate = chart.analysis.usefulGod.decisionEvidence.climateCandidates.find(
      (entry) => entry.ruleId === sample.ruleId,
    );
    assert.equal(candidate?.status, '满足');
    assert.deepEqual(candidate?.requestedOrder, sample.order);
  }
});

test('庚戌仅保留甲先壬后的基础规则，庚申丁甲两透分支继续独立核对', () => {
  const gengXu = CLIMATE_RULES.filter(
    (rule) => rule.dayStems?.includes('庚') && rule.months.includes('戌'),
  );
  assert.deepEqual(
    gengXu.map((rule) => rule.id),
    ['xu-month-geng-jia-ren'],
  );
  assert.doesNotMatch(gengXu[0].hint, /甲壬两透.*科甲/u);

  const gengShenVisible = CLIMATE_RULES.find(
    (rule) => rule.id === 'shen-month-geng-ding-jia-visible',
  );
  assert.deepEqual(gengShenVisible?.requiredVisibleStems, ['丁', '甲']);
});
