import assert from 'node:assert/strict';
import test from 'node:test';

import { generateXiaoliuren } from '../../packages/core/src/divination/algorithms/xiaoliuren.ts';

const PALACE_NAMES = ['大安', '留连', '速喜', '赤口', '小吉', '空亡'] as const;

function expectedPalaceIndex(lunarMonth: number, lunarDay: number, hourNumber: number) {
  return (lunarMonth + lunarDay + hourNumber - 3) % 6;
}

test('小六壬：全年逐日十二时辰应与独立月日时公式一致', () => {
  const start = Date.parse('2025-01-01T00:30:00+08:00');
  const hourSamples = [0, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21];
  const seenMonths = new Set<number>();
  const seenPalaces = new Set<string>();

  for (let dayOffset = 0; dayOffset < 365; dayOffset += 1) {
    for (const hour of hourSamples) {
      const date = new Date(start + dayOffset * 86_400_000 + hour * 3_600_000);
      const data = generateXiaoliuren({ customDate: date });
      const hourNumber = data.calculation.hourNumber;
      const expectedMonth = (data.lunarMonth - 1) % 6;
      const expectedDay = (data.lunarMonth + data.lunarDay - 2) % 6;
      const expectedHour = expectedPalaceIndex(data.lunarMonth, data.lunarDay, hourNumber);

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
