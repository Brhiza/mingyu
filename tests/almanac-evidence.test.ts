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
  assert.match(evidence.promptText, /中国标准时间12:00参照月相/);
  assert.match(evidence.promptText, /月相只作为中国标准时间正午的天文背景，不参与候选排序/);
  assert.ok(evidence.candidates.every((candidate) => candidate.astronomicalFacts.length === 2));
  assert.doesNotMatch(evidence.promptText, /评分[：=]?\d|\d+分|成功率[：=]?\d|匹配率[：=]?\d/);
});

test('择日证据应保留日课、宿曜、九星、百忌、方位神与逐时时课来源', () => {
  const result = generateAlmanacSelection({
    topic: 'travel',
    startDate: '2025-01-01',
    endDate: '2025-01-03',
  });
  const candidate = result.evidenceAnalysis?.candidates[0];

  assert.ok(candidate);
  assert.ok(candidate.calendarFacts.some((item) => item.includes('年柱')));
  assert.ok(candidate.calendarFacts.some((item) => item.includes('建除值日')));
  assert.ok(candidate.traditionalRuleFacts.some((item) => item.includes('二十八宿')));
  assert.ok(candidate.traditionalRuleFacts.some((item) => item.includes('九星')));
  assert.ok(candidate.traditionalRuleFacts.some((item) => item.includes('彭祖百忌')));
  assert.ok(candidate.directionFacts.some((item) => item.includes('太岁')));
  assert.ok(candidate.usableHours.length > 0);
  assert.ok(candidate.usableHours.every((item) => item.ganzhi && item.twelveStar));
  assert.match(result.evidenceAnalysis?.promptText ?? '', /原始宜项/);
  assert.match(result.evidenceAnalysis?.promptText ?? '', /逐时时课|时段/);
  assert.doesNotMatch(
    JSON.stringify(result.evidenceAnalysis?.evidence),
    /"score"\s*:|成功率[：=]?\s*\d|吉凶总分[：=]?\s*\d/,
  );
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
