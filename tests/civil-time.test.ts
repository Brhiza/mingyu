import assert from 'node:assert/strict';
import test from 'node:test';

import { formatFixedTimezoneOffset, resolveCivilTime } from 'mingyu-core/calendar';

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
