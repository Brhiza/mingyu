import assert from 'node:assert/strict';
import test from 'node:test';

import { generateXiaoliuren } from '../../packages/core/src/divination/algorithms/xiaoliuren.ts';

const PALACE_NAMES = ['大安', '留连', '速喜', '赤口', '小吉', '空亡'] as const;
// 香港天文台公农历对照表的月首，跨年首段取2024年十二月初一。
// https://www.hko.gov.hk/tc/gts/time/calendar/text/files/T2024c.txt
// https://www.hko.gov.hk/tc/gts/time/calendar/text/files/T2025c.txt
const LUNAR_MONTH_STARTS = [
  ['2024-12-31', 12, false],
  ['2025-01-29', 1, false],
  ['2025-02-28', 2, false],
  ['2025-03-29', 3, false],
  ['2025-04-28', 4, false],
  ['2025-05-27', 5, false],
  ['2025-06-25', 6, false],
  ['2025-07-25', 6, true],
  ['2025-08-23', 7, false],
  ['2025-09-22', 8, false],
  ['2025-10-21', 9, false],
  ['2025-11-20', 10, false],
  ['2025-12-20', 11, false],
] as const;

function expectedPalaceIndex(lunarMonth: number, lunarDay: number, hourNumber: number) {
  return (lunarMonth + lunarDay + hourNumber - 3) % 6;
}

test('小六壬：全年逐日十二时辰应与独立月日时公式一致', () => {
  const start = Date.parse('2025-01-01T00:30:00+08:00');
  const hourSamples = [0, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21];
  const monthStarts = LUNAR_MONTH_STARTS.map(([date, month, isLeapMonth]) => ({
    timestamp: Date.parse(`${date}T00:00:00+08:00`),
    month,
    isLeapMonth,
  })).reverse();
  const seenMonths = new Set<number>();
  const seenPalaces = new Set<string>();

  for (let dayOffset = 0; dayOffset < 365; dayOffset += 1) {
    const civilDay = start + dayOffset * 86_400_000;
    const lunar = monthStarts.find((item) => item.timestamp <= civilDay)!;
    const lunarDay = Math.floor((civilDay - lunar.timestamp) / 86_400_000) + 1;
    for (const [hourIndex, hour] of hourSamples.entries()) {
      const date = new Date(start + dayOffset * 86_400_000 + hour * 3_600_000);
      const data = generateXiaoliuren({ customDate: date });
      const hourNumber = hourIndex + 1;
      const expectedMonth = (lunar.month - 1) % 6;
      const expectedDay = (lunar.month + lunarDay - 2) % 6;
      const expectedHour = expectedPalaceIndex(lunar.month, lunarDay, hourNumber);

      assert.equal(data.lunarMonth, lunar.month, date.toISOString());
      assert.equal(data.lunarDay, lunarDay, date.toISOString());
      assert.equal(data.isLeapMonth, lunar.isLeapMonth, date.toISOString());
      assert.equal(data.calculation.hourNumber, hourNumber, date.toISOString());
      seenMonths.add(data.lunarMonth);
      seenPalaces.add(data.primary.name);
      assert.equal(data.sequence.month.index, expectedMonth);
      assert.equal(data.sequence.day.index, expectedDay);
      assert.equal(data.sequence.hour.index, expectedHour);
      assert.equal(data.primary.index, expectedHour);
      assert.equal(data.primary.name, PALACE_NAMES[expectedHour]);
    }
  }

  assert.deepEqual(
    [...seenMonths].sort((a, b) => a - b),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  );
  assert.deepEqual(seenPalaces, new Set(PALACE_NAMES));
});
