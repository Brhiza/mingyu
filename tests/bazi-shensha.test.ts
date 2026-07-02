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
