import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeFortuneTriggers } from '@core/bazi/fortuneTriggerEvidence';
import type { BaziChartResult } from '@core/bazi/baziTypes';

function createResult(): BaziChartResult {
  return {
    pillars: {
      year: { gan: '甲', zhi: '子', ganZhi: '甲子' },
      month: { gan: '己', zhi: '丑', ganZhi: '己丑' },
      day: { gan: '庚', zhi: '申', ganZhi: '庚申' },
      hour: { gan: '丁', zhi: '卯', ganZhi: '丁卯' },
    },
  } as BaziChartResult;
}

test('岁运触发证据应逐层保留原局、大运和流年关系来源', () => {
  const result = analyzeFortuneTriggers(createResult(), [
    { id: 'dayun', type: 'dayun', label: '甲午大运', ganZhi: '甲午' },
    { id: 'year', type: 'year', label: '甲午流年', ganZhi: '甲午' },
  ]);

  assert.equal(result.layers.length, 6);
  assert.ok(
    result.relations.some(
      (item) =>
        item.type === 'suiyun-binglin' && item.source.id === 'year' && item.target.id === 'dayun',
    ),
  );
  assert.ok(
    result.relations.some(
      (item) =>
        item.type === 'branch-clash' &&
        item.source.id === 'year' &&
        item.target.id === 'natal-year',
    ),
  );
  assert.match(result.promptText, /【八字岁运触发结构化证据】/);
  assert.match(result.promptText, /岁运并临/);
  assert.match(result.promptText, /只表示干支关系成立及其所在时间层级/);
});

test('岁运触发证据应识别天克地冲但不直接给出吉凶', () => {
  const result = analyzeFortuneTriggers(createResult(), [
    { id: 'year', type: 'year', label: '庚午流年', ganZhi: '庚午' },
  ]);
  const relation = result.relations.find(
    (item) => item.type === 'tianke-dichong' && item.target.id === 'natal-year',
  );

  assert.ok(relation);
  assert.equal(relation.stemRelation, 'clash');
  assert.equal(relation.branchRelation, 'clash');
  assert.match(relation.interpretationLimit, /不单独决定吉凶/);
  assert.doesNotMatch(result.promptText, /判定为凶|匹配总分：/);
});

test('岁运触发证据应拒绝非法干支，避免生成伪证据', () => {
  assert.throws(
    () =>
      analyzeFortuneTriggers(createResult(), [
        { id: 'year', type: 'year', label: '错误流年', ganZhi: '甲甲' },
      ]),
    /岁运干支地支无效/,
  );
});
