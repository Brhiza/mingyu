import assert from 'node:assert/strict';
import test from 'node:test';
import { BaziAnalyzer } from '@core/bazi/baziAnalysis';
import { getWuxing, getTenGod, getSeasonStatus } from '@core/bazi/baziUtils';
import { HIDDEN_STEMS } from '@core/bazi/baziDefinitions';
import type { Pillars, HiddenStems, BaziChartResult } from '@core/bazi/baziTypes';
import { determineUsefulGod } from '@core/bazi/baziUsefulGodStrategy';
import { formatUsefulGodFunctions } from '@core/bazi/baziAnalysisFormatter';
import type { HiddenStemSource, VisibleStemSource } from '@core/bazi/baziRuleMatcher';
import { formatBaziDecisionDetails } from '../src/lib/bazi-decision-details';

const hidden: HiddenStemSource[] = [
  { pillar: 'year', branch: '午', stems: ['丁', '己'] },
  { pillar: 'month', branch: '午', stems: ['丁', '己'] },
  { pillar: 'day', branch: '丑', stems: ['己', '癸', '辛'] },
  { pillar: 'hour', branch: '丑', stems: ['己', '癸', '辛'] },
];
const visible: VisibleStemSource[] = [
  { pillar: 'year', stem: '甲' },
  { pillar: 'month', stem: '庚' },
  { pillar: 'day', stem: '癸' },
  { pillar: 'hour', stem: '癸' },
];
function decide(roots = hidden, stems = visible, strength = '身弱', isSpecial = false) {
  return determineUsefulGod(
    strength,
    { pattern: isSpecial ? '从杀格' : '七杀格', isSpecial },
    '水',
    '午',
    '己',
    '癸',
    {
      hiddenStemSources: roots,
      visibleStemSources: stems,
    },
  );
}

test('午月癸水弱印坐财、比劫有根时说明水金护印配合', () => {
  const pillars = Object.fromEntries(
    ['甲午', '庚午', '癸丑', '癸丑'].map((ganZhi, index) => [
      ['year', 'month', 'day', 'hour'][index],
      { gan: ganZhi[0], zhi: ganZhi[1], ganZhi },
    ]),
  ) as Pillars;
  const hiddenStems = Object.fromEntries(
    Object.entries(pillars).map(([key, pillar]) => [key, HIDDEN_STEMS[pillar.zhi]]),
  ) as HiddenStems;
  const analysis = new BaziAnalyzer(getWuxing, getTenGod, getSeasonStatus).analyzeBaziChart(
    pillars,
    hiddenStems,
    '己',
  );
  const result = { pillars, hiddenStems, analysis, dayMaster: { gan: '癸' } } as BaziChartResult;
  assert.equal(result.analysis.dayMasterStrength.status, '身弱');
  const useful = result.analysis.usefulGod;
  assert.deepEqual(useful.favorableWuxing, ['水', '金']);
  assert.deepEqual(useful.decisionEvidence?.base.favorable, ['金', '水']);
  assert.match(
    useful.decisionEvidence?.balanceAdjustment?.reason ?? '',
    /印坐财受制.*比劫透而有根.*印比配合/,
  );
  assert.match(formatUsefulGodFunctions(useful).join('\n'), /取用配合：/);
  assert.match(formatBaziDecisionDetails(result).join('\n'), /取用配合：/);
  assert.doesNotMatch(JSON.stringify(useful), /富贵永无边|可按金水会夏天论富贵|多主富贵/);
});

test('印有实根时保留印先，不把夏月金水全部重排', () => {
  const roots = hidden.map((source) =>
    source.pillar === 'year' ? { ...source, branch: '申', stems: ['庚', '壬', '戊'] } : source,
  );
  assert.deepEqual(decide(roots).favorableWuxing, ['金', '水']);
  assert.equal(decide(roots).decisionEvidence?.balanceAdjustment, undefined);
});

test('有印比但缺少比劫根、比劫未透或印并非坐财时不判护印配合已具', () => {
  const noRoot = hidden.map((source) =>
    source.pillar === 'hour' || source.pillar === 'day'
      ? { ...source, branch: '卯', stems: ['乙'] }
      : source,
  );
  const noCompanion = visible.map((source) =>
    source.pillar === 'hour' ? { ...source, stem: '乙' } : source,
  );
  const otherResource = visible.map((source) =>
    source.pillar === 'year' ? { ...source, stem: '辛' } : source,
  );
  for (const result of [
    decide(noRoot),
    decide(hidden, noCompanion),
    decide(
      hidden.map((source) =>
        source.pillar === 'year' ? { ...source, branch: '卯', stems: ['乙'] } : source,
      ),
      otherResource,
    ),
  ]) {
    assert.equal(result.decisionEvidence?.balanceAdjustment, undefined);
  }
});

test('根受冲、身强与特殊从格不套用弱印护印次序', () => {
  const clashed = hidden.map((source) =>
    source.pillar === 'year' ? { ...source, branch: '未', stems: ['己', '丁', '乙'] } : source,
  );
  for (const result of [
    decide(clashed),
    decide(hidden, visible, '身强'),
    decide(hidden, visible, '极弱', true),
  ]) {
    assert.equal(result.decisionEvidence?.balanceAdjustment, undefined);
  }
});

test('财旺弱印的护印判据适用于其他日主，缺柱位资料时保留基线', () => {
  const result = determineUsefulGod(
    '身弱',
    { pattern: '偏财格', isSpecial: false },
    '木',
    '辰',
    undefined,
    '甲',
    {
      visibleStemSources: [
        { pillar: 'year', stem: '己' },
        { pillar: 'month', stem: '壬' },
        { pillar: 'day', stem: '甲' },
        { pillar: 'hour', stem: '乙' },
      ],
      hiddenStemSources: [
        { pillar: 'year', branch: '未', stems: ['己', '丁', '乙'] },
        { pillar: 'month', branch: '辰', stems: ['戊', '乙', '癸'] },
        { pillar: 'day', branch: '寅', stems: ['甲', '丙', '戊'] },
        { pillar: 'hour', branch: '卯', stems: ['乙'] },
      ],
    },
  );
  assert.deepEqual(result.favorableWuxing, ['木', '水']);
  assert.match(result.decisionEvidence?.balanceAdjustment?.reason ?? '', /先以木.*再取水/);
  assert.deepEqual(
    determineUsefulGod('身弱', { pattern: '偏财格', isSpecial: false }, '木').favorableWuxing,
    ['水', '木'],
  );
});
