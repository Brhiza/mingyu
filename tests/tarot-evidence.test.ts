import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeTarotEvidence,
  drawTarotSpread,
  resolveInteractiveTarotCards,
  tarotSpreads,
} from 'mingyu-core/divination/tarot';
import type { TarotData, TarotSpreadType } from 'mingyu-core/types';

const spreadTypes = Object.keys(tarotSpreads) as TarotSpreadType[];

test('塔罗全部牌阵应输出覆盖、来源、牌序、主题与限制对象', () => {
  assert.equal(spreadTypes.length, 10);

  spreadTypes.forEach((spreadType) => {
    const data = drawTarotSpread(spreadType, { seed: `塔罗结构化证据-${spreadType}` });
    const evidence = data.evidenceAnalysis;

    assert.ok(evidence);
    assert.equal(evidence.key, 'tarot:evidence');
    assert.equal(evidence.status, '已计算');
    assert.equal(evidence.calculationSteps.length, 7);
    assert.equal(evidence.calculationChain.length, evidence.calculationSteps.length);
    const calculationStepKeys = new Set(evidence.calculationSteps.map((item) => item.key));
    assert.ok(
      evidence.calculationSteps.every(
        (item) =>
          item.dependsOnStepKeys.every((key) => calculationStepKeys.has(key)) &&
          item.sources.length > 0 &&
          item.limitation.includes('不证明预测有效性'),
      ),
    );
    assert.equal(evidence.spreadCoverageFact.status, '完整');
    assert.equal(evidence.spreadCoverageFact.expectedCardCount, tarotSpreads[spreadType].cardCount);
    assert.equal(evidence.spreadCoverageFact.actualCardCount, data.cards.length);
    assert.deepEqual(evidence.spreadCoverageFact.positionOrderMismatches, []);
    assert.equal(evidence.drawFact.status, '可核验');
    assert.equal(evidence.drawFact.key, `draw:tarot:${spreadType}`);
    assert.deepEqual(evidence.drawFact.mismatchIndexes, []);
    assert.equal(evidence.drawOrderFacts.length, data.cards.length);
    assert.ok(evidence.drawOrderFacts.every((fact) => fact.status === '一致'));
    assert.equal(evidence.sequenceFacts.length, Math.max(0, data.cards.length - 1));
    assert.equal(evidence.sequence.length, evidence.sequenceFacts.length);
    assert.equal(evidence.elementInteractionFacts.length, Math.max(0, data.cards.length - 1));
    assert.equal(evidence.elementInteractions.length, evidence.elementInteractionFacts.length);
    assert.equal(evidence.recurringThemes.length, evidence.recurringThemeFacts.length);
    assert.equal(evidence.limitations.length, evidence.limitationFacts.length);
    assert.equal(evidence.limitationFacts.length, 6);
    assert.equal(evidence.summaryFact.status, '证据链完整');
    assert.equal(evidence.summaryFact.cardFactCount, evidence.cards.length);
    assert.equal(evidence.summaryFact.drawOrderFactCount, evidence.drawOrderFacts.length);
    assert.equal(evidence.summaryFact.sequenceFactCount, evidence.sequenceFacts.length);
    assert.equal(
      evidence.summaryFact.elementInteractionFactCount,
      evidence.elementInteractionFacts.length,
    );
    assert.equal(evidence.summaryFact.themeFactCount, evidence.themeFacts.length);
    assert.equal(evidence.summaryFact.recurringThemeFactCount, evidence.recurringThemeFacts.length);
    assert.equal(evidence.summaryFact.counterEvidenceCount, evidence.counterEvidenceFacts.length);
    assert.equal(evidence.summaryFact.traditionalFactCount, evidence.traditionalFacts.length);
    const factKeys = new Set([evidence.summaryFact.key, ...evidence.summaryFact.factKeys]);
    assert.ok(
      evidence.limitationFacts.every(
        (item) =>
          item.ownerFactKeys.length > 0 && item.ownerFactKeys.every((key) => factKeys.has(key)),
      ),
    );
    assert.match(evidence.drawFacts[2], /^第1张对应/);
    assert.ok(evidence.recurringThemes.every((item) => !item.includes('关联')));

    const cardKeys = new Set(evidence.cards.map((card) => card.key));
    const traditionalFactKeys = new Set(evidence.traditionalFacts.map((fact) => fact.key));
    const drawOrderKeys = evidence.drawOrderFacts.map((fact) => fact.key);
    assert.deepEqual(evidence.spreadCoverageFact.cardFactKeys, [...cardKeys]);
    assert.deepEqual(evidence.drawFact.orderFactKeys, drawOrderKeys);
    assert.ok(
      evidence.cards.every(
        (card) =>
          card.status === '已映射' &&
          traditionalFactKeys.has(card.traditionalFactKey) &&
          card.promptText &&
          card.sources.length >= 2 &&
          card.limitation.includes('不得由单牌'),
      ),
    );
    assert.ok(
      evidence.sequenceFacts.every(
        (fact) => cardKeys.has(fact.fromCardKey) && cardKeys.has(fact.toCardKey),
      ),
    );
    assert.ok(
      evidence.elementInteractionFacts.every(
        (fact) =>
          cardKeys.has(fact.fromCardKey) &&
          cardKeys.has(fact.toCardKey) &&
          fact.sources.length >= 3 &&
          fact.limitation.includes('不得据此生成吉凶分数'),
      ),
    );
    assert.ok(
      evidence.themeFacts.every(
        (fact) => fact.cardFactKeys.every((cardKey) => cardKeys.has(cardKey)) && fact.count > 0,
      ),
    );
    assert.ok(
      evidence.counterEvidenceFacts.every(
        (fact) => cardKeys.has(fact.ownerCardKey) && fact.status === '已触发',
      ),
    );
    assert.match(evidence.promptText, /计算链：[\s\S]*证据汇总：[\s\S]*解释限制：/);
  });
});

test('塔罗单牌不应伪造跨牌关系，多牌应逐对连接相邻牌位', () => {
  const single = drawTarotSpread('single', { seed: '塔罗单牌序列' }).evidenceAnalysis;
  const celtic = drawTarotSpread('celtic', { seed: '塔罗十牌序列' }).evidenceAnalysis;

  assert.ok(single);
  assert.ok(celtic);
  assert.deepEqual(single.sequenceFacts, []);
  assert.deepEqual(single.sequence, []);
  assert.deepEqual(single.elementInteractionFacts, []);
  assert.deepEqual(single.elementInteractions, []);
  assert.equal(celtic.sequenceFacts.length, 9);
  assert.deepEqual(
    celtic.sequenceFacts.map((fact) => fact.fromCardKey),
    celtic.cards.slice(0, -1).map((card) => card.key),
  );
  assert.deepEqual(
    celtic.sequenceFacts.map((fact) => fact.toCardKey),
    celtic.cards.slice(1).map((card) => card.key),
  );
  assert.ok(celtic.sequenceFacts.every((fact) => fact.limitation.includes('不得把牌阵顺序')));
});

test('塔罗相邻牌应计算四元素互参且大阿卡纳不强行归入元素', () => {
  const supportive = drawTarotSpread('three', {
    manualCards: [
      { id: 23, reversed: false },
      { id: 51, reversed: true },
      { id: 65, reversed: false },
    ],
  }).evidenceAnalysis!;
  assert.deepEqual(
    supportive.elementInteractionFacts.map((fact) => [
      fact.fromElement,
      fact.toElement,
      fact.relation,
    ]),
    [
      ['火', '风', '相互助长'],
      ['风', '土', '相互制约'],
    ],
  );
  assert.match(
    supportive.elementInteractionFacts[0].orientationConstraint,
    /逆位不改变元素关系分类/,
  );

  const conflictAndMajor = drawTarotSpread('three', {
    manualCards: [
      { id: 23, reversed: false },
      { id: 37, reversed: false },
      { id: 2, reversed: false },
    ],
  }).evidenceAnalysis!;
  assert.equal(conflictAndMajor.elementInteractionFacts[0].relation, '相互制约');
  assert.equal(conflictAndMajor.elementInteractionFacts[1].relation, '核心课题介入');
  assert.match(conflictAndMajor.elementInteractionFacts[1].promptText, /大阿卡纳不强行归入四元素/);
  assert.match(conflictAndMajor.promptText, /元素互参：/);

  const neutralAndSupportive = drawTarotSpread('three', {
    manualCards: [
      { id: 23, reversed: false },
      { id: 65, reversed: false },
      { id: 37, reversed: false },
    ],
  }).evidenceAnalysis!;
  assert.deepEqual(
    neutralAndSupportive.elementInteractionFacts.map((fact) => fact.relation),
    ['中性并置', '相互助长'],
  );

  const sameElement = drawTarotSpread('three', {
    manualCards: [
      { id: 23, reversed: false },
      { id: 24, reversed: false },
      { id: 25, reversed: false },
    ],
  }).evidenceAnalysis!;
  assert.ok(sameElement.elementInteractionFacts.every((fact) => fact.relation === '同类强化'));
  assert.doesNotMatch(
    JSON.stringify([
      supportive.elementInteractionFacts,
      conflictAndMajor.elementInteractionFacts,
      neutralAndSupportive.elementInteractionFacts,
      sameElement.elementInteractionFacts,
    ]),
    /成功率为\d|吉凶总分[：=]\d|能量分数[：=]\d/,
  );
});

test('塔罗手工录入应保留牌位与正逆位，并将随机轨迹标为不适用', () => {
  const data = drawTarotSpread('three', {
    manualCards: [
      { id: 1, reversed: false },
      { id: 22, reversed: true },
      { id: 78, reversed: false },
    ],
  });

  assert.deepEqual(
    data.cards.map((card) => [card.id, card.position, card.reversed]),
    [
      [1, '过去', false],
      [22, '现在', true],
      [78, '未来', false],
    ],
  );
  assert.equal(data.draw?.method, '用户按牌位手工录入');
  assert.equal(data.meta?.algorithm, 'tarot.spread.manual');
  assert.equal(data.meta?.random, undefined);
  assert.equal(data.evidenceAnalysis?.randomFact.status, '不适用');
  assert.equal(data.evidenceAnalysis?.summaryFact.status, '证据链完整');
  assert.ok(data.evidenceAnalysis?.evidence.items.some((item) => item.title === '手工录入来源'));

  assert.throws(
    () =>
      drawTarotSpread('three', {
        manualCards: [
          { id: 1, reversed: false },
          { id: 1, reversed: true },
          { id: 2, reversed: false },
        ],
      }),
    /不能重复录入/,
  );
  assert.throws(
    () =>
      drawTarotSpread('single', {
        seed: '冲突参数',
        manualCards: [{ id: 1, reversed: false }],
      }),
    /不能同时提供随机选项/,
  );
});

test('塔罗手动抽取应按样本逐张无重复翻牌并保留可重放轨迹', () => {
  const samples = [0, 0.75, 0.5, 0.25, 0.999, 0.75];
  const preview = resolveInteractiveTarotCards('three', samples);
  const data = drawTarotSpread('three', { interactiveSamples: samples });

  assert.deepEqual(
    data.cards.map((card) => ({ id: card.id, name: card.name, reversed: card.reversed })),
    preview,
  );
  assert.equal(new Set(data.cards.map((card) => card.id)).size, 3);
  assert.equal(data.draw?.method, '用户逐张触发前端随机抽取');
  assert.equal(data.meta?.algorithm, 'tarot.spread.interactive');
  assert.deepEqual(data.meta?.random, { mode: 'system', seed: undefined, samples });
  assert.equal(data.evidenceAnalysis?.randomFact.status, '可重放');

  assert.throws(
    () => drawTarotSpread('three', { interactiveSamples: samples.slice(0, -2) }),
    /需要逐张抽取3张牌/,
  );
  assert.throws(() => resolveInteractiveTarotCards('three', [0]), /需要两个随机样本/);
  assert.throws(
    () => drawTarotSpread('three', { seed: '冲突', interactiveSamples: samples }),
    /不能同时提供随机选项/,
  );
});

test('塔罗逆位应形成指向所属牌面的反证事实与汇总', () => {
  const data = drawTarotSpread('three', { seed: '塔罗逆位反证' });
  data.cards = data.cards.map((card, index) => ({ ...card, reversed: index === 1 }));
  data.draw = {
    ...data.draw!,
    order: data.draw!.order.map((item, index) => ({
      ...item,
      orientation: index === 1 ? '逆位' : '正位',
    })),
  };
  const evidence = analyzeTarotEvidence(data);

  assert.equal(evidence.counterEvidenceFacts.length, 1);
  assert.equal(evidence.counterSummaryFact.status, '有逆位约束');
  assert.deepEqual(evidence.counterSummaryFact.factKeys, [evidence.counterEvidenceFacts[0].key]);
  assert.equal(evidence.counterEvidenceFacts[0].ownerCardKey, evidence.cards[1].key);
  assert.equal(evidence.counterEvidenceFacts[0].position, evidence.cards[1].position);
  assert.match(evidence.counterEvidenceFacts[0].promptText, /逆位只表示/);
  assert.ok(
    evidence.counterEvidence[0].startsWith(
      `${evidence.cards[1].position}${evidence.cards[1].name}：`,
    ),
  );
  assert.equal(evidence.drawFact.status, '可核验');

  const allUpright = analyzeTarotEvidence({
    ...data,
    cards: data.cards.map((card) => ({ ...card, reversed: false })),
    draw: {
      ...data.draw!,
      order: data.draw!.order.map((item) => ({ ...item, orientation: '正位' })),
    },
    evidenceAnalysis: undefined,
  });
  assert.equal(allUpright.counterEvidenceFacts.length, 0);
  assert.equal(allUpright.counterSummaryFact.status, '未见逆位约束');
  assert.match(allUpright.counterSummaryFact.promptText, /不代表结果必然有利/);
});

test('塔罗旧资料缺少抽牌记录时不得反推来源链', () => {
  const data = drawTarotSpread('three', { seed: '塔罗缺少抽牌记录' });
  const evidence = analyzeTarotEvidence({
    ...data,
    draw: undefined,
    evidenceAnalysis: undefined,
  });

  assert.equal(evidence.drawFact.status, '来源链缺失');
  assert.equal(evidence.drawFact.recordedCardCount, 0);
  assert.deepEqual(evidence.drawFact.missingIndexes, [1, 2, 3]);
  assert.deepEqual(evidence.drawOrderFacts, []);
  assert.equal(evidence.summaryFact.status, '证据链有缺口');
  assert.equal(evidence.calculationSteps[1]?.status, '资料不足');
  assert.equal(evidence.calculationSteps[6]?.status, '资料不足');
  assert.match(evidence.drawFact.promptText, /现有资料未附.*不能反推完整抽牌来源链/);
  assert.doesNotMatch(evidence.promptText, /当前结果|当前数据|接口|API|MCP|工程/);
});

test('塔罗抽牌序号或牌面被篡改时应标记来源链不一致', () => {
  const data = drawTarotSpread('three', { seed: '塔罗来源一致性' });
  const tampered: TarotData = structuredClone(data);
  tampered.draw!.order[1].index = 1;
  tampered.draw!.order[1].cardName = `${tampered.draw!.order[1].cardName}（篡改）`;
  tampered.evidenceAnalysis = undefined;
  const evidence = analyzeTarotEvidence(tampered);

  assert.equal(evidence.drawFact.status, '来源链不一致');
  assert.deepEqual(evidence.drawFact.mismatchIndexes, [2]);
  assert.equal(evidence.drawOrderFacts[1].status, '不一致');
  assert.deepEqual(evidence.drawOrderFacts[1].mismatches, [
    '记录序号应为2',
    `牌名应为${data.cards[1].name}`,
  ]);
  assert.ok(
    evidence.evidence.items.some(
      (item) => item.level === '反证' && item.title === '抽牌来源链不一致',
    ),
  );
});

test('塔罗牌位、顺序和牌号异常时应给出可定位的覆盖事实', () => {
  const data = drawTarotSpread('three', { seed: '塔罗牌阵覆盖异常' });
  const tampered: TarotData = structuredClone(data);
  tampered.cards[1].position = tampered.cards[0].position;
  tampered.cards[1].id = tampered.cards[0].id;
  tampered.evidenceAnalysis = undefined;
  const evidence = analyzeTarotEvidence(tampered);

  assert.equal(evidence.spreadCoverageFact.status, '牌位异常');
  assert.equal(evidence.summaryFact.status, '证据链有缺口');
  assert.equal(evidence.calculationSteps[2]?.status, '资料不足');
  assert.equal(evidence.calculationSteps[6]?.status, '资料不足');
  assert.deepEqual(evidence.spreadCoverageFact.missingPositions, ['现在']);
  assert.deepEqual(evidence.spreadCoverageFact.duplicatePositions, ['过去']);
  assert.deepEqual(evidence.spreadCoverageFact.positionOrderMismatches, [2]);
  assert.deepEqual(evidence.spreadCoverageFact.duplicateCardIds, [tampered.cards[0].id]);

  const missingCard = analyzeTarotEvidence({
    ...data,
    cards: data.cards.slice(0, 2),
    evidenceAnalysis: undefined,
  });
  assert.equal(missingCard.spreadCoverageFact.status, '牌数不符');
  assert.equal(missingCard.spreadCoverageFact.actualCardCount, 2);

  const unknownSpread = analyzeTarotEvidence({
    ...data,
    spreadType: 'unknown',
    spreadName: '未声明牌阵',
    evidenceAnalysis: undefined,
  });
  assert.equal(unknownSpread.spreadCoverageFact.status, '未知牌阵');
  assert.equal(unknownSpread.spreadCoverageFact.expectedCardCount, null);
});

test('塔罗主题对象只做标签计数，不生成权重或吉凶评分', () => {
  const data = drawTarotSpread('three', { seed: '塔罗重复主题' });
  data.cards = data.cards.map((card, index) => ({
    ...card,
    element: index < 2 ? '火（行动、动力、创造）' : '大阿卡纳（核心课题与阶段转折）',
  }));
  const evidence = analyzeTarotEvidence(data);
  const fire = evidence.themeFacts.find((fact) => fact.theme === '火');

  assert.ok(fire);
  assert.equal(fire.status, '重复主题');
  assert.equal(fire.count, 2);
  assert.ok(evidence.recurringThemeFacts.includes(fire));
  assert.match(fire.promptText, /只表示牌面构成，不等于权重分数/);
  assert.doesNotMatch(
    JSON.stringify(evidence),
    /成功率为\d|吉凶总分[：=]\d|能量分数[：=]\d|主题权重[：=]\d/,
  );
});
