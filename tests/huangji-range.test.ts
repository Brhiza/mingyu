import assert from 'node:assert/strict';
import test from 'node:test';
import { getDivinationTime } from 'mingyu-core/calendar';
import { calculateHuangjiJingshi } from 'mingyu-core/huangji-jingshi';
import type { BaziReverseSource } from '../src/lib/bazi-reverse-input';
import {
  buildHuangjiRangePrompt,
  formatHuangjiRangeContext,
  formatHuangjiRangeFacts,
  formatHuangjiRangeInterval,
  generateHuangjiRange,
  isHuangjiRangeSource,
} from '../src/lib/divination/huangji-range';

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
const STABLE_SOURCE = sourceFor('2024-02-19 09:00:00', '2024-02-19 11:00:00');
const WINTER_SOLSTICE_SOURCE = sourceFor('2025-12-21 23:00:00', '2025-12-22 01:00:00');

function rangeFor(source: BaziReverseSource, question = '合成皇极区间验证') {
  return generateHuangjiRange({
    source,
    representativeDate: new Date(source.startTimestamp as number),
    question,
  });
}

test('雨水11至13点按四小时与节气整秒切成三段并保留完整皇极盘', () => {
  const range = rangeFor(RAIN_WATER_SOURCE);

  assert.equal(range.status, 'conditional');
  assert.deepEqual(
    range.branches.map((branch) => [branch.startTimestamp, branch.endTimestamp]),
    [
      [RAIN_WATER_SOURCE.startTimestamp, beijingTimestamp('2024-02-19 12:00:00')],
      [beijingTimestamp('2024-02-19 12:00:00'), beijingTimestamp('2024-02-19 12:13:12')],
      [beijingTimestamp('2024-02-19 12:13:12'), RAIN_WATER_SOURCE.endTimestamp],
    ],
  );
  assert.deepEqual(
    range.branches.map((branch) => branch.data.dateTimeForecast?.calendar.hourSegment),
    [3, 4, 4],
  );
  assert.deepEqual(
    range.branches.map((branch) => branch.data.dateTimeForecast?.calendar.activeSolarTerm),
    ['立春', '立春', '雨水'],
  );
  for (const branch of range.branches) {
    assert.deepEqual(
      branch.data,
      calculateHuangjiJingshi({
        date: new Date(branch.startTimestamp),
        question: '合成皇极区间验证',
      }),
    );
  }
});

test('节气后满24小时日序在相邻候选区间中保持连续', () => {
  const first = rangeFor(sourceFor('2024-02-19 12:13:11', '2024-02-19 12:13:13'));
  const next = rangeFor(sourceFor('2024-02-20 12:13:11', '2024-02-20 12:13:13'));
  const firstRainWater = first.branches.find(
    (branch) => branch.startTimestamp === beijingTimestamp('2024-02-19 12:13:12'),
  );
  const nextBeforeBoundary = next.branches.find(
    (branch) => branch.startTimestamp === beijingTimestamp('2024-02-20 12:13:11'),
  );
  const nextAfterBoundary = next.branches.find(
    (branch) => branch.startTimestamp === beijingTimestamp('2024-02-20 12:13:12'),
  );

  assert.ok(firstRainWater);
  assert.ok(nextBeforeBoundary);
  assert.ok(nextAfterBoundary);
  assert.equal(firstRainWater.data.dateTimeForecast?.calendar.actualDayInSolarTerm, 1);
  assert.equal(nextBeforeBoundary.data.dateTimeForecast?.calendar.actualDayInSolarTerm, 1);
  assert.equal(
    nextAfterBoundary.data.dateTimeForecast?.calendar.actualDayInSolarTerm,
    (firstRainWater.data.dateTimeForecast?.calendar.actualDayInSolarTerm ?? 0) + 1,
  );
});

test('跨年冬至整秒边界纳入皇极区间分段', () => {
  const range = rangeFor(WINTER_SOLSTICE_SOURCE);

  assert.equal(range.status, 'conditional');
  assert.equal(range.branches.length, 3);
  assert.deepEqual(
    range.branches.map((branch) => branch.data.dateTimeForecast?.calendar.activeSolarTerm),
    ['大雪', '冬至', '冬至'],
  );
  assert.equal(range.branches[0]?.endTimestamp, beijingTimestamp('2025-12-21 23:03:05'));
  assert.deepEqual(
    range.branches.map((branch) => branch.data.dateTimeForecast?.calendar.forecastYear),
    [2025, 2026, 2026],
  );
  assert.deepEqual(
    range.branches.map((branch) => branch.data.dateTimeForecast?.calendar.hourSegment),
    [6, 6, 1],
  );
  for (const branch of range.branches) {
    assert.deepEqual(
      getDivinationTime(new Date(branch.startTimestamp), 480).ganzhi,
      WINTER_SOLSTICE_SOURCE.pillars,
    );
    assert.deepEqual(
      getDivinationTime(new Date(branch.endTimestamp - 1_000), 480).ganzhi,
      WINTER_SOLSTICE_SOURCE.pillars,
    );
  }
});

test('没有事实变化的北京时间两小时范围合并为稳定分支', () => {
  const range = rangeFor(STABLE_SOURCE);

  assert.equal(range.status, 'stable');
  assert.equal(range.branches.length, 1);
  assert.deepEqual(
    [range.branches[0]?.startTimestamp, range.branches[0]?.endTimestamp],
    [STABLE_SOURCE.startTimestamp, STABLE_SOURCE.endTimestamp],
  );
});

test('皇极范围事实只保留依据与分支资料，任务书合并为一个任务段', () => {
  const range = rangeFor(RAIN_WATER_SOURCE, '请比较三段皇极盘面的节气与时段变化。');
  const facts = formatHuangjiRangeFacts(range);
  const prompt = buildHuangjiRangePrompt(range, '请比较三段皇极盘面的节气与时段变化。');

  assert.match(facts, /【传统依据】/u);
  assert.match(facts, /分支1：北京时间 2024-02-19 11:00:00 至 2024-02-19 12:00:00/u);
  assert.match(facts, /分支3：北京时间 2024-02-19 12:13:12 至 2024-02-19 13:00:00/u);
  assert.match(facts, /皇极历位：/u);
  assert.doesNotMatch(facts, /【任务】/u);
  assert.equal((prompt.match(/【任务】/gu) ?? []).length, 1);
  assert.match(prompt, /2024-02-19 11:00:00 至 2024-02-19 12:00:00/u);
  assert.match(prompt, /2024-02-19 12:13:12 至 2024-02-19 13:00:00/u);
  assert.match(prompt, /立春/u);
  assert.match(prompt, /雨水/u);
  assert.doesNotMatch(prompt, /【当前时间】/u);
  const originalPrompt = range.branches[0]!.data.prompt;
  const sections = originalPrompt.matchAll(/(?:^|\n\n)【([^】]+)】\n([\s\S]*?)(?=\n\n【|$)/gu);
  for (const section of sections) {
    if (!['传统依据', '排盘资料', '取象资料', '任务', '问题'].includes(section[1]!)) {
      assert.ok(prompt.includes(`【${section[1]}】\n${section[2]!.trim()}`));
    }
  }
  assert.match(formatHuangjiRangeContext(range), /二十四节气整秒/u);
  assert.equal(
    formatHuangjiRangeInterval(RAIN_WATER_SOURCE.startTimestamp!, RAIN_WATER_SOURCE.endTimestamp!),
    '北京时间 2024-02-19 11:00:00 至 2024-02-19 13:00:00（起点含、终点不含）',
  );
});

test('皇极范围坚持完整机器边界、文本一致、两小时上限和代表起点', () => {
  assert.equal(isHuangjiRangeSource(RAIN_WATER_SOURCE), true);
  const oldSource: BaziReverseSource = {
    pillars: RAIN_WATER_SOURCE.pillars,
    intervalStart: RAIN_WATER_SOURCE.intervalStart,
    intervalEnd: RAIN_WATER_SOURCE.intervalEnd,
  };
  assert.equal(isHuangjiRangeSource(oldSource), false);
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
      generateHuangjiRange({
        source: RAIN_WATER_SOURCE,
        representativeDate: new Date(RAIN_WATER_SOURCE.startTimestamp! + 1_000),
      }),
    /代表时间必须等于四柱候选区间起点/u,
  );
});

test('皇极区间提示词完整保留带标题的多段问题', () => {
  const question = '请比较时间范围。\n\n【背景】\n补充事项背景。';
  const prompt = buildHuangjiRangePrompt(rangeFor(STABLE_SOURCE, question), question);
  assert.ok(prompt.endsWith(`【问题】\n${question}`));
  assert.equal((prompt.match(/【背景】/gu) ?? []).length, 1);
});
