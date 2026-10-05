import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateSolarTermEvidence } from '../packages/core/src/calendar/solar-term-evidence';
import { resolveTrueSolarBirthTime } from '../packages/core/src/calendar/true-solar-time';
import { getGanZhiFromDate } from '../packages/core/src/ganzhi';
import {
  birthProfileToZiweiChartInput,
  normalizeBirthProfile,
  type BirthProfile,
} from '../packages/core/src/profile';
import { buildZiweiChartInput } from '../packages/core/src/ziwei/runtime';
import { buildAstrolabeFromInput, buildBasicInfo } from '../packages/core/src/ziwei/iztro';

const BEIJING_OFFSET = 8 * 60 * 60 * 1_000;

function beijingParts(timestamp: number) {
  const local = new Date(timestamp + BEIJING_OFFSET);
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
    hour: local.getUTCHours(),
    minute: local.getUTCMinutes(),
    second: local.getUTCSeconds(),
  };
}

function profileAt(timestamp: number, gender: 'male' | 'female' = 'male'): BirthProfile {
  return {
    name: '紫微秒级样本',
    gender,
    calendarType: 'solar',
    ...beijingParts(timestamp),
  };
}

function expectedPillars(timestamp: number) {
  const pillars = getGanZhiFromDate(new Date(timestamp));
  return {
    year_pillar: pillars.year,
    month_pillar: pillars.month,
    day_pillar: pillars.day,
    hour_pillar: pillars.hour,
  };
}

test('标准精准出生档案向紫微四柱传递时分秒', () => {
  const timestamp = Date.parse('2024-03-05T02:23:17.000Z');
  const profile = profileAt(timestamp);
  const normalized = normalizeBirthProfile(profile);
  const input = birthProfileToZiweiChartInput(profile);

  assert.deepEqual(input.birthTime, {
    hour: normalized.effectiveTime.hour,
    minute: normalized.effectiveTime.minute,
    second: normalized.effectiveTime.second,
  });
  assert.equal(input.birthTimeIndex, normalized.timeIndex);

  const draftInput = buildZiweiChartInput({
    name: '标准精准样本',
    gender: 'male',
    dateType: 'solar',
    year: String(profile.year),
    month: String(profile.month),
    day: String(profile.day),
    timeIndex: '',
    isLeapMonth: false,
    birthHour: String(profile.hour),
    birthMinute: String(profile.minute),
    birthSecond: String(profile.second),
  });
  assert.deepEqual(draftInput.birthTime, input.birthTime);
  assert.equal(draftInput.birthTimeIndex, input.birthTimeIndex);
});

test('紫微表单入口不得将无效性别静默换成女命盘', () => {
  assert.throws(
    () =>
      buildZiweiChartInput({
        name: '无效性别',
        gender: 'unknown' as 'male',
        dateType: 'solar',
        year: '2000',
        month: '6',
        day: '15',
        timeIndex: 6,
        isLeapMonth: false,
      }),
    /性别必须是 male 或 female/,
  );
});

test('紫微精准普通钟表与出生档案共同处理公农历中国夏令时跨日和秒数', () => {
  // 香港天文台 1990 年公农历对照表：5 月 15 日为四月廿一。
  for (const date of [
    { dateType: 'solar' as const, month: 5, day: 15 },
    { dateType: 'lunar' as const, month: 4, day: 21 },
  ]) {
    for (const zone of [
      { timezone: 8, applyChinaDst: true },
      { timeZoneId: 'Asia/Shanghai' },
      { timeZoneId: 'Asia/Chongqing', timezone: 9 },
    ]) {
      const input = buildZiweiChartInput({
        name: '夏令时跨日样本',
        gender: 'male',
        year: 1990,
        ...date,
        timeIndex: '',
        isLeapMonth: false,
        birthHour: 0,
        birthMinute: 20,
        birthSecond: 17,
        ...zone,
      });
      const profileInput = birthProfileToZiweiChartInput({
        gender: 'male',
        year: 1990,
        calendarType: date.dateType,
        month: date.month,
        day: date.day,
        hour: 0,
        minute: 20,
        second: 17,
        applyChinaDst: zone.applyChinaDst,
        location: { longitude: 116.4, timezone: zone.timezone, timeZoneId: zone.timeZoneId },
      });
      assert.equal(input.dateType, 'solar');
      assert.equal(input.birthDate, '1990-05-14');
      assert.equal(input.isLeapMonth, false);
      assert.equal(input.birthTimeIndex, 12);
      assert.deepEqual(input.birthTime, { hour: 23, minute: 20, second: 17 });
      assert.equal(input.birthDate, profileInput.birthDate);
      assert.deepEqual(input.birthTime, profileInput.birthTime);
    }
  }
});

test('紫微普通钟表核验 IANA 缺口、重复和冲突，非中国时区保持当地钟表', () => {
  const draft = {
    name: '纽约钟表样本',
    gender: 'male' as const,
    dateType: 'solar' as const,
    year: 2024,
    month: 11,
    day: 3,
    timeIndex: '' as const,
    isLeapMonth: false,
    birthHour: 1,
    birthMinute: 30,
    birthSecond: 17,
    timeZoneId: 'America/New_York',
  };
  assert.throws(
    () => buildZiweiChartInput({ ...draft, month: 3, day: 10, birthHour: 2 }),
    /不存在|缺口/,
  );
  assert.throws(() => buildZiweiChartInput(draft), /重复|歧义/);
  assert.throws(
    () => buildZiweiChartInput({ ...draft, month: 7, day: 1, timezone: -5 }),
    /不一致|冲突/,
  );
  assert.throws(() => buildZiweiChartInput({ ...draft, applyChinaDst: true }), /不能同时启用/);
  for (const timezone of [-4, -5]) {
    const input = buildZiweiChartInput({ ...draft, timezone });
    assert.equal(input.birthDate, '2024-11-03');
    assert.deepEqual(input.birthTime, { hour: 1, minute: 30, second: 17 });
    assert.equal(input.birthTimeIndex, 1);
  }
  const fixed = buildZiweiChartInput({ ...draft, timeZoneId: undefined, timezone: 5.75 });
  assert.deepEqual(fixed.birthTime, { hour: 1, minute: 30, second: 17 });
  const lunar = buildZiweiChartInput({
    ...draft,
    year: 1990,
    month: 4,
    day: 21,
    dateType: 'lunar',
    birthHour: 0,
    birthMinute: 20,
    timeZoneId: undefined,
    timezone: 8,
  });
  assert.equal(lunar.dateType, 'lunar');
  assert.equal(lunar.birthDate, '1990-04-21');
  assert.equal(lunar.birthTime?.hour, 0);
});

test('真太阳时精确秒数进入校正证据和紫微出生事实', () => {
  const expected = resolveTrueSolarBirthTime({
    dateType: 'solar',
    year: 1990,
    month: 4,
    day: 15,
    hour: 1,
    minute: 20,
    second: 30,
    longitude: 73.5,
    timezone: 8,
  });
  const input = buildZiweiChartInput({
    name: '真太阳时秒样本',
    gender: 'male',
    dateType: 'solar',
    year: '1990',
    month: '4',
    day: '15',
    timeIndex: '',
    isLeapMonth: false,
    useTrueSolarTime: true,
    birthHour: '1',
    birthMinute: '20',
    birthSecond: '30',
    birthLongitude: '73.5',
    timezone: 8,
  });

  assert.equal(input.birthTime?.second, expected.correctedTime.second);
  assert.equal(input.trueSolarEvidence?.summaryFact.status, '证据链完整');
});

test('出生区间秒点跨节气时由完整秒数决定月柱，传统时辰仍不伪造精准时刻', async () => {
  const term = calculateSolarTermEvidence(2024, 3);
  const beforeTimestamp = term.utcTimestamp - 1_000;
  const beforeProfile = profileAt(beforeTimestamp);
  const atProfile = profileAt(term.utcTimestamp);
  const beforeInput = birthProfileToZiweiChartInput(beforeProfile);
  const atInput = birthProfileToZiweiChartInput(atProfile);
  const beforeBasic = buildBasicInfo(
    await buildAstrolabeFromInput(beforeInput),
    beforeInput.birthTime,
  );
  const atBasic = buildBasicInfo(await buildAstrolabeFromInput(atInput), atInput.birthTime);

  assert.equal(beforeInput.birthTime?.second, beijingParts(beforeTimestamp).second);
  assert.equal(atInput.birthTime?.second, beijingParts(term.utcTimestamp).second);
  assert.notEqual(beforeBasic.four_pillars?.month_pillar, atBasic.four_pillars?.month_pillar);
  assert.deepEqual(beforeBasic.four_pillars, expectedPillars(beforeTimestamp));
  assert.deepEqual(atBasic.four_pillars, expectedPillars(term.utcTimestamp));

  const traditional = birthProfileToZiweiChartInput({
    ...beforeProfile,
    hour: undefined,
    minute: undefined,
    second: undefined,
    timeIndex: beforeInput.birthTimeIndex,
  });
  assert.equal(traditional.birthTime, undefined);
  assert.equal(traditional.birthTimeIndex, beforeInput.birthTimeIndex);
});
