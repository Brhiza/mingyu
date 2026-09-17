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
  const parts = beijingParts(timestamp);
  const pillars = getGanZhiFromDate(
    new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second),
  );
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
