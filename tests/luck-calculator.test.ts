import test from 'node:test';
import assert from 'node:assert/strict';
import { ChildLimit, Gender, SolarTime } from 'tyme4ts';
import { baziCalculator } from '@core/bazi/baziCalculator';
import { TIME_MAP } from '@core/bazi/baziDisplayData';
import { buildLuckDirectionProfile } from '@core/bazi/luckDetails';

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

function collectExpectedXiaoyunByAge(
  year: number,
  month: number,
  day: number,
  timeIndex: number,
  gender: 'male' | 'female',
  ages: number[],
) {
  const hour = TIME_MAP[timeIndex]?.hour;
  if (typeof hour !== 'number') {
    throw new Error(`无效的时辰索引：${timeIndex}`);
  }

  const solarTime = SolarTime.fromYmdHms(year, month, day, hour, 0, 0);
  const childLimit = ChildLimit.fromSolarTime(
    solarTime,
    gender === 'male' ? Gender.MAN : Gender.WOMAN,
  );
  const startFortune = childLimit.getStartFortune();
  const startAge = startFortune.getAge();

  return new Map(ages.map((age) => [age, startFortune.next(age - startAge).getName()] as const));
}

function collectExpectedDayun(
  year: number,
  month: number,
  day: number,
  timeIndex: number,
  gender: 'male' | 'female',
  count: number,
) {
  const hour = TIME_MAP[timeIndex]?.hour;
  if (typeof hour !== 'number') {
    throw new Error(`无效的时辰索引：${timeIndex}`);
  }

  const solarTime = SolarTime.fromYmdHms(year, month, day, hour, 0, 0);
  const childLimit = ChildLimit.fromSolarTime(
    solarTime,
    gender === 'male' ? Gender.MAN : Gender.WOMAN,
  );
  const firstDayun = childLimit.getStartDecadeFortune();

  return {
    startTime: childLimit.getEndTime(),
    cycles: Array.from({ length: count }, (_, index) => {
      const dayun = firstDayun.next(index);
      return {
        age: dayun.getStartAge(),
        ganZhi: dayun.getName(),
      };
    }),
  };
}

test('男命小运序列应与 tyme4ts 官方 Fortune 保持一致', () => {
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
  const expected = collectExpectedXiaoyunByAge(
    input.year,
    input.month,
    input.day,
    input.timeIndex,
    input.gender,
    [1, 2, 8, 9, 10, 18, 19],
  );

  expected.forEach((name, age) => {
    assert.equal(actual.get(age), name, `年龄 ${age} 的小运应为 ${name}`);
  });
});

test('女命小运序列应与 tyme4ts 官方 Fortune 保持一致', () => {
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
  const expected = collectExpectedXiaoyunByAge(
    input.year,
    input.month,
    input.day,
    input.timeIndex,
    input.gender,
    [1, 2, 5, 6, 7, 15, 16],
  );

  expected.forEach((name, age) => {
    assert.equal(actual.get(age), name, `年龄 ${age} 的小运应为 ${name}`);
  });
});

test('男命大运序列和交运时间应与 tyme4ts 官方 DecadeFortune 保持一致', () => {
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
  const expected = collectExpectedDayun(
    input.year,
    input.month,
    input.day,
    input.timeIndex,
    input.gender,
    4,
  );
  const dayunCycles = result.luckInfo.cycles.filter((cycle) => !cycle.isXiaoyun).slice(0, 4);
  const expectedStartTime = {
    year: expected.startTime.getYear(),
    month: expected.startTime.getMonth(),
    day: expected.startTime.getDay(),
    hour: expected.startTime.getHour(),
    minute: expected.startTime.getMinute(),
    second: expected.startTime.getSecond(),
  };

  assert.deepEqual(
    dayunCycles.map((cycle) => ({ age: cycle.age, ganZhi: cycle.ganZhi })),
    expected.cycles,
  );
  assert.deepEqual(dayunCycles[0]?.startSolarTime, expectedStartTime);
  assert.ok(!result.luckInfo.startInfo.includes('计算失败'));
  assert.ok(dayunCycles.length > 0);
});

test('女命大运逆行序列应与 tyme4ts 官方 DecadeFortune 保持一致', () => {
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
  const expected = collectExpectedDayun(
    input.year,
    input.month,
    input.day,
    input.timeIndex,
    input.gender,
    4,
  );
  const dayunCycles = result.luckInfo.cycles.filter((cycle) => !cycle.isXiaoyun).slice(0, 4);

  assert.deepEqual(
    dayunCycles.map((cycle) => ({ age: cycle.age, ganZhi: cycle.ganZhi })),
    expected.cycles,
  );
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
