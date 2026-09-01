import test from 'node:test';
import assert from 'node:assert/strict';
import { baziCalculator } from '@core/bazi/baziCalculator';
import { buildLuckDirectionProfile } from '@core/bazi/luckDetails';
import { CHILD_LIMIT_METHOD } from '@core/bazi/childLimit';

function collectXiaoyunByAge(result: ReturnType<typeof baziCalculator.calculateBazi>) {
  const ageMap = new Map<number, string>();

  result.luckInfo.cycles.forEach((cycle) => {
    cycle.years.forEach((year) => {
      if (year.xiaoyun?.ganZhi && !ageMap.has(year.age)) {
        ageMap.set(year.age, year.xiaoyun.ganZhi);
      }
    });
  });

  return ageMap;
}

test('男命小运序列应符合仓库固定真值', () => {
  const input = {
    year: 1990,
    month: 1,
    day: 1,
    timeIndex: 12,
    gender: 'male' as const,
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  };

  const result = baziCalculator.calculateBazi(input);
  const actual = collectXiaoyunByAge(result);
  const expected = new Map([
    [1, '己亥'],
    [2, '戊戌'],
    [8, '壬辰'],
    [9, '辛卯'],
    [10, '庚寅'],
    [18, '壬午'],
    [19, '辛巳'],
  ]);

  expected.forEach((name, age) => {
    assert.equal(actual.get(age), name, `年龄 ${age} 的小运应为 ${name}`);
  });
});

test('女命小运序列应符合仓库固定真值', () => {
  const input = {
    year: 2012,
    month: 12,
    day: 21,
    timeIndex: 3,
    gender: 'female' as const,
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  };

  const result = baziCalculator.calculateBazi(input);
  const actual = collectXiaoyunByAge(result);
  const expected = new Map([
    [1, '庚寅'],
    [2, '己丑'],
    [5, '丙戌'],
    [6, '乙酉'],
    [7, '甲申'],
    [15, '丙子'],
    [16, '乙亥'],
  ]);

  expected.forEach((name, age) => {
    assert.equal(actual.get(age), name, `年龄 ${age} 的小运应为 ${name}`);
  });
});

test('男命大运序列和交运时间应符合仓库固定真值', () => {
  const input = {
    year: 1990,
    month: 1,
    day: 1,
    timeIndex: 12,
    gender: 'male' as const,
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  };

  const result = baziCalculator.calculateBazi(input);
  const dayunCycles = result.luckInfo.cycles.filter((cycle) => !cycle.isXiaoyun).slice(0, 4);

  assert.deepEqual(
    dayunCycles.map((cycle) => ({ age: cycle.age, ganZhi: cycle.ganZhi })),
    [
      { age: 9, ganZhi: '乙亥' },
      { age: 19, ganZhi: '甲戌' },
      { age: 29, ganZhi: '癸酉' },
      { age: 39, ganZhi: '壬申' },
    ],
  );
  assert.deepEqual(dayunCycles[0]?.startSolarTime, {
    year: 1998,
    month: 7,
    day: 2,
    hour: 17,
    minute: 36,
    second: 0,
  });
  assert.ok(!result.luckInfo.startInfo.includes('计算失败'));
  assert.ok(dayunCycles.length > 0);
});

test('女命大运逆行序列应符合仓库固定真值', () => {
  const input = {
    year: 2012,
    month: 12,
    day: 21,
    timeIndex: 3,
    gender: 'female' as const,
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  };

  const result = baziCalculator.calculateBazi(input);
  const dayunCycles = result.luckInfo.cycles.filter((cycle) => !cycle.isXiaoyun).slice(0, 4);

  assert.deepEqual(
    dayunCycles.map((cycle) => ({ age: cycle.age, ganZhi: cycle.ganZhi })),
    [
      { age: 6, ganZhi: '辛亥' },
      { age: 16, ganZhi: '庚戌' },
      { age: 26, ganZhi: '己酉' },
      { age: 36, ganZhi: '戊申' },
    ],
  );
});

test('三日一岁起运法应符合内部固定样本', () => {
  const cases = [
    {
      input: { year: 1990, month: 1, day: 1, timeIndex: 12, gender: 'male' as const },
      handover: { year: 1998, month: 7, day: 2, hour: 17, minute: 36, second: 0 },
      firstAge: 9,
      firstDayun: '乙亥',
    },
    {
      input: { year: 2012, month: 12, day: 21, timeIndex: 3, gender: 'female' as const },
      handover: { year: 2017, month: 9, day: 13, hour: 16, minute: 8, second: 0 },
      firstAge: 6,
      firstDayun: '辛亥',
    },
  ];

  for (const item of cases) {
    const result = baziCalculator.calculateBazi({
      ...item.input,
      isLunar: false,
      isLeapMonth: false,
      useTrueSolarTime: false,
    });
    const firstDayun = result.luckInfo.cycles.find((cycle) => !cycle.isXiaoyun);
    assert.deepEqual(firstDayun?.startSolarTime, item.handover);
    assert.equal(firstDayun?.age, item.firstAge);
    assert.equal(firstDayun?.ganZhi, item.firstDayun);
  }
  assert.equal(CHILD_LIMIT_METHOD, '按实际节气时刻计算，三日折一年');
});

test('扁平流年数组中的交运年份应去重，并默认以后一步大运为准', () => {
  const result = baziCalculator.calculateBazi({
    year: 1990,
    month: 1,
    day: 1,
    timeIndex: 12,
    gender: 'male',
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });

  const liunian1998 = result.liunian?.filter((item) => item.year === 1998) ?? [];
  const nextCycle1998 = result.luckInfo.cycles[1]?.years.find((item) => item.year === 1998);

  assert.equal(liunian1998.length, 1);
  assert.equal(liunian1998[0]?.xiaoyun?.ganZhi, nextCycle1998?.xiaoyun?.ganZhi);
});

test('周期展示年份与分析年份应分离，交运年只保留在后一步 resolvedYears 中', () => {
  const result = baziCalculator.calculateBazi({
    year: 1990,
    month: 1,
    day: 1,
    timeIndex: 12,
    gender: 'male',
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });

  const childCycle = result.luckInfo.cycles[0];
  const firstDayun = result.luckInfo.cycles[1];

  assert.equal(
    childCycle.years.some((item) => item.year === 1998),
    true,
  );
  assert.equal(
    childCycle.resolvedYears?.some((item) => item.year === 1998),
    false,
  );
  assert.equal(
    firstDayun.years.some((item) => item.year === 1998),
    true,
  );
  assert.equal(
    firstDayun.resolvedYears?.some((item) => item.year === 1998),
    true,
  );
});

test('八字核心计算应先拒绝无效出生日期', () => {
  const baseInput = {
    year: 1990,
    month: 1,
    day: 1,
    timeIndex: 12,
    gender: 'male' as const,
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  };
  const invalidCases: Array<[Partial<typeof baseInput>, RegExp]> = [
    [{ year: 0 }, /出生年份需在 1900-2100 之间/],
    [{ year: 9999 }, /出生年份需在 1900-2100 之间/],
    [{ month: 13 }, /出生月份需在 1-12 之间/],
    [{ day: 31, month: 2, year: 2026 }, /日期需在 1-28 之间/],
    [{ day: 31, month: 1, isLunar: true }, /农历日期需在 1-30 之间/],
  ];

  for (const [overrides, messagePattern] of invalidCases) {
    assert.throws(
      () => baziCalculator.calculateBazi({ ...baseInput, ...overrides }),
      messagePattern,
    );
  }
});

test('八字核心计算应先拒绝非法性别和布尔参数', () => {
  const baseInput = {
    year: 1990,
    month: 1,
    day: 1,
    timeIndex: 12,
    gender: 'male' as const,
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  };

  assert.throws(
    () => baziCalculator.calculateBazi({ ...baseInput, gender: 'unknown' as 'male' }),
    /性别无效/,
  );
  assert.throws(
    () => baziCalculator.calculateBazi({ ...baseInput, isLunar: 'false' as unknown as boolean }),
    /isLunar 必须是布尔值/,
  );
  assert.throws(
    () =>
      baziCalculator.calculateBazi({
        ...baseInput,
        applyChinaDst: 'true' as unknown as boolean,
      }),
    /applyChinaDst 必须是布尔值/,
  );
});

test('八字核心计算应先拒绝越界真太阳时参数', () => {
  const baseInput = {
    year: 1990,
    month: 1,
    day: 1,
    timeIndex: 12,
    gender: 'male' as const,
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: true,
    birthHour: 1,
    birthMinute: 20,
    birthLongitude: 73.5,
  };
  const invalidCases: Array<[Partial<typeof baseInput>, RegExp]> = [
    [{ birthHour: 24 }, /出生小时需在 0-23 之间/],
    [{ birthHour: 1.5 }, /出生小时需在 0-23 之间/],
    [{ birthMinute: 60 }, /出生分钟需在 0-59 之间/],
    [{ birthMinute: 1.5 }, /出生分钟需在 0-59 之间/],
    [{ birthLongitude: 181 }, /出生经度需在 -180 到 180 之间/],
    [{ birthLongitude: Number.NaN }, /出生经度需在 -180 到 180 之间/],
  ];

  for (const [overrides, messagePattern] of invalidCases) {
    assert.throws(
      () => baziCalculator.calculateBazi({ ...baseInput, ...overrides }),
      messagePattern,
    );
  }
});

test('流日计算应先拒绝无效日期', () => {
  assert.throws(() => baziCalculator.calculateLiuri(2026, 2, 31, '甲'), /日期需在 1-28 之间/);
  assert.throws(() => baziCalculator.calculateLiuri(2026, 13, 1, '甲'), /月份需在 1-12 之间/);
  assert.throws(() => baziCalculator.calculateLiuri(1899, 1, 1, '甲'), /年份需在 1900-2100 之间/);
  assert.throws(() => baziCalculator.calculateLiuri(2026, 1, 1, '猫'), /日主无效/);
  assert.throws(() => baziCalculator.calculateLiuyue(2026, 1, '猫'), /日主无效/);
});

test('流日区间计算应先拒绝无效日期字符串和倒置区间', () => {
  assert.throws(
    () => baziCalculator.calculateLiuriRange('2026-02-31', '2026-03-02', '甲'),
    /日期需在 1-28 之间/,
  );
  assert.throws(
    () => baziCalculator.calculateLiuriRange('2026/02/28', '2026-03-02', '甲'),
    /日期格式需为 YYYY-MM-DD/,
  );
  assert.throws(
    () => baziCalculator.calculateLiuriRange('2026-03-02', '2026-02-28', '甲'),
    /开始日期不能晚于结束日期/,
  );
  assert.throws(
    () => baziCalculator.calculateLiuriRange('2026-02-28', '2026-03-02', '猫'),
    /日主无效/,
  );
});

test('大运顺逆说明应拒绝非法性别和非法年干', () => {
  assert.throws(() => buildLuckDirectionProfile('unknown', '甲'), /性别无效/);
  assert.throws(() => buildLuckDirectionProfile('male', '猫'), /年干无效/);
});
