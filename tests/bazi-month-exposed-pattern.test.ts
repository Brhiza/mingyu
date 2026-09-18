import assert from 'node:assert/strict';
import test from 'node:test';
import { determinePattern } from '@core/bazi/baziPatternStrategy';
import { getTenGod } from '@core/bazi/baziUtils';
import type { Pillars } from '@core/bazi/baziTypes';

function pillars(...values: string[]): Pillars {
  return Object.fromEntries(
    ['year', 'month', 'day', 'hour'].map((key, index) => [
      key,
      { gan: values[index][0], zhi: values[index][1], ganZhi: values[index] },
    ]),
  ) as Pillars;
}

test('壬生戌月藏辛透出，司令戊未透时保留正印取格', () => {
  const result = determinePattern(pillars('壬午', '庚戌', '壬子', '辛亥'), '身弱', getTenGod, '戊');
  assert.equal(result.pattern, '杂气正印格');
  assert.match(result.basis!, /辛为月令藏干，透于时干/);
  assert.equal(result.isSpecial, false);
  assert.ok(
    result.patternCandidates?.some(
      (candidate) =>
        candidate.pattern === '七杀格' && candidate.source === '月令本气' && !candidate.selected,
    ),
  );
  assert.ok(
    result.patternCandidates?.some(
      (candidate) =>
        candidate.pattern === '杂气正印格' &&
        candidate.source === '月令藏干透干' &&
        candidate.selected,
    ),
  );
});

test('偏印透干也参加月令取格，不作为比劫排除', () => {
  const result = determinePattern(pillars('壬午', '庚戌', '癸丑', '辛酉'), '身弱', getTenGod, '戊');
  assert.equal(result.pattern, '杂气偏印格');
  assert.match(result.basis!, /辛为月令藏干/);
});

test('寅月藏丙透出取财格，不因异于分日司令就称杂气格', () => {
  const result = determinePattern(pillars('壬申', '壬寅', '壬子', '丙午'), '身弱', getTenGod, '甲');
  assert.equal(result.pattern, '偏财格');
  assert.match(result.basis!, /丙为月令藏干/);
});

test('司令明透仍优先，新增印格候选不改变已有取格口径', () => {
  const result = determinePattern(pillars('辛酉', '戊戌', '壬子', '辛亥'), '身弱', getTenGod, '戊');
  assert.equal(result.pattern, '七杀格');
  assert.match(result.basis!, /分日司权同为戊/);
});
