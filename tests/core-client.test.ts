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
  assert.equal(divination.method, 'meihua');
  assert.equal(client.capability('bazi').id, 'bazi');
  assert.ok(client.capabilities().systems.length > 10);
  assert.equal(client.serialize({ b: 2, a: 1 }), '{"a":1,"b":2}');
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
  const zodiac = client.zodiac({ zodiac: '鼠', year: 2026 });
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
  assert.deepEqual(zodiac, getZodiacYearFortune('子', '丙午'));
  assert.equal(taiyi.scope, 'year');
  assert.equal(qizheng.stars.length, 11);
  assert.equal(xuankong.sitMountain, '子');
  assert.ok(residential.bazhai);
  assert.ok(residential.xuankong);
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
    defaults: { birth: { systems: ['bazi', 'astrolabe'] } },
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

  const override = await client.birth(preciseProfile, { systems: ['bazi'] });
  assert.deepEqual(override.systems, ['bazi']);
  assert.equal(override.astrolabe, undefined);
});
