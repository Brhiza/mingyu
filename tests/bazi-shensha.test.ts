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
  // 日柱乙丑 = 金神，应在日支检出
  assert.ok(result1.day.includes('金神'));

  // 日柱非金神、时柱是金神时，应检出
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

test('德秀贵人不能只见德不见秀就成立', () => {
  const calculator = new ShenShaCalculator();
  const result = calculator.calculateAllShenSha(
    [
      ['甲', '子'],
      ['丁', '寅'],
      ['庚', '午'],
      ['乙', '丑'],
    ],
    'male',
  );

  assert.ok(!result.month.includes('德秀贵人'));
});

test('德秀贵人不应把合干错当作命中天干', () => {
  const calculator = new ShenShaCalculator();
  const result = calculator.calculateAllShenSha(
    [
      ['甲', '子'],
      ['辛', '酉'],
      ['庚', '午'],
      ['丁', '丑'],
    ],
    'male',
  );

  assert.ok(!result.hour.includes('德秀贵人'));
});

test('德秀贵人在巳酉丑月应识别辛干与乙干的同现', () => {
  const calculator = new ShenShaCalculator();
  const result = calculator.calculateAllShenSha(
    [
      ['甲', '子'],
      ['辛', '酉'],
      ['庚', '午'],
      ['乙', '丑'],
    ],
    'male',
  );

  assert.ok(result.month.includes('德秀贵人'));
  assert.ok(result.hour.includes('德秀贵人'));
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

test('空亡兼容口径可同时参考日柱与年柱旬空', () => {
  for (const calculator of createCalculators({ variants: { kongWangBasis: 'day-and-year' } })) {
    const result = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '戌'],
        ['庚', '辰'],
        ['丁', '丑'],
      ],
      'male',
    );

    assert.ok(result.month.includes('空亡'));
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

test('羊刃兼容口径可把阴干帝旺位作为阴刃并入', () => {
  for (const calculator of createCalculators({ variants: { yangRenMode: 'include-yin-ren' } })) {
    const result = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['乙', '巳'],
        ['丁', '丑'],
      ],
      'male',
    );

    assert.ok(result.month.includes('羊刃'));
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

test('飞刃兼容口径可跟随阴刃推出对冲位', () => {
  for (const calculator of createCalculators({ variants: { yangRenMode: 'include-yin-ren' } })) {
    const result = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '申'],
        ['乙', '巳'],
        ['丁', '丑'],
      ],
      'male',
    );

    assert.ok(result.month.includes('飞刃'));
  }
});

test('童子煞兼容口径可改为四柱同查', () => {
  for (const calculator of createCalculators({ variants: { tongZiScope: 'all-pillars' } })) {
    const result = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['庚', '午'],
        ['丁', '酉'],
      ],
      'male',
    );

    assert.ok(result.year.includes('童子煞'));
  }
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

test('九丑应取丁卯日，不应误取乙卯日', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['丁', '卯'],
        ['戊', '辰'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['乙', '卯'],
        ['戊', '辰'],
      ],
      'male',
    );

    assert.ok(hitResult.day.includes('九丑'));
    assert.ok(!missResult.day.includes('九丑'));
  }
});
