import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateHuangjiSixDayCycleFromDate,
  parseHuangjiSixDayDateTime,
} from '../packages/core/src/huangji-jingshi/datetime.ts';

function calculateProportional(dateTime: string) {
  return calculateHuangjiSixDayCycleFromDate(
    parseHuangjiSixDayDateTime(dateTime, undefined, undefined, 'six-day-seven-part'),
  );
}

test('公元 1 年冬至后无需预取公元前的冬至即可定位六日逐爻', () => {
  const result = calculateProportional('0001-12-24T00:00:00+08:00');
  assert.equal(result.anchor.kind, 'winter-solstice-civil-midnight');
  assert.equal(result.anchor.winterSolsticeGregorianYear, 1);
  assert.equal(result.calendar.targetYear, 2);
  assert.ok(result.calendar.logicalElapsedDays >= 0);
});

test('公元 9999 年冬至前可使用最后一轮完整冬至岁周', () => {
  const result = calculateProportional('9999-01-07T00:00:00+08:00');
  assert.equal(result.anchor.kind, 'winter-solstice-civil-midnight');
  assert.equal(result.anchor.winterSolsticeGregorianYear, 9998);
  assert.equal(result.calendar.targetYear, 9999);
  assert.ok(result.calendar.yearLengthDays > 0);
});

test('冬至交节前后不同时区按同一真实瞬时切换岁周', () => {
  for (const [before, at] of [
    ['2025-12-22T05:03:04+14:00', '2025-12-22T05:03:05+14:00'],
    ['2025-12-21T05:03:04-10:00', '2025-12-21T05:03:05-10:00'],
  ]) {
    const beforeTerm = calculateProportional(before);
    const atTerm = calculateProportional(at);
    assert.equal(beforeTerm.calendar.targetYear, 2025);
    assert.equal(atTerm.calendar.targetYear, 2026);
    assert.equal(beforeTerm.civilTime.utcDateTime, '2025-12-21T15:03:04.000Z');
    assert.equal(atTerm.civilTime.utcDateTime, '2025-12-21T15:03:05.000Z');
  }
});

test('历表缺少起点或下一冬至时明确拒绝比例换算', () => {
  assert.throws(
    () => calculateProportional('0001-01-07T00:00:00+08:00'),
    /无法定位六日逐爻公历时间所属的冬至锚点/u,
  );
  assert.throws(
    () => calculateProportional('9999-12-31T00:00:00+08:00'),
    /缺少所需的下一冬至历表/u,
  );
});
