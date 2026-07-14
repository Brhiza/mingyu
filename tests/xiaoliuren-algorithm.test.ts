import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  analyzeXiaoliurenEvidence,
  conditionXiaoliurenTraditionalText,
  generateXiaoliuren,
} from '../packages/core/src/divination/algorithms/xiaoliuren.ts';

const SAMPLE_DATE = new Date('2025-01-01T08:00:00+08:00');

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
  assert.equal(calculation.inputBase, 5);
  assert.equal(calculation.inputBaseSource, '用户数字');
  assert.equal(calculation.startPalaceIndex, data.sequence.start.index);
  assert.equal(calculation.processPalaceIndex, data.sequence.process.index);
  assert.equal(calculation.resultPalaceIndex, data.sequence.result.index);
  assert.ok(evidence?.calculationFacts.some((item) => item.includes('起课基数取用户数字5')));
  assert.ok(evidence?.calculationFacts.some((item) => item.includes('减1后按6取余')));
  assert.ok(evidence?.evidence.items.some((item) => item.title === '起课输入与逐宫顺数'));
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
  data.evidenceAnalysis = undefined;
  const evidence = analyzeXiaoliurenEvidence(data);

  assert.ok(evidence.traditionalFacts.length > 0);
  assert.doesNotMatch(evidence.promptText, /事情整体可成|白忙一场|凶（大凶）/);
});
