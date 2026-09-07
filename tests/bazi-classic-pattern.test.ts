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
    year: { gan: '丁', zhi: '亥', ganZhi: '丁亥' },
    month: { gan: '戊', zhi: '辰', ganZhi: '戊辰' },
    day: { gan: '甲', zhi: '寅', ganZhi: '甲寅' },
    hour: { gan: '乙', zhi: '丑', ganZhi: '乙丑' },
  });
  const jiPattern = identify({
    year: { gan: '丁', zhi: '亥', ganZhi: '丁亥' },
    month: { gan: '戊', zhi: '辰', ganZhi: '戊辰' },
    day: { gan: '己', zhi: '卯', ganZhi: '己卯' },
    hour: { gan: '乙', zhi: '丑', ganZhi: '乙丑' },
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

test('六乙鼠贵只取乙日丙子时，并排除古籍所列破格条件', () => {
  const basePillars: Pillars = {
    year: { gan: '癸', zhi: '亥', ganZhi: '癸亥' },
    month: { gan: '戊', zhi: '辰', ganZhi: '戊辰' },
    day: { gan: '乙', zhi: '未', ganZhi: '乙未' },
    hour: { gan: '丙', zhi: '子', ganZhi: '丙子' },
  };

  assert.equal(identify(basePillars)?.name, '六乙鼠贵格');
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

test('日贵格应完整识别四日，并把昼夜保留为未代判的加强条件', () => {
  for (const dayGanZhi of ['丁酉', '丁亥', '癸巳', '癸卯']) {
    const pattern = identify({
      year: { gan: '甲', zhi: '子', ganZhi: '甲子' },
      month: { gan: '丙', zhi: '申', ganZhi: '丙申' },
      day: { gan: dayGanZhi[0], zhi: dayGanZhi[1], ganZhi: dayGanZhi },
      hour: { gan: '戊', zhi: '辰', ganZhi: '戊辰' },
    });

    assert.equal(pattern?.name, '日贵格', dayGanZhi);
    assert.match(pattern?.description ?? '', /昼夜加强条件不在此处代判/);
  }
});

test('福德秀气应要求阴干日坐巳酉丑且会齐金局，旧十日规则不再误报', () => {
  const valid = identify({
    year: { gan: '辛', zhi: '酉', ganZhi: '辛酉' },
    month: { gan: '丙', zhi: '寅', ganZhi: '丙寅' },
    day: { gan: '乙', zhi: '巳', ganZhi: '乙巳' },
    hour: { gan: '己', zhi: '丑', ganZhi: '己丑' },
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

test('子午双包须一方至少两见且另一方同时出现', () => {
  const cases: Array<[string[], boolean]> = [
    [['子', '午', '辰', '子'], true],
    [['午', '子', '辰', '午'], true],
    [['子', '午', '午', '子'], true],
    [['子', '申', '辰', '子'], false],
    [['午', '申', '辰', '午'], false],
    [['子', '午', '辰', '亥'], false],
  ];
  const validStemByBranch: Record<string, string> = {
    子: '甲',
    丑: '乙',
    寅: '丙',
    卯: '丁',
    辰: '戊',
    巳: '己',
    午: '庚',
    未: '辛',
    申: '壬',
    酉: '癸',
    戌: '甲',
    亥: '乙',
  };

  for (const [branches, expected] of cases) {
    const yearStem = validStemByBranch[branches[0]];
    const monthStem = validStemByBranch[branches[1]];
    const hourStem = validStemByBranch[branches[3]];
    const pattern = identify({
      year: { gan: yearStem, zhi: branches[0], ganZhi: `${yearStem}${branches[0]}` },
      month: { gan: monthStem, zhi: branches[1], ganZhi: `${monthStem}${branches[1]}` },
      day: { gan: '甲', zhi: branches[2], ganZhi: `甲${branches[2]}` },
      hour: { gan: hourStem, zhi: branches[3], ganZhi: `${hourStem}${branches[3]}` },
    });

    assert.equal(pattern?.name === '子午双包格', expected, branches.join(''));
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
