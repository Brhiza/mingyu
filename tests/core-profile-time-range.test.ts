import assert from 'node:assert/strict';
import test from 'node:test';

import type { BirthProfile } from '../packages/core/src/profile';
import {
  birthProfileAtRangeTimestamp,
  resolveBirthRangeBatch,
  validateBirthProfileTimeRange,
  type BirthProfileTimeRange,
} from '../packages/core/src/profile/time-range';

const SECOND = 1_000;

function beijingTimestamp(value: string): number {
  return Date.parse(`${value.replace(' ', 'T')}+08:00`);
}

function rangeFor(start: string, end: string): BirthProfileTimeRange {
  return {
    startTimestamp: beijingTimestamp(start),
    endTimestamp: beijingTimestamp(end),
    endExclusive: true,
    timezone: 'Asia/Shanghai',
    offsetHours: 8,
  };
}

const START = beijingTimestamp('2024-01-01 23:59:58');
const RANGE = rangeFor('2024-01-01 23:59:58', '2024-01-02 00:00:03');
const PROFILE: BirthProfile & { birthTimeRange?: BirthProfileTimeRange } = {
  id: 'synthetic-cross-day',
  name: '公开合成跨日样本',
  gender: 'female',
  calendarType: 'solar',
  year: 2024,
  month: 1,
  day: 1,
  hour: 23,
  minute: 59,
  second: 58,
  timeIndex: 12,
  birthTimeRange: RANGE,
  location: { name: '北京', longitude: 116.4, latitude: 39.9, timezone: 8 },
};

test('校验公历固定北京时间跨日半开区间并返回规范 source', () => {
  const source = validateBirthProfileTimeRange(PROFILE, RANGE);
  assert.deepEqual(source, RANGE);
  assert.equal(source.endExclusive, true);
  assert.equal(source.timezone, 'Asia/Shanghai');
  assert.equal(source.offsetHours, 8);
});

test('逐秒样本保留跨日字段并清除范围与陈旧时辰索引', () => {
  const source = validateBirthProfileTimeRange(PROFILE, RANGE);
  const first = birthProfileAtRangeTimestamp(PROFILE, source, START);
  const last = birthProfileAtRangeTimestamp(PROFILE, source, RANGE.endTimestamp - SECOND);

  assert.deepEqual(
    {
      year: first.year,
      month: first.month,
      day: first.day,
      hour: first.hour,
      minute: first.minute,
      second: first.second,
    },
    { year: 2024, month: 1, day: 1, hour: 23, minute: 59, second: 58 },
  );
  assert.deepEqual(
    {
      year: last.year,
      month: last.month,
      day: last.day,
      hour: last.hour,
      minute: last.minute,
      second: last.second,
    },
    { year: 2024, month: 1, day: 2, hour: 0, minute: 0, second: 2 },
  );
  assert.equal(first.name, PROFILE.name);
  assert.deepEqual(first.location, PROFILE.location);
  assert.equal('timeIndex' in first, false);
  assert.equal('birthTimeRange' in first, false);
  assert.throws(
    () => birthProfileAtRangeTimestamp(PROFILE, source, RANGE.endTimestamp),
    /起点含、终点不含/u,
  );
});

test('范围校验拒绝起点冲突、真太阳时、夏令时和非半开政策', () => {
  assert.throws(
    () => validateBirthProfileTimeRange({ ...PROFILE, minute: 58 }, RANGE),
    /起点北京时间墙钟字段/u,
  );
  assert.throws(
    () => validateBirthProfileTimeRange({ ...PROFILE, useTrueSolarTime: true }, RANGE),
    /真太阳时/u,
  );
  assert.throws(
    () => validateBirthProfileTimeRange({ ...PROFILE, applyChinaDst: true }, RANGE),
    /夏令时/u,
  );
  assert.throws(
    () =>
      validateBirthProfileTimeRange(
        { ...PROFILE, location: { ...PROFILE.location, timezone: 9 } },
        RANGE,
      ),
    /timezone 必须为 8/u,
  );
  assert.throws(
    () =>
      validateBirthProfileTimeRange(
        { ...PROFILE, location: { ...PROFILE.location, timeZoneId: 'Asia/Shanghai' } },
        RANGE,
      ),
    /不接受 IANA/u,
  );
  assert.throws(
    () => validateBirthProfileTimeRange(PROFILE, { ...RANGE, endExclusive: false } as never),
    /半开区间/u,
  );
  assert.throws(
    () =>
      validateBirthProfileTimeRange(PROFILE, {
        ...RANGE,
        endTimestamp: RANGE.startTimestamp + 2 * 60 * 60 * SECOND + SECOND,
      }),
    /超过两小时/u,
  );
});

test('范围批次按最大 60 秒分页且完整覆盖无缺失', () => {
  const totalSamples = 125;
  const indexes: number[] = [];
  let startIndex = 0;
  for (;;) {
    const batch = resolveBirthRangeBatch(totalSamples, { startIndex, limit: 999 });
    assert.equal(batch.limit, Math.min(60, totalSamples - startIndex));
    assert.equal(batch.endIndexExclusive, batch.startIndex + batch.limit);
    for (let index = batch.startIndex; index < batch.endIndexExclusive; index += 1) {
      indexes.push(index);
    }
    if (batch.nextIndex === null) break;
    startIndex = batch.nextIndex;
  }
  assert.deepEqual(
    indexes,
    Array.from({ length: totalSamples }, (_, index) => index),
  );
  assert.deepEqual(resolveBirthRangeBatch(totalSamples), {
    startIndex: 0,
    endIndexExclusive: 1,
    limit: 1,
    nextIndex: 1,
    totalSamples,
  });
  assert.deepEqual(resolveBirthRangeBatch(0), {
    startIndex: 0,
    endIndexExclusive: 0,
    limit: 0,
    nextIndex: null,
    totalSamples: 0,
  });
});
