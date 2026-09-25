import assert from 'node:assert/strict';
import test from 'node:test';
import { determineUsefulGod } from '@core/bazi/baziUsefulGodStrategy';
import { formatUsefulGodFunctions } from '@core/bazi/baziAnalysisFormatter';
import { BaziAnalyzer } from '@core/bazi/baziAnalysis';
import { generateEnhancedAnalysisSection } from '@core/bazi/baziPromptEnhancement';
import { getSeasonStatus, getTenGod, getWuxing } from '@core/bazi/baziUtils';
import { HIDDEN_STEMS } from '@core/bazi/baziDefinitions';
import type {
  BaziChartResult,
  HiddenStems,
  PatternAnalysis,
  Pillars,
  Wuxing,
} from '@core/bazi/baziTypes';

function transformedPattern(element: Wuxing): PatternAnalysis {
  return {
    pattern: `化${element}格`,
    isSpecial: true,
    transformation: {
      element,
      status: '成化',
      basis: '日干紧贴配合，化神得令成势且未见破化反证',
      evidence: [],
      conditions: ['化神力量与岁运配合分别核对'],
    },
  };
}

test('五种真化按化神顺势取用，原日主旺衰改变不能倒回普通扶抑', () => {
  const fixtures: Array<[Wuxing, Wuxing, string, string[], string[]]> = [
    ['木', '水', '卯', ['木', '水'], ['金']],
    ['火', '水', '午', ['火', '木'], ['水']],
    ['土', '木', '戌', ['土', '火'], ['木']],
    ['金', '木', '酉', ['金', '土'], ['火']],
    ['水', '火', '子', ['水', '金'], ['土']],
  ];
  for (const [element, originalElement, monthBranch, favorable, unfavorable] of fixtures) {
    for (const strength of ['偏弱', '身强', '极弱', '极强']) {
      const result = determineUsefulGod(
        strength,
        transformedPattern(element),
        originalElement,
        monthBranch,
      );
      assert.deepEqual(result.favorableWuxing, favorable, `${element}化神/${strength}`);
      assert.deepEqual(result.unfavorableWuxing, unfavorable);
      assert.equal(result.primaryReason, '化神顺势');
      assert.equal(result.decisionEvidence?.transformation?.element, element);
      assert.deepEqual(result.decisionEvidence?.climateCandidates, []);
      assert.ok(result.matchedRules?.some((rule) => rule.id === 'transformed-element-following'));
      const text = formatUsefulGodFunctions(result).join('\n');
      assert.match(text, /原日主旺衰保留作本命事实/);
      assert.match(
        result.decisionEvidence!.transformation!.conditions.join('；'),
        /化神太过.*泄耗制化条件/,
      );
      assert.doesNotMatch(text, /取用条件：/);
      assert.doesNotMatch(result.strategyTrace.join('\n'), /身弱取印比|身强取泄耗克/);
    }
  }
});

test('冬月化土按阴寒先火温土，非冬月保留化神顺势次序', () => {
  const cold = determineUsefulGod('偏弱', transformedPattern('土'), '木', '丑');
  const autumn = determineUsefulGod('偏弱', transformedPattern('土'), '木', '戌');
  assert.deepEqual(cold.favorableWuxing, ['火', '土']);
  assert.deepEqual(autumn.favorableWuxing, ['土', '火']);
  assert.match(formatUsefulGodFunctions(cold).join('\n'), /先取火温土/);
});

test('待核与存在反证的化气候选不能触发化神取用', () => {
  for (const status of ['待核验', '存在反证'] as const) {
    const pattern = transformedPattern('木');
    pattern.pattern = '伤官格';
    pattern.isSpecial = false;
    pattern.transformation!.status = status;
    const result = determineUsefulGod('偏弱', pattern, '水', '卯');
    assert.deepEqual(result.favorableWuxing, ['金', '水']);
    assert.equal(result.decisionEvidence?.transformation, undefined);
  }
});

test('子平真诠丁壬化木原例从主格到取用一致，保留本命壬水十神', () => {
  // 《子平真诠》化气格原例：甲戌、丁卯、壬寅、甲辰，取运喜木并喜水生木。
  const pillars = Object.fromEntries(
    ['甲戌', '丁卯', '壬寅', '甲辰'].map((ganZhi, index) => [
      ['year', 'month', 'day', 'hour'][index],
      { gan: ganZhi[0], zhi: ganZhi[1], ganZhi },
    ]),
  ) as Pillars;
  const hiddenStems = Object.fromEntries(
    Object.entries(pillars).map(([key, pillar]) => [key, HIDDEN_STEMS[pillar.zhi]]),
  ) as HiddenStems;
  const analyzer = new BaziAnalyzer(getWuxing, getTenGod, getSeasonStatus);
  const result = analyzer.analyzeBaziChart(pillars, hiddenStems, '乙');
  assert.equal(result.mingGe.transformation?.status, '成化');
  assert.equal(result.mingGe.transformation?.element, '木');
  assert.equal(result.mingGe.isSpecial, true);
  assert.deepEqual(result.usefulGod.favorableWuxing, ['木', '水']);
  assert.deepEqual(result.usefulGod.unfavorableWuxing, ['金']);
  assert.equal(result.usefulGod.useful, '食伤');
  assert.match(formatUsefulGodFunctions(result.usefulGod).join('\n'), /化神木/);
  const enhanced = generateEnhancedAnalysisSection({
    pillars,
    hiddenStems,
    analysis: result,
  } as BaziChartResult);
  assert.match(enhanced, /【化气格局】/);
  assert.doesNotMatch(enhanced, /丁壬化木格（待核验/);
});
