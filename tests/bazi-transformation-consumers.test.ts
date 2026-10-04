import assert from 'node:assert/strict';
import test from 'node:test';

import { analyzeBaziCompatibility } from '../packages/core/src/bazi/compatibilityEvidence.ts';
import { baziCalculator } from '../packages/core/src/bazi/baziCalculator.ts';
import {
  buildBaziPrompt,
  buildBaziCompatibilityPrompt,
  formatBaziPatternConditions,
} from '../packages/core/src/prompt/bazi.ts';
import { getBaziDitiansuiAdvice } from '../packages/core/src/classics/index.ts';
import { formatBaziSchoolPrompt } from '../packages/core/src/prompt/bazi-school.ts';
import {
  buildBeginnerGuide,
  buildEnhancedPatternUsefulGodSection,
} from '../packages/core/src/minglu/bazi-enhancer.ts';
import {
  analyzeChineseName,
  buildChineseNameAnalysisPrompt,
  calculateNamingBirthContext,
} from '../packages/core/src/name-number/index.ts';
import { formatBaziDecisionDetails } from '../src/lib/bazi-decision-details.ts';

const INPUT = {
  year: 1904,
  month: 1,
  day: 20,
  timeIndex: 0,
  gender: 'male' as const,
  isLunar: false,
};

const TRANSFORMATION = {
  element: '木' as const,
  status: '成化' as const,
  basis: '丁壬紧贴相合，木得月令成势，未见破化反证',
  evidence: ['丁壬同透并相合', '木得令且有水生'],
  conditions: ['岁运继续核验化神承载与制化'],
};

function makeTransformedChart() {
  const chart = baziCalculator.calculateBazi(INPUT);
  chart.analysis.mingGe = {
    ...chart.analysis.mingGe,
    pattern: '丁壬化木格',
    isSpecial: true,
    basis: TRANSFORMATION.basis,
    transformation: TRANSFORMATION,
    fulfillment: undefined,
  };
  chart.analysis.usefulGod = {
    ...chart.analysis.usefulGod,
    favorable: ['食神', '伤官'],
    unfavorable: ['正官'],
    useful: '食伤',
    avoid: '官杀',
    primaryFavorable: ['食神'],
    primaryUnfavorable: ['正官'],
    favorableWuxing: ['木', '水'],
    unfavorableWuxing: ['金'],
    primaryFavorableWuxing: '木',
    secondaryFavorableWuxing: ['水'],
    primaryUnfavorableWuxing: '金',
    primaryUseful: '食神',
    primaryAvoid: '正官',
    primaryReason: '化神顺势',
    strategyTrace: ['以化神木为取用主体，原日主旺衰与十神保留为本命事实。'],
  };
  assert.ok(chart.analysis.usefulGod.decisionEvidence);
  chart.analysis.usefulGod.decisionEvidence.transformation = {
    element: TRANSFORMATION.element,
    basis: '以化神木为取用主体，木同气并取水生木，原日主旺衰与十神保留为本命事实。',
    conditions: TRANSFORMATION.conditions,
  };
  return chart;
}

test('化气主格贯通流派、命录与普通提示词消费者', () => {
  const chart = makeTransformedChart();
  const patternFacts = formatBaziPatternConditions(chart);
  assert.equal(patternFacts, '');

  for (const school of ['ziping', 'mangpai', 'xinpai'] as const) {
    const prompt = formatBaziSchoolPrompt(chart, school);
    assert.match(prompt, /化气判定：成化/);
    assert.match(prompt, /化神木/);
    assert.match(prompt, /丁壬紧贴相合，木得月令成势/);
    assert.doesNotMatch(prompt, /取用条件：岁运继续核验|化气证据：/);
    assert.doesNotMatch(prompt, /化气条件：/);
  }

  const prompt = buildBaziPrompt({ result: chart, topic: 'general', school: 'ziping' });
  assert.doesNotMatch(prompt, /【格局条件】/);
  assert.match(prompt, /格局: 丁壬化木格[^\n]*化气判定：成化/);
  assert.match(prompt, /化神取用：以化神木为取用主体/);
  assert.doesNotMatch(prompt, /身弱必补原日主|身弱取印比/);

  const section = buildEnhancedPatternUsefulGodSection(chart);
  assert.equal(section.pattern.transformation?.status, '成化');
  assert.equal(section.pattern.transformation?.element, '木');
  assert.equal(section.pattern.formationAnalysis, '');
  assert.equal(section.usefulGods.transformation?.element, '木');
  assert.match(section.usefulGods.reasoning, /化神取用：/);
  assert.equal(
    section.ditiansuiAdvice?.summary ?? '',
    `十干静态体象：${getBaziDitiansuiAdvice('癸')?.nature}${getBaziDitiansuiAdvice('癸')?.modernAdvice}`,
  );
  assert.doesNotMatch(section.ditiansuiAdvice?.summary ?? '', /格局资料作旁参|行运判断/);

  const guide = buildBeginnerGuide(chart);
  assert.match(guide.strengthPlain, /化神木为取用主体/);
  assert.match(guide.favorableHabitsPlain.join('\n'), /生活与工作取向结合化神及其条件核验/);
});

test('化气依据进入合盘证据、命盘分享详情与起名出生资料', () => {
  const chart = makeTransformedChart();
  const compatibility = analyzeBaziCompatibility(chart, chart);
  assert.match(compatibility.usefulGodCoverage[0]?.promptText ?? '', /化气判定：成化/);
  assert.match(compatibility.usefulGodCoverage[0]?.promptText ?? '', /取用主体：化神木/);

  const prompt = buildBaziCompatibilityPrompt({ result1: chart, result2: chart });
  assert.equal(prompt.match(/格局: 丁壬化木格[^\n]*化气判定：成化/g)?.length, 2);
  assert.equal(prompt.match(/化气判定：成化/g)?.length, 2);
  assert.match(prompt, /化神取用：以化神木为取用主体/);
  assert.doesNotMatch(prompt.split('【双盘关系资料】')[1] ?? '', /取用主体：化神木|化气判定：成化/);
  assert.doesNotMatch(prompt, /【第一人格局条件】|【第二人格局条件】/);

  const decisionDetails = formatBaziDecisionDetails(chart).join('\n');
  assert.match(decisionDetails, /化气判定：成化；化神木/);
  assert.match(decisionDetails, /取用基线：化神木顺势/);

  const context = calculateNamingBirthContext(INPUT);
  context.pattern.transformation = TRANSFORMATION;
  const analysis = analyzeChineseName({ fullName: '李明' });
  analysis.birthContext = context;
  const namingPrompt = buildChineseNameAnalysisPrompt({ analysis });
  assert.match(namingPrompt, /化气判定：成化；化神木/);
  assert.match(namingPrompt, /化神取用主体：化神木/);
  assert.match(namingPrompt, /原日主癸旺衰与十神作为本命事实/);
});
