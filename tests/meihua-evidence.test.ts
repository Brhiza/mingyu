import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeMeihuaEvidence, generateMeihua } from 'mingyu-core/divination/meihua';

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
