import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateCompatibilityBundle,
  type CompatibilityRangeBundle,
} from '../packages/core/src/compatibility';
import type { BirthProfile } from '../packages/core/src/profile';
import type { BirthProfileTimeRange } from '../packages/core/src/profile/time-range';

const SECOND = 1_000;
const BEIJING_OFFSET = 8 * 60 * 60 * SECOND;

function beijingTimestamp(value: string): number {
  return Date.parse(value.replace(' ', 'T') + '+08:00');
}

function addSeconds(timestamp: number, seconds: number): number {
  return timestamp + seconds * SECOND;
}

function profileAtTimestamp(
  name: string,
  gender: 'male' | 'female',
  timestamp: number,
  sampleCount: number,
): BirthProfile {
  const local = new Date(timestamp + BEIJING_OFFSET);
  const range: BirthProfileTimeRange = {
    startTimestamp: timestamp,
    endTimestamp: addSeconds(timestamp, sampleCount),
    endExclusive: true,
    timezone: 'Asia/Shanghai',
    offsetHours: 8,
  };
  return {
    name,
    gender,
    calendarType: 'solar',
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
    hour: local.getUTCHours(),
    minute: local.getUTCMinutes(),
    second: local.getUTCSeconds(),
    birthTimeRange: range,
  };
}

const primary = profileAtTimestamp('范围主方', 'male', beijingTimestamp('2024-01-02 10:00:00'), 2);
const partner = profileAtTimestamp(
  '范围对方',
  'female',
  beijingTimestamp('1992-03-04 08:20:00'),
  3,
);
const fixedPartner: BirthProfile = {
  name: '固定对方',
  gender: 'female',
  calendarType: 'solar',
  year: 1992,
  month: 3,
  day: 4,
  hour: 8,
  minute: 20,
  second: 0,
};

function asRangeBundle(
  value: Awaited<ReturnType<typeof calculateCompatibilityBundle>>,
): CompatibilityRangeBundle {
  if (!('range' in value)) throw new Error('测试需要范围合盘结果。');
  return value;
}

test('一侧范围与一侧固定盘生成有界笛卡尔积并缓存固定盘', async () => {
  const result = asRangeBundle(
    await calculateCompatibilityBundle(primary, fixedPartner, {
      systems: ['bazi'],
      rangeBatch: { limit: 60 },
    }),
  );

  assert.equal(result.range.totalPairs, 2);
  assert.equal(result.range.startIndex, 0);
  assert.equal(result.range.endIndexExclusive, 2);
  assert.equal(result.range.nextIndex, null);
  assert.ok(result.range.primarySource);
  assert.equal(result.range.partnerSource, undefined);
  assert.deepEqual(
    result.pairs.map(({ pairIndex, primaryIndex, partnerIndex }) => ({
      pairIndex,
      primaryIndex,
      partnerIndex,
    })),
    [
      { pairIndex: 0, primaryIndex: 0, partnerIndex: 0 },
      { pairIndex: 1, primaryIndex: 1, partnerIndex: 0 },
    ],
  );
  assert.deepEqual(
    result.primarySamples.map((sample) => sample.index),
    [0, 1],
  );
  assert.deepEqual(
    result.partnerSamples.map((sample) => sample.index),
    [0],
  );
  assert.equal(result.partnerSamples[0]?.timestamp, undefined);
  assert.deepEqual(result.primaryProfile, primary);
  assert.deepEqual(result.partnerProfile, fixedPartner);
  assert.equal('primary' in result, false);
  assert.equal('partner' in result, false);
});

test('双方范围按 primary-major 的真实 2x3 笛卡尔积遍历', async () => {
  const result = asRangeBundle(
    await calculateCompatibilityBundle(primary, partner, {
      systems: ['bazi'],
      rangeBatch: { limit: 60 },
    }),
  );

  assert.equal(result.range.totalPairs, 6);
  assert.deepEqual(
    result.pairs.map(({ pairIndex, primaryIndex, partnerIndex }) => [
      pairIndex,
      primaryIndex,
      partnerIndex,
    ]),
    [
      [0, 0, 0],
      [1, 0, 1],
      [2, 0, 2],
      [3, 1, 0],
      [4, 1, 1],
      [5, 1, 2],
    ],
  );
  assert.deepEqual(
    result.primarySamples.map((sample) => sample.index),
    [0, 1],
  );
  assert.deepEqual(
    result.partnerSamples.map((sample) => sample.index),
    [0, 1, 2],
  );
  assert.equal(
    result.primarySamples.every((sample) => !('birthTimeRange' in sample.profile)),
    true,
  );
  assert.equal(
    result.partnerSamples.every((sample) => !('birthTimeRange' in sample.profile)),
    true,
  );
});

test('续读尾页只返回末尾 pair 并排除 totalPairs 边界', async () => {
  const result = asRangeBundle(
    await calculateCompatibilityBundle(primary, partner, {
      systems: ['bazi'],
      rangeBatch: { startIndex: 4, limit: 60 },
    }),
  );

  assert.deepEqual(
    {
      startIndex: result.range.startIndex,
      endIndexExclusive: result.range.endIndexExclusive,
      nextIndex: result.range.nextIndex,
    },
    { startIndex: 4, endIndexExclusive: 6, nextIndex: null },
  );
  assert.deepEqual(
    result.pairs.map((pair) => pair.pairIndex),
    [4, 5],
  );
  assert.equal(
    result.pairs.some((pair) => pair.pairIndex >= result.range.totalPairs),
    false,
  );
  assert.deepEqual(
    result.primarySamples.map((sample) => sample.index),
    [1],
  );
  assert.deepEqual(
    result.partnerSamples.map((sample) => sample.index),
    [1, 2],
  );
});

test('每个 pair 保持主方到对方的方向并等同于实际单点合盘算法', async () => {
  const result = asRangeBundle(
    await calculateCompatibilityBundle(primary, partner, {
      systems: ['bazi'],
      rangeBatch: { limit: 60 },
    }),
  );
  for (const pair of result.pairs) {
    const primarySample = result.primarySamples.find(
      (sample) => sample.index === pair.primaryIndex,
    );
    const partnerSample = result.partnerSamples.find(
      (sample) => sample.index === pair.partnerIndex,
    );
    assert.ok(primarySample);
    assert.ok(partnerSample);

    const direct = await calculateCompatibilityBundle(
      primarySample.profile,
      partnerSample.profile,
      {
        systems: ['bazi'],
      },
    );
    assert.ok(!('range' in direct));
    assert.deepEqual(pair.bazi, direct.bazi);
    assert.equal(pair.bazi?.people.person1, '范围主方');
    assert.equal(pair.bazi?.people.person2, '范围对方');
    assert.equal(pair.bazi?.dayMasterRelation.person1Gan, primarySample.bundle.bazi?.dayMaster.gan);
    assert.equal(pair.bazi?.dayMasterRelation.person2Gan, partnerSample.bundle.bazi?.dayMaster.gan);
  }
});

test('范围紫微合盘拒绝隐式当前时刻并固定 horoscopeContext', async () => {
  await assert.rejects(
    () =>
      calculateCompatibilityBundle(primary, partner, {
        systems: ['ziwei'],
        rangeBatch: { limit: 1 },
      }),
    /固定的运限日期或计算时间/u,
  );

  const fixedContext = { dateStr: '2025-01-01', hourIndex: 6 } as const;
  const result = asRangeBundle(
    await calculateCompatibilityBundle(primary, partner, {
      systems: ['ziwei'],
      rangeBatch: { limit: 1 },
      chart: {
        ziwei: { scopes: ['origin'], skipAnalysis: true, horoscopeContext: fixedContext },
      },
    }),
  );
  assert.deepEqual(result.pairs[0]?.ziwei?.people, {
    person1: '范围主方',
    person2: '范围对方',
  });
  assert.deepEqual(result.primarySamples[0]?.bundle.ziwei?.horoscopeContext, fixedContext);
  assert.deepEqual(result.partnerSamples[0]?.bundle.ziwei?.horoscopeContext, fixedContext);
});

test('已取消的范围批次在首个实际样本前停止', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    () =>
      calculateCompatibilityBundle(primary, partner, {
        systems: ['bazi'],
        signal: controller.signal,
      }),
    { name: 'AbortError' },
  );
});

test('rangeBatch 默认一对且上限沿用 60', async () => {
  const first = asRangeBundle(
    await calculateCompatibilityBundle(primary, partner, {
      systems: ['bazi'],
    }),
  );
  assert.equal(first.pairs.length, 1);
  assert.equal(first.range.nextIndex, 1);

  const all = asRangeBundle(
    await calculateCompatibilityBundle(primary, partner, {
      systems: ['bazi'],
      rangeBatch: { limit: 999 },
    }),
  );
  assert.equal(all.pairs.length, 6);
});
