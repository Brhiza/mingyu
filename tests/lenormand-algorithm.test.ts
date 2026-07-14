import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeLenormandEvidence,
  conditionLenormandTraditionalText,
  drawLenormandSpread,
  LENORMAND_CARDS,
  LENORMAND_FIXED_COMBINATIONS,
} from '../packages/core/src/divination/algorithms/lenormand.ts';
import type { LenormandData } from '../packages/core/src/types/divination.ts';

test('雷诺曼大桌牌阵应抽取完整 36 张牌', () => {
  const result = drawLenormandSpread('grandTableau');

  assert.equal(result.cards.length, 36);
  assert.equal(new Set(result.cards.map((card) => card.id)).size, 36);
  assert.equal(result.cards[0].position, '第1宫（骑士宫）');
  assert.equal(result.cards[35].position, '第36宫（十字架宫）');
  assert.equal(result.cards[0].house, '骑士');
  assert.equal(result.draw?.deckSize, 36);
  assert.equal(result.draw?.order.length, 36);
  assert.deepEqual(
    result.draw?.order.map((item) => [item.position, item.cardId, item.cardName, item.house]),
    result.cards.map((card) => [card.position, card.id, card.name, card.house]),
  );
  assert.equal(result.combinations?.length, 35);
  assert.ok(result.combinations?.every((item) => item.source));
  assert.ok(result.layoutEvidence?.some((item) => item.includes('男士落第')));
  assert.ok(result.layoutEvidence?.some((item) => item.includes('女士落第')));
  assert.equal(
    result.evidenceAnalysis?.structuredLayoutFacts.filter((item) => item.kind === '大桌宫位')
      .length,
    36,
  );
  assert.equal(
    result.evidenceAnalysis?.structuredLayoutFacts.filter((item) => item.kind === '人物牌近身')
      .length,
    2,
  );
  assert.ok(
    result.evidenceAnalysis?.structuredLayoutFacts.every(
      (item) => item.source && item.limitation.includes('不自动证明吉凶'),
    ),
  );
  const promptLayoutItems = result.evidenceAnalysis?.evidence.items.filter((item) =>
    item.tags?.includes('布局证据'),
  );
  assert.ok(promptLayoutItems?.every((item) => !item.tags?.includes('大桌宫位')));
  assert.match(result.evidenceAnalysis?.promptText || '', /逐牌宫位落点见对应牌面条目/);
});

test('雷诺曼九宫应输出横纵与对角线结构证据', () => {
  const result = drawLenormandSpread('nine', { seed: 20260711 });
  assert.equal(result.cards.length, 9);
  assert.equal(result.draw?.deckSize, 36);
  assert.equal(result.draw?.method, 'Fisher-Yates洗牌后依牌位顺序取顶牌');
  assert.equal(result.draw?.order.length, 9);
  assert.deepEqual(
    result.draw?.order.map((item) => [
      item.index,
      item.position,
      item.cardName,
      item.row,
      item.column,
    ]),
    result.cards.map((card, index) => [index + 1, card.position, card.name, card.row, card.column]),
  );
  assert.equal(result.combinations?.length, 8);
  assert.ok(result.layoutEvidence?.some((item) => item.includes('横向')));
  assert.ok(result.layoutEvidence?.some((item) => item.includes('对角线')));
  const layoutItems = result.evidenceAnalysis?.evidence.items.filter((item) =>
    item.tags?.includes('布局证据'),
  );
  assert.equal(layoutItems?.length, 9);
  assert.ok(layoutItems?.every((item) => item.level === '辅证'));
  assert.equal(result.evidenceAnalysis?.structuredLayoutFacts.length, 9);
  assert.equal(
    result.evidenceAnalysis?.structuredLayoutFacts.filter((item) => item.kind === '九宫路径')
      .length,
    8,
  );
  const structureItem = result.evidenceAnalysis?.evidence.items.find((item) =>
    item.title.startsWith('牌阵结构：'),
  );
  const sequenceItem = result.evidenceAnalysis?.evidence.items.find(
    (item) => item.title === '牌位顺序推进',
  );
  const randomItem = result.evidenceAnalysis?.evidence.items.find(
    (item) => item.title === '随机过程重放记录',
  );
  const drawItem = result.evidenceAnalysis?.evidence.items.find(
    (item) => item.title === '洗牌与抽取顺序事实',
  );
  assert.equal(structureItem?.level, '辅证');
  assert.equal(sequenceItem?.level, '辅证');
  assert.equal(randomItem?.level, '辅证');
  assert.equal(drawItem?.level, '辅证');
  assert.match(drawItem?.detail || '', /牌组规模：36张/);
  assert.match(drawItem?.detail || '', /Fisher-Yates/);
  assert.match(result.evidenceAnalysis?.drawFacts.join('；') || '', /第1张对应/);
  assert.match(randomItem?.detail || '', /不表示可信度或预测有效性/);
  assert.ok(
    result.evidenceAnalysis?.randomFacts.some((item) => item.includes('随机种子：20260711')),
  );
  assert.doesNotMatch(result.evidenceAnalysis?.promptText || '', /随机种子：20260711/);
  assert.doesNotMatch(result.evidenceAnalysis?.promptText || '', /成功率|吉凶总分|score/i);
});

test('雷诺曼全部单牌应保留原文并生成关键词核验范围', () => {
  const facts = LENORMAND_CARDS.flatMap((card) => {
    const data: LenormandData = {
      spreadType: 'single',
      spreadName: '单牌线索',
      cards: [{ ...card, position: '核心线索' }],
      timestamp: 0,
    };
    return analyzeLenormandEvidence(data).traditionalFacts;
  });

  assert.equal(facts.length, 36);
  assert.ok(
    facts.every(
      (item) =>
        item.kind === '单牌牌义' &&
        item.originalText &&
        item.promptText &&
        item.verificationTargets.length > 0 &&
        item.sources.length > 0 &&
        item.limitation.includes('不证明现实事件'),
    ),
  );
  assert.ok(facts.some((item) => /隐藏动机|家庭添丁|问题有解/.test(item.originalText)));
  assert.doesNotMatch(
    facts.map((item) => item.promptText).join('\n'),
    /隐藏动机|家庭添丁|问题有解|会提供支持|不能强行续命/,
  );
});

test('雷诺曼全部固定组合应保留原文并生成条件化核验事实', () => {
  const facts = Object.entries(LENORMAND_FIXED_COMBINATIONS).flatMap(([pair, meaning], index) => {
    const [firstName, secondName] = pair.split('+');
    const first = LENORMAND_CARDS.find((card) => card.name === firstName);
    const second = LENORMAND_CARDS.find((card) => card.name === secondName);
    assert.ok(first && second, `${pair} 应引用有效牌名`);
    const data: LenormandData = {
      spreadType: 'three',
      spreadName: '组合审计',
      cards: [
        { ...first, position: '前牌' },
        { ...second, position: '后牌' },
      ],
      combinations: [{ card1: first.name, card2: second.name, meaning, source: '固定组合' }],
      timestamp: index,
    };
    return analyzeLenormandEvidence(data).traditionalFacts.filter(
      (item) => item.kind === '固定组合',
    );
  });

  assert.equal(facts.length, Object.keys(LENORMAND_FIXED_COMBINATIONS).length);
  assert.ok(
    facts.every(
      (item) =>
        item.originalText &&
        item.promptText &&
        item.verificationTargets.length > 0 &&
        item.sources.length > 0 &&
        item.limitation.includes('感情承诺'),
    ),
  );
  assert.ok(facts.some((item) => /婚约|家庭添丁|获利|欺骗/.test(item.originalText)));
  assert.doesNotMatch(
    facts.map((item) => item.promptText).join('\n'),
    /感情的承诺或婚约|家庭添丁|通过网络\/远程获利|隐藏在迷雾中的欺骗/,
  );
});

test('雷诺曼条件化函数应区分固定组合与普通相邻合读', () => {
  const fixed = conditionLenormandTraditionalText('家庭添丁', {
    kind: '固定组合',
    cardNames: ['孩子', '房子'],
    keywords: ['新开始', '家庭'],
  });
  const adjacent = conditionLenormandTraditionalText('先看房子，再看孩子', {
    kind: '相邻合读',
    cardNames: ['房子', '孩子'],
    keywords: ['家庭', '新开始'],
  });

  assert.match(fixed, /家庭成员变化或生育议题/);
  assert.match(fixed, /不得直接认定婚约、生育、收益、欺骗/);
  assert.match(adjacent, /这不是传统固定组合/);
  assert.doesNotMatch(adjacent, /先看房子，再看孩子/);
});

test('雷诺曼旧数据缺少抽牌来源时应明确保留证据缺口', () => {
  const result = drawLenormandSpread('single', { seed: 1 });
  const legacyData = { ...result, draw: undefined, evidenceAnalysis: undefined };
  const analysis = result.evidenceAnalysis;

  assert.ok(analysis);
  const legacyAnalysis = analyzeLenormandEvidence(legacyData);
  const missingItem = legacyAnalysis.evidence.items.find((item) => item.title === '抽牌来源链缺失');
  assert.equal(missingItem?.level, '反证');
  assert.match(missingItem?.detail || '', /不能反推完整抽牌来源链/);
});

test('雷诺曼未知牌阵应明确报错，不应静默退回单牌', () => {
  assert.throws(() => drawLenormandSpread('unknown' as never), /未知的雷诺曼牌阵类型/);
});
