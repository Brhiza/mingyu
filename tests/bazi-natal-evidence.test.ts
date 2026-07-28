import test from 'node:test';
import assert from 'node:assert/strict';

import { baziCalculator } from '../packages/core/src/bazi/baziCalculator.ts';
import { formatBaziForPrompt } from '../packages/core/src/bazi/baziAnalysisFormatter.ts';

test('八字本命旺衰未闭合时应在统一证据链中保留资料缺口', () => {
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
  assert.equal(analysis.status, '存在资料缺口');
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
  assert.equal(analysis.summaryFact.missingFactCount, 1);
  assert.equal(analysis.summaryFact.status, '证据链有缺口');

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
  assert.equal(analysis.analysisFacts.find((item) => item.type === '日主旺衰')?.status, '资料缺口');
  assert.ok(analysis.analysisFacts.every((item) => item.promptText && item.sources.length > 0));
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

test('月令藏干兼透时格局应作为资料缺口贯穿证据与最终提示词', () => {
  const result = baziCalculator.calculateBazi({
    year: 1980,
    month: 1,
    day: 6,
    timeIndex: 9,
    gender: 'male',
  });

  assert.deepEqual(
    Object.values(result.pillars).map((pillar) => pillar.ganZhi),
    ['己未', '丁丑', '戊寅', '辛酉'],
  );
  assert.equal(result.monthCommander, '癸');
  assert.equal(result.analysis.mingGe.pattern, '待综合判断');
  assert.match(result.analysis.mingGe.basis || '', /己（劫财）、辛（伤官）同时透出/);
  assert.match(result.analysis.mingGe.basis || '', /兼透则兼用/);
  assert.ok(result.evidenceAnalysis);

  const patternFact = result.evidenceAnalysis.analysisFacts.find((item) => item.type === '格局');
  assert.equal(patternFact?.status, '资料缺口');
  assert.equal(patternFact?.result, '待综合判断');

  const prompt = formatBaziForPrompt(result);
  assert.match(prompt, /格局: 待综合判断/);
  assert.doesNotMatch(prompt, /格局: (?:杂气)?伤官格/);
});

test('月令单透比肩时不得被未透司令覆盖，格局应贯穿证据与最终提示词', () => {
  const result = baziCalculator.calculateBazi({
    year: 1980,
    month: 1,
    day: 7,
    timeIndex: 0,
    gender: 'male',
  });

  assert.deepEqual(
    Object.values(result.pillars).map((pillar) => pillar.ganZhi),
    ['己未', '丁丑', '己卯', '甲子'],
  );
  assert.equal(result.monthCommander, '癸');
  assert.equal(result.analysis.mingGe.pattern, '杂气比肩格');
  assert.match(result.analysis.mingGe.basis || '', /己为月令藏干，单独透于年干/);
  assert.match(result.analysis.mingGe.basis || '', /癸司权另作月令得时事实，不覆盖已透藏干/);
  assert.ok(result.evidenceAnalysis);

  const patternFact = result.evidenceAnalysis.analysisFacts.find((item) => item.type === '格局');
  assert.equal(patternFact?.status, '已记录');
  assert.equal(patternFact?.result, '杂气比肩格');

  const prompt = formatBaziForPrompt(result);
  assert.match(prompt, /格局: 杂气比肩格/);
  assert.doesNotMatch(prompt, /格局: 偏财格/);
});

test('月令多项藏干全不透时格局应保留待定并贯穿证据与最终提示词', () => {
  const result = baziCalculator.calculateBazi({
    year: 1980,
    month: 4,
    day: 5,
    timeIndex: 0,
    gender: 'male',
  });

  assert.deepEqual(
    Object.values(result.pillars).map((pillar) => pillar.ganZhi),
    ['庚申', '庚辰', '戊申', '壬子'],
  );
  assert.equal(result.monthCommander, '乙');
  assert.equal(result.analysis.mingGe.pattern, '待综合判断');
  assert.match(result.analysis.mingGe.basis || '', /戊（比肩）、乙（正官）、癸（正财）均未透出/);
  assert.match(result.analysis.mingGe.basis || '', /乙司权只作得时事实/);
  assert.ok(result.evidenceAnalysis);

  const patternFact = result.evidenceAnalysis.analysisFacts.find((item) => item.type === '格局');
  assert.equal(patternFact?.status, '资料缺口');
  assert.equal(patternFact?.result, '待综合判断');

  const prompt = formatBaziForPrompt(result);
  assert.match(prompt, /格局: 待综合判断/);
  assert.doesNotMatch(prompt, /格局: 正官格/);
});

test('真实交节排盘中外部过渡气即使透干也不得改写格局、证据与最终提示词', () => {
  const result = baziCalculator.calculateBazi({
    year: 1980,
    month: 3,
    day: 15,
    timeIndex: 4,
    gender: 'male',
  });

  assert.deepEqual(
    Object.values(result.pillars).map((pillar) => pillar.ganZhi),
    ['庚申', '己卯', '丁亥', '甲辰'],
  );
  assert.deepEqual(result.hiddenStems.month, ['乙']);
  assert.equal(result.monthCommander, '甲');
  assert.equal(result.analysis.mingGe.pattern, '偏印格');
  assert.match(result.analysis.mingGe.basis || '', /月令只有乙一项藏干/);
  assert.match(result.analysis.mingGe.basis || '', /甲为交节过渡气且已透干/);
  assert.match(result.analysis.mingGe.basis || '', /不替换本月唯一藏干/);

  const patternFact = result.evidenceAnalysis?.analysisFacts.find((item) => item.type === '格局');
  assert.equal(patternFact?.result, '偏印格');
  assert.match(patternFact?.promptText || '', /格局：偏印格/);
  assert.doesNotMatch(patternFact?.promptText || '', /格局：正印格/);

  const prompt = formatBaziForPrompt(result);
  assert.match(prompt, /格局: 偏印格/);
  assert.doesNotMatch(prompt, /格局: 正印格/);
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
  assert.match(prompt, /取用脉络: 普通格局:劫财格/);
  assert.doesNotMatch(JSON.stringify(result), /正财格/);
  assert.doesNotMatch(prompt, /正财格/);
});
