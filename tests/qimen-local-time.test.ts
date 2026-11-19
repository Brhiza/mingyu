import assert from 'node:assert/strict';
import test from 'node:test';
import { SolarTerm } from 'tyme4ts';
import { generateQimen } from '../src/systems/qimen/chart';
import { getDivinationTime } from '../src/systems/calendar';

function check(date: Date, offset: number, zone?: string) {
  for (const method of ['zhuanpan', 'feipan'] as const) for (const ju of ['chaibu', 'zhirun'] as const) {
    const chart = generateQimen(date, method, 'hour', ju, undefined, offset, zone);
    const local = getDivinationTime(date, offset).ganzhi, beijing = getDivinationTime(date).ganzhi;
    assert.deepEqual(chart.ganzhi, { ...local, year: beijing.year, month: beijing.month });
    assert.equal(chart.timezoneOffsetMinutes, offset);
  }
}

test('不同固定时区的日时和盘面口径一致', () => {
  for (const offset of [-720, -300, 0, 345, 480, 840]) for (let month = 0; month < 12; month++) {
    check(new Date(Date.UTC(2024, month, 15, month * 2, 30)), offset);
  }
});

test('跨交节、地方午夜及 IANA 历史夏令时保留正确日界', () => {
  for (const index of [1, 3, 11, 12, 23]) {
    const term = SolarTerm.fromIndex(2024, index).getJulianDay().getSolarTime();
    const instant = Date.UTC(term.getYear(), term.getMonth() - 1, term.getDay(), term.getHour() - 8, term.getMinute(), term.getSecond());
    for (const delta of [-1000, 0, 1000]) for (const [offset, zone] of [[-300, 'America/New_York'], [840, 'Pacific/Kiritimati'], [480, 'Asia/Shanghai']] as const) {
      const actualOffset = zone === 'America/New_York' && index >= 11 && index <= 12 ? -240 : offset;
      check(new Date(instant + delta), actualOffset, zone);
    }
  }
  for (const instant of ['2024-03-10T06:59:59Z', '2024-03-10T07:00:00Z', '2024-11-03T05:59:59Z', '2024-11-03T06:00:00Z']) {
    const date = new Date(instant), offset = instant === '2024-03-10T06:59:59Z' || instant === '2024-11-03T06:00:00Z' ? -300 : -240;
    check(date, offset, 'America/New_York');
  }
});
