import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatDivinationResult,
  generateDivinationSession,
  serializeDivinationResult,
  validateDivinationRequest,
} from 'mingyu-core/divination/session';
import { createConsumptionView } from 'mingyu-core/consumption';
import type { HuangjiJingshiResult } from 'mingyu-core/huangji-jingshi';

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
  assert.match(session.formattedResult, /起课过程/);
  assert.match(session.formattedResult, /取用层级：时宫.+为本次占得宫与主证/);
  assert.doesNotMatch(session.formattedResult, /mod\s*6|时序\d+/);
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

test('统一占法会话应支持金口诀指定地分并在计算前校验输入', () => {
  const session = generateDivinationSession({
    method: 'jinkoujue',
    question: '这件事接下来如何推进？',
    divinationTime: '2026-07-11T14:35:00+08:00',
    jinkoujue: { method: 'branch', branch: '申' },
  });
  assert.equal(session.data.method, 'branch');
  assert.equal(session.data.diFenBranch, '申');
  assert.match(session.aiPrompt, /地分申/);

  assert.throws(
    () =>
      validateDivinationRequest({
        method: 'jinkoujue',
        question: '测试',
        jinkoujue: { method: 'branch' },
      }),
    /指定地分必须是/,
  );
});

test('统一占法会话应支持皇极经世值年盘', () => {
  const session = generateDivinationSession({
    method: 'huangji',
    question: '这一年的时势主线是什么？',
    huangji: { year: 2026 },
  });

  assert.equal(session.method, 'huangji');
  assert.equal(session.summary.title, '皇极经世结果');
  assert.match(session.formattedResult, /会内统卦：泽风大过/);
  assert.match(session.prompt, /值年卦：天火同人/);
  assert.equal(session.aiPrompt, session.prompt);
  assert.match(session.serializedResult, /"forecast"/);
});

test('统一占法会话应支持皇极经世年月日时盘', () => {
  const session = generateDivinationSession({
    method: 'huangji',
    question: '这个时点的时势主线是什么？',
    divinationTime: '2025-12-25T12:30:00+08:00',
  });

  assert.equal((session.data as HuangjiJingshiResult).input.mode, '年月日时');
  assert.match(
    session.formattedResult,
    /年月日时卦：月经天山遁；旬纬天火同人；日卦雷山小过；时经地山谦/,
  );
  assert.match(session.prompt, /时经卦：地山谦/);
});
