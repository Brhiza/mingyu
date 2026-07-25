import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { generateAlmanacSelection } from '../packages/core/src/divination/algorithms/almanac.ts';

test('黄历择日：事项硬规则应写入建除与神煞匹配事实', () => {
  const result = generateAlmanacSelection({
    topic: 'marriage',
    startDate: '2025-06-01',
    endDate: '2025-06-07',
  });

  assert.ok(result.days.length > 0);
  const hasRuleFact = result.days.some((day) =>
    (day.topicMatchFacts || []).some((fact) => fact.key.includes(':topic:rule-')),
  );
  assert.equal(hasRuleFact, true);
});

test('黄历择日：喜神与忌神同日出现时应分别保留，不得用喜神覆盖限制', () => {
  const result = generateAlmanacSelection({
    topic: 'marriage',
    startDate: '2025-01-21',
    endDate: '2025-01-21',
  });
  const day = result.days[0];
  const supportFact = day.topicMatchFacts?.find((fact) =>
    fact.key.endsWith(':topic:rule-gods-support'),
  );
  const constraintFact = day.topicMatchFacts?.find((fact) =>
    fact.key.endsWith(':topic:rule-gods-constraint'),
  );

  assert.equal(supportFact?.status, '支持');
  assert.deepEqual(supportFact?.matchedItems, ['天德', '月德']);
  assert.equal(constraintFact?.status, '限制');
  assert.deepEqual(constraintFact?.matchedItems, ['劫煞']);
  assert.equal(result.evidenceAnalysis?.candidates[0].status, '慎用候选');
});

test('黄历择日：候选状态应先于内部同级分数决定日期顺序', () => {
  const result = generateAlmanacSelection({
    topic: 'move',
    startDate: '2026-06-01',
    endDate: '2026-06-30',
  });
  const statuses = result.evidenceAnalysis?.candidates.map((candidate) => candidate.status) ?? [];
  const priority = { 可用候选: 0, 条件候选: 1, 慎用候选: 2 } as const;

  assert.ok(statuses.includes('条件候选'));
  assert.ok(statuses.includes('慎用候选'));
  assert.deepEqual(
    statuses.map((status) => priority[status]),
    statuses.map((status) => priority[status]).sort((left, right) => left - right),
  );
  assert.notEqual(statuses[0], '慎用候选');
});

test('黄历择日：参与人适配证据字段应完整生成', () => {
  const result = generateAlmanacSelection({
    topic: 'marriage',
    startDate: '2025-06-01',
    endDate: '2025-06-03',
    participants: [
      {
        id: 'p1',
        name: '测试甲',
        gender: '男',
        year: '1990',
        month: '5',
        day: '12',
        timeIndex: '5',
        dateType: 'solar',
      },
    ],
  });

  assert.equal(result.participants.length, 1);
  assert.ok(result.days.every((day) => Array.isArray(day.participantRelationFacts)));
});
