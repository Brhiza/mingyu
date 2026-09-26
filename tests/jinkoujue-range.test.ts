import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateSolarTermsForYear, getDivinationTime, TimeManager } from 'mingyu-core/calendar';
import { formatJinkoujueJudgmentFacts } from 'mingyu-core/prompt';
import type { JinkoujueDivinationMethod } from 'mingyu-core/types';
import type { BaziReverseSource } from '../src/lib/bazi-reverse-input';
import {
  formatJinkoujueRangeFacts,
  formatJinkoujueRangeInterval,
  generateJinkoujueRange,
} from '../src/lib/divination/jinkoujue-range';

function beijingTimestamp(text: string) {
  return Date.parse(text.replace(' ', 'T') + '+08:00');
}

function beijingText(timestamp: number) {
  const parts = TimeManager.getWallClockParts(new Date(timestamp), 480);
  const pad = (value: number) => String(value).padStart(2, '0');
  return (
    String(parts.year) +
    '-' +
    pad(parts.month) +
    '-' +
    pad(parts.day) +
    ' ' +
    pad(parts.hour) +
    ':' +
    pad(parts.minute) +
    ':' +
    pad(parts.second)
  );
}

function makeSource(startText: string, endText: string): BaziReverseSource {
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

const RAIN_WATER_SOURCE = makeSource('2024-02-19 11:00:00', '2024-02-19 13:00:00');
const STABLE_SOURCE = makeSource('2024-02-19 09:00:00', '2024-02-19 11:00:00');

test('公共节气入口确认金口诀雨水整秒交接', () => {
  const rainWater = calculateSolarTermsForYear(2024).find((item) => item.name === '雨水');
  assert.ok(rainWater);
  assert.equal(rainWater.utcTimestamp, beijingTimestamp('2024-02-19 12:13:12'));
});

test('金口诀雨水前后按月将切成两段并保留独立手算四位预期', () => {
  const range = generateJinkoujueRange({
    source: RAIN_WATER_SOURCE,
    representativeDate: new Date(RAIN_WATER_SOURCE.startTimestamp),
    method: 'time',
  });

  assert.equal(range.status, 'conditional');
  assert.deepEqual(
    range.branches.map((branch) => [
      beijingText(branch.startTimestamp),
      beijingText(branch.endTimestamp),
      branch.data.monthLeader,
      branch.data.positions.jiangShen.stem + branch.data.positions.jiangShen.branch,
      branch.data.yinYangUse.pattern,
      branch.data.yinYangUse.usePosition,
    ]),
    [
      ['2024-02-19 11:00:00', '2024-02-19 12:13:12', '子', '壬子', '三阳一阴', '贵神'],
      ['2024-02-19 12:13:12', '2024-02-19 13:00:00', '亥', '癸亥', '二阴二阳', '将神'],
    ],
  );

  for (const branch of range.branches) {
    const data = branch.data;
    assert.equal(data.positions.diFen.branch, '午');
    assert.equal(data.positions.guiShen.god, '天后');
    assert.equal(data.positions.guiShen.branch, '亥');
    assert.equal(data.positions.renYuan.stem + data.positions.renYuan.branch, '戊午');
    assert.ok(data.movements.some((movement) => movement.name === '父母动'));
    assert.equal(
      data.ganzhi.year + data.ganzhi.month + data.ganzhi.day + data.ganzhi.hour,
      '甲辰丙寅癸丑戊午',
    );
    assert.equal(data.ganzhi.day, RAIN_WATER_SOURCE.pillars.day);
    assert.equal(data.ganzhi.hour, RAIN_WATER_SOURCE.pillars.hour);
  }

  const facts = formatJinkoujueRangeFacts(range);
  assert.match(facts, /分支1：/u);
  assert.match(facts, /分支2：/u);
  for (const branch of range.branches) {
    for (const fact of formatJinkoujueJudgmentFacts(branch.data, { compact: true })) {
      assert.ok(facts.includes(fact));
    }
    assert.ok(facts.includes(branch.data.yinYangUse.rule));
    for (const position of Object.values(branch.data.positions)) {
      assert.ok(facts.includes(`${position.name}${position.stem ?? ''}${position.branch}`));
    }
  }
});

test('金口诀半开边界和稳定窗口按完整来源校验', () => {
  const range = generateJinkoujueRange({
    source: STABLE_SOURCE,
    representativeDate: new Date(STABLE_SOURCE.startTimestamp),
    method: 'branch',
    branch: '午',
  });

  assert.equal(range.status, 'stable');
  assert.equal(range.branches.length, 1);
  assert.deepEqual(
    [range.branches[0]?.startTimestamp, range.branches[0]?.endTimestamp],
    [STABLE_SOURCE.startTimestamp, STABLE_SOURCE.endTimestamp],
  );
  assert.equal(range.branches[0]?.data.diFenBranch, '午');
  assert.equal(
    formatJinkoujueRangeInterval(STABLE_SOURCE.startTimestamp, STABLE_SOURCE.endTimestamp),
    '北京时间 2024-02-19 09:00:00 至 2024-02-19 11:00:00（起点含、终点不含）',
  );

  assert.throws(
    () =>
      generateJinkoujueRange({
        source: {
          ...STABLE_SOURCE,
          intervalEnd: '2024-02-19 11:01:00',
          endTimestamp: beijingTimestamp('2024-02-19 11:01:00'),
        },
        representativeDate: new Date(STABLE_SOURCE.startTimestamp),
        method: 'time',
      }),
    /两小时上限/u,
  );
  assert.throws(
    () =>
      generateJinkoujueRange({
        source: STABLE_SOURCE,
        representativeDate: new Date(STABLE_SOURCE.startTimestamp + 1_000),
      }),
    /代表时间必须等于四柱候选区间起点/u,
  );
});

test('金口诀四种地分方法均使用同一候选区间，随机段复用一次轨迹', () => {
  const deterministicMethods: Array<{
    method: JinkoujueDivinationMethod;
    branch?: string;
    number?: number;
    expectedBranch: string;
  }> = [
    { method: 'time', expectedBranch: '巳' },
    { method: 'branch', branch: '午', expectedBranch: '午' },
    { method: 'number', number: 19, expectedBranch: '午' },
  ];

  for (const input of deterministicMethods) {
    const range = generateJinkoujueRange({
      source: STABLE_SOURCE,
      representativeDate: new Date(STABLE_SOURCE.startTimestamp),
      ...input,
    });
    assert.equal(range.branches.length, 1);
    assert.equal(range.branches[0]?.data.method, input.method);
    assert.equal(range.branches[0]?.data.diFenBranch, input.expectedBranch);
  }

  let randomCalls = 0;
  const randomRange = generateJinkoujueRange({
    source: RAIN_WATER_SOURCE,
    representativeDate: new Date(RAIN_WATER_SOURCE.startTimestamp),
    method: 'random',
    random: () => {
      randomCalls += 1;
      return 0.5;
    },
  });
  assert.equal(randomRange.branches.length, 2);
  assert.equal(randomCalls, 1);
  const first = randomRange.branches[0]?.data;
  assert.ok(first);
  assert.ok(first.randomTrace?.samples.length);
  for (const branch of randomRange.branches) {
    assert.equal(branch.data.method, 'random');
    assert.equal(branch.data.diFenBranch, first.diFenBranch);
    assert.deepEqual(branch.data.randomTrace?.samples, first.randomTrace?.samples);
  }

  let stableRandomCalls = 0;
  const stableRandomRange = generateJinkoujueRange({
    source: STABLE_SOURCE,
    representativeDate: new Date(STABLE_SOURCE.startTimestamp),
    method: 'random',
    random: () => {
      stableRandomCalls += 1;
      return 0.5;
    },
  });
  assert.equal(stableRandomRange.status, 'stable');
  assert.equal(stableRandomRange.branches.length, 1);
  assert.equal(stableRandomCalls, 1);
});

test('旧文本来源不进入金口诀区间生成', () => {
  const oldSource: BaziReverseSource = {
    pillars: RAIN_WATER_SOURCE.pillars,
    intervalStart: RAIN_WATER_SOURCE.intervalStart,
    intervalEnd: RAIN_WATER_SOURCE.intervalEnd,
  };
  assert.throws(
    () =>
      generateJinkoujueRange({
        source: oldSource,
        representativeDate: new Date(RAIN_WATER_SOURCE.startTimestamp),
        method: 'time',
      }),
    /完整的北京时间半开机器区间/u,
  );
});
