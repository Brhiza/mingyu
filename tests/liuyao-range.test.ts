import assert from 'node:assert/strict';
import test from 'node:test';
import { getDivinationTime } from 'mingyu-core/calendar';
import { generateLiuyao, type LiuyaoGenerationOptions } from 'mingyu-core/divination/liuyao';
import type { BaziReverseSource } from '../src/lib/bazi-reverse-input';
import {
  formatLiuyaoRangeBackground,
  formatLiuyaoRangeContext,
  formatLiuyaoRangeFacts,
  formatLiuyaoRangeInterval,
  formatLiuyaoRangeOrigin,
  generateLiuyaoRange,
  isLiuyaoRangeSource,
} from '../src/lib/divination/liuyao-range';

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

const RAIN_WATER_SOURCE = sourceFor('2024-02-19 11:00:00', '2024-02-19 13:00:00');
const CROSS_MIDNIGHT_SOURCE = sourceFor('2024-02-04 23:00:00', '2024-02-05 01:00:00');
const STABLE_SOURCE = sourceFor('2024-02-19 09:00:00', '2024-02-19 11:00:00');

const FIXED_COIN_THROWS = [
  { coins: [2, 2, 3], total: 7 },
  { coins: [2, 3, 3], total: 8 },
  { coins: [3, 3, 3], total: 9 },
  { coins: [2, 2, 2], total: 6 },
  { coins: [2, 2, 3], total: 7 },
  { coins: [2, 3, 3], total: 8 },
] as const;

const MANUAL_OPTIONS = {
  method: 'manual',
  yaos: [7, 8, 9, 6, 7, 8],
} as const satisfies LiuyaoGenerationOptions;

function rangeFor(source: BaziReverseSource, options?: LiuyaoGenerationOptions) {
  const startTimestamp = source.startTimestamp;
  if (typeof startTimestamp !== 'number') throw new Error('合成来源缺少起点时间戳。');
  return generateLiuyaoRange({
    source,
    representativeDate: new Date(startTimestamp),
    options,
  });
}

test('雨水交节切分历法背景并复用同一六爻原始盘面', () => {
  const range = rangeFor(RAIN_WATER_SOURCE, MANUAL_OPTIONS);
  assert.equal(range.status, 'conditional');
  assert.equal(range.branches.length, 2);
  assert.deepEqual(
    range.branches.map(({ background }) => background.solarTerm),
    ['立春', '雨水'],
  );
  assert.deepEqual(
    [range.branches[0]?.endTimestamp, range.branches[1]?.startTimestamp],
    [beijingTimestamp('2024-02-19 12:13:12'), beijingTimestamp('2024-02-19 12:13:12')],
  );
  assert.equal(range.branches[0]?.data, range.branches[1]?.data);
  assert.deepEqual(range.branches[0]?.data.yaoArray, MANUAL_OPTIONS.yaos);
  assert.equal(range.branches[0]?.data.timestamp, RAIN_WATER_SOURCE.startTimestamp);
  assert.match(formatLiuyaoRangeBackground(range.branches[1]!), /公历2024-02-19/u);
  assert.match(formatLiuyaoRangeBackground(range.branches[1]!), /农历/u);
  assert.match(formatLiuyaoRangeBackground(range.branches[1]!), /节气雨水/u);
});

test('民用零点边界切分日期和农历背景而不重复起卦', () => {
  const range = rangeFor(CROSS_MIDNIGHT_SOURCE, MANUAL_OPTIONS);
  assert.equal(range.status, 'conditional');
  assert.equal(range.branches.length, 2);
  assert.deepEqual(
    [range.branches[0]?.startTimestamp, ...range.branches.map((branch) => branch.endTimestamp)],
    [
      CROSS_MIDNIGHT_SOURCE.startTimestamp,
      beijingTimestamp('2024-02-05 00:00:00'),
      CROSS_MIDNIGHT_SOURCE.endTimestamp,
    ],
  );
  assert.deepEqual(
    range.branches.map(({ background }) => background.solar.day),
    [4, 5],
  );
  assert.deepEqual(
    range.branches.map(({ background }) => background.lunar.dayNumber),
    [25, 26],
  );
  assert.equal(range.branches[0]?.data, range.branches[1]?.data);
});

test('四种起法均只生成一次原始卦盘并保持来源方法及记录', () => {
  const cases: Array<{
    method: LiuyaoGenerationOptions['method'];
    options: LiuyaoGenerationOptions;
  }> = [
    { method: 'time', options: { method: 'time' } },
    { method: 'manual', options: MANUAL_OPTIONS },
    {
      method: 'coins',
      options: { method: 'coins', coinThrows: FIXED_COIN_THROWS },
    },
    { method: 'yarrow', options: { method: 'yarrow', seed: 'synthetic-liuyao-range' } },
  ];

  for (const { method, options } of cases) {
    const range = rangeFor(STABLE_SOURCE, options);
    assert.equal(range.status, 'stable');
    assert.equal(range.branches.length, 1);
    const branch = range.branches[0];
    assert.ok(branch);
    assert.equal(branch.data.generation?.method, method);
    assert.equal(branch.data.timestamp, STABLE_SOURCE.startTimestamp);
    if (method === 'coins') assert.deepEqual(branch.data.generation?.coinThrows, FIXED_COIN_THROWS);
    if (method === 'manual') assert.deepEqual(branch.data.yaoArray, MANUAL_OPTIONS.yaos);
  }
});

test('随机三钱在范围模式只调用一次并保留完整随机轨迹', () => {
  let randomCalls = 0;
  const range = rangeFor(RAIN_WATER_SOURCE, {
    method: 'coins',
    random: () => {
      randomCalls += 1;
      return 0.25;
    },
  });
  assert.equal(randomCalls, 18);
  assert.equal(range.branches.length, 2);
  const first = range.branches[0]?.data;
  assert.ok(first);
  assert.equal(first.meta?.random?.samples.length, 18);
  assert.equal(range.branches[0]?.data, range.branches[1]?.data);
});

test('时间起卦严格复用候选起点结果并公开一次起卦来源', () => {
  const startTimestamp = STABLE_SOURCE.startTimestamp;
  assert.ok(typeof startTimestamp === 'number');
  const expected = generateLiuyao(new Date(startTimestamp), { method: 'time' });
  const range = rangeFor(STABLE_SOURCE, { method: 'time' });
  assert.deepEqual(range.branches[0]?.data, expected);
  assert.match(formatLiuyaoRangeOrigin(range), /本次时间起卦采用候选起点/u);
  assert.match(formatLiuyaoRangeOrigin(range), /各段沿用本次卦象/u);
});

test('范围格式化保留起卦来源、独立背景和解读模板', () => {
  const range = rangeFor(RAIN_WATER_SOURCE, MANUAL_OPTIONS);
  const facts = formatLiuyaoRangeFacts(range, undefined, { liuyaoTemplate: 'caifu' });
  assert.match(
    formatLiuyaoRangeInterval(RAIN_WATER_SOURCE.startTimestamp!, RAIN_WATER_SOURCE.endTimestamp!),
    /北京时间 2024-02-19 11:00:00 至 2024-02-19 13:00:00（起点含、终点不含）/u,
  );
  assert.match(facts, /本次采用原始手工爻值记录/u);
  assert.match(facts, /分支1：北京时间 2024-02-19 11:00:00 至 2024-02-19 12:13:12/u);
  assert.match(facts, /历法背景：公历2024-02-19/u);
  assert.match(facts, /节气雨水/u);
  assert.ok(facts.includes(range.branches[0]!.data.originalName));
  assert.match(formatLiuyaoRangeContext(range), /各段复用本次原始卦盘，并分别使用该段历法背景/u);
});

test('范围来源坚持完整机器边界、文本一致和两小时上限', () => {
  assert.equal(isLiuyaoRangeSource(RAIN_WATER_SOURCE), true);
  const oldSource: BaziReverseSource = {
    pillars: RAIN_WATER_SOURCE.pillars,
    intervalStart: RAIN_WATER_SOURCE.intervalStart,
    intervalEnd: RAIN_WATER_SOURCE.intervalEnd,
  };
  assert.equal(isLiuyaoRangeSource(oldSource), false);
  assert.throws(
    () =>
      generateLiuyaoRange({
        source: oldSource,
        representativeDate: new Date(RAIN_WATER_SOURCE.startTimestamp!),
      }),
    /完整的北京时间半开机器区间/u,
  );
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
      generateLiuyaoRange({
        source: RAIN_WATER_SOURCE,
        representativeDate: new Date(RAIN_WATER_SOURCE.startTimestamp! + 1_000),
      }),
    /代表时间必须等于四柱候选区间起点/u,
  );
});

test('起点和每段终点前一秒的四柱必须保持来源一致', () => {
  const crossingHourSource = sourceFor('2024-02-19 10:00:00', '2024-02-19 12:00:00');
  assert.throws(() => rangeFor(crossingHourSource), /起点的干支与四柱候选来源不一致/u);
  assert.throws(
    () =>
      rangeFor({ ...RAIN_WATER_SOURCE, pillars: { ...RAIN_WATER_SOURCE.pillars, hour: '甲子' } }),
    /原始卦盘的干支与四柱候选来源不一致/u,
  );
});
