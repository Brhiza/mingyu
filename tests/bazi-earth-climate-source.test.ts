import assert from 'node:assert/strict';
import test from 'node:test';

import { baziCalculator } from '../packages/core/src/bazi/baziCalculator';
import { CLIMATE_RULES } from '../packages/core/src/bazi/baziTherapeuticRules/climateRules';
import { getBaziQiongtongAdvice } from '../packages/core/src/classics';

// 校核底本：https://zh.wikisource.org/w/index.php?title=穷通宝鉴&oldid=2294674
const cases = [
  {
    month: 2,
    day: 15,
    dayStem: '己',
    monthBranch: '寅',
    id: 'yin-month-ji-bing-jia-first',
    stems: ['丙'],
    order: ['火'],
    label: /丙火为尊/u,
    verse: /正月己土.*故丙为尊/u,
  },
  {
    month: 8,
    day: 13,
    dayStem: '己',
    monthBranch: '申',
    id: 'shen-month-ji-bing-jia-first',
    stems: ['癸', '丙', '辛'],
    order: ['水', '火', '金'],
    label: /先癸后丙/u,
    verse: /三秋己土，先癸后丙，取辛辅癸/u,
  },
  {
    month: 5,
    day: 14,
    dayStem: '戊',
    monthBranch: '巳',
    id: 'si-month-wu-gui-bing-first',
    stems: ['甲', '丙', '癸'],
    order: ['木', '火', '水'],
    label: /甲先丙癸为佐/u,
    verse: /四月戊土.*先用甲疏噼，次取丙癸为佐/u,
  },
  {
    month: 11,
    day: 10,
    dayStem: '戊',
    monthBranch: '亥',
    id: 'hai-month-wu-bing-jia-first',
    stems: ['甲', '丙'],
    order: ['木', '火'],
    label: /先甲后丙/u,
    verse: /十月戊土.*先用甲木，次取丙火/u,
  },
  {
    month: 5,
    day: 15,
    dayStem: '己',
    monthBranch: '巳',
    id: 'si-month-ji-bing-gui-first',
    stems: ['癸', '丙'],
    order: ['水', '火'],
    label: /先癸后丙/u,
    verse: /三夏己土.*取癸为要，次用丙火/u,
  },
];

for (const sample of cases) {
  test(`${sample.dayStem}日${sample.monthBranch}月实盘调候参考与本月条文保持一致`, () => {
    const result = baziCalculator.calculateBazi({
      year: 2024,
      month: sample.month,
      day: sample.day,
      timeIndex: 6,
      gender: 'male',
      useTrueSolarTime: false,
    });
    assert.equal(result.pillars.day.gan, sample.dayStem);
    assert.equal(result.pillars.month.zhi, sample.monthBranch);
    const reference = getBaziQiongtongAdvice(sample.dayStem, sample.monthBranch);
    assert.ok(reference);
    assert.match(reference.classicVerse, sample.verse);

    const rule = CLIMATE_RULES.find((item) => item.id === sample.id);
    assert.ok(rule);
    assert.deepEqual(rule.recommendationStems, sample.stems);
    const matched = result.analysis.usefulGod.matchedRules?.find((item) => item.id === sample.id);
    assert.ok(matched);
    assert.match(matched.label, sample.label);
    const candidates = result.analysis.usefulGod.decisionEvidence?.climateCandidates.filter(
      (item) => item.ruleId === sample.id,
    );
    assert.ok(candidates);
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].status, '满足');
    assert.deepEqual(candidates[0].requestedOrder, sample.order);
    assert.equal(candidates[0].mode, 'reference');
    assert.equal(candidates[0].adopted, false);
  });
}
