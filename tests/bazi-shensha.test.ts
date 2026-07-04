import test from 'node:test';
import assert from 'node:assert/strict';

import { ShenShaCalculator as CoreShenShaCalculator } from '../packages/core/src/bazi/baziShenSha';
import { ShenShaCalculator } from '../src/utils/bazi/baziShenSha';

function createCalculators(options?: ConstructorParameters<typeof CoreShenShaCalculator>[0]) {
  return [new ShenShaCalculator(options), new CoreShenShaCalculator(options)];
}

test('天德合在落地支的月份也应能正确命中', () => {
  const calculator = new ShenShaCalculator();
  const result = calculator.calculateAllShenSha(
    [
      ['甲', '子'],
      ['丙', '卯'],
      ['丁', '巳'],
      ['庚', '申'],
    ],
    'male',
  );

  assert.ok(result.day.includes('天德合'));
  assert.ok(!result.year.includes('天德合'));
  assert.ok(!result.month.includes('天德合'));
  assert.ok(!result.hour.includes('天德合'));
});

test('元辰对阳男阴女应取年支相冲之前一位，不应取后一位', () => {
  const calculator = new ShenShaCalculator();
  const result = calculator.calculateAllShenSha(
    [
      ['甲', '子'],
      ['丙', '寅'],
      ['庚', '午'],
      ['丁', '巳'],
    ],
    'male',
  );

  assert.ok(result.hour.includes('元辰'));
  assert.ok(!result.month.includes('元辰'));
});

test('童子煞应只按日支或时支查，不应把年柱月柱也算进去', () => {
  const calculator = new ShenShaCalculator();
  const result = calculator.calculateAllShenSha(
    [
      ['甲', '子'],
      ['丙', '寅'],
      ['庚', '午'],
      ['丁', '酉'],
    ],
    'male',
  );

  assert.ok(!result.year.includes('童子煞'));
  assert.ok(!result.month.includes('童子煞'));
});

test('童子煞按常用口诀应识别春秋寅子贵', () => {
  const calculator = new ShenShaCalculator();
  const result = calculator.calculateAllShenSha(
    [
      ['甲', '申'],
      ['丙', '酉'],
      ['庚', '子'],
      ['丁', '丑'],
    ],
    'male',
  );

  assert.ok(result.day.includes('童子煞'));
});

test('勾绞煞应取年支前三辰后三辰，不应错算成四辰', () => {
  const calculator = new ShenShaCalculator();
  const result = calculator.calculateAllShenSha(
    [
      ['甲', '子'],
      ['丙', '寅'],
      ['庚', '午'],
      ['丁', '卯'],
    ],
    'male',
  );

  assert.ok(result.hour.includes('勾绞煞'));
});

test('金神按经典口径取日柱或时柱，不应只取时柱', () => {
  const calculator1 = new ShenShaCalculator();
  const result1 = calculator1.calculateAllShenSha(
    [
      ['甲', '子'],
      ['丙', '寅'],
      ['乙', '丑'],
      ['丁', '卯'],
    ],
    'male',
  );
  assert.ok(result1.day.includes('金神'));

  const result2 = calculator1.calculateAllShenSha(
    [
      ['甲', '子'],
      ['丙', '寅'],
      ['庚', '午'],
      ['乙', '丑'],
    ],
    'male',
  );
  assert.ok(result2.hour.includes('金神'));
});

test('德秀贵人在申子辰月应按三命通会取干表', () => {
  const calculator = new ShenShaCalculator();
  const hitResult = calculator.calculateAllShenSha(
    [
      ['辛', '酉'],
      ['戊', '申'],
      ['丙', '午'],
      ['辛', '卯'],
    ],
    'male',
  );
  const missResult = calculator.calculateAllShenSha(
    [
      ['戊', '辰'],
      ['戊', '申'],
      ['乙', '卯'],
      ['癸', '亥'],
    ],
    'male',
  );

  assert.ok(hitResult.month.includes('德秀贵人'));
  assert.ok(hitResult.day.includes('德秀贵人'));
  assert.ok(!missResult.month.includes('德秀贵人'));
  assert.ok(!missResult.day.includes('德秀贵人'));
});

test('三奇贵人应按年月日时顺布取用，不应要求相邻三柱', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['乙', '丑'],
        ['丙', '寅'],
        ['庚', '申'],
        ['丁', '亥'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['丁', '丑'],
        ['丙', '寅'],
        ['庚', '申'],
        ['乙', '亥'],
      ],
      'male',
    );

    assert.ok(hitResult.global?.includes('三奇贵人'));
    assert.ok(!missResult.global?.includes('三奇贵人'));
  }
});

test('月空应按月德互换取干', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['乙', '寅'],
        ['壬', '午'],
        ['丁', '亥'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['乙', '寅'],
        ['癸', '午'],
        ['丁', '亥'],
      ],
      'male',
    );

    assert.ok(hitResult.day.includes('月空'));
    assert.ok(!Object.values(missResult).flat().includes('月空'));
  }
});

test('披麻应取年支后三位，不应只退一位', () => {
  const calculator = new ShenShaCalculator();
  const result = calculator.calculateAllShenSha(
    [
      ['甲', '子'],
      ['丙', '寅'],
      ['庚', '午'],
      ['丁', '酉'],
    ],
    'male',
  );

  assert.ok(result.hour.includes('披麻'));
  assert.ok(!result.month.includes('披麻'));
});

test('六厄应按年支或日支三合死地取出', () => {
  for (const calculator of createCalculators()) {
    const result = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丁', '卯'],
        ['乙', '亥'],
        ['壬', '午'],
      ],
      'male',
    );

    assert.ok(result.month.includes('六厄'));
    assert.ok(result.hour.includes('六厄'));
    assert.ok(!result.year.includes('六厄'));
    assert.ok(!result.day.includes('六厄'));
  }
});

test('天杀应按劫杀前二辰取出', () => {
  for (const calculator of createCalculators()) {
    const result = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丁', '未'],
        ['庚', '寅'],
        ['辛', '丑'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丁', '午'],
        ['庚', '寅'],
        ['辛', '子'],
      ],
      'male',
    );

    assert.ok(result.month.includes('天杀'));
    assert.ok(result.hour.includes('天杀'));
    assert.ok(!missResult.month.includes('天杀'));
    assert.ok(!missResult.hour.includes('天杀'));
  }
});

test('五行精纪劫头杀与劫头鬼应按年干年支定例取用', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '寅'],
        ['己', '亥'],
        ['辛', '亥'],
        ['丁', '卯'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '寅'],
        ['己', '戌'],
        ['辛', '戌'],
        ['丁', '卯'],
      ],
      'male',
    );

    assert.ok(hitResult.month.includes('劫头杀'));
    assert.ok(hitResult.day.includes('劫头鬼'));
    assert.ok(
      !Object.values(missResult)
        .flat()
        .some((name) => ['劫头杀', '劫头鬼'].includes(name)),
    );
  }
});

test('地杀应按劫杀前五辰取出', () => {
  for (const calculator of createCalculators()) {
    const result = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '戌'],
        ['庚', '寅'],
        ['戊', '辰'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丁', '酉'],
        ['庚', '寅'],
        ['辛', '卯'],
      ],
      'male',
    );

    assert.ok(result.month.includes('地杀'));
    assert.ok(result.hour.includes('地杀'));
    assert.ok(!missResult.month.includes('地杀'));
    assert.ok(!missResult.hour.includes('地杀'));
  }
});

test('隔角应按日时隔一字判断并只在时柱标记', () => {
  for (const calculator of createCalculators()) {
    const forwardResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['戊', '丑'],
        ['丁', '卯'],
      ],
      'male',
    );
    const reverseResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['戊', '卯'],
        ['丁', '丑'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['戊', '丑'],
        ['丁', '辰'],
      ],
      'male',
    );

    assert.ok(forwardResult.hour.includes('隔角'));
    assert.ok(!forwardResult.day.includes('隔角'));
    assert.ok(reverseResult.hour.includes('隔角'));
    assert.ok(!missResult.hour.includes('隔角'));
  }
});

test('官符病符死符应按太岁十二宫补入八字神煞', () => {
  for (const calculator of createCalculators()) {
    const guanFuResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['戊', '辰'],
        ['戊', '午'],
        ['庚', '辰'],
      ],
      'male',
    );
    const bingSiResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['己', '巳'],
        ['己', '巳'],
        ['乙', '亥'],
      ],
      'male',
    );

    assert.ok(guanFuResult.hour.includes('官符'));
    assert.ok(!guanFuResult.month.includes('官符'));
    assert.ok(bingSiResult.month.includes('死符'));
    assert.ok(bingSiResult.day.includes('死符'));
    assert.ok(bingSiResult.hour.includes('病符'));
  }
});

test('太岁十二宫应按流年星耀补出同宫星名', () => {
  const assertIncludes = (actual: string[], expected: string[]) => {
    for (const name of expected) {
      assert.ok(actual.includes(name), `${name} 应命中`);
    }
  };

  for (const calculator of createCalculators()) {
    const earlyPalaces = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['己', '丑'],
        ['戊', '寅'],
        ['庚', '卯'],
      ],
      'male',
    );
    const middlePalaces = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['己', '巳'],
        ['戊', '辰'],
        ['庚', '戌'],
      ],
      'male',
    );
    const latePalaces = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['庚', '午'],
        ['辛', '未'],
        ['癸', '酉'],
      ],
      'male',
    );
    const endPalaces = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['己', '申'],
        ['戊', '亥'],
        ['庚', '戌'],
      ],
      'male',
    );

    assertIncludes(earlyPalaces.year, ['太岁', '剑锋', '伏尸']);
    assertIncludes(earlyPalaces.month, ['太阳', '天空']);
    assertIncludes(earlyPalaces.day, ['丧门', '地丧']);
    assertIncludes(earlyPalaces.hour, ['勾绞', '贯索']);
    assertIncludes(middlePalaces.day, ['官符', '五鬼']);
    assertIncludes(middlePalaces.month, ['死符', '小耗']);
    assertIncludes(latePalaces.month, ['栏杆', '大耗']);
    assertIncludes(latePalaces.day, ['暴败', '天厄']);
    assertIncludes(endPalaces.month, ['飞廉', '白虎']);
    assertIncludes(latePalaces.hour, ['卷舌', '福星']);
    assertIncludes(endPalaces.hour, ['吊客', '天狗']);
    assertIncludes(endPalaces.day, ['病符']);
  }
});

test('暗金的煞应按年支分组补出古籍星名', () => {
  for (const calculator of createCalculators()) {
    const yinShenResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['己', '巳'],
        ['庚', '午'],
        ['辛', '酉'],
      ],
      'male',
    );
    const poSuiResult = calculator.calculateAllShenSha(
      [
        ['丙', '寅'],
        ['丁', '酉'],
        ['戊', '子'],
        ['己', '丑'],
      ],
      'male',
    );
    const baiYiResult = calculator.calculateAllShenSha(
      [
        ['戊', '辰'],
        ['己', '丑'],
        ['庚', '午'],
        ['辛', '未'],
      ],
      'male',
    );

    assert.ok(yinShenResult.month.includes('吟呻煞'));
    assert.ok(yinShenResult.month.includes('太白星'));
    assert.ok(yinShenResult.month.includes('斧劈星'));
    assert.ok(poSuiResult.month.includes('破碎煞'));
    assert.ok(poSuiResult.month.includes('太白星'));
    assert.ok(poSuiResult.month.includes('斧劈星'));
    assert.ok(baiYiResult.month.includes('白衣煞'));
    assert.ok(baiYiResult.month.includes('太白星'));
    assert.ok(baiYiResult.month.includes('斧劈星'));
  }
});

test('破军应按年支三合组取位', () => {
  for (const calculator of createCalculators()) {
    const cases: [string, string][][] = [
      [['甲', '申'], ['乙', '亥'], ['丙', '子'], ['丁', '丑']],
      [['甲', '亥'], ['乙', '寅'], ['丙', '子'], ['丁', '丑']],
      [['甲', '寅'], ['乙', '巳'], ['丙', '子'], ['丁', '丑']],
      [['甲', '巳'], ['乙', '申'], ['丙', '子'], ['丁', '丑']],
    ];

    for (const pillars of cases) {
      const result = calculator.calculateAllShenSha(pillars, 'male');
      assert.ok(result.month.includes('破军'));
    }
  }
});

test('三公煞应按生年地支分组匹配固定干支', () => {
  for (const calculator of createCalculators()) {
    const result = calculator.calculateAllShenSha(
      [
        ['甲', '寅'],
        ['壬', '子'],
        ['庚', '申'],
        ['辛', '酉'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '寅'],
        ['甲', '子'],
        ['庚', '申'],
        ['辛', '酉'],
      ],
      'male',
    );

    assert.ok(result.month.includes('三公煞'));
    assert.ok(!missResult.month.includes('三公煞'));
  }
});

test('截路空亡应只按日干取时支判断', () => {
  for (const calculator of createCalculators()) {
    const result = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['壬', '申'],
        ['甲', '子'],
        ['壬', '申'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['壬', '申'],
        ['乙', '丑'],
        ['壬', '申'],
      ],
      'male',
    );

    assert.ok(result.hour.includes('截路空亡'));
    assert.ok(!result.month.includes('截路空亡'));
    assert.ok(!missResult.hour.includes('截路空亡'));
  }
});

test('三丘五墓应按月令四季取本支与对宫', () => {
  for (const calculator of createCalculators()) {
    const springResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['丁', '丑'],
        ['己', '未'],
      ],
      'male',
    );
    const summerResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['己', '巳'],
        ['庚', '辰'],
        ['辛', '戌'],
      ],
      'male',
    );
    const autumnResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['壬', '申'],
        ['癸', '未'],
        ['乙', '丑'],
      ],
      'male',
    );
    const winterResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['乙', '亥'],
        ['丙', '戌'],
        ['丁', '辰'],
      ],
      'male',
    );

    assert.ok(springResult.day.includes('三丘'));
    assert.ok(springResult.hour.includes('五墓'));
    assert.ok(summerResult.day.includes('三丘'));
    assert.ok(autumnResult.day.includes('三丘'));
    assert.ok(winterResult.hour.includes('五墓'));
  }
});

test('天刑应按年支配时干判断并只在时柱标记', () => {
  for (const calculator of createCalculators()) {
    const ziYearResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['庚', '午'],
        ['乙', '酉'],
      ],
      'male',
    );
    const shenYearResult = calculator.calculateAllShenSha(
      [
        ['甲', '申'],
        ['丙', '寅'],
        ['庚', '午'],
        ['丙', '子'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['庚', '午'],
        ['丙', '酉'],
      ],
      'male',
    );

    assert.ok(ziYearResult.hour.includes('天刑'));
    assert.ok(!ziYearResult.day.includes('天刑'));
    assert.ok(shenYearResult.hour.includes('天刑'));
    assert.ok(!missResult.hour.includes('天刑'));
  }
});

test('五行精纪天伤应按时支后二辰取用', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['乙', '戌'],
        ['庚', '午'],
        ['丙', '子'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['乙', '戌'],
        ['庚', '午'],
        ['丙', '亥'],
      ],
      'male',
    );

    assert.ok(hitResult.month.includes('天伤'));
    assert.ok(!hitResult.hour.includes('天伤'));
    assert.ok(!Object.values(missResult).flat().includes('天伤'));
  }
});

test('鬼门应按年支十二支互见判断', () => {
  for (const calculator of createCalculators()) {
    const ziYearResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['庚', '午'],
        ['丁', '酉'],
      ],
      'male',
    );
    const xuYearResult = calculator.calculateAllShenSha(
      [
        ['甲', '戌'],
        ['丙', '寅'],
        ['庚', '午'],
        ['丁', '巳'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['庚', '午'],
        ['丁', '申'],
      ],
      'male',
    );

    assert.ok(ziYearResult.hour.includes('鬼门'));
    assert.ok(xuYearResult.hour.includes('鬼门'));
    assert.ok(!missResult.hour.includes('鬼门'));
  }
});

test('冲天杀应按年支冲月支与日支冲时支判断', () => {
  for (const calculator of createCalculators()) {
    const result = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丁', '午'],
        ['庚', '寅'],
        ['辛', '申'],
      ],
      'male',
    );

    assert.ok(result.month.includes('冲天杀'));
    assert.ok(result.hour.includes('冲天杀'));
  }
});

test('攀鞍应取驿马后一辰，不应算到将星或驿马本位', () => {
  for (const calculator of createCalculators()) {
    const result = calculator.calculateAllShenSha(
      [
        ['丁', '丑'],
        ['甲', '申'],
        ['戊', '辰'],
        ['壬', '戌'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['丁', '丑'],
        ['甲', '申'],
        ['戊', '辰'],
        ['癸', '酉'],
      ],
      'male',
    );

    assert.ok(result.hour.includes('攀鞍'));
    assert.ok(!missResult.hour.includes('攀鞍'));
  }
});

test('五行精纪马天庭马九天马九地应按驿马前后定支取用', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['丁', '丑'],
        ['甲', '子'],
        ['戊', '戌'],
        ['癸', '酉'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['丁', '丑'],
        ['甲', '亥'],
        ['戊', '巳'],
        ['癸', '申'],
      ],
      'male',
    );

    assert.ok(hitResult.month.includes('马天庭'));
    assert.ok(hitResult.day.includes('马九天'));
    assert.ok(hitResult.hour.includes('马九地'));
    assert.ok(
      !Object.values(missResult)
        .flat()
        .some((name) => ['马天庭', '马九天', '马九地'].includes(name)),
    );
  }
});

test('五行精纪勾陈真武应按年干日干定支取用', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '丑'],
        ['丙', '巳'],
        ['壬', '申'],
        ['癸', '寅'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '丑'],
        ['丙', '辰'],
        ['壬', '申'],
        ['癸', '卯'],
      ],
      'male',
    );

    assert.ok(hitResult.month.includes('勾陈'));
    assert.ok(hitResult.hour.includes('真武'));
    assert.ok(!Object.values(missResult).flat().includes('勾陈'));
    assert.ok(!Object.values(missResult).flat().includes('真武'));
  }
});

test('五行精纪命天庭禄九天禄九地应按命前与禄后定支取用', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['丙', '子'],
        ['乙', '丑'],
        ['庚', '辰'],
        ['壬', '午'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['戊', '子'],
        ['甲', '寅'],
        ['己', '戌'],
        ['癸', '卯'],
      ],
      'male',
    );

    assert.ok(hitResult.month.includes('命天庭'));
    assert.ok(hitResult.day.includes('禄九天'));
    assert.ok(hitResult.hour.includes('禄九地'));
    assert.ok(
      !Object.values(missResult)
        .flat()
        .some((name) => ['命天庭', '禄九天', '禄九地'].includes(name)),
    );
  }
});

test('五行精纪禄对神应按年干或日干禄位对冲取用', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '申'],
        ['乙', '丑'],
        ['丁', '子'],
        ['戊', '寅'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '酉'],
        ['乙', '丑'],
        ['丁', '亥'],
        ['戊', '寅'],
      ],
      'male',
    );

    assert.ok(hitResult.year.includes('禄对神'));
    assert.ok(hitResult.day.includes('禄对神'));
    assert.ok(!Object.values(missResult).flat().includes('禄对神'));
  }
});

test('五行精纪禄头财与禄头鬼应按年干或日干禄位干支取用', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['戊', '寅'],
        ['丁', '卯'],
        ['壬', '午'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['戊', '卯'],
        ['丁', '卯'],
        ['癸', '未'],
      ],
      'male',
    );

    assert.ok(hitResult.month.includes('禄头财'));
    assert.ok(hitResult.hour.includes('禄头鬼'));
    assert.ok(
      !Object.values(missResult)
        .flat()
        .some((name) => ['禄头财', '禄头鬼'].includes(name)),
    );
  }
});

test('五行精纪刃头财与刃头鬼应按年干或日干刃位干支取用', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['己', '卯'],
        ['丁', '卯'],
        ['癸', '未'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['戊', '寅'],
        ['丁', '卯'],
        ['壬', '午'],
      ],
      'male',
    );

    assert.ok(hitResult.month.includes('刃头财'));
    assert.ok(hitResult.hour.includes('刃头鬼'));
    assert.ok(
      !Object.values(missResult)
        .flat()
        .some((name) => ['刃头财', '刃头鬼'].includes(name)),
    );
  }
});

test('三命通会库头财与库头鬼应按年干或日干库位干支取用', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['己', '未'],
        ['丁', '卯'],
        ['辛', '未'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['己', '卯'],
        ['丁', '卯'],
        ['辛', '卯'],
      ],
      'male',
    );

    assert.ok(hitResult.month.includes('库头财'));
    assert.ok(hitResult.hour.includes('库头鬼'));
    assert.ok(
      !Object.values(missResult)
        .flat()
        .some((name) => ['库头财', '库头鬼'].includes(name)),
    );
  }
});

test('天厨贵人对丙日应取巳，不应错判为子', () => {
  const calculator = new ShenShaCalculator();
  const hitResult = calculator.calculateAllShenSha(
    [
      ['戊', '子'],
      ['丁', '酉'],
      ['丙', '午'],
      ['己', '巳'],
    ],
    'male',
  );
  const missResult = calculator.calculateAllShenSha(
    [
      ['戊', '子'],
      ['丁', '酉'],
      ['丙', '午'],
      ['己', '子'],
    ],
    'male',
  );

  assert.ok(hitResult.hour.includes('天厨贵人'));
  assert.ok(!missResult.hour.includes('天厨贵人'));
});

test('天厨贵人对己日应取酉，不应错判为未', () => {
  const calculator = new ShenShaCalculator();
  const hitResult = calculator.calculateAllShenSha(
    [
      ['甲', '子'],
      ['丁', '酉'],
      ['己', '午'],
      ['辛', '酉'],
    ],
    'male',
  );
  const missResult = calculator.calculateAllShenSha(
    [
      ['甲', '子'],
      ['丁', '酉'],
      ['己', '午'],
      ['辛', '未'],
    ],
    'male',
  );

  assert.ok(hitResult.hour.includes('天厨贵人'));
  assert.ok(!missResult.hour.includes('天厨贵人'));
});

test('福星贵人应按完整干支组合判断，不应只看地支', () => {
  const calculator = new ShenShaCalculator();
  const hitResult = calculator.calculateAllShenSha(
    [
      ['甲', '子'],
      ['丁', '酉'],
      ['庚', '午'],
      ['丙', '寅'],
    ],
    'male',
  );
  const missResult = calculator.calculateAllShenSha(
    [
      ['甲', '子'],
      ['丁', '酉'],
      ['庚', '午'],
      ['戊', '寅'],
    ],
    'male',
  );

  assert.ok(hitResult.hour.includes('福星贵人'));
  assert.ok(!missResult.hour.includes('福星贵人'));
});

test('福星贵人对辛日应识别癸未与癸巳，而不是单看巳支', () => {
  const calculator = new ShenShaCalculator();
  const hitResult = calculator.calculateAllShenSha(
    [
      ['甲', '子'],
      ['丁', '酉'],
      ['辛', '丑'],
      ['癸', '巳'],
    ],
    'male',
  );
  const missResult = calculator.calculateAllShenSha(
    [
      ['甲', '子'],
      ['丁', '酉'],
      ['辛', '丑'],
      ['乙', '巳'],
    ],
    'male',
  );

  assert.ok(hitResult.hour.includes('福星贵人'));
  assert.ok(!missResult.hour.includes('福星贵人'));
});

test('天乙贵人对庚干应取丑未，不应误取寅午', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['丁', '子'],
        ['丙', '寅'],
        ['庚', '申'],
        ['戊', '丑'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['丁', '子'],
        ['丙', '寅'],
        ['庚', '申'],
        ['戊', '午'],
      ],
      'male',
    );

    assert.ok(hitResult.hour.includes('天乙贵人'));
    assert.ok(!missResult.hour.includes('天乙贵人'));
  }
});

test('文昌贵人应按五行精纪与三命通会口诀取用', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['乙', '丑'],
        ['辛', '亥'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['乙', '丑'],
        ['辛', '午'],
      ],
      'male',
    );

    assert.ok(hitResult.hour.includes('文昌贵人'));
    assert.ok(!missResult.hour.includes('文昌贵人'));
  }
});

test('学堂应按年干或日干十干长生支判断，不应按五行长生简化错判阴干', () => {
  const cases = [
    { stem: '乙', hitBranch: '午', oldElementBranch: '亥' },
    { stem: '丁', hitBranch: '酉', oldElementBranch: '寅' },
    { stem: '己', hitBranch: '酉', oldElementBranch: '寅' },
    { stem: '辛', hitBranch: '子', oldElementBranch: '巳' },
    { stem: '癸', hitBranch: '卯', oldElementBranch: '申' },
  ];

  for (const calculator of createCalculators()) {
    for (const item of cases) {
      const hitResult = calculator.calculateAllShenSha(
        [
          [item.stem, '丑'],
          ['甲', '辰'],
          [item.stem, '丑'],
          ['戊', item.hitBranch],
        ],
        'male',
      );
      const missResult = calculator.calculateAllShenSha(
        [
          [item.stem, '丑'],
          ['甲', '辰'],
          [item.stem, '丑'],
          ['戊', item.oldElementBranch],
        ],
        'male',
      );

      assert.ok(hitResult.hour.includes('学堂'), `${item.stem}干应以${item.hitBranch}为学堂`);
      assert.ok(
        !missResult.hour.includes('学堂'),
        `${item.stem}干不应以${item.oldElementBranch}为学堂`,
      );
    }
  }
});

test('词馆应按年干或日干十干临官支判断，不应只看日干', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['乙', '丑'],
        ['丁', '未'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '辰'],
        ['乙', '丑'],
        ['丁', '未'],
      ],
      'male',
    );

    assert.ok(hitResult.month.includes('词馆'), '甲年干应以寅为词馆');
    assert.ok(!missResult.month.includes('词馆'), '甲年干不应以辰为词馆');
  }
});

test('官贵学馆应按官星长生临官位取地支', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['乙', '卯'],
        ['丙', '巳'],
        ['甲', '子'],
        ['戊', '申'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['乙', '卯'],
        ['丙', '午'],
        ['甲', '子'],
        ['戊', '未'],
      ],
      'male',
    );

    assert.ok(hitResult.month.includes('官贵学馆'));
    assert.ok(hitResult.hour.includes('官贵学馆'));
    assert.ok(!Object.values(missResult).flat().includes('官贵学馆'));
  }
});

test('文星贵应按三命通会十干口诀取地支', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '午'],
        ['壬', '辰'],
        ['丁', '寅'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '未'],
        ['壬', '辰'],
        ['丁', '丑'],
      ],
      'male',
    );

    assert.ok(hitResult.month.includes('文星贵'));
    assert.ok(hitResult.hour.includes('文星贵'));
    assert.ok(!Object.values(missResult).flat().includes('文星贵'));
  }
});

test('三命通会天印贵人应按稳定十干口诀取地支', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['乙', '丑'],
        ['丁', '亥'],
        ['壬', '子'],
        ['戊', '辰'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['乙', '丑'],
        ['丁', '戌'],
        ['壬', '子'],
        ['戊', '卯'],
      ],
      'male',
    );

    assert.ok(hitResult.month.includes('天印贵人'));
    assert.ok(hitResult.hour.includes('天印贵人'));
    assert.ok(!Object.values(missResult).flat().includes('天印贵人'));
  }
});

test('五行精纪官贵堂应按稳定九干取地支', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丁', '未'],
        ['癸', '辰'],
        ['壬', '午'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['戊', '子'],
        ['丁', '午'],
        ['壬', '辰'],
        ['癸', '巳'],
      ],
      'male',
    );

    assert.ok(hitResult.month.includes('官贵堂'));
    assert.ok(hitResult.hour.includes('官贵堂'));
    assert.ok(!Object.values(missResult).flat().includes('官贵堂'));
  }
});

test('五行精纪天奇天宝应按生时前后五辰取用', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '寅'],
        ['乙', '巳'],
        ['丙', '未'],
        ['戊', '子'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '寅'],
        ['乙', '巳'],
        ['丙', '未'],
        ['己', '丑'],
      ],
      'male',
    );

    assert.ok(hitResult.month.includes('天奇'));
    assert.ok(hitResult.day.includes('天宝'));
    assert.ok(!Object.values(missResult).flat().includes('天奇'));
    assert.ok(!Object.values(missResult).flat().includes('天宝'));
  }
});

test('科名贵应只取甲辰至癸丑一旬的日时干支', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '辰'],
        ['乙', '巳'],
        ['丙', '午'],
        ['丁', '未'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '辰'],
        ['乙', '巳'],
        ['丙', '申'],
        ['丁', '酉'],
      ],
      'male',
    );

    assert.ok(!hitResult.year.includes('科名贵'));
    assert.ok(!hitResult.month.includes('科名贵'));
    assert.ok(hitResult.day.includes('科名贵'));
    assert.ok(hitResult.hour.includes('科名贵'));
    assert.ok(!Object.values(missResult).flat().includes('科名贵'));
  }
});

test('五行精纪真魁星应只取日时四干支', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '辰'],
        ['丁', '未'],
        ['庚', '戌'],
        ['癸', '丑'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '辰'],
        ['丁', '未'],
        ['辛', '亥'],
        ['壬', '子'],
      ],
      'male',
    );

    assert.ok(!hitResult.year.includes('真魁星'));
    assert.ok(!hitResult.month.includes('真魁星'));
    assert.ok(hitResult.day.includes('真魁星'));
    assert.ok(hitResult.hour.includes('真魁星'));
    assert.ok(!Object.values(missResult).flat().includes('真魁星'));
  }
});

test('岁窠应只在年支与月支相同时标记月柱', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '子'],
        ['戊', '辰'],
        ['庚', '子'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丁', '丑'],
        ['戊', '辰'],
        ['庚', '子'],
      ],
      'male',
    );

    assert.ok(!hitResult.year.includes('岁窠'));
    assert.ok(hitResult.month.includes('岁窠'));
    assert.ok(!hitResult.hour.includes('岁窠'));
    assert.ok(!Object.values(missResult).flat().includes('岁窠'));
  }
});

test('五行精纪名福应按年干所定生月取用', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['癸', '酉'],
        ['丙', '寅'],
        ['丁', '卯'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['壬', '申'],
        ['丙', '寅'],
        ['丁', '卯'],
      ],
      'male',
    );

    assert.ok(hitResult.month.includes('名福'));
    assert.ok(!hitResult.year.includes('名福'));
    assert.ok(!Object.values(missResult).flat().includes('名福'));
  }
});

test('五行精纪命学堂应按年支后一辰取用', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['乙', '亥'],
        ['丙', '寅'],
        ['丁', '卯'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['乙', '戌'],
        ['丙', '寅'],
        ['丁', '卯'],
      ],
      'male',
    );

    assert.ok(hitResult.month.includes('命学堂'));
    assert.ok(!hitResult.year.includes('命学堂'));
    assert.ok(!Object.values(missResult).flat().includes('命学堂'));
  }
});

test('五行精纪禄学堂应按年支后二辰取用', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['乙', '戌'],
        ['丙', '寅'],
        ['丁', '卯'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['乙', '亥'],
        ['丙', '寅'],
        ['丁', '卯'],
      ],
      'male',
    );

    assert.ok(hitResult.month.includes('禄学堂'));
    assert.ok(!hitResult.year.includes('禄学堂'));
    assert.ok(!Object.values(missResult).flat().includes('禄学堂'));
  }
});

test('红艳煞应按三命通会定例取乙午戊子壬巳', () => {
  const cases = [
    { stem: '乙', hitBranch: '午', oldWrongBranch: '申' },
    { stem: '戊', hitBranch: '子', oldWrongBranch: '辰' },
    { stem: '壬', hitBranch: '巳', oldWrongBranch: '子' },
  ];

  for (const calculator of createCalculators()) {
    for (const item of cases) {
      const hitResult = calculator.calculateAllShenSha(
        [
          ['甲', '戌'],
          ['丙', '寅'],
          [item.stem, '丑'],
          ['丁', item.hitBranch],
        ],
        'female',
      );
      const missResult = calculator.calculateAllShenSha(
        [
          ['甲', '戌'],
          ['丙', '寅'],
          [item.stem, '丑'],
          ['丁', item.oldWrongBranch],
        ],
        'female',
      );

      assert.ok(
        hitResult.hour.includes('红艳煞'),
        `${item.stem}日应以${item.hitBranch}为红艳煞`,
      );
      assert.ok(
        !missResult.hour.includes('红艳煞'),
        `${item.stem}日不应以${item.oldWrongBranch}为红艳煞`,
      );
    }
  }
});

test('阴阳煞应按三命通会男取丙子女取戊午', () => {
  for (const calculator of createCalculators()) {
    const maleResult = calculator.calculateAllShenSha(
      [
        ['甲', '寅'],
        ['乙', '卯'],
        ['丙', '子'],
        ['丁', '巳'],
      ],
      'male',
    );
    const femaleResult = calculator.calculateAllShenSha(
      [
        ['甲', '寅'],
        ['乙', '卯'],
        ['戊', '午'],
        ['丁', '巳'],
      ],
      'female',
    );
    const reversedResult = calculator.calculateAllShenSha(
      [
        ['甲', '寅'],
        ['乙', '卯'],
        ['戊', '午'],
        ['丁', '巳'],
      ],
      'male',
    );

    assert.ok(maleResult.day.includes('阴阳煞'));
    assert.ok(femaleResult.day.includes('阴阳煞'));
    assert.ok(!reversedResult.day.includes('阴阳煞'));
  }
});

test('十灵日应包含庚寅日', () => {
  for (const calculator of createCalculators()) {
    const result = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['庚', '寅'],
        ['戊', '辰'],
      ],
      'male',
    );

    assert.ok(result.day.includes('十灵日'));
  }
});

test('空亡默认只按日柱旬空判断，不应再把年柱旬空并入', () => {
  for (const calculator of createCalculators()) {
    const result = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '戌'],
        ['庚', '辰'],
        ['丁', '丑'],
      ],
      'male',
    );

    assert.ok(!result.month.includes('空亡'));
  }
});

test('孤虚默认应取日柱旬空对宫', () => {
  for (const calculator of createCalculators()) {
    const result = calculator.calculateAllShenSha(
      [
        ['辛', '酉'],
        ['丙', '辰'],
        ['甲', '子'],
        ['丁', '巳'],
      ],
      'male',
    );

    assert.ok(result.month.includes('孤虚'));
    assert.ok(result.hour.includes('孤虚'));
  }
});

test('羊刃默认只取阳干帝旺位，不把阴干帝旺位直接算作羊刃', () => {
  for (const calculator of createCalculators()) {
    const result = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['乙', '巳'],
        ['丁', '丑'],
      ],
      'male',
    );

    assert.ok(!result.month.includes('羊刃'));
  }
});

test('飞刃默认跟随阳干羊刃口径，不由阴干帝旺位推出', () => {
  for (const calculator of createCalculators()) {
    const result = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '申'],
        ['乙', '巳'],
        ['丁', '丑'],
      ],
      'male',
    );

    assert.ok(!result.month.includes('飞刃'));
  }
});

test('金舆应兼取命前二辰与马前二辰', () => {
  const calculator = new ShenShaCalculator();
  const mingJinYu = calculator.calculateAllShenSha(
    [
      ['丁', '子'],
      ['丙', '辰'],
      ['庚', '午'],
      ['戊', '寅'],
    ],
    'male',
  );
  const maJinYu = calculator.calculateAllShenSha(
    [
      ['丁', '亥'],
      ['丙', '辰'],
      ['庚', '子'],
      ['戊', '未'],
    ],
    'male',
  );

  assert.ok(mingJinYu.hour.includes('金舆'));
  assert.ok(maJinYu.hour.includes('金舆'));
});

test('八专应取丁未日，不应误取丁巳日', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['丁', '未'],
        ['戊', '辰'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['丁', '巳'],
        ['戊', '辰'],
      ],
      'male',
    );

    assert.ok(hitResult.day.includes('八专'));
    assert.ok(!missResult.day.includes('八专'));
  }
});

test('九丑应取辛酉日，不应误取丁卯日', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['辛', '酉'],
        ['戊', '辰'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['丁', '卯'],
        ['戊', '辰'],
      ],
      'male',
    );

    assert.ok(hitResult.day.includes('九丑'));
    assert.ok(!missResult.day.includes('九丑'));
  }
});

test('九丑应按三命通会定例取乙卯不取丁酉', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['乙', '卯'],
        ['戊', '辰'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['丁', '酉'],
        ['戊', '辰'],
      ],
      'male',
    );

    assert.ok(hitResult.day.includes('九丑'));
    assert.ok(!missResult.day.includes('九丑'));
  }
});

test('四废日应包含五行精纪大四废季支', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丁', '卯'],
        ['甲', '申'],
        ['戊', '辰'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丁', '卯'],
        ['甲', '午'],
        ['戊', '辰'],
      ],
      'male',
    );

    assert.ok(hitResult.day.includes('四废日'));
    assert.ok(!missResult.day.includes('四废日'));
  }
});

test('天屠煞按三命通会取日时配对，子日午时与午日子时不取', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['丁', '丑'],
        ['辛', '亥'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['丁', '子'],
        ['庚', '午'],
      ],
      'male',
    );

    assert.ok(hitResult.hour.includes('天屠煞'));
    assert.ok(!missResult.hour.includes('天屠煞'));
  }
});

test('雷霆煞应按三命通会正七二八等月支口诀取地支', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['丁', '丑'],
        ['辛', '卯'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '丑'],
        ['丙', '寅'],
        ['丁', '丑'],
        ['辛', '卯'],
      ],
      'male',
    );

    assert.ok(hitResult.year.includes('雷霆煞'));
    assert.ok(!missResult.year.includes('雷霆煞'));
  }
});

test('破煞应按三命通会只取子酉丑辰卯午未戌四组', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丁', '卯'],
        ['己', '酉'],
        ['庚', '午'],
      ],
      'male',
    );
    const excludedResult = calculator.calculateAllShenSha(
      [
        ['甲', '寅'],
        ['丁', '亥'],
        ['己', '丑'],
        ['庚', '申'],
      ],
      'male',
    );

    assert.ok(hitResult.year.includes('破煞'));
    assert.ok(hitResult.month.includes('破煞'));
    assert.ok(!excludedResult.year.includes('破煞'));
    assert.ok(!excludedResult.month.includes('破煞'));
  }
});

test('自缢煞应按三命通会五行反系处取年支互见', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['戊', '辰'],
        ['辛', '酉'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['戊', '辰'],
        ['辛', '申'],
      ],
      'male',
    );

    assert.ok(hitResult.hour.includes('自缢煞'));
    assert.ok(!missResult.hour.includes('自缢煞'));
  }
});

test('真亡杀应按五行精纪年支三合组取固定干支', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '寅'],
        ['丙', '辰'],
        ['戊', '子'],
        ['癸', '亥'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '寅'],
        ['丙', '辰'],
        ['戊', '子'],
        ['癸', '酉'],
      ],
      'male',
    );

    assert.ok(hitResult.hour.includes('真亡杀'));
    assert.ok(!missResult.hour.includes('真亡杀'));
  }
});

test('月煞应按三命通会月令三合组取地支', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['戊', '丑'],
        ['庚', '辰'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['戊', '子'],
        ['庚', '辰'],
      ],
      'male',
    );

    assert.ok(hitResult.day.includes('月煞'));
    assert.ok(!missResult.day.includes('月煞'));
  }
});

test('月厌应按月令逆行取地支', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['乙', '寅'],
        ['丙', '戌'],
        ['丁', '亥'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['乙', '寅'],
        ['丙', '酉'],
        ['丁', '亥'],
      ],
      'male',
    );

    assert.ok(hitResult.day.includes('月厌'));
    assert.ok(!Object.values(missResult).flat().includes('月厌'));
  }
});

test('头戴杀应按五行精纪只取生日生时', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '寅'],
        ['丙', '辰'],
        ['戊', '辰'],
        ['庚', '辰'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '寅'],
        ['丙', '辰'],
        ['戊', '丑'],
        ['庚', '未'],
      ],
      'male',
    );

    assert.ok(!hitResult.month.includes('头戴杀'));
    assert.ok(hitResult.day.includes('头戴杀'));
    assert.ok(hitResult.hour.includes('头戴杀'));
    assert.ok(!missResult.day.includes('头戴杀'));
    assert.ok(!missResult.hour.includes('头戴杀'));
  }
});

test('天火煞应按三命通会取寅午戌全且天干不见水', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '寅'],
        ['丙', '午'],
        ['戊', '戌'],
        ['庚', '辰'],
      ],
      'male',
    );
    const waterResult = calculator.calculateAllShenSha(
      [
        ['甲', '寅'],
        ['丙', '午'],
        ['壬', '戌'],
        ['庚', '辰'],
      ],
      'male',
    );

    assert.ok(hitResult.global?.includes('天火煞'));
    assert.ok(!waterResult.global?.includes('天火煞'));
  }
});

test('挂剑煞应按三命通会取巳酉丑申四柱纯全', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['乙', '巳'],
        ['丁', '酉'],
        ['己', '丑'],
        ['壬', '申'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['乙', '巳'],
        ['丁', '酉'],
        ['己', '丑'],
        ['壬', '辰'],
      ],
      'male',
    );

    assert.ok(hitResult.global?.includes('挂剑煞'));
    assert.ok(!missResult.global?.includes('挂剑煞'));
  }
});

test('五行精纪杂犯字表应按古籍字表作为全局旁证', () => {
  for (const calculator of createCalculators()) {
    const pingTouResult = calculator.calculateAllShenSha(
      [
        ['甲', '辰'],
        ['丙', '寅'],
        ['丁', '丑'],
        ['庚', '申'],
      ],
      'male',
    );
    const xuanZhenResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['辛', '卯'],
        ['乙', '午'],
        ['庚', '申'],
      ],
      'male',
    );
    const poZiResult = calculator.calculateAllShenSha(
      [
        ['甲', '申'],
        ['癸', '酉'],
        ['乙', '丑'],
        ['庚', '辰'],
      ],
      'male',
    );
    const zhangXingResult = calculator.calculateAllShenSha(
      [
        ['戊', '戌'],
        ['庚', '寅'],
        ['乙', '丑'],
        ['辛', '未'],
      ],
      'male',
    );
    const queZiResult = calculator.calculateAllShenSha(
      [
        ['乙', '巳'],
        ['己', '丑'],
        ['庚', '辰'],
        ['辛', '未'],
      ],
      'male',
    );
    const longYaResult = calculator.calculateAllShenSha(
      [
        ['丙', '寅'],
        ['壬', '酉'],
        ['乙', '丑'],
        ['庚', '辰'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['乙', '丑'],
        ['庚', '申'],
      ],
      'male',
    );

    assert.ok(pingTouResult.global?.includes('平头杀'));
    assert.ok(!pingTouResult.global?.includes('悬针杀'));
    assert.ok(xuanZhenResult.global?.includes('悬针杀'));
    assert.ok(!xuanZhenResult.global?.includes('平头杀'));
    assert.ok(poZiResult.global?.includes('破字'));
    assert.ok(zhangXingResult.global?.includes('杖刑'));
    assert.ok(queZiResult.global?.includes('阙字'));
    assert.ok(queZiResult.global?.includes('曲脚杀'));
    assert.ok(longYaResult.global?.includes('聋哑字'));
    assert.ok(!missResult.global?.includes('平头杀'));
    assert.ok(!missResult.global?.includes('悬针杀'));
    assert.ok(!missResult.global?.includes('破字'));
  }
});

test('戟锋煞应按五行精纪逐月旺干取日时两重', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['乙', '巳'],
        ['丙', '辰'],
        ['戊', '子'],
        ['甲', '申'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['乙', '巳'],
        ['丙', '辰'],
        ['戊', '子'],
        ['丁', '申'],
      ],
      'male',
    );

    assert.ok(hitResult.day.includes('戟锋煞'));
    assert.ok(hitResult.hour.includes('戟锋煞'));
    assert.ok(!missResult.day.includes('戟锋煞'));
    assert.ok(!missResult.hour.includes('戟锋煞'));
  }
});

test('天罡杀阴杀阳杀应按五行精纪以年支取目标地支', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['戊', '辰'],
        ['甲', '戌'],
        ['丙', '寅'],
        ['庚', '午'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['戊', '辰'],
        ['甲', '子'],
        ['丙', '卯'],
        ['庚', '午'],
      ],
      'male',
    );

    assert.ok(hitResult.month.includes('天罡杀'));
    assert.ok(hitResult.month.includes('阴杀'));
    assert.ok(hitResult.day.includes('阳杀'));
    const missNames = Object.values(missResult).flat();
    assert.ok(!missNames.some((name) => ['天罡杀', '阴杀', '阳杀'].includes(name)));
  }
});

test('墓杀和害气杀应按五行精纪以年支三合组取目标地支', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['壬', '申'],
        ['甲', '辰'],
        ['乙', '亥'],
        ['丙', '午'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['壬', '申'],
        ['甲', '子'],
        ['乙', '寅'],
        ['丙', '午'],
      ],
      'male',
    );

    assert.ok(hitResult.month.includes('墓杀'));
    assert.ok(hitResult.day.includes('害气杀'));
    const missNames = Object.values(missResult).flat();
    assert.ok(!missNames.some((name) => ['墓杀', '害气杀'].includes(name)));
  }
});

test('无成杀应按五行精纪以年支三合组取目标地支', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['壬', '寅'],
        ['甲', '巳'],
        ['乙', '未'],
        ['丙', '申'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['壬', '寅'],
        ['甲', '午'],
        ['乙', '未'],
        ['丙', '申'],
      ],
      'male',
    );

    assert.ok(hitResult.month.includes('无成杀'));
    const missNames = Object.values(missResult).flat();
    assert.ok(!missNames.includes('无成杀'));
  }
});

test('宅墓煞应按三命通会命前后五辰只取日时', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['乙', '丑'],
        ['丙', '巳'],
        ['丁', '未'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['乙', '巳'],
        ['丙', '午'],
        ['丁', '申'],
      ],
      'male',
    );

    assert.ok(!hitResult.month.includes('宅墓煞'));
    assert.ok(hitResult.day.includes('宅墓煞'));
    assert.ok(hitResult.hour.includes('宅墓煞'));
    assert.ok(!Object.values(missResult).flat().includes('宅墓煞'));
  }
});

test('五行精纪年支凶杀应按原文固定地支取用', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['壬', '戌'],
        ['甲', '亥'],
        ['乙', '卯'],
        ['丙', '申'],
      ],
      'male',
    );
    const pushResult = calculator.calculateAllShenSha(
      [
        ['壬', '戌'],
        ['甲', '酉'],
        ['乙', '午'],
        ['丙', '未'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['壬', '戌'],
        ['甲', '寅'],
        ['乙', '午'],
        ['丙', '未'],
      ],
      'male',
    );
    const fixedBranchResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['戊', '辰'],
        ['己', '未'],
        ['庚', '申'],
      ],
      'male',
    );
    const fixedBranchMissResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['戊', '巳'],
        ['己', '午'],
        ['庚', '申'],
      ],
      'male',
    );
    const xueGuangDayHourResult = calculator.calculateAllShenSha(
      [
        ['甲', '丑'],
        ['丙', '寅'],
        ['戊', '子'],
        ['壬', '戌'],
      ],
      'male',
    );
    const zhenGuiResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['丁', '卯'],
        ['壬', '辰'],
      ],
      'male',
    );

    assert.ok(hitResult.month.includes('截命杀'));
    assert.ok(hitResult.day.includes('破外杀'));
    assert.ok(hitResult.hour.includes('血光杀'));
    assert.ok(xueGuangDayHourResult.hour.includes('血光杀'));
    assert.ok(zhenGuiResult.day.includes('真鬼刑疾'));
    assert.ok(zhenGuiResult.hour.includes('真鬼刑疾'));
    assert.ok(pushResult.month.includes('推命杀'));
    assert.ok(fixedBranchResult.month.includes('死气杀'));
    assert.ok(fixedBranchResult.day.includes('暴败杀'));
    assert.ok(
      !Object.values(fixedBranchMissResult)
        .flat()
        .some((name) => ['死气杀', '暴败杀'].includes(name)),
    );
    const missNames = Object.values(missResult).flat();
    assert.ok(!missNames.some((name) => ['破外杀', '血光杀', '截命杀', '推命杀'].includes(name)));
  }
});

test('五行精纪官会杀财会杀应按年命固定干支取用', () => {
  for (const calculator of createCalculators()) {
    const guanHuiResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['辛', '丑'],
        ['丙', '寅'],
        ['丁', '卯'],
      ],
      'male',
    );
    const caiHuiResult = calculator.calculateAllShenSha(
      [
        ['丙', '寅'],
        ['辛', '丑'],
        ['甲', '子'],
        ['丁', '卯'],
      ],
      'male',
    );
    const guanHuiMissResult = calculator.calculateAllShenSha(
      [
        ['丙', '子'],
        ['辛', '丑'],
        ['甲', '寅'],
        ['丁', '卯'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '亥'],
        ['辛', '丑'],
        ['丙', '寅'],
        ['丁', '卯'],
      ],
      'male',
    );

    assert.ok(guanHuiResult.month.includes('官会杀'));
    assert.ok(caiHuiResult.month.includes('财会杀'));
    assert.ok(!guanHuiMissResult.month.includes('官会杀'));
    assert.ok(!missResult.month.includes('财会杀'));
  }
});

test('建命杀应按月柱干支与年柱干支相同取出', () => {
  for (const calculator of createCalculators()) {
    const result = calculator.calculateAllShenSha(
      [
        ['甲', '戌'],
        ['甲', '戌'],
        ['丙', '寅'],
        ['丁', '卯'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '戌'],
        ['甲', '申'],
        ['丙', '寅'],
        ['丁', '卯'],
      ],
      'male',
    );

    assert.ok(result.month.includes('建命杀'));
    assert.ok(!missResult.month.includes('建命杀'));
  }
});

test('五行精纪青龙杀良会杀应按年支三合组固定干支取用', () => {
  const cases = [
    { yearBranch: '寅', qingLong: ['丙', '寅'], liangHui: ['丁', '卯'] },
    { yearBranch: '巳', qingLong: ['辛', '巳'], liangHui: ['庚', '辰'] },
    { yearBranch: '申', qingLong: ['壬', '申'], liangHui: ['癸', '酉'] },
    { yearBranch: '亥', qingLong: ['乙', '亥'], liangHui: ['甲', '子'] },
  ] as const;

  for (const calculator of createCalculators()) {
    const hits = cases.map(({ yearBranch, qingLong, liangHui }) => {
      const result = calculator.calculateAllShenSha(
        [
          ['甲', yearBranch],
          qingLong,
          liangHui,
          ['戊', '午'],
        ],
        'male',
      );

      return {
        qingLong: result.month.includes('青龙杀'),
        liangHui: result.day.includes('良会杀'),
      };
    });

    assert.deepEqual(
      hits,
      cases.map(() => ({ qingLong: true, liangHui: true })),
    );

    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '寅'],
        ['丙', '卯'],
        ['丁', '寅'],
        ['戊', '午'],
      ],
      'male',
    );
    assert.ok(
      !Object.values(missResult)
        .flat()
        .some((name) => ['青龙杀', '良会杀'].includes(name)),
    );
  }
});

test('五行精纪天官贵人应按阴官贵十干支表取用', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['乙', '酉'],
        ['丙', '戌'],
        ['丁', '子'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '丑'],
        ['乙', '申'],
        ['丙', '戌'],
        ['丁', '戌'],
      ],
      'male',
    );

    assert.ok(hitResult.month.includes('天官贵人'));
    assert.ok(hitResult.hour.includes('天官贵人'));
    assert.ok(!Object.values(missResult).flat().includes('天官贵人'));
  }
});

test('三命通会妄语煞应取日时官符落日柱旬空', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['甲', '午'],
        ['戊', '辰'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['甲', '子'],
        ['戊', '辰'],
      ],
      'male',
    );

    assert.ok(hitResult.hour.includes('官符'));
    assert.ok(hitResult.hour.includes('空亡'));
    assert.ok(hitResult.hour.includes('妄语煞'));
    assert.ok(!missResult.hour.includes('妄语煞'));
  }
});

test('五行精纪扶生日旌德旌钺应按月支年支定例取用', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '寅'],
        ['乙', '午'],
        ['丙', '亥'],
        ['丙', '寅'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '寅'],
        ['乙', '午'],
        ['丁', '子'],
        ['戊', '卯'],
      ],
      'male',
    );

    assert.ok(hitResult.day.includes('扶生日'));
    assert.ok(hitResult.day.includes('旌德'));
    assert.ok(hitResult.hour.includes('旌德'));
    assert.ok(hitResult.hour.includes('旌钺'));
    assert.ok(!Object.values(missResult).flat().includes('扶生日'));
    assert.ok(!Object.values(missResult).flat().includes('旌德'));
    assert.ok(!Object.values(missResult).flat().includes('旌钺'));
  }
});

test('三命通会天喜神应按四季地支取用', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['丁', '卯'],
        ['戊', '戌'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['丁', '卯'],
        ['己', '酉'],
      ],
      'male',
    );

    assert.ok(hitResult.hour.includes('天喜神'));
    assert.ok(!Object.values(missResult).flat().includes('天喜神'));
  }
});

test('五行精纪又旌德应按年支三合组补入时干', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '寅'],
        ['乙', '卯'],
        ['丙', '辰'],
        ['辛', '巳'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '寅'],
        ['乙', '卯'],
        ['丙', '辰'],
        ['庚', '巳'],
      ],
      'male',
    );

    assert.ok(hitResult.hour.includes('旌德'));
    assert.ok(!hitResult.day.includes('旌德'));
    assert.ok(!missResult.hour.includes('旌德'));
  }
});

test('三命通会又旌钺应按年支三会组固定干支取用', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '寅'],
        ['癸', '酉'],
        ['丙', '辰'],
        ['庚', '午'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '寅'],
        ['壬', '酉'],
        ['丙', '辰'],
        ['庚', '午'],
      ],
      'male',
    );

    assert.ok(hitResult.month.includes('旌钺'));
    assert.ok(!missResult.month.includes('旌钺'));
  }
});

test('五行精纪点头杀与无形鬼应按日时固定干支旁证取用', () => {
  for (const calculator of createCalculators()) {
    const dianTouResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['乙', '丑'],
        ['戊', '寅'],
        ['癸', '巳'],
      ],
      'male',
    );
    const dianTouMissResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['乙', '丑'],
        ['戊', '寅'],
        ['庚', '申'],
      ],
      'male',
    );
    const wuXingGuiResult = calculator.calculateAllShenSha(
      [
        ['乙', '丑'],
        ['甲', '午'],
        ['甲', '午'],
        ['丙', '子'],
      ],
      'male',
    );
    const wuXingGuiMissResult = calculator.calculateAllShenSha(
      [
        ['乙', '丑'],
        ['甲', '午'],
        ['乙', '未'],
        ['丙', '子'],
      ],
      'male',
    );

    assert.ok(dianTouResult.day.includes('点头杀'));
    assert.ok(!dianTouMissResult.day.includes('点头杀'));
    assert.ok(wuXingGuiResult.month.includes('无形鬼'));
    assert.ok(wuXingGuiResult.day.includes('无形鬼'));
    assert.ok(!Object.values(wuXingGuiMissResult).flat().includes('无形鬼'));
  }
});

test('五行精纪离乡杀、天屠别名与颠倒杀应按原文字表取用', () => {
  for (const calculator of createCalculators()) {
    const liXiangResult = calculator.calculateAllShenSha(
      [
        ['甲', '寅'],
        ['乙', '丑'],
        ['丙', '午'],
        ['丁', '卯'],
      ],
      'male',
    );
    const liXiangMissResult = calculator.calculateAllShenSha(
      [
        ['甲', '寅'],
        ['乙', '丑'],
        ['丙', '巳'],
        ['丁', '卯'],
      ],
      'male',
    );
    const aliasResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['乙', '丑'],
        ['壬', '辰'],
        ['辛', '卯'],
      ],
      'male',
    );
    const aliasMoreResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['乙', '丑'],
        ['癸', '巳'],
        ['丁', '未'],
      ],
      'male',
    );
    const dianDaoResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['乙', '丑'],
        ['丙', '寅'],
        ['丁', '丑'],
      ],
      'male',
    );
    const dianDaoMissResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['乙', '丑'],
        ['丙', '寅'],
        ['丁', '寅'],
      ],
      'male',
    );

    assert.ok(liXiangResult.day.includes('离乡杀'));
    assert.ok(!liXiangMissResult.day.includes('离乡杀'));
    assert.ok(aliasResult.day.includes('玄武受戮'));
    assert.ok(aliasResult.hour.includes('白虎丧目'));
    assert.ok(aliasMoreResult.day.includes('青龙伏藏'));
    assert.ok(aliasMoreResult.hour.includes('玄武折足'));
    assert.ok(dianDaoResult.hour.includes('颠倒杀'));
    assert.ok(!dianDaoMissResult.hour.includes('颠倒杀'));
  }
});

test('五行精纪天瞽杀应按月令起申逆行十二支取用', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['戊', '申'],
        ['庚', '午'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['戊', '未'],
        ['庚', '午'],
      ],
      'male',
    );

    assert.ok(hitResult.day.includes('天瞽杀'));
    assert.ok(hitResult.day.includes('飞廉杀'));
    assert.ok(!Object.values(missResult).flat().includes('天瞽杀'));
    assert.ok(!Object.values(missResult).flat().includes('飞廉杀'));
  }
});

test('五行精纪五鬼空亡、破祖空亡与鸱枭杀应按古籍原文取用', () => {
  for (const calculator of createCalculators()) {
    const wuGuiResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丁', '巳'],
        ['戊', '午'],
        ['己', '申'],
      ],
      'male',
    );
    const poZuResult = calculator.calculateAllShenSha(
      [
        ['戊', '子'],
        ['甲', '戌'],
        ['乙', '卯'],
        ['丙', '辰'],
      ],
      'male',
    );
    const chiXiaoResult = calculator.calculateAllShenSha(
      [
        ['壬', '子'],
        ['壬', '寅'],
        ['丁', '巳'],
        ['戊', '巳'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['壬', '子'],
        ['壬', '卯'],
        ['丁', '巳'],
        ['戊', '辰'],
      ],
      'male',
    );

    assert.ok(wuGuiResult.month.includes('五鬼空亡'));
    assert.ok(wuGuiResult.day.includes('五鬼空亡'));
    assert.ok(poZuResult.month.includes('破祖空亡'));
    assert.ok(chiXiaoResult.day.includes('鸱枭杀'));
    assert.ok(chiXiaoResult.hour.includes('鸱枭杀'));
    assert.ok(!Object.values(missResult).flat().includes('五鬼空亡'));
    assert.ok(!Object.values(missResult).flat().includes('破祖空亡'));
    assert.ok(!Object.values(missResult).flat().includes('鸱枭杀'));
  }
});

test('五行精纪自刃、飞刃、五行真日时与离祖杀应按日时原文取用', () => {
  for (const calculator of createCalculators()) {
    const ziRenResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['乙', '卯'],
        ['丙', '午'],
        ['癸', '丑'],
      ],
      'male',
    );
    const feiRenResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['乙', '卯'],
        ['庚', '午'],
        ['丁', '丑'],
      ],
      'male',
    );
    const zhenRiShiResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['乙', '卯'],
        ['乙', '酉'],
        ['庚', '辰'],
      ],
      'male',
    );
    const liZuResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['乙', '卯'],
        ['庚', '午'],
        ['丁', '丑'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['乙', '卯'],
        ['庚', '午'],
        ['丁', '寅'],
      ],
      'male',
    );

    assert.ok(ziRenResult.day.includes('自刃'));
    assert.ok(ziRenResult.hour.includes('自刃'));
    assert.ok(feiRenResult.hour.includes('飞刃'));
    assert.ok(zhenRiShiResult.hour.includes('五行真日时'));
    assert.ok(liZuResult.hour.includes('离祖杀'));
    assert.ok(!Object.values(missResult).flat().includes('自刃'));
    assert.ok(!Object.values(missResult).flat().includes('五行真日时'));
    assert.ok(!Object.values(missResult).flat().includes('离祖杀'));
  }
});
