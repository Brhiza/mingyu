import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeFortuneActionEvidence } from '@core/bazi/fortuneActionEvidence';
import type { BaziChartResult } from '@core/bazi/baziTypes';
import type { FortuneTriggerEvidenceResult } from '@core/bazi/fortuneTriggerEvidence';

test('同五行但非同天干不作为根气', () => {
  const result = {
    analysis: {
      usefulGod: {
        conditionalFavorableStems: ['甲'],
      },
    },
    pillars: {
      year: { gan: '丙', zhi: '子', ganZhi: '丙子' },
      month: { gan: '丁', zhi: '丑', ganZhi: '丁丑' },
      day: { gan: '戊', zhi: '寅', ganZhi: '戊寅' },
      hour: { gan: '己', zhi: '卯', ganZhi: '己卯' },
    },
    dayMaster: { gan: '戊' },
  } as unknown as BaziChartResult;

  // 移除寅后，岁运甲只剩卯中乙的同五行旁证，不应扩大成甲的同干根气。
  result.pillars!.day = { gan: '戊', zhi: '午', ganZhi: '戊午' };

  const layers = [{ id: '1', type: 'year' as const, label: '流年', ganZhi: '甲戌' }];

  const evidence = analyzeFortuneActionEvidence({ result, layers });
  const fact = evidence.facts.find((f) => f.stem === '甲' && f.placement === '岁运透干');

  assert.ok(fact);
  assert.strictEqual(fact!.rootEvidence?.hasClearRoot, false);
  assert.strictEqual(fact!.currentActionStatus, '资料不足');
});

test('岁运透干有原局同干根气', () => {
  const result = {
    analysis: {
      usefulGod: {
        conditionalFavorableStems: ['甲'],
      },
    },
    pillars: {
      year: { gan: '丙', zhi: '子', ganZhi: '丙子' },
      month: { gan: '丁', zhi: '丑', ganZhi: '丁丑' },
      day: { gan: '戊', zhi: '寅', ganZhi: '戊寅' },
      hour: { gan: '己', zhi: '卯', ganZhi: '己卯' },
    },
    dayMaster: { gan: '戊' },
  } as unknown as BaziChartResult;

  const layers = [{ id: '1', type: 'year' as const, label: '流年', ganZhi: '甲戌' }];

  const evidence = analyzeFortuneActionEvidence({ result, layers });
  const fact = evidence.facts.find((f) => f.stem === '甲' && f.placement === '岁运透干');

  assert.ok(fact);
  assert.strictEqual(fact!.rootEvidence?.hasClearRoot, true);
  assert.strictEqual(fact!.currentActionStatus, '满足');
  assert.strictEqual(
    fact!.rootEvidence?.natalRoots.some((r) => r.isSameStem && r.branch === '寅'),
    true,
  );
  assert.strictEqual(
    fact!.rootEvidence?.natalRoots.find((r) => r.isSameStem && r.branch === '寅')?.traditionalKind,
    '本气',
  );
});

test('未显式提供层键时仍能识别当前岁运根气', () => {
  const result = {
    analysis: {
      usefulGod: {
        conditionalFavorableStems: ['甲'],
      },
    },
    pillars: {
      year: { gan: '丙', zhi: '子', ganZhi: '丙子' },
      month: { gan: '丁', zhi: '丑', ganZhi: '丁丑' },
      day: { gan: '戊', zhi: '午', ganZhi: '戊午' },
      hour: { gan: '己', zhi: '酉', ganZhi: '己酉' },
    },
    dayMaster: { gan: '戊' },
  } as unknown as BaziChartResult;

  const evidence = analyzeFortuneActionEvidence({
    result,
    layers: [{ id: '1', type: 'year' as const, label: '流年', ganZhi: '甲寅' }],
  });
  const fact = evidence.facts.find((f) => f.stem === '甲' && f.placement === '岁运透干');

  assert.ok(fact);
  assert.strictEqual(fact!.rootEvidence?.isSelfRooted, true);
  assert.strictEqual(fact!.currentActionStatus, '满足');
});

test('透干根气遇未裁决合冲时保持资料不足', () => {
  const result = {
    analysis: {
      usefulGod: {
        conditionalFavorableStems: ['甲'],
      },
    },
    pillars: {
      year: { gan: '丙', zhi: '子', ganZhi: '丙子' },
      month: { gan: '丁', zhi: '丑', ganZhi: '丁丑' },
      day: { gan: '戊', zhi: '寅', ganZhi: '戊寅' },
      hour: { gan: '己', zhi: '卯', ganZhi: '己卯' },
    },
    dayMaster: { gan: '戊' },
  } as unknown as BaziChartResult;
  const layerKey = 'bazi:fortune-trigger:layer:year:1';
  const triggerEvidence = {
    relations: [
      {
        source: { type: 'year' },
        target: { type: 'natal' },
        sourceLayerKey: layerKey,
        targetLayerKey: 'bazi:fortune-trigger:layer:natal:day',
        stemRelation: 'combine',
      },
    ],
  } as unknown as FortuneTriggerEvidenceResult;

  const evidence = analyzeFortuneActionEvidence({
    result,
    layers: [{ id: '1', type: 'year' as const, label: '流年', ganZhi: '甲戌' }],
    triggerEvidence,
  });
  const fact = evidence.facts.find((f) => f.stem === '甲' && f.placement === '岁运透干');

  assert.ok(fact);
  assert.strictEqual(fact!.rootEvidence?.hasClearRoot, true);
  assert.strictEqual(fact!.currentActionStatus, '资料不足');
});

test('只有藏干余气时不升级作用状态', () => {
  const result = {
    analysis: {
      usefulGod: {
        conditionalFavorableStems: ['乙'],
      },
    },
    pillars: {
      year: { gan: '丙', zhi: '子', ganZhi: '丙子' },
      month: { gan: '丁', zhi: '丑', ganZhi: '丁丑' },
      day: { gan: '戊', zhi: '辰', ganZhi: '戊辰' },
      hour: { gan: '己', zhi: '酉', ganZhi: '己酉' },
    },
    dayMaster: { gan: '戊' },
  } as unknown as BaziChartResult;

  const layers = [{ id: '1', type: 'year' as const, label: '流年', ganZhi: '乙亥' }];

  const evidence = analyzeFortuneActionEvidence({ result, layers });
  const fact = evidence.facts.find((f) => f.stem === '乙' && f.placement === '岁运透干');

  assert.ok(fact);
  assert.strictEqual(fact!.rootEvidence?.hasClearRoot, false);
  assert.strictEqual(fact!.currentActionStatus, '资料不足');
  assert.strictEqual(
    fact!.rootEvidence?.natalRoots.find((r) => r.isSameStem)?.traditionalKind,
    '余气',
  );
});

test('根气证据不足', () => {
  const result = {
    analysis: {
      usefulGod: {
        conditionalFavorableStems: ['甲'],
      },
    },
    pillars: {
      year: { gan: '丙', zhi: '子', ganZhi: '丙子' },
      month: { gan: '丁', zhi: '丑', ganZhi: '丁丑' },
      day: { gan: '戊', zhi: '午', ganZhi: '戊午' },
      hour: { gan: '己', zhi: '酉', ganZhi: '己酉' },
    },
    dayMaster: { gan: '戊' },
  } as unknown as BaziChartResult;

  const layers = [{ id: '1', type: 'year' as const, label: '流年', ganZhi: '甲戌' }];

  const evidence = analyzeFortuneActionEvidence({ result, layers });
  const fact = evidence.facts.find((f) => f.stem === '甲' && f.placement === '岁运透干');

  assert.ok(fact);
  assert.strictEqual(fact!.rootEvidence?.hasClearRoot, false);
  assert.strictEqual(fact!.currentActionStatus, '资料不足');
});

test('遇到未实现的制化时继续保持资料不足', () => {
  const result = {
    analysis: {
      usefulGod: {
        conditionalFavorableStems: ['甲'],
        decisionEvidence: {
          controlFunctions: [
            { sourceStems: ['甲'], targetStems: ['戊'], status: '待定', key: 'test' },
          ],
        },
      },
    },
    pillars: {
      year: { gan: '丙', zhi: '子', ganZhi: '丙子' },
      month: { gan: '丁', zhi: '丑', ganZhi: '丁丑' },
      day: { gan: '戊', zhi: '寅', ganZhi: '戊寅' },
      hour: { gan: '己', zhi: '卯', ganZhi: '己卯' },
    },
    dayMaster: { gan: '戊' },
  } as unknown as BaziChartResult;

  const layers = [{ id: '1', type: 'year' as const, label: '流年', ganZhi: '甲戌' }];

  const evidence = analyzeFortuneActionEvidence({ result, layers });
  const fact = evidence.facts.find((f) => f.stem === '甲' && f.placement === '岁运透干');

  assert.ok(fact);
  assert.strictEqual(fact!.rootEvidence?.hasClearRoot, true);
  assert.strictEqual(fact!.currentActionStatus, '资料不足');
});
