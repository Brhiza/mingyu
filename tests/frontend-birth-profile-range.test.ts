import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildFrontendBirthProfile,
  hasFrontendBirthRangeInput,
} from '@/lib/full-chart-engine/birth-profile';
import { FRONTEND_DEFAULT_TIME_ZONE_ID } from '@/lib/time-policy';
import { defaultInputState, type QueryInputState } from '@/lib/query-state';
import { normalizeBirthProfile } from 'mingyu-core/profile';

const startTimestamp = Date.parse('2000-01-01T08:00:00+08:00');

const rangeSource = {
  pillars: { year: '庚辰', month: '戊子', day: '甲午', hour: '丙寅' },
  intervalStart: '2000-01-01 08:00:00',
  intervalEnd: '2000-01-01 08:00:03',
  startTimestamp,
  endTimestamp: startTimestamp + 3_000,
  endExclusive: true as const,
  timezone: 'Asia/Shanghai' as const,
  offsetHours: 8 as const,
};

function createInput(overrides: Partial<QueryInputState> = {}): QueryInputState {
  return {
    ...defaultInputState,
    year: '2000',
    month: '1',
    day: '1',
    birthHour: '8',
    birthMinute: '0',
    birthSecond: '0',
    birthReverseSource: JSON.stringify(rangeSource),
    ...overrides,
  };
}

test('前端本人范围输入保留完整机器区间和固定北京时间策略', () => {
  const input = createInput({
    name: '合成本人',
    gender: 'female',
    birthPlace: '合成地点',
    birthLongitude: '116.4',
    birthLatitude: '39.9',
  });

  const profile = buildFrontendBirthProfile(input, 'primary');

  assert.equal(profile.name, '合成本人');
  assert.equal(profile.gender, 'female');
  assert.equal(profile.calendarType, 'solar');
  assert.equal(profile.useTrueSolarTime, false);
  assert.equal(profile.applyChinaDst, false);
  assert.equal(profile.year, 2000);
  assert.equal(profile.month, 1);
  assert.equal(profile.day, 1);
  assert.equal(profile.hour, 8);
  assert.equal(profile.minute, 0);
  assert.equal(profile.second, 0);
  assert.deepEqual(profile.birthTimeRange, {
    startTimestamp,
    endTimestamp: startTimestamp + 3_000,
    endExclusive: true,
    timezone: 'Asia/Shanghai',
    offsetHours: 8,
  });
  assert.deepEqual(profile.location, {
    name: '合成地点',
    longitude: 116.4,
    latitude: 39.9,
    timezone: 8,
  });
});

test('前端对方范围输入使用对方字段，任一来源非空即标记范围输入', () => {
  const input = createInput({
    birthReverseSource: '',
    analysisMode: 'compatibility',
    partnerName: '合成对方',
    partnerGender: 'female',
    partnerYear: '2000',
    partnerMonth: '1',
    partnerDay: '1',
    partnerTimeIndex: '',
    partnerBirthHour: '8',
    partnerBirthMinute: '0',
    partnerBirthSecond: '0',
    partnerBirthReverseSource: JSON.stringify(rangeSource),
  });

  assert.equal(hasFrontendBirthRangeInput(input), true);
  const profile = buildFrontendBirthProfile(input, 'partner');
  assert.equal(profile.name, '合成对方');
  assert.equal(profile.gender, 'female');
  assert.deepEqual(profile.birthTimeRange, {
    startTimestamp,
    endTimestamp: startTimestamp + 3_000,
    endExclusive: true,
    timezone: 'Asia/Shanghai',
    offsetHours: 8,
  });
});

test('单人状态忽略残留的对方来源', () => {
  const input = createInput({
    birthReverseSource: '',
    partnerBirthReverseSource: JSON.stringify(rangeSource),
  });

  assert.equal(hasFrontendBirthRangeInput(input), false);
});

test('点输入保留精准秒和默认 IANA 时区', () => {
  const input = createInput({
    birthReverseSource: '',
    dateType: 'solar',
    timeIndex: '',
    birthHour: '4',
    birthMinute: '5',
    birthSecond: '6',
    birthPlace: '合成地点',
    birthLongitude: '121.47',
    birthLatitude: '31.23',
  });

  const profile = buildFrontendBirthProfile(input, 'primary');

  assert.equal('birthTimeRange' in profile, false);
  assert.equal(profile.calendarType, 'solar');
  assert.equal(profile.useTrueSolarTime, false);
  assert.equal(profile.applyChinaDst, false);
  assert.equal(profile.hour, 4);
  assert.equal(profile.minute, 5);
  assert.equal(profile.second, 6);
  assert.equal(typeof profile.timeIndex, 'number');
  assert.deepEqual(profile.location, {
    name: '合成地点',
    longitude: 121.47,
    latitude: 31.23,
    timeZoneId: FRONTEND_DEFAULT_TIME_ZONE_ID,
  });
});

test('点输入只有时分时保留分钟精度和默认 IANA 时区', () => {
  const input = createInput({
    birthReverseSource: '',
    dateType: 'solar',
    timeIndex: '',
    birthHour: '4',
    birthMinute: '5',
    birthSecond: '',
    birthPlace: '分钟地点',
    birthLongitude: '121.47',
    birthLatitude: '31.23',
  });

  const profile = buildFrontendBirthProfile(input, 'primary');

  assert.equal(profile.hour, 4);
  assert.equal(profile.minute, 5);
  assert.equal(profile.second, undefined);
  assert.equal(normalizeBirthProfile(profile).timePrecision, 'minute');
  assert.deepEqual(profile.location, {
    name: '分钟地点',
    longitude: 121.47,
    latitude: 31.23,
    timeZoneId: FRONTEND_DEFAULT_TIME_ZONE_ID,
  });
});

test('点输入真太阳时保留精确时分秒和前端默认 IANA 时区', () => {
  const input = createInput({
    birthReverseSource: '',
    useTrueSolarTime: true,
    timeIndex: '',
    birthHour: '8',
    birthMinute: '30',
    birthSecond: '12',
    birthPlace: '合成地点',
    birthLongitude: '116.4',
    birthLatitude: '39.9',
  });

  const profile = buildFrontendBirthProfile(input, 'primary');

  assert.equal(profile.useTrueSolarTime, true);
  assert.equal(profile.applyChinaDst, false);
  assert.equal(profile.hour, 8);
  assert.equal(profile.minute, 30);
  assert.equal(profile.second, 12);
  assert.equal(profile.timeIndex, undefined);
  assert.deepEqual(profile.location, {
    name: '合成地点',
    longitude: 116.4,
    latitude: 39.9,
    timeZoneId: FRONTEND_DEFAULT_TIME_ZONE_ID,
  });
});

test('点输入传统时辰和仅名称地点不制造无效 location', () => {
  const input = createInput({
    birthReverseSource: '',
    timeIndex: 4,
    birthHour: '',
    birthMinute: '',
    birthSecond: '',
    birthPlace: '只有名称',
    birthLongitude: '',
    birthLatitude: '',
  });

  const profile = buildFrontendBirthProfile(input, 'primary');

  assert.equal(profile.timeIndex, 4);
  assert.equal(profile.hour, undefined);
  assert.equal(profile.minute, undefined);
  assert.equal(profile.second, undefined);
  assert.equal('location' in profile, false);
});

test('完整旧文本来源可恢复范围，损坏或半新来源显式报错', () => {
  const malformed = createInput({ birthReverseSource: '{bad json' });
  assert.throws(() => buildFrontendBirthProfile(malformed, 'primary'), /来源无效/);

  const legacySource = {
    pillars: rangeSource.pillars,
    intervalStart: rangeSource.intervalStart,
    intervalEnd: rangeSource.intervalEnd,
  };
  const legacyInput = createInput({ birthReverseSource: JSON.stringify(legacySource) });
  const legacyProfile = buildFrontendBirthProfile(legacyInput, 'primary');
  assert.deepEqual(legacyProfile.birthTimeRange, {
    startTimestamp,
    endTimestamp: startTimestamp + 3_000,
    endExclusive: true,
    timezone: 'Asia/Shanghai',
    offsetHours: 8,
  });

  const missingMachineFields = createInput({
    birthReverseSource: JSON.stringify({
      ...legacySource,
      startTimestamp,
      endExclusive: true,
      timezone: 'Asia/Shanghai',
      offsetHours: 8,
    }),
  });
  assert.throws(() => buildFrontendBirthProfile(missingMachineFields, 'primary'), /来源无效/);
  assert.equal(hasFrontendBirthRangeInput(missingMachineFields), true);
});
