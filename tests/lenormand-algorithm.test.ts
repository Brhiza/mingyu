import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeLenormandEvidence,
  drawLenormandSpread,
} from '../packages/core/src/divination/algorithms/lenormand.ts';

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
  assert.equal(layoutItems?.length, result.layoutEvidence?.length);
  assert.ok(layoutItems?.every((item) => item.level === '辅证'));
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
