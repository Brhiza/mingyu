import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateBirthChartBundle,
  type BirthChartBundleOptions,
  type BirthProfile,
} from 'mingyu-core/birth';
import {
  BirthProfileError,
  birthProfileToAstrolabeInput,
  birthProfileToBaziPerson,
  birthProfileToQizhengInput,
  birthProfileToZiweiChartInput,
  normalizeBirthProfile,
} from 'mingyu-core/profile';

const profile: BirthProfile = {
  name: '统一档案样例',
  gender: 'male',
  calendarType: 'solar',
  year: 1990,
  month: 5,
  day: 15,
  hour: 10,
  minute: 30,
  location: {
    name: '北京',
    longitude: 116.4,
    latitude: 39.9,
    timezone: 8,
  },
  useTrueSolarTime: true,
};

test('统一出生档案 Bundle 应共享同一套真太阳时输入并生成多种盘面', async () => {
  const bundle = await calculateBirthChartBundle(profile, {
    systems: ['bazi', 'astrolabe', 'qizheng'],
  });

  assert.deepEqual(bundle.systems, ['bazi', 'astrolabe', 'qizheng']);
  assert.equal(bundle.bazi?.pillars.hour.zhi, '巳');
  assert.equal(bundle.astrolabe?.birth.isTrueSolarTime, true);
  assert.equal(bundle.inputs.qizheng?.useTrueSolarTime, true);
  const input = bundle.inputs.qizheng!;
  assert.deepEqual(
    [input.year, input.month, input.day, input.hour, input.minute],
    [1990, 5, 15, 10, 30],
  );
  assert.equal(bundle.qizheng?.calculationContext.localDateTime, '1990-05-15T10:30:00');
  assert.equal(bundle.qizheng?.calculationContext.utcDateTime, '1990-05-15T02:30:00.000Z');
});

test('出生档案真太阳时选项须为布尔值，标准时与校正时辰保持各自口径', async () => {
  const input: BirthProfile = {
    ...profile,
    year: 2024,
    month: 2,
    day: 4,
    hour: 16,
    minute: 30,
    location: { longitude: 75, latitude: 40, timezone: 8 },
  };
  for (const [useTrueSolarTime, timeIndex] of [
    [false, 8],
    [true, 7],
  ] as const) {
    const person = birthProfileToBaziPerson({ ...input, useTrueSolarTime });
    assert.equal(person.useTrueSolarTime, useTrueSolarTime);
    assert.equal(person.timeIndex, timeIndex);
    assert.equal(
      birthProfileToZiweiChartInput({ ...input, useTrueSolarTime }).birthTimeIndex,
      timeIndex,
    );
  }
  for (const flag of ['false', 'true', 0, 1, null]) {
    const invalid = { ...input, useTrueSolarTime: flag } as never;
    assert.throws(() => normalizeBirthProfile(invalid), /useTrueSolarTime 必须是布尔值/);
    await assert.rejects(
      () => calculateBirthChartBundle(invalid, { systems: ['bazi', 'ziwei'] }),
      /useTrueSolarTime 必须是布尔值/,
    );
  }
});

test('单点多系统排盘锁定出生资料和规则，异步计算期间不混入后续改动', async () => {
  const mutableProfile: BirthProfile = {
    ...profile,
    location: { ...profile.location },
  };
  const options: BirthChartBundleOptions = {
    systems: ['ziwei', 'astrolabe'],
    ziwei: {
      scopes: ['origin'],
      skipAnalysis: true,
      horoscopeContext: { dateStr: '2025-01-01', hourIndex: 6 },
    },
  };
  const pending = calculateBirthChartBundle(mutableProfile, options);
  mutableProfile.name = '事后改名';
  mutableProfile.year = 1991;
  mutableProfile.location!.longitude = 120;
  options.ziwei!.scopes![0] = 'yearly';

  const bundle = await pending;
  if ('range' in bundle) assert.fail('应返回单点排盘');
  assert.equal(bundle.profile.name, '统一档案样例');
  assert.equal(bundle.normalized.profile.year, 1990);
  assert.equal(bundle.inputs.ziwei?.birthDate, '1990-05-15');
  assert.equal(bundle.inputs.astrolabe?.year, '1990');
  assert.equal(bundle.normalized.resolvedLocation?.longitude, 116.4);
  assert.ok(bundle.ziwei?.payloadByScope.origin);
});

test('中国夏令时普通模式应为传统盘回拨并给天文盘保留原始钟表时间', () => {
  const summerProfile: BirthProfile = {
    ...profile,
    year: 1988,
    month: 7,
    day: 1,
    hour: 0,
    minute: 30,
    useTrueSolarTime: false,
    location: { ...profile.location, timezone: undefined, timeZoneId: 'Asia/Shanghai' },
  };
  const normalized = normalizeBirthProfile(summerProfile);
  const bazi = birthProfileToBaziPerson(summerProfile);
  const ziwei = birthProfileToZiweiChartInput(summerProfile);
  const astrolabe = birthProfileToAstrolabeInput(summerProfile);
  const qizheng = birthProfileToQizhengInput(summerProfile);

  assert.deepEqual(normalized.effectiveTime, {
    year: 1988,
    month: 6,
    day: 30,
    hour: 23,
    minute: 30,
    second: 0,
  });
  assert.equal(normalized.usedChinaDstCorrection, true);
  assert.match(normalized.timeEvidence.calculationChain.join('；'), /1988-06-30T15:30:00\.000Z/);
  assert.equal(bazi.birthHour, 0);
  assert.equal(ziwei.birthDate, '1988-06-30');
  assert.deepEqual(ziwei.birthTime, { hour: 23, minute: 30, second: 0 });
  assert.deepEqual(
    [astrolabe.year, astrolabe.month, astrolabe.day, astrolabe.hour],
    ['1988', '7', '1', '0'],
  );
  assert.deepEqual([qizheng.year, qizheng.month, qizheng.day, qizheng.hour], [1988, 7, 1, 0]);
});

test('出生 Bundle 不以传统时辰代表时刻生成七政四余精确星体位置', async () => {
  const traditionalProfile: BirthProfile = {
    ...profile,
    hour: undefined,
    minute: undefined,
    timeIndex: 6,
    useTrueSolarTime: false,
  };
  await assert.rejects(
    calculateBirthChartBundle(traditionalProfile, { systems: ['qizheng'] }),
    (error: unknown) =>
      error instanceof Error && 'code' in error && error.code === 'PRECISE_TIME_REQUIRED',
  );
});

test('出生 Bundle 默认只计算八字，避免无意触发可选紫微依赖', async () => {
  const bundle = await calculateBirthChartBundle({ ...profile, useTrueSolarTime: false });

  assert.deepEqual(bundle.systems, ['bazi']);
  assert.ok(bundle.bazi);
  assert.equal(bundle.ziwei, undefined);
  assert.equal(bundle.astrolabe, undefined);
  assert.equal(bundle.qizheng, undefined);
});

test('统一出生档案应能只按行政区代码补全地点与坐标', () => {
  const normalized = normalizeBirthProfile({
    ...profile,
    location: { regionId: '110101' },
  });

  assert.equal(normalized.resolvedLocation?.name, '北京市 东城区');
  assert.equal(normalized.resolvedLocation?.longitude, 116.416334);
  assert.equal(normalized.resolvedLocation?.latitude, 39.928359);
  assert.equal(normalized.resolvedLocation?.timezone, 8);
  assert.equal(normalized.resolvedLocation?.coordinateAccuracy, 'administrative-center');
});

test('统一出生档案混用显式坐标与行政中心坐标时应保留精度来源', () => {
  const mixed = normalizeBirthProfile({
    ...profile,
    location: { regionId: '110101', longitude: 116.5 },
  });
  const provided = normalizeBirthProfile({
    ...profile,
    location: { regionId: '110101', longitude: 116.5, latitude: 40 },
  });

  assert.equal(mixed.resolvedLocation?.longitude, 116.5);
  assert.equal(mixed.resolvedLocation?.latitude, 39.928359);
  assert.equal(mixed.resolvedLocation?.coordinateAccuracy, 'mixed');
  assert.equal(provided.resolvedLocation?.coordinateAccuracy, 'user-provided');
});

test('统一出生档案缺少完整出生地时不生成七政四余默认北京盘', async () => {
  const withoutLocation: BirthProfile = {
    ...profile,
    location: undefined,
    useTrueSolarTime: false,
  };
  assert.equal(normalizeBirthProfile(withoutLocation).resolvedLocation, undefined);
  assert.throws(
    () => birthProfileToQizhengInput(withoutLocation),
    (error: unknown) =>
      error instanceof BirthProfileError &&
      error.code === 'LATITUDE_REQUIRED' &&
      error.field === 'location.latitude',
  );
  await assert.rejects(
    calculateBirthChartBundle(withoutLocation, { systems: ['qizheng'] }),
    (error: unknown) => error instanceof BirthProfileError && error.code === 'LATITUDE_REQUIRED',
  );
  assert.throws(
    () =>
      birthProfileToQizhengInput({
        ...withoutLocation,
        location: { longitude: 87.6, timezone: 8 },
      }),
    (error: unknown) => error instanceof BirthProfileError && error.code === 'LATITUDE_REQUIRED',
  );
  const regionOnly = birthProfileToQizhengInput({
    ...withoutLocation,
    location: { regionId: '110101' },
  });
  assert.equal(regionOnly.latitude, 39.928359);
  assert.equal(regionOnly.longitude, 116.416334);
});
