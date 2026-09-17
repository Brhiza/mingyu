import assert from 'node:assert/strict';
import test from 'node:test';

import type { BirthProfile } from '../packages/core/src/profile';
import type { BirthProfileTimeRange } from '../packages/core/src/profile/time-range';
import { calculateBaziRangePage } from '../src/lib/full-chart-engine/bazi-range';

const SECOND = 1_000;
const BEIJING_OFFSET = 8 * 60 * 60 * SECOND;

function beijingTimestamp(value: string): number {
  return Date.parse(value.replace(' ', 'T') + '+08:00');
}

function profileAtTimestamp(
  name: string,
  gender: 'male' | 'female',
  timestamp: number,
  sampleCount?: number,
): BirthProfile {
  const local = new Date(timestamp + BEIJING_OFFSET);
  const profile: BirthProfile = {
    name,
    gender,
    calendarType: 'solar',
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
    hour: local.getUTCHours(),
    minute: local.getUTCMinutes(),
    second: local.getUTCSeconds(),
  };
  if (sampleCount === undefined) return profile;
  const birthTimeRange: BirthProfileTimeRange = {
    startTimestamp: timestamp,
    endTimestamp: timestamp + sampleCount * SECOND,
    endExclusive: true,
    timezone: 'Asia/Shanghai',
    offsetHours: 8,
  };
  return { ...profile, birthTimeRange };
}

const primary = profileAtTimestamp(
  '公开合成主方',
  'male',
  beijingTimestamp('2024-01-02 10:00:00'),
  2,
);
const partner = profileAtTimestamp(
  '公开合成对方',
  'female',
  beijingTimestamp('1992-03-04 08:20:00'),
  3,
);
const fixedPartner = profileAtTimestamp(
  '公开固定对方',
  'female',
  beijingTimestamp('1992-03-04 08:20:00'),
);
const fixedPrimary = profileAtTimestamp(
  '公开固定主方',
  'male',
  beijingTimestamp('2024-01-02 10:00:00'),
);

test('单人范围页只计算目标秒并保留完整单点盘事实', async () => {
  const page = await calculateBaziRangePage({
    inputKey: 'single-range',
    index: 1,
    primary: {
      profile: primary,
      identity: { birthPlace: '仅名称主方', timezone: 8 },
    },
  });

  assert.equal(page.inputKey, 'single-range');
  assert.equal(page.index, 1);
  assert.equal(page.total, 2);
  assert.equal(page.nextIndex, null);
  assert.equal(page.primary.timestamp, primary.birthTimeRange!.startTimestamp + SECOND);
  assert.equal(page.primary.bundle.profile.birthTimeRange, undefined);
  assert.ok(page.primary.bundle.normalized);
  assert.ok(page.primary.bundle.inputs.bazi);
  assert.ok(page.primary.result);
  assert.deepEqual(page.primary.identity, { birthPlace: '仅名称主方', timezone: 8 });
  assert.deepEqual(page.primarySource, primary.birthTimeRange);
});

test('双方范围按主方优先的真实笛卡尔积逐页映射且保留双方完整盘面', async () => {
  const expected = [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 0],
    [1, 1],
    [1, 2],
  ];

  for (let index = 0; index < expected.length; index += 1) {
    const page = await calculateBaziRangePage({
      inputKey: 'compatibility-range',
      index,
      primary: { profile: primary },
      partner: { profile: partner },
    });
    const [primaryIndex, partnerIndex] = expected[index]!;
    assert.equal(page.index, index);
    assert.equal(page.total, 6);
    assert.equal(page.primary.index, primaryIndex);
    assert.equal(page.partner?.index, partnerIndex);
    assert.equal(
      page.primary.timestamp,
      primary.birthTimeRange!.startTimestamp + primaryIndex * SECOND,
    );
    assert.equal(
      page.partner?.timestamp,
      partner.birthTimeRange!.startTimestamp + partnerIndex * SECOND,
    );
    assert.equal(page.primary.bundle.profile.birthTimeRange, undefined);
    assert.equal(page.partner?.bundle.profile.birthTimeRange, undefined);
    assert.ok(page.primary.bundle.normalized);
    assert.ok(page.partner?.bundle.normalized);
    assert.ok(page.primary.bundle.inputs.bazi);
    assert.ok(page.partner?.bundle.inputs.bazi);
    assert.ok(page.compatibility);
    assert.equal(page.compatibility?.people.person1, '公开合成主方');
    assert.equal(page.compatibility?.people.person2, '公开合成对方');
    assert.deepEqual(page.primarySource, primary.birthTimeRange);
    assert.deepEqual(page.partnerSource, partner.birthTimeRange);
    assert.equal(page.nextIndex, index === expected.length - 1 ? null : index + 1);
  }
});

test('一侧范围与固定对方按真实 pair 读取且固定侧保留完整事实', async () => {
  const page = await calculateBaziRangePage({
    inputKey: 'fixed-partner',
    index: 1,
    primary: {
      profile: primary,
      identity: { birthPlace: '仅名称主方', timezone: 8 },
    },
    partner: {
      profile: fixedPartner,
      identity: { birthPlace: '仅名称对方', timeZoneId: 'Asia/Shanghai' },
    },
  });

  assert.equal(page.total, 2);
  assert.equal(page.index, 1);
  assert.equal(page.nextIndex, null);
  assert.equal(page.primary.index, 1);
  assert.equal(page.partner?.index, 0);
  assert.equal(page.partner?.timestamp, undefined);
  assert.ok(page.partner?.bundle.normalized);
  assert.ok(page.partner?.bundle.inputs.bazi);
  assert.deepEqual(page.primarySource, primary.birthTimeRange);
  assert.equal(page.partnerSource, undefined);
  assert.equal(page.compatibility?.people.person1, '公开合成主方');
  assert.equal(page.compatibility?.people.person2, '公开固定对方');
  assert.deepEqual(page.primary.identity, { birthPlace: '仅名称主方', timezone: 8 });
  assert.deepEqual(page.partner?.identity, {
    birthPlace: '仅名称对方',
    timeZoneId: 'Asia/Shanghai',
  });
});

test('范围页拒绝负索引和尾界索引，不把越界当作完成', async () => {
  await assert.rejects(
    () =>
      calculateBaziRangePage({
        inputKey: 'invalid-negative',
        index: -1,
        primary: { profile: primary },
      }),
    /非负整数/u,
  );
  await assert.rejects(
    () =>
      calculateBaziRangePage({
        inputKey: 'invalid-end',
        index: 2,
        primary: { profile: primary },
      }),
    /startIndex|范围/u,
  );
  await assert.rejects(
    () =>
      calculateBaziRangePage({
        inputKey: 'invalid-fixed-pair-end',
        index: 1,
        primary: { profile: fixedPrimary },
        partner: { profile: fixedPartner },
      }),
    /只能请求索引 0/u,
  );
});
