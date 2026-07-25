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
  if (wuxing === '未知') {
    throw new Error(`测试夹具五行无效：${value}`);
  }
  return wuxing;
}

function createValidationPipeline(overrides: Partial<BaziAnalysisPipelineDeps> = {}) {
  return createBaziAnalysisPipeline({
    getWuxing: resolveWuxing,
    getTenGod: () => '比肩',
    getSeasonStatus: () => ({ 水: '休' }),
    analyzeRoot: () => ({ roots: [], totalStrength: 0, hasRoot: false, strongRoot: false }),
    analyzeFormation: () => ({ formations: [], totalStrength: 0 }),
    analyzeSupport: () => ({ supporters: [], totalStrength: 0, hasSupport: false }),
    analyzeConstraint: () => ({ constraints: [], totalStrength: 0, hasConstraint: false }),
    analyzeSeasonalStatus: () => ({ status: '休', score: 0, isTimely: false }),
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
    determinePattern: (): PatternAnalysis => ({
      pattern: '偏印格',
      isSpecial: false,
    }),
    determineUsefulGod: () => ({
      favorable: [],
      unfavorable: [],
      useful: '火',
      avoid: '水',
      favorableWuxing: ['火'],
      unfavorableWuxing: ['水'],
    }),
    ...overrides,
  });
}

test('分析管道应把当前节气传入取用判断，避免节后分段规则在整链路中失效', () => {
  const captured: { currentJieqi?: string } = {};
  const pipeline = createBaziAnalysisPipeline({
    getWuxing: () => '水' as Wuxing,
    getTenGod: () => '比肩',
    getSeasonStatus: () => ({ 水: '休' }),
    analyzeRoot: () => ({ roots: [], totalStrength: 0, hasRoot: false, strongRoot: false }),
    analyzeFormation: () => ({ formations: [], totalStrength: 0 }),
    analyzeSupport: () => ({ supporters: [], totalStrength: 0, hasSupport: false }),
    analyzeConstraint: () => ({ constraints: [], totalStrength: 0, hasConstraint: false }),
    analyzeSeasonalStatus: () => ({ status: '休', score: 0, isTimely: false }),
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
    determinePattern: (): PatternAnalysis => ({
      pattern: '偏印格',
      isSpecial: false,
    }),
    determineUsefulGod: (
      _strengthStatus,
      _pattern,
      _dmWuxing,
      _monthBranch,
      _monthCommander,
      _dayMasterStem,
      climateContext,
    ) => {
      captured.currentJieqi = climateContext?.currentJieqi;
      return {
        favorable: [],
        unfavorable: [],
        useful: '火',
        avoid: '水',
        favorableWuxing: ['火'],
        unfavorableWuxing: ['水'],
      };
    },
  });

  const pillars: Pillars = {
    year: { gan: '甲', zhi: '辰', ganZhi: '甲辰' },
    month: { gan: '戊', zhi: '辰', ganZhi: '戊辰' },
    day: { gan: '癸', zhi: '未', ganZhi: '癸未' },
    hour: { gan: '丙', zhi: '辰', ganZhi: '丙辰' },
  };
  const hiddenStems: HiddenStems = {
    year: ['戊', '乙', '癸'],
    month: ['戊', '乙', '癸'],
    day: ['己', '丁', '乙'],
    hour: ['戊', '乙', '癸'],
  };

  pipeline.run({
    pillars,
    hiddenStems,
    monthCommander: '戊',
    seasonInfo: {
      currentJieqi: '谷雨',
    },
  });

  assert.equal(captured.currentJieqi, '谷雨');
});

test('分析管道应把藏干来源与成局五行传入取用判断，避免按支取象的规则在整链路中失效', () => {
  const captured: {
    hiddenStems?: string[];
    hiddenStemSources?: Array<{ pillar: string; branch: string; stems: string[] }>;
    formationWuxings?: string[];
  } = {};
  const pipeline = createBaziAnalysisPipeline({
    getWuxing: (value) => {
      const map: Record<string, Wuxing> = {
        甲: '木',
        乙: '木',
        丙: '火',
        丁: '火',
        戊: '土',
        己: '土',
        庚: '金',
        辛: '金',
        壬: '水',
        癸: '水',
        巳: '火',
        酉: '金',
        丑: '土',
        子: '水',
        戌: '土',
      };
      return map[value] || '土';
    },
    getTenGod: () => '比肩',
    getSeasonStatus: () => ({ 火: '休' }),
    analyzeRoot: () => ({ roots: [], totalStrength: 0, hasRoot: false, strongRoot: false }),
    analyzeFormation: () => ({ formations: [], totalStrength: 0 }),
    analyzeSupport: () => ({ supporters: [], totalStrength: 0, hasSupport: false }),
    analyzeConstraint: () => ({ constraints: [], totalStrength: 0, hasConstraint: false }),
    analyzeSeasonalStatus: () => ({ status: '休', score: 0, isTimely: false }),
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
    determinePattern: (): PatternAnalysis => ({
      pattern: '食神格',
      isSpecial: false,
    }),
    determineUsefulGod: (
      _strengthStatus,
      _pattern,
      _dmWuxing,
      _monthBranch,
      _monthCommander,
      _dayMasterStem,
      climateContext,
    ) => {
      captured.hiddenStems = climateContext?.hiddenStems;
      captured.hiddenStemSources = climateContext?.hiddenStemSources;
      captured.formationWuxings = climateContext?.formationWuxings;
      return {
        favorable: [],
        unfavorable: [],
        useful: '火',
        avoid: '水',
        favorableWuxing: ['火'],
        unfavorableWuxing: ['水'],
      };
    },
  });

  const pillars: Pillars = {
    year: { gan: '己', zhi: '巳', ganZhi: '己巳' },
    month: { gan: '辛', zhi: '酉', ganZhi: '辛酉' },
    day: { gan: '丙', zhi: '子', ganZhi: '丙子' },
    hour: { gan: '己', zhi: '丑', ganZhi: '己丑' },
  };
  const hiddenStems: HiddenStems = {
    year: ['丙', '庚', '戊'],
    month: ['辛'],
    day: ['癸'],
    hour: ['己', '癸', '辛'],
  };

  pipeline.run({
    pillars,
    hiddenStems,
    monthCommander: '辛',
    seasonInfo: {
      currentJieqi: '白露',
    },
  });

  assert.deepEqual(captured.hiddenStems, ['丙', '庚', '戊', '辛', '癸', '己', '癸', '辛']);
  assert.deepEqual(captured.hiddenStemSources, [
    { pillar: 'year', branch: '巳', stems: ['丙', '庚', '戊'] },
    { pillar: 'month', branch: '酉', stems: ['辛'] },
    { pillar: 'day', branch: '子', stems: ['癸'] },
    { pillar: 'hour', branch: '丑', stems: ['己', '癸', '辛'] },
  ]);
  assert.deepEqual(captured.formationWuxings, ['金']);
});

test('分析管道应把明透天干柱位传入取用判断，避免后续规则无法表达某柱透某干', () => {
  const captured: { visibleStemSources?: Array<{ pillar: string; stem: string }> } = {};
  const pipeline = createBaziAnalysisPipeline({
    getWuxing: () => '金' as Wuxing,
    getTenGod: () => '比肩',
    getSeasonStatus: () => ({ 金: '旺' }),
    analyzeRoot: () => ({ roots: [], totalStrength: 0, hasRoot: false, strongRoot: false }),
    analyzeFormation: () => ({ formations: [], totalStrength: 0 }),
    analyzeSupport: () => ({ supporters: [], totalStrength: 0, hasSupport: false }),
    analyzeConstraint: () => ({ constraints: [], totalStrength: 0, hasConstraint: false }),
    analyzeSeasonalStatus: () => ({ status: '旺', score: 0, isTimely: true }),
    analyzeDayMasterStrength: () => ({
      status: '身强',
      details: {
        timely: true,
        seasonalEffect: '支持',
        commanderEffect: '中性',
        formationEffect: '中性',
        hasRoot: false,
        hasStrongRoot: false,
        hasSupport: false,
        hasConstraint: false,
        ruleBasis: [],
      },
    }),
    determinePattern: (): PatternAnalysis => ({
      pattern: '偏印格',
      isSpecial: false,
    }),
    determineUsefulGod: (
      _strengthStatus,
      _pattern,
      _dmWuxing,
      _monthBranch,
      _monthCommander,
      _dayMasterStem,
      climateContext,
    ) => {
      captured.visibleStemSources = (
        climateContext as typeof climateContext & {
          visibleStemSources?: Array<{ pillar: string; stem: string }>;
        }
      )?.visibleStemSources;
      return {
        favorable: [],
        unfavorable: [],
        useful: '水',
        avoid: '土',
        favorableWuxing: ['水'],
        unfavorableWuxing: ['土'],
      };
    },
  });

  const pillars: Pillars = {
    year: { gan: '甲', zhi: '辰', ganZhi: '甲辰' },
    month: { gan: '丁', zhi: '未', ganZhi: '丁未' },
    day: { gan: '辛', zhi: '亥', ganZhi: '辛亥' },
    hour: { gan: '壬', zhi: '寅', ganZhi: '壬寅' },
  };
  const hiddenStems: HiddenStems = {
    year: ['戊', '乙', '癸'],
    month: ['己', '丁', '乙'],
    day: ['壬', '甲'],
    hour: ['甲', '丙', '戊'],
  };

  pipeline.run({
    pillars,
    hiddenStems,
    monthCommander: '己',
    seasonInfo: {
      currentJieqi: '小暑',
    },
  });

  assert.deepEqual(captured.visibleStemSources, [
    { pillar: 'year', stem: '甲' },
    { pillar: 'month', stem: '丁' },
    { pillar: 'day', stem: '辛' },
    { pillar: 'hour', stem: '壬' },
  ]);
});

test('分析管道应拒绝非法四柱，不应把坏日主继续送入旺衰和用神计算', () => {
  const pipeline = createValidationPipeline();

  assert.throws(
    () =>
      pipeline.run({
        pillars: {
          ...VALID_PILLARS,
          day: { gan: '风', zhi: '未', ganZhi: '风未' },
        },
        hiddenStems: VALID_HIDDEN_STEMS,
      }),
    /day柱天干无效/,
  );
});

test('分析管道应拒绝非法藏干和司令天干，不应让取用规则读取伪造证据', () => {
  const pipeline = createValidationPipeline();

  assert.throws(
    () =>
      pipeline.run({
        pillars: VALID_PILLARS,
        hiddenStems: {
          ...VALID_HIDDEN_STEMS,
          month: ['戊', '癸', '乙'],
        },
      }),
    /month柱藏干与地支辰不一致/,
  );
  assert.throws(
    () =>
      pipeline.run({
        pillars: VALID_PILLARS,
        hiddenStems: {
          ...VALID_HIDDEN_STEMS,
          month: ['风'],
        },
      }),
    /month柱藏干无效/,
  );
  assert.throws(
    () =>
      pipeline.run({
        pillars: VALID_PILLARS,
        hiddenStems: {
          ...VALID_HIDDEN_STEMS,
          hour: undefined as unknown as string[],
        },
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

test('分析管道应拒绝异常五行映射，不应把未知五行计入用神上下文', () => {
  const dayMasterBrokenPipeline = createValidationPipeline({
    getWuxing: (value) => (value === '癸' ? ('未知' as Wuxing) : resolveWuxing(value)),
  });
  const visibleStemBrokenPipeline = createValidationPipeline({
    getWuxing: (value) => (value === '甲' ? ('未知' as Wuxing) : resolveWuxing(value)),
  });

  assert.throws(
    () =>
      dayMasterBrokenPipeline.run({
        pillars: VALID_PILLARS,
        hiddenStems: VALID_HIDDEN_STEMS,
      }),
    /日主五行无效/,
  );
  assert.throws(
    () =>
      visibleStemBrokenPipeline.run({
        pillars: VALID_PILLARS,
        hiddenStems: VALID_HIDDEN_STEMS,
      }),
    /第1个四柱字符五行无效/,
  );
});
