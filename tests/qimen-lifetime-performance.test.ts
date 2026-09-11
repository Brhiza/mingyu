import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateQimenLifetime, scanLifetimeDynamicEvents } from 'mingyu-core/divination/qimen';
import { getDivinationTime, resolveCivilTime } from 'mingyu-core/calendar';

test('奇门终身局日级扫描保留 IANA 当地日干支', () => {
  const localNoon = resolveCivilTime({
    year: 2024,
    month: 3,
    day: 10,
    hour: 12,
    minute: 0,
    second: 0,
    timeZoneId: 'America/New_York',
  });
  const expected = getDivinationTime(new Date(localNoon.utcTimestamp), -240).ganzhi.day;
  const lifetime = calculateQimenLifetime({
    birthDateTime: '1990-05-15T14:30:00+08:00',
    timezone: 8,
    timeStandard: 'civil',
  });
  const baseChart = { ...lifetime.baseChart, voidBranches: [expected.charAt(1)] };
  const clusters = scanLifetimeDynamicEvents(
    baseChart,
    lifetime.stages,
    { startDate: '2024-03-10', endDate: '2024-03-10' },
    'zhuanpan',
    'chaibu',
    { timeZoneId: 'America/New_York' },
  );
  const fact = clusters
    .flatMap((cluster) => cluster.triggerDates ?? [])
    .find((item) => item.date === '2024-03-10' && item.ganzhi);
  assert.equal(fact?.ganzhi, expected);
});

test('奇门终身局日级扫描保留 IANA 时区跳过日期的错误', () => {
  const lifetime = calculateQimenLifetime({
    birthDateTime: '1990-05-15T14:30:00+08:00',
    timezone: 8,
    timeStandard: 'civil',
  });

  assert.throws(
    () =>
      scanLifetimeDynamicEvents(
        lifetime.baseChart,
        lifetime.stages,
        { startDate: '2011-12-30', endDate: '2011-12-30' },
        'zhuanpan',
        'chaibu',
        { timeZoneId: 'Pacific/Apia' },
      ),
    /Pacific\/Apia.*不存在/u,
  );
});
