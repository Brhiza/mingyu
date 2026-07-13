import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeAlmanacEvidence, generateAlmanacSelection } from 'mingyu-core/divination/almanac';

test('黄历择日应内置透明约束与候选证据', () => {
  const data = generateAlmanacSelection({
    topic: 'move',
    startDate: '2026-06-01',
    endDate: '2026-06-05',
  });
  const evidence = data.evidenceAnalysis;

  assert.ok(evidence);
  assert.equal(evidence.candidates.length, data.days.length);
  assert.match(evidence.promptText, /【黄历择日透明约束与候选证据】/);
  assert.match(evidence.promptText, /传统硬限制：/);
  assert.match(evidence.promptText, /候选分组：/);
  assert.doesNotMatch(evidence.promptText, /评分[：=]?\d|\d+分|成功率[：=]?\d|匹配率[：=]?\d/);
});

test('择日证据应让明确事项忌项覆盖内部排序', () => {
  const data = generateAlmanacSelection({
    topic: 'move',
    startDate: '2026-06-01',
    endDate: '2026-06-10',
  });
  const target = data.days.find((day) =>
    day.cautions.some((item) => item.includes('黄历忌项触及')),
  );
  assert.ok(target);

  const evidence = analyzeAlmanacEvidence(data);
  const candidate = evidence.candidates.find((item) => item.date === target.date);

  assert.equal(candidate?.status, '慎用候选');
  assert.ok(evidence.cautionDates.includes(target.date));
  assert.match(evidence.promptText, new RegExp(`${target.date}慎用候选`));
});

test('择日证据在缺少参与人时不得编造个人适配', () => {
  const evidence = analyzeAlmanacEvidence(
    generateAlmanacSelection({
      topic: 'contract',
      startDate: '2026-06-01',
      endDate: '2026-06-03',
    }),
  );

  assert.match(evidence.promptText, /没有参与人资料时不得编造个人适配结论/);
  assert.match(evidence.promptText, /现实条件未提供时只列待核验项/);
  assert.match(evidence.promptText, /不合成为成功率或吉凶总分/);
});
