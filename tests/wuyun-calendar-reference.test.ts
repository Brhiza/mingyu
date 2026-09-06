import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateWuyunLiuqi } from '@core/wuyun-liuqi';
import { TimeManager } from '../packages/core/src/calendar/timeManager';

// 香港天文台2026年历及2027年大寒：五运按《运气要诀》节后序日换算。
// https://www.hko.gov.hk/tc/gts/time/calendar/pdf/files/2026.pdf
// https://www.hko.gov.hk/tc/gts/astron2027/files/2027SolarTerms24.pdf
test('五运六气2026年公历边界与独立年历的节气日期一致', () => {
  const result = calculateWuyunLiuqi({ year: 2026 });
  assert.deepEqual(
    result.movementSteps.map((step) => [step.gregorianStart, step.gregorianEnd]),
    [
      ['2026-01-20', '2026-04-01'],
      ['2026-04-02', '2026-06-14'],
      ['2026-06-15', '2026-08-29'],
      ['2026-08-30', '2026-11-10'],
      ['2026-11-11', '2027-01-19'],
    ],
  );
  assert.deepEqual(
    result.qiSteps.map((step) => [step.gregorianStart, step.gregorianEnd]),
    [
      ['2026-01-20', '2026-03-19'],
      ['2026-03-20', '2026-05-20'],
      ['2026-05-21', '2026-07-22'],
      ['2026-07-23', '2026-09-22'],
      ['2026-09-23', '2026-11-21'],
      ['2026-11-22', '2027-01-19'],
    ],
  );
  try {
    TimeManager.setTimezoneOffsetMinutesOverride(-480);
    const shifted = calculateWuyunLiuqi({ year: 2026 });
    assert.deepEqual(shifted.movementSteps, result.movementSteps);
    assert.deepEqual(shifted.qiSteps, result.qiSteps);
  } finally {
    TimeManager.setTimezoneOffsetMinutesOverride(480);
  }
});

test('五运六气支持的300个公历年各步日期连续且两种划分覆盖同一年段', () => {
  const day = (value: string | undefined) => {
    assert.ok(value);
    const timestamp = Date.parse(`${value}T00:00:00Z`);
    assert.ok(Number.isFinite(timestamp), value);
    return timestamp / 86_400_000;
  };
  let previousEnd: number | undefined;
  for (let year = 1900; year <= 2199; year += 1) {
    const result = calculateWuyunLiuqi({ year });
    for (const steps of [result.movementSteps, result.qiSteps]) {
      for (let index = 0; index < steps.length; index += 1) {
        const start = day(steps[index].gregorianStart);
        const end = day(steps[index].gregorianEnd);
        assert.ok(end >= start, `${year}年第${index + 1}步`);
        if (index > 0) assert.equal(start, day(steps[index - 1].gregorianEnd) + 1);
      }
    }
    const start = day(result.movementSteps[0].gregorianStart);
    const end = day(result.movementSteps[4].gregorianEnd);
    assert.equal(start, day(result.qiSteps[0].gregorianStart));
    assert.equal(end, day(result.qiSteps[5].gregorianEnd));
    if (previousEnd !== undefined) assert.equal(start, previousEnd + 1);
    assert.ok([365, 366].includes(end - start + 1), String(year));
    previousEnd = end;
  }
});
