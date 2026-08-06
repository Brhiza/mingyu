import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateCompatibilityBundle } from 'mingyu-core/compatibility';

const primary = {
  name: '第一人',
  gender: 'male' as const,
  calendarType: 'solar' as const,
  year: 1990,
  month: 5,
  day: 15,
  timeIndex: 5,
};

const partner = {
  name: '第二人',
  gender: 'female' as const,
  calendarType: 'solar' as const,
  year: 1992,
  month: 8,
  day: 20,
  timeIndex: 7,
};

test('双人 BirthProfile 应直接生成八字合盘证据', async () => {
  const bundle = await calculateCompatibilityBundle(primary, partner, {
    systems: ['bazi'],
  });

  assert.deepEqual(bundle.systems, ['bazi']);
  assert.equal(bundle.primary.bazi?.pillars.hour.ganZhi.length, 2);
  assert.equal(bundle.partner.bazi?.pillars.hour.ganZhi.length, 2);
  assert.equal(bundle.bazi?.people.person1, '第一人');
  assert.equal(bundle.bazi?.people.person2, '第二人');
  assert.equal(bundle.astrolabe, undefined);
  assert.equal(bundle.ziwei, undefined);
});

test('合盘 Bundle 应拒绝未知系统而不是静默忽略', async () => {
  await assert.rejects(
    () =>
      calculateCompatibilityBundle(primary, partner, {
        systems: ['bazi', 'unknown' as never],
      }),
    /不支持的合盘系统/,
  );
});
