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
      error.message === '请提供完整的出生小时和分钟。',
  );
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
  assert.equal(first.version, '0.1.20');
  assert.ok(first.systems.length >= 10);
  assert.doesNotThrow(() => JSON.stringify(first));

  first.systems[0]!.name = '已修改';
  assert.notEqual(second.systems[0]!.name, '已修改');
  assert.equal(getSystemCapability('bazhai')?.inputs[1]?.id, 'doorToInteriorDegree');
  assert.equal(getSystemCapability('bazi')?.supports.birthTimeRequired, true);
  for (const systemId of ['calendar.trueSolarBirth', 'bazi', 'ziwei', 'astrolabe']) {
    assert.ok(
      getSystemCapability(systemId)?.outputs.some((item) => item.includes('真太阳时结构化计算链')),
      `${systemId} 应声明真太阳时结构化证据输出`,
    );
  }
  const liuyao = getSystemCapability('liuyao');
  assert.equal(liuyao?.supports.seed, true);
  assert.equal(liuyao?.supports.replay, true);
  assert.ok(liuyao?.methods?.some((item) => item.value === 'coins'));
  const packageJson = JSON.parse(
    readFileSync(new URL('../packages/core/package.json', import.meta.url), 'utf8'),
  ) as { version: string };
  assert.equal(first.version, packageJson.version, '能力清单版本必须与核心包版本一致');
});

test('小六壬随机起课支持统一种子与自定义随机源', () => {
  const date = new Date('2026-07-11T08:00:00+08:00');
  const first = generateXiaoliuren({ method: 'random', customDate: date, seed: '固定样例' });
  const second = generateXiaoliuren({ method: 'random', customDate: date, seed: '固定样例' });
  const custom = generateXiaoliuren({ method: 'random', customDate: date, random: () => 0 });

  assert.deepEqual(first.sequence, second.sequence);
  assert.equal(custom.sequence.start.name, '大安');
});
