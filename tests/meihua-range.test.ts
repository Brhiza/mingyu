import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateSolarTermsForYear } from 'mingyu-core/calendar';
import type { MeihuaDivinationMethod, MeihuaSettings } from 'mingyu-core/types';
import type { BaziReverseSource } from '../src/lib/bazi-reverse-input';
import {
  formatMeihuaRangeContext,
  formatMeihuaRangeFacts,
  formatMeihuaRangeInterval,
  generateMeihuaRange,
  isMeihuaRangeSource,
} from '../src/lib/divination/meihua-range';

const CROSS_MIDNIGHT_SOURCE: BaziReverseSource = {
  pillars: { year: '甲辰', month: '丙寅', day: '己亥', hour: '甲子' },
  intervalStart: '2024-02-04 23:00:00',
  intervalEnd: '2024-02-05 01:00:00',
  startTimestamp: Date.parse('2024-02-04T23:00:00+08:00'),
  endTimestamp: Date.parse('2024-02-05T01:00:00+08:00'),
  endExclusive: true,
  timezone: 'Asia/Shanghai',
  offsetHours: 8,
};

const STABLE_SOURCE: BaziReverseSource = {
  pillars: { year: '甲辰', month: '丙寅', day: '戊戌', hour: '癸亥' },
  intervalStart: '2024-02-04 21:00:00',
  intervalEnd: '2024-02-04 23:00:00',
  startTimestamp: Date.parse('2024-02-04T21:00:00+08:00'),
  endTimestamp: Date.parse('2024-02-04T23:00:00+08:00'),
  endExclusive: true,
  timezone: 'Asia/Shanghai',
  offsetHours: 8,
};

const RAIN_WATER_SOURCE: BaziReverseSource = {
  pillars: { year: '甲辰', month: '丙寅', day: '癸丑', hour: '戊午' },
  intervalStart: '2024-02-19 12:13:00',
  intervalEnd: '2024-02-19 12:13:24',
  startTimestamp: Date.parse('2024-02-19T12:13:00+08:00'),
  endTimestamp: Date.parse('2024-02-19T12:13:24+08:00'),
  endExclusive: true,
  timezone: 'Asia/Shanghai',
  offsetHours: 8,
};

function rangeFor(source: BaziReverseSource, settings?: MeihuaSettings) {
  return generateMeihuaRange({
    source,
    representativeDate: new Date(source.startTimestamp as number),
    settings,
  });
}

test('梅花年月日时起卦在民用零点分段并保留手算取数', () => {
  const range = rangeFor(CROSS_MIDNIGHT_SOURCE, { method: 'time' });

  assert.equal(range.status, 'conditional');
  assert.deepEqual(
    range.branches.map((branch) => [branch.startTimestamp, branch.endTimestamp]),
    [
      [CROSS_MIDNIGHT_SOURCE.startTimestamp, Date.parse('2024-02-05T00:00:00+08:00')],
      [Date.parse('2024-02-05T00:00:00+08:00'), CROSS_MIDNIGHT_SOURCE.endTimestamp],
    ],
  );
  assert.deepEqual(
    range.branches.map(({ data }) => ({
      lunarDay: data.calculation.day,
      upper: data.calculation.upperTrigramIndex,
      lower: data.calculation.lowerTrigramIndex,
      moving: data.calculation.movingYaoIndex,
      ganzhi: data.ganzhi,
    })),
    [
      {
        lunarDay: 25,
        upper: 1,
        lower: 2,
        moving: 6,
        ganzhi: CROSS_MIDNIGHT_SOURCE.pillars,
      },
      {
        lunarDay: 26,
        upper: 2,
        lower: 3,
        moving: 1,
        ganzhi: CROSS_MIDNIGHT_SOURCE.pillars,
      },
    ],
  );

  const facts = formatMeihuaRangeFacts(range);
  assert.match(facts, /分支1：北京时间 2024-02-04 23:00:00 至 2024-02-05 00:00:00/u);
  assert.match(facts, /分支2：北京时间 2024-02-05 00:00:00 至 2024-02-05 01:00:00/u);
  for (const branch of range.branches) {
    assert.match(facts, new RegExp(branch.data.originalName, 'u'));
  }
  assert.match(formatMeihuaRangeContext(range), /四柱候选范围：/u);
  assert.doesNotMatch(formatMeihuaRangeContext(range), /当前时间/u);
});

test('所有梅花起法都从区间设置生成对应方法事实', () => {
  const cases: Array<{ expected: MeihuaDivinationMethod; settings: MeihuaSettings }> = [
    { expected: 'time', settings: { method: 'time' } },
    { expected: 'timeTrigram', settings: { method: 'timeTrigram' } },
    { expected: 'number', settings: { method: 'number', number: 17 } },
    { expected: 'sound', settings: { method: 'sound', soundCount: 5 } },
    {
      expected: 'character',
      settings: {
        method: 'character',
        characterText: '春风',
        characterStrokeCounts: [9, 4],
      },
    },
    {
      expected: 'direction',
      settings: { method: 'direction', direction: 'north', objectType: 'water' },
    },
    { expected: 'random', settings: { method: 'random', seed: 'synthetic-range' } },
  ];

  for (const { expected, settings } of cases) {
    const range = rangeFor(STABLE_SOURCE, settings);
    assert.equal(range.branches.length, 1);
    assert.equal(range.branches[0]?.data.calculation.methodKey, expected);
  }
});

test('随机区间只抽取一次并复用原始轨迹', () => {
  let randomCalls = 0;
  const range = rangeFor(CROSS_MIDNIGHT_SOURCE, {
    method: 'random',
    random: () => {
      randomCalls += 1;
      return 0.5;
    },
  });

  assert.equal(randomCalls, 3);
  assert.equal(range.status, 'stable');
  assert.equal(range.branches.length, 1);
  const trace = range.branches[0]?.data.meta?.random;
  assert.ok(trace);
  assert.equal(trace.samples.length, 3);
  assert.equal(range.branches[0]?.data.calculation.methodKey, 'random');
});

test('没有事实变化的区间合并为稳定半开范围', () => {
  const range = rangeFor(STABLE_SOURCE, { method: 'number', number: 19 });

  assert.equal(range.status, 'stable');
  assert.equal(range.branches.length, 1);
  assert.deepEqual(
    [range.branches[0]?.startTimestamp, range.branches[0]?.endTimestamp],
    [STABLE_SOURCE.startTimestamp, STABLE_SOURCE.endTimestamp],
  );
  assert.equal(
    formatMeihuaRangeInterval(STABLE_SOURCE.startTimestamp!, STABLE_SOURCE.endTimestamp!),
    '北京时间 2024-02-04 21:00:00 至 2024-02-04 23:00:00（起点含、终点不含）',
  );
});

test('节气整秒边界进入切分核验并保留源四柱', () => {
  const rainWater = calculateSolarTermsForYear(2024).find((item) => item.name === '雨水');
  assert.ok(rainWater);
  assert.equal(rainWater.utcTimestamp, Date.parse('2024-02-19T12:13:12+08:00'));

  const range = rangeFor(RAIN_WATER_SOURCE, { method: 'time' });

  assert.equal(range.status, 'stable');
  assert.equal(range.branches.length, 1);
  assert.equal(range.branches[0]?.data.analysis.season, '春');
  assert.deepEqual(range.branches[0]?.data.ganzhi, RAIN_WATER_SOURCE.pillars);
});

test('区间来源必须包含完整机器边界且不能超过两小时', () => {
  assert.equal(isMeihuaRangeSource(CROSS_MIDNIGHT_SOURCE), true);
  assert.equal(
    isMeihuaRangeSource({
      pillars: CROSS_MIDNIGHT_SOURCE.pillars,
      intervalStart: CROSS_MIDNIGHT_SOURCE.intervalStart,
      intervalEnd: CROSS_MIDNIGHT_SOURCE.intervalEnd,
    }),
    false,
  );
  assert.throws(
    () =>
      rangeFor({
        pillars: CROSS_MIDNIGHT_SOURCE.pillars,
        intervalStart: CROSS_MIDNIGHT_SOURCE.intervalStart,
        intervalEnd: CROSS_MIDNIGHT_SOURCE.intervalEnd,
      }),
    /完整的北京时间半开机器区间/u,
  );

  assert.throws(
    () => rangeFor({ ...CROSS_MIDNIGHT_SOURCE, intervalEnd: '2024-02-05 01:00:01' }),
    /文本边界与时间戳不一致/u,
  );
  assert.throws(
    () =>
      rangeFor({
        ...CROSS_MIDNIGHT_SOURCE,
        intervalEnd: '2024-02-05 02:00:00',
        endTimestamp: Date.parse('2024-02-05T02:00:00+08:00'),
      }),
    /两小时上限/u,
  );
  assert.throws(
    () =>
      generateMeihuaRange({
        source: CROSS_MIDNIGHT_SOURCE,
        representativeDate: new Date(CROSS_MIDNIGHT_SOURCE.startTimestamp! + 1_000),
        settings: { method: 'time' },
      }),
    /代表时间必须等于四柱候选区间起点/u,
  );
});
