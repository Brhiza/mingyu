import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { generateAlmanacSelection } from '../packages/core/src/divination/algorithms/almanac.ts';

test('黄历择日：事项匹配只映射 tyme4ts 原始宜忌，不生成本地硬规则事实', () => {
  const result = generateAlmanacSelection({
    topic: 'marriage',
    startDate: '2025-06-01',
    endDate: '2025-06-07',
  });

  assert.ok(result.days.length > 0);
  assert.ok(
    result.days.every(
      (day) =>
        day.topicMatchFacts?.length === 2 &&
        day.topicMatchFacts.every(
          (fact) =>
            !fact.key.includes(':topic:rule-') &&
            (fact.sourceType === '原始宜项' || fact.sourceType === '原始忌项'),
        ),
    ),
  );
});

test('黄历择日：神煞吉凶直接采用 tyme4ts 原生属性并分别保留', () => {
  const result = generateAlmanacSelection({
    topic: 'marriage',
    startDate: '2025-01-21',
    endDate: '2025-01-21',
  });
  const facts = result.days[0].godFacts ?? [];

  assert.equal(facts.find((fact) => fact.name === '天德')?.classification, '吉神');
  assert.equal(facts.find((fact) => fact.name === '月德')?.classification, '吉神');
  assert.equal(facts.find((fact) => fact.name === '劫煞')?.classification, '凶神');
  assert.ok(facts.every((fact) => fact.sources.includes('tyme4ts God.getLuck() 原生吉凶属性')));
});

test('黄历择日：候选先按状态、再按明确宜项数量和日期稳定排序', () => {
  const result = generateAlmanacSelection({
    topic: 'move',
    startDate: '2026-06-01',
    endDate: '2026-06-30',
  });
  const statuses = result.evidenceAnalysis?.candidates.map((candidate) => candidate.status) ?? [];
  const priority = { 可用候选: 0, 条件候选: 1, 慎用候选: 2 } as const;

  assert.ok(statuses.includes('可用候选'));
  assert.ok(statuses.includes('慎用候选'));
  assert.deepEqual(
    statuses.map((status) => priority[status]),
    statuses.map((status) => priority[status]).sort((left, right) => left - right),
  );
  assert.notEqual(statuses[0], '慎用候选');
  for (let index = 1; index < result.days.length; index += 1) {
    const previous = result.days[index - 1];
    const current = result.days[index];
    const previousStatus = result.evidenceAnalysis?.candidates[index - 1]?.status;
    const currentStatus = result.evidenceAnalysis?.candidates[index]?.status;
    if (previousStatus !== currentStatus) continue;
    const previousSupports =
      previous.topicMatchFacts?.filter((fact) => fact.status === '支持').length ?? 0;
    const currentSupports =
      current.topicMatchFacts?.filter((fact) => fact.status === '支持').length ?? 0;
    assert.ok(
      previousSupports > currentSupports ||
        (previousSupports === currentSupports && previous.date < current.date),
    );
  }
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
