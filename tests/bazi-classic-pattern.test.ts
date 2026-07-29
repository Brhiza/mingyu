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

test('金神格应纠正甲日喜火惧水，并保留己日喜忌分歧', () => {
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
  assert.deepEqual(jiaPattern?.favorableWuxing, ['火']);
  assert.deepEqual(jiaPattern?.unfavorableWuxing, ['水']);
  assert.match(jiaPattern?.source?.quote ?? '', /入火乡为胜.*惧水乡/);

  assert.equal(jiPattern?.name, '金神格');
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

test('月令无用时日贵格应完整识别四日，并把昼夜保留为未代判的加强条件', () => {
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
    assert.match(pattern?.description ?? '', /昼夜加强条件不在此处代判/);
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
        year: { gan: '壬', zhi: '亥', ganZhi: '壬亥' },
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
