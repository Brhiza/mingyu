import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateCompatibilityBundle,
  type CompatibilityBundleOptions,
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
  beijingTimestamp('1992-03-04 08:59:59'),
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

function withoutCalculationTimestamp<T extends { timestamp: number }>(
  value: T,
): Omit<T, 'timestamp'> {
  const { timestamp: _timestamp, ...calculation } = value;
  return calculation;
}

test('一侧范围与一侧固定盘生成有界笛卡尔积并缓存固定盘', async () => {
  const result = asRangeBundle(
    await calculateCompatibilityBundle(primary, fixedPartner, {
      systems: ['bazi'],
      chart: { baziRules: { shenShaScope: 'all' } },
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
  for (const sample of [...result.primarySamples, ...result.partnerSamples]) {
    assert.equal(sample.bundle.inputs.bazi?.shenShaScope, 'all');
  }
  assert.deepEqual(result.primaryProfile, primary);
  assert.deepEqual(result.partnerProfile, fixedPartner);
  assert.equal('primary' in result, false);
  assert.equal('partner' in result, false);
});

test('双方范围按 primary-major 遍历 2x3 笛卡尔积并保持单点关系方向', async () => {
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
  assert.deepEqual(
    result.partnerSamples.map((sample) => sample.bundle.bazi?.pillars.hour.ganZhi),
    ['戊辰', '己巳', '己巳'],
  );
  assert.equal(
    result.primarySamples.every((sample) => !('birthTimeRange' in sample.profile)),
    true,
  );
  assert.equal(
    result.partnerSamples.every((sample) => !('birthTimeRange' in sample.profile)),
    true,
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
    assert.ok(pair.bazi?.crossPillarRelations.length);
  }

  const beforeHourBoundary = result.pairs[0]?.bazi?.crossPillarRelations ?? [];
  const afterHourBoundary = result.pairs[1]?.bazi?.crossPillarRelations ?? [];
  assert.ok(
    beforeHourBoundary.some(
      (relation) =>
        relation.person1Pillar === 'year' &&
        relation.person2Pillar === 'hour' &&
        relation.layer === '天干' &&
        relation.type === '五合候选' &&
        relation.person1Value === '癸' &&
        relation.person2Value === '戊',
    ),
  );
  assert.ok(
    beforeHourBoundary.some(
      (relation) =>
        relation.person1Pillar === 'year' &&
        relation.person2Pillar === 'hour' &&
        relation.layer === '地支' &&
        relation.type === '六害' &&
        relation.person1Value === '卯' &&
        relation.person2Value === '辰',
    ),
  );
  assert.ok(
    afterHourBoundary.some(
      (relation) =>
        relation.person1Pillar === 'month' &&
        relation.person2Pillar === 'hour' &&
        relation.layer === '天干' &&
        relation.type === '五合候选' &&
        relation.person1Value === '甲' &&
        relation.person2Value === '己',
    ),
  );
  assert.ok(
    afterHourBoundary.some(
      (relation) =>
        relation.person1Pillar === 'hour' &&
        relation.person2Pillar === 'hour' &&
        relation.layer === '地支' &&
        relation.type === '同支' &&
        relation.person1Value === '巳' &&
        relation.person2Value === '巳',
    ),
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

test('紫微与西占分页逐 pair 等于固定时刻及坐标的直接单点合盘', async () => {
  const primaryWithLocation: BirthProfile = {
    ...primary,
    location: { longitude: 116.4074, latitude: 39.9042, timezone: 8 },
  };
  const partnerWithLocation: BirthProfile = {
    ...partner,
    location: { longitude: 121.4737, latitude: 31.2304, timezone: 8 },
  };
  const options: CompatibilityBundleOptions = {
    systems: ['ziwei', 'astrolabe'],
    chart: {
      ziweiRules: {
        algorithm: 'zhongzhou',
        fixLeap: false,
        yearDivide: 'exact',
        horoscopeDivide: 'exact',
        ageDivide: 'birthday',
        dayDivide: 'current',
      },
      ziwei: {
        scopes: ['yearly'],
        skipAnalysis: true,
        now: new Date('2025-01-01T04:00:00.000Z'),
      },
    },
    ziwei: { person1Name: '旧对方', person2Name: '旧主方' },
    astrolabe: { pointNames: ['Sun', 'Moon', 'Venus'], includeHouseOverlays: true, maxAspects: 8 },
  };
  const seenPairs: number[] = [];
  const seenCoordinates: Array<[number, number]> = [];
  let startIndex = 2;
  for (let pageIndex = 0; pageIndex < 2; pageIndex += 1) {
    const page = asRangeBundle(
      await calculateCompatibilityBundle(primaryWithLocation, partnerWithLocation, {
        ...options,
        rangeBatch: { startIndex, limit: 1 },
      }),
    );
    assert.equal(page.range.totalPairs, 6);
    assert.equal(page.primarySamples.length, 1);
    assert.equal(page.partnerSamples.length, 1);
    for (const pair of page.pairs) {
      seenPairs.push(pair.pairIndex);
      seenCoordinates.push([pair.primaryIndex, pair.partnerIndex]);
      const first = page.primarySamples.find((sample) => sample.index === pair.primaryIndex);
      const second = page.partnerSamples.find((sample) => sample.index === pair.partnerIndex);
      assert.ok(first);
      assert.ok(second);
      const direct = await calculateCompatibilityBundle(first.profile, second.profile, options);
      assert.ok(!('range' in direct));
      assert.deepEqual(first.bundle.inputs, direct.primary.inputs);
      assert.deepEqual(second.bundle.inputs, direct.partner.inputs);
      assert.deepEqual(
        first.bundle.ziwei?.horoscopeContext,
        direct.primary.ziwei?.horoscopeContext,
      );
      assert.deepEqual(
        second.bundle.ziwei?.horoscopeContext,
        direct.partner.ziwei?.horoscopeContext,
      );
      assert.deepEqual(first.bundle.ziwei?.payloadByScope, direct.primary.ziwei?.payloadByScope);
      assert.deepEqual(second.bundle.ziwei?.payloadByScope, direct.partner.ziwei?.payloadByScope);
      assert.ok(first.bundle.ziwei?.payloadByScope.origin);
      assert.ok(first.bundle.ziwei?.payloadByScope.yearly);
      assert.ok(second.bundle.ziwei?.payloadByScope.origin);
      assert.ok(second.bundle.ziwei?.payloadByScope.yearly);
      assert.ok(first.bundle.astrolabe);
      assert.ok(second.bundle.astrolabe);
      assert.ok(direct.primary.astrolabe);
      assert.ok(direct.partner.astrolabe);
      assert.deepEqual(
        withoutCalculationTimestamp(first.bundle.astrolabe),
        withoutCalculationTimestamp(direct.primary.astrolabe),
      );
      assert.deepEqual(
        withoutCalculationTimestamp(second.bundle.astrolabe),
        withoutCalculationTimestamp(direct.partner.astrolabe),
      );
      assert.deepEqual(pair.ziwei, direct.ziwei);
      assert.ok(pair.astrolabe);
      assert.ok(direct.astrolabe);
      assert.deepEqual(
        withoutCalculationTimestamp(pair.astrolabe),
        withoutCalculationTimestamp(direct.astrolabe),
      );
      assert.deepEqual(pair.ziwei?.people, { person1: '范围主方', person2: '范围对方' });
    }
    assert.equal(page.range.nextIndex, startIndex + 1);
    if (page.range.nextIndex === null) throw new Error('测试分页需要下一页游标。');
    startIndex = page.range.nextIndex;
  }
  assert.deepEqual(seenPairs, [2, 3]);
  assert.deepEqual(seenCoordinates, [
    [0, 2],
    [1, 0],
  ]);
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
