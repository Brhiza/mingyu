import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateSolarTermEvidence, getDivinationTime } from 'mingyu-core/calendar';
import type { QimenScope } from 'mingyu-core/types';
import type { BaziReverseSource } from '../src/lib/bazi-reverse-input';
import {
  formatQimenRangeContext,
  formatQimenRangeFacts,
  formatQimenRangeInterval,
  formatQimenRangeMoonPhase,
  generateQimenRange,
  isQimenRangeSource,
} from '../src/lib/divination/qimen-range';

const RAIN_WATER_SOURCE: BaziReverseSource = {
  pillars: { year: '甲辰', month: '丙寅', day: '癸丑', hour: '戊午' },
  intervalStart: '2024-02-19 11:00:00',
  intervalEnd: '2024-02-19 13:00:00',
  startTimestamp: Date.parse('2024-02-19T11:00:00+08:00'),
  endTimestamp: Date.parse('2024-02-19T13:00:00+08:00'),
  endExclusive: true,
  timezone: 'Asia/Shanghai',
  offsetHours: 8,
};

function beijingTimestamp(text: string) {
  return Date.parse(`${text.replace(' ', 'T')}+08:00`);
}

function sourceFor(startText: string, endText: string): BaziReverseSource {
  const startTimestamp = beijingTimestamp(startText);
  const endTimestamp = beijingTimestamp(endText);
  return {
    pillars: getDivinationTime(new Date(startTimestamp), 480).ganzhi,
    intervalStart: startText,
    intervalEnd: endText,
    startTimestamp,
    endTimestamp,
    endExclusive: true,
    timezone: 'Asia/Shanghai',
    offsetHours: 8,
  };
}

function rangeFor(
  source: BaziReverseSource,
  options: {
    method?: 'zhuanpan' | 'feipan';
    scope?: QimenScope;
    juMethod?: 'chaibu' | 'zhirun';
  } = {},
) {
  return generateQimenRange({
    source,
    representativeDate: new Date(source.startTimestamp as number),
    ...options,
  });
}

test('雨水交节秒切开时家和日家并保留两端四柱', () => {
  for (const scope of ['hour', 'day'] as const) {
    const range = rangeFor(RAIN_WATER_SOURCE, { scope, juMethod: 'chaibu' });
    assert.equal(range.status, 'conditional');
    assert.equal(range.branches.length, 2);
    assert.deepEqual(
      range.branches.map(({ data }) => [data.timeInfo.solarTerm, data.juShu]),
      [
        ['立春', 8],
        ['雨水', 9],
      ],
    );
    assert.deepEqual(
      range.branches.map(({ data }) => data.ganzhi),
      [RAIN_WATER_SOURCE.pillars, RAIN_WATER_SOURCE.pillars],
    );
    assert.deepEqual(
      [range.branches[0]?.endTimestamp, range.branches[1]?.startTimestamp],
      [beijingTimestamp('2024-02-19 12:13:12'), beijingTimestamp('2024-02-19 12:13:12')],
    );
  }
});

test('雨水中气也切开月家和年家节令背景', () => {
  for (const scope of ['month', 'year'] as const) {
    const range = rangeFor(RAIN_WATER_SOURCE, { scope });
    assert.equal(range.status, 'conditional');
    assert.equal(range.branches.length, 2);
    assert.deepEqual(
      range.branches.map(({ data }) => data.timeInfo.solarTerm),
      ['立春', '雨水'],
    );
    assert.deepEqual(
      range.branches.map(({ data }) => data.ganzhi),
      [RAIN_WATER_SOURCE.pillars, RAIN_WATER_SOURCE.pillars],
    );
  }
});

test('同一离散盘面范围合并为稳定分支并保留月相起止采样', () => {
  const source = sourceFor('2024-02-19 09:00:00', '2024-02-19 11:00:00');
  const range = rangeFor(source, { scope: 'hour', method: 'zhuanpan' });

  assert.equal(range.status, 'stable');
  assert.equal(range.branches.length, 1);
  assert.deepEqual(
    [range.branches[0]?.startTimestamp, range.branches[0]?.endTimestamp],
    [source.startTimestamp, source.endTimestamp],
  );
  const branch = range.branches[0];
  assert.ok(branch);
  assert.equal(branch.moonPhaseEvidence.start.utcTimestamp, source.startTimestamp);
  assert.equal(branch.moonPhaseEvidence.end.utcTimestamp, source.endTimestamp! - 1_000);
  assert.match(formatQimenRangeMoonPhase(branch), /起点参照：北京时间2024-02-19 09:00:00/u);
  assert.match(formatQimenRangeMoonPhase(branch), /终点前一秒参照：北京时间2024-02-19 10:59:59/u);
  assert.match(formatQimenRangeMoonPhase(branch), /照明\d+\.\d+%.*日月黄经差\d+\.\d+°/u);
});

test('民用午夜边界重新核对日期级节令事实', () => {
  const source = sourceFor('2024-02-04 23:00:00', '2024-02-05 01:00:00');
  const range = rangeFor(source, { scope: 'hour' });

  assert.equal(range.status, 'conditional');
  assert.deepEqual(
    [range.branches[0]?.startTimestamp, ...range.branches.map((branch) => branch.endTimestamp)],
    [source.startTimestamp, beijingTimestamp('2024-02-05 00:00:00'), source.endTimestamp],
  );
  for (const branch of range.branches) {
    assert.deepEqual(branch.data.ganzhi, source.pillars);
  }
});

test('节气后五日和十日阶段边界按整秒切分', () => {
  const cases = [
    {
      start: '2024-02-24 12:13:11',
      end: '2024-02-24 12:13:13',
      phases: ['上元', '中元'],
    },
    {
      start: '2024-02-29 12:13:11',
      end: '2024-02-29 12:13:13',
      phases: ['中元', '下元'],
    },
  ] as const;

  for (const { start, end, phases } of cases) {
    const range = rangeFor(sourceFor(start, end), { scope: 'hour' });
    assert.equal(range.branches.length, 2);
    assert.deepEqual(
      range.branches.map(({ data }) => data.seasonality?.jieQiPhase.phase),
      phases,
    );
  }
});

test('排盘方法、级别和定局方法透传到每个分支', () => {
  const source = sourceFor('2024-02-19 09:00:00', '2024-02-19 11:00:00');
  const range = rangeFor(source, { method: 'feipan', scope: 'day', juMethod: 'zhirun' });

  assert.equal(range.branches.length, 1);
  assert.equal(range.branches[0]?.data.method, 'feipan');
  assert.equal(range.branches[0]?.data.scope, 'day');
  assert.equal(range.branches[0]?.data.juMethod, 'zhirun');
});

test('一月的自然日阶段纳入上一年冬至后十日边界', () => {
  const boundary = calculateSolarTermEvidence(2024, 0).utcTimestamp + 10 * 86_400_000;
  const beijingText = (timestamp: number) =>
    new Date(timestamp + 8 * 3_600_000).toISOString().slice(0, 19).replace('T', ' ');
  assert.ok(beijingText(boundary).startsWith('2024-01-01 '));
  const range = rangeFor(sourceFor(beijingText(boundary - 1_000), beijingText(boundary + 1_000)));
  assert.deepEqual(
    range.branches.map(({ data }) => data.seasonality?.jieQiPhase.phase),
    ['中元', '下元'],
  );
  assert.equal(range.branches[0]?.endTimestamp, boundary);
  assert.equal(range.branches[1]?.startTimestamp, boundary);
});

test('范围格式化保留分支、月相参照和北京时间半开语义', () => {
  const range = rangeFor(RAIN_WATER_SOURCE, { scope: 'hour' });
  assert.equal(
    formatQimenRangeInterval(RAIN_WATER_SOURCE.startTimestamp!, RAIN_WATER_SOURCE.endTimestamp!),
    '北京时间 2024-02-19 11:00:00 至 2024-02-19 13:00:00（起点含、终点不含）',
  );
  const facts = formatQimenRangeFacts(range);
  assert.match(facts, /分支1：北京时间 2024-02-19 11:00:00 至 2024-02-19 12:13:12/u);
  assert.match(facts, /分支2：北京时间 2024-02-19 12:13:12 至 2024-02-19 13:00:00/u);
  assert.match(facts, /交节后自然日阶段：/u);
  assert.match(facts, /月相参照（起止采样）/u);
  assert.match(formatQimenRangeContext(range), /各段起点与终点前一秒参照/u);
});

test('范围来源坚持完整机器边界、文本一致和两小时上限', () => {
  assert.equal(isQimenRangeSource(RAIN_WATER_SOURCE), true);
  const oldSource: BaziReverseSource = {
    pillars: RAIN_WATER_SOURCE.pillars,
    intervalStart: RAIN_WATER_SOURCE.intervalStart,
    intervalEnd: RAIN_WATER_SOURCE.intervalEnd,
  };
  assert.equal(isQimenRangeSource(oldSource), false);
  assert.throws(() => rangeFor(oldSource), /完整的北京时间半开机器区间/u);
  assert.throws(
    () => rangeFor({ ...RAIN_WATER_SOURCE, intervalEnd: '2024-02-19 13:00:01' }),
    /文本边界与时间戳不一致/u,
  );
  assert.throws(
    () =>
      rangeFor({
        ...RAIN_WATER_SOURCE,
        intervalEnd: '2024-02-19 13:01:00',
        endTimestamp: beijingTimestamp('2024-02-19 13:01:00'),
      }),
    /两小时上限/u,
  );
  assert.throws(
    () =>
      generateQimenRange({
        source: RAIN_WATER_SOURCE,
        representativeDate: new Date(RAIN_WATER_SOURCE.startTimestamp! + 1_000),
      }),
    /代表时间必须等于四柱候选区间起点/u,
  );
});

test('起止端点的四柱必须始终与反推来源一致', () => {
  assert.throws(
    () =>
      rangeFor({
        ...RAIN_WATER_SOURCE,
        pillars: { ...RAIN_WATER_SOURCE.pillars, hour: '甲子' },
      }),
    /起点的干支与四柱候选来源不一致/u,
  );
  assert.throws(
    () =>
      rangeFor({
        ...RAIN_WATER_SOURCE,
        startTimestamp: RAIN_WATER_SOURCE.startTimestamp! + 500,
        intervalStart: '2024-02-19 11:00:00',
      }),
    /完整的北京时间半开机器区间/u,
  );
});
