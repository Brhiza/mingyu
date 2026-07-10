import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateTrueSolarTime,
  checkChinaDst,
  convertTrueSolarTime,
  parseLocalDateTime,
} from 'mingyu-core/calendar';
import { calculateTrueSolarTime as legacyCalculateTrueSolarTime } from '../packages/core/src/bazi/trueSolarTime.ts';
import { checkChinaDst as legacyCheckChinaDst } from '../packages/core/src/bazi/chinaDst.ts';

test('真太阳时公共入口应复用旧八字算法并返回便捷资料', () => {
  const result = convertTrueSolarTime({
    localDateTime: '1990-05-15T10:30:20',
    longitude: 116.4074,
  });
  const raw = calculateTrueSolarTime(
    { year: 1990, month: 5, day: 15, hour: 10, minute: 30, second: 20 },
    116.4074,
    120,
  );
  const legacy = legacyCalculateTrueSolarTime(
    { year: 1990, month: 5, day: 15, hour: 10, minute: 30, second: 20 },
    116.4074,
    120,
  );

  assert.deepEqual(legacy, raw);
  assert.deepEqual(result.correctedTime, raw.correctedTime);
  assert.equal(result.standardDateTime, '1990-05-15T10:30:20');
  assert.equal(result.timezone, 8);
  assert.equal(result.standardMeridian, 120);
  assert.equal(result.crossesDate, false);
  assert.equal(result.shichen.name, '巳时');
  assert.deepEqual(legacyCheckChinaDst(1988, 7, 15, 12), checkChinaDst(1988, 7, 15, 12));
});

test('真太阳时便捷入口应可选自动还原中国历史夏令时', () => {
  const withoutDst = convertTrueSolarTime({
    localDateTime: '1988-07-15T12:00',
    longitude: 116.4074,
  });
  const withDst = convertTrueSolarTime({
    localDateTime: '1988-07-15T12:00',
    longitude: 116.4074,
    applyChinaDst: true,
  });

  assert.equal(withoutDst.standardDateTime, '1988-07-15T12:00:00');
  assert.equal(withoutDst.chinaDst.requested, false);
  assert.equal(withDst.clockDateTime, '1988-07-15T12:00:00');
  assert.equal(withDst.standardDateTime, '1988-07-15T11:00:00');
  assert.equal(withDst.chinaDst.applied, true);
  assert.equal(withDst.chinaDst.offsetMinutes, -60);
});

test('真太阳时便捷入口应识别跨日并支持全球时区', () => {
  const kashgar = convertTrueSolarTime({
    localDateTime: '2020-08-01T00:40',
    longitude: 75.99,
    timezone: 8,
  });
  assert.equal(kashgar.crossesDate, true);
  assert.equal(kashgar.correctedTime.day, 31);

  const utcPlus14 = convertTrueSolarTime({
    localDateTime: '2026-07-10T12:00',
    longitude: 170,
    timezone: 14,
  });
  assert.equal(utcPlus14.standardMeridian, 210);
});

test('真太阳时便捷入口应拒绝含时区后缀、非法日期和越界参数', () => {
  assert.throws(() => parseLocalDateTime('2026-07-10T12:00:00+08:00'), /不要附带时区偏移/);
  assert.throws(
    () => convertTrueSolarTime({ localDateTime: '2026-02-30T12:00', longitude: 116.4 }),
    /日期需在/,
  );
  assert.throws(
    () =>
      convertTrueSolarTime({
        localDateTime: '2026-07-10T12:00',
        longitude: 116.4,
        timezone: 15,
      }),
    /timezone需在/,
  );
});
