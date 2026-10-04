import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateQimenLifetime } from '../packages/core/src/divination/algorithms/qimen/lifetime';
import { scanLifetimeDynamicEvents } from '../packages/core/src/divination/algorithms/qimen/helpers/lifetime-dynamic';
import { getDivinationTime } from '../packages/core/src/calendar/timeManager';

function annualClusters(startDate: string, endDate = startDate, timeZoneId?: string) {
  const result = calculateQimenLifetime({
    birthDateTime: '1990-05-15T14:30:00',
    ...(timeZoneId ? { timeZoneId } : { timezone: 8 }),
    periodRange: { startDate, endDate },
  });
  return result.eventClusters!.filter((cluster) => /:(?:before|after)-lichun:/u.test(cluster.key));
}

test('一月单日沿用立春前干支年，立春后单日切到新年', () => {
  const january = annualClusters('2024-01-15');
  assert.equal(january.length, 1);
  assert.match(january[0].key, /^cluster:2024:癸卯:before-lichun:/u);
  assert.equal(january[0].timeSpan, '2024年（癸卯）立春前（2024-01-15）');
  assert.match(january[0].triggerFact, /癸卯太岁/u);

  const after = annualClusters('2024-02-05');
  assert.equal(after.length, 1);
  assert.match(after[0].key, /^cluster:2024:甲辰:after-lichun:/u);
  assert.equal(after[0].timeSpan, '2024年（甲辰）立春后（2024-02-05）');
});

test('立春当日同时保留交节前后两个年度片段及真实交节时刻', () => {
  const clusters = annualClusters('2024-02-04');
  assert.deepEqual(
    clusters.map((cluster) => cluster.key.split(':').slice(1, 4)),
    [
      ['2024', '癸卯', 'before-lichun'],
      ['2024', '甲辰', 'after-lichun'],
    ],
  );
  assert.equal(clusters[0].timeSpan, '2024年（癸卯）立春前（2024-02-04 16:27:07前）');
  assert.equal(clusters[1].timeSpan, '2024年（甲辰）立春后（2024-02-04 16:27:07起）');
});

test('公元一年的立春前日期明确拒绝不存在的上一公历年', () => {
  const birth = calculateQimenLifetime({ birthDateTime: '1990-05-15T14:30:00+08:00' });
  assert.throws(
    () =>
      scanLifetimeDynamicEvents(birth.baseChart, [], {
        startDate: '0001-01-15',
        endDate: '0001-01-15',
      }),
    (error: unknown) => {
      assert.ok(error instanceof RangeError);
      assert.match(error.message, /1年动态年盘生成失败：立春前的上一干支年超出公历年份支持范围/u);
      assert.ok(error.cause instanceof RangeError);
      return true;
    },
  );
});

test('精确交运瞬时只关联所在立春片段，交节当日日级事实仍保留', () => {
  const birth = calculateQimenLifetime({ birthDateTime: '1990-05-15T14:30:00+08:00' });
  const boundary = '2024-02-04T16:27:07+08:00';
  const stages = [
    {
      ...birth.stages[0],
      stageIndex: 0,
      calendarStart: '2024-01-01',
      calendarEnd: '2024-02-04',
      startDateTime: '2024-01-01T00:00:00+08:00',
      endDateTimeExclusive: boundary,
    },
    {
      ...birth.stages[1],
      stageIndex: 1,
      calendarStart: '2024-02-04',
      calendarEnd: '2024-12-31',
      startDateTime: boundary,
      endDateTimeExclusive: '2025-01-01T00:00:00+08:00',
    },
  ];
  const dayBranch = getDivinationTime(new Date('2024-02-04T12:00:00+08:00'), 480).ganzhi.day[1];
  const baseChart = { ...birth.baseChart, voidBranches: [dayBranch] };
  const clusters = scanLifetimeDynamicEvents(baseChart, stages, {
    startDate: '2024-02-04',
    endDate: '2024-02-04',
  });
  const annual = clusters.filter((cluster) => /:(?:before|after)-lichun:/u.test(cluster.key));
  assert.deepEqual(
    annual.map((cluster) => cluster.stageIndices),
    [[0], [1]],
  );
  assert.ok(clusters.some((cluster) => cluster.key.includes(':day:')));
});

test('IANA 时区按当地立春日期和瞬时拆分年度片段', () => {
  const crossing = annualClusters('2026-02-03', '2026-02-03', 'America/New_York');
  assert.deepEqual(
    crossing.map((cluster) => cluster.key.split(':').slice(2, 4)),
    [
      ['乙巳', 'before-lichun'],
      ['丙午', 'after-lichun'],
    ],
  );
  assert.match(crossing[0].timeSpan, /2026-02-03 15:02:08前/u);
  assert.match(crossing[1].timeSpan, /2026-02-03 15:02:08起/u);
  assert.deepEqual(
    annualClusters('2026-02-04', '2026-02-04', 'America/New_York').map(
      (cluster) => cluster.key.split(':')[2],
    ),
    ['丙午'],
  );
});

test('跨年扫描只生成一次上一干支年的丑月交节事件', () => {
  const result = calculateQimenLifetime({
    birthDateTime: '1990-05-15T14:30:00+08:00',
    periodRange: { startDate: '2027-01-01', endDate: '2028-01-31' },
  });
  assert.deepEqual(
    result.eventClusters
      ?.filter((cluster) => cluster.key.includes(':month-clash:丑:2028-01-06'))
      .map((cluster) => cluster.key),
    ['cluster:2027:month-clash:丑:2028-01-06'],
  );
});
