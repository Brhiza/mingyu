import assert from 'node:assert/strict';
import test from 'node:test';

import { baziCalculator } from '../packages/core/src/bazi/baziCalculator';
import { CLIMATE_RULES } from '../packages/core/src/bazi/baziTherapeuticRules/climateRules';
import { getBaziQiongtongAdvice } from '../packages/core/src/classics';

// 《穷通宝鉴·九月丙火》：https://zh.wikisource.org/w/index.php?title=穷通宝鉴&oldid=2294674
test('丙日戌月庚戊困木水按实盘透藏命中，缺木时不命中', () => {
  const ruleId = 'xu-month-bing-geng-wu-trap-jia-ren';
  const chartWithWood = baziCalculator.calculateBazi({
    year: 1982,
    month: 10,
    day: 10,
    timeIndex: 0,
    gender: 'male',
    isLunar: false,
  });
  assert.deepEqual(
    Object.values(chartWithWood.pillars).map((pillar) => pillar.ganZhi),
    ['壬戌', '庚戌', '丙寅', '戊子'],
  );
  assert.ok(chartWithWood.analysis.usefulGod.matchedRules?.some((item) => item.id === ruleId));

  const chartWithoutWood = baziCalculator.calculateBazi({
    year: 1982,
    month: 10,
    day: 20,
    timeIndex: 0,
    gender: 'male',
    isLunar: false,
  });
  assert.deepEqual(
    Object.values(chartWithoutWood.pillars).map((pillar) => pillar.ganZhi),
    ['壬戌', '庚戌', '丙子', '戊子'],
  );
  assert.ok(!chartWithoutWood.analysis.usefulGod.matchedRules?.some((item) => item.id === ruleId));
});

// 固定底本：https://zh.wikisource.org/w/index.php?title=穷通宝鉴&oldid=2294674
test('十四组月令基础取用进入真实盘候选而不直接改综合喜用', () => {
  const cases = [
    {
      name: '丙寅',
      month: 2,
      day: 12,
      pillars: ['甲辰', '丙寅', '丙午', '甲午'],
      id: 'yin-month-bing-ren-geng-first',
      stems: ['壬', '庚'],
      order: ['水', '金'],
      verse: /取壬为尊，庚金佐之/u,
    },
    {
      name: '丙卯',
      month: 3,
      day: 13,
      pillars: ['甲辰', '丁卯', '丙子', '甲午'],
      id: 'mao-month-bing-ren-first',
      stems: ['壬'],
      order: ['水'],
      verse: /耑用壬水/u,
    },
    {
      name: '丙辰',
      month: 4,
      day: 12,
      pillars: ['甲辰', '戊辰', '丙午', '甲午'],
      id: 'chen-month-bing-ren-first',
      stems: ['壬'],
      order: ['水'],
      verse: /用壬水.*壬不可离/u,
    },
    {
      name: '丙酉',
      month: 9,
      day: 19,
      pillars: ['甲辰', '癸酉', '丙戌', '甲午'],
      id: 'you-month-bing-ren-first',
      stems: ['壬'],
      order: ['水'],
      verse: /仍用壬水辅映/u,
    },
    {
      name: '丙戌',
      month: 10,
      day: 19,
      pillars: ['甲辰', '甲戌', '丙辰', '甲午'],
      id: 'xu-month-bing-jia-ren-first',
      stems: ['甲', '壬'],
      order: ['木', '水'],
      verse: /先用甲木，次取壬水/u,
    },
    {
      name: '丁酉',
      month: 9,
      day: 10,
      pillars: ['甲辰', '癸酉', '丁丑', '丙午'],
      id: 'you-month-ding-jia-geng-bing',
      stems: ['甲', '庚', '丙'],
      order: ['木', '金', '火'],
      verse: /八月甲丙庚皆用/u,
    },
    {
      name: '戊申',
      month: 8,
      day: 12,
      pillars: ['甲辰', '壬申', '戊申', '戊午'],
      id: 'shen-month-wu-bing-gui-jia-first',
      stems: ['丙', '癸', '甲'],
      order: ['火', '水', '木'],
      verse: /先丙后癸，甲木次之/u,
    },
    {
      name: '戊酉',
      month: 9,
      day: 11,
      pillars: ['甲辰', '癸酉', '戊寅', '戊午'],
      id: 'you-month-wu-bing-gui-first',
      stems: ['丙', '癸'],
      order: ['火', '水'],
      verse: /先丙后癸，不必木疏/u,
    },
    {
      name: '己未',
      month: 7,
      day: 14,
      pillars: ['甲辰', '辛未', '己卯', '庚午'],
      id: 'wei-month-ji-gui-bing-first',
      stems: ['癸', '丙'],
      order: ['水', '火'],
      verse: /取癸为要，次用丙火/u,
    },
    {
      name: '辛寅',
      month: 2,
      day: 17,
      pillars: ['甲辰', '丙寅', '辛亥', '甲午'],
      id: 'yin-month-xin-ji-ren-first',
      stems: ['己', '壬', '庚'],
      order: ['土', '水', '金'],
      verse: /先己后壬.*庚为佐/u,
    },
    {
      name: '辛卯',
      month: 3,
      day: 18,
      pillars: ['甲辰', '丁卯', '辛巳', '甲午'],
      id: 'mao-month-xin-ren-first',
      stems: ['壬'],
      order: ['水'],
      verse: /壬水为尊/u,
    },
    {
      name: '辛辰',
      month: 4,
      day: 27,
      pillars: ['甲辰', '戊辰', '辛酉', '甲午'],
      id: 'chen-month-xin-ren-jia-first',
      stems: ['壬', '甲'],
      order: ['水', '木'],
      verse: /先壬后甲/u,
    },
    {
      name: '癸午',
      month: 6,
      day: 18,
      pillars: ['甲辰', '庚午', '癸丑', '戊午'],
      id: 'wu-month-gui-geng-xin-ren-reference',
      stems: ['庚', '辛', '壬'],
      order: ['金'],
      verse: /庚辛壬参酌并用/u,
    },
    {
      name: '癸未',
      month: 7,
      day: 18,
      pillars: ['甲辰', '辛未', '癸未', '戊午'],
      id: 'wei-month-gui-geng-xin-first',
      stems: ['庚', '辛'],
      order: ['金'],
      verse: /上半月庚辛休囚.*专用庚辛/u,
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
    assert.deepEqual(
      Object.values(chart.pillars).map((pillar) => pillar.ganZhi),
      sample.pillars,
      `${sample.name}：真实四柱`,
    );
    assert.match(
      getBaziQiongtongAdvice(sample.name[0], sample.name[1])?.classicVerse ?? '',
      sample.verse,
      `${sample.name}：月令原文`,
    );
    const rule = CLIMATE_RULES.find((item) => item.id === sample.id);
    assert.ok(rule, `${sample.name}：基础规则存在`);
    assert.deepEqual(rule.recommendationStems, sample.stems, `${sample.name}：具体荐干`);
    const candidate = chart.analysis.usefulGod.decisionEvidence?.climateCandidates.find(
      (item) => item.ruleId === sample.id,
    );
    assert.ok(candidate, `${sample.name}：候选存在`);
    assert.equal(candidate.status, '满足', `${sample.name}：候选状态`);
    assert.equal(candidate.mode, 'reference', `${sample.name}：参考层`);
    assert.equal(candidate.adopted, false, `${sample.name}：不直接采纳`);
    assert.deepEqual(candidate.requestedOrder, sample.order, `${sample.name}：月令取用层次`);
  }
});

test('月令基础参考不覆盖无壬权代和透藏成格分支', () => {
  const cases = [
    {
      name: '丙卯无壬己透',
      input: { month: 3, day: 23, timeIndex: 1 },
      pillars: ['甲辰', '丁卯', '丙戌', '己丑'],
      expected: 'mao-month-bing-no-ren-ji-temporary',
    },
    {
      name: '己未无癸壬透',
      input: { month: 7, day: 14, timeIndex: 8 },
      pillars: ['甲辰', '辛未', '己卯', '壬申'],
      expected: 'si-wu-wei-month-ji-no-gui-ren-allowed',
    },
    {
      name: '丙辰甲透壬未透',
      input: { month: 4, day: 22, timeIndex: 6 },
      pillars: ['甲辰', '戊辰', '丙辰', '甲午'],
      expected: 'chen-month-bing-jia-no-ren',
    },
  ] as const;
  for (const sample of cases) {
    const chart = baziCalculator.calculateBazi({
      year: 2024,
      ...sample.input,
      gender: 'male',
      useTrueSolarTime: false,
    });
    assert.deepEqual(
      Object.values(chart.pillars).map((pillar) => pillar.ganZhi),
      sample.pillars,
      `${sample.name}：真实四柱`,
    );
    assert.equal(
      chart.analysis.usefulGod.decisionEvidence?.climateCandidates.find(
        (item) => item.status === '满足',
      )?.ruleId,
      sample.expected,
      `${sample.name}：条件分支优先`,
    );
    assert.ok(
      chart.analysis.usefulGod.decisionEvidence?.climateCandidates.some(
        (item) => item.status === '满足' && item.mode === 'reference' && !item.adopted,
      ),
      `${sample.name}：参考未改综合取用`,
    );
    if (sample.expected === 'chen-month-bing-jia-no-ren') {
      assert.deepEqual(chart.analysis.usefulGod.decisionEvidence?.climateReferenceOrder, [
        '水',
        '木',
      ]);
    }
  }
});
