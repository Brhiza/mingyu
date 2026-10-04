import assert from 'node:assert/strict';
import test from 'node:test';

import { createMingyuClient } from 'mingyu-core/client';
import type { BirthProfile } from 'mingyu-core/profile';
import { getZodiacYearFortune } from 'mingyu-core/zodiac';

const profile: BirthProfile = {
  name: '客户端样例',
  gender: 'female',
  calendarType: 'solar',
  year: 1992,
  month: 8,
  day: 18,
  timeIndex: 6,
};

test('统一客户端应提供出生盘、占法、能力发现和稳定序列化', async () => {
  const client = createMingyuClient();
  const birth = await client.birth(profile);
  const divination = client.divination({
    method: 'meihua',
    question: '统一客户端是否正常？',
    divinationTime: '2026-08-06T12:00:00+08:00',
    meihua: { method: 'number', number: 86 },
  });

  assert.ok(birth.bazi);
  assert.equal(birth.inputs?.bazi?.shenShaVariants, undefined);
  assert.equal(divination.method, 'meihua');
  assert.equal(client.capability('bazi').id, 'bazi');
  assert.ok(client.capabilities().systems.length > 10);
  assert.equal(client.serialize({ b: 2, a: 1 }), '{"a":1,"b":2}');
});

test('统一客户端太乙时计保留阴九、十局的客算与将参', () => {
  const client = createMingyuClient();
  for (const [instant, bureau, taiyiPalace, shiJiPosition, guestCount, general, assistant] of [
    ['2026-06-25T08:30:00Z', 9, 7, '酉', 33, 3, 9],
    ['2026-06-25T10:30:00Z', 10, 6, '乾', 34, 4, 2],
  ] as const) {
    const result = client.taiyi({ scope: 'hour', date: new Date(instant) });
    assert.equal(result.yinYang, '阴遁');
    assert.equal(result.bureau, bureau);
    assert.equal(result.taiyiPalace, taiyiPalace);
    assert.equal(result.shiJiPosition, shiJiPosition);
    assert.equal(result.guestCount, guestCount);
    assert.equal(result.guestGeneral, general);
    assert.equal(result.guestAssistant, assistant);
  }
});

test('统一客户端太乙定算与逐宫定目同值', () => {
  const client = createMingyuClient();
  const cases = [
    { input: { scope: 'year', year: 1998 }, bureau: 27, count: 24, general: 4, assistant: 2 },
    {
      input: { scope: 'hour', date: new Date('2026-06-25T16:30:00Z') },
      bureau: 13,
      count: 13,
      general: 3,
      assistant: 9,
    },
  ] as const;
  for (const { input, bureau, count, general, assistant } of cases) {
    const result = client.taiyi(input);
    assert.equal(result.bureau, bureau);
    assert.equal(result.setCount, count);
    assert.equal(result.setGeneral, general);
    assert.equal(result.setAssistant, assistant);
  }
});

test('统一客户端八字结果保留真实出生钟表且传统时辰不生成精确钟表', async () => {
  const client = createMingyuClient();
  const birthProfile: BirthProfile = {
    gender: 'male',
    calendarType: 'solar',
    year: 1988,
    month: 6,
    day: 1,
    hour: 0,
    minute: 30,
    second: 42,
    applyChinaDst: true,
    location: { longitude: 116.4, latitude: 39.9, timezone: 8 },
  };
  const precise = await client.birth(birthProfile, { systems: ['bazi'] });
  assert.deepEqual(precise.bazi?.birthClockTime, {
    year: 1988,
    month: 6,
    day: 1,
    hour: 0,
    minute: 30,
    second: 42,
  });
  assert.deepEqual(precise.bazi?.solarDate, { year: 1988, month: 5, day: 31 });
  assert.deepEqual(
    JSON.parse(client.serialize(precise.bazi)).birthClockTime,
    precise.bazi?.birthClockTime,
  );

  const traditional = await client.birth(
    { ...birthProfile, hour: undefined, minute: undefined, second: undefined, timeIndex: 1 },
    { systems: ['bazi'] },
  );
  assert.equal(traditional.bazi?.birthClockTime, undefined);
});

test('统一客户端应提供无性别的即时排盘与安全调用', async () => {
  const client = createMingyuClient();
  const request = {
    type: 'bazi' as const,
    customDate: new Date('2026-08-24T12:30:00+08:00'),
    timeStandard: 'beijing' as const,
  };
  const instant = await client.instant(request);
  assert.equal(instant.type, 'bazi');
  assert.equal('gender' in instant.result, false);

  const safe = await client.safe.instant(request);
  assert.equal(safe.ok, true);
  if (safe.ok) assert.equal(safe.data.timeStandard, 'beijing');
});

test('safe 客户端应返回可判别、可序列化的成功和失败结果', async () => {
  const client = createMingyuClient();
  const success = await client.safe.birth(profile);
  assert.equal(success.ok, true);
  if (success.ok) assert.ok(success.data.bazi);

  const failure = await client.safe.birth({ ...profile, timeIndex: undefined });
  assert.equal(failure.ok, false);
  if (!failure.ok) {
    assert.equal(failure.error.category, 'validation');
    assert.equal(failure.error.code, 'TIME_REQUIRED');
    assert.doesNotThrow(() => JSON.stringify(failure));
  }

  const serializationFailure = client.safe.serialize({ value: Number.NaN });
  assert.equal(serializationFailure.ok, false);
  if (!serializationFailure.ok) {
    assert.equal(serializationFailure.error.code, 'NON_FINITE_NUMBER');
  }
});

test('统一客户端应直接提供前端常用的时间、环境与轻量排盘能力', () => {
  const client = createMingyuClient();
  const normalized = client.normalizeBirth(profile);
  const trueSolarBirth = client.trueSolarBirth({
    dateType: 'solar',
    year: 1992,
    month: 8,
    day: 18,
    hour: 12,
    minute: 0,
    longitude: 116.4,
    timezone: 8,
  });
  const astronomicalTime = client.astronomicalTime({
    year: 1992,
    month: 8,
    day: 18,
    hour: 12,
    timezone: 8,
  });
  const moonPhase = client.moonPhase('2026-08-06T04:00:00.000Z');
  const solarTerm = client.solarTerm(2026, 14);
  const solarTerms = client.solarTerms(2026);
  const solarIllumination = client.solarIllumination({
    year: 2026,
    month: 8,
    day: 6,
    hour: 12,
    latitude: 39.9,
    longitude: 116.4,
    timezone: 8,
  });
  const bazhai = client.bazhai({ birthYear: 1992, gender: 'female', sitMountain: '子' });
  const bazhaiByDoorDegree = client.bazhaiByDoorDegree({
    birthYear: 1992,
    gender: 'female',
    doorToInteriorDegree: 0,
    northReference: 'true',
  });
  const taiyi = client.taiyi({ year: 2026, scope: 'year' });
  const qizheng = client.qizheng({
    year: 1992,
    month: 8,
    day: 18,
    hour: 12,
    minute: 0,
    latitude: 39.9,
    longitude: 116.4,
    timezone: 8,
  });
  const xuankong = client.xuankong({ year: 2026, sitMountain: '子' });
  const residential = client.residentialFengshui({
    year: 2026,
    birthYear: 1992,
    gender: 'female',
    sitMountain: '子',
  });

  assert.equal(normalized.timeIndex, 6);
  assert.equal(trueSolarBirth.inputDateType, 'solar');
  assert.equal(astronomicalTime.status, '已计算');
  assert.equal(moonPhase.status, '已计算');
  assert.equal(solarTerm.status, '历表已采用并独立核验');
  assert.equal(solarTerms.length, 24);
  assert.equal(solarTerms[0]?.utcDateTime.slice(0, 4), '2026');
  assert.equal(solarTerms.at(-1)?.utcDateTime.slice(0, 4), '2026');
  assert.equal(solarIllumination.status, '已计算');
  assert.equal(solarIllumination.localDate, '2026-08-06');
  assert.equal(bazhai.houseGua, '坎');
  assert.equal(bazhaiByDoorDegree.directionMeasurement.sitMountain, '子');
  assert.equal(taiyi.scope, 'year');
  assert.equal(qizheng.stars.length, 11);
  assert.equal(xuankong.sitMountain, '子');
  assert.ok(residential.bazhai);
  assert.ok(residential.xuankong);
});

test('客户端在夸贾林重复民用日分别保留两次中午的昼生结果', () => {
  const client = createMingyuClient();
  const base = {
    year: 1969,
    month: 9,
    day: 30,
    hour: 12,
    latitude: 8.7167,
    longitude: 167.7333,
    timeZoneId: 'Pacific/Kwajalein',
  };
  for (const [timezone, utcDateTime] of [
    [11, '1969-09-30T01:00:00.000Z'],
    [-12, '1969-10-01T00:00:00.000Z'],
  ] as const) {
    const input = { ...base, timezone };
    const illumination = client.solarIllumination(input);
    const chart = client.qizheng(input);
    assert.equal(Date.parse(illumination.referenceUtcDateTime), Date.parse(utcDateTime));
    assert.equal(chart.calculationContext.utcDateTime, utcDateTime);
    assert.equal(
      Date.parse(chart.calculationContext.solarIllumination.referenceUtcDateTime),
      Date.parse(utcDateTime),
    );
    assert.equal(chart.enNan?.sect, '昼生');
  }
});

test('客户端可计算阿皮亚跳日前的有效民用日并拒绝跳过日', () => {
  const client = createMingyuClient();
  const input = {
    year: 2011,
    month: 12,
    day: 29,
    hour: 12,
    latitude: -13.8333,
    longitude: -171.75,
    timeZoneId: 'Pacific/Apia',
  };
  const illumination = client.solarIllumination(input);
  const chart = client.qizheng(input);
  assert.equal(illumination.localDate, '2011-12-29');
  assert.equal(chart.calculationContext.solarIllumination.localDate, '2011-12-29');
  assert.equal(chart.enNan?.sect, '昼生');
  assert.throws(() => client.solarIllumination({ ...input, day: 30 }));
});

test('月相客户端只接受明确时区的有效时间文本', () => {
  const client = createMingyuClient();
  const utc = client.moonPhase('2026-08-06T04:00:00.000Z');
  const offset = client.moonPhase('2026-08-06T12:00:00+08:00');
  assert.equal(offset.utcDateTime, utc.utcDateTime);

  for (const value of ['2026-08-06T04:00:00', '2026-08-06', '2026-02-30T04:00:00Z']) {
    assert.throws(() => client.moonPhase(value), /UTC 时间文本必须是带 Z 或明确偏移/);
    const safe = client.safe.moonPhase(value);
    assert.equal(safe.ok, false);
    if (!safe.ok) assert.equal(safe.error.category, 'validation');
  }
});

test('safe 同步方法应保持同步，并区分校验、不支持和边界错误', () => {
  const client = createMingyuClient();
  const success = client.safe.zodiac({ zodiac: '子', year: 2026 });
  assert.equal(success.ok, true);
  assert.equal(success instanceof Promise, false);

  const validation = client.safe.bazhai({});
  assert.equal(validation.ok, false);
  if (!validation.ok) {
    assert.equal(validation.error.code, 'INPUT_VALIDATION_FAILED');
    assert.equal(validation.error.category, 'validation');
    assert.equal(validation.error.recoverable, true);
  }

  const unknownCapability = client.safe.capability('unknown' as never);
  assert.equal(unknownCapability.ok, false);
  if (!unknownCapability.ok) {
    assert.equal(unknownCapability.error.code, 'CAPABILITY_NOT_FOUND');
    assert.equal(unknownCapability.error.category, 'validation');
    assert.equal(unknownCapability.error.field, 'id');
    assert.doesNotThrow(() => JSON.stringify(unknownCapability));
  }

  const unsupported = client.safe.divination({
    method: 'unknown' as never,
    question: '测试不支持的占法',
  });
  assert.equal(unsupported.ok, false);
  if (!unsupported.ok) {
    assert.equal(unsupported.error.code, 'OPERATION_UNSUPPORTED');
    assert.equal(unsupported.error.category, 'unsupported');
    assert.equal(unsupported.error.recoverable, false);
  }

  const boundary = client.safe.bazhaiByDoorDegree({
    mingGua: '坎',
    doorToInteriorDegree: 7.5,
    northReference: 'true',
  });
  assert.equal(boundary.ok, false);
  if (!boundary.ok) {
    assert.equal(boundary.error.code, 'INPUT_BOUNDARY_AMBIGUOUS');
    assert.equal(boundary.error.category, 'boundary');
    assert.equal(boundary.error.recoverable, true);
  }
});

test('生肖流年便捷入口应支持生肖、地支、公历年和指定干支', () => {
  const client = createMingyuClient();
  const fromName = client.zodiac({ zodiac: '鼠', year: 2026 });
  const fromBranch = client.zodiac({ zodiac: '子', year: 2026 });
  const fromGanZhi = client.zodiac({ zodiac: '鼠', yearGanZhi: ' 甲子 ' });

  assert.deepEqual(fromName, fromBranch);
  assert.deepEqual(fromName, getZodiacYearFortune('子', '丙午'));
  assert.deepEqual(fromGanZhi, getZodiacYearFortune('子', '甲子'));
  assert.match(fromName.prompt, /太岁关系：冲太岁（生肖年支子与流年年支午相冲）/);
  assert.match(
    fromName.prompt,
    /五行关系：流年年干丙属火，生肖地支子属水，生肖地支本气克年干五行。/,
  );
  assert.doesNotMatch(fromName.prompt, /十神|出生日干/);

  for (const input of [
    { zodiac: '鼠' },
    { zodiac: '猫', year: 2026 },
    { zodiac: '鼠', year: 1899 },
    { zodiac: '鼠', yearGanZhi: '甲午年' },
    { zodiac: '鼠', year: 1900, yearGanZhi: '甲子' },
  ]) {
    const result = client.safe.zodiac(input);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.category, 'validation');
  }
});

test('客户端默认设置可按单次调用覆盖且不会触发未请求的可选系统', async () => {
  const client = createMingyuClient({
    defaults: {
      birth: {
        systems: ['bazi', 'astrolabe'],
        baziRules: { shenShaScope: 'all', shenShaVariants: { referenceProfile: 'classical' } },
      },
    },
  });
  const preciseProfile: BirthProfile = {
    ...profile,
    timeIndex: undefined,
    hour: 12,
    minute: 20,
    location: { name: '北京', longitude: 116.4, latitude: 39.9, timezone: 8 },
  };

  const defaults = await client.birth(preciseProfile);
  assert.ok(defaults.bazi);
  assert.ok(defaults.astrolabe);

  const override = await client.birth(preciseProfile, {
    systems: ['bazi'],
    baziRules: { shenShaVariants: { tongZiScope: 'all-pillars' } },
  });
  assert.deepEqual(override.systems, ['bazi']);
  assert.equal(override.astrolabe, undefined);
  assert.equal(override.inputs?.bazi?.shenShaScope, 'all');
  assert.deepEqual(override.inputs?.bazi?.shenShaVariants, {
    referenceProfile: 'classical',
    tongZiScope: 'all-pillars',
  });
});

test('月相便捷入口应拒绝可被隐式转换成时间戳的非时间输入', () => {
  const client = createMingyuClient();
  for (const value of [true, null, [], { valueOf: () => Date.parse('2026-02-01T00:00:00Z') }]) {
    const result = client.safe.moonPhase(value as never);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.category, 'validation');
  }
});
