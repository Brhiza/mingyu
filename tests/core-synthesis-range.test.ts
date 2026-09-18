import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateBaziZiweiCombinedReading,
  type BaziZiweiCombinedReading,
  type BaziZiweiRangeReading,
} from '../packages/core/src/synthesis';
import type { BirthProfile } from '../packages/core/src/profile';
import type { BirthProfileTimeRange } from '../packages/core/src/profile/time-range';

const SECOND = 1_000;
const CHINA_OFFSET_MS = 8 * 60 * 60 * SECOND;

function beijingTimestamp(value: string): number {
  const [dateText, timeText] = value.split(' ');
  const [year, month, day] = dateText!.split('-').map(Number);
  const [hour, minute, second] = timeText!.split(':').map(Number);
  return Date.UTC(year!, month! - 1, day, hour, minute, second) - CHINA_OFFSET_MS;
}

function asRangeReading(reading: BaziZiweiCombinedReading): BaziZiweiRangeReading {
  if (!reading.range) throw new Error('测试预期得到八字紫微合参范围结果。');
  return reading as BaziZiweiRangeReading;
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

const PROFILE: BirthProfile = {
  id: 'synthetic-1990-synthesis-range',
  name: '公开合成1990合参区间',
  gender: 'male',
  calendarType: 'solar',
  year: 1990,
  month: 6,
  day: 14,
  hour: 10,
  minute: 59,
  second: 59,
  timeIndex: 5,
  birthTimeRange: rangeFor('1990-06-14 10:59:59', '1990-06-14 11:00:01'),
  location: { name: '北京', longitude: 116.4, latitude: 39.9, timezone: 8 },
};

const ZIWEI_OPTIONS = {
  scopes: ['origin', 'decadal', 'yearly'] as const,
  horoscopeContext: { dateStr: '2025-01-01', hourIndex: 6 },
};

test('合参范围必须固定紫微上下文，并逐秒使用真实 synthesis', async () => {
  await assert.rejects(
    () => calculateBaziZiweiCombinedReading(PROFILE, { rangeBatch: { limit: 1 } }),
    /必须显式提供/u,
  );

  const rangeReading = asRangeReading(
    await calculateBaziZiweiCombinedReading(PROFILE, {
      ziwei: ZIWEI_OPTIONS,
      rangeBatch: { limit: 2 },
    }),
  );

  assert.equal(rangeReading.synthesis, undefined);
  assert.equal(rangeReading.promptText, undefined);
  assert.deepEqual(
    rangeReading.bundle.range.samples.map((sample) => sample.bundle.profile.second),
    [59, 0],
  );
  assert.deepEqual(
    rangeReading.bundle.range.samples.map((sample) => sample.bundle.ziwei?.horoscopeContext),
    [ZIWEI_OPTIONS.horoscopeContext, ZIWEI_OPTIONS.horoscopeContext],
  );
  assert.deepEqual(
    rangeReading.range.samples.map((sample) => sample.index),
    [0, 1],
  );

  for (const sample of rangeReading.range.samples) {
    const point = await calculateBaziZiweiCombinedReading(
      rangeReading.bundle.range.samples.find((item) => item.index === sample.index)!.bundle.profile,
      { ziwei: ZIWEI_OPTIONS },
    );
    if (point.range) throw new Error('单点合参档案不应返回范围结果。');

    assert.deepEqual(sample.synthesis, point.synthesis);
    assert.equal(sample.promptText, point.promptText);
  }
});
