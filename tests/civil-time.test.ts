import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatFixedTimezoneOffset,
  resolveCivilDayEnd,
  resolveCivilDayStart,
  resolveCivilTime,
} from 'mingyu-core/calendar';

test('民用时间统一入口应正确处理固定偏移与边界', () => {
  const fixed = resolveCivilTime({
    year: 2026,
    month: 7,
    day: 14,
    hour: 8,
    minute: 30,
    second: 0,
    timezone: 8,
  });

  assert.equal(fixed.utcDateTime, '2026-07-14T00:30:00.000Z');
  assert.equal(fixed.timezoneSource, 'fixed-offset');
  assert.equal(formatFixedTimezoneOffset(5.75), '+05:45');
  assert.equal(formatFixedTimezoneOffset(-3.5), '-03:30');
  assert.doesNotThrow(() =>
    resolveCivilTime({
      year: 2026,
      month: 1,
      day: 1,
      hour: 0,
      minute: 0,
      second: 0,
      timezone: -12,
    }),
  );
  assert.doesNotThrow(() =>
    resolveCivilTime({
      year: 2026,
      month: 1,
      day: 1,
      hour: 0,
      minute: 0,
      second: 0,
      timezone: 14,
    }),
  );
  assert.throws(
    () =>
      resolveCivilTime({
        year: 2026,
        month: 1,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
        timezone: -12.01,
      }),
    /UTC-12.*UTC\+14/,
  );
  assert.throws(
    () =>
      resolveCivilTime({
        year: 2026,
        month: 1,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
      }),
    /至少需要提供一项/,
  );
});

test('民用时间统一入口应按 IANA 历史规则得到唯一 UTC 时刻', () => {
  const historical = resolveCivilTime({
    year: 1990,
    month: 7,
    day: 1,
    hour: 12,
    minute: 0,
    second: 0,
    timeZoneId: ' Asia/Shanghai ',
  });

  assert.equal(historical.timeZoneId, 'Asia/Shanghai');
  assert.equal(historical.timezone, 9);
  assert.equal(historical.utcDateTime, '1990-07-01T03:00:00.000Z');
  assert.equal(historical.timezoneSource, 'iana-time-zone');
  assert.equal(historical.timezoneEvidence?.status, 'unique');
});

test('民用时间统一入口应拒绝跳时缺口、未消歧回拨和固定偏移冲突', () => {
  assert.throws(
    () =>
      resolveCivilTime({
        year: 2024,
        month: 3,
        day: 10,
        hour: 2,
        minute: 30,
        second: 0,
        timeZoneId: 'America/New_York',
      }),
    /不存在.*夏令时跳时/,
  );
  assert.throws(
    () =>
      resolveCivilTime({
        year: 2024,
        month: 11,
        day: 3,
        hour: 1,
        minute: 30,
        second: 0,
        timeZoneId: 'America/New_York',
      }),
    /回拨歧义.*timezone/,
  );
  assert.throws(
    () =>
      resolveCivilTime({
        year: 2024,
        month: 7,
        day: 1,
        hour: 12,
        minute: 0,
        second: 0,
        timezone: -5,
        timeZoneId: 'America/New_York',
      }),
    /固定偏移.*历史偏移不一致/,
  );

  const resolved = resolveCivilTime({
    year: 2024,
    month: 11,
    day: 3,
    hour: 1,
    minute: 30,
    second: 0,
    timezone: -5,
    timeZoneId: 'America/New_York',
  });
  assert.equal(resolved.utcDateTime, '2024-11-03T06:30:00.000Z');
  assert.equal(resolved.timezone, -5);
  assert.equal(resolved.timezoneEvidence?.ambiguityResolvedByFixedOffset, true);
});

test('民用时间的固定偏移和 IANA 时区保留公元一至九十九年', () => {
  for (const year of [1, 4, 50, 99, 100]) {
    const parts = { year, month: 3, day: 1, hour: 8, minute: 30, second: 15 };
    const padded = String(year).padStart(4, '0');
    const fixed = resolveCivilTime({ ...parts, timezone: 8 });
    assert.equal(fixed.utcDateTime, `${padded}-03-01T00:30:15.000Z`);
    const iana = resolveCivilTime({ ...parts, timeZoneId: 'Etc/UTC' });
    assert.equal(iana.utcDateTime, `${padded}-03-01T08:30:15.000Z`);
  }
  const leap = resolveCivilTime({
    year: 4,
    month: 3,
    day: 1,
    hour: 0,
    minute: 0,
    second: 0,
    timezone: 8,
  });
  assert.equal(leap.utcDateTime, '0004-02-29T16:00:00.000Z');
});

test('IANA 民用日首点应核验输入偏移并保持最早午夜瞬时点', () => {
  assert.throws(
    () =>
      resolveCivilDayStart({
        year: 2024,
        month: 7,
        day: 1,
        timeZoneId: 'America/New_York',
        timezone: -5,
      }),
    /固定偏移.*历史偏移不一致/,
  );

  const repeatedMidnight = resolveCivilDayStart({
    year: 2024,
    month: 11,
    day: 3,
    timeZoneId: 'America/Havana',
  });
  assert.equal(repeatedMidnight.utcDateTime, '2024-11-03T04:00:00.000Z');
  assert.throws(
    () =>
      resolveCivilDayStart({
        year: 2024,
        month: 11,
        day: 3,
        timeZoneId: 'America/Havana',
        timezone: -5,
      }),
    /最早的午夜时刻/,
  );

  const skippedMidnight = resolveCivilDayStart({
    year: 2018,
    month: 11,
    day: 4,
    timeZoneId: 'America/Sao_Paulo',
    timezone: -2,
  });
  assert.equal(skippedMidnight.localDateTime, '2018-11-04T01:00:00');
  assert.equal(skippedMidnight.utcDateTime, '2018-11-04T03:00:00.000Z');
  assert.throws(
    () =>
      resolveCivilDayStart({
        year: 2018,
        month: 11,
        day: 4,
        timeZoneId: 'America/Sao_Paulo',
        timezone: -3,
      }),
    /固定偏移.*历史偏移不一致/,
  );
});

test('民用日终点跨整日跳过与重历时取下一实际日期的首点', () => {
  const apia = { year: 2011, month: 12, day: 29, timeZoneId: 'Pacific/Apia' };
  assert.equal(resolveCivilDayEnd(apia).utcDateTime, '2011-12-30T10:00:00.000Z');
  assert.equal(resolveCivilDayEnd(apia).localDateTime, '2011-12-31T00:00:00');
  assert.throws(() => resolveCivilDayEnd({ ...apia, day: 30 }), /2011-12-30 整日不存在/);

  const kwajalein = { year: 1969, month: 9, day: 30, timeZoneId: 'Pacific/Kwajalein' };
  const start = resolveCivilDayStart(kwajalein);
  const end = resolveCivilDayEnd(kwajalein);
  assert.equal(start.utcDateTime, '1969-09-29T13:00:00.000Z');
  assert.equal(end.utcDateTime, '1969-10-01T12:00:00.000Z');
  assert.equal((end.utcTimestamp - start.utcTimestamp) / 3_600_000, 47);
});
