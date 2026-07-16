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
