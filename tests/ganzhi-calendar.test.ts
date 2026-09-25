import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearGanzhiCalendarCache,
  formatChinaStandardDateTime,
  getBeijingTodayKey,
  getGanzhiCalendarDayDetail,
  getGanzhiCalendarMonth,
  isGanzhiCalendarDateKeyInRange,
  shiftGanzhiCalendarMonth,
} from '../src/lib/ganzhi-calendar';

test('干支月历生成固定 42 格，并把月外日期标记为可点选', () => {
  clearGanzhiCalendarCache();
  const month = getGanzhiCalendarMonth('2026-09', '2026-09-14');

  assert.equal(month.cells.length, 42);
  assert.equal(month.cells.filter((cell) => cell.isCurrentMonth).length, 30);
  assert.ok(month.cells.some((cell) => !cell.isCurrentMonth));
  assert.equal(month.cells.find((cell) => cell.date === '2026-09-14')?.isToday, true);
  assert.equal(month.cells.find((cell) => cell.date === '2026-09-14')?.lunarDate, '初四');
});

test('月柱只在十二节交接，交节前后月柱和精确北京时间分别可见', () => {
  clearGanzhiCalendarCache();
  const before = getGanzhiCalendarDayDetail('2026-03-05', '2026-03-05');
  const after = getGanzhiCalendarDayDetail('2026-03-06', '2026-03-05');

  assert.equal(before.monthGanzhi, '庚寅');
  assert.equal(after.monthGanzhi, '辛卯');
  assert.equal(before.monthBoundaryAfter?.termName, '惊蛰');
  assert.equal(before.monthBoundaryAfter?.beforePillar, '庚寅');
  assert.equal(before.monthBoundaryAfter?.afterPillar, '辛卯');
  assert.match(before.monthBoundaryAfter?.chinaDateTime ?? '', /^2026-03-05 21:59:/);

  const solarTerm = before.solarTerms.find((term) => term.name === '惊蛰');
  assert.equal(solarTerm?.isJie, true);
  assert.equal(solarTerm?.chinaDateTime, before.monthBoundaryAfter?.chinaDateTime);
});

test('月历值神区分黄黑道，详情按日调用通用黄历事实并保留十二时辰', () => {
  clearGanzhiCalendarCache();
  const detail = getGanzhiCalendarDayDetail('2026-09-14', '2026-09-14');

  assert.equal(detail.valueGod, '明堂');
  assert.equal(detail.valueGodFortune, '黄道');
  assert.equal(detail.dayOfficer, '破');
  assert.equal(detail.almanac.date, '2026-09-14');
  assert.equal(detail.almanac.hours?.length, 13);
  assert.ok(detail.almanac.recommends.length > 0 || detail.almanac.avoids.length > 0);
});

test('个人黄历月格和详情应沿用参与人的择日关系事实', () => {
  clearGanzhiCalendarCache();
  const participant = {
    id: 'case:person',
    name: '本人',
    gender: '男' as const,
    year: '1990',
    month: '1',
    day: '1',
    timeIndex: '6',
    dateType: 'solar' as const,
  };
  const month = getGanzhiCalendarMonth('2026-09', '2026-09-14', [participant]);
  const detail = getGanzhiCalendarDayDetail('2026-09-14', '2026-09-14', [participant]);
  const cell = month.cells.find((item) => item.date === '2026-09-14');

  assert.ok(cell);
  assert.ok(cell.participantRelationFacts.length > 0);
  assert.deepEqual(cell.participantRelationFacts, detail.participantRelationFacts);
  assert.ok(
    detail.almanac.participantNotes.length > 0 ||
      (detail.almanac.participantRelationFacts?.length ?? 0) > 0,
  );
});

test('月份导航和北京时间当前日期使用稳定的公历键', () => {
  clearGanzhiCalendarCache();
  assert.equal(getGanzhiCalendarMonth('1900-01', '2026-09-14').cells[0]?.date, '1899-12-31');
  clearGanzhiCalendarCache();
  assert.equal(getGanzhiCalendarMonth('2100-12', '2026-09-14').cells.at(-1)?.date, '2101-01-08');
  assert.equal(shiftGanzhiCalendarMonth('2026-01', -1), '2025-12');
  assert.equal(shiftGanzhiCalendarMonth('2026-12', 1), '2027-01');
  assert.equal(getBeijingTodayKey(new Date('2026-09-13T16:30:00.000Z')), '2026-09-14');
  assert.equal(
    formatChinaStandardDateTime(Date.parse('2026-09-13T16:30:00.000Z')),
    '2026-09-14 00:30:00',
  );
});

test('日历日期键范围覆盖 1900—2100 年', () => {
  assert.equal(isGanzhiCalendarDateKeyInRange('1900-01-01'), true);
  assert.equal(isGanzhiCalendarDateKeyInRange('2100-12-31'), true);
  assert.equal(isGanzhiCalendarDateKeyInRange('0001-01-01'), false);
  assert.equal(isGanzhiCalendarDateKeyInRange('0099-01-01'), false);
  assert.equal(isGanzhiCalendarDateKeyInRange('1899-12-31'), false);
  assert.equal(isGanzhiCalendarDateKeyInRange('2101-01-01'), false);
  assert.equal(isGanzhiCalendarDateKeyInRange('not-a-date'), false);
});

test('日详情入口对不支持年份返回明确范围错误', () => {
  for (const date of ['0001-01-01', '0099-01-01', '1899-12-31', '2101-01-01']) {
    assert.throws(
      () => getGanzhiCalendarDayDetail(date, '2026-09-14'),
      /日期年份需在 1900-2100 年之间/u,
    );
  }
});
