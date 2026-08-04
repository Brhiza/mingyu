import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeMeihuaEvidence,
  conditionMeihuaTraditionalText,
  generateMeihua,
} from 'mingyu-core/divination/meihua';
import { hexagramsData } from '../packages/core/src/divination/hexagram-data.ts';

const fixedDate = new Date('2025-01-01T08:00:00+08:00');

test('梅花排盘应内置主互变三阶段结构化证据', () => {
  const data = generateMeihua(fixedDate, { method: 'number', number: 123 });
  const evidence = data.evidenceAnalysis;

  assert.ok(evidence);
  assert.equal(evidence.key, 'meihua:evidence');
  assert.equal(evidence.status, '已计算');
  assert.equal(evidence.calculationSteps.length, 7);
  assert.deepEqual(
    evidence.calculationChain,
    evidence.calculationSteps.map((item) => item.promptText),
  );
  assert.ok(
    evidence.calculationSteps.every((step) =>
      step.dependsOnStepKeys.every((key) =>
        evidence.calculationSteps.some((candidate) => candidate.key === key),
      ),
    ),
  );
  assert.deepEqual(
    evidence.stages.map((item) => item.stage),
    ['origin', 'process', 'result'],
  );
  assert.equal(evidence.stageCoverageFact.status, '完整');
  assert.deepEqual(evidence.stageCoverageFact.actualStages, ['origin', 'process', 'result']);
  assert.equal(evidence.hexagramStructureFacts.length, 3);
  assert.equal(evidence.yaoCoverageFact.status, '完整');
  assert.equal(evidence.yaoStructureFacts.length, 6);
  assert.deepEqual(evidence.yaoCoverageFact.changingPositions, [data.movingYao.position]);
  assert.ok(
    evidence.stages.every(
      (item) =>
        item.key.startsWith('meihua:stage:') &&
        item.status === '已计算' &&
        item.hexagramFactKey?.startsWith('meihua:hexagram:') &&
        item.promptText &&
        item.sources.length > 0 &&
        item.limitation.includes('不得直接解释为现实起因'),
    ),
  );
  assert.equal(evidence.summaryFact.status, '证据链完整');
  assert.equal(evidence.summaryFact.hexagramFactCount, evidence.hexagramStructureFacts.length);
  assert.equal(evidence.summaryFact.yaoFactCount, evidence.yaoStructureFacts.length);
  assert.equal(evidence.summaryFact.stageFactCount, evidence.stages.length);
  assert.equal(evidence.summaryFact.transitionFactCount, evidence.transitionFacts.length);
  assert.equal(evidence.summaryFact.traditionalFactCount, evidence.traditionalFacts.length);
  assert.equal(evidence.summaryFact.counterEvidenceCount, evidence.counterEvidenceFacts.length);
  assert.equal(evidence.summaryFact.timingFactCount, evidence.timingFacts.length);
  assert.equal(evidence.limitationFacts.length, 6);
  assert.deepEqual(
    evidence.limitations,
    evidence.limitationFacts.map((item) => item.promptText),
  );
  const factKeys = new Set([evidence.summaryFact.key, ...evidence.summaryFact.factKeys]);
  assert.ok(
    evidence.limitationFacts.every((item) => item.ownerFactKeys.every((key) => factKeys.has(key))),
  );
  assert.match(evidence.promptText, /【梅花体用阶段推进结构化证据】/);
  assert.match(evidence.promptText, /计算链：/);
  assert.match(evidence.promptText, /证据汇总：/);
  assert.match(evidence.promptText, /解释限制：/);
  assert.match(evidence.promptText, /起因.*→.*过程.*；.*过程.*→.*结果/);
  assert.doesNotMatch(evidence.promptText, /权重[：=]?\d|总分[：=]?\d|成功率[：=]?\d/);
});

test('梅花体互用互应沿用原体所在方位，不得上下颠倒', () => {
  const lowerMoving = generateMeihua(fixedDate, { method: 'number', number: 123 });
  const lowerProcess = analyzeMeihuaEvidence(lowerMoving).stages.find(
    (item) => item.stage === 'process',
  );

  assert.equal(lowerMoving.movingYao.position <= 3, true);
  assert.equal(lowerMoving.interTiGua?.name, lowerMoving.interHexagram?.upper);
  assert.equal(lowerMoving.interYongGua?.name, lowerMoving.interHexagram?.lower);
  assert.equal(lowerProcess?.ti.name, lowerMoving.interHexagram?.upper);
  assert.equal(lowerProcess?.yong.name, lowerMoving.interHexagram?.lower);
  assert.equal(lowerProcess?.relation, '用克体');
  assert.equal(lowerMoving.analysis.inter1Relation, '体互克原体');
  assert.equal(lowerMoving.analysis.inter2Relation, '原体生用互');
  assert.match(lowerProcess?.basis ?? '', /原体在上.*上互为体互、下互为用互/);

  const upperMoving = generateMeihua(fixedDate, { method: 'number', number: 5 });
  const upperProcess = analyzeMeihuaEvidence(upperMoving).stages.find(
    (item) => item.stage === 'process',
  );

  assert.equal(upperMoving.movingYao.position >= 4, true);
  assert.equal(upperMoving.interTiGua?.name, upperMoving.interHexagram?.lower);
  assert.equal(upperMoving.interYongGua?.name, upperMoving.interHexagram?.upper);
  assert.equal(upperProcess?.ti.name, upperMoving.interHexagram?.lower);
  assert.equal(upperProcess?.yong.name, upperMoving.interHexagram?.upper);
  assert.match(upperProcess?.basis ?? '', /原体在下.*下互为体互、上互为用互/);
});

test('梅花证据只给触发层位，不把动爻和卦数换算成绝对日期', () => {
  const data = generateMeihua(fixedDate, { method: 'number', number: 123 });
  const evidence = analyzeMeihuaEvidence(data);

  assert.match(evidence.promptText, /只用于先后、层次和触发条件/);
  assert.match(evidence.promptText, /不能据此换算绝对日期/);
  assert.doesNotMatch(evidence.promptText, /\d+日内|\d+月左右|成功率[：=]?\d/);
});

test('梅花起卦算式、六爻结构、卦象来源和已有应期条件应进入统一证据', () => {
  const data = generateMeihua(fixedDate, { method: 'number', number: 123 });
  const evidence = data.evidenceAnalysis;
  const items = evidence?.evidence.items ?? [];

  assert.ok(evidence);
  assert.ok(evidence.calculationFacts.some((item) => item.includes('数字取数：输入123')));
  assert.ok(evidence.calculationFacts.some((item) => /上卦=.*除8取余/.test(item)));
  assert.equal(evidence.hexagramFacts.length, 3);
  assert.ok(evidence.hexagramFacts.some((item) => item.includes(data.mainHexagram.name)));
  assert.equal(evidence.yaoFacts.length, 6);
  assert.equal(evidence.yaoFacts.filter((item) => item.includes('本爻发动')).length, 1);

  assert.ok(items.some((item) => item.title === '起卦方式与取数算式'));
  assert.ok(items.some((item) => item.title === '主互变卦象事实'));
  assert.ok(items.some((item) => item.title === '主互变阶段覆盖状态'));
  assert.ok(items.some((item) => item.title === '六爻资料覆盖状态'));
  assert.ok(items.some((item) => item.title === '六爻阴阳与体用归属'));
  assert.ok(items.some((item) => item.tags?.includes('动爻爻辞')));
  assert.equal(items.filter((item) => item.tags?.includes('阶段推进')).length, 2);
  assert.ok(items.some((item) => item.title === '体互对原体关系'));
  assert.ok(items.some((item) => item.title === '用互对原体关系'));
  assert.ok(items.some((item) => item.level === '应期' && item.title.includes('触发')));
  assert.equal(evidence.transitionFacts.length, 2);
  assert.ok(
    evidence.transitionFacts.every(
      (item) =>
        item.key.startsWith('meihua:transition:') &&
        item.status === '连续' &&
        evidence.stages.some((stage) => stage.key === item.fromStageKey) &&
        evidence.stages.some((stage) => stage.key === item.toStageKey) &&
        item.sources.length > 0 &&
        item.limitation.includes('现实事件必然按同样顺序'),
    ),
  );
  assert.equal(evidence.timingSummaryFact.factKeys.length, evidence.timingFacts.length);
  assert.ok(
    evidence.timingFacts.every(
      (item) =>
        item.key.startsWith('meihua:timing:') &&
        item.order > 0 &&
        item.ownerFactKeys.length > 0 &&
        item.promptText &&
        item.sources.length > 0 &&
        item.limitation.includes('不得把爻位'),
    ),
  );
  assert.equal(evidence.counterSummaryFact.factKeys.length, evidence.counterEvidenceFacts.length);
  assert.ok(
    evidence.counterEvidenceFacts.every(
      (item) =>
        item.key.startsWith('meihua:counter:') &&
        item.status === '已触发' &&
        evidence.stages.some((stage) => stage.key === item.ownerStageKey) &&
        item.promptText &&
        item.sources.length > 0 &&
        item.limitation.includes('不得把单项反证直接写成现实失败'),
    ),
  );
  assert.ok(
    (data.analysis.yingQi ?? []).every((condition) =>
      items.some((item) => item.level === '应期' && item.detail?.includes(condition)),
    ),
  );
  assert.ok(evidence.counterEvidence.length === 0 || items.some((item) => item.level === '反证'));
  assert.doesNotMatch(
    JSON.stringify(evidence.evidence),
    /"score"\s*:|成功率[：=]?\s*\d|吉凶总分[：=]?\s*\d/,
  );
});

test('梅花旧结果缺少逐爻或互卦阶段时应明确标记缺口且不得反推', () => {
  const data = generateMeihua(fixedDate, { method: 'number', number: 123 });
  const rebuilt = analyzeMeihuaEvidence({
    ...data,
    yaosDetail: data.yaosDetail.slice(0, 5),
    interHexagram: null,
    evidenceAnalysis: undefined,
  });

  assert.equal(rebuilt.yaoCoverageFact.status, '缺少爻位');
  assert.deepEqual(rebuilt.yaoCoverageFact.missingPositions, [6]);
  assert.equal(rebuilt.stageCoverageFact.status, '阶段缺失');
  assert.deepEqual(rebuilt.stageCoverageFact.missingStages, ['process']);
  assert.equal(rebuilt.transitionFacts.length, 1);
  assert.equal(rebuilt.transitionFacts[0].status, '跨阶段缺口');
  assert.equal(rebuilt.summaryFact.status, '部分资料缺失');
  assert.equal(
    rebuilt.calculationSteps.find((item) => item.stage === '阶段推进核验')?.status,
    '资料不足',
  );
  assert.match(rebuilt.transitionFacts[0].promptText, /不补造过程/);
  assert.match(rebuilt.promptText, /不得反推缺失阶段体用关系/);

  const incompleteResult = analyzeMeihuaEvidence({
    ...data,
    changedHexagram: null,
    evidenceAnalysis: undefined,
  });
  const resultStage = incompleteResult.stages.find((item) => item.stage === 'result');
  assert.equal(incompleteResult.stageCoverageFact.status, '阶段资料不完整');
  assert.deepEqual(incompleteResult.stageCoverageFact.incompleteStages, ['result']);
  assert.equal(resultStage?.status, '卦象资料缺失');
  assert.equal(resultStage?.hexagramFactKey, null);
  assert.match(resultStage?.promptText ?? '', /不得补造卦名、卦符或上下经卦/);

  const duplicateYao = analyzeMeihuaEvidence({
    ...data,
    yaosDetail: [...data.yaosDetail, { ...data.yaosDetail[0] }],
    evidenceAnalysis: undefined,
  });
  assert.equal(duplicateYao.yaoCoverageFact.status, '爻位异常');
  assert.deepEqual(duplicateYao.yaoCoverageFact.duplicatePositions, [1]);
  assert.equal(
    new Set(duplicateYao.yaoStructureFacts.map((item) => item.key)).size,
    duplicateYao.yaoStructureFacts.length,
  );
});

test('梅花四种起卦入口都应生成完整可移植的对象化证据', () => {
  const cases = [
    generateMeihua(fixedDate, { method: 'time' }),
    generateMeihua(fixedDate, { method: 'timeTrigram' }),
    generateMeihua(fixedDate, { method: 'number', number: 123 }),
    generateMeihua(fixedDate, { method: 'random', seed: '四种入口核验' }),
  ];

  for (const data of cases) {
    const evidence = data.evidenceAnalysis;
    assert.ok(evidence);
    assert.equal(evidence.calculationFact.status, '完整');
    assert.equal(evidence.stageCoverageFact.status, '完整');
    assert.equal(evidence.yaoCoverageFact.status, '完整');
    assert.equal(evidence.transitionFacts.length, 2);
    assert.equal(evidence.timingSummaryFact.status, '已提供触发条件');
    assert.equal(evidence.counterSummaryFact.factKeys.length, evidence.counterEvidenceFacts.length);
    assert.equal(evidence.summaryFact.status, '证据链完整');
    assert.equal(evidence.calculationSteps.length, 7);
    assert.equal(evidence.limitationFacts.length, 6);
  }
});

test('梅花六十四卦卦辞爻辞与乾坤用辞应完整生成条件化事实', () => {
  const facts = hexagramsData.flatMap((hexagram) => {
    const gua = conditionMeihuaTraditionalText(hexagram.description, {
      stage: '主卦',
      hexagram: hexagram.name,
      kind: '卦辞',
    });
    const yaos = (hexagram.yaoCi ?? []).map((text, index) => ({
      originalText: text,
      ...conditionMeihuaTraditionalText(text, {
        stage: '主卦',
        hexagram: hexagram.name,
        kind: '爻辞',
        yaoPosition: index + 1,
        isMoving: index === 0,
      }),
    }));
    const yong = hexagram.yongCi
      ? [
          {
            originalText: hexagram.yongCi,
            ...conditionMeihuaTraditionalText(hexagram.yongCi, {
              stage: '主卦',
              hexagram: hexagram.name,
              kind: '用辞',
            }),
          },
        ]
      : [];
    return [{ originalText: hexagram.description, ...gua }, ...yaos, ...yong];
  });

  assert.equal(hexagramsData.length, 64);
  assert.equal(
    hexagramsData.reduce((total, item) => total + (item.yaoCi?.length ?? 0), 0),
    384,
  );
  assert.equal(hexagramsData.filter((item) => item.yongCi).length, 2);
  assert.equal(facts.length, 450);
  assert.ok(
    facts.every(
      (item) =>
        item.originalText &&
        item.promptText &&
        item.traditionalSignals.length + item.topicTags.length > 0,
    ),
  );
  assert.ok(facts.some((item) => /妇三岁不孕/.test(item.originalText)));
  assert.ok(facts.some((item) => /焚如，死如/.test(item.originalText)));
  assert.ok(facts.some((item) => /至于八月有凶/.test(item.originalText)));
  assert.doesNotMatch(
    facts.map((item) => item.promptText).join('\n'),
    /妇三岁不孕|焚如，死如|至于八月有凶/,
  );
});

test('梅花排盘传统事实应只让当前动爻参与提示词', () => {
  const data = generateMeihua(fixedDate, { method: 'number', number: 123 });
  const facts = data.evidenceAnalysis?.traditionalFacts ?? [];
  const mainYaoFacts = facts.filter((item) => item.stage === '主卦' && item.kind === '爻辞');
  const activeFacts = mainYaoFacts.filter((item) => item.applicability === '当前动爻辅助');
  const inactiveFacts = mainYaoFacts.filter((item) => item.applicability === '未发动背景');

  assert.equal(mainYaoFacts.length, 6);
  assert.equal(activeFacts.length, 1);
  assert.equal(inactiveFacts.length, 5);
  assert.equal(activeFacts[0].yaoPosition, data.movingYao.position);
  assert.ok(
    facts.every(
      (item) =>
        item.status === '已映射' &&
        item.sources.length > 0 &&
        item.limitation.includes('不证明现实吉凶'),
    ),
  );
  assert.match(data.evidenceAnalysis?.promptText ?? '', /当前爻位已发动/);
  for (const fact of inactiveFacts) {
    assert.doesNotMatch(data.evidenceAnalysis?.promptText ?? '', new RegExp(fact.originalText));
  }
});

test('乾卦用九应保留原文但不在单动爻排盘中启用', () => {
  const qian = generateMeihua(new Date('2025-01-01T14:00:00+08:00'), {
    method: 'number',
    number: 1,
  });
  const qianYong = qian.evidenceAnalysis?.traditionalFacts.find(
    (item) => item.stage === '主卦' && item.kind === '用辞',
  );

  assert.equal(qian.mainHexagram.name, '乾为天');
  assert.equal(qian.mainHexagram.yongCi, '见群龙无首，吉');
  assert.equal(qianYong?.originalText, '见群龙无首，吉');
  assert.equal(qianYong?.applicability, '特殊用辞背景');
  assert.match(qianYong?.promptText ?? '', /不满足六爻皆变.*不作为本次判断依据/);
  assert.doesNotMatch(qian.evidenceAnalysis?.promptText ?? '', /见群龙无首，吉/);
});
