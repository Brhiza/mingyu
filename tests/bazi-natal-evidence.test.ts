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
  assert.equal(analysis.kinshipFacts.length, 9);
  assert.equal(analysis.counterEvidenceFacts.length, 4);
  assert.equal(analysis.limitationFacts.length, 7);
  assert.equal(analysis.summaryFact.pillarFactCount, analysis.pillarFacts.length);
  assert.equal(analysis.summaryFact.analysisFactCount, analysis.analysisFacts.length);
  assert.equal(analysis.summaryFact.kinshipFactCount, analysis.kinshipFacts.length);
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
  assert.match(analysis.promptText, /不得根据现实身份、富贵经历、传闻或格局名反推出生时辰/);
  assert.match(analysis.promptText, /不得为凑格补造时柱/);
  assert.match(analysis.promptText, /月令已有正格用神时，调候、外格或日时名目不得覆盖月令取用/);
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
    timeIndex: 2,
    gender: 'male',
  });

  assert.deepEqual(
    Object.values(result.pillars).map((pillar) => pillar.ganZhi),
    ['庚申', '庚辰', '戊申', '甲寅'],
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

test('真实透而又会排盘必须把透干和会支共同贯穿格局证据与最终提示词', () => {
  const result = baziCalculator.calculateBazi({
    year: 1980,
    month: 1,
    day: 9,
    timeIndex: 9,
    gender: 'male',
  });

  assert.deepEqual(
    Object.values(result.pillars).map((pillar) => pillar.ganZhi),
    ['己未', '丁丑', '辛巳', '丁酉'],
  );
  assert.deepEqual(result.hiddenStems.month, ['己', '癸', '辛']);
  assert.equal(result.analysis.mingGe.pattern, '待综合判断');
  assert.match(result.analysis.mingGe.basis || '', /己（偏印）透出/);
  assert.match(result.analysis.mingGe.basis || '', /月支丑参与地支巳酉丑完整三合金结构（金比劫）/);
  assert.match(result.analysis.mingGe.basis || '', /透而又会，则透与会并用/);

  const patternFact = result.evidenceAnalysis?.analysisFacts.find((item) => item.type === '格局');
  assert.equal(patternFact?.status, '资料缺口');
  assert.equal(patternFact?.result, '待综合判断');
  assert.match(patternFact?.promptText || '', /己（偏印）透出/);
  assert.match(patternFact?.promptText || '', /巳酉丑完整三合金结构（金比劫）/);

  const prompt = formatBaziForPrompt(result);
  assert.match(prompt, /格局: 待综合判断/);
  assert.match(prompt, /透而又会，则透与会并用/);
  assert.doesNotMatch(prompt, /格局: 杂气偏印格/);
});

test('真实无透干会支排盘应按会支取用贯穿格局证据与最终提示词', () => {
  const result = baziCalculator.calculateBazi({
    year: 1982,
    month: 2,
    day: 11,
    timeIndex: 6,
    gender: 'male',
  });

  assert.deepEqual(
    Object.values(result.pillars).map((pillar) => pillar.ganZhi),
    ['壬戌', '壬寅', '乙丑', '壬午'],
  );
  assert.deepEqual(result.hiddenStems.month, ['甲', '丙', '戊']);
  assert.equal(result.monthCommander, '戊');
  assert.equal(result.analysis.mingGe.pattern, '食伤格');
  assert.match(result.analysis.mingGe.basis || '', /月令藏干均未透出/);
  assert.match(result.analysis.mingGe.basis || '', /月支寅参与地支寅午戌完整三合火结构（火食伤）/);
  assert.match(result.analysis.mingGe.basis || '', /何谓会支/);

  const patternFact = result.evidenceAnalysis?.analysisFacts.find((item) => item.type === '格局');
  assert.equal(patternFact?.status, '已记录');
  assert.equal(patternFact?.result, '食伤格');
  assert.match(patternFact?.promptText || '', /寅午戌完整三合火结构（火食伤）/);

  const prompt = formatBaziForPrompt(result);
  assert.match(prompt, /格局: 食伤格/);
  assert.match(prompt, /何谓会支/);
  assert.doesNotMatch(prompt, /格局: 劫财格/);
});

test('真实建禄会财排盘应把会支及财官伤明透贯穿证据与最终提示词', () => {
  const result = baziCalculator.calculateBazi({
    year: 1981,
    month: 5,
    day: 8,
    timeIndex: 1,
    gender: 'male',
  });

  assert.deepEqual(
    Object.values(result.pillars).map((pillar) => pillar.ganZhi),
    ['辛酉', '癸巳', '丙戌', '己丑'],
  );
  assert.equal(result.monthCommander, '戊');
  assert.equal(result.analysis.mingGe.pattern, '建禄格');
  assert.match(result.analysis.mingGe.basis || '', /月令底格仍按建禄格/);
  assert.match(result.analysis.mingGe.basis || '', /巳酉丑完整三合金结构（金财星）/);
  assert.match(
    result.analysis.mingGe.basis || '',
    /年干辛（正财）、月干癸（正官）、时干己（伤官）明透/,
  );
  assert.match(result.analysis.mingGe.basis || '', /透干会支，另取用神/);

  const patternFact = result.evidenceAnalysis?.analysisFacts.find((item) => item.type === '格局');
  assert.equal(patternFact?.status, '已记录');
  assert.equal(patternFact?.result, '建禄格');
  assert.match(patternFact?.promptText || '', /巳酉丑完整三合金结构（金财星）/);
  assert.match(patternFact?.promptText || '', /透干会支，另取用神/);

  const prompt = formatBaziForPrompt(result);
  assert.match(prompt, /格局: 建禄格/);
  assert.match(prompt, /巳酉丑完整三合金结构（金财星）/);
  assert.match(prompt, /年干辛（正财）、月干癸（正官）、时干己（伤官）明透/);
});

test('真实月刃会印排盘应把杀财伤配合贯穿证据与最终提示词', () => {
  const result = baziCalculator.calculateBazi({
    year: 1981,
    month: 6,
    day: 29,
    timeIndex: 10,
    gender: 'male',
  });

  assert.deepEqual(
    Object.values(result.pillars).map((pillar) => pillar.ganZhi),
    ['辛酉', '甲午', '戊寅', '壬戌'],
  );
  assert.equal(result.monthCommander, '丁');
  assert.equal(result.analysis.mingGe.pattern, '月刃格');
  assert.match(result.analysis.mingGe.basis || '', /月令底格仍按月刃格/);
  assert.match(result.analysis.mingGe.basis || '', /寅午戌完整三合火结构（火印星）/);
  assert.match(
    result.analysis.mingGe.basis || '',
    /年干辛（伤官）、月干甲（七杀）、时干壬（偏财）明透/,
  );
  assert.match(result.analysis.mingGe.basis || '', /阳刃喜官杀制伏/);

  const patternFact = result.evidenceAnalysis?.analysisFacts.find((item) => item.type === '格局');
  assert.equal(patternFact?.status, '已记录');
  assert.equal(patternFact?.result, '月刃格');
  assert.match(patternFact?.promptText || '', /寅午戌完整三合火结构（火印星）/);
  assert.match(patternFact?.promptText || '', /阳刃喜官杀制伏/);

  const prompt = formatBaziForPrompt(result);
  assert.match(prompt, /格局: 月刃格/);
  assert.match(prompt, /寅午戌完整三合火结构（火印星）/);
  assert.match(prompt, /年干辛（伤官）、月干甲（七杀）、时干壬（偏财）明透/);
});

test('真实官印有情排盘应把原典同型关系贯穿证据与最终提示词', () => {
  const result = baziCalculator.calculateBazi({
    year: 1983,
    month: 4,
    day: 8,
    timeIndex: 7,
    gender: 'male',
  });

  assert.deepEqual(
    Object.values(result.pillars).map((pillar) => pillar.ganZhi),
    ['癸亥', '丙辰', '丙寅', '乙未'],
  );
  assert.equal(result.analysis.mingGe.pattern, '待综合判断');
  assert.match(result.analysis.mingGe.basis || '', /癸官与乙印同透/);
  assert.match(result.analysis.mingGe.basis || '', /官印相生且乙制辰中戊土/);
  assert.match(result.analysis.mingGe.basis || '', /合而有情/);

  const patternFact = result.evidenceAnalysis?.analysisFacts.find((item) => item.type === '格局');
  assert.equal(patternFact?.status, '资料缺口');
  assert.match(patternFact?.promptText || '', /官印相生且乙制辰中戊土/);
  const prompt = formatBaziForPrompt(result);
  assert.match(prompt, /格局: 待综合判断/);
  assert.match(prompt, /官印相生且乙制辰中戊土/);
});

test('真实官伤无情排盘应把原典同型关系贯穿证据与最终提示词', () => {
  const result = baziCalculator.calculateBazi({
    year: 1983,
    month: 7,
    day: 13,
    timeIndex: 3,
    gender: 'male',
  });

  assert.deepEqual(
    Object.values(result.pillars).map((pillar) => pillar.ganZhi),
    ['癸亥', '己未', '壬寅', '癸卯'],
  );
  assert.equal(result.analysis.mingGe.pattern, '待综合判断');
  assert.match(result.analysis.mingGe.basis || '', /己官透出而亥卯未会木伤官/);
  assert.match(result.analysis.mingGe.basis || '', /官与伤官相背/);
  assert.match(result.analysis.mingGe.basis || '', /合而无情/);

  const patternFact = result.evidenceAnalysis?.analysisFacts.find((item) => item.type === '格局');
  assert.equal(patternFact?.status, '资料缺口');
  assert.match(patternFact?.promptText || '', /官与伤官相背/);
  const prompt = formatBaziForPrompt(result);
  assert.match(prompt, /格局: 待综合判断/);
  assert.match(prompt, /官与伤官相背/);
});

test('真实食神制杀排盘应把无情终有情关系贯穿证据与最终提示词', () => {
  const result = baziCalculator.calculateBazi({
    year: 1981,
    month: 4,
    day: 7,
    timeIndex: 12,
    gender: 'male',
  });

  assert.deepEqual(
    Object.values(result.pillars).map((pillar) => pillar.ganZhi),
    ['辛酉', '壬辰', '丙辰', '戊子'],
  );
  assert.equal(result.analysis.mingGe.pattern, '杂气食神格');
  assert.match(result.analysis.mingGe.basis || '', /戊食与壬杀同透/);
  assert.match(result.analysis.mingGe.basis || '', /食神制杀各得其用/);
  assert.match(result.analysis.mingGe.basis || '', /无情而终为有情/);

  const patternFact = result.evidenceAnalysis?.analysisFacts.find((item) => item.type === '格局');
  assert.equal(patternFact?.status, '已记录');
  assert.match(patternFact?.promptText || '', /食神制杀各得其用/);
  const prompt = formatBaziForPrompt(result);
  assert.match(prompt, /格局: 杂气食神格/);
  assert.match(prompt, /食神制杀各得其用/);
});

test('真实甲辰财未透仅逢戌冲时不得借开库名义强定财格', () => {
  const result = baziCalculator.calculateBazi({
    year: 1980,
    month: 4,
    day: 11,
    timeIndex: 10,
    gender: 'male',
  });

  assert.deepEqual(
    Object.values(result.pillars).map((pillar) => pillar.ganZhi),
    ['庚申', '庚辰', '甲寅', '甲戌'],
  );
  assert.equal(result.analysis.mingGe.pattern, '待综合判断');
  assert.match(result.analysis.mingGe.basis || '', /四墓不忌刑冲，刑冲未必成格/);
  assert.match(result.analysis.mingGe.basis || '', /戊财未透/);
  assert.match(result.analysis.mingGe.basis || '', /仅见辰戌冲仍不能据此取为清财格/);

  const patternFact = result.evidenceAnalysis?.analysisFacts.find((item) => item.type === '格局');
  assert.equal(patternFact?.status, '资料缺口');
  assert.match(patternFact?.promptText || '', /不据此宣称开库、出库或自动成格/);
  const prompt = formatBaziForPrompt(result);
  assert.match(prompt, /格局: 待综合判断/);
  assert.match(prompt, /仅见辰戌冲仍不能据此取为清财格/);
  assert.doesNotMatch(prompt, /格局: (?:杂气)?偏财格/);
});

test('真实丁辰官透遇戌冲时应把伤官受冲关系贯穿证据与最终提示词', () => {
  const result = baziCalculator.calculateBazi({
    year: 1981,
    month: 4,
    day: 9,
    timeIndex: 10,
    gender: 'male',
  });

  assert.deepEqual(
    Object.values(result.pillars).map((pillar) => pillar.ganZhi),
    ['辛酉', '壬辰', '丁巳', '庚戌'],
  );
  assert.equal(result.analysis.mingGe.pattern, '待综合判断');
  assert.match(result.analysis.mingGe.basis || '', /丁日辰月壬官透出又遇戌冲/);
  assert.match(result.analysis.mingGe.basis || '', /戌中戊土伤官随冲而动，对壬官有害/);

  const patternFact = result.evidenceAnalysis?.analysisFacts.find((item) => item.type === '格局');
  assert.equal(patternFact?.status, '资料缺口');
  assert.match(patternFact?.promptText || '', /戌中戊土伤官随冲而动，对壬官有害/);
  const prompt = formatBaziForPrompt(result);
  assert.match(prompt, /格局: 待综合判断/);
  assert.match(prompt, /戌中戊土伤官随冲而动，对壬官有害/);
});

test('真实癸辰官透遇戌冲时应保留官格且不得仅据四墓冲判破格', () => {
  const result = baziCalculator.calculateBazi({
    year: 1982,
    month: 4,
    day: 10,
    timeIndex: 6,
    gender: 'male',
  });

  assert.deepEqual(
    Object.values(result.pillars).map((pillar) => pillar.ganZhi),
    ['壬戌', '甲辰', '癸亥', '戊午'],
  );
  assert.equal(result.analysis.mingGe.pattern, '杂气正官格');
  assert.match(result.analysis.mingGe.basis || '', /辰戌冲只作四墓冲动/);
  assert.match(result.analysis.mingGe.basis || '', /不据此单独判定破格/);

  const patternFact = result.evidenceAnalysis?.analysisFacts.find((item) => item.type === '格局');
  assert.equal(patternFact?.status, '已记录');
  assert.equal(patternFact?.result, '杂气正官格');
  assert.match(patternFact?.promptText || '', /不改变既有格名/);
  const prompt = formatBaziForPrompt(result);
  assert.match(prompt, /格局: 杂气正官格/);
  assert.match(prompt, /不据此单独判定破格/);
});

test('真实正官见食伤排盘应保留官格并贯穿四吉神带忌边界', () => {
  const result = baziCalculator.calculateBazi({
    year: 1980,
    month: 1,
    day: 3,
    timeIndex: 12,
    gender: 'male',
  });

  assert.deepEqual(
    Object.values(result.pillars).map((pillar) => pillar.ganZhi),
    ['己未', '丙子', '丙子', '戊子'],
  );
  assert.equal(result.analysis.mingGe.pattern, '正官格');
  assert.match(result.analysis.mingGe.basis || '', /正官为当前月令所用，又见食神、伤官明透/);
  assert.match(result.analysis.mingGe.basis || '', /须继续核对财印、合伤等救应/);
  assert.match(result.analysis.mingGe.basis || '', /年支未与月令子相害/);
  assert.match(result.analysis.mingGe.basis || '', /单项关系不直接等同于破格/);
  assert.match(result.analysis.mingGe.basis || '', /不改变既有格名/);

  const patternFact = result.evidenceAnalysis?.analysisFacts.find((item) => item.type === '格局');
  assert.equal(patternFact?.result, '正官格');
  assert.match(patternFact?.promptText || '', /四吉神能破格边界/);
  assert.match(patternFact?.promptText || '', /正官格成败边界/);
  assert.match(patternFact?.promptText || '', /年支未与月令子相害/);
  const prompt = formatBaziForPrompt(result);
  assert.match(prompt, /格局: 正官格/);
  assert.match(prompt, /官忌食伤/);
  assert.match(prompt, /年支未与月令子相害/);
});

test('真实食神带杀透财排盘应保留食神格并贯穿财能破格边界', () => {
  const result = baziCalculator.calculateBazi({
    year: 1980,
    month: 2,
    day: 13,
    timeIndex: 4,
    gender: 'male',
  });

  assert.deepEqual(
    Object.values(result.pillars).map((pillar) => pillar.ganZhi),
    ['庚申', '戊寅', '丙辰', '壬辰'],
  );
  assert.equal(result.analysis.mingGe.pattern, '杂气食神格');
  assert.match(result.analysis.mingGe.basis || '', /七杀与偏财同见明透/);
  assert.match(result.analysis.mingGe.basis || '', /财能生杀而妨碍食神制杀/);
  assert.match(result.analysis.mingGe.basis || '', /不改变既有格名/);

  const patternFact = result.evidenceAnalysis?.analysisFacts.find((item) => item.type === '格局');
  assert.equal(patternFact?.result, '杂气食神格');
  assert.match(patternFact?.promptText || '', /财能破格/);
  const prompt = formatBaziForPrompt(result);
  assert.match(prompt, /格局: 杂气食神格/);
  assert.match(prompt, /财能破格/);
});

test('真实财生官露食排盘应保留财格并贯穿食能破格边界', () => {
  const result = baziCalculator.calculateBazi({
    year: 1980,
    month: 1,
    day: 13,
    timeIndex: 4,
    gender: 'male',
  });

  assert.deepEqual(
    Object.values(result.pillars).map((pillar) => pillar.ganZhi),
    ['己未', '丁丑', '乙酉', '庚辰'],
  );
  assert.equal(result.analysis.mingGe.pattern, '杂气偏财格');
  assert.match(result.analysis.mingGe.basis || '', /正官与食神同见明透/);
  assert.match(result.analysis.mingGe.basis || '', /财能生官而又露食使结构混杂/);
  assert.match(result.analysis.mingGe.basis || '', /不改变既有格名/);

  const patternFact = result.evidenceAnalysis?.analysisFacts.find((item) => item.type === '格局');
  assert.equal(patternFact?.result, '杂气偏财格');
  assert.match(patternFact?.promptText || '', /食能破格/);
  const prompt = formatBaziForPrompt(result);
  assert.match(prompt, /格局: 杂气偏财格/);
  assert.match(prompt, /食能破格/);
});

test('真实财逢比劫透伤官排盘应保留财格并贯穿化劫生财救应', () => {
  const result = baziCalculator.calculateBazi({
    year: 1984,
    month: 4,
    day: 10,
    timeIndex: 3,
    gender: 'male',
  });

  assert.deepEqual(
    Object.values(result.pillars).map((pillar) => pillar.ganZhi),
    ['甲子', '戊辰', '甲戌', '丁卯'],
  );
  assert.equal(result.analysis.mingGe.pattern, '杂气偏财格');
  assert.match(result.analysis.mingGe.basis || '', /财畏比劫/);
  assert.match(result.analysis.mingGe.basis || '', /比肩与伤官同见明透/);
  assert.match(result.analysis.mingGe.basis || '', /伤官可化劫生财/);
  assert.match(result.analysis.mingGe.basis || '', /不改变既有格名/);

  const patternFact = result.evidenceAnalysis?.analysisFacts.find((item) => item.type === '格局');
  assert.equal(patternFact?.result, '杂气偏财格');
  assert.match(patternFact?.promptText || '', /四凶神能成格边界/);
  assert.match(patternFact?.promptText || '', /伤官可化劫生财/);
  const prompt = formatBaziForPrompt(result);
  assert.match(prompt, /格局: 杂气偏财格/);
  assert.match(prompt, /伤官可化劫生财/);
});

test('真实食神带杀无财透枭排盘应保留食神格并贯穿弃食就杀救应', () => {
  const result = baziCalculator.calculateBazi({
    year: 1984,
    month: 4,
    day: 12,
    timeIndex: 4,
    gender: 'male',
  });

  assert.deepEqual(
    Object.values(result.pillars).map((pillar) => pillar.ganZhi),
    ['甲子', '戊辰', '丙子', '壬辰'],
  );
  assert.equal(result.analysis.mingGe.pattern, '杂气食神格');
  assert.match(result.analysis.mingGe.basis || '', /食畏印夺/);
  assert.match(result.analysis.mingGe.basis || '', /年、月、时干及四支藏干均无正偏财/);
  assert.match(result.analysis.mingGe.basis || '', /食带煞而无财，弃食就煞而透印/);
  assert.match(result.analysis.mingGe.basis || '', /枭可作为局部救应/);

  const patternFact = result.evidenceAnalysis?.analysisFacts.find((item) => item.type === '格局');
  assert.equal(patternFact?.result, '杂气食神格');
  assert.match(patternFact?.promptText || '', /四凶神能成格边界/);
  assert.match(patternFact?.promptText || '', /弃食就煞而透印/);
  const prompt = formatBaziForPrompt(result);
  assert.match(prompt, /格局: 杂气食神格/);
  assert.match(prompt, /弃食就煞而透印/);
});

test('真实财逢七杀见阳刃排盘应保留财格并贯穿刃可解厄救应', () => {
  const result = baziCalculator.calculateBazi({
    year: 1984,
    month: 1,
    day: 5,
    timeIndex: 6,
    gender: 'male',
  });

  assert.deepEqual(
    Object.values(result.pillars).map((pillar) => pillar.ganZhi),
    ['癸亥', '甲子', '戊戌', '戊午'],
  );
  assert.equal(result.analysis.mingGe.pattern, '正财格');
  assert.match(result.analysis.mingGe.basis || '', /七杀明透及日主阳刃支午/);
  assert.match(result.analysis.mingGe.basis || '', /财逢七煞，刃可解厄/);
  assert.match(result.analysis.mingGe.basis || '', /财格成败边界/);
  assert.match(result.analysis.mingGe.basis || '', /“透一位以清用”的数量候选/);
  assert.match(result.analysis.mingGe.basis || '', /“弃财就杀”的条件候选/);
  assert.match(result.analysis.mingGe.basis || '', /另一候选并存复核/);
  assert.match(result.analysis.mingGe.basis || '', /不改变既有格名/);

  const patternFact = result.evidenceAnalysis?.analysisFacts.find((item) => item.type === '格局');
  assert.equal(patternFact?.result, '正财格');
  assert.match(patternFact?.promptText || '', /四凶神能成格边界/);
  assert.match(patternFact?.promptText || '', /刃可解厄/);
  assert.match(patternFact?.promptText || '', /财格成败边界/);
  assert.match(patternFact?.promptText || '', /“弃财就杀”的条件候选/);
  const prompt = formatBaziForPrompt(result);
  assert.match(prompt, /格局: 正财格/);
  assert.match(prompt, /刃可解厄/);
  assert.match(prompt, /财格成败边界/);
  assert.match(prompt, /“弃财就杀”的条件候选/);
  assert.doesNotMatch(prompt, /判定为(?:富贵|贫贱)|格局评分|成功率/);
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
