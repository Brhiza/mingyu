import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  analyzeXiaoliurenEvidence,
  conditionXiaoliurenTraditionalText,
  generateXiaoliuren,
  getXiaoliurenElementRelation,
  validateXiaoliurenReferenceData,
} from '../packages/core/src/divination/algorithms/xiaoliuren.ts';
import { assertPromptIsPortableTaskText } from './prompt-assertions';

const SAMPLE_DATE = new Date('2025-01-01T08:00:00+08:00');

test('小六壬：五行关系表应完整覆盖 25 种组合', () => {
  const elements = ['木', '火', '土', '金', '水'];
  const relations = elements.flatMap((source) =>
    elements.map((target) => getXiaoliurenElementRelation(source, target)),
  );

  assert.equal(relations.length, 25);
  assert.deepEqual(new Set(relations), new Set(['比和', '被克', '得生', '所生', '所克']));
  assert.doesNotThrow(() => validateXiaoliurenReferenceData());
  assert.throws(() => getXiaoliurenElementRelation('木', ''), /五行无效/);
});

test('小六壬：六个结果宫都应使用专属应期画像', () => {
  const results = Array.from({ length: 6 }, (_, index) =>
    generateXiaoliuren({ method: 'number', number: index + 1, customDate: SAMPLE_DATE }),
  );

  assert.equal(new Set(results.map((result) => result.sequence.result.name)).size, 6);
  assert.ok(results.every((result) => result.timingEvidence?.triggerConditions[0]));
  assert.doesNotMatch(
    results.map((result) => result.timingEvidence?.triggerConditions.join('；')).join('\n'),
    /通用|特殊生克态势/,
  );
});

test('小六壬：空亡宫五行应为土，类型与算法数据保持一致', () => {
  const data = generateXiaoliuren({ method: 'number', number: 5, customDate: SAMPLE_DATE });

  assert.equal(data.sequence.process.name, '空亡');
  assert.equal(data.sequence.process.element, '土');
});

test('小六壬：留连宫应按四季土口径，不应误作木', () => {
  const data = generateXiaoliuren({ method: 'number', number: 2, customDate: SAMPLE_DATE });

  assert.equal(data.sequence.start.name, '留连');
  assert.equal(data.sequence.start.element, '土');
  assert.equal(data.sequence.start.shenSha, '螣蛇');
  assert.equal(data.sequence.start.direction, '四角');
  assert.match(data.sequence.start.seasonProsper || '', /辰戌丑未月/);
});

test('小六壬：五行说明应按真实生克方向描述，不应反写得生与所生', () => {
  const data = generateXiaoliuren({ method: 'number', number: 4, customDate: SAMPLE_DATE });

  assert.equal(data.sequence.start.name, '赤口');
  assert.equal(data.sequence.start.element, '金');
  assert.equal(data.sequence.process.name, '小吉');
  assert.equal(data.sequence.process.element, '水');
  assert.equal(data.wuxingRelations.startToProcess, '所生');
  assert.match(data.wuxingRelations.description, /起因生过程/);
  assert.doesNotMatch(data.wuxingRelations.description, /起因被过程泄气/);
});

test('小六壬：有效时间应输出明确时辰标签，不应出现未知时辰', () => {
  const data = generateXiaoliuren({ method: 'time', customDate: SAMPLE_DATE });

  assert.equal(data.hourIndex, 4);
  assert.equal(data.hourLabel, '辰时');
  assert.notEqual(data.hourLabel, '未知时辰');
});

test('小六壬：起课基数、逐宫顺数和六宫归一结果应进入结构化证据', () => {
  const data = generateXiaoliuren({ method: 'number', number: 5, customDate: SAMPLE_DATE });
  const calculation = data.calculation;
  const evidence = data.evidenceAnalysis;

  assert.ok(calculation);
  assert.ok(evidence);
  assert.equal(calculation.inputBase, 5);
  assert.equal(calculation.inputBaseSource, '用户数字');
  assert.equal(calculation.startPalaceIndex, data.sequence.start.index);
  assert.equal(calculation.processPalaceIndex, data.sequence.process.index);
  assert.equal(calculation.resultPalaceIndex, data.sequence.result.index);
  assert.equal(evidence?.calculationFact.status, '完整');
  assert.equal(evidence?.calculationFact.inputBase, 5);
  assert.equal(evidence?.calculationFact.inputBaseSource, '用户数字');
  assert.equal(evidence?.calculationFact.steps.length, 3);
  assert.deepEqual(
    evidence?.calculationFact.steps.map((item) => item.stage),
    ['起因', '过程', '结果'],
  );
  assert.ok(
    evidence?.calculationFact.steps.every(
      (item) =>
        item.modulo === 6 && item.promptText && item.palaceIndex >= 0 && item.palaceIndex < 6,
    ),
  );
  assert.match(evidence?.calculationFact.limitation || '', /不证明宫义预测有效性/);
  assert.ok(evidence?.calculationFacts.some((item) => item.includes('起课基数取用户数字5')));
  assert.ok(evidence?.calculationFacts.some((item) => item.includes('减1后按6取余')));
  assert.ok(evidence?.evidence.items.some((item) => item.title === '起课输入与逐宫顺数'));
  assert.ok(
    evidence?.stages.every(
      (item) =>
        item.key.startsWith('xiaoliuren:stage:') &&
        item.status === '已计算' &&
        item.promptText &&
        item.sources.length > 0 &&
        item.limitation.includes('不得直接解释为现实起因'),
    ),
  );
  assert.equal(evidence?.transitionFacts.length, 2);
  assert.ok(
    evidence?.transitionFacts.every(
      (item) =>
        item.key.startsWith('xiaoliuren:transition:') &&
        evidence.stages.some((stage) => stage.key === item.fromStageKey) &&
        evidence.stages.some((stage) => stage.key === item.toStageKey) &&
        item.promptText &&
        item.sources.length > 0 &&
        item.limitation.includes('现实事件必然顺利'),
    ),
  );
  assert.equal(evidence.key, 'xiaoliuren:evidence');
  assert.equal(evidence.status, '已计算');
  assert.equal(evidence.calculationSteps.length, 6);
  const calculationStepKeys = new Set(evidence.calculationSteps.map((item) => item.key));
  assert.ok(
    evidence.calculationSteps.every((item) =>
      item.dependsOnStepKeys.every((key) => calculationStepKeys.has(key)),
    ),
  );
  assert.equal(evidence.summaryFact.status, '证据链完整');
  assert.equal(evidence.summaryFact.stageFactCount, evidence.stages.length);
  assert.equal(evidence.summaryFact.transitionFactCount, evidence.transitionFacts.length);
  assert.equal(evidence.summaryFact.traditionalFactCount, evidence.traditionalFacts.length);
  assert.equal(evidence.summaryFact.counterEvidenceCount, evidence.counterEvidenceFacts.length);
  assert.equal(evidence.summaryFact.timingBasisFactCount, evidence.timingBasisFacts.length);
  assert.equal(
    evidence.summaryFact.triggerConditionFactCount,
    evidence.triggerConditionFacts.length,
  );
  assert.equal(evidence.limitationFacts.length, 6);
  assert.deepEqual(
    evidence.limitations,
    evidence.limitationFacts.map((item) => item.promptText),
  );
  const factKeys = new Set([
    evidence.calculationFact.key,
    evidence.randomFact.key,
    ...evidence.calculationSteps.map((item) => item.key),
    ...evidence.stages.map((item) => item.key),
    ...evidence.transitionFacts.map((item) => item.key),
    ...evidence.traditionalFacts.map((item) => item.key),
    evidence.counterSummaryFact.key,
    ...evidence.counterEvidenceFacts.map((item) => item.key),
    evidence.timingSummaryFact.key,
    ...evidence.timingBasisFacts.map((item) => item.key),
    ...evidence.triggerConditionFacts.map((item) => item.key),
    evidence.summaryFact.key,
  ]);
  assert.ok(
    evidence.limitationFacts.every(
      (item) =>
        item.ownerFactKeys.length > 0 && item.ownerFactKeys.every((key) => factKeys.has(key)),
    ),
  );
  assert.match(evidence.promptText, /计算链：[\s\S]*证据汇总：[\s\S]*解释限制：/);
  assert.doesNotMatch(
    JSON.stringify(evidence?.evidence),
    /"score"\s*:|成功率[：=]?\s*\d|吉凶总分[：=]?\s*\d/,
  );
});

test('小六壬：过程生结果时应输出越做越顺，不应写成过程被结果泄气', () => {
  const data = generateXiaoliuren({ method: 'number', number: 5, customDate: SAMPLE_DATE });

  assert.equal(data.sequence.process.name, '空亡');
  assert.equal(data.sequence.process.element, '土');
  assert.equal(data.sequence.result.name, '赤口');
  assert.equal(data.sequence.result.element, '金');
  assert.equal(data.wuxingRelations.processToResult, '所生');
  assert.match(data.wuxingRelations.description, /过程生结果/);
  assert.doesNotMatch(data.wuxingRelations.description, /过程被结果泄气/);
});

test('小六壬：未知起课方式应明确报错，不应返回无标签结果', () => {
  assert.throws(
    () => generateXiaoliuren({ method: 'unknown' as never, customDate: SAMPLE_DATE }),
    /未知的小六壬起课方式/,
  );
});

test('小六壬：数字起课应拒绝超出安全整数范围的数字', () => {
  assert.throws(
    () =>
      generateXiaoliuren({
        method: 'number',
        number: Number.MAX_SAFE_INTEGER + 1,
        customDate: SAMPLE_DATE,
      }),
    /安全范围内的正整数/,
  );
});

test('小六壬：应期只给盘内节奏、触发条件和限制，不机械换算日期', () => {
  const result = generateXiaoliuren({
    method: 'time',
    customDate: new Date('2025-01-01T08:00:00+08:00'),
  });

  assert.ok(result.timingEvidence);
  assert.ok(result.timingEvidence.primaryBasis.length >= 3);
  assert.deepEqual(result.evidenceAnalysis?.timingBasis, result.timingEvidence.primaryBasis);
  assert.equal(
    result.evidenceAnalysis?.timingSummaryFact.basisFactKeys.length,
    result.evidenceAnalysis?.timingBasisFacts.length,
  );
  assert.equal(
    result.evidenceAnalysis?.timingSummaryFact.triggerFactKeys.length,
    result.evidenceAnalysis?.triggerConditionFacts.length,
  );
  assert.ok(
    result.evidenceAnalysis?.timingBasisFacts.every(
      (item) =>
        item.key.startsWith('xiaoliuren:timing-basis:') &&
        item.ownerFactKeys.length > 0 &&
        item.promptText &&
        item.sources.length > 0 &&
        item.limitation.includes('不得把宫名'),
    ),
  );
  assert.ok(
    result.evidenceAnalysis?.triggerConditionFacts.every(
      (item) =>
        item.key.startsWith('xiaoliuren:trigger:') &&
        item.ownerFactKeys.length > 0 &&
        item.promptText &&
        item.sources.length > 0 &&
        item.limitation.includes('不得由宫数'),
    ),
  );
  assert.equal(
    result.evidenceAnalysis?.counterSummaryFact.factKeys.length,
    result.evidenceAnalysis?.counterEvidenceFacts.length,
  );
  assert.match(result.evidenceAnalysis?.promptText ?? '', /盘内节奏依据/);
  assert.match(result.evidenceAnalysis?.promptText ?? '', /传统辅证.*方位.*神煞/);
  assert.ok(result.timingEvidence.triggerConditions.length > 0);
  assert.ok(result.timingEvidence.limitations.some((item) => item.includes('不换算固定日数')));
  assert.doesNotMatch(
    [result.yingQi, result.timing, result.sequence.start.timing].filter(Boolean).join('\n'),
    /\d+\s*[-—至]\s*\d+\s*(?:日|周|月)|\d+日内|\d+周内/,
  );
});

test('小六壬：仅随机起课应把重放轨迹接入统一证据', () => {
  const randomResult = generateXiaoliuren({
    method: 'random',
    seed: '小六壬证据样例',
    customDate: SAMPLE_DATE,
  });
  const timeResult = generateXiaoliuren({ method: 'time', customDate: SAMPLE_DATE });
  const randomItem = randomResult.evidenceAnalysis?.evidence.items.find(
    (item) => item.title === '随机起课重放记录',
  );

  assert.equal(randomItem?.level, '辅证');
  assert.doesNotMatch(randomItem?.detail || '', /小六壬证据样例/);
  assert.match(randomItem?.detail || '', /随机种子保留在结构化结果中/);
  assert.match(randomItem?.detail || '', /不表示可信度或预测有效性/);
  assert.ok(
    randomResult.evidenceAnalysis?.randomFacts.some((item) =>
      item.includes('随机种子：小六壬证据样例'),
    ),
  );
  assert.equal(randomResult.evidenceAnalysis?.randomFact.status, '可重放');
  assert.equal(randomResult.evidenceAnalysis?.randomFact.seed, '小六壬证据样例');
  assert.equal(randomResult.evidenceAnalysis?.randomFact.sampleCount, 1);
  assert.doesNotMatch(randomResult.evidenceAnalysis?.randomFact.promptText || '', /小六壬证据样例/);
  assert.equal(timeResult.evidenceAnalysis?.randomFact.status, '不适用');
  assert.deepEqual(timeResult.evidenceAnalysis?.randomFacts, []);
  assert.ok(
    !timeResult.evidenceAnalysis?.evidence.items.some((item) => item.tags?.includes('随机起课')),
  );
});

test('小六壬：六宫传统资料应保留原文并生成条件化事实', () => {
  const results = Array.from({ length: 6 }, (_, index) =>
    generateXiaoliuren({ method: 'number', number: index + 1, customDate: SAMPLE_DATE }),
  );
  const facts = results.flatMap((result) => result.evidenceAnalysis?.traditionalFacts ?? []);

  assert.deepEqual(
    new Set(facts.map((item) => item.palace)),
    new Set(['大安', '留连', '速喜', '赤口', '小吉', '空亡']),
  );
  assert.deepEqual(new Set(facts.map((item) => item.kind)), new Set(['宫位解释', '传统属性']));
  assert.ok(
    facts.every(
      (item) =>
        item.status === '已映射' &&
        item.originalText &&
        item.promptText &&
        item.sources.length > 0 &&
        item.limitation.includes('不证明现实中'),
    ),
  );
  assert.ok(facts.some((item) => /事情整体可成/.test(item.originalText)));
  assert.ok(facts.some((item) => /凶（大凶）/.test(item.originalText)));
  assert.ok(
    facts
      .filter((item) => item.kind === '宫位解释')
      .every((item) => item.promptText.startsWith('传统宫义提示')),
  );
  assert.doesNotMatch(
    facts.map((item) => item.promptText).join('\n'),
    /事情整体可成|容易白忙一场|当前容易落空或判断失真|凶（大凶）/,
  );
});

test('小六壬：传统宫义与吉凶属性不得直接当作现实结果或健康判断', () => {
  const promptText = [
    '事情整体可成，常有助力，但更适合渐进推进。',
    '当前信息虚、时机虚或目标虚，容易白忙一场。',
    '当前容易落空或判断失真，宜先核实再投入。',
    '凶（大凶）',
  ]
    .map(conditionXiaoliurenTraditionalText)
    .join('；');

  assert.match(promptText, /传统宫义提示具备推进线索/);
  assert.match(promptText, /传统宫义提示信息、时机或目标可能尚未落实，投入可能暂未形成有效结果/);
  assert.match(promptText, /传统宫义提示线索可能尚未落实或判断依据不足/);
  assert.match(promptText, /传统高风险分类/);
  assert.doesNotMatch(promptText, /事情整体可成|白忙一场|判断失真|大凶/);
});

test('小六壬：旧数据缺少证据分析时应重新生成安全传统事实', () => {
  const data = generateXiaoliuren({ method: 'number', number: 5, customDate: SAMPLE_DATE });
  data.calculation = undefined;
  data.evidenceAnalysis = undefined;
  const evidence = analyzeXiaoliurenEvidence(data);

  assert.equal(evidence.calculationFact.status, '缺少中间参数');
  assert.equal(evidence.calculationFact.steps.length, 0);
  assert.equal(evidence.summaryFact.status, '起课资料缺失');
  assert.equal(evidence.calculationSteps.length, 6);
  assert.equal(evidence.calculationSteps[0]?.status, '资料不足');
  assert.equal(evidence.calculationSteps[1]?.status, '资料不足');
  assert.equal(evidence.calculationSteps[5]?.status, '资料不足');
  assert.match(evidence.calculationFact.promptText, /未附逐宫顺数中间参数/);
  assert.ok(evidence.traditionalFacts.length > 0);
  assert.doesNotMatch(evidence.promptText, /事情整体可成|白忙一场|凶（大凶）/);

  data.timingEvidence = undefined;
  const rebuiltWithoutTiming = analyzeXiaoliurenEvidence(data);
  assert.equal(rebuiltWithoutTiming.timingBasisFacts.length, 3);
  assert.ok(
    rebuiltWithoutTiming.timingBasisFacts.every((item) => item.sourceStatus === '由盘面补齐'),
  );
  assert.ok(rebuiltWithoutTiming.triggerConditionFacts.some((item) => item.type === '期限边界'));
});

test('小六壬三种起课入口都应生成完整可移植的对象化证据', () => {
  const results = [
    generateXiaoliuren({ method: 'time', customDate: SAMPLE_DATE }),
    generateXiaoliuren({ method: 'number', number: 18, customDate: SAMPLE_DATE }),
    generateXiaoliuren({ method: 'random', seed: '三种入口核验', customDate: SAMPLE_DATE }),
  ];

  for (const result of results) {
    const evidence = result.evidenceAnalysis;
    assert.ok(evidence);
    assert.equal(evidence.key, 'xiaoliuren:evidence');
    assert.equal(evidence.status, '已计算');
    assert.equal(evidence.calculationFact.status, '完整');
    assert.equal(evidence.calculationSteps.length, 6);
    const calculationStepKeys = new Set(evidence.calculationSteps.map((item) => item.key));
    assert.ok(
      evidence.calculationSteps.every((item) =>
        item.dependsOnStepKeys.every((key) => calculationStepKeys.has(key)),
      ),
    );
    assert.equal(evidence.stages.length, 3);
    assert.equal(evidence.transitionFacts.length, 2);
    assert.equal(evidence.timingSummaryFact.status, '已提供节奏与触发条件');
    assert.equal(evidence.counterSummaryFact.factKeys.length, evidence.counterEvidenceFacts.length);
    assert.equal(evidence.summaryFact.status, '证据链完整');
    assert.equal(evidence.summaryFact.stageFactCount, evidence.stages.length);
    assert.equal(evidence.summaryFact.transitionFactCount, evidence.transitionFacts.length);
    assert.equal(evidence.limitationFacts.length, 6);
    assert.equal(evidence.limitations.length, evidence.limitationFacts.length);
    assertPromptIsPortableTaskText(evidence.promptText);
  }
});
