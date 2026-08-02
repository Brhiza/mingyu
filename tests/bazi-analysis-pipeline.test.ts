import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createBaziAnalysisPipeline,
  type BaziAnalysisPipelineDeps,
} from '@core/bazi/baziAnalysisPipeline';
import type { HiddenStems, PatternAnalysis, Pillars, Wuxing } from '@core/bazi/baziTypes';
import { getWuxing as getBaziWuxing } from '@core/bazi/baziUtils';

const VALID_PILLARS: Pillars = {
  year: { gan: '甲', zhi: '辰', ganZhi: '甲辰' },
  month: { gan: '戊', zhi: '辰', ganZhi: '戊辰' },
  day: { gan: '癸', zhi: '未', ganZhi: '癸未' },
  hour: { gan: '丙', zhi: '辰', ganZhi: '丙辰' },
};

const VALID_HIDDEN_STEMS: HiddenStems = {
  year: ['戊', '乙', '癸'],
  month: ['戊', '乙', '癸'],
  day: ['己', '丁', '乙'],
  hour: ['戊', '乙', '癸'],
};

function resolveWuxing(value: string): Wuxing {
  const wuxing = getBaziWuxing(value);
  if (wuxing === '未知') throw new Error(`测试夹具五行无效：${value}`);
  return wuxing;
}

function createPipeline(overrides: Partial<BaziAnalysisPipelineDeps> = {}) {
  return createBaziAnalysisPipeline({
    getWuxing: resolveWuxing,
    getTenGod: () => '比肩',
    getSeasonStatus: () => ({ 水: '休' }),
    analyzeRoot: () => ({ roots: [], hasRoot: false, strongRoot: false }),
    analyzeFormation: () => ({ formations: [] }),
    analyzeSupport: () => ({ supporters: [], hasSupport: false }),
    analyzeConstraint: () => ({ constraints: [], hasConstraint: false }),
    analyzeSeasonalStatus: () => ({ status: '休', isTimely: false }),
    analyzeDayMasterStrength: () => ({
      status: '身弱',
      details: {
        timely: false,
        seasonalEffect: '中性',
        commanderEffect: '中性',
        formationEffect: '中性',
        hasRoot: false,
        hasStrongRoot: false,
        hasSupport: false,
        hasConstraint: false,
        ruleBasis: [],
      },
    }),
    determinePattern: (): PatternAnalysis => ({ pattern: '偏印格', isSpecial: false }),
    ...overrides,
  });
}

test('八字分析管道只返回已审核旺衰与格局，不输出待校用神空结构', () => {
  const result = createPipeline().run({
    pillars: VALID_PILLARS,
    hiddenStems: VALID_HIDDEN_STEMS,
    monthCommander: '戊',
  });

  assert.equal(result.dayMasterStrength.status, '身弱');
  assert.deepEqual(result.mingGe, { pattern: '偏印格', isSpecial: false });
  assert.equal('usefulGod' in result, false);
});

test('八字分析管道仍应拒绝非法四柱、藏干和司令天干', () => {
  const pipeline = createPipeline();

  assert.throws(
    () =>
      pipeline.run({
        pillars: { ...VALID_PILLARS, day: { gan: '风', zhi: '未', ganZhi: '风未' } },
        hiddenStems: VALID_HIDDEN_STEMS,
      }),
    /day柱天干无效/,
  );
  assert.throws(
    () =>
      pipeline.run({
        pillars: VALID_PILLARS,
        hiddenStems: { ...VALID_HIDDEN_STEMS, month: ['戊', '癸', '乙'] },
      }),
    /month柱藏干与地支辰不一致/,
  );
  assert.throws(
    () =>
      pipeline.run({
        pillars: VALID_PILLARS,
        hiddenStems: { ...VALID_HIDDEN_STEMS, hour: undefined as unknown as string[] },
      }),
    /藏干缺少hour/,
  );
  assert.throws(
    () =>
      pipeline.run({
        pillars: VALID_PILLARS,
        hiddenStems: VALID_HIDDEN_STEMS,
        monthCommander: '风',
      }),
    /月令司权天干无效/,
  );
});
