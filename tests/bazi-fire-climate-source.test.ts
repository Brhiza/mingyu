import assert from 'node:assert/strict';
import test from 'node:test';

import { baziCalculator } from '../packages/core/src/bazi/baziCalculator';
import { CLIMATE_RULES } from '../packages/core/src/bazi/baziTherapeuticRules/climateRules';
import { getBaziQiongtongAdvice } from '../packages/core/src/classics/bazi-qiongtong';

// 校核底本：https://zh.wikisource.org/w/index.php?title=穷通宝鉴&oldid=2294674
test('丙丁月令基础规则由实际四柱进入调候参考，荐干和文字与本月原文一致', () => {
  const cases: Array<{
    date: [number, number];
    pillars: string[];
    ruleId: string;
    stems: string[];
    order: string[];
    hint: RegExp;
  }> = [
    {
      date: [8, 10],
      pillars: ['甲辰', '壬申', '丙午', '甲午'],
      ruleId: 'shen-month-bing-wu-xin-first',
      stems: ['壬'],
      order: ['水'],
      hint: /取壬映光；壬多时取戊/u,
    },
    {
      date: [1, 13],
      pillars: ['癸卯', '乙丑', '丙子', '甲午'],
      ruleId: 'chou-month-bing-wu-xin-first',
      stems: ['壬'],
      order: ['水'],
      hint: /喜壬为用；土多时还须甲/u,
    },
    {
      date: [2, 13],
      pillars: ['甲辰', '丙寅', '丁未', '丙午'],
      ruleId: 'yin-month-ding-geng-chop-jia',
      stems: ['庚'],
      order: ['金', '木'],
      hint: /庚劈甲引丁/u,
    },
    {
      date: [3, 14],
      pillars: ['甲辰', '丁卯', '丁丑', '丙午'],
      ruleId: 'mao-month-ding-jia-geng-first',
      stems: ['庚', '甲'],
      order: ['金', '木'],
      hint: /先庚去乙，后甲引丁/u,
    },
    {
      date: [5, 13],
      pillars: ['甲辰', '己巳', '丁丑', '丙午'],
      ruleId: 'si-month-ding-geng-jia-first',
      stems: ['甲', '庚'],
      order: ['木', '金'],
      hint: /甲引丁、庚劈甲；甲多时庚为先/u,
    },
    {
      date: [7, 12],
      pillars: ['甲辰', '辛未', '丁丑', '丙午'],
      ruleId: 'wei-month-ding-geng-jia-first',
      stems: ['甲', '壬'],
      order: ['木', '水'],
      hint: /专取甲木，壬水次之/u,
    },
    {
      date: [8, 11],
      pillars: ['甲辰', '壬申', '丁未', '丙午'],
      ruleId: 'shen-month-ding-geng-jia-first',
      stems: ['甲', '庚'],
      order: ['木', '金'],
      hint: /甲木为主、庚劈甲引丁，可借丙/u,
    },
    {
      date: [10, 10],
      pillars: ['甲辰', '甲戌', '丁未', '丙午'],
      ruleId: 'xu-month-ding-geng-jia-first',
      stems: ['甲', '庚'],
      order: ['木', '金'],
      hint: /专用甲庚，甲引丁、庚劈甲/u,
    },
    {
      date: [11, 19],
      pillars: ['甲辰', '乙亥', '丁亥', '丙午'],
      ruleId: 'hai-month-ding-geng-jia-first',
      stems: ['甲', '庚'],
      order: ['木', '金'],
      hint: /甲木为尊，庚金为佐/u,
    },
  ];

  for (const { date, pillars, ruleId, stems, order, hint } of cases) {
    const chart = baziCalculator.calculateBazi({
      year: 2024,
      month: date[0],
      day: date[1],
      timeIndex: 6,
      gender: 'male',
      isLunar: false,
    });
    assert.deepEqual(
      Object.values(chart.pillars).map((pillar) => pillar.ganZhi),
      pillars,
      ruleId,
    );
    const rule = CLIMATE_RULES.find((item) => item.id === ruleId);
    assert.ok(rule, ruleId);
    assert.deepEqual(rule.recommendationStems, stems, ruleId);
    assert.deepEqual(rule.favorableOrder, order, ruleId);
    assert.deepEqual(
      chart.analysis.usefulGod.decisionEvidence?.climateReferenceOrder,
      order,
      ruleId,
    );
    assert.ok(
      chart.analysis.usefulGod.matchedRules?.some((item) => item.id === ruleId),
      ruleId,
    );
    assert.match(
      chart.analysis.usefulGod.strategyTrace?.find((item) => item.startsWith('病药提示:')) ?? '',
      hint,
      ruleId,
    );
  }
});

test('丙亥调候保留经典随局取用条件', () => {
  const chart = baziCalculator.calculateBazi({
    year: 2024,
    month: 11,
    day: 18,
    timeIndex: 6,
    gender: 'male',
    isLunar: false,
  });
  assert.deepEqual(
    Object.values(chart.pillars).map((pillar) => pillar.ganZhi),
    ['甲辰', '乙亥', '丙戌', '甲午'],
  );
  assert.ok(!CLIMATE_RULES.some((rule) => rule.id === 'hai-month-bing-wu-xin-first'));
  assert.ok(
    !chart.analysis.usefulGod.matchedRules?.some(
      (rule) => rule.id === 'hai-month-bing-wu-xin-first',
    ),
  );
  assert.match(
    getBaziQiongtongAdvice('丙', '亥')?.classicVerse ?? '',
    /木旺宜庚，水旺宜戊，火旺用壬/u,
  );
});

test('丁卯庚乙俱透的条件分支保留其优先级与取用作用', () => {
  const conditional = CLIMATE_RULES.find(
    (rule) => rule.id === 'mao-month-ding-geng-yi-greedy-combine',
  );
  const baseline = CLIMATE_RULES.find((rule) => rule.id === 'mao-month-ding-jia-geng-first');
  assert.ok(conditional && baseline);
  assert.deepEqual(conditional.requiredVisibleStems, ['庚', '乙']);
  assert.ok((conditional.priority ?? 0) > (baseline.priority ?? 0));
  assert.match(conditional.hint, /庚乙俱透/u);
});
