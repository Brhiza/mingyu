import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePatternFulfillment } from '../packages/core/src/bazi/baziPatternFulfillment';
import { determinePattern } from '../packages/core/src/bazi/baziPatternStrategy';
import { getTenGod } from '../packages/core/src/bazi/baziUtils';
import type { Pillars } from '../packages/core/src/bazi/baziTypes';

function pillars(values: [string, string, string, string]): Pillars {
  return Object.fromEntries(
    ['year', 'month', 'day', 'hour'].map((key, index) => [
      key,
      {
        gan: values[index][0],
        zhi: values[index][1],
        ganZhi: values[index],
      },
    ]),
  ) as unknown as Pillars;
}

test('午月本气偏财与司令透杀分层，正库印根受月令直克不能闭合杀印链', () => {
  const chart = pillars(['己丑', '庚午', '癸丑', '癸丑']);
  const pattern = determinePattern(chart, '身弱', getTenGod, '己');

  assert.equal(pattern.pattern, '七杀格');
  assert.ok(
    pattern.patternCandidates?.some(
      (candidate) =>
        candidate.pattern === '偏财格' && candidate.source === '月令本气' && !candidate.selected,
    ),
  );
  assert.ok(
    pattern.patternCandidates?.some(
      (candidate) =>
        candidate.pattern === '七杀格' && candidate.source === '分日司令透干' && candidate.selected,
    ),
  );
  assert.match(pattern.basis, /本气为丁（偏财）/);
  assert.match(pattern.basis, /分日司权为己（七杀）/);
  assert.equal(pattern.fulfillment?.status, '未判定');
  assert.equal(
    pattern.fulfillment?.pathEvaluations?.find((path) => path.key === '七杀生印')?.status,
    '资料不足',
  );
  assert.equal(
    pattern.fulfillment?.pathEvaluations?.find((path) => path.key === '印生身')?.status,
    '资料不足',
  );
  const controlFact = pattern.fulfillment?.conditionFacts?.find(
    (fact) => fact.key === 'pattern.month-principal-control',
  );
  assert.equal(controlFact?.status, '资料不足');
  assert.match(controlFact?.detail ?? '', /丁.*偏财.*庚.*正库/);
  assert.ok(
    pattern.fulfillment?.rootEvidence?.some(
      (item) =>
        item.stem === '庚' &&
        item.rootType === '同类根' &&
        item.rootPositions.includes('时柱丑藏辛（正库）'),
    ),
  );
});

test('申酉本气印根且月令本气为七杀时，杀印链仍可形成', () => {
  const result = evaluatePatternFulfillment(
    // 各柱均为六十甲子合法柱；月令未本气己为七杀，申、酉提供印星本气根。
    pillars(['己酉', '辛未', '癸酉', '庚申']),
    '癸',
    '七杀格',
    getTenGod,
    { strengthStatus: '身弱', monthCommander: '己' },
  );

  assert.equal(result.status, '成格');
  assert.equal(result.pathEvaluations?.find((path) => path.key === '七杀生印')?.status, '满足');
  assert.equal(result.pathEvaluations?.find((path) => path.key === '印生身')?.status, '满足');
  assert.equal(result.pathEvaluations?.find((path) => path.key === '印化杀')?.status, '满足');
  assert.equal(
    result.conditionFacts?.some((fact) => fact.key === 'pattern.month-principal-control'),
    false,
  );
  assert.ok(
    result.rootEvidence?.some(
      (item) =>
        item.stem === '庚' &&
        item.pillar === 'hour' &&
        item.rootPositions.includes('时柱申藏庚（本气）'),
    ),
  );
});
