import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  BirthProfileError,
  birthProfileToAstrolabeInput,
  birthProfileToAlmanacParticipant,
  birthProfileToBaziPerson,
  normalizeBirthProfile,
} from '../packages/core/src/profile/index';
import { getCapabilities, getSystemCapability } from '../packages/core/src/capabilities/index';
import { generateXiaoliuren } from '../packages/core/src/divination/algorithms/xiaoliuren';
import { assertPromptIsPortableTaskText } from './prompt-assertions';

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
  assertPromptIsPortableTaskText(normalized.timeEvidence.promptText);
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
  assert.ok(first.systems.length >= 10);
  assert.doesNotThrow(() => JSON.stringify(first));

  first.systems[0]!.name = '已修改';
  assert.notEqual(second.systems[0]!.name, '已修改');
  assert.equal(getSystemCapability('bazhai')?.inputs[1]?.id, 'doorToInteriorDegree');
  assert.equal(getSystemCapability('bazi')?.supports.birthTimeRequired, true);
  assert.deepEqual(getSystemCapability('bazi')?.supports.birthTimeModes, [
    'traditional-shichen',
    'precise-clock-time',
  ]);
  assert.deepEqual(getSystemCapability('astrolabe')?.supports.birthTimeModes, [
    'precise-clock-time',
  ]);
  const qizheng = getSystemCapability('qizheng');
  assert.equal(qizheng?.available, false);
  assert.equal(qizheng?.supports.trueSolarTime, false);
  assert.deepEqual(qizheng?.outputs, ['明确失败信息', '独立紫炁均速研究函数']);
  for (const systemId of ['calendar.trueSolarBirth', 'bazi', 'ziwei', 'astrolabe']) {
    assert.ok(
      getSystemCapability(systemId)?.outputs.some((item) => item.includes('真太阳时结构化计算链')),
      `${systemId} 应声明真太阳时结构化证据输出`,
    );
  }
  assert.ok(getSystemCapability('calendar.astronomicalTime')?.outputs.includes('ΔT与近似JD(TT)'));
  assert.ok(getSystemCapability('calendar.moonPhase')?.outputs.includes('前后朔弦望求根事件'));
  assert.ok(getSystemCapability('calendar.solarTerm')?.outputs.includes('历表与模型差值核验'));
  const liuyao = getSystemCapability('liuyao');
  assert.equal(liuyao?.supports.seed, true);
  assert.equal(liuyao?.supports.replay, true);
  assert.ok(liuyao?.methods?.some((item) => item.value === 'coins'));
  const packageJson = JSON.parse(
    readFileSync(new URL('../packages/core/package.json', import.meta.url), 'utf8'),
  ) as { version: string };
  assert.equal(first.version, packageJson.version, '能力清单版本必须与核心包版本一致');
});

test('小六壬能力清单只公开可核验的时间起课', () => {
  const date = new Date('2026-07-11T08:00:00+08:00');
  const result = generateXiaoliuren({ method: 'time', customDate: date });
  const capability = getSystemCapability('xiaoliuren');

  assert.deepEqual(
    capability?.methods?.map((item) => item.value),
    ['time'],
  );
  assert.equal(capability?.supports.seed, false);
  assert.equal(capability?.supports.replay, false);
  assert.equal(capability?.supports.customRandomSource, false);
  assert.ok(capability?.outputs.includes('时宫主证'));
  assert.equal(result.primary.name, result.sequence.hour.name);
});
