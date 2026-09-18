import assert from 'node:assert/strict';
import test from 'node:test';
import { BaziCalculator, baziCalculator } from '../packages/core/src/bazi/baziCalculator';
import type { Person } from '../packages/core/src/bazi/baziTypes';

type CoreCalculationMethod = (
  this: BaziCalculator,
  person: Person,
  batchRequest?: unknown,
  mode?: string,
) => unknown;

function countPillarCalculations(person: Person, startIndex: number) {
  const prototype = BaziCalculator.prototype as unknown as Record<string, CoreCalculationMethod>;
  const original = prototype.calculateCoreBaziInternal!;
  let pillarCalls = 0;
  prototype.calculateCoreBaziInternal = function (...args) {
    if (args[2] === 'pillars') pillarCalls += 1;
    return original.apply(this, args);
  };
  try {
    const result = baziCalculator.calculateBaziUnknownTimeBatch(person, { startIndex });
    return { pillarCalls, result };
  } finally {
    prototype.calculateCoreBaziInternal = original;
  }
}

test('单候选页只为日初日末与真实临界核验年月日柱', () => {
  const ordinary: Person = { year: 2000, month: 1, day: 7, gender: 'male' };
  const representative = countPillarCalculations(ordinary, 7);
  assert.equal(representative.result.batch.totalCandidates, 15);
  assert.equal(representative.pillarCalls, 3, '基础占位盘加日初日末，不重复扫描13个时辰代表点');

  const dayStart = countPillarCalculations(ordinary, 0);
  assert.equal(dayStart.pillarCalls, 2, '当前候选为日初时复用其真实四柱，只补算日末');

  const term = countPillarCalculations({ year: 2024, month: 2, day: 4, gender: 'female' }, 7);
  assert.equal(term.result.batch.totalCandidates, 17);
  assert.equal(term.pillarCalls, 5, '交节日另核验临界前后，不扫描无关时辰代表点');
});

test('精简柱核验在历法边界年份与四季日期保持完整模式的不确定柱结论', () => {
  const cases: Person[] = [
    { year: 1900, month: 1, day: 6, gender: 'female' },
    { year: 1924, month: 9, day: 23, gender: 'female' },
    { year: 1990, month: 5, day: 15, gender: 'female', applyChinaDst: true },
    { year: 2024, month: 2, day: 4, gender: 'female' },
    { year: 2024, month: 6, day: 21, gender: 'male' },
    { year: 2024, month: 12, day: 31, gender: 'male' },
    { year: 2100, month: 12, day: 21, gender: 'male' },
    {
      year: 2023,
      month: 2,
      day: 15,
      isLunar: true,
      isLeapMonth: true,
      gender: 'female',
    },
  ];
  for (const person of cases) {
    const full = baziCalculator.calculateBazi(person);
    const page = baziCalculator.calculateBaziUnknownTimeBatch(person, { startIndex: 7 });
    assert.deepEqual(
      page.result.unknownTimeAnalysis?.uncertainPillars,
      full.unknownTimeAnalysis?.uncertainPillars,
      JSON.stringify(person),
    );
  }
});
