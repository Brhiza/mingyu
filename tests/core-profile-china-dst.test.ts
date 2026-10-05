import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveCivilTime } from '../packages/core/src/calendar/civil-time';
import { CHINA_DST_YEARS } from '../packages/core/src/calendar/china-dst';
import { generateAstrolabe } from '../packages/core/src/divination/algorithms/astrolabe';
import { generateQizheng } from '../packages/core/src/qi_zheng';
import {
  birthProfileToAlmanacParticipant,
  birthProfileToAstrolabeInput,
  birthProfileToBaziPerson,
  birthProfileToQizhengInput,
  birthProfileToZiweiChartInput,
  calculateBaziFromBirthProfile,
  normalizeBirthProfile,
  type BirthProfile,
} from '../packages/core/src/profile';

const location = { longitude: 116.4, latitude: 39.9, timezone: 8 };

function profileAt(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): BirthProfile {
  return {
    gender: 'male',
    calendarType: 'solar',
    year,
    month,
    day,
    hour,
    minute,
    second: 17,
    location,
    useTrueSolarTime: false,
    applyChinaDst: true,
  };
}

function utcFromInput(parts: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}): string {
  return resolveCivilTime({ ...parts, timezone: 8 }).utcDateTime;
}

test('中国夏令时跨日出生：统一档案、八字、紫微、星盘、七政与择日使用同一标准时刻', () => {
  const profile = profileAt(1990, 5, 15, 0, 20);
  const normalized = normalizeBirthProfile(profile);
  const expected = { year: 1990, month: 5, day: 14, hour: 23, minute: 20, second: 17 };
  assert.deepEqual(normalized.solarClockTime, {
    year: 1990,
    month: 5,
    day: 15,
    hour: 0,
    minute: 20,
    second: 17,
  });
  assert.deepEqual(normalized.effectiveTime, expected);
  assert.equal(normalized.usedChinaDstCorrection, true);
  assert.equal(normalized.timeEvidence.selectedShichen.index, normalized.timeIndex);
  assert.match(normalized.timeEvidence.promptText, /1990-05-15 00:20:17回拨60分钟/);
  assert.match(normalized.timeEvidence.promptText, /1990-05-14T15:20:17.000Z/);

  const baziInput = birthProfileToBaziPerson(profile);
  assert.equal(baziInput.applyChinaDst, true);
  assert.equal(baziInput.birthHour, 0);
  assert.equal(baziInput.birthMinute, 20);
  assert.equal(calculateBaziFromBirthProfile(profile).solarDate.day, 14);

  const ziwei = birthProfileToZiweiChartInput(profile);
  assert.equal(ziwei.dateType, 'solar');
  assert.equal(ziwei.birthDate, '1990-05-14');
  assert.deepEqual(ziwei.birthTime, { hour: 23, minute: 20, second: 17 });
  assert.equal(ziwei.birthTimeIndex, normalized.timeIndex);

  const astrolabe = birthProfileToAstrolabeInput(profile);
  const qizheng = birthProfileToQizhengInput(profile);
  assert.equal(
    utcFromInput({
      year: Number(astrolabe.year),
      month: Number(astrolabe.month),
      day: Number(astrolabe.day),
      hour: Number(astrolabe.hour),
      minute: Number(astrolabe.minute),
      second: Number(astrolabe.second),
    }),
    '1990-05-14T15:20:17.000Z',
  );
  assert.equal(utcFromInput(qizheng), '1990-05-14T15:20:17.000Z');
  assert.equal(astrolabe.useTrueSolarTime, false);
  assert.equal(qizheng.useTrueSolarTime, false);
  assert.equal(generateAstrolabe(astrolabe).birth.dateTime, '1990-05-14 23:20:17');
  assert.equal(generateQizheng(qizheng).calculationContext.utcDateTime, '1990-05-14T15:20:17.000Z');

  const participant = birthProfileToAlmanacParticipant(profile);
  assert.equal(participant.dateType, 'solar');
  assert.equal(participant.day, '14');
  assert.equal(participant.birthHour, '23');
  assert.equal(participant.birthSecond, '17');
});

test('1986—1991 真实起止边界只在夏令时有效段校正，跳时和重复时刻拒绝', () => {
  assert.deepEqual(CHINA_DST_YEARS, [1986, 1987, 1988, 1989, 1990, 1991]);
  assert.equal(Object.isFrozen(CHINA_DST_YEARS), true);
  assert.equal(Reflect.set(CHINA_DST_YEARS, '4', 2000), false);
  assert.equal(Reflect.deleteProperty(CHINA_DST_YEARS, '4'), false);
  assert.throws(() => (CHINA_DST_YEARS as unknown as number[]).reverse(), TypeError);
  const cases = [
    [1986, 5, 4, 1, 59, '1986-05-03T17:59:17.000Z'],
    [1986, 5, 4, 3, 0, '1986-05-03T18:00:17.000Z'],
    [1986, 9, 14, 2, 0, '1986-09-13T18:00:17.000Z'],
    [1987, 4, 12, 3, 0, '1987-04-11T18:00:17.000Z'],
    [1987, 9, 13, 2, 0, '1987-09-12T18:00:17.000Z'],
    [1988, 4, 17, 3, 0, '1988-04-16T18:00:17.000Z'],
    [1988, 9, 11, 2, 0, '1988-09-10T18:00:17.000Z'],
    [1989, 4, 16, 3, 0, '1989-04-15T18:00:17.000Z'],
    [1989, 9, 17, 2, 0, '1989-09-16T18:00:17.000Z'],
    [1990, 4, 15, 3, 0, '1990-04-14T18:00:17.000Z'],
    [1990, 9, 16, 2, 0, '1990-09-15T18:00:17.000Z'],
    [1991, 4, 14, 3, 0, '1991-04-13T18:00:17.000Z'],
    [1991, 9, 15, 0, 59, '1991-09-14T15:59:17.000Z'],
    [1991, 9, 15, 2, 0, '1991-09-14T18:00:17.000Z'],
  ] as const;
  for (const [year, month, day, hour, minute, expectedUtc] of cases) {
    const normalized = normalizeBirthProfile(profileAt(year, month, day, hour, minute));
    assert.equal(utcFromInput(normalized.effectiveTime), expectedUtc);
  }
  assert.throws(() => normalizeBirthProfile(profileAt(1986, 5, 4, 2, 30)), /跳时缺口/);
  assert.throws(() => normalizeBirthProfile(profileAt(1991, 9, 15, 1, 30)), /回拨重复时段/);
});

test('中国夏令时未启用时保留钟表时间，已注明传统时辰不伪造分钟校正', () => {
  const profile = profileAt(1990, 5, 15, 0, 20);
  const disabled = normalizeBirthProfile({ ...profile, applyChinaDst: false });
  assert.deepEqual(disabled.effectiveTime, disabled.solarClockTime);
  assert.equal(disabled.usedChinaDstCorrection, false);
  assert.doesNotMatch(disabled.timeEvidence.promptText, /回拨60分钟/);

  const shichen = normalizeBirthProfile({
    ...profile,
    hour: undefined,
    minute: undefined,
    second: undefined,
    timeIndex: 6,
  });
  assert.deepEqual(shichen.effectiveTime, shichen.solarClockTime);
  assert.throws(
    () =>
      normalizeBirthProfile({
        ...profile,
        location: { longitude: 116.4, latitude: 39.9, timeZoneId: 'Asia/Shanghai' },
      }),
    /不能同时启用 applyChinaDst/,
  );
  assert.throws(
    () => normalizeBirthProfile({ ...profile, location: { ...location, timezone: 9 } }),
    /仅适用于东八区/,
  );
});

test('上海 IANA 别名在相同瞬时下采用同一跨日标准出生日期与时辰', () => {
  for (const timeZoneId of ['Asia/Shanghai', 'Asia/Chongqing', 'Asia/Harbin', 'Asia/Chungking']) {
    const profile = {
      ...profileAt(1990, 5, 15, 0, 20),
      applyChinaDst: false,
      location: { longitude: 116.4, timeZoneId },
    };
    const normalized = normalizeBirthProfile(profile);
    assert.deepEqual(
      normalized.effectiveTime,
      {
        year: 1990,
        month: 5,
        day: 14,
        hour: 23,
        minute: 20,
        second: 17,
      },
      timeZoneId,
    );
    assert.equal(normalized.usedChinaDstCorrection, true, timeZoneId);
    assert.equal(normalized.timeIndex, 12, timeZoneId);
    assert.match(normalized.timeEvidence.promptText, /1990-05-14T15:20:17.000Z/);
    const bazi = calculateBaziFromBirthProfile(profile);
    assert.equal(bazi.solarDate.day, 14, timeZoneId);
    assert.equal(bazi.timeInfo.index, 12, timeZoneId);
    const ziwei = birthProfileToZiweiChartInput(profile);
    assert.equal(ziwei.birthDate, '1990-05-14', timeZoneId);
    assert.deepEqual(ziwei.birthTime, { hour: 23, minute: 20, second: 17 }, timeZoneId);
  }
});
