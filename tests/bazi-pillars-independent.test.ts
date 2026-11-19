import assert from 'node:assert/strict';
import test from 'node:test';
import { SolarTerm } from 'tyme4ts';
import { calculateBaziPillars } from '../src/systems/bazi/pillars';

const keys = ['year', 'month', 'day', 'hour'] as const;

test('十三个时辰分别对应时支，并明确中点不等于精确出生', async () => {
  const branches = [...'子丑寅卯辰巳午未申酉戌亥子'];
  const hours = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 23];
  for (let index = 0; index < branches.length; index++) {
    const chart = await calculateBaziPillars({ year: 1990, month: 5, day: 15, clock: { kind: 'shichen', index } });
    const exact = await calculateBaziPillars({ year: 1990, month: 5, day: 15, clock: { kind: 'exact', hour: hours[index], minute: index === 0 || index === 12 ? 30 : 0, second: 0 } });
    assert.equal(chart.pillars.hour.zhi, branches[index]);
    assert.deepEqual(chart.pillars, exact.pillars);
    assert.equal(chart.basis.precision, 'shichen'); assert.match(chart.basis.limitation!, /不能据此断言/);
  }
});

test('闰二月与对应公历同一瞬时盘面相同', async () => {
  const clock = { kind: 'exact', hour: 12, minute: 0, second: 0 } as const;
  const lunar = await calculateBaziPillars({ year: 2023, month: 2, day: 1, calendar: 'lunar', leapMonth: true, clock });
  const solar = await calculateBaziPillars({ year: 2023, month: 3, day: 22, clock });
  assert.equal(lunar.basis.utcTimestamp, solar.basis.utcTimestamp); assert.deepEqual(lunar.pillars, solar.pillars);
});

test('全年十二次节气月切换在交节秒前后发生', async () => {
  for (let index = 0; index < 12; index++) {
    const term = SolarTerm.fromIndex(2024, 3).next(index * 2).getJulianDay().getSolarTime();
    const instant = Date.UTC(term.getYear(), term.getMonth() - 1, term.getDay(), term.getHour() - 8, term.getMinute(), term.getSecond());
    const chartAt = async (timestamp: number) => {
      const date = new Date(timestamp + 8 * 3_600_000);
      return calculateBaziPillars({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(),
        clock: { kind: 'exact', hour: date.getUTCHours(), minute: date.getUTCMinutes(), second: date.getUTCSeconds() }, timezone: 8 });
    };
    const before = await chartAt(instant - 1000), at = await chartAt(instant);
    assert.equal(at.basis.utcTimestamp, instant);
    assert.notEqual(before.pillars.month.ganZhi, at.pillars.month.ganZhi, `交节 ${index}`);
  }
});

test('纽约夏令时前后和回拨两次当地时间与对应固定时区盘面一致', async () => {
  for (const [month, day, hour, minute, second, timezone] of [[3, 10, 1, 59, 59, -5], [3, 10, 3, 0, 0, -4], [11, 3, 1, 30, 0, -4], [11, 3, 1, 30, 0, -5]]) {
    const birth = { year: 2024, month, day, clock: { kind: 'exact' as const, hour, minute, second }, timezone };
    const local = await calculateBaziPillars({ ...birth, timeZoneId: 'America/New_York' });
    const fixed = await calculateBaziPillars(birth);
    assert.equal(local.basis.utcTimestamp, fixed.basis.utcTimestamp);
    for (const key of keys) assert.equal(local.pillars[key].ganZhi, fixed.pillars[key].ganZhi);
  }
});

test('无效日期、缺失经度及夏令时歧义不静默处理', async () => {
  const base = { year: 2024, month: 1, day: 1, clock: { kind: 'exact' as const, hour: 12, minute: 0, second: 0 } };
  await assert.rejects(() => calculateBaziPillars({ ...base, month: 2, day: 30 }));
  await assert.rejects(() => calculateBaziPillars({ ...base, timeStandard: 'true-solar' }));
  await assert.rejects(() => calculateBaziPillars({ ...base, clock: { kind: 'shichen', index: 13 } }));
  await assert.rejects(() => calculateBaziPillars({ ...base, month: 11, day: 3, clock: { kind: 'exact', hour: 1, minute: 30, second: 0 }, timeZoneId: 'America/New_York' }), /歧义/);
});

