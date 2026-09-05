import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { evaluateTaiyiTacticGuidance, generateTaiyi } from '../packages/core/src/taiyi/index.ts';

type TaiyiTruthRow = readonly [
  year: number,
  accumulatedYears: number,
  bureau: number,
  taiyi: string,
  wenChang: string,
  shiJi: string,
  jiShen: string,
  taiSui: string,
  lordCount: number,
  guestCount: number,
  setCount: number,
];

// 独立真值取自 Kintaiyi 固定版本，用于锁住积年、局数、核心落宫与主客定算。
const TAIYI_TRUTH: TaiyiTruthRow[] = [
  [1950, 10155867, 51, '乾', '午', '坤', '子', '寅', 15, 13, 6],
  [1951, 10155868, 52, '午', '未', '酉', '亥', '卯', 39, 31, 24],
  [1952, 10155869, 53, '午', '坤', '亥', '戌', '辰', 38, 25, 14],
  [1953, 10155870, 54, '午', '坤', '子', '酉', '巳', 38, 24, 9],
  [1954, 10155871, 55, '艮', '申', '艮', '申', '午', 16, 3, 22],
  [1955, 10155872, 56, '艮', '酉', '辰', '未', '未', 15, 34, 10],
  [1956, 10155873, 57, '艮', '戌', '巳', '午', '申', 10, 25, 10],
  [1957, 10155874, 58, '卯', '乾', '未', '巳', '酉', 12, 26, 27],
  [1958, 10155875, 59, '卯', '乾', '申', '辰', '戌', 12, 19, 28],
  [1959, 10155876, 60, '卯', '亥', '戌', '卯', '亥', 12, 13, 19],
  [1960, 10155877, 61, '酉', '子', '亥', '寅', '子', 33, 34, 34],
  [1961, 10155878, 62, '酉', '丑', '艮', '丑', '丑', 26, 25, 25],
  [1962, 10155879, 63, '酉', '艮', '卯', '子', '寅', 25, 22, 18],
  [1963, 10155880, 64, '坤', '寅', '巽', '亥', '卯', 16, 11, 7],
  [1964, 10155881, 65, '坤', '卯', '未', '戌', '辰', 15, 1, 28],
  [1965, 10155882, 66, '坤', '辰', '丑', '酉', '巳', 12, 34, 19],
  [1966, 10155883, 67, '子', '巽', '戌', '申', '午', 25, 2, 26],
  [1967, 10155884, 68, '子', '巳', '子', '未', '未', 17, 8, 16],
  [1968, 10155885, 69, '子', '午', '艮', '午', '申', 16, 32, 7],
  [1969, 10155886, 70, '巽', '未', '卯', '巳', '酉', 30, 4, 15],
  [1970, 10155887, 71, '巽', '坤', '巳', '辰', '戌', 29, 32, 5],
  [1971, 10155888, 72, '巽', '坤', '午', '卯', '亥', 29, 31, 9],
  [1972, 10155889, 1, '乾', '申', '坤', '寅', '子', 7, 13, 13],
  [1973, 10155890, 2, '乾', '酉', '戌', '丑', '丑', 6, 1, 1],
  [1974, 10155891, 3, '乾', '戌', '亥', '子', '寅', 1, 40, 32],
  [1975, 10155892, 4, '午', '乾', '丑', '亥', '卯', 25, 17, 10],
  [1976, 10155893, 5, '午', '乾', '寅', '戌', '辰', 25, 14, 1],
  [1977, 10155894, 6, '午', '亥', '辰', '酉', '巳', 25, 10, 12],
  [1978, 10155895, 7, '艮', '子', '巳', '申', '午', 8, 25, 9],
  [1979, 10155896, 8, '艮', '丑', '坤', '未', '未', 1, 22, 3],
  [1980, 10155897, 9, '艮', '艮', '酉', '午', '申', 3, 15, 33],
  [1981, 10155898, 10, '卯', '寅', '乾', '巳', '酉', 1, 12, 25],
  [1982, 10155899, 11, '卯', '卯', '丑', '辰', '戌', 4, 4, 13],
  [1983, 10155900, 12, '卯', '辰', '寅', '卯', '亥', 37, 1, 4],
  [1984, 10155901, 13, '酉', '巽', '辰', '寅', '子', 18, 19, 19],
  [1985, 10155902, 14, '酉', '巳', '午', '丑', '丑', 10, 9, 9],
  [1986, 10155903, 15, '酉', '午', '坤', '子', '寅', 9, 7, 6],
  [1987, 10155904, 16, '坤', '未', '酉', '亥', '卯', 1, 33, 26],
  [1988, 10155905, 17, '坤', '坤', '亥', '戌', '辰', 7, 27, 16],
  [1989, 10155906, 18, '坤', '坤', '子', '酉', '巳', 7, 26, 11],
  [1990, 10155907, 19, '子', '申', '艮', '申', '午', 8, 32, 14],
  [1991, 10155908, 20, '子', '酉', '辰', '未', '未', 7, 26, 2],
  [1992, 10155909, 21, '子', '戌', '巳', '午', '申', 2, 17, 33],
  [1993, 10155910, 22, '巽', '乾', '未', '巳', '酉', 16, 30, 1],
  [1994, 10155911, 23, '巽', '乾', '申', '辰', '戌', 16, 23, 32],
  [1995, 10155912, 24, '巽', '亥', '戌', '卯', '亥', 16, 17, 23],
  [1996, 10155913, 25, '乾', '子', '亥', '寅', '子', 39, 40, 40],
  [1997, 10155914, 26, '乾', '丑', '艮', '丑', '丑', 32, 31, 31],
  [1998, 10155915, 27, '乾', '艮', '卯', '子', '寅', 31, 28, 31],
  [1999, 10155916, 28, '午', '寅', '巽', '亥', '卯', 14, 9, 38],
  [2000, 10155917, 29, '午', '卯', '未', '戌', '辰', 13, 39, 26],
  [2001, 10155918, 30, '午', '辰', '丑', '酉', '巳', 10, 32, 17],
  [2002, 10155919, 31, '艮', '巽', '戌', '申', '午', 33, 10, 34],
  [2003, 10155920, 32, '艮', '巳', '子', '未', '未', 25, 8, 24],
  [2004, 10155921, 33, '艮', '午', '艮', '午', '申', 24, 3, 15],
  [2005, 10155922, 34, '卯', '未', '卯', '巳', '酉', 26, 4, 11],
  [2006, 10155923, 35, '卯', '坤', '巳', '辰', '戌', 25, 28, 1],
  [2007, 10155924, 36, '卯', '坤', '午', '卯', '亥', 25, 27, 36],
  [2008, 10155925, 37, '酉', '申', '坤', '寅', '子', 1, 7, 7],
  [2009, 10155926, 38, '酉', '酉', '戌', '丑', '丑', 6, 35, 35],
  [2010, 10155927, 39, '酉', '戌', '亥', '子', '寅', 35, 34, 26],
  [2011, 10155928, 40, '坤', '乾', '丑', '亥', '卯', 27, 19, 12],
  [2012, 10155929, 41, '坤', '乾', '寅', '戌', '辰', 27, 16, 3],
  [2013, 10155930, 42, '坤', '亥', '辰', '酉', '巳', 27, 12, 34],
  [2014, 10155931, 43, '子', '子', '巳', '申', '午', 8, 17, 1],
  [2015, 10155932, 44, '子', '丑', '坤', '未', '未', 23, 14, 32],
  [2016, 10155933, 45, '子', '艮', '酉', '午', '申', 32, 7, 25],
  [2017, 10155934, 46, '巽', '寅', '乾', '巳', '酉', 5, 16, 29],
  [2018, 10155935, 47, '巽', '卯', '丑', '辰', '戌', 4, 8, 17],
  [2019, 10155936, 48, '巽', '辰', '寅', '卯', '亥', 1, 5, 8],
  [2020, 10155937, 49, '乾', '巽', '辰', '寅', '子', 24, 25, 25],
  [2021, 10155938, 50, '乾', '巳', '午', '丑', '丑', 16, 15, 15],
];

test('太乙年计 1950-2021 七十二局与独立真值全对拍', () => {
  for (const row of TAIYI_TRUTH) {
    const [
      year,
      accumulatedYears,
      bureau,
      taiyi,
      wenChang,
      shiJi,
      jiShen,
      taiSui,
      lordCount,
      guestCount,
      setCount,
    ] = row;
    const result = generateTaiyi({ year, scope: 'year' });

    assert.equal(result.accumulatedYears, accumulatedYears, `${year} 积年错误`);
    assert.equal(result.bureau, bureau, `${year} 局数错误`);
    assert.equal(result.yinYang, '阳遁', `${year} 阴阳遁错误`);
    assert.equal(result.taiyiPosition, taiyi, `${year} 太乙落宫错误`);
    assert.equal(result.wenChangPosition, wenChang, `${year} 文昌落宫错误`);
    assert.equal(result.shiJiPosition, shiJi, `${year} 始击落宫错误`);
    assert.equal(result.jiShenPosition, jiShen, `${year} 计神落宫错误`);
    assert.equal(result.ganZhi.slice(-1), taiSui, `${year} 太岁错误`);
    assert.equal(result.lordCount, lordCount, `${year} 主算错误`);
    assert.equal(result.guestCount, guestCount, `${year} 客算错误`);
    assert.equal(result.setCount, setCount, `${year} 定算错误`);
  }
});

test('太乙独立真值表应覆盖完整七十二局', () => {
  const bureaus = new Set(TAIYI_TRUTH.map((row) => row[2]));
  assert.equal(bureaus.size, 72);
  for (let bureau = 1; bureau <= 72; bureau += 1) {
    assert.ok(bureaus.has(bureau), `真值表缺少第 ${bureau} 局`);
  }
});

test('太乙月计按节气、日时计按固定版本样例生成完整基础盘', () => {
  const fixtures = [
    {
      scope: 'month' as const,
      date: new Date(2026, 0, 15, 0, 0),
      expected: [121871306, '阳遁', 2, '乾', '酉', '戌', '丑', 6, 1, 1],
    },
    {
      scope: 'day' as const,
      date: new Date(2026, 0, 15, 0, 0),
      expected: [708056786, '阳遁', 2, '乾', '酉', '戌', '丑', 6, 1, 1],
    },
    {
      scope: 'hour' as const,
      date: new Date(2026, 0, 15, 0, 0),
      expected: [8496681421, '阳遁', 13, '酉', '巽', '辰', '寅', 18, 19, 19],
    },
    {
      scope: 'month' as const,
      date: new Date(2026, 6, 11, 14, 35),
      expected: [121871312, '阳遁', 8, '艮', '丑', '坤', '未', 1, 22, 3],
    },
    {
      scope: 'day' as const,
      date: new Date(2026, 6, 11, 14, 35),
      expected: [708056963, '阳遁', 35, '卯', '坤', '巳', '辰', 25, 28, 1],
    },
    {
      scope: 'hour' as const,
      date: new Date(2026, 6, 11, 14, 35),
      expected: [8496683552, '阴遁', 56, '坤', '卯', '辰', '丑', 15, 12, 12],
    },
  ];

  for (const fixture of fixtures) {
    const result = generateTaiyi({ scope: fixture.scope, date: fixture.date });
    assert.deepEqual(
      [
        result.accumulatedValue,
        result.yinYang,
        result.bureau,
        result.taiyiPosition,
        result.wenChangPosition,
        result.shiJiPosition,
        result.jiShenPosition,
        result.lordCount,
        result.guestCount,
        result.setCount,
      ],
      fixture.expected,
      `${fixture.scope}:${fixture.date.toISOString()}`,
    );
  }
});

test('太乙四计应严格区分年参数和日期参数', () => {
  assert.throws(
    () => generateTaiyi({ scope: 'year', year: 2026, date: new Date(2026, 0, 1) }),
    /只接受 year/,
  );
  assert.throws(() => generateTaiyi({ scope: 'month' }), /需要提供有效日期和时间/);
  assert.throws(
    () => generateTaiyi({ scope: 'day', year: 2025, date: new Date(2026, 0, 1) }),
    /year 与 date 的公历年份不一致/,
  );
});

test('太乙月计应按逐月节气换局，不能跟随农历朔日提前或延后', () => {
  const beforeLichun = generateTaiyi({
    scope: 'month',
    date: new Date(2024, 1, 4, 16, 26),
  });
  const afterLichun = generateTaiyi({
    scope: 'month',
    date: new Date(2024, 1, 4, 16, 28),
  });
  assert.equal(afterLichun.accumulatedValue, beforeLichun.accumulatedValue + 1);
  assert.equal(beforeLichun.ganZhi, '乙丑');
  assert.equal(afterLichun.ganZhi, '丙寅');

  const beforeJingzhe = generateTaiyi({
    scope: 'month',
    date: new Date(2024, 2, 5, 10, 22),
  });
  const afterJingzhe = generateTaiyi({
    scope: 'month',
    date: new Date(2024, 2, 5, 10, 24),
  });
  assert.equal(afterJingzhe.accumulatedValue, beforeJingzhe.accumulatedValue + 1);
  assert.equal(beforeJingzhe.ganZhi, '丙寅');
  assert.equal(afterJingzhe.ganZhi, '丁卯');

  const beforeLeapMonth = generateTaiyi({
    scope: 'month',
    date: new Date(2025, 6, 24, 12),
  });
  const leapMonthStart = generateTaiyi({
    scope: 'month',
    date: new Date(2025, 6, 25, 12),
  });
  const leapMonthBeforeLiqiu = generateTaiyi({
    scope: 'month',
    date: new Date(2025, 7, 7, 0),
  });
  const leapMonthAfterLiqiu = generateTaiyi({
    scope: 'month',
    date: new Date(2025, 7, 8, 0),
  });
  const nextLunarMonth = generateTaiyi({
    scope: 'month',
    date: new Date(2025, 7, 23, 12),
  });
  assert.equal(leapMonthStart.accumulatedValue, beforeLeapMonth.accumulatedValue);
  assert.equal(leapMonthAfterLiqiu.accumulatedValue, leapMonthBeforeLiqiu.accumulatedValue + 1);
  assert.equal(nextLunarMonth.accumulatedValue, leapMonthAfterLiqiu.accumulatedValue);
  assert.match(afterLichun.model.precision, /月计按逐月节气换局/);
  assert.equal(
    afterLichun.model.sources[0]?.url,
    'https://www.shidianguji.com/book/SK1615/chapter/1l9lir71oidda',
  );
  assert.match(afterLichun.evidenceAnalysis.promptText, /月计按逐月节气换局/);
});

test('太乙长短算按十一分界，和算结合门将审断', () => {
  const guidance = evaluateTaiyiTacticGuidance({
    lordCount: 10,
    guestCount: 11,
    guestNature: '阴中重阳',
  });
  assert.match(guidance, /主算10，为短算，传统取急而浅为/);
  assert.match(guidance, /客算11（阴中重阳），为长算，传统取缓而深入/);
  assert.match(guidance, /三门具否、五将发否、阴阳和否/);
  assert.match(guidance, /吉凶条件相等时/);
  const harmony = evaluateTaiyiTacticGuidance({
    lordCount: 12,
    guestCount: 16,
    lordNature: '下和',
    guestNature: '下和',
  });
  assert.match(harmony, /主算12（下和）/);
  assert.match(harmony, /客算16（下和）/);
  assert.doesNotMatch(harmony, /调停|和解|不战屈人/);
  const result = generateTaiyi({ year: 2026 });
  assert.ok(result.prompt.includes(result.tacticGuidance));
});

test('太乙积时在公元九十九年与一百年交接连续', () => {
  const before = new Date(0);
  before.setFullYear(99, 11, 31);
  before.setHours(22, 0, 0, 0);
  const after = new Date(before);
  after.setDate(after.getDate() + 1);
  after.setHours(0);
  const first = generateTaiyi({ scope: 'hour', date: before });
  const second = generateTaiyi({ scope: 'hour', date: after });
  assert.equal(second.accumulatedValue, first.accumulatedValue + 1);
  const firstDay = generateTaiyi({ scope: 'day', date: before });
  const secondDay = generateTaiyi({ scope: 'day', date: after });
  assert.equal(secondDay.accumulatedValue, firstDay.accumulatedValue + 1);
});

test('太乙拒绝原型属性计式和非日期对象', () => {
  for (const scope of ['toString', 'constructor', '__proto__']) {
    assert.throws(() => generateTaiyi({ scope, year: 2026 } as never), /太乙计式无效/);
  }
  for (const date of [null, {}, { getTime: () => 0 }, '2026-01-01']) {
    assert.throws(() => generateTaiyi({ scope: 'day', date } as never), /太乙日期无效/);
  }
});

test('太乙时计在夏至与冬至交接秒切换阴阳遁', () => {
  const fixtures = [
    { date: new Date(2026, 5, 21, 16, 24, 30), before: '阳遁', after: '阴遁' },
    { date: new Date(2025, 11, 21, 23, 3, 5), before: '阴遁', after: '阳遁' },
  ];
  for (const { date: after, before: beforeDun, after: afterDun } of fixtures) {
    const before = new Date(after.getTime() - 1000);
    assert.equal(generateTaiyi({ scope: 'hour', date: before }).yinYang, beforeDun);
    assert.equal(generateTaiyi({ scope: 'hour', date: after }).yinYang, afterDun);
  }
});

test('太乙阴遁七十二局按金镜式经九八七六四三二一逆行', () => {
  // 《太乙金镜式经》卷三阴局立成：每三局居一宫，二十四局一周。
  const palaceOrder = [9, 8, 7, 6, 4, 3, 2, 1];
  const positions = ['巽', '子', '坤', '酉', '卯', '艮', '午', '乾'];
  const bureaus = new Set<number>();
  for (let step = 0; step < 72; step += 1) {
    const result = generateTaiyi({ scope: 'hour', date: new Date(2026, 6, 1, step * 2) });
    const index = Math.floor((result.bureau - 1) / 3) % 8;
    assert.equal(result.yinYang, '阴遁');
    assert.equal(result.taiyiPalace, palaceOrder[index], `阴遁第${result.bureau}局`);
    assert.equal(result.taiyiPosition, positions[index]);
    assert.ok(result.prompt.includes(`太乙在${positions[index]}（第${palaceOrder[index]}宫`));
    bureaus.add(result.bureau);
  }
  assert.equal(bureaus.size, 72);
});
