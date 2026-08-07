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
} from '../packages/core/src/profile/index';
import { baziCalculator } from '../packages/core/src/bazi/baziCalculator';
import {
  SYSTEM_CAPABILITY_IDS,
  getCapabilities,
  getSystemCapability,
  requireSystemCapability,
} from '../packages/core/src/capabilities/index';

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
    () => normalizeBirthProfile({ ...profile, useTrueSolarTime: true }),
    (error: unknown) =>
      error instanceof BirthProfileError &&
      error.code === 'PRECISE_TIME_REQUIRED' &&
      error.message === '真太阳时必须提供完整的出生小时和分钟，不能使用传统时辰代表值。',
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

test('统一出生档案可复用到八字与星盘输入', () => {
  const profile = {
    name: '测试档案',
    gender: 'male' as const,
    calendarType: 'solar' as const,
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

  const baziInput = birthProfileToBaziPerson(profile);
  const astrolabeInput = birthProfileToAstrolabeInput(profile);
  const normalized = normalizeBirthProfile(profile);
  assert.equal(baziInput.birthLongitude, 116.4);
  assert.equal(baziInput.useTrueSolarTime, true);
  assert.equal(astrolabeInput.longitude, '116.4');
  assert.equal(astrolabeInput.latitude, '39.9');
  assert.equal(astrolabeInput.useTrueSolarTime, true);
  assert.equal(normalized.trueSolarEvidence?.summaryFact.status, '证据链完整');
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
  assert.equal(astrolabeInput.timezone, undefined);
  assert.equal(astrolabeInput.timeZoneId, 'America/New_York');
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
  assert.equal(person.year, normalized.solarClockTime.year);
  assert.equal(person.month, normalized.solarClockTime.month);
  assert.equal(person.day, normalized.solarClockTime.day);
  assert.equal(person.timezone, 5.5);

  const fromProfile = calculateBaziFromBirthProfile(profile);
  const direct = baziCalculator.calculateBazi(person);
  assert.deepEqual(fromProfile.pillars, direct.pillars);
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
  const first = getCapabilities();
  const second = getCapabilities();
  assert.equal(first.package, 'mingyu-core');
  assert.deepEqual(
    first.systems.map((item) => item.id),
    SYSTEM_CAPABILITY_IDS,
    '能力 ID 常量必须与能力清单保持一致',
  );
  assert.ok(first.systems.length >= 10);
  assert.doesNotThrow(() => JSON.stringify(first));

  first.systems[0]!.name = '已修改';
  assert.notEqual(second.systems[0]!.name, '已修改');
  const findInput = (systemId: string, inputId: string) =>
    getSystemCapability(systemId)?.inputs.find((input) => input.id === inputId);

  const trueSolarBirth = getSystemCapability('calendar.trueSolarBirth');
  assert.equal(
    trueSolarBirth?.inputs.some((input) => input.id === 'profile'),
    false,
  );
  for (const inputId of ['dateType', 'year', 'month', 'day', 'hour', 'minute', 'longitude']) {
    assert.equal(findInput('calendar.trueSolarBirth', inputId)?.required, true);
  }

  const astronomicalTime = getSystemCapability('calendar.astronomicalTime');
  assert.equal(
    astronomicalTime?.inputs.some((input) => input.id === 'localDateTime'),
    false,
  );
  for (const inputId of ['year', 'month', 'day']) {
    assert.equal(findInput('calendar.astronomicalTime', inputId)?.required, true);
  }

  const bazhai = getSystemCapability('bazhai');
  assert.equal(
    bazhai?.inputs.some((input) => input.id === 'profile'),
    false,
  );
  assert.equal(findInput('bazhai', 'birthYear')?.required, false);
  assert.equal(findInput('bazhai', 'mingGua')?.required, false);
  assert.equal(findInput('bazhai', 'doorToInteriorDegree')?.required, false);

  const residential = getSystemCapability('residential');
  assert.equal(
    residential?.inputs.some((input) => input.id === 'profile'),
    false,
  );
  for (const inputId of ['birthYear', 'gender', 'mingGua', 'year', 'sitMountain']) {
    assert.ok(findInput('residential', inputId), `住宅风水应声明 ${inputId} 输入`);
  }

  const almanac = getSystemCapability('almanac');
  assert.equal(almanac?.supports.birthTimeRequired, false);
  assert.equal(almanac?.supports.birthTimeModes, undefined);
  assert.equal(almanac?.methods, undefined);

  const liuren = getSystemCapability('liuren');
  assert.equal(liuren?.methods, undefined);
  assert.deepEqual(
    findInput('liuren', 'template')?.options?.map((item) => item.value),
    ['general', 'ganqing', 'shiye', 'caifu'],
  );

  const tarot = getSystemCapability('tarot');
  assert.equal(tarot?.methods, undefined);
  assert.ok(findInput('tarot', 'manualCards'));
  assert.ok(findInput('tarot', 'interactiveSamples'));

  const lenormand = getSystemCapability('lenormand');
  assert.equal(lenormand?.methods, undefined);
  assert.ok(findInput('lenormand', 'manualCardIds'));
  assert.ok(findInput('lenormand', 'interactiveSamples'));

  const ssgw = getSystemCapability('ssgw');
  assert.ok(ssgw?.methods?.some((item) => item.value === 'manual'));
  assert.deepEqual(findInput('ssgw', 'number')?.requiredWhen, { method: 'manual' });
  assert.doesNotMatch(ssgw?.outputs.join('\n') ?? '', /掷筊/);

  assert.equal(getSystemCapability('calendar.moonPhase')?.optionalDependencies, undefined);
  assert.equal(getSystemCapability('astrolabe')?.optionalDependencies, undefined);
  assert.deepEqual(getSystemCapability('ziwei')?.optionalDependencies, ['iztro']);
  assert.equal(getSystemCapability('bazi')?.supports.birthTimeRequired, true);
  assert.deepEqual(getSystemCapability('bazi')?.supports.birthTimeModes, [
    'traditional-shichen',
    'precise-clock-time',
  ]);
  assert.deepEqual(getSystemCapability('astrolabe')?.supports.birthTimeModes, [
    'precise-clock-time',
  ]);
  const qizheng = getSystemCapability('qizheng');
  assert.equal(qizheng?.available, true);
  assert.equal(qizheng?.supports.trueSolarTime, true);
  assert.equal(qizheng?.supports.birthTimeRequired, true);
  assert.deepEqual(qizheng?.supports.birthTimeModes, ['precise-clock-time']);
  assert.ok(qizheng?.outputs.includes('七政四余十一星'));
  assert.ok(qizheng?.outputs.includes('二十八宿真实距星边界'));
  assert.ok(qizheng?.outputs.includes('位置来源与精度分层'));
  assert.equal(
    getSystemCapability('xuankong')?.inputs.some((input) => input.id === 'guaType'),
    false,
  );
  assert.equal(
    getSystemCapability('residential')?.inputs.some((input) => input.id === 'guaType'),
    false,
  );
  for (const systemId of ['xuankong', 'residential']) {
    const capability = getSystemCapability(systemId);
    assert.doesNotMatch(capability?.outputs.join('\n') ?? '', /替卦|兼向/);
    assert.doesNotMatch(capability?.notes?.join('\n') ?? '', /兼向/);
  }
  for (const systemId of ['calendar.trueSolarBirth', 'bazi', 'ziwei', 'astrolabe']) {
    assert.ok(
      getSystemCapability(systemId)?.outputs.some((item) => item.includes('真太阳时结构化计算链')),
      `${systemId} 应声明真太阳时结构化证据输出`,
    );
  }
  assert.ok(getSystemCapability('calendar.astronomicalTime')?.outputs.includes('ΔT与近似JD(TT)'));
  assert.ok(getSystemCapability('calendar.moonPhase')?.outputs.includes('前后朔弦望求根事件'));
  assert.ok(getSystemCapability('calendar.solarTerm')?.outputs.includes('历表与模型差值核验'));
  assert.equal(getSystemCapability('calendar.solarTerm')?.supports.batch, true);
  assert.equal(getSystemCapability('calendar.trueSolarBirth')?.supports.trueSolarTime, true);
  assert.equal(getSystemCapability('calendar.solarIllumination')?.supports.trueSolarTime, false);
  assert.ok(
    getSystemCapability('calendar.solarIllumination')?.outputs.includes('民用、航海与天文曙暮光'),
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
  const liuyao = getSystemCapability('liuyao');
  assert.equal(liuyao?.supports.seed, true);
  assert.equal(liuyao?.supports.replay, true);
  assert.ok(liuyao?.methods?.some((item) => item.value === 'coins'));
  const packageJson = JSON.parse(
    readFileSync(new URL('../packages/core/package.json', import.meta.url), 'utf8'),
  ) as { version: string };
  assert.equal(first.version, packageJson.version, '能力清单版本必须与核心包版本一致');
});
