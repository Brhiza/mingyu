import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatBaziForPrompt,
  formatUsefulGodFunctions,
} from '../packages/core/src/bazi/baziAnalysisFormatter.ts';
import { baziCalculator } from '../packages/core/src/bazi/baziCalculator.ts';
import { HIDDEN_STEMS } from '../packages/core/src/bazi/baziDefinitions.ts';
import { evaluatePatternFulfillment } from '../packages/core/src/bazi/baziPatternFulfillment.ts';
import { determineUsefulGod } from '../packages/core/src/bazi/baziUsefulGodStrategy.ts';
import type { PatternAnalysis, Pillars } from '../packages/core/src/bazi/baziTypes.ts';
import { getTenGod } from '../packages/core/src/bazi/baziUtils.ts';
import { buildEnhancedPatternUsefulGodSection } from '../packages/core/src/minglu/bazi-enhancer.ts';

const SPECIAL_INPUT = {
  year: 1903,
  month: 4,
  day: 6,
  timeIndex: 0,
  gender: 'male' as const,
  isLunar: false,
};

function asSpecialPattern(pillars: Pillars): PatternAnalysis {
  return {
    pattern: '专旺格',
    isSpecial: true,
    basis: '合成关系夹具只验证取用消费，不作为完整专旺成立结论',
    fulfillment: evaluatePatternFulfillment(pillars, pillars.day.gan, '正官格', getTenGod, {
      strengthStatus: '身强',
      monthCommander: HIDDEN_STEMS[pillars.month.zhi][0],
    }),
  };
}

test('完整专旺排盘保留印比为基础喜用，食伤只列有明确传统条件的候选', () => {
  const chart = baziCalculator.calculateBazi(SPECIAL_INPUT);
  const useful = chart.analysis.usefulGod;

  assert.deepEqual(
    Object.values(chart.pillars).map((pillar) => pillar.ganZhi),
    ['癸卯', '乙卯', '甲子', '甲子'],
  );
  assert.equal(chart.analysis.dayMasterStrength.status, '极强');
  assert.equal(chart.analysis.mingGe.pattern, '专旺格');
  assert.deepEqual(useful.favorableWuxing, ['水', '木']);
  assert.deepEqual(useful.unfavorableWuxing, ['土', '金']);
  assert.deepEqual(useful.conditionalFavorableWuxing, ['火']);
  assert.equal(useful.favorableWuxing?.includes('火'), false);
  assert.equal(useful.unfavorableWuxing?.includes('火'), false);
  assert.equal(useful.primaryUseful, '印星');
  assert.deepEqual(useful.decisionEvidence?.base.favorable, ['水', '木']);
  assert.match(useful.matchedRules?.[0]?.description ?? '', /原局印轻且泄秀作用成立/);
  assert.match(useful.strategyTrace?.join('；') ?? '', /食伤条件:火仅在原局印轻/);
  assert.doesNotMatch(useful.strategyTrace?.join('；') ?? '', /资料不足|尚未实现/);
});

test('页面提示词与命录共用专旺食伤条件，不再把条件火写成已采用喜用', () => {
  const chart = baziCalculator.calculateBazi(SPECIAL_INPUT);
  const functions = formatUsefulGodFunctions(chart.analysis.usefulGod);
  const prompt = formatBaziForPrompt(chart);
  const minglu = buildEnhancedPatternUsefulGodSection(chart);
  const condition = '专旺食伤条件：火仅在原局印轻且食伤泄秀作用成立时纳入喜用';

  assert.deepEqual(functions, [condition]);
  assert.match(prompt, new RegExp(condition));
  assert.match(prompt, /取用: 主用水，辅木/);
  assert.doesNotMatch(prompt, /主用水，辅木、火/);
  assert.deepEqual(minglu.usefulGods.favorable, ['正印', '偏印', '比肩', '劫财']);
  assert.match(minglu.usefulGods.reasoning, new RegExp(condition));
  assert.doesNotMatch(minglu.usefulGods.reasoning, /资料不足|尚未实现/);
});

test('只有已满足且两端十神明确的印食作用链才限制具体食伤干', () => {
  const pillars: Pillars = {
    year: { gan: '癸', zhi: '亥', ganZhi: '癸亥' },
    month: { gan: '丁', zhi: '未', ganZhi: '丁未' },
    day: { gan: '甲', zhi: '寅', ganZhi: '甲寅' },
    hour: { gan: '戊', zhi: '辰', ganZhi: '戊辰' },
  };
  const result = determineUsefulGod('极强', asSpecialPattern(pillars), '木');
  const path = result.decisionEvidence?.controlFunctions?.find(
    (candidate) => candidate.key === '印制伤官',
  );
  const functions = formatUsefulGodFunctions(result).join('；');

  assert.equal(path?.status, '满足');
  assert.deepEqual(path?.sourceStems, ['癸']);
  assert.deepEqual(path?.targetStems, ['丁']);
  assert.deepEqual(result.conditionalUnfavorableStems, ['丁']);
  assert.equal(result.conditionalUnfavorableStems?.includes('丙'), false);
  assert.deepEqual(result.conditionalFavorableWuxing, ['火']);
  assert.equal(result.unfavorableWuxing.includes('火'), false);
  assert.match(functions, /干级所忌：丁/);
  assert.match(functions, /原局制化：印星制伤官护官；癸作用于丁/);
  assert.match(result.strategyTrace.join('；'), /只限制已证作用对象干，不扩大为火忌/);
});

test('印食共存但隔位仅记作用待核，不得自动列具体干为忌', () => {
  const pillars: Pillars = {
    year: { gan: '癸', zhi: '亥', ganZhi: '癸亥' },
    month: { gan: '戊', zhi: '辰', ganZhi: '戊辰' },
    day: { gan: '甲', zhi: '寅', ganZhi: '甲寅' },
    hour: { gan: '丁', zhi: '未', ganZhi: '丁未' },
  };
  const result = determineUsefulGod('极强', asSpecialPattern(pillars), '木');
  const path = result.decisionEvidence?.controlFunctions?.find(
    (candidate) => candidate.key === '印制伤官',
  );

  assert.equal(path?.status, '资料不足');
  assert.equal(path?.position, '隔位');
  assert.deepEqual(result.conditionalUnfavorableStems, []);
  assert.deepEqual(result.conditionalFavorableWuxing, ['火']);
  assert.doesNotMatch(result.strategyTrace.join('；'), /印食作用限制/);
  assert.doesNotMatch(formatUsefulGodFunctions(result).join('；'), /干级所忌/);
});
