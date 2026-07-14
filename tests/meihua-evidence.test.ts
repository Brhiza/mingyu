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
  assert.deepEqual(
    evidence.stages.map((item) => item.stage),
    ['origin', 'process', 'result'],
  );
  assert.match(evidence.promptText, /【梅花体用阶段推进结构化证据】/);
  assert.match(evidence.promptText, /起因.*→.*过程.*；.*过程.*→.*结果/);
  assert.doesNotMatch(evidence.promptText, /权重[：=]?\d|总分[：=]?\d|成功率[：=]?\d/);
});

test('梅花互卦过程体用应按原动爻所在上下卦确定', () => {
  const lowerMoving = generateMeihua(fixedDate, { method: 'number', number: 123 });
  const lowerProcess = analyzeMeihuaEvidence(lowerMoving).stages.find(
    (item) => item.stage === 'process',
  );

  assert.equal(lowerMoving.movingYao.position <= 3, true);
  assert.equal(lowerProcess?.ti.name, lowerMoving.interHexagram?.lower);
  assert.equal(lowerProcess?.yong.name, lowerMoving.interHexagram?.upper);
  assert.match(lowerProcess?.basis ?? '', /下互为体、上互为用/);
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
  assert.ok(items.some((item) => item.title === '六爻阴阳与体用归属'));
  assert.ok(items.some((item) => item.tags?.includes('动爻爻辞')));
  assert.equal(items.filter((item) => item.tags?.includes('阶段推进')).length, 2);
  assert.ok(items.some((item) => item.title === '互卦对原体辅助关系'));
  assert.ok(items.some((item) => item.level === '应期' && item.title.includes('触发')));
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
    facts.every((item) => item.sources.length > 0 && item.limitation.includes('不证明现实吉凶')),
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
