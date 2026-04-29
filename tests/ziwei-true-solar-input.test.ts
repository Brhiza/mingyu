import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveZiweiTrueSolarBirth } from '../src/lib/ziwei/true-solar-input';
import { calculateTrueSolarTime } from '../src/utils/bazi/trueSolarTime';
import { getTimeIndexFromClock } from '../src/utils/dateUtils';

test('紫微真太阳时排盘应改用修正后的公历日期与时辰', () => {
  const corrected = calculateTrueSolarTime(
    {
      year: 1990,
      month: 4,
      day: 15,
      hour: 1,
      minute: 20,
    },
    73.5,
  ).correctedTime;

  const result = resolveZiweiTrueSolarBirth({
    dateType: 'solar',
    year: '1990',
    month: '04',
    day: '15',
    isLeapMonth: false,
    birthHour: '1',
    birthMinute: '20',
    birthLongitude: '73.5',
  });

  assert.equal(
    result.birthDate,
    `${corrected.year}-${String(corrected.month).padStart(2, '0')}-${String(corrected.day).padStart(2, '0')}`,
  );
  assert.equal(result.birthTimeIndex, getTimeIndexFromClock(corrected.hour, corrected.minute));
});

test('紫微真太阳时缺少经度时应直接报错', () => {
  assert.throws(
    () =>
      resolveZiweiTrueSolarBirth({
        dateType: 'solar',
        year: '1990',
        month: '04',
        day: '15',
        isLeapMonth: false,
        birthHour: '1',
        birthMinute: '20',
        birthLongitude: '',
      }),
    /真太阳时缺少精准时间或经度/,
  );
});
