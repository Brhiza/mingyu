import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAstronomicalTimeEvidence, estimateDeltaTSeconds } from 'mingyu-core/calendar';

test('天文时间尺度应以 J2000.0 校验 UTC 儒略日', () => {
  const evidence = buildAstronomicalTimeEvidence({
    year: 2000,
    month: 1,
    day: 1,
    hour: 12,
    timezone: 0,
  });

  assert.equal(evidence.utcDateTime, '2000-01-01 12:00:00Z');
  assert.equal(evidence.julianDayUtc, 2451545);
  assert.equal(evidence.julianDayUtApprox, 2451545);
  assert.ok(evidence.julianDayTtApprox > evidence.julianDayUtc);
  assert.match(evidence.promptText, /UT1≈UTC/);
  assert.match(evidence.promptText, /不自动推断地点历史时区/);
});

test('天文时间尺度应正确把当地钟表时间换算为 UTC', () => {
  const evidence = buildAstronomicalTimeEvidence({
    year: 2026,
    month: 7,
    day: 14,
    hour: 8,
    minute: 30,
    timezone: 8,
  });

  assert.equal(evidence.utcDateTime, '2026-07-14 00:30:00Z');
  assert.equal(evidence.precisionLevel, '近现代估算');
  assert.ok(evidence.deltaTSeconds > 60 && evidence.deltaTSeconds < 100);
  assert.match(evidence.source, /Espenak-Meeus/);
});

test('ΔT 长期年份应明确标为外推并拒绝越界年份', () => {
  const evidence = buildAstronomicalTimeEvidence({
    year: 2180,
    month: 1,
    day: 1,
    timezone: 0,
  });

  assert.equal(evidence.precisionLevel, '长期外推');
  assert.throws(() => estimateDeltaTSeconds(1899), /1900-2200/);
  assert.throws(
    () =>
      buildAstronomicalTimeEvidence({
        year: 2026,
        month: 2,
        day: 30,
        timezone: 8,
      }),
    /不存在第30日/,
  );
});
