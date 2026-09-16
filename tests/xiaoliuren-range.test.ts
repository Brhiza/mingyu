import assert from 'node:assert/strict';
import test from 'node:test';

import { defaultDraft } from '../src/components/DivinationPanel/constants';
import {
  formatXiaoliurenRangeFacts,
  formatXiaoliurenRangeInterval,
  generateXiaoliurenRange,
} from '../src/lib/divination/xiaoliuren-range';
import { generateDivinationSession, type DivinationDraft } from '../src/lib/divination/engine';
import type { BaziReverseSource } from '../src/lib/bazi-reverse-input';

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

function buildPillarsDraft(source: BaziReverseSource): DivinationDraft {
  return {
    ...defaultDraft,
    method: 'xiaoliuren',
    question: '跨越时间边界时应如何判断？',
    divinationTimeMode: 'pillars',
    customDivinationDate: source.intervalStart.slice(0, 10),
    customDivinationTime: source.intervalStart.slice(11),
    divinationReverseSource: source,
    divinationTimeStandard: 'beijing',
  };
}

test('小六壬通用规则在子时换日处分成两课', () => {
  const range = generateXiaoliurenRange({
    source: CROSS_MIDNIGHT_SOURCE,
    representativeDate: new Date(CROSS_MIDNIGHT_SOURCE.startTimestamp!),
    rule: 'common',
  });

  assert.equal(range.status, 'conditional');
  assert.deepEqual(
    range.branches.map(({ startTimestamp, endTimestamp }) => [startTimestamp, endTimestamp]),
    [
      [CROSS_MIDNIGHT_SOURCE.startTimestamp, Date.parse('2024-02-05T00:00:00+08:00')],
      [Date.parse('2024-02-05T00:00:00+08:00'), CROSS_MIDNIGHT_SOURCE.endTimestamp],
    ],
  );
  assert.deepEqual(
    range.branches.map(({ data }) => ({
      lunarDay: data.lunarDay,
      hourIndex: data.hourIndex,
      hourLabel: data.hourLabel,
      primary: data.primary.name,
      ganzhi: data.ganzhi,
    })),
    [
      {
        lunarDay: 25,
        hourIndex: 12,
        hourLabel: '晚子时',
        primary: '空亡',
        ganzhi: { year: '甲辰', month: '丙寅', day: '己亥', hour: '甲子' },
      },
      {
        lunarDay: 26,
        hourIndex: 0,
        hourLabel: '早子时',
        primary: '大安',
        ganzhi: { year: '甲辰', month: '丙寅', day: '己亥', hour: '甲子' },
      },
    ],
  );
  assert.match(
    formatXiaoliurenRangeFacts(range),
    /北京时间 2024-02-04 23:00:00 至 2024-02-05 00:00:00（起点含、终点不含）[\s\S]*北京时间 2024-02-05 00:00:00 至 2024-02-05 01:00:00（起点含、终点不含）/u,
  );
});

test('小六壬多能规则沿用同一实际边界并传播各分支事实', () => {
  const range = generateXiaoliurenRange({
    source: CROSS_MIDNIGHT_SOURCE,
    representativeDate: new Date(CROSS_MIDNIGHT_SOURCE.startTimestamp!),
    rule: 'duoneng',
  });

  assert.equal(range.branches.length, 2);
  assert.deepEqual(
    range.branches.map(({ data }) => [data.rule, data.lunarDay, data.primary.name]),
    [
      ['duoneng', 25, '大安'],
      ['duoneng', 26, '留连'],
    ],
  );
  assert.ok(
    range.branches.every(({ data }) => data.calculation.dayBoundary === '东八区民用日零点换日'),
  );
});

test('未跨小六壬日界或时辰界时合并为稳定课', () => {
  const range = generateXiaoliurenRange({
    source: STABLE_SOURCE,
    representativeDate: new Date(STABLE_SOURCE.startTimestamp!),
    rule: 'common',
  });

  assert.equal(range.status, 'stable');
  assert.equal(range.branches.length, 1);
  assert.deepEqual(
    [range.branches[0]?.startTimestamp, range.branches[0]?.endTimestamp],
    [STABLE_SOURCE.startTimestamp, STABLE_SOURCE.endTimestamp],
  );
});

test('范围代表时间必须是来源起点且文本边界必须与机器边界一致', () => {
  assert.throws(
    () =>
      generateXiaoliurenRange({
        source: CROSS_MIDNIGHT_SOURCE,
        representativeDate: new Date(CROSS_MIDNIGHT_SOURCE.startTimestamp! + 1_000),
        rule: 'common',
      }),
    /代表时间必须等于四柱候选区间起点/u,
  );

  assert.throws(
    () =>
      generateXiaoliurenRange({
        source: {
          ...CROSS_MIDNIGHT_SOURCE,
          intervalEnd: '2024-02-05 02:00:00',
        },
        representativeDate: new Date(CROSS_MIDNIGHT_SOURCE.startTimestamp!),
        rule: 'common',
      }),
    /文本边界与时间戳不一致/u,
  );
});

test('引擎对完整四柱区间生成条件提示词并保留单一任务与问题', async () => {
  const session = await generateDivinationSession(buildPillarsDraft(CROSS_MIDNIGHT_SOURCE));

  assert.equal(session.xiaoliurenRange?.status, 'conditional');
  assert.equal(session.xiaoliurenRange?.branches.length, 2);
  assert.match(session.prompt, /分支1：/u);
  assert.match(session.prompt, /分支2：/u);
  assert.match(session.prompt, /12月25日/u);
  assert.match(session.prompt, /12月26日/u);
  assert.doesNotMatch(session.prompt, /当前盘面采用区间起点作为代表时刻/u);
  assert.doesNotMatch(session.prompt, /【当前时间】/u);
  assert.match(session.prompt, /各时间段的顺数结果/u);
  assert.equal((session.prompt.match(/\n\n【任务】\n/gu) ?? []).length, 1);
  assert.equal((session.prompt.match(/\n\n【问题】\n/gu) ?? []).length, 1);
  assert.match(session.timeContext?.promptText ?? '', /四柱候选范围：/u);
});

test('四柱来源超过单一时辰或干支不匹配时拒绝区间计算', () => {
  for (const [source, expected] of [
    [
      {
        ...CROSS_MIDNIGHT_SOURCE,
        intervalEnd: '2024-02-05 02:00:00',
        endTimestamp: Date.parse('2024-02-05T02:00:00+08:00'),
      },
      /两小时上限/u,
    ],
    [{ ...CROSS_MIDNIGHT_SOURCE, pillars: STABLE_SOURCE.pillars }, /干支与四柱候选来源不一致/u],
  ] as const) {
    assert.throws(
      () =>
        generateXiaoliurenRange({
          source,
          representativeDate: new Date(source.startTimestamp!),
        }),
      expected,
    );
  }
});

test('稳定区间提示词仍保留时间范围而非一个精确时刻', async () => {
  const session = await generateDivinationSession(buildPillarsDraft(STABLE_SOURCE));
  assert.equal(session.xiaoliurenRange?.status, 'stable');
  assert.match(session.prompt, /21:00:00 至 2024-02-04 23:00:00/u);
  assert.doesNotMatch(session.prompt, /【当前时间】/u);
});

test('旧文本来源继续按单一代表时刻兼容生成且不启用区间摘要', async () => {
  const oldSource: BaziReverseSource = {
    pillars: CROSS_MIDNIGHT_SOURCE.pillars,
    intervalStart: CROSS_MIDNIGHT_SOURCE.intervalStart,
    intervalEnd: CROSS_MIDNIGHT_SOURCE.intervalEnd,
  };
  const session = await generateDivinationSession(buildPillarsDraft(oldSource));

  assert.equal(session.xiaoliurenRange, undefined);
  assert.match(session.prompt, /当前盘面采用区间起点作为代表时刻/u);
});
