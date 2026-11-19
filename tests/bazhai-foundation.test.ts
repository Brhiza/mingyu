import assert from 'node:assert/strict';
import test from 'node:test';
import { SolarTerm } from 'tyme4ts';
import { measureSitDirection } from '../src/systems/compass';
import { birthYearCandidates } from '../src/systems/bazhai/foundation';
import { getCivilDateTimeAtFixedOffset } from '../src/systems/huangji/civil-time';

test('坐山测量保留误差、磁偏角与边界候选', () => {
  const boundary = measureSitDirection({ degree: 7.5, northReference: 'true' });
  assert.deepEqual(boundary.candidates.map((item) => item.sitMountain), ['子', '癸']);
  assert.equal(measureSitDirection({ degree: 355, northReference: 'magnetic', magneticDeclinationDegrees: 10 }).correctedDegree, 5);
  assert.throws(() => measureSitDirection({ degree: 0, northReference: 'magnetic' }));
  assert.throws(() => measureSitDirection({ degree: 0, northReference: 'true', magneticDeclinationDegrees: 1 }));
});

test('立春前后秒与缺失时刻的命卦年份候选明确', () => {
  assert.deepEqual(birthYearCandidates({ year: 2024 }).years, [2023, 2024]);
  assert.deepEqual(birthYearCandidates({ year: 2024, month: 2, day: 4, timezone: 8 }).years, [2023, 2024]);
  assert.deepEqual(birthYearCandidates({ year: 2024, month: 2, day: 4, timeZoneId: 'America/New_York' }).years, [2023, 2024]);
  const term = SolarTerm.fromIndex(2024, 3).getJulianDay().getSolarTime();
  const timestamp = Date.UTC(term.getYear(), term.getMonth() - 1, term.getDay(), term.getHour() - 8, term.getMinute(), term.getSecond());
  for (const offset of [-5, 8, 14]) for (const shift of [-1000, 0, 1000]) {
    const civil = getCivilDateTimeAtFixedOffset(new Date(timestamp + shift), offset);
    const result = birthYearCandidates({ year: civil.year, month: civil.month, day: civil.day, clock: { hour: civil.hour, minute: civil.minute, second: civil.second }, timezone: offset });
    assert.deepEqual(result.years, [shift < 0 ? 2023 : 2024]);
  }
  assert.throws(() => birthYearCandidates({ year: 2011, month: 12, day: 30, timeZoneId: 'Pacific/Apia' }), /不存在/);
  assert.deepEqual(birthYearCandidates({ year: 2011, month: 12, day: 29, timeZoneId: 'Pacific/Apia' }).years, [2011]);
});
