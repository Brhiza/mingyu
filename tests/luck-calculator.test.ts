import test from 'node:test';
import assert from 'node:assert/strict';
import { baziCalculator } from '@core/bazi/baziCalculator';
import { LuckCalculator } from '@core/bazi/LuckCalculator';
import type { LiunianInfo, SolarDateTimeInfo } from '@core/bazi/baziTypes';
import { getTenGod, getTenGodForBranch } from '@core/bazi/baziUtils';
import { buildLuckDirectionProfile } from '@core/bazi/luckDetails';
import { CHILD_LIMIT_METHOD } from '@core/bazi/childLimit';
import { getGanZhiFromDate } from '@core/ganzhi';

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

function calculatePrivateLiunianForCycle(
  cycleStartTime: SolarDateTimeInfo,
  cycleEndTime: SolarDateTimeInfo,
): LiunianInfo[] {
  const calculator = new LuckCalculator() as unknown as {
    calculateLiunianForCycle: (
      cycleStartTime: SolarDateTimeInfo,
      birthYear: number,
      dayMaster: string,
      cycleEndTime: SolarDateTimeInfo,
    ) => LiunianInfo[];
  };
  return calculator.calculateLiunianForCycle(
    cycleStartTime,
    cycleStartTime.year,
    '甲',
    cycleEndTime,
  );
}

function calculatePrivateLiunian(year: number, dayMaster: string) {
  const calculator = new LuckCalculator() as unknown as {
    calculateLiunian: (
      year: number,
      dayMaster: string,
    ) => {
      ganZhi: string;
      tenGod: string;
      tenGodZhi: string;
    };
  };
  return calculator.calculateLiunian(year, dayMaster);
}

test('支持出生范围及后续十二步大运的流年干支应与原年中换算逐年一致', () => {
  // 出生输入支持 1900-2100；立春前仍属上一干支年。三日一岁起运最晚可跨至
  // 出生后第 11 个公历年，十二步大运最后半开区间止于 2231 年立春前，
  // 因而实际可能生成的流年范围为 1899-2230。
  for (let year = 1899; year <= 2230; year++) {
    const legacyGanZhi = getGanZhiFromDate(new Date(year, 5, 1, 12)).year;
    const legacyGan = legacyGanZhi[0];
    const legacyZhi = legacyGanZhi[1];
    const legacy = {
      ganZhi: legacyGanZhi,
      tenGod: getTenGod(legacyGan, '甲'),
      tenGodZhi: getTenGodForBranch(legacyZhi, '甲'),
    };

    assert.deepEqual(calculatePrivateLiunian(year, '甲'), legacy, `${year} 年流年字段应保持一致`);
  }
});

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

test('年中交运按立春年裁剪且交运年只归后一步大运', () => {
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
  const dayunCycles = result.luckInfo.cycles.filter((cycle) => !cycle.isXiaoyun);
  const firstDayun = dayunCycles[0];
  const secondDayun = dayunCycles[1];

  assert.equal(firstDayun.years.at(-1)?.year, 2008);
  assert.equal(firstDayun.resolvedYears?.at(-1)?.year, 2007);
  assert.equal(secondDayun.resolvedYears?.[0]?.year, 2008);

  const resolvedYears = result.luckInfo.cycles.flatMap(
    (cycle) => cycle.resolvedYears?.map((item) => item.year) ?? [],
  );
  assert.equal(new Set(resolvedYears).size, resolvedYears.length);
});

test('立春前交运按实际交运立春年去重，末步不生成无交集流年', () => {
  const result = baziCalculator.calculateBazi({
    year: 1950,
    month: 1,
    day: 1,
    timeIndex: 0,
    gender: 'male',
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });
  const dayunCycles = result.luckInfo.cycles.filter((cycle) => !cycle.isXiaoyun);
  const firstDayun = dayunCycles[0];
  const secondDayun = dayunCycles[1];
  const lastDayun = dayunCycles.at(-1);

  assert.deepEqual(firstDayun.startSolarTime, {
    year: 1958,
    month: 1,
    day: 30,
    hour: 17,
    minute: 42,
    second: 0,
  });
  assert.equal(firstDayun.years[0]?.year, 1957);
  assert.equal(firstDayun.years.at(-1)?.year, 1967);
  assert.equal(firstDayun.resolvedYears?.at(-1)?.year, 1966);
  assert.equal(secondDayun.resolvedYears?.[0]?.year, 1967);
  assert.equal(lastDayun?.years.at(-1)?.year, 2077);
  assert.equal(lastDayun?.resolvedYears?.at(-1)?.year, 2077);
  assert.equal(
    lastDayun?.resolvedYears?.some((item) => item.year === 2078),
    false,
  );

  const resolvedYears = result.luckInfo.cycles.flatMap(
    (cycle) => cycle.resolvedYears?.map((item) => item.year) ?? [],
  );
  assert.equal(new Set(resolvedYears).size, resolvedYears.length);
});

test('流年区间按半开区间处理，结束恰逢立春不含新年且空区间无流年', () => {
  // 固定真值：公开节气证据 calculateSolarTermEvidence(2008, 3) 的
  // UTC 时刻为 2008-02-04T11:00:24.000Z，即北京时间 19:00:24。
  // 测试用稳定边界值验证半开区间，不在测试中直接依赖外部排盘引擎。
  const endAtLichun: SolarDateTimeInfo = {
    year: 2008,
    month: 2,
    day: 4,
    hour: 19,
    minute: 0,
    second: 24,
  };
  const startTime = { ...endAtLichun, year: 1998 };
  const yearsEndingAtLichun = calculatePrivateLiunianForCycle(startTime, endAtLichun);

  assert.equal(yearsEndingAtLichun.length, 10);
  assert.equal(yearsEndingAtLichun[0]?.year, 1998);
  assert.equal(yearsEndingAtLichun.at(-1)?.year, 2007);

  const yearsAfterLichun = calculatePrivateLiunianForCycle(startTime, {
    ...endAtLichun,
    second: endAtLichun.second + 1,
  });
  assert.equal(yearsAfterLichun.length, 11);
  assert.equal(yearsAfterLichun.at(-1)?.year, 2008);

  assert.deepEqual(calculatePrivateLiunianForCycle(endAtLichun, endAtLichun), []);
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
