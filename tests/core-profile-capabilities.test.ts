import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  BirthProfileError,
  birthProfileToZiweiChartInput,
  birthProfileToAstrolabeInput,
  birthProfileToAlmanacParticipant,
  birthProfileToBaziPerson,
  birthProfileToQizhengInput,
  calculateBaziFromBirthProfile,
  normalizeBirthProfile,
  resolveBirthProfileLocation,
} from '../packages/core/src/profile/index';
import {
  SYSTEM_CAPABILITY_IDS,
  getCapabilities,
  getSystemCapability,
  requireSystemCapability,
} from '../packages/core/src/capabilities/index';

test('秒级出生精度应保留到各排盘适配器', () => {
  const profile = {
    gender: 'female' as const,
    calendarType: 'solar' as const,
    year: 1990,
    month: 5,
    day: 15,
    hour: 12,
    minute: 34,
    second: 56,
    location: { longitude: 116.4, latitude: 39.9, timezone: 8 },
  };
  const normalized = normalizeBirthProfile(profile);
  assert.equal(normalized.timePrecision, 'second');
  assert.equal(normalized.timeEvidence.inputFact.clockTime, '12:34:56');
  assert.equal(birthProfileToBaziPerson(profile).birthSecond, 56);
  assert.equal(birthProfileToAstrolabeInput(profile).second, '56');
  assert.equal(birthProfileToQizhengInput(profile).second, 56);
  assert.equal(birthProfileToAlmanacParticipant(profile).birthSecond, '56');
  assert.deepEqual(birthProfileToZiweiChartInput(profile).birthTime, {
    hour: 12,
    minute: 34,
    second: 56,
  });
  const { second: _second, ...minuteProfile } = profile;
  const minuteNormalized = normalizeBirthProfile(minuteProfile);
  assert.equal(minuteNormalized.timePrecision, 'minute');
  assert.equal(minuteNormalized.timeEvidence.inputFact.clockTime, '12:34');
  assert.equal(birthProfileToAstrolabeInput(minuteProfile).second, undefined);
});

test('统一出生档案向星盘与七政保留同一坐标精度及实际坐标', () => {
  const base = {
    gender: 'male' as const,
    calendarType: 'solar' as const,
    year: 1990,
    month: 5,
    day: 15,
    hour: 12,
    minute: 0,
  };
  const cases = [
    [{ regionId: '710246' }, 'province-approximation'],
    [{ regionId: '110101' }, 'administrative-center'],
    [{ longitude: 120.3, latitude: 22.6, timezone: 8 }, 'user-provided'],
    [{ regionId: '110101', latitude: 40 }, 'mixed'],
  ] as const;

  for (const [location, expectedAccuracy] of cases) {
    const profile = { ...base, location };
    const normalized = normalizeBirthProfile(profile);
    const qizheng = birthProfileToQizhengInput(profile);
    const astrolabe = birthProfileToAstrolabeInput(profile);
    assert.equal(normalized.resolvedLocation?.coordinateAccuracy, expectedAccuracy);
    assert.equal(qizheng.coordinateAccuracy, expectedAccuracy);
    assert.equal(astrolabe.coordinateAccuracy, expectedAccuracy);
    assert.equal(qizheng.longitude, normalized.resolvedLocation?.longitude);
    assert.equal(qizheng.latitude, normalized.resolvedLocation?.latitude);
    assert.equal(qizheng.longitude, Number(astrolabe.longitude));
    assert.equal(qizheng.latitude, Number(astrolabe.latitude));
  }
});

test('统一出生档案缺少时间时应在排盘前拒绝', () => {
  const profile = {
    gender: 'female' as const,
    calendarType: 'solar' as const,
    year: 1990,
    month: 5,
    day: 15,
  };
  assert.throws(
    () => normalizeBirthProfile(profile as never),
    (error: unknown) =>
      error instanceof BirthProfileError &&
      error.code === 'TIME_REQUIRED' &&
      error.message === '请提供明确的出生时辰，或完整的出生小时和分钟。',
  );
});

test('自定义出生坐标缺少时区时应拒绝，行政区仍可使用已知时区', () => {
  assert.throws(
    () =>
      normalizeBirthProfile({
        gender: 'female',
        calendarType: 'solar',
        year: 1990,
        month: 5,
        day: 15,
        hour: 12,
        minute: 0,
        location: null as never,
      }),
    /出生地点必须是地点资料对象/,
  );
  assert.throws(
    () =>
      normalizeBirthProfile({
        gender: 'female',
        calendarType: 'solar',
        year: 1990,
        month: 5,
        day: 15,
        hour: 12,
        minute: 0,
        location: { name: '纽约', longitude: -74.006, latitude: 40.7128 },
      }),
    (error: unknown) =>
      error instanceof BirthProfileError &&
      error.code === 'TIMEZONE_REQUIRED' &&
      error.field === 'location.timezone',
  );
  assert.equal(resolveBirthProfileLocation({ regionId: '110101' })?.timezone, 8);
  assert.throws(() => resolveBirthProfileLocation(null as never), /出生地点必须是地点资料对象/);
  assert.throws(
    () => resolveBirthProfileLocation({ longitude: Number.NaN, timezone: 8 }),
    /出生地经度需在 -180 到 180 之间/,
  );
  assert.throws(
    () => resolveBirthProfileLocation({ longitude: -74.006, latitude: 91, timezone: -5 }),
    /出生地纬度需在 -90 到 90 之间/,
  );
  assert.throws(
    () => resolveBirthProfileLocation({ longitude: -74.006, timezone: Number.POSITIVE_INFINITY }),
    /时区需在 -12 到 14 之间/,
  );
  assert.throws(
    () => resolveBirthProfileLocation({ longitude: -74.006, timeZoneId: ' ' }),
    /IANA 时区名不能为空/,
  );
  assert.throws(
    () =>
      resolveBirthProfileLocation({
        regionId: '999999',
        longitude: 116.5,
        latitude: 40,
        timezone: 8,
      }),
    (error: unknown) =>
      error instanceof BirthProfileError &&
      error.code === 'LOCATION_NOT_FOUND' &&
      error.field === 'location.regionId',
  );
  assert.equal(
    resolveBirthProfileLocation({ longitude: -74.006, timeZoneId: 'America/New_York' })?.timezone,
    undefined,
  );
});

test('普通出生钟表时间在 IANA 跳时与回拨边界须先确定唯一瞬时', () => {
  const profile = {
    gender: 'female' as const,
    calendarType: 'solar' as const,
    year: 2024,
    month: 3,
    day: 10,
    hour: 2,
    minute: 30,
    location: { longitude: -74.006, latitude: 40.7128, timeZoneId: 'America/New_York' },
  };
  assert.throws(() => normalizeBirthProfile(profile), /当地钟表时间.*不存在/);
  assert.throws(() => birthProfileToBaziPerson(profile), /当地钟表时间.*不存在/);
  assert.throws(() => calculateBaziFromBirthProfile(profile), /当地钟表时间.*不存在/);
  assert.throws(() => birthProfileToZiweiChartInput(profile), /当地钟表时间.*不存在/);

  const repeated = { ...profile, month: 11, day: 3, hour: 1 };
  assert.throws(() => normalizeBirthProfile(repeated), /回拨歧义/);
  const first = normalizeBirthProfile({
    ...repeated,
    location: { ...repeated.location, timezone: -4 },
  });
  const second = normalizeBirthProfile({
    ...repeated,
    location: { ...repeated.location, timezone: -5 },
  });
  assert.deepEqual(first.solarClockTime, second.solarClockTime);
  assert.equal(first.timeIndex, second.timeIndex);
  assert.throws(
    () =>
      normalizeBirthProfile({
        ...repeated,
        location: { ...repeated.location, timezone: -6 },
      }),
    /历史偏移不一致/,
  );
});

test('统一出生档案应保留传统时辰并返回时间口径结构化证据', () => {
  const profile = {
    name: '时辰样例',
    gender: 'female' as const,
    calendarType: 'solar' as const,
    year: 1990,
    month: 5,
    day: 15,
    timeIndex: 6,
  };

  const normalized = normalizeBirthProfile(profile);
  const baziInput = birthProfileToBaziPerson(profile);
  const participant = birthProfileToAlmanacParticipant(profile);

  assert.equal(normalized.timeInputMode, 'traditional-shichen');
  assert.equal(normalized.timePrecision, 'shichen');
  assert.equal(normalized.timeIndex, 6);
  assert.equal(normalized.timeEvidence.status, '已确定');
  assert.equal(normalized.timeEvidence.inputFact.status, '明确传统时辰');
  assert.equal(normalized.timeEvidence.selectedShichen.name, '午时');
  assert.equal(normalized.timeEvidence.summaryFact.status, '已按明确传统时辰确定');
  assert.deepEqual(
    normalized.timeEvidence.calculationChain,
    normalized.timeEvidence.calculationSteps.map((item) => item.promptText),
  );
  assert.match(normalized.timeEvidence.promptText, /明确传统时辰可直接用于八字、紫微/);
  assert.match(normalized.timeEvidence.promptText, /代表时刻不等于精确出生分钟记录/);
  assert.doesNotMatch(
    normalized.timeEvidence.promptText,
    /候选时辰[^或]*：|敏感性结果[^或]*：|缺时柱命盘[^或]*：|成功率[：=]?\s*\d|事件概率[：=]?\s*\d/,
  );
  assert.equal(baziInput.timeIndex, 6);
  assert.equal(baziInput.birthHour, undefined);
  assert.equal(baziInput.birthMinute, undefined);
  assert.equal(participant.timeIndex, '6');
});

test('分钟级算法不得把传统时辰代表值当作精准出生时间', () => {
  const profile = {
    gender: 'female' as const,
    calendarType: 'solar' as const,
    year: 1990,
    month: 5,
    day: 15,
    timeIndex: 6,
    location: { longitude: 116.4, latitude: 39.9, timezone: 8 },
  };

  assert.throws(
    () => birthProfileToAstrolabeInput(profile),
    (error: unknown) =>
      error instanceof BirthProfileError &&
      error.code === 'PRECISE_TIME_REQUIRED' &&
      error.message === '星盘必须提供精确到分钟的出生时间，不能使用传统时辰代表值。',
  );
  assert.throws(
    () => birthProfileToQizhengInput(profile),
    (error: unknown) =>
      error instanceof BirthProfileError &&
      error.code === 'PRECISE_TIME_REQUIRED' &&
      error.message === '七政四余必须提供精确到分钟的出生时间，不能使用传统时辰代表值。',
  );
  assert.throws(
    () => normalizeBirthProfile({ ...profile, useTrueSolarTime: true }),
    (error: unknown) =>
      error instanceof BirthProfileError &&
      error.code === 'PRECISE_TIME_REQUIRED' &&
      error.message === '真太阳时必须提供完整的出生小时和分钟，不能使用传统时辰代表值。',
  );
});

test('单独出生秒数不能与传统时辰拼接为虚构的精确出生时刻', () => {
  assert.throws(
    () =>
      normalizeBirthProfile({
        gender: 'male',
        calendarType: 'solar',
        year: 2024,
        month: 2,
        day: 4,
        timeIndex: 6,
        second: 59,
      }),
    (error: unknown) =>
      error instanceof BirthProfileError &&
      error.code === 'PRECISE_TIME_REQUIRED' &&
      error.field === 'second',
  );
});

test('同时提供时辰与精准时分时必须保持一致', () => {
  assert.throws(
    () =>
      normalizeBirthProfile({
        gender: 'male',
        calendarType: 'solar',
        year: 1990,
        month: 5,
        day: 15,
        hour: 10,
        minute: 30,
        timeIndex: 6,
      }),
    (error: unknown) =>
      error instanceof BirthProfileError &&
      error.code === 'TIME_INPUT_CONFLICT' &&
      /不一致/.test(error.message),
  );

  const normalized = normalizeBirthProfile({
    gender: 'male',
    calendarType: 'solar',
    year: 1990,
    month: 5,
    day: 15,
    hour: 10,
    minute: 30,
    timeIndex: 5,
  });
  assert.equal(normalized.timeInputMode, 'precise-clock-time');
  assert.equal(normalized.timeIndex, 5);
});

test('统一出生档案应向八字、星盘和七政四余透传 IANA 历史时区', () => {
  const profile = {
    name: '纽约历史时区样例',
    gender: 'male' as const,
    calendarType: 'solar' as const,
    year: 2024,
    month: 7,
    day: 1,
    hour: 12,
    minute: 0,
    location: {
      longitude: -74.006,
      latitude: 40.7128,
      timeZoneId: 'America/New_York',
    },
    useTrueSolarTime: true,
  };

  const normalized = normalizeBirthProfile(profile);
  const baziInput = birthProfileToBaziPerson(profile);
  const astrolabeInput = birthProfileToAstrolabeInput(profile);
  const qizhengInput = birthProfileToQizhengInput(profile);
  const chart = calculateBaziFromBirthProfile(profile);

  assert.equal(normalized.resolvedLocation?.timezone, undefined);
  assert.equal(normalized.resolvedLocation?.timeZoneId, 'America/New_York');
  assert.equal(normalized.trueSolarEvidence?.timezoneEvidence?.resolvedOffsetHours, -4);
  assert.equal(baziInput.timezone, undefined);
  assert.equal(baziInput.timeZoneId, 'America/New_York');
  assert.equal(baziInput.birthLongitude, -74.006);
  assert.equal(baziInput.useTrueSolarTime, true);
  assert.equal(astrolabeInput.timezone, undefined);
  assert.equal(astrolabeInput.timeZoneId, 'America/New_York');
  assert.equal(astrolabeInput.longitude, '-74.006');
  assert.equal(astrolabeInput.latitude, '40.7128');
  assert.equal(astrolabeInput.useTrueSolarTime, true);
  assert.equal(normalized.trueSolarEvidence?.summaryFact.status, '证据链完整');
  assert.equal(qizhengInput.timezone, undefined);
  assert.equal(qizhengInput.timeZoneId, 'America/New_York');
  assert.equal(chart.timing?.timezone, -4);
  assert.equal(chart.timing?.timeZoneId, 'America/New_York');
  assert.equal(chart.timing?.evidence.timezoneEvidence?.resolvedOffsetHours, -4);
});

test('农历统一档案启用真太阳时应只换算一次，并保留时区', () => {
  const profile = {
    name: '农历真太阳时样例',
    gender: 'female' as const,
    calendarType: 'lunar' as const,
    year: 1990,
    month: 5,
    day: 15,
    hour: 10,
    minute: 30,
    isLeapMonth: false,
    location: { longitude: 75, timezone: 5.5 },
    useTrueSolarTime: true,
  };

  const normalized = normalizeBirthProfile(profile);
  const person = birthProfileToBaziPerson(profile);
  assert.equal(person.isLunar, false);
  assert.equal(person.isLeapMonth, false);
  // 香港天文台 1990 年日期对照表：农历五月十五为公历 6 月 7 日。
  // https://www.hko.gov.hk/tc/gts/time/calendar/text/files/T1990c.txt
  assert.deepEqual(normalized.solarClockTime, {
    year: 1990,
    month: 6,
    day: 7,
    hour: 10,
    minute: 30,
    second: 0,
  });
  assert.deepEqual([person.year, person.month, person.day], [1990, 6, 7]);
  assert.equal(person.timezone, 5.5);

  const fromProfile = calculateBaziFromBirthProfile(profile);
  assert.equal(fromProfile.timing?.timezone, 5.5);
  assert.equal(fromProfile.timing?.standardMeridian, 82.5);
});

test('统一出生档案可生成真太阳时后的紫微传统盘输入', () => {
  const profile = {
    name: '跨日样例',
    gender: 'male' as const,
    calendarType: 'solar' as const,
    year: 1990,
    month: 5,
    day: 15,
    hour: 0,
    minute: 5,
    location: { longitude: 75, latitude: 30, timezone: 8 },
    useTrueSolarTime: true,
  };
  const normalized = normalizeBirthProfile(profile);
  const input = birthProfileToZiweiChartInput(profile);

  assert.equal(input.dateType, 'solar');
  assert.equal(input.isLeapMonth, false);
  assert.equal(input.birthTimeIndex, normalized.timeIndex);
  assert.equal(
    input.birthDate,
    `${normalized.effectiveTime.year}-${String(normalized.effectiveTime.month).padStart(2, '0')}-${String(normalized.effectiveTime.day).padStart(2, '0')}`,
  );
  assert.equal(input.trueSolarEvidence?.summaryFact.status, '证据链完整');
});

test('农历精确出生档案透传秒时仍保留农历日期口径', () => {
  const input = birthProfileToZiweiChartInput({
    name: '农历精确秒样例',
    gender: 'female',
    calendarType: 'lunar',
    year: 2024,
    month: 1,
    day: 1,
    hour: 13,
    minute: 57,
    second: 16,
  });

  assert.equal(input.dateType, 'lunar');
  assert.equal(input.birthDate, '2024-01-01');
  assert.deepEqual(input.birthTime, { hour: 13, minute: 57, second: 16 });
});

test('择日适配器保持真太阳时跨日后的日期与时辰一致', () => {
  const participant = birthProfileToAlmanacParticipant({
    name: '跨日样例',
    gender: 'female',
    calendarType: 'solar',
    year: 1990,
    month: 5,
    day: 15,
    hour: 0,
    minute: 5,
    location: { longitude: 75, timezone: 8 },
    useTrueSolarTime: true,
  });

  assert.equal(participant.dateType, 'solar');
  assert.equal(participant.day, '14');
  assert.equal(participant.timeIndex, '11');
});

test('能力清单可序列化且返回副本', () => {
  assert.equal(Object.isFrozen(SYSTEM_CAPABILITY_IDS), true);
  assert.equal(Reflect.set(SYSTEM_CAPABILITY_IDS, '0', '__probe__'), false);
  assert.equal(SYSTEM_CAPABILITY_IDS[0], 'calendar.trueSolarBirth');

  const first = getCapabilities();
  const second = getCapabilities();
  assert.equal(first.package, 'mingyu-core');
  assert.deepEqual(
    first.systems.map((item) => item.id),
    SYSTEM_CAPABILITY_IDS,
    '能力 ID 常量必须与能力清单保持一致',
  );
  assert.doesNotThrow(() => JSON.stringify(first));
  for (const capability of first.systems) {
    if (capability.defaultMethod) {
      assert.ok(
        capability.methods?.some((method) => method.value === capability.defaultMethod),
        `${capability.name} 的默认方法不在方法清单中`,
      );
    }
  }

  first.systems[0]!.name = '已修改';
  assert.notEqual(second.systems[0]!.name, '已修改');
  const capabilityCache = new Map<string, ReturnType<typeof getSystemCapability>>();
  const readCapabilityOnce = (systemId: string) => {
    if (!capabilityCache.has(systemId)) {
      capabilityCache.set(systemId, getSystemCapability(systemId));
    }
    return capabilityCache.get(systemId);
  };
  const findInput = (systemId: string, inputId: string) =>
    readCapabilityOnce(systemId)?.inputs.find((input) => input.id === inputId);

  const trueSolarBirth = readCapabilityOnce('calendar.trueSolarBirth');
  assert.equal(findInput('calendar.trueSolarBirth', 'date'), undefined);
  assert.doesNotMatch(JSON.stringify(trueSolarBirth), /纪元年|目标公元年/);
  assert.equal(
    trueSolarBirth?.inputs.some((input) => input.id === 'profile'),
    false,
  );
  for (const inputId of ['dateType', 'year', 'month', 'day', 'hour', 'minute', 'longitude']) {
    assert.equal(findInput('calendar.trueSolarBirth', inputId)?.required, true);
  }

  const astronomicalTime = readCapabilityOnce('calendar.astronomicalTime');
  assert.equal(
    astronomicalTime?.inputs.some((input) => input.id === 'localDateTime'),
    false,
  );
  for (const inputId of ['year', 'month', 'day']) {
    assert.equal(findInput('calendar.astronomicalTime', inputId)?.required, true);
  }

  const bazhai = readCapabilityOnce('bazhai');
  assert.equal(
    bazhai?.inputs.some((input) => input.id === 'profile'),
    false,
  );
  assert.equal(findInput('bazhai', 'birthYear')?.required, false);
  assert.equal(findInput('bazhai', 'mingGua')?.required, false);
  assert.equal(findInput('bazhai', 'doorToInteriorDegree')?.required, false);

  const residential = readCapabilityOnce('residential');
  assert.equal(
    residential?.inputs.some((input) => input.id === 'profile'),
    false,
  );
  for (const inputId of ['birthYear', 'gender', 'mingGua', 'year', 'sitMountain']) {
    assert.ok(findInput('residential', inputId), `住宅风水应声明 ${inputId} 输入`);
  }

  const almanac = readCapabilityOnce('almanac');
  assert.equal(almanac?.supports.birthTimeRequired, false);
  assert.equal(almanac?.supports.birthTimeModes, undefined);
  assert.equal(almanac?.methods, undefined);

  const liuren = readCapabilityOnce('liuren');
  assert.equal(liuren?.methods, undefined);
  assert.deepEqual(
    findInput('liuren', 'template')?.options?.map((item) => item.value),
    ['general', 'ganqing', 'shiye', 'caifu'],
  );

  const tarot = readCapabilityOnce('tarot');
  assert.equal(tarot?.methods, undefined);
  assert.ok(findInput('tarot', 'manualCards'));
  assert.ok(findInput('tarot', 'interactiveSamples'));

  const lenormand = readCapabilityOnce('lenormand');
  assert.equal(lenormand?.methods, undefined);
  assert.deepEqual(
    findInput('lenormand', 'spread')?.options?.map((item) => item.value),
    ['single', 'three', 'five', 'relationship', 'decision', 'nine', 'element', 'grandTableau'],
  );
  assert.ok(findInput('lenormand', 'manualCardIds'));
  assert.ok(findInput('lenormand', 'interactiveSamples'));

  const jinkoujue = readCapabilityOnce('jinkoujue');
  assert.ok(jinkoujue?.methods?.some((item) => item.value === 'branch'));
  assert.deepEqual(findInput('jinkoujue', 'branch')?.requiredWhen, { method: 'branch' });
  assert.deepEqual(
    findInput('jinkoujue', 'branch')?.options?.map((item) => item.value),
    ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'],
  );

  const ssgw = readCapabilityOnce('ssgw');
  assert.ok(ssgw?.methods?.some((item) => item.value === 'manual'));
  assert.deepEqual(findInput('ssgw', 'number')?.requiredWhen, { method: 'manual' });
  assert.doesNotMatch(ssgw?.outputs.join('\n') ?? '', /掷筊/);

  assert.equal(readCapabilityOnce('calendar.moonPhase')?.optionalDependencies, undefined);
  assert.equal(readCapabilityOnce('astrolabe')?.optionalDependencies, undefined);
  assert.deepEqual(readCapabilityOnce('ziwei')?.optionalDependencies, ['iztro']);
  assert.equal(readCapabilityOnce('bazi')?.supports.birthTimeRequired, true);
  assert.deepEqual(readCapabilityOnce('bazi')?.supports.birthTimeModes, [
    'traditional-shichen',
    'precise-clock-time',
  ]);
  assert.deepEqual(readCapabilityOnce('astrolabe')?.supports.birthTimeModes, [
    'precise-clock-time',
  ]);
  const qizheng = readCapabilityOnce('qizheng');
  assert.equal(qizheng?.available, true);
  assert.equal(qizheng?.supports.trueSolarTime, true);
  assert.equal(qizheng?.supports.birthTimeRequired, true);
  assert.deepEqual(qizheng?.supports.birthTimeModes, ['precise-clock-time']);
  assert.ok(qizheng?.outputs.includes('七政四余十一星'));
  assert.ok(qizheng?.outputs.includes('二十八宿真实距星边界'));
  assert.ok(qizheng?.outputs.includes('位置来源与精度分层'));
  assert.equal(
    readCapabilityOnce('xuankong')?.inputs.some((input) => input.id === 'guaType'),
    true,
  );
  assert.equal(
    readCapabilityOnce('residential')?.inputs.some((input) => input.id === 'guaType'),
    true,
  );
  for (const systemId of ['xuankong', 'residential']) {
    const capability = readCapabilityOnce(systemId);
    assert.match(capability?.outputs.join('\n') ?? '', /替卦/);
    assert.match(capability?.notes?.join('\n') ?? '', /兼向/);
  }
  for (const systemId of ['calendar.trueSolarBirth', 'bazi', 'ziwei', 'astrolabe']) {
    assert.ok(
      readCapabilityOnce(systemId)?.outputs.some((item) => item.includes('真太阳时结构化计算链')),
      `${systemId} 应声明真太阳时结构化证据输出`,
    );
  }
  assert.ok(readCapabilityOnce('calendar.astronomicalTime')?.outputs.includes('ΔT与近似JD(TT)'));
  assert.ok(readCapabilityOnce('calendar.moonPhase')?.outputs.includes('前后朔弦望求根事件'));
  assert.ok(readCapabilityOnce('calendar.solarTerm')?.outputs.includes('历表与模型差值核验'));
  assert.equal(readCapabilityOnce('calendar.solarTerm')?.supports.batch, true);
  assert.equal(readCapabilityOnce('calendar.trueSolarBirth')?.supports.trueSolarTime, true);
  assert.equal(readCapabilityOnce('calendar.solarIllumination')?.supports.trueSolarTime, false);
  assert.ok(
    readCapabilityOnce('calendar.solarIllumination')?.outputs.includes('民用、航海与天文曙暮光'),
  );
  assert.equal(requireSystemCapability('bazi').id, 'bazi');
  assert.throws(
    () => requireSystemCapability('unknown'),
    (error: unknown) =>
      error instanceof Error &&
      'code' in error &&
      error.code === 'CAPABILITY_NOT_FOUND' &&
      'category' in error &&
      error.category === 'validation',
  );
  const liuyao = readCapabilityOnce('liuyao');
  assert.equal(liuyao?.supports.seed, true);
  assert.equal(liuyao?.supports.replay, true);
  assert.ok(liuyao?.methods?.some((item) => item.value === 'coins'));
  const packageJson = JSON.parse(
    readFileSync(new URL('../packages/core/package.json', import.meta.url), 'utf8'),
  ) as { version: string };
  assert.equal(first.version, packageJson.version, '能力清单版本必须与核心包版本一致');
});
