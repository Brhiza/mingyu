import assert from 'node:assert/strict';
import test from 'node:test';

import { baziCalculator } from '../packages/core/src/bazi/baziCalculator';

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
