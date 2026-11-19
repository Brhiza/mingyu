import assert from 'node:assert/strict';
import test from 'node:test';
import { SolarTerm, SolarTime } from 'tyme4ts';
import { getMonthCommanderAt } from '../src/systems/bazi/season';
import { calculateUnknownBaziTime } from '../src/systems/bazi/unknown-time';

const DAY = 86_400_000;
function termInstant(year: number, index: number) {
  const t = SolarTerm.fromIndex(year, index).getJulianDay().getSolarTime();
  return Date.UTC(t.getYear(), t.getMonth() - 1, t.getDay(), t.getHour() - 8, t.getMinute(), t.getSecond());
}

test('十二月令司权交节及分日覆盖公开整秒边界', () => {
  for (const year of [1900, 1986, 2024, 2100]) for (let index = 1; index < 24; index += 2) {
    const start = termInstant(year, index), nextTerm = SolarTerm.fromIndex(year, index).next(2).getJulianDay().getSolarTime();
    const end = Date.UTC(nextTerm.getYear(), nextTerm.getMonth() - 1, nextTerm.getDay(), nextTerm.getHour() - 8, nextTerm.getMinute(), nextTerm.getSecond());
    for (const days of [0, 3, 5, 7, 9, 10, 12, 14, 15, 19, 20, 28]) for (const delta of [-1000, 0, 1000]) {
      const timestamp = start + days * DAY + delta;
      if (timestamp >= end || timestamp < start - 1000) continue;
      const d = new Date(timestamp + 8 * 3_600_000);
      const solar = SolarTime.fromYmdHms(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds());
      const monthBranch = solar.getLunarHour().getEightChar().getMonth().getEarthBranch().getName();
      const fact = getMonthCommanderAt(timestamp);
      // 公开的交节整秒即进入新阶段；旧模型对照单独保留。
      if (delta === 0 && timestamp + 1000 < end) assert.equal(fact.stem, getMonthCommanderAt(timestamp + 1000).stem, `${year}/${index}/${days}/整秒`);
      assert.equal(fact.branch, monthBranch);
      assert.ok(fact.startTimestamp <= timestamp && timestamp < fact.endTimestamp);
    }
  }
});

test('未知时辰在司权变化秒切分，即使四柱不变', async () => {
  const instant = termInstant(2024, 3) + 7 * DAY;
  const local = new Date(instant + 8 * 3_600_000);
  const result = await calculateUnknownBaziTime({ year: local.getUTCFullYear(), month: local.getUTCMonth() + 1, day: local.getUTCDate(), timezone: 8 });
  const before = result.segments.find((segment) => segment.endTimestamp === instant)!;
  const after = result.segments.find((segment) => segment.startTimestamp === instant)!;
  assert.ok(before && after);
  assert.equal(before.monthCommander.stem, '戊'); assert.equal(after.monthCommander.stem, '丙');
  assert.deepEqual(Object.values(before.pillars).map((pillar) => pillar.ganZhi), Object.values(after.pillars).map((pillar) => pillar.ganZhi));
  assert.equal(result.commonMonthCommander, null);
  assert.deepEqual(result.possibleMonthCommanders, ['戊', '丙']);
});
