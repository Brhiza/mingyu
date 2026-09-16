import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateSolarTermEvidence,
  getDivinationTime,
  reverseBaziDates,
} from 'mingyu-core/calendar';
import type { BaziReverseSource } from '../src/lib/bazi-reverse-input';
import {
  formatTaiyiRangeContext,
  formatTaiyiRangeFacts,
  formatTaiyiRangeInterval,
  generateTaiyiRange,
  isTaiyiRangeSource,
  type TaiyiRangeScope,
} from '../src/lib/divination/taiyi-range';

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

function sourceAcrossSolarTerm(year: number, termIndex: number) {
  const boundary = calculateSolarTermEvidence(year, termIndex).utcTimestamp;
  const pillars = getDivinationTime(new Date(boundary - 1_000), 480).ganzhi;
  const civilYear = new Date(boundary + 8 * 3_600_000).getUTCFullYear();
  const reverse = reverseBaziDates({ pillars, startYear: civilYear, endYear: civilYear });
  const candidate = reverse.candidates.find(
    (item) => item.startTimestamp < boundary && item.endTimestamp > boundary,
  );
  assert.ok(candidate, `缺少${year}年第${termIndex}项节气交接的合成四柱候选`);
  return {
    boundary,
    source: {
      pillars: candidate.pillars,
      intervalStart: candidate.start.text,
      intervalEnd: candidate.end.text,
      startTimestamp: candidate.startTimestamp,
      endTimestamp: candidate.endTimestamp,
      endExclusive: true,
      timezone: 'Asia/Shanghai' as const,
      offsetHours: 8 as const,
    } satisfies BaziReverseSource,
  };
}

const SUMMER_TERM_SOURCE = sourceAcrossSolarTerm(2026, 12);
const WINTER_TERM_SOURCE = sourceAcrossSolarTerm(2026, 0);
const STABLE_SOURCE = sourceFor('2024-02-19 09:00:00', '2024-02-19 11:00:00');
const CROSS_MIDNIGHT_SOURCE = sourceFor('2024-02-04 23:00:00', '2024-02-05 01:00:00');

function rangeFor(source: BaziReverseSource, scope: TaiyiRangeScope) {
  const startTimestamp = source.startTimestamp;
  if (typeof startTimestamp !== 'number') throw new Error('合成来源缺少起点时间戳。');
  return generateTaiyiRange({
    source,
    representativeDate: new Date(startTimestamp),
    scope,
  });
}

test('夏至真实交接秒切分时计并保留前后完整太乙盘', () => {
  const range = rangeFor(SUMMER_TERM_SOURCE.source, 'hour');
  assert.equal(range.status, 'conditional');
  assert.equal(range.branches.length, 2);
  assert.deepEqual(
    [range.branches[0]?.endTimestamp, range.branches[1]?.startTimestamp],
    [SUMMER_TERM_SOURCE.boundary, SUMMER_TERM_SOURCE.boundary],
  );
  assert.equal(range.branches[0]?.data.yinYang, '阳遁');
  assert.equal(range.branches[1]?.data.yinYang, '阴遁');
  assert.notEqual(range.branches[0]?.data.taiyiPosition, range.branches[1]?.data.taiyiPosition);
  assert.equal(range.branches[0]?.data.scope, 'hour');
  assert.equal(range.branches[1]?.data.scope, 'hour');
});

test('冬至真实交接秒切分时计并由阴遁转为阳遁', () => {
  const range = rangeFor(WINTER_TERM_SOURCE.source, 'hour');
  assert.equal(range.status, 'conditional');
  assert.equal(range.branches.length, 2);
  assert.deepEqual(
    [
      range.branches[0]?.startTimestamp,
      range.branches[0]?.endTimestamp,
      range.branches[1]?.endTimestamp,
    ],
    [
      WINTER_TERM_SOURCE.source.startTimestamp,
      WINTER_TERM_SOURCE.boundary,
      WINTER_TERM_SOURCE.source.endTimestamp,
    ],
  );
  assert.equal(range.branches[0]?.data.yinYang, '阴遁');
  assert.equal(range.branches[1]?.data.yinYang, '阳遁');
});

test('月计、日计和无节气稳定时计按语义事实合并而忽略展示瞬时分', () => {
  for (const scope of ['month', 'day', 'hour'] as const) {
    const range = rangeFor(STABLE_SOURCE, scope);
    assert.equal(range.status, 'stable');
    assert.equal(range.branches.length, 1);
    assert.deepEqual(
      [range.branches[0]?.startTimestamp, range.branches[0]?.endTimestamp],
      [STABLE_SOURCE.startTimestamp, STABLE_SOURCE.endTimestamp],
    );
    assert.equal(range.branches[0]?.data.scope, scope);
  }
});

test('跨民用零点的时计积数连续并合并为稳定分支', () => {
  const range = rangeFor(CROSS_MIDNIGHT_SOURCE, 'hour');
  assert.equal(range.status, 'stable');
  assert.equal(range.branches.length, 1);
  assert.deepEqual(
    [range.branches[0]?.startTimestamp, range.branches[0]?.endTimestamp],
    [CROSS_MIDNIGHT_SOURCE.startTimestamp, CROSS_MIDNIGHT_SOURCE.endTimestamp],
  );
  assert.ok((range.branches[0]?.data.accumulatedValue ?? 0) > 0);
});

test('范围事实格式化使用完整分支区间作为起局时间', () => {
  const range = rangeFor(SUMMER_TERM_SOURCE.source, 'hour');
  const facts = formatTaiyiRangeFacts(range);
  const firstInterval = formatTaiyiRangeInterval(
    range.branches[0]!.startTimestamp,
    range.branches[0]!.endTimestamp,
  );
  const secondInterval = formatTaiyiRangeInterval(
    range.branches[1]!.startTimestamp,
    range.branches[1]!.endTimestamp,
  );
  assert.match(facts, /太乙神数时计候选时间范围内的分段盘面/u);
  assert.ok(facts.includes(`分支1：${firstInterval}`));
  assert.ok(facts.includes(`分支2：${secondInterval}`));
  assert.ok(facts.includes(`起局时间：${firstInterval}`));
  assert.ok(facts.includes(`起局时间：${secondInterval}`));
  assert.match(formatTaiyiRangeContext(range), /二十四节气交接、民用零点和时辰边界/u);
});

test('范围来源坚持完整机器边界、文本一致、代表起点和月日时范围', () => {
  assert.equal(isTaiyiRangeSource(STABLE_SOURCE), true);
  const oldSource: BaziReverseSource = {
    pillars: STABLE_SOURCE.pillars,
    intervalStart: STABLE_SOURCE.intervalStart,
    intervalEnd: STABLE_SOURCE.intervalEnd,
  };
  assert.equal(isTaiyiRangeSource(oldSource), false);
  assert.throws(
    () =>
      generateTaiyiRange({
        source: oldSource,
        representativeDate: new Date(STABLE_SOURCE.startTimestamp!),
        scope: 'day',
      }),
    /完整的北京时间半开机器区间/u,
  );
  assert.throws(
    () => rangeFor({ ...STABLE_SOURCE, intervalEnd: '2024-02-19 11:00:01' }, 'day'),
    /文本边界与时间戳不一致/u,
  );
  assert.throws(
    () =>
      rangeFor(
        {
          ...STABLE_SOURCE,
          intervalEnd: '2024-02-19 11:01:00',
          endTimestamp: beijingTimestamp('2024-02-19 11:01:00'),
        },
        'day',
      ),
    /两小时上限/u,
  );
  assert.throws(
    () =>
      generateTaiyiRange({
        source: STABLE_SOURCE,
        representativeDate: new Date(STABLE_SOURCE.startTimestamp! + 1_000),
        scope: 'day',
      }),
    /代表时间必须等于四柱候选区间起点/u,
  );
  assert.throws(
    () =>
      generateTaiyiRange({
        source: STABLE_SOURCE,
        representativeDate: new Date(STABLE_SOURCE.startTimestamp!),
        scope: 'year' as never,
      }),
    /只支持月计、日计和时计/u,
  );
});

test('范围不得跨越未保持四柱的时辰边界', () => {
  const crossingHourSource = sourceFor('2024-02-19 10:00:00', '2024-02-19 12:00:00');
  assert.throws(() => rangeFor(crossingHourSource, 'hour'), /起点的干支与四柱候选来源不一致/u);
});
