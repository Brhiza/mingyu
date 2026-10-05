import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateLiuyue } from '@core/bazi/baziCalculatorTime';
import { getMonthDaysInfo, getYearMonthsGanZhi } from '@core/bazi/calendarTool';
import { calculateSolarTermEvidence } from '@core/calendar/solar-term-evidence';

test('流月和岁运月份的交节文本保留历表秒数', () => {
  const lichun = calculateSolarTermEvidence(2024, 3);
  assert.equal(lichun.utcTimestamp, Date.parse('2024-02-04T08:27:07.000Z'));

  const liuyue = calculateLiuyue(2024, 2, '甲');
  const month = getYearMonthsGanZhi(2024)[0];
  assert.equal(liuyue.ganZhi, '丙寅');
  assert.equal(liuyue.startDateTime, '2024-02-04 16:27:07');
  assert.equal(liuyue.endDateTime, '2024-03-05 10:22:45');
  assert.equal(month.startDateTime, liuyue.startDateTime);
  assert.equal(month.endDateTime, liuyue.endDateTime);
  assert.equal(month.timeRange.startTimestamp, lichun.utcTimestamp);
  assert.equal(month.timeRange.start.second, 7);
  assert.equal(month.timeRange.endExclusive, true);
});

test('交节当天的流日切片和边界说明精确到秒', () => {
  const firstDay = getMonthDaysInfo(2024, 1)[0];
  const previousMonthLastDay = getMonthDaysInfo(2023, 12).at(-1);
  assert.equal(firstDay.startDateTime, '2024-02-04 16:27:07');
  assert.match(firstDay.boundaryNote ?? '', /立春于16:27:07交节/);
  assert.equal(firstDay.timeRange.start.second, 7);
  assert.equal(previousMonthLastDay?.endDateTime, '2024-02-04 16:27:06');
  assert.match(previousMonthLastDay?.boundaryNote ?? '', /立春于16:27:07交节/);
  assert.equal(previousMonthLastDay?.timeRange.endTimestamp, firstDay.timeRange.startTimestamp);
});
