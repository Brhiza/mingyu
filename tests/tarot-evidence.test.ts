import assert from 'node:assert/strict';
import test from 'node:test';
import { extractDivinationPromptFacts } from '../scripts/prompt-audit/divination-facts';
import { auditPromptFacts } from '../scripts/prompt-audit/facts';
import {
  analyzeTarotEvidence,
  drawTarotSpread,
  resolveInteractiveTarotCards,
  tarotCards,
  tarotSpreads,
} from '../packages/core/src/divination/tarot.ts';
import type { TarotData, TarotSpreadType } from '../packages/core/src/types/divination.ts';
import { formatEnhancedDivinationInfo } from '../packages/core/src/prompt/divination-enhanced.ts';
import {
  buildDivinationPrompt,
  getDivinationSummaryBlocks,
} from '../packages/core/src/prompt/divination.ts';
import { formatDetailedDivinationInfo } from '../packages/core/src/prompt/divination-detail.ts';

const spreadTypes = Object.keys(tarotSpreads) as TarotSpreadType[];

test('塔罗自动与逐张抽牌的随机记录必须完整并对应实际牌面', () => {
  for (const data of [
    drawTarotSpread('three', { seed: '塔罗整组重放' }),
    drawTarotSpread('three', { interactiveSamples: [0, 0.25, 0.2, 0.75, 0.4, 0.25] }),
  ]) {
    const shortened = structuredClone(data);
    shortened.meta!.random!.samples.pop();
    assert.throws(() => analyzeTarotEvidence(shortened));
    const extended = structuredClone(data);
    extended.meta!.random!.samples.push(0, 0);
    assert.throws(() => analyzeTarotEvidence(extended));
    const changed = structuredClone(data);
    changed.cards[0].reversed = !changed.cards[0].reversed;
    assert.throws(() => analyzeTarotEvidence(changed), /随机轨迹与牌面、顺序或正逆位不一致/);
    assert.equal(data.evidenceAnalysis?.randomFact.status, '可重放');
  }
});

test('塔罗证据分析按牌号重建被篡改的牌面资料并报告缺口', () => {
  const data = structuredClone(
    drawTarotSpread('single', { manualCards: [{ id: 1, reversed: false }] }),
  );
  Object.assign(data.cards[0], {
    name: '皇帝',
    keywords: ['伪造关键词'],
    element: '伪造元素',
    archetype: '伪造牌阶',
  });

  const evidence = analyzeTarotEvidence(data);

  assert.equal(evidence.cards[0].name, '愚者');
  assert.deepEqual(evidence.cards[0].keywords, ['新开始', '冒险', '纯真']);
  assert.equal(evidence.cards[0].status, '存在缺口');
  assert.deepEqual(evidence.cards[0].mismatches, ['牌名', '关键词', '元素主题', '牌阶主题']);
  assert.equal(evidence.traditionalFacts[0].status, '存在缺口');
  assert.equal(evidence.summaryFact.status, '证据链有缺口');
  assert.doesNotMatch(evidence.promptText, /伪造关键词|伪造元素|伪造牌阶|皇帝/);
});

test('塔罗提示词按牌号与本次牌面重建逐牌资料和相邻关系', () => {
  const data = structuredClone(drawTarotSpread('three', { seed: '塔罗提示词证据重算' }));
  const originalName = data.cards[0].name;
  assert.ok(data.evidenceAnalysis?.elementInteractionFacts.length);
  data.cards[0].name = '伪造牌名';
  data.cards[0].keywords = ['伪造关键词'];
  data.evidenceAnalysis.elementInteractionFacts[0].relation = '伪造相邻关系';

  const prompt = formatEnhancedDivinationInfo('tarot', data);
  assert.match(prompt, new RegExp(originalName, 'u'));
  assert.doesNotMatch(prompt, /伪造牌名|伪造关键词|伪造相邻关系/u);
  assert.match(prompt, /相邻牌元素关系：/u);
});

test('残缺多牌阵保留原牌阵类型并列出实际牌位与缺口', () => {
  const complete = drawTarotSpread('three', {
    manualCards: [1, 2, 3].map((id) => ({ id, reversed: false })),
  });
  const incomplete: TarotData = {
    ...complete,
    cards: complete.cards.slice(0, 1),
    evidenceAnalysis: undefined,
  };
  const prompt = buildDivinationPrompt({
    method: 'tarot',
    question: '请结合当前情况解读。',
    data: incomplete,
  });
  const task = prompt.match(/【任务】\n([\s\S]*?)\n\n【问题】/u)?.[1];

  assert.ok(task);
  assert.match(prompt, /牌阵时间流牌阵/);
  assert.match(
    prompt,
    /牌位覆盖：预设3张（过去、现在、未来）；实际记录1张；实际牌位：过去；缺少牌位：现在、未来/u,
  );
  assert.match(task, /围绕已记录牌位与牌面整理本次问题的象征主题/u);
  assert.equal(prompt.match(/缺少牌位：现在、未来/gu)?.length, 1);
  assert.doesNotMatch(prompt, /(?:重复牌位|额外牌位|顺序异常位置|重复牌号)：无/u);
  assert.doesNotMatch(task, /依据唯一牌位/u);
  assert.doesNotMatch(task, /按过去、现在、未来三个牌位/u);
  assert.doesNotMatch(prompt, /塔罗单牌以牌位职能/u);
});

test('凯尔特十字十牌位保留韦特原著的目标、基础、过去影响及希望恐惧', () => {
  // Waite《The Pictorial Key to the Tarot》Part III §7 十张牌位说明。
  const positions = [
    '当前状况',
    '挑战/阻碍',
    '目标与潜能',
    '现实基础',
    '过去影响',
    '近期未来',
    '你的态度',
    '外界影响',
    '希望与恐惧',
    '最终结果',
  ];
  assert.deepEqual(tarotSpreads.celtic.positions, positions);
  const result = drawTarotSpread('celtic', { seed: '凯尔特牌位校勘' });
  assert.deepEqual(
    result.cards.map((card) => card.position),
    positions,
  );
  assert.deepEqual(
    result.draw?.order.map((card) => card.position),
    positions,
  );
});

test('塔罗全部牌阵应输出覆盖、来源、牌序、主题与限制对象', () => {
  assert.equal(spreadTypes.length, 18);

  spreadTypes.forEach((spreadType) => {
    const data = drawTarotSpread(spreadType, { seed: `塔罗结构化证据-${spreadType}` });
    const evidence = data.evidenceAnalysis;

    assert.ok(evidence);
    assert.equal(evidence.key, 'tarot:evidence');
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
  const supportiveData = drawTarotSpread('three', {
    manualCards: [
      { id: 23, reversed: false },
      { id: 51, reversed: true },
      { id: 65, reversed: false },
    ],
  });
  const supportive = supportiveData.evidenceAnalysis!;
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
  const missingWithReversed = structuredClone(supportiveData);
  Reflect.deleteProperty(missingWithReversed.cards[0], 'reversed');
  const unknownAndReversed = analyzeTarotEvidence(missingWithReversed);
  assert.equal(unknownAndReversed.cards[0].orientation, '未记录');
  assert.deepEqual(unknownAndReversed.cards[0].constraints, []);
  assert.match(
    unknownAndReversed.elementInteractionFacts[0].orientationConstraint,
    /现在宝剑王牌为逆位/u,
  );
  assert.match(
    unknownAndReversed.elementInteractionFacts[0].orientationConstraint,
    /过去权杖王牌正逆位未记录/u,
  );
  assert.doesNotMatch(
    unknownAndReversed.elementInteractionFacts[0].orientationConstraint,
    /两牌均为正位/u,
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

  const neutralAndSupportiveData = drawTarotSpread('three', {
    manualCards: [
      { id: 23, reversed: false },
      { id: 65, reversed: false },
      { id: 37, reversed: false },
    ],
  });
  const neutralAndSupportive = neutralAndSupportiveData.evidenceAnalysis!;
  assert.deepEqual(
    neutralAndSupportive.elementInteractionFacts.map((fact) => fact.relation),
    ['中性并置', '相互助长'],
  );
  const missingWithUpright = structuredClone(neutralAndSupportiveData);
  Reflect.deleteProperty(missingWithUpright.cards[0], 'reversed');
  const unknownAndUpright = analyzeTarotEvidence(missingWithUpright);
  assert.equal(unknownAndUpright.elementInteractionFacts[0].fromCardKey, 'tarot:card:1:23:未记录');
  assert.equal(unknownAndUpright.elementInteractionFacts[0].toCardKey, 'tarot:card:2:65:正位');
  assert.equal(unknownAndUpright.elementInteractionFacts[0].relation, '中性并置');
  assert.match(
    unknownAndUpright.elementInteractionFacts[0].orientationConstraint,
    /过去权杖王牌正逆位未记录/u,
  );
  assert.doesNotMatch(
    unknownAndUpright.elementInteractionFacts[0].orientationConstraint,
    /两牌均为正位/u,
  );
  assert.match(unknownAndUpright.elementInteractionFacts[1].orientationConstraint, /两牌均为正位/u);
  const unknownOrientationPrompt = formatEnhancedDivinationInfo('tarot', missingWithUpright);
  assert.match(unknownOrientationPrompt, /过去：权杖王牌（未记录）/u);
  assert.doesNotMatch(unknownOrientationPrompt, /过去：权杖王牌（正位）/u);

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
  const originalNow = Date.now;
  Date.now = () => Date.parse('2026-10-04T08:00:00+08:00');
  try {
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

    assert.deepEqual(
      data.cards.map((card) => card.name),
      ['愚者', '世界', '钱币国王'],
    );
    const promptOptions = {
      method: 'tarot' as const,
      question: '本次牌位与牌面关系如何解读？',
      currentTime: new Date('2026-10-04T08:00:00+08:00'),
    };
    const normalPrompt = buildDivinationPrompt({ ...promptOptions, data });
    assert.match(normalPrompt, /过去：愚者（正位）；关键词：新开始、冒险、纯真/u);
    assert.match(normalPrompt, /现在：世界（逆位）；关键词：完成、成就、圆满/u);
    assert.match(normalPrompt, /未来：钱币国王（正位）；关键词：富裕、成功、安全/u);
    assert.ok(normalPrompt.includes(promptOptions.question));
    const originalName = tarotCards[0]!.name;
    const originalPosition = tarotSpreads.three.positions[0]!;
    try {
      assert.equal(Reflect.set(tarotCards[0]!, 'name', '女祭司'), true);
      assert.equal(Reflect.set(tarotSpreads.three.positions, 0, '另一牌位'), true);
      assert.equal(tarotCards[0]!.name, '女祭司');
      assert.equal(tarotSpreads.three.positions[0], '另一牌位');
      const fresh = drawTarotSpread('three', {
        manualCards: [
          { id: 1, reversed: false },
          { id: 22, reversed: true },
          { id: 78, reversed: false },
        ],
      });
      assert.deepEqual(fresh, data);
      assert.equal(buildDivinationPrompt({ ...promptOptions, data: fresh }), normalPrompt);
    } finally {
      tarotCards[0]!.name = originalName;
      tarotSpreads.three.positions[0] = originalPosition;
    }

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
  } finally {
    Date.now = originalNow;
  }
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
  const data = drawTarotSpread('three', {
    manualCards: [1, 2, 3].map((id, index) => ({ id, reversed: index === 1 })),
  });
  const evidence = data.evidenceAnalysis!;

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
  const normal = data.evidenceAnalysis!;
  const normalEnhanced = formatEnhancedDivinationInfo('tarot', data);
  const currentTime = new Date('2026-10-03T12:00:00+08:00');
  const normalPrompt = buildDivinationPrompt({
    currentTime,
    method: 'tarot',
    data: data,
    question: '结合牌位解读当前问题。',
  });
  for (const missingRecord of ['sparse', 'null'] as const) {
    const partial = structuredClone(data);
    if (missingRecord === 'sparse') delete partial.draw!.order[1];
    else partial.draw!.order[1] = null as never;
    const inputBefore = structuredClone(partial);
    const recovered = analyzeTarotEvidence(partial);
    assert.equal(recovered.drawFact.status, '来源链缺失');
    assert.equal(recovered.drawFact.recordedCardCount, data.cards.length - 1);
    assert.deepEqual(recovered.drawFact.missingIndexes, [2]);
    assert.deepEqual(recovered.drawFact.mismatchIndexes, [2]);
    assert.deepEqual(
      recovered.drawOrderFacts.map((item) => item.index),
      Array.from({ length: data.cards.length }, (_, index) => index + 1).filter(
        (index) => index !== 2,
      ),
    );
    assert.ok(recovered.drawOrderFacts.every((item) => item.status === '一致'));
    assert.equal(recovered.summaryFact.status, '证据链有缺口');
    assert.deepEqual(recovered.cards, normal.cards);
    assert.deepEqual(recovered.traditionalFacts, normal.traditionalFacts);
    assert.equal(formatEnhancedDivinationInfo('tarot', partial), normalEnhanced);
    assert.equal(
      buildDivinationPrompt({
        currentTime,
        method: 'tarot',
        data: partial,
        question: '结合牌位解读当前问题。',
      }),
      normalPrompt,
    );
    assert.deepEqual(partial, inputBefore);
  }
  const shortened = structuredClone(data);
  shortened.draw!.order = shortened.draw!.order.slice(0, 1);
  const shortenedEvidence = analyzeTarotEvidence(shortened);
  assert.equal(shortenedEvidence.drawFact.status, '来源链缺失');
  assert.deepEqual(
    shortenedEvidence.drawFact.missingIndexes,
    Array.from({ length: data.cards.length - 1 }, (_, index) => index + 2),
  );
  assert.equal(shortenedEvidence.drawFact.recordedCardCount, 1);
});

test('塔罗抽牌记录中的牌组规模不符时不得标记为可核验', () => {
  const data = drawTarotSpread('three', { seed: '塔罗牌组规模核验' });
  const tampered: TarotData = structuredClone(data);
  tampered.draw!.deckSize = 77;
  tampered.evidenceAnalysis = undefined;
  const evidence = analyzeTarotEvidence(tampered);

  assert.equal(evidence.randomFact.status, '可重放');
  assert.equal(evidence.drawFact.status, '来源链不一致');
  assert.deepEqual(evidence.drawFact.mismatchIndexes, []);
  assert.deepEqual(evidence.drawFact.metadataMismatches, ['牌组规模应为78张，记录为77张']);
  assert.equal(evidence.summaryFact.status, '证据链有缺口');
  assert.match(evidence.drawFact.promptText, /牌组规模：77张.*应为78张，记录为77张/);
});

test('塔罗牌位、顺序和牌号异常时应给出可定位的覆盖事实', () => {
  const data = drawTarotSpread('three', {
    manualCards: [1, 2, 3].map((id) => ({ id, reversed: false })),
  });
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
  assert.deepEqual(evidence.sequenceFacts, []);
  assert.deepEqual(evidence.elementInteractionFacts, []);
  const prompt = formatEnhancedDivinationInfo('tarot', tampered);
  assert.match(prompt, /缺少牌位：现在；重复牌位：过去；顺序异常位置：2；重复牌号：1/u);
  assert.doesNotMatch(prompt, /额外牌位：无/u);

  const missingCard = analyzeTarotEvidence({
    ...data,
    cards: data.cards.slice(0, 2),
    evidenceAnalysis: undefined,
  });
  assert.equal(missingCard.spreadCoverageFact.status, '牌数不符');
  assert.equal(missingCard.spreadCoverageFact.actualCardCount, 2);
  assert.deepEqual(missingCard.sequence, ['过去愚者正位 → 现在魔术师正位']);
  assert.equal(missingCard.elementInteractionFacts.length, 1);
  assert.deepEqual(
    [
      missingCard.elementInteractionFacts[0].fromCardKey,
      missingCard.elementInteractionFacts[0].toCardKey,
    ],
    ['tarot:card:1:1:正位', 'tarot:card:2:2:正位'],
  );

  const skippedSlot: TarotData = {
    ...data,
    cards: [data.cards[0], data.cards[2]],
    evidenceAnalysis: undefined,
  };
  const skippedBefore = structuredClone(skippedSlot);
  const skippedEvidence = analyzeTarotEvidence(skippedSlot);
  assert.deepEqual(skippedEvidence.spreadCoverageFact.missingPositions, ['现在']);
  assert.deepEqual(skippedEvidence.sequenceFacts, []);
  assert.deepEqual(skippedEvidence.elementInteractionFacts, []);
  const skippedPrompt = buildDivinationPrompt({
    method: 'tarot',
    question: '本次占问',
    data: skippedSlot,
    currentTime: new Date('2025-01-01T00:00:00Z'),
  });
  assert.match(skippedPrompt, /缺少牌位：现在/u);
  assert.doesNotMatch(skippedPrompt, /相邻牌元素关系：|过去愚者正位 → 未来女祭司正位/u);
  assert.deepEqual(skippedSlot, skippedBefore);
  for (const cards of [
    [data.cards[0], { ...data.cards[1], position: '未登记位置' }, data.cards[2]],
    [data.cards[0], data.cards[2], data.cards[1]],
    [data.cards[0], { ...data.cards[1], id: 79 }, data.cards[2]],
    [data.cards[0], { ...data.cards[1], id: 1 }, data.cards[2]],
  ]) {
    const invalidSlots = analyzeTarotEvidence({ ...data, cards, evidenceAnalysis: undefined });
    assert.deepEqual(invalidSlots.sequenceFacts, []);
    assert.deepEqual(invalidSlots.elementInteractionFacts, []);
  }

  const unknownData: TarotData = {
    ...data,
    spreadType: 'unknown',
    spreadName: '未声明牌阵',
    evidenceAnalysis: undefined,
  };
  const unknownSpread = analyzeTarotEvidence(unknownData);
  assert.equal(unknownSpread.spreadCoverageFact.status, '未知牌阵');
  assert.equal(unknownSpread.spreadCoverageFact.expectedCardCount, null);
  const unknownPrompt = formatEnhancedDivinationInfo('tarot', unknownData);
  assert.match(unknownPrompt, /牌位记录：未声明牌阵；实际记录3张；实际牌位：过去、现在、未来/u);
  assert.doesNotMatch(
    unknownPrompt,
    /未列配置|(?:缺少牌位|重复牌位|额外牌位|顺序异常位置|重复牌号)：无/u,
  );
  for (const spreadType of ['unknown', 'toString', 'constructor', '__proto__']) {
    const undeclared = { ...unknownData, spreadType };
    const undeclaredEvidence = analyzeTarotEvidence(undeclared);
    assert.equal(undeclaredEvidence.spreadCoverageFact.status, '未知牌阵');
    assert.equal(undeclaredEvidence.spreadCoverageFact.expectedCardCount, null);
    assert.deepEqual(undeclaredEvidence.sequenceFacts, []);
    assert.deepEqual(undeclaredEvidence.elementInteractionFacts, []);
    assert.match(
      buildDivinationPrompt({
        method: 'tarot',
        question: '本次占问',
        data: undeclared,
        currentTime: new Date('2025-01-01T00:00:00Z'),
      }),
      /实际牌位：过去、现在、未来/u,
    );
  }
});

test('塔罗缺少正逆位时保留未记录状态，不默认按正位解释', () => {
  const data = drawTarotSpread('single', {
    manualCards: [{ id: 1, reversed: false }],
  });
  Reflect.deleteProperty(data.cards[0], 'reversed');

  const evidence = analyzeTarotEvidence(data);
  const prompt = formatEnhancedDivinationInfo('tarot', data);

  assert.equal(evidence.cards[0]?.orientation, '未记录');
  assert.ok(evidence.cards[0]?.mismatches.includes('正逆位缺失或无效'));
  assert.equal(evidence.summaryFact.status, '证据链有缺口');
  assert.equal(evidence.counterEvidenceFacts.length, 0);
  assert.match(prompt, /当前指引：愚者（未记录）/u);
  assert.doesNotMatch(prompt, /当前指引：愚者（正位）/u);
  for (const reversed of [undefined, null, 'false', 1, false, true]) {
    const unknownOrientation = structuredClone(data);
    Object.assign(unknownOrientation.cards[0], { reversed });
    const before = structuredClone(unknownOrientation);
    const unknownEvidence = analyzeTarotEvidence(unknownOrientation);
    const orientation = typeof reversed === 'boolean' ? (reversed ? '逆位' : '正位') : '未记录';
    assert.equal(unknownEvidence.cards[0].orientation, orientation);
    assert.equal(unknownEvidence.cards[0].constraints.length, reversed === true ? 1 : 0);
    assert.equal(unknownEvidence.counterEvidenceFacts.length, reversed === true ? 1 : 0);
    const taskbook = buildDivinationPrompt({
      method: 'tarot',
      question: '本次占问',
      data: unknownOrientation,
      currentTime: new Date('2025-01-01T00:00:00Z'),
    });
    const expectations = extractDivinationPromptFacts('tarot', unknownOrientation);
    const cardFact = expectations.find((fact) => fact.id === 'tarot.card.0');
    assert.ok(cardFact);
    assert.ok(cardFact.values.includes(`（${orientation}）`));
    assert.deepEqual(cardFact.scope, { start: '牌位明细：', end: '【任务】' });
    assert.deepEqual(auditPromptFacts(taskbook, expectations).missing, []);
    const cardLine = taskbook
      .split('\n')
      .find((line) => line.trimStart().startsWith('当前指引：愚者'));
    assert.ok(cardLine);
    assert.deepEqual(auditPromptFacts(taskbook.replace(cardLine, ''), expectations).missing, [
      'tarot.card.0',
    ]);
    const wrongOrientation = orientation === '正位' ? '逆位' : '正位';
    assert.deepEqual(
      auditPromptFacts(
        taskbook.replace(
          `当前指引：愚者（${orientation}）`,
          `当前指引：愚者（${wrongOrientation}）`,
        ),
        expectations,
      ).missing,
      ['tarot.card.0'],
    );
    assert.deepEqual(unknownOrientation, before);
  }
});

test('塔罗抽牌方式与算法身份不一致时不标记来源完整', () => {
  const data = drawTarotSpread('three', { seed: '塔罗身份交叉核对' });
  data.draw!.method = '用户按牌位手工录入';
  data.draw!.orientationRule = '正逆位由用户逐张录入';

  const evidence = analyzeTarotEvidence(data);

  assert.equal(evidence.randomFact.status, '不适用');
  assert.equal(evidence.drawFact.status, '来源链不一致');
  assert.ok(
    evidence.drawFact.metadataMismatches.some((item) =>
      item.includes('算法标识应为tarot.spread.manual'),
    ),
  );
  assert.ok(evidence.drawFact.metadataMismatches.includes('手工录入记录带有随机轨迹'));
  assert.equal(evidence.summaryFact.status, '证据链有缺口');
});

test('塔罗牌阵名称与牌阵类型不符时标记身份缺口', () => {
  const data = drawTarotSpread('three', {
    manualCards: [1, 2, 3].map((id) => ({ id, reversed: false })),
  });
  data.spreadName = '凯尔特十字';

  const evidence = analyzeTarotEvidence(data);

  assert.equal(evidence.spreadCoverageFact.expectedSpreadName, '时间流牌阵');
  assert.equal(evidence.spreadCoverageFact.status, '牌阵名称不符');
  assert.deepEqual(evidence.spreadCoverageFact.identityMismatches, [
    '牌阵名称应为时间流牌阵，记录为凯尔特十字',
  ]);
  assert.equal(evidence.summaryFact.status, '证据链有缺口');
  const taskbook = buildDivinationPrompt({
    method: 'tarot',
    question: '本次占问',
    data,
    currentTime: new Date('2025-01-01T00:00:00Z'),
  });
  assert.match(taskbook, /核心结构：牌阵时间流牌阵；共3张牌/);
  assert.match(taskbook, /【任务】/);
  assert.doesNotMatch(taskbook, /凯尔特十字/);
  assert.match(formatDetailedDivinationInfo('tarot', data), /牌阵时间流牌阵/);
  assert.deepEqual(getDivinationSummaryBlocks('tarot', data).tags[0], '牌阵：时间流牌阵');
});

test('塔罗主题对象只做标签计数，不生成权重或吉凶评分', () => {
  const data = drawTarotSpread('three', {
    manualCards: [
      { id: 23, reversed: false },
      { id: 24, reversed: false },
      { id: 1, reversed: false },
    ],
  });
  const evidence = data.evidenceAnalysis!;
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
