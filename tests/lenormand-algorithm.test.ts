import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeLenormandEvidence,
  conditionLenormandTraditionalText,
  drawLenormandSpread,
  LENORMAND_CARDS,
  LENORMAND_FIXED_COMBINATIONS,
  LENORMAND_SPREADS,
  rebuildAuditedLenormandData,
  resolveInteractiveLenormandCards,
} from '../packages/core/src/divination/algorithms/lenormand.ts';
import type { LenormandData, LenormandSpreadType } from '../packages/core/src/types/divination.ts';
import { assertPromptIsPortableTaskText } from './prompt-assertions';

const spreadTypes: LenormandSpreadType[] = [
  'single',
  'three',
  'five',
  'relationship',
  'decision',
  'nine',
  'element',
  'grandTableau',
];

test('雷诺曼36张目录应只保留连续牌号与唯一牌名', () => {
  assert.equal(LENORMAND_CARDS.length, 36);
  assert.deepEqual(
    LENORMAND_CARDS.map((card) => card.id),
    Array.from({ length: 36 }, (_, index) => index + 1),
  );
  assert.equal(new Set(LENORMAND_CARDS.map((card) => card.name)).size, 36);
  assert.ok(LENORMAND_CARDS.every((card) => card.keywords.length === 0 && card.meaning === ''));
  assert.deepEqual(LENORMAND_FIXED_COMBINATIONS, {});
});

test('雷诺曼全部牌阵应只输出原始牌面与可重放抽取轨迹', () => {
  for (const spreadType of spreadTypes) {
    const result = drawLenormandSpread(spreadType, { seed: `雷诺曼失败关闭-${spreadType}` });
    const evidence = result.evidenceAnalysis;

    assert.ok(evidence);
    assert.equal(result.cards.length, result.draw?.order.length);
    assert.equal(new Set(result.cards.map((card) => card.id)).size, result.cards.length);
    assert.ok(result.cards.every((card) => card.keywords.length === 0 && card.meaning === ''));
    assert.deepEqual(
      result.cards.map((card) => card.position),
      Array.from({ length: result.cards.length }, (_, index) => `第${index + 1}牌位`),
    );
    assert.ok(
      result.cards.every(
        (card) => card.house === undefined && card.row === undefined && card.column === undefined,
      ),
    );
    assert.doesNotMatch(
      LENORMAND_SPREADS[spreadType].positions.join(''),
      /起因|现状|走向|状态|纽带|建议|核心|行动|能量|情感|直觉|思维|沟通|物质|根基|宫/,
    );
    assert.deepEqual(result.combinations, []);
    assert.deepEqual(result.layoutEvidence, []);
    assert.deepEqual(evidence.traditionalFacts, []);
    assert.deepEqual(evidence.structuredLayoutFacts, []);
    assert.deepEqual(evidence.fixedCombinations, []);
    assert.deepEqual(evidence.adjacentReadings, []);
    assert.equal(evidence.summaryFact.status, '证据链有缺口');
    assert.equal(evidence.randomFact.status, '可重放');
    assert.match(evidence.promptText, /具体牌组版本、原文和页码校勘/);
    assert.doesNotMatch(
      evidence.promptText,
      /家庭添丁|感情的承诺或婚约|通过网络\/远程获利|隐藏动机|局势转明/,
    );
    assertPromptIsPortableTaskText(evidence.promptText);
  }
});

test('雷诺曼全部牌号应按内部目录重建并保持牌义为空', () => {
  for (const reference of LENORMAND_CARDS) {
    const result = drawLenormandSpread('single', { manualCardIds: [reference.id] });
    assert.deepEqual(result.cards[0], {
      id: reference.id,
      name: reference.name,
      keywords: [],
      meaning: '',
      position: '第1牌位',
      house: undefined,
      row: undefined,
      column: undefined,
    });
    assert.equal(result.evidenceAnalysis?.summaryFact.status, '证据链有缺口');
    assert.equal(result.evidenceAnalysis?.randomFact.status, '不适用');
  }
});

test('雷诺曼条件化入口应统一失败关闭', () => {
  const expected =
    '雷诺曼关键词、单牌牌义、固定组合、相邻合读与布局解释尚未完成具体牌组版本、原文和页码校勘，本次不推算、不输出';
  assert.equal(conditionLenormandTraditionalText('家庭添丁'), expected);
  assert.equal(
    conditionLenormandTraditionalText('消息带来感情进展', {
      kind: '固定组合',
      cardNames: ['骑士', '心'],
    }),
    expected,
  );
});

test('雷诺曼交互抽牌应逐张无重复并保留可重放轨迹', () => {
  const samples = [0, 0.5, 0.999];
  const preview = resolveInteractiveLenormandCards('three', samples);
  const result = drawLenormandSpread('three', { interactiveSamples: samples });

  assert.deepEqual(
    result.cards.map((card) => card.id),
    preview.map((card) => card.id),
  );
  assert.deepEqual(result.meta?.random, { mode: 'system', seed: undefined, samples });
  assert.equal(result.evidenceAnalysis?.randomFact.status, '可重放');
  assert.throws(
    () => drawLenormandSpread('three', { interactiveSamples: samples.slice(0, -1) }),
    /需要逐张抽取3张牌/,
  );
});

test('雷诺曼重建应忽略旧派生牌义、组合和布局文字', () => {
  const result = drawLenormandSpread('three', { seed: '雷诺曼旧派生污染' });
  const tampered: LenormandData = structuredClone(result);
  tampered.cards[0].name = '伪造牌名';
  tampered.cards[0].keywords = ['伪造关键词'];
  tampered.cards[0].meaning = '伪造牌义';
  tampered.combinations = [{ card1: '伪造甲', card2: '伪造乙', meaning: '伪造组合' }];
  tampered.layoutEvidence = ['伪造布局'];
  tampered.evidenceAnalysis = undefined;

  assert.deepEqual(rebuildAuditedLenormandData(tampered), rebuildAuditedLenormandData(result));
});

test('雷诺曼来源链异常应失败关闭', () => {
  const result = drawLenormandSpread('nine', { seed: '雷诺曼来源链' });
  const cardTampered = structuredClone(result);
  cardTampered.cards[0].id = cardTampered.cards[0].id === 1 ? 2 : 1;
  assert.throws(
    () => analyzeLenormandEvidence(cardTampered),
    /与随机轨迹重放结果不一致|不能出现重复牌号/,
  );

  const traceTampered = structuredClone(result);
  traceTampered.meta!.random!.samples.pop();
  assert.throws(() => rebuildAuditedLenormandData(traceTampered), /随机轨迹应为/);

  assert.throws(
    () => drawLenormandSpread('unknown' as LenormandSpreadType),
    /未知的雷诺曼牌阵类型/,
  );
});
