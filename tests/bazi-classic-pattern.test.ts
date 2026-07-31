import assert from 'node:assert/strict';
import test from 'node:test';
import { identifyClassicPattern } from '../packages/core/src/bazi/baziEnhancement/classicPatterns';

type Pillars = Parameters<typeof identifyClassicPattern>[2];
type HiddenStems = Parameters<typeof identifyClassicPattern>[3];

const EMPTY_HIDDEN_STEMS: HiddenStems = {
  year: [],
  month: [],
  day: [],
  hour: [],
};

function identify(pillars: Pillars) {
  return identifyClassicPattern(
    pillars.day.gan,
    pillars.month.zhi,
    pillars,
    EMPTY_HIDDEN_STEMS,
    '正印格',
  );
}

test('金神只保留其他古籍结构来源，不固化甲己日喜忌五行', () => {
  const jiaPattern = identify({
    year: { gan: '壬', zhi: '寅', ganZhi: '壬寅' },
    month: { gan: '壬', zhi: '寅', ganZhi: '壬寅' },
    day: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    hour: { gan: '乙', zhi: '丑', ganZhi: '乙丑' },
  });
  const jiPattern = identify({
    year: { gan: '庚', zhi: '子', ganZhi: '庚子' },
    month: { gan: '丁', zhi: '丑', ganZhi: '丁丑' },
    day: { gan: '己', zhi: '卯', ganZhi: '己卯' },
    hour: { gan: '己', zhi: '巳', ganZhi: '己巳' },
  });

  assert.equal(jiaPattern?.name, '金神格');
  assert.equal(jiaPattern?.sourceRole, '其他古籍名目参考');
  assert.deepEqual(jiaPattern?.favorableWuxing, []);
  assert.deepEqual(jiaPattern?.unfavorableWuxing, []);
  assert.match(jiaPattern?.source?.quote ?? '', /入火乡为胜.*惧水乡/);

  assert.equal(jiPattern?.name, '金神格');
  assert.equal(jiPattern?.sourceRole, '其他古籍名目参考');
  assert.deepEqual(jiPattern?.favorableWuxing, []);
  assert.deepEqual(jiPattern?.unfavorableWuxing, []);
  assert.match(jiPattern?.description ?? '', /不能照搬甲日/);
});

test('月令已有用神时不以六乙鼠贵另立外格', () => {
  const basePillars: Pillars = {
    year: { gan: '癸', zhi: '亥', ganZhi: '癸亥' },
    month: { gan: '戊', zhi: '辰', ganZhi: '戊辰' },
    day: { gan: '乙', zhi: '未', ganZhi: '乙未' },
    hour: { gan: '丙', zhi: '子', ganZhi: '丙子' },
  };

  assert.notEqual(identify(basePillars)?.name, '六乙鼠贵格');
  assert.notEqual(
    identify({
      ...basePillars,
      day: { gan: '己', zhi: '未', ganZhi: '己未' },
    })?.name,
    '六乙鼠贵格',
  );

  const breakers: Array<Partial<Pillars>> = [
    { year: { gan: '甲', zhi: '午', ganZhi: '甲午' } },
    { year: { gan: '癸', zhi: '丑', ganZhi: '癸丑' } },
    { year: { gan: '乙', zhi: '卯', ganZhi: '乙卯' } },
    { year: { gan: '庚', zhi: '辰', ganZhi: '庚辰' } },
    { year: { gan: '庚', zhi: '申', ganZhi: '庚申' } },
    { year: { gan: '癸', zhi: '酉', ganZhi: '癸酉' } },
    { year: { gan: '辛', zhi: '亥', ganZhi: '辛亥' } },
  ];

  for (const breaker of breakers) {
    assert.notEqual(identify({ ...basePillars, ...breaker })?.name, '六乙鼠贵格');
  }
});

test('乙生寅月丙子时有月令用神时不作六乙鼠贵', () => {
  const pillars: Pillars = {
    year: { gan: '癸', zhi: '亥', ganZhi: '癸亥' },
    month: { gan: '甲', zhi: '寅', ganZhi: '甲寅' },
    day: { gan: '乙', zhi: '未', ganZhi: '乙未' },
    hour: { gan: '丙', zhi: '子', ganZhi: '丙子' },
  };

  assert.notEqual(identify(pillars)?.name, '六乙鼠贵格');
});

test('辛日透丙且得戊子时有官印结构时不作六阴朝阳', () => {
  const pillars: Pillars = {
    year: { gan: '丙', zhi: '午', ganZhi: '丙午' },
    month: { gan: '丁', zhi: '酉', ganZhi: '丁酉' },
    day: { gan: '辛', zhi: '卯', ganZhi: '辛卯' },
    hour: { gan: '戊', zhi: '子', ganZhi: '戊子' },
  };

  assert.notEqual(identify(pillars)?.name, '六阴朝阳格');
});

test('日贵四日只保留其他古籍名目参考，昼夜条件不代判', () => {
  for (const dayGanZhi of ['丁酉', '丁亥', '癸巳', '癸卯']) {
    const isDingDay = dayGanZhi.startsWith('丁');
    const pattern = identify({
      year: isDingDay
        ? { gan: '丙', zhi: '子', ganZhi: '丙子' }
        : { gan: '壬', zhi: '午', ganZhi: '壬午' },
      month: isDingDay
        ? { gan: '甲', zhi: '午', ganZhi: '甲午' }
        : { gan: '庚', zhi: '子', ganZhi: '庚子' },
      day: { gan: dayGanZhi[0], zhi: dayGanZhi[1], ganZhi: dayGanZhi },
      hour: { gan: '甲', zhi: isDingDay ? '辰' : '寅', ganZhi: `甲${isDingDay ? '辰' : '寅'}` },
    });

    assert.equal(pattern?.name, '日贵格', dayGanZhi);
    assert.equal(pattern?.sourceRole, '其他古籍名目参考');
    assert.match(pattern?.description ?? '', /资料不足以判昼夜条件/);
  }
});

test('福德秀气应要求阴干日坐巳酉丑且会齐金局，旧十日规则不再误报', () => {
  const valid = identify({
    year: { gan: '癸', zhi: '酉', ganZhi: '癸酉' },
    month: { gan: '甲', zhi: '寅', ganZhi: '甲寅' },
    day: { gan: '乙', zhi: '巳', ganZhi: '乙巳' },
    hour: { gan: '丁', zhi: '丑', ganZhi: '丁丑' },
  });
  const incomplete = identify({
    year: { gan: '辛', zhi: '酉', ganZhi: '辛酉' },
    month: { gan: '丙', zhi: '寅', ganZhi: '丙寅' },
    day: { gan: '乙', zhi: '巳', ganZhi: '乙巳' },
    hour: { gan: '癸', zhi: '亥', ganZhi: '癸亥' },
  });
  const oldFalsePositive = identify({
    year: { gan: '乙', zhi: '丑', ganZhi: '乙丑' },
    month: { gan: '丙', zhi: '辰', ganZhi: '丙辰' },
    day: { gan: '甲', zhi: '申', ganZhi: '甲申' },
    hour: { gan: '丁', zhi: '未', ganZhi: '丁未' },
  });

  assert.equal(valid?.name, '福德秀气格');
  assert.equal(valid?.sourceRole, '其他古籍名目参考');
  assert.match(valid?.source?.quote ?? '', /专以巳酉丑金局/);
  assert.notEqual(incomplete?.name, '福德秀气格');
  assert.notEqual(oldFalsePositive?.name, '福德秀气格');
});

test('子午双包须先满足外格前提，再要求一方至少两见且另一方同时出现', () => {
  const cases: Array<[Pillars, boolean]> = [
    [
      {
        year: { gan: '壬', zhi: '子', ganZhi: '壬子' },
        month: { gan: '庚', zhi: '子', ganZhi: '庚子' },
        day: { gan: '壬', zhi: '午', ganZhi: '壬午' },
        hour: { gan: '甲', zhi: '辰', ganZhi: '甲辰' },
      },
      true,
    ],
    [
      {
        year: { gan: '戊', zhi: '子', ganZhi: '戊子' },
        month: { gan: '丙', zhi: '辰', ganZhi: '丙辰' },
        day: { gan: '戊', zhi: '午', ganZhi: '戊午' },
        hour: { gan: '戊', zhi: '午', ganZhi: '戊午' },
      },
      true,
    ],
    [
      {
        year: { gan: '壬', zhi: '子', ganZhi: '壬子' },
        month: { gan: '庚', zhi: '子', ganZhi: '庚子' },
        day: { gan: '壬', zhi: '午', ganZhi: '壬午' },
        hour: { gan: '甲', zhi: '午', ganZhi: '甲午' },
      },
      true,
    ],
    [
      {
        year: { gan: '壬', zhi: '子', ganZhi: '壬子' },
        month: { gan: '庚', zhi: '子', ganZhi: '庚子' },
        day: { gan: '壬', zhi: '辰', ganZhi: '壬辰' },
        hour: { gan: '甲', zhi: '辰', ganZhi: '甲辰' },
      },
      false,
    ],
    [
      {
        year: { gan: '癸', zhi: '亥', ganZhi: '癸亥' },
        month: { gan: '辛', zhi: '亥', ganZhi: '辛亥' },
        day: { gan: '壬', zhi: '午', ganZhi: '壬午' },
        hour: { gan: '甲', zhi: '午', ganZhi: '甲午' },
      },
      false,
    ],
    [
      {
        year: { gan: '壬', zhi: '子', ganZhi: '壬子' },
        month: { gan: '辛', zhi: '亥', ganZhi: '辛亥' },
        day: { gan: '壬', zhi: '午', ganZhi: '壬午' },
        hour: { gan: '甲', zhi: '辰', ganZhi: '甲辰' },
      },
      false,
    ],
  ];

  for (const [pillars, expected] of cases) {
    assert.equal(identify(pillars)?.name === '子午双包格', expected);
  }
});

test('月令本气有用、藏干透出、会支取用或干头见财官时均不得另寻外格', () => {
  const eligible: Pillars = {
    year: { gan: '壬', zhi: '寅', ganZhi: '壬寅' },
    month: { gan: '壬', zhi: '寅', ganZhi: '壬寅' },
    day: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    hour: { gan: '乙', zhi: '丑', ganZhi: '乙丑' },
  };
  assert.equal(identify(eligible)?.name, '金神格');

  const rejected: Pillars[] = [
    { ...eligible, month: { gan: '辛', zhi: '亥', ganZhi: '辛亥' } },
    {
      ...eligible,
      hour: { gan: '庚', zhi: '午', ganZhi: '庚午' },
    },
    {
      ...eligible,
      year: { gan: '甲', zhi: '子', ganZhi: '甲子' },
      month: { gan: '丙', zhi: '寅', ganZhi: '丙寅' },
    },
    {
      year: { gan: '壬', zhi: '午', ganZhi: '壬午' },
      month: { gan: '壬', zhi: '寅', ganZhi: '壬寅' },
      day: { gan: '甲', zhi: '戌', ganZhi: '甲戌' },
      hour: { gan: '乙', zhi: '丑', ganZhi: '乙丑' },
    },
  ];

  for (const pillars of rejected) {
    assert.equal(identify(pillars), null);
  }
});

test('五行一方秀气须同时满足完整三合或三会与对应季节', () => {
  const cases: Array<[Pillars, string]> = [
    [
      {
        year: { gan: '癸', zhi: '亥', ganZhi: '癸亥' },
        month: { gan: '乙', zhi: '卯', ganZhi: '乙卯' },
        day: { gan: '乙', zhi: '未', ganZhi: '乙未' },
        hour: { gan: '壬', zhi: '午', ganZhi: '壬午' },
      },
      '曲直格',
    ],
    [
      {
        year: { gan: '甲', zhi: '寅', ganZhi: '甲寅' },
        month: { gan: '丁', zhi: '巳', ganZhi: '丁巳' },
        day: { gan: '丙', zhi: '午', ganZhi: '丙午' },
        hour: { gan: '乙', zhi: '未', ganZhi: '乙未' },
      },
      '炎上格',
    ],
    [
      {
        year: { gan: '己', zhi: '巳', ganZhi: '己巳' },
        month: { gan: '癸', zhi: '酉', ganZhi: '癸酉' },
        day: { gan: '辛', zhi: '丑', ganZhi: '辛丑' },
        hour: { gan: '戊', zhi: '戌', ganZhi: '戊戌' },
      },
      '从革格',
    ],
    [
      {
        year: { gan: '庚', zhi: '申', ganZhi: '庚申' },
        month: { gan: '壬', zhi: '子', ganZhi: '壬子' },
        day: { gan: '壬', zhi: '辰', ganZhi: '壬辰' },
        hour: { gan: '辛', zhi: '亥', ganZhi: '辛亥' },
      },
      '润下格',
    ],
    [
      {
        year: { gan: '戊', zhi: '辰', ganZhi: '戊辰' },
        month: { gan: '丙', zhi: '戌', ganZhi: '丙戌' },
        day: { gan: '己', zhi: '丑', ganZhi: '己丑' },
        hour: { gan: '己', zhi: '未', ganZhi: '己未' },
      },
      '稼穑格',
    ],
  ];

  for (const [pillars, expectedName] of cases) {
    const pattern = identify(pillars);
    assert.equal(pattern?.name, expectedName);
    assert.equal(pattern?.sourceRole, '《子平真诠》杂格候选');
    assert.match(pattern?.description ?? '', /不|仍须/);
  }

  const outOfSeason: Pillars = {
    year: { gan: '癸', zhi: '亥', ganZhi: '癸亥' },
    month: { gan: '乙', zhi: '未', ganZhi: '乙未' },
    day: { gan: '乙', zhi: '卯', ganZhi: '乙卯' },
    hour: { gan: '壬', zhi: '午', ganZhi: '壬午' },
  };
  assert.notEqual(identify(outOfSeason)?.name, '曲直格');
});

test('化气候选须日干参与五合、得令、完整会局且没有争合', () => {
  const exactExample: Pillars = {
    year: { gan: '甲', zhi: '戌', ganZhi: '甲戌' },
    month: { gan: '丁', zhi: '卯', ganZhi: '丁卯' },
    day: { gan: '壬', zhi: '寅', ganZhi: '壬寅' },
    hour: { gan: '甲', zhi: '辰', ganZhi: '甲辰' },
  };
  const pattern = identify(exactExample);
  assert.equal(pattern?.name, '丁壬化木格');
  assert.equal(pattern?.sourceRole, '《子平真诠》杂格候选');
  assert.match(pattern?.description ?? '', /不.*真正合化|是否真正合化/);

  assert.notEqual(
    identify({
      ...exactExample,
      hour: { gan: '甲', zhi: '午', ganZhi: '甲午' },
    })?.name,
    '丁壬化木格',
  );
  assert.notEqual(
    identify({
      ...exactExample,
      year: { gan: '丁', zhi: '亥', ganZhi: '丁亥' },
    })?.name,
    '丁壬化木格',
  );
});

test('倒冲须按戊日四午或丙日三午例型，不再以两支或丁巳泛报', () => {
  const wuFourWu = identify({
    year: { gan: '戊', zhi: '午', ganZhi: '戊午' },
    month: { gan: '戊', zhi: '午', ganZhi: '戊午' },
    day: { gan: '戊', zhi: '午', ganZhi: '戊午' },
    hour: { gan: '戊', zhi: '午', ganZhi: '戊午' },
  });
  const bingThreeWu = identify({
    year: { gan: '甲', zhi: '寅', ganZhi: '甲寅' },
    month: { gan: '庚', zhi: '午', ganZhi: '庚午' },
    day: { gan: '丙', zhi: '午', ganZhi: '丙午' },
    hour: { gan: '甲', zhi: '午', ganZhi: '甲午' },
  });
  const onlyTwoWu = identify({
    year: { gan: '甲', zhi: '寅', ganZhi: '甲寅' },
    month: { gan: '甲', zhi: '午', ganZhi: '甲午' },
    day: { gan: '丙', zhi: '午', ganZhi: '丙午' },
    hour: { gan: '甲', zhi: '辰', ganZhi: '甲辰' },
  });
  const oldDingSi = identify({
    year: { gan: '乙', zhi: '巳', ganZhi: '乙巳' },
    month: { gan: '丁', zhi: '巳', ganZhi: '丁巳' },
    day: { gan: '丁', zhi: '卯', ganZhi: '丁卯' },
    hour: { gan: '乙', zhi: '巳', ganZhi: '乙巳' },
  });

  assert.equal(wuFourWu?.name, '倒冲格');
  assert.equal(bingThreeWu?.name, '倒冲格');
  assert.notEqual(onlyTwoWu?.name, '倒冲格');
  assert.notEqual(oldDingSi?.name, '倒冲格');
});

test('论杂格共同资格允许单一无根财透，但两财、财有根或官杀明透均阻断', () => {
  const singleUnrootedWealth: Pillars = {
    year: { gan: '甲', zhi: '寅', ganZhi: '甲寅' },
    month: { gan: '庚', zhi: '午', ganZhi: '庚午' },
    day: { gan: '丙', zhi: '午', ganZhi: '丙午' },
    hour: { gan: '甲', zhi: '午', ganZhi: '甲午' },
  };
  assert.equal(identify(singleUnrootedWealth)?.name, '倒冲格');

  assert.notEqual(
    identify({
      ...singleUnrootedWealth,
      year: { gan: '庚', zhi: '申', ganZhi: '庚申' },
      month: { gan: '甲', zhi: '午', ganZhi: '甲午' },
    })?.name,
    '倒冲格',
  );
  assert.notEqual(
    identify({
      ...singleUnrootedWealth,
      year: { gan: '庚', zhi: '寅', ganZhi: '庚寅' },
    })?.name,
    '倒冲格',
  );
  assert.notEqual(
    identify({
      ...singleUnrootedWealth,
      year: { gan: '癸', zhi: '酉', ganZhi: '癸酉' },
    })?.name,
    '倒冲格',
  );
});

test('朝阳、合禄、井栏、刑合与辛丑遥合须逐格满足原文明列边界', () => {
  const cases: Array<[Pillars, string]> = [
    [
      {
        year: { gan: '戊', zhi: '辰', ganZhi: '戊辰' },
        month: { gan: '辛', zhi: '酉', ganZhi: '辛酉' },
        day: { gan: '辛', zhi: '酉', ganZhi: '辛酉' },
        hour: { gan: '戊', zhi: '子', ganZhi: '戊子' },
      },
      '六阴朝阳格',
    ],
    [
      {
        year: { gan: '己', zhi: '未', ganZhi: '己未' },
        month: { gan: '戊', zhi: '辰', ganZhi: '戊辰' },
        day: { gan: '戊', zhi: '辰', ganZhi: '戊辰' },
        hour: { gan: '庚', zhi: '申', ganZhi: '庚申' },
      },
      '合禄格',
    ],
    [
      {
        year: { gan: '辛', zhi: '酉', ganZhi: '辛酉' },
        month: { gan: '癸', zhi: '未', ganZhi: '癸未' },
        day: { gan: '癸', zhi: '未', ganZhi: '癸未' },
        hour: { gan: '庚', zhi: '申', ganZhi: '庚申' },
      },
      '合禄格',
    ],
    [
      {
        year: { gan: '戊', zhi: '子', ganZhi: '戊子' },
        month: { gan: '庚', zhi: '申', ganZhi: '庚申' },
        day: { gan: '庚', zhi: '申', ganZhi: '庚申' },
        hour: { gan: '庚', zhi: '辰', ganZhi: '庚辰' },
      },
      '井栏格',
    ],
    [
      {
        year: { gan: '乙', zhi: '未', ganZhi: '乙未' },
        month: { gan: '癸', zhi: '卯', ganZhi: '癸卯' },
        day: { gan: '癸', zhi: '卯', ganZhi: '癸卯' },
        hour: { gan: '甲', zhi: '寅', ganZhi: '甲寅' },
      },
      '刑合格',
    ],
    [
      {
        year: { gan: '辛', zhi: '丑', ganZhi: '辛丑' },
        month: { gan: '辛', zhi: '丑', ganZhi: '辛丑' },
        day: { gan: '辛', zhi: '丑', ganZhi: '辛丑' },
        hour: { gan: '庚', zhi: '寅', ganZhi: '庚寅' },
      },
      '辛丑遥合格',
    ],
  ];

  for (const [pillars, expectedName] of cases) {
    const pattern = identify(pillars);
    assert.equal(pattern?.name, expectedName);
    assert.equal(pattern?.sourceRole, '《子平真诠》杂格候选');
  }

  const invalidJingLanMonth: Pillars = {
    year: { gan: '戊', zhi: '申', ganZhi: '戊申' },
    month: { gan: '庚', zhi: '子', ganZhi: '庚子' },
    day: { gan: '庚', zhi: '辰', ganZhi: '庚辰' },
    hour: { gan: '庚', zhi: '申', ganZhi: '庚申' },
  };
  assert.notEqual(identify(invalidJingLanMonth)?.name, '井栏格');

  const abandonedJiaZiYaoSi: Pillars = {
    year: { gan: '甲', zhi: '申', ganZhi: '甲申' },
    month: { gan: '甲', zhi: '戌', ganZhi: '甲戌' },
    day: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    hour: { gan: '甲', zhi: '子', ganZhi: '甲子' },
  };
  assert.notEqual(identify(abandonedJiaZiYaoSi)?.name, '甲子遥巳格');
});

test('不把古籍片段和单一神煞状态误立为经典格局', () => {
  const formerFalsePositives: Array<[Pillars, string]> = [
    [
      {
        year: { gan: '甲', zhi: '子', ganZhi: '甲子' },
        month: { gan: '丙', zhi: '申', ganZhi: '丙申' },
        day: { gan: '癸', zhi: '未', ganZhi: '癸未' },
        hour: { gan: '丁', zhi: '巳', ganZhi: '丁巳' },
      },
      '癸丁格',
    ],
    [
      {
        year: { gan: '壬', zhi: '子', ganZhi: '壬子' },
        month: { gan: '丁', zhi: '亥', ganZhi: '丁亥' },
        day: { gan: '甲', zhi: '午', ganZhi: '甲午' },
        hour: { gan: '庚', zhi: '辰', ganZhi: '庚辰' },
      },
      '仁者变德格',
    ],
    [
      {
        year: { gan: '甲', zhi: '寅', ganZhi: '甲寅' },
        month: { gan: '丙', zhi: '辰', ganZhi: '丙辰' },
        day: { gan: '甲', zhi: '午', ganZhi: '甲午' },
        hour: { gan: '壬', zhi: '申', ganZhi: '壬申' },
      },
      '刑冲得禄格',
    ],
    [
      {
        year: { gan: '甲', zhi: '子', ganZhi: '甲子' },
        month: { gan: '丙', zhi: '申', ganZhi: '丙申' },
        day: { gan: '戊', zhi: '寅', ganZhi: '戊寅' },
        hour: { gan: '甲', zhi: '辰', ganZhi: '甲辰' },
      },
      '夹丘格',
    ],
    [
      {
        year: { gan: '乙', zhi: '亥', ganZhi: '乙亥' },
        month: { gan: '丙', zhi: '申', ganZhi: '丙申' },
        day: { gan: '甲', zhi: '子', ganZhi: '甲子' },
        hour: { gan: '壬', zhi: '辰', ganZhi: '壬辰' },
      },
      '沐浴格/败地逢生格',
    ],
  ];

  for (const [pillars, removedName] of formerFalsePositives) {
    assert.notEqual(identify(pillars)?.name, removedName, removedName);
  }
});
