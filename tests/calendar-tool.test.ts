import test from 'node:test';
import assert from 'node:assert/strict';

import { SolarTerm } from 'tyme4ts';

import {
  getBaziDayIndexByDate,
  getBaziMonthIndexByDate,
  getCalendarInfo,
  getMonthDaysInfo,
  getYearInfo,
} from '@core/bazi/calendarTool';

test('跨年末尾的日历信息应能找到下一节气', () => {
  const info = getCalendarInfo(new Date(2026, 11, 31, 12, 0, 0));

  assert.equal(info.jieQi.prev, '冬至 (2026-12-22)');
  assert.equal(info.jieQi.next, '小寒 (2027-01-05)');
});

test('农历日期格式不应重复输出月字', () => {
  const info = getCalendarInfo(new Date(2026, 0, 1, 12, 0, 0));

  assert.equal(info.lunarDate, '2025年十一月十三');
});

test('交节当小时内应按实际分钟区分前后节气', () => {
  const before = getCalendarInfo(new Date(2026, 10, 7, 17, 51, 0));
  const after = getCalendarInfo(new Date(2026, 10, 7, 17, 53, 0));

  assert.equal(before.jieQi.prev, '霜降 (2026-10-23)');
  assert.equal(before.jieQi.next, '立冬 (2026-11-07)');
  assert.equal(after.jieQi.prev, '立冬 (2026-11-07)');
  assert.equal(after.jieQi.next, '小雪 (2026-11-22)');
});

test('节令月应保留交节当天的末日部分时段，而不是整天提前截止', () => {
  const yearInfo = getYearInfo(2024);
  const firstMonth = yearInfo.months[0];
  const firstMonthDays = getMonthDaysInfo(2024, 1);

  assert.equal(firstMonth.month, '寅月');
  assert.equal(firstMonth.startDate, '2024-02-04');
  assert.equal(firstMonth.endDate, '2024-03-05');
  assert.equal(firstMonthDays[0]?.solarDate, '2024-02-04');
  assert.equal(firstMonthDays.at(-1)?.solarDate, '2024-03-05');
  assert.match(firstMonthDays[0]?.boundaryNote ?? '', /交节/);
  assert.match(firstMonthDays.at(-1)?.boundaryNote ?? '', /交节/);
});

test('交节当天应按具体时刻切换节令月，不应整天一起切换', () => {
  const jingzhe = SolarTerm.fromIndex(2024, 5).getJulianDay().getSolarTime();
  const before = new Date(
    jingzhe.getYear(),
    jingzhe.getMonth() - 1,
    jingzhe.getDay(),
    jingzhe.getHour(),
    Math.max(jingzhe.getMinute() - 1, 0),
    0,
  );
  const after = new Date(
    jingzhe.getYear(),
    jingzhe.getMonth() - 1,
    jingzhe.getDay(),
    jingzhe.getHour(),
    jingzhe.getMinute() + 1,
    0,
  );

  assert.equal(getBaziMonthIndexByDate(2024, before), 1);
  assert.equal(getBaziMonthIndexByDate(2024, after), 2);
});

test('日历工具应先拒绝无效年月和时间对象', () => {
  assert.throws(() => getYearInfo(1899), /年份需在 1900-2100 之间/);
  assert.throws(() => getYearInfo(2101), /年份需在 1900-2100 之间/);
  assert.throws(() => getMonthDaysInfo(2026, 0), /节令月序号需在 1-12 之间/);
  assert.throws(() => getMonthDaysInfo(2026, 13), /节令月序号需在 1-12 之间/);
  assert.throws(() => getCalendarInfo(new Date(Number.NaN)), /时间不是有效日期/);
  assert.throws(() => getBaziMonthIndexByDate(2026, new Date(Number.NaN)), /参考时间不是有效日期/);
  assert.throws(() => getBaziDayIndexByDate(2026, 1, new Date(Number.NaN)), /参考时间不是有效日期/);
});
