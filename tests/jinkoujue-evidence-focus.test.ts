import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import { generateJinkoujue } from '../packages/core/src/divination/algorithms/jinkoujue';
import { analyzeJinkoujueEvidence } from '../packages/core/src/divination/jinkoujue-evidence';
import { generateDivinationSession } from '../packages/core/src/divination/session';
import { formatEnhancedDivinationInfo } from '../packages/core/src/prompt/divination-enhanced';

const date = new Date('2025-01-01T08:00:00+08:00');

test('金口诀辅助位受月令限制时保留反证，不误标发用主线受限', () => {
  const data = generateJinkoujue({ method: 'branch', branch: '午', customDate: date });
  const evidence = data.evidenceAnalysis!;

  assert.equal(data.yinYangUse.usePosition, '将神');
  assert.equal(data.positions.jiangShen.seasonState, '相');
  assert.equal(data.positions.jiangShen.isVoid, false);
  assert.ok(evidence.counterEvidenceFacts.some((item) => item.detail === '地分月令死'));
  assert.equal(evidence.summaryFact.status, '证据链完整');
  assert.ok(evidence.counterEvidenceFacts.every((item) => item.type !== '主证受限'));
});

test('金口诀发用位旬空仍标主线受限，辅助位旬空只作为该位事实', () => {
  const mainVoid = generateJinkoujue({ method: 'branch', branch: '寅', customDate: date });
  assert.equal(mainVoid.yinYangUse.usePosition, '将神');
  assert.equal(mainVoid.positions.jiangShen.isVoid, true);
  assert.equal(mainVoid.evidenceAnalysis?.summaryFact.status, '主线受限');
  assert.equal(
    mainVoid.evidenceAnalysis?.counterEvidenceFacts.filter(
      (item) => item.type === '旬空' && item.ownerKey === 'jinkoujue:position:将神',
    ).length,
    1,
  );

  const auxiliaryVoid = generateJinkoujue({
    method: 'branch',
    branch: '巳',
    customDate: new Date('2025-02-01T08:00:00+08:00'),
  });
  assert.equal(auxiliaryVoid.yinYangUse.usePosition, '将神');
  assert.equal(auxiliaryVoid.positions.jiangShen.isVoid, false);
  assert.equal(auxiliaryVoid.positions.guiShen.isVoid, true);
  assert.equal(auxiliaryVoid.evidenceAnalysis?.summaryFact.status, '证据链完整');
  assert.deepEqual(
    auxiliaryVoid.evidenceAnalysis?.counterEvidenceFacts
      .filter((item) => item.type === '旬空' && item.ownerKey === 'jinkoujue:position:贵神')
      .map(({ ownerKey, detail, promptText }) => ({ ownerKey, detail, promptText })),
    [
      {
        ownerKey: 'jinkoujue:position:贵神',
        detail: '贵神巳落日旬空',
        promptText: '贵神巳落日旬空',
      },
    ],
  );
  const auxiliaryBefore = structuredClone(auxiliaryVoid);
  const prompt = formatEnhancedDivinationInfo('jinkoujue', auxiliaryVoid);
  const fourPositions = prompt.split('\n').find((line) => line.startsWith('四位：'));
  assert.ok(fourPositions?.includes('贵神癸巳乘螣蛇（阴火，月令休，空）'));
  assert.equal(prompt.split('贵神癸巳乘螣蛇（阴火，月令休，空）').length - 1, 1);
  assert.doesNotMatch(prompt, /贵神巳落日旬空/);
  assert.doesNotMatch(prompt, /需待填实后再作主断|主证受限/);
  assert.deepEqual(auxiliaryVoid, auxiliaryBefore);
});

test('金口诀发用位受克应列为盘内反证并标记主线受限', () => {
  const data = generateJinkoujue({
    method: 'number',
    number: 1,
    customDate: new Date('2025-01-01T20:00:00+08:00'),
  });
  const evidence = data.evidenceAnalysis!;
  const mainPositionKey = `jinkoujue:position:${data.yinYangUse.usePosition}`;
  const mainPositionCounters = evidence.counterEvidenceFacts.filter(
    (item) => item.ownerKey === mainPositionKey,
  );

  assert.equal(data.yinYangUse.usePosition, '将神');
  assert.equal(data.relations.guiToJiang, '克');
  assert.equal(data.positions.jiangShen.seasonState, '相');
  assert.equal(data.positions.jiangShen.isVoid, false);
  assert.deepEqual(data.positions.jiangShen.constraints, []);
  assert.ok(
    mainPositionCounters.some((item) => item.type === '受克' && item.detail === '将神受贵神克'),
  );
  assert.ok(evidence.counterEvidenceFacts.some((item) => item.detail === '贵神受人元克'));
  assert.equal(evidence.summaryFact.status, '主线受限');
  assert.match(evidence.promptText, /反证：[^\n]*将神受贵神克/u);
  assert.doesNotMatch(evidence.promptText, /未见明确空亡、休囚死或受克限制/u);
  const structuredBefore = structuredClone(data);

  const session = generateDivinationSession({
    method: 'jinkoujue',
    question: '请核对这次问事的进展。',
    divinationTime: '2025-01-01T20:00:00+08:00',
    currentTime: '2025-01-01T20:00:00+08:00',
    jinkoujue: { method: 'number', number: 1 },
  });
  assert.match(session.aiPrompt, /贵神金克将神木/u);
  assert.equal(session.aiPrompt.split('贵神金克将神木').length - 1, 1);
  assert.doesNotMatch(session.aiPrompt, /将神受贵神克/u);
  assert.equal((session.data as typeof data).evidenceAnalysis?.summaryFact.status, '主线受限');

  const enhanced = formatEnhancedDivinationInfo('jinkoujue', data);
  assert.match(enhanced, /贵神金克将神木/u);
  assert.equal(enhanced.split('贵神金克将神木').length - 1, 1);
  assert.doesNotMatch(enhanced, /四位反证：[^\n]*将神受贵神克/u);
  assert.match(enhanced, /发用位将神不空/u);
  assert.deepEqual(data, structuredBefore);
});

test('金口诀人元克发用将神时计入关系、反证与主线状态', () => {
  const data = generateJinkoujue({
    method: 'number',
    number: 5,
    customDate: new Date('2025-01-01T04:00:00+08:00'),
  });
  const evidence = data.evidenceAnalysis!;

  assert.equal(data.ganzhi.day, '庚午');
  assert.equal(data.yinYangUse.usePosition, '将神');
  assert.equal(data.positions.renYuan.element, '金');
  assert.equal(data.positions.jiangShen.element, '木');
  assert.equal(data.relations.renToJiang, '克');
  assert.ok(
    evidence.relations.some(
      (item) => item.key === 'jinkoujue:relation:ren-jiang' && item.relation === '克',
    ),
  );
  assert.ok(evidence.counterEvidenceFacts.some((item) => item.detail === '将神受人元克'));
  assert.equal(evidence.summaryFact.status, '主线受限');
  assert.match(evidence.promptText, /人元庚辰对将神己卯为克/u);
  assert.match(evidence.promptText, /将神受人元克/u);
  assert.match(formatEnhancedDivinationInfo('jinkoujue', data), /人元金克将神木/u);

  const legacyData = structuredClone(data);
  delete legacyData.relations.renToJiang;
  const legacyEvidence = analyzeJinkoujueEvidence(legacyData);
  assert.equal(legacyEvidence.summaryFact.status, '主线受限');
  assert.ok(legacyEvidence.counterEvidenceFacts.some((item) => item.detail === '将神受人元克'));
  assert.match(formatEnhancedDivinationInfo('jinkoujue', legacyData), /人元金克将神木/u);
});

test('金口诀公元 1 年大寒前沿用上一冬至的丑将', () => {
  const data = generateJinkoujue({ customDate: new Date('0001-01-20T00:00:00Z') });
  assert.equal(data.monthLeader, '丑');
  assert.equal(
    generateJinkoujue({ customDate: new Date('0001-01-21T08:39:40Z') }).monthLeader,
    '丑',
  );
  assert.equal(
    generateJinkoujue({ customDate: new Date('0001-01-21T08:39:41Z') }).monthLeader,
    '子',
  );
});
