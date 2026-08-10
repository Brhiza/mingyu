import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatDivinationResult,
  generateDivinationSession,
  serializeDivinationResult,
  validateDivinationRequest,
} from 'mingyu-core/divination/session';
import { createConsumptionView } from 'mingyu-core/consumption';

test('统一占法会话应覆盖时间课、摘要、提示词和稳定序列化', () => {
  const session = generateDivinationSession({
    method: 'xiaoliuren',
    question: '这件事接下来如何推进？',
    divinationTime: '2026-08-06T12:30:00+08:00',
    currentTime: '2026-08-06T12:30:00+08:00',
  });

  assert.equal(session.method, 'xiaoliuren');
  assert.equal(session.summary.title, '小六壬起课结果');
  assert.match(session.formattedResult, /占得宫/);
  assert.doesNotMatch(session.formattedResult, /月宫|日宫|顺数/);
  assert.match(session.prompt, /这件事接下来如何推进/);
  assert.match(session.serializedResult, /"primary"/);
  assert.equal(session.serializedResult, serializeDivinationResult(session.data));
  assert.equal(session.formattedResult, formatDivinationResult(session.method, session.data));
  assert.equal(session.displaySummary, session.summary);
  assert.match(session.aiPrompt, /【占卜资料】/);
  assert.match(session.aiPrompt, /这件事接下来如何推进/);
  assert.doesNotMatch(session.aiPrompt, /结构化证据|证据汇总|计算链|古籍依据|资料来源/);
  assert.ok(session.auditEvidence.some((item) => item.field === 'calculation'));
  assert.ok(session.auditEvidence.some((item) => item.field === 'evidenceAnalysis'));
  assert.equal(session.view.kind, 'xiaoliuren');
  assert.equal(session.view.schemaVersion.length > 0, true);
  assert.equal(session.view.raw, session.data);
  assert.equal(session.view.evidence, session.auditEvidence);
  assert.doesNotMatch(session.displaySummary.lines.join('\n'), /证据链|计算链|古籍依据/);
});

test('任意核心结果应可投影为统一消费视图并保留原始结果', () => {
  const raw = {
    summary: { label: '简要结果' },
    timing: { date: '2026-08-10' },
    warnings: ['边界提示'],
    chartValue: '盘面值',
    evidenceAnalysis: { source: '审计来源', calculationSteps: ['步骤一'] },
  };
  const view = createConsumptionView({ kind: 'example', input: { value: 1 }, raw });

  assert.equal(view.kind, 'example');
  assert.deepEqual(view.summary, raw.summary);
  assert.deepEqual(view.timing, raw.timing);
  assert.deepEqual(view.warnings, raw.warnings);
  assert.equal((view.chart as { chartValue: string }).chartValue, '盘面值');
  assert.equal(view.evidence[0]?.field, 'evidenceAnalysis');
  assert.equal(view.raw, raw);
});

test('统一占法会话应保留手工六爻输入并支持随机牌阵种子', () => {
  const liuyao = generateDivinationSession({
    method: 'liuyao',
    question: '手工六爻测试',
    liuyao: { method: 'manual', yaos: [7, 8, 9, 6, 7, 8] },
  });
  assert.deepEqual(liuyao.data.yaoArray, [7, 8, 9, 6, 7, 8]);

  const tarot = generateDivinationSession({
    method: 'tarot',
    question: '牌阵测试',
    tarot: { spread: 'three' },
    random: { seed: 'session-test' },
  });
  assert.equal(tarot.data.cards.length, 3);
  assert.match(tarot.prompt, /牌阵/);
});

test('统一占法会话应在计算前拒绝缺少占法问题', () => {
  assert.throws(() => validateDivinationRequest({ method: 'meihua' }), /需要提供问题/);
});
