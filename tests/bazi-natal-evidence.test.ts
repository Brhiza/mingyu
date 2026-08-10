import test from 'node:test';
import assert from 'node:assert/strict';

import { baziCalculator } from '../packages/core/src/bazi/baziCalculator.ts';
import { formatBaziForPrompt } from '../packages/core/src/bazi/baziAnalysisFormatter.ts';

test('八字本命应输出四柱、核心判断、反证、汇总与限制的统一证据链', () => {
  const result = baziCalculator.calculateBazi({
    year: 1990,
    month: 5,
    day: 15,
    timeIndex: 1,
    gender: 'male',
  });
  const analysis = result.evidenceAnalysis;

  assert.ok(analysis);
  assert.equal(analysis.key, 'bazi:natal:evidence');
  assert.equal(analysis.status, '已计算');
  assert.equal(analysis.calculationSteps.length, 5);
  assert.equal(analysis.calculationChain.length, analysis.calculationSteps.length);
  assert.equal(analysis.pillarFacts.length, 4);
  assert.equal(analysis.analysisFacts.length, 3);
  assert.equal(analysis.counterEvidenceFacts.length, 4);
  assert.equal(analysis.limitationFacts.length, 6);
  assert.equal(analysis.summaryFact.pillarFactCount, analysis.pillarFacts.length);
  assert.equal(analysis.summaryFact.analysisFactCount, analysis.analysisFacts.length);
  assert.equal(analysis.summaryFact.relationFactCount, analysis.relationFacts.length);
  assert.equal(analysis.summaryFact.warningFactCount, result.warningFacts.length);
  assert.equal(analysis.summaryFact.missingFactCount, 0);
  assert.equal(analysis.summaryFact.status, '证据链完整');

  const calculationKeys = new Set(analysis.calculationSteps.map((item) => item.key));
  assert.ok(
    analysis.calculationSteps.every((item) =>
      item.dependsOnStepKeys.every((key) => calculationKeys.has(key)),
    ),
  );
  assert.ok(
    [...analysis.pillarFacts, ...analysis.analysisFacts, ...analysis.relationFacts].every((item) =>
      item.calculationStepKeys.every((key) => calculationKeys.has(key)),
    ),
  );

  const factKeys = new Set([analysis.summaryFact.key, ...analysis.summaryFact.factKeys]);
  assert.ok(
    [...analysis.counterEvidenceFacts, ...analysis.limitationFacts].every(
      (item) =>
        item.ownerFactKeys.length > 0 && item.ownerFactKeys.every((key) => factKeys.has(key)),
    ),
  );
  assert.ok(analysis.counterSummaryFact.factKeys.every((key) => factKeys.has(key)));
  assert.ok(
    analysis.pillarFacts.every(
      (item) =>
        item.status === '已记录' &&
        item.key.startsWith('bazi:natal:pillar:') &&
        item.promptText.includes(item.ganZhi),
    ),
  );
  assert.ok(
    analysis.analysisFacts.every(
      (item) => item.status === '已记录' && item.promptText && item.sources.length > 0,
    ),
  );
  assert.match(
    analysis.promptText,
    /【八字本命四柱与核心判断结构化证据】[\s\S]*计算链：[\s\S]*事实覆盖：[\s\S]*反证汇总：[\s\S]*证据汇总：[\s\S]*解释限制：/,
  );
  assert.doesNotMatch(
    analysis.promptText,
    /命语|本项目|当前项目|项目统一|工程|接口|API|MCP|内部权重|bazi:natal:/,
  );
  assert.match(analysis.promptText, /只采用明确时辰或真太阳时校正后的唯一时刻/);
  assert.equal(analysis.evidence.title, '八字本命四柱与核心判断结构化证据');
});

test('八字本命提示词应保留用户选择的传统时辰且不混入工程证据话术', () => {
  const result = baziCalculator.calculateBazi({
    year: 1992,
    month: 8,
    day: 21,
    timeIndex: 4,
    gender: 'female',
  });
  const prompt = formatBaziForPrompt(result);

  assert.match(prompt, /基本信息: 坤造 \| 1992年8月21日 辰时/);
  assert.doesNotMatch(prompt, /结构化证据|证据汇总|计算链|解释限制/);
  assert.doesNotMatch(prompt, /出生时间敏感性|候选时柱|缺少时柱/);
});

test('八字真太阳时本命证据应引用校正后的唯一时间并采用唯一校正时刻', () => {
  const result = baziCalculator.calculateBazi({
    year: 1990,
    month: 4,
    day: 15,
    timeIndex: 0,
    gender: 'male',
    useTrueSolarTime: true,
    birthHour: 1,
    birthMinute: 20,
    birthLongitude: 73.5,
    birthPlace: '新疆喀什',
  });
  const analysis = result.evidenceAnalysis;

  assert.ok(analysis);
  assert.ok(result.timing?.evidence);
  assert.equal(result.timing.evidence.summaryFact.status, '证据链完整');
  assert.equal(
    result.timing.evidence.calculationChain.length,
    result.timing.evidence.calculationSteps.length,
  );
  assert.match(analysis.calculationSteps[0].promptText, /经真太阳时校正后采用/);
  assert.equal(analysis.calculationSteps[0].inputs.trueSolarTimeEnabled, true);
  assert.match(analysis.promptText, /当前命盘只采用明确时辰或真太阳时校正后的唯一时刻/);
  assert.doesNotMatch(analysis.promptText, /候选盘\d|候选时辰为/);
  const prompt = formatBaziForPrompt(result);
  assert.match(prompt, /真太阳时: 1990年4月14日 22:13 \| 出生地:新疆喀什 \| 经度:73\.5/);
  assert.match(prompt, /基本信息: 乾造 \| 1990年4月14日 亥时/);
  assert.doesNotMatch(prompt, /结构化证据|证据汇总|候选盘|出生时间敏感性/);
});

test('丁火生巳月案例的劫财格应贯穿取用、证据与最终提示词，不得回退为正财格', () => {
  const result = baziCalculator.calculateBazi({
    year: 2002,
    month: 5,
    day: 19,
    timeIndex: 0,
    gender: 'female',
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: true,
    birthHour: 6,
    birthMinute: 23,
    birthPlace: '上海',
    birthLongitude: 121.4737,
  });

  assert.deepEqual(
    Object.values(result.pillars).map((pillar) => pillar.ganZhi),
    ['壬午', '乙巳', '丁亥', '癸卯'],
  );
  assert.equal(result.monthCommander, '庚');
  assert.equal(result.analysis.mingGe.pattern, '劫财格');
  assert.match(result.analysis.mingGe.basis || '', /月令本气为丙/);
  assert.ok(
    result.analysis.usefulGod.strategyTrace?.some((item) => item.includes('普通格局:劫财格')),
  );
  assert.ok(result.evidenceAnalysis);

  const patternFact = result.evidenceAnalysis.analysisFacts.find((item) => item.type === '格局');
  assert.equal(patternFact?.result, '劫财格');
  assert.match(patternFact?.promptText || '', /格局：劫财格/);

  const prompt = formatBaziForPrompt(result);
  assert.match(prompt, /格局: 劫财格/);
  assert.doesNotMatch(prompt, /取用脉络:/);
  assert.doesNotMatch(JSON.stringify(result), /正财格/);
  assert.doesNotMatch(prompt, /正财格/);
});
