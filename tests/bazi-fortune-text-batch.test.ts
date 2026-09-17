import assert from 'node:assert/strict';
import test from 'node:test';
import { baziCalculator } from '../packages/core/src/bazi/baziCalculator';
import {
  formatBaziFortuneBatch,
  formatBaziFullFortune,
  selectBaziFortuneBatchResult,
} from '../packages/core/src/prompt/bazi-fortune';

const result = baziCalculator.calculateBazi({
  year: 1992,
  month: 8,
  day: 21,
  timeIndex: 4,
  gender: 'female',
});

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
