import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateBirthChartBundle,
  type BirthChartBundle,
  type BirthChartRangeBundle,
  type BirthProfile,
} from '../packages/core/src/birth';
import { normalizeBirthProfile } from '../packages/core/src/profile';
import type { BirthProfileTimeRange } from '../packages/core/src/profile/time-range';

const SECOND = 1_000;
const CHINA_OFFSET_MS = 8 * 60 * 60 * SECOND;

function beijingTimestamp(value: string): number {
  const [dateText, timeText] = value.split(' ');
  const [year, month, day] = dateText!.split('-').map(Number);
  const [hour, minute, second] = timeText!.split(':').map(Number);
  return Date.UTC(year!, month! - 1, day, hour, minute, second) - CHINA_OFFSET_MS;
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

function asRangeBundle(bundle: BirthChartBundle): BirthChartRangeBundle {
  if (!bundle.range) throw new Error('测试预期得到出生时间范围结果。');
  return bundle as BirthChartRangeBundle;
}

function solarTimestamp(time: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}): number {
  return (
    Date.UTC(time.year, time.month - 1, time.day, time.hour, time.minute, time.second) -
    CHINA_OFFSET_MS
  );
}

const RANGE = rangeFor('1990-06-14 10:59:59', '1990-06-14 11:00:02');
const PROFILE: BirthProfile = {
  id: 'synthetic-1990-birth-range',
  name: '公开合成1990出生区间',
  gender: 'female',
  calendarType: 'solar',
  year: 1990,
  month: 6,
  day: 14,
  hour: 10,
  minute: 59,
  second: 59,
  timeIndex: 5,
  birthTimeRange: RANGE,
  location: { name: '北京', longitude: 116.4, latitude: 39.9, timezone: 8 },
};

test('出生区间默认逐秒分页、可按 nextIndex 续取末尾且不返回代表盘', async () => {
  const first = asRangeBundle(await calculateBirthChartBundle(PROFILE, { systems: ['bazi'] }));

  assert.deepEqual(first.systems, ['bazi']);
  assert.equal(first.range.resolutionSeconds, 1);
  assert.equal(first.range.totalSamples, 3);
  assert.equal(first.range.startIndex, 0);
  assert.equal(first.range.endIndexExclusive, 1);
  assert.equal(first.range.samples.length, 1);
  assert.equal(first.range.nextIndex, 1);
  assert.equal('normalized' in first, false);
  assert.equal('inputs' in first, false);
  assert.equal('bazi' in first, false);

  if (first.range.nextIndex === null) throw new Error('首批测试预期存在续取游标。');
  const tail = asRangeBundle(
    await calculateBirthChartBundle(PROFILE, {
      systems: ['bazi'],
      rangeBatch: { startIndex: first.range.nextIndex, limit: 999 },
    }),
  );
  assert.equal(tail.range.startIndex, 1);
  assert.equal(tail.range.endIndexExclusive, 3);
  assert.equal(tail.range.samples.length, 2);
  assert.equal(tail.range.nextIndex, null);

  const samples = [...first.range.samples, ...tail.range.samples];
  assert.deepEqual(
    samples.map((sample) => sample.index),
    [0, 1, 2],
  );
  assert.deepEqual(
    samples.map((sample) => sample.timestamp),
    [RANGE.startTimestamp, RANGE.startTimestamp + SECOND, RANGE.startTimestamp + 2 * SECOND],
  );
  assert.deepEqual(
    samples.map((sample) => sample.bundle.profile.second),
    [59, 0, 1],
  );
  assert.deepEqual(
    samples.map((sample) => sample.bundle.normalized.timeIndex),
    [5, 6, 6],
  );
  assert.notEqual(
    samples[0]!.bundle.bazi?.pillars.hour.ganZhi,
    samples[1]!.bundle.bazi?.pillars.hour.ganZhi,
  );
});

test('每秒出生结果与对应单点重算一致，并保留秒级证据和起运变化', async () => {
  const range = asRangeBundle(
    await calculateBirthChartBundle(PROFILE, {
      systems: ['bazi'],
      rangeBatch: { limit: 3 },
    }),
  );

  for (const sample of range.range.samples) {
    const point = await calculateBirthChartBundle(sample.bundle.profile, { systems: ['bazi'] });
    if (point.range) throw new Error('单点档案不应返回出生区间结果。');

    assert.deepEqual(sample.bundle.bazi, point.bazi);
    assert.deepEqual(sample.bundle.inputs, point.inputs);
    assert.deepEqual(sample.bundle.normalized, point.normalized);
    assert.equal(sample.bundle.inputs.bazi?.birthSecond, sample.bundle.profile.second);
    assert.equal(sample.bundle.normalized.timePrecision, 'second');
    assert.equal(sample.bundle.normalized.timeEvidence.precision, 'second');
    assert.equal(sample.bundle.normalized.timeEvidence.inputFact.precision, 'second');
    assert.equal(
      sample.bundle.normalized.timeEvidence.inputFact.clockTime,
      `${String(sample.bundle.profile.hour).padStart(2, '0')}:${String(sample.bundle.profile.minute).padStart(2, '0')}:${String(sample.bundle.profile.second).padStart(2, '0')}`,
    );
  }

  const firstStart = range.range.samples[1]!.bundle.bazi!.luckInfo.cycles[0]?.startSolarTime;
  const secondStart = range.range.samples[2]!.bundle.bazi!.luckInfo.cycles[0]?.startSolarTime;
  assert.ok(firstStart);
  assert.ok(secondStart);
  assert.notEqual(solarTimestamp(firstStart), solarTimestamp(secondStart));
});

test('缺省 second 仍按分钟精度记录，而范围样本明确保留秒精度', () => {
  const minuteProfile = { ...PROFILE };
  delete minuteProfile.second;
  delete minuteProfile.birthTimeRange;

  const normalized = normalizeBirthProfile(minuteProfile);
  assert.equal(normalized.timePrecision, 'minute');
  assert.equal(normalized.timeEvidence.precision, 'minute');
  assert.equal(normalized.timeEvidence.inputFact.precision, 'minute');
  assert.equal(normalized.timeEvidence.inputFact.clockTime, '10:59');
});

test('出生范围尊重取消信号，并要求紫微范围固定运限上下文', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    () => calculateBirthChartBundle(PROFILE, { signal: controller.signal }),
    /已停止出生区间计算/u,
  );

  await assert.rejects(
    () => calculateBirthChartBundle(PROFILE, { systems: ['ziwei'], rangeBatch: { limit: 1 } }),
    /紫微出生区间需提供固定/u,
  );

  const fixedContext = { dateStr: '2025-01-01', hourIndex: 6 } as const;
  const ziweiRange = asRangeBundle(
    await calculateBirthChartBundle(PROFILE, {
      systems: ['ziwei'],
      rangeBatch: { limit: 2 },
      ziwei: { scopes: ['origin'], skipAnalysis: true, horoscopeContext: fixedContext },
    }),
  );
  assert.deepEqual(
    ziweiRange.range.samples.map((sample) => sample.bundle.ziwei?.horoscopeContext),
    [fixedContext, fixedContext],
  );
});
