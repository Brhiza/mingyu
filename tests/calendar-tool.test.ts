import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getBaziDayIndexByDate,
  getBaziMonthIndexByDate,
  getCalendarInfo,
  getMonthDaysInfo,
  resolveBaziFortuneDate,
  getYearInfo,
} from '@core/bazi/calendarTool';

test('跨年末尾的日历信息应能找到下一节气', () => {
  const info = getCalendarInfo(new Date('2026-12-31T12:00:00+08:00'));

  assert.equal(info.jieQi.prev, '冬至 (2026-12-22)');
  assert.equal(info.jieQi.next, '小寒 (2027-01-05)');
});

test('农历日期格式不应重复输出月字', () => {
  const info = getCalendarInfo(new Date('2026-01-01T12:00:00+08:00'));

  assert.equal(info.lunarDate, '2025年十一月十三');
});

test('交节当小时内应按实际分钟区分前后节气', () => {
  const before = getCalendarInfo(new Date('2026-11-07T17:51:00+08:00'));
  const after = getCalendarInfo(new Date('2026-11-07T17:53:00+08:00'));

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
  const before = new Date('2024-03-05T10:21:00+08:00');
  const after = new Date('2024-03-05T10:23:00+08:00');

  assert.equal(getBaziMonthIndexByDate(2024, before), 1);
  assert.equal(getBaziMonthIndexByDate(2024, after), 2);
  assert.equal(getBaziDayIndexByDate(2024, 1, before), 31);
  assert.equal(getBaziDayIndexByDate(2024, 2, after), 1);
  assert.deepEqual(resolveBaziFortuneDate('2024-03-05'), {
    date: '2024-03-05',
    referenceTimestamp: Date.parse('2024-03-05T12:00:00+08:00'),
    year: 2024,
    month: 2,
    day: 1,
  });
});

test('深夜交节日的日期直传应按北京时间正午归入旧月', () => {
  assert.deepEqual(resolveBaziFortuneDate('2022-09-07'), {
    date: '2022-09-07',
    referenceTimestamp: Date.parse('2022-09-07T12:00:00+08:00'),
    year: 2022,
    month: 7,
    day: 32,
  });
});

test('公历日期应解析为节气年、寅月起序号和月内流日序号', () => {
  assert.deepEqual(resolveBaziFortuneDate('2026-09-22'), {
    date: '2026-09-22',
    referenceTimestamp: Date.parse('2026-09-22T12:00:00+08:00'),
    year: 2026,
    month: 8,
    day: 16,
  });
  assert.deepEqual(resolveBaziFortuneDate('2027-01-01'), {
    date: '2027-01-01',
    referenceTimestamp: Date.parse('2027-01-01T12:00:00+08:00'),
    year: 2026,
    month: 11,
    day: 26,
  });
});

test('流日应在子初 23:00 换日', () => {
  const beforeZi = new Date('2026-09-22T22:59:59+08:00');
  const afterZi = new Date('2026-09-22T23:00:00+08:00');

  assert.equal(getBaziDayIndexByDate(2026, 8, beforeZi), 16);
  assert.equal(getBaziDayIndexByDate(2026, 8, afterZi), 17);
});

test('日历工具应先拒绝无效年月和时间对象', () => {
  assert.throws(() => getYearInfo(1899), /年份需在 1900-2100 之间/);
  assert.throws(() => getYearInfo(2101), /年份需在 1900-2100 之间/);
  assert.throws(() => getMonthDaysInfo(2026, 0), /节令月序号需在 1-12 之间/);
  assert.throws(() => getMonthDaysInfo(2026, 13), /节令月序号需在 1-12 之间/);
  assert.throws(() => resolveBaziFortuneDate('1900-01-01'), /不在支持的节气年范围内/);
  assert.throws(() => getCalendarInfo(new Date(Number.NaN)), /时间不是有效日期/);
  assert.throws(() => getBaziMonthIndexByDate(2026, new Date(Number.NaN)), /参考时间不是有效日期/);
  assert.throws(() => getBaziDayIndexByDate(2026, 1, new Date(Number.NaN)), /参考时间不是有效日期/);
});

test('子初流日切片连续覆盖交节月，切片内部日柱与当前时刻一致', () => {
  for (const year of [2022, 2024]) {
    for (const month of getYearInfo(year).months) {
      const days = getMonthDaysInfo(year, month.index);
      assert.equal(days[0].timeRange.startTimestamp, month.timeRange.startTimestamp);
      assert.equal(days.at(-1)!.timeRange.endTimestamp, month.timeRange.endTimestamp);
      for (let index = 0; index < days.length; index++) {
        const day = days[index];
        const { startTimestamp, endTimestamp } = day.timeRange;
        assert.ok(endTimestamp > startTimestamp);
        assert.ok(endTimestamp - startTimestamp <= 24 * 60 * 60 * 1000);
        if (index > 0) assert.equal(startTimestamp, days[index - 1].timeRange.endTimestamp);
        const midpoint = new Date(Math.floor((startTimestamp + endTimestamp) / 2));
        assert.equal(getBaziDayIndexByDate(year, month.index, midpoint), day.day);
        assert.equal(
          getCalendarInfo(midpoint).ganZhi.day,
          day.ganZhi,
          `${year}/${month.index}/${day.solarDate}`,
        );
      }
    }
  }
});
