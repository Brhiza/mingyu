import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzePillarRelations,
  generateEnhancedAnalysisSection,
} from '@core/bazi/baziPromptEnhancement';
import {
  collectCompleteBranchFormations,
  collectEstablishedBranchFormations,
} from '@core/bazi/baziFormationUtils';
import type { BaziChartResult, Pillars } from '@core/bazi/baziTypes';

function makePillars(values: string[]): Pillars {
  return Object.fromEntries(
    ['year', 'month', 'day', 'hour'].map((key, index) => [
      key,
      { gan: values[index][0], zhi: values[index][1], ganZhi: values[index] },
    ]),
  ) as Pillars;
}

function makePromptChart(pillars: Pillars): BaziChartResult {
  return {
    pillars,
    wuxingStrength: { present: [], dominantByRule: [], missing: [] },
    shensha: { year: [], month: [], day: [], hour: [], global: [] },
  } as unknown as BaziChartResult;
}

test('三合结构齐全但未成势时，关系和增强提示词不写成已成势', () => {
  const pillars = makePillars(['戊申', '丙辰', '壬子', '壬寅']);
  assert.equal(collectCompleteBranchFormations(pillars).length, 1);
  assert.equal(collectEstablishedBranchFormations(pillars).length, 0);

  const relations = analyzePillarRelations({ pillars });
  assert.ok(relations.xingChong.includes('地支见申子辰三合结构（结构齐全，成势待核）'));
  assert.ok(!relations.xingChong.includes('地支成申子辰三合（已成势）'));

  const prompt = generateEnhancedAnalysisSection(makePromptChart(pillars));
  assert.match(prompt, /地支见申子辰三合结构（结构齐全，成势待核）/);
  assert.doesNotMatch(prompt, /地支成申子辰三合（已成势）/);
});

test('满足月令且无局外冲破时，三合关系标记为已成势', () => {
  const pillars = makePillars(['戊子', '庚申', '壬辰', '庚子']);
  assert.equal(collectCompleteBranchFormations(pillars).length, 1);
  assert.equal(collectEstablishedBranchFormations(pillars).length, 1);

  const relations = analyzePillarRelations({ pillars });
  assert.ok(relations.xingChong.includes('地支成申子辰三合（已成势）'));

  const prompt = generateEnhancedAnalysisSection(makePromptChart(pillars));
  assert.match(prompt, /地支成申子辰三合（已成势）/);
});

test('满足月令且无局外冲破时，三会关系也标记为已成势', () => {
  const pillars = makePillars(['甲寅', '丁卯', '丙辰', '庚午']);
  assert.equal(collectCompleteBranchFormations(pillars).length, 1);
  assert.equal(collectEstablishedBranchFormations(pillars).length, 1);

  const relations = analyzePillarRelations({ pillars });
  assert.ok(relations.xingChong.includes('地支成寅卯辰三会（已成势）'));

  const prompt = generateEnhancedAnalysisSection(makePromptChart(pillars));
  assert.match(prompt, /地支成寅卯辰三会（已成势）/);
});

test('缺时辰的空时柱不会触发关系枚举或抛出异常', () => {
  const pillars = makePillars(['戊申', '丙辰', '壬子', '壬寅']);
  pillars.hour = { gan: '', zhi: '', ganZhi: '' };

  assert.deepEqual(analyzePillarRelations({ pillars }), {
    fuxin: [],
    fanyin: [],
    sameStem: [],
    sameBranch: [],
    xingChong: [],
  });

  const prompt = generateEnhancedAnalysisSection({
    ...makePromptChart(pillars),
    isThreePillars: true,
    unknownTimeAnalysis: {
      status: '待补时',
      summary: '出生时辰待补充',
      uncertainPillars: [],
      scenarios: [],
    },
  });
  assert.match(prompt, /【待补时】/);
});
