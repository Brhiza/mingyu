import assert from 'node:assert/strict';
import test from 'node:test';
import { BaziCalculator, baziCalculator } from '../packages/core/src/bazi/baziCalculator';
import {
  formatCalculatedBaziFortuneBatch,
  formatBaziFortuneBatch,
  formatBaziFullFortune,
  selectBaziNatalResult,
  selectBaziFortuneBatchResult,
} from '../packages/core/src/prompt/bazi-fortune';

const person = {
  year: 1992,
  month: 8,
  day: 21,
  timeIndex: 4,
  gender: 'female' as const,
};
const result = baziCalculator.calculateBazi(person);

test('逐年续取覆盖完整命限，交运年按所属大运分别保留', () => {
  const expected = result.luckInfo.cycles.flatMap<{ cycleIndex: number; year: number | null }>(
    (cycle, cycleIndex) =>
      cycle.years.length
        ? cycle.years.map((year) => ({ cycleIndex, year: year.year }))
        : [{ cycleIndex, year: null }],
  );
  const visited: Array<{ cycleIndex: number | null; year: number | null }> = [];
  const allLines = new Set<string>();
  let index: number | null = 0;
  while (index !== null) {
    const page = formatBaziFortuneBatch(result, index);
    const selected = selectBaziFortuneBatchResult(result, page.batch);
    const selectedCycle = selected.luckInfo.cycles[0];
    assert.deepEqual(selectedCycle.resolvedYears ?? selectedCycle.years, selectedCycle.years);
    assert.deepEqual(
      selectedCycle.years.map((year) => year.year),
      [page.batch.year],
    );
    assert.equal(page.batch.totalEntries, expected.length);
    assert.equal(page.batch.startIndex, index);
    assert.equal(page.batch.endIndexExclusive, index + 1);
    assert.ok((page.text.match(/^\d+年\(/gm) ?? []).length <= 1);
    visited.push({ cycleIndex: page.batch.cycleIndex, year: page.batch.year });
    page.text
      .split('\n')
      .slice(1)
      .forEach((line) => allLines.add(line));
    index = page.batch.nextIndex;
  }
  assert.deepEqual(visited, expected);
  assert.deepEqual(allLines, new Set(formatBaziFullFortune(result).split('\n').slice(1)));
  assert.ok(
    expected.some((entry, i) =>
      expected
        .slice(i + 1)
        .some((other) => entry.year === other.year && entry.cycleIndex !== other.cycleIndex),
    ),
    '测试盘应包含横跨交运边界的同一流年',
  );
});

test('单年资料构造不读取其他年份的内容', () => {
  const source = result.luckInfo.cycles.find((cycle) => cycle.years.length > 1)!;
  const years = source.years.slice();
  for (let index = 1; index < years.length; index++) {
    Object.defineProperty(years, index, {
      get() {
        throw new Error('读取了批次外年份');
      },
    });
  }
  const selected = {
    ...result,
    luckInfo: { ...result.luckInfo, cycles: [{ ...source, years }] },
  };
  const page = formatBaziFortuneBatch(selected, 0);
  assert.equal(page.batch.year, source.years[0].year);
  assert.match(page.text, new RegExp(`${source.years[0].year}年`));
});

test('续取位置校验与空命限明确终止', () => {
  const total = formatBaziFortuneBatch(result).batch.totalEntries;
  for (const index of [-1, 0.5, NaN, Infinity, total]) {
    assert.throws(() => formatBaziFortuneBatch(result, index), RangeError);
  }
  const empty = { ...result, luckInfo: { ...result.luckInfo, cycles: [] } };
  const page = formatBaziFortuneBatch(empty);
  assert.equal(page.text, '');
  assert.equal(page.batch.totalEntries, 0);
  assert.equal(page.batch.endIndexExclusive, 0);
  assert.equal(page.batch.nextIndex, null);
});

test('核心有界批次逐页等同完整命限裁剪并保留交运双归属', () => {
  assert.deepEqual(
    baziCalculator.calculateBaziBatch(person, { section: 'natal' }).result,
    selectBaziNatalResult(result),
  );
  const total = formatBaziFortuneBatch(result).batch.totalEntries;
  for (let startIndex = 0; startIndex < total; startIndex++) {
    const expectedText = formatBaziFortuneBatch(result, startIndex);
    const expectedResult = selectBaziFortuneBatchResult(result, expectedText.batch);
    const actual = baziCalculator.calculateBaziBatch(person, {
      section: 'fortune',
      startIndex,
    });
    assert.deepEqual(actual.batch, expectedText.batch);
    assert.deepEqual(actual.result, expectedResult);
    assert.deepEqual(formatCalculatedBaziFortuneBatch(actual.result, actual.batch!), expectedText);
  }
});

test('核心有界批次本命不算流年，命限只计算当前一条', () => {
  const calculator = new BaziCalculator();
  const luckCalculator = (
    calculator as unknown as {
      luckCalculator: {
        calculateLiunian: (...args: unknown[]) => unknown;
        getCycleCalendarYearRange: (...args: unknown[]) => unknown;
      };
    }
  ).luckCalculator;
  const originalLiunian = luckCalculator.calculateLiunian.bind(luckCalculator);
  const originalRange = luckCalculator.getCycleCalendarYearRange.bind(luckCalculator);
  let liunianCalls = 0;
  let rangeCalls = 0;
  luckCalculator.calculateLiunian = (...args) => {
    liunianCalls += 1;
    return originalLiunian(...args);
  };
  luckCalculator.getCycleCalendarYearRange = (...args) => {
    rangeCalls += 1;
    return originalRange(...args);
  };

  calculator.calculateBaziBatch(person, { section: 'natal' });
  assert.equal(liunianCalls, 0);
  assert.equal(rangeCalls, 0);
  calculator.calculateBaziBatch(person, { section: 'fortune', startIndex: 7 });
  assert.equal(liunianCalls, 1);
  assert.ok(rangeCalls > 0);
  const plannedRangeCalls = rangeCalls;

  liunianCalls = 0;
  rangeCalls = 0;
  calculator.calculateBazi(person);
  assert.equal(
    liunianCalls,
    result.luckInfo.cycles.reduce((total, cycle) => total + cycle.years.length, 0),
    '完整排盘仍应生成全部流年',
  );
  assert.equal(rangeCalls, plannedRangeCalls, '完整排盘应直接复用周期骨架的年份范围');
});

test('时辰未知批次与完整排盘裁剪保持空命限及固定和临界候选一致', () => {
  const unknownPerson = {
    ...person,
    timeIndex: -1,
    isThreePillars: true,
  };
  const full = baziCalculator.calculateBazi(unknownPerson);
  const expectedPage = formatBaziFortuneBatch(full, 0);
  const natal = baziCalculator.calculateBaziBatch(unknownPerson, { section: 'natal' });
  const fortune = baziCalculator.calculateBaziBatch(unknownPerson, {
    section: 'fortune',
    startIndex: 0,
  });

  assert.deepEqual(natal.result, selectBaziNatalResult(full));
  assert.deepEqual(fortune.batch, expectedPage.batch);
  assert.deepEqual(fortune.result, selectBaziFortuneBatchResult(full, expectedPage.batch));
  const scenarios = fortune.result.unknownTimeAnalysis!.scenarios;
  assert.equal(scenarios.filter((scenario) => !scenario.boundary).length, 15);
  assert.ok(scenarios.some((scenario) => scenario.source === 'month-commander-boundary'));
  assert.throws(
    () =>
      baziCalculator.calculateBaziBatch(unknownPerson, {
        section: 'fortune',
        startIndex: 1,
      }),
    RangeError,
  );
});
