import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { SolarDay } from 'tyme4ts';
import { generateAlmanacSelection } from '../packages/core/src/divination/algorithms/almanac.ts';

function findAlmanacAvoidDate(keyword: string, scope: 'day' | 'hour'): string {
  for (let utc = Date.UTC(2025, 0, 1); utc < Date.UTC(2027, 0, 1); utc += 86400000) {
    const date = new Date(utc);
    const lunarDay = SolarDay.fromYmd(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      date.getUTCDate(),
    ).getLunarDay();
    const matches =
      scope === 'day'
        ? lunarDay.getAvoids().some((item) => item.getName().includes(keyword))
        : lunarDay
            .getHours()
            .some((hour) => hour.getAvoids().some((item) => item.getName().includes(keyword)));
    if (matches) return date.toISOString().slice(0, 10);
  }
  throw new Error(`历法资料缺少${scope === 'day' ? '日' : '时'}忌${keyword}样本`);
}

test('黄历择日：无四离等明确事项规则时只映射历法库原始宜忌', () => {
  const result = generateAlmanacSelection({
    topic: 'marriage',
    startDate: '2025-06-01',
    endDate: '2025-06-07',
  });

  assert.ok(result.days.length > 0);
  assert.ok(result.days.every((day) => !day.gods.includes('四离')));
  assert.ok(
    result.days.every(
      (day) =>
        day.topicMatchFacts?.some((fact) => fact.key.endsWith(':day-recommends')) &&
        day.topicMatchFacts.some((fact) => fact.key.endsWith(':day-avoids')) &&
        day.topicMatchFacts.every(
          (fact) =>
            !fact.key.includes(':topic:rule-') &&
            (fact.sourceType === '原始宜项' || fact.sourceType === '原始忌项') &&
            fact.matchedItems.every((item) => fact.inputItems.includes(item)) &&
            (!fact.key.endsWith(':day-general-constraint') ||
              (fact.status === '限制' &&
                fact.matchedItems.some((item) => /诸事不宜|[余馀]事勿取/u.test(item)))),
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

test('安葬和修造的原始忌项同时约束候选日与具体时辰', () => {
  for (const { topic, keyword } of [
    { topic: 'burial', keyword: '入殓' },
    { topic: 'renovation', keyword: '盖屋' },
  ] as const) {
    const dayDate = findAlmanacAvoidDate(keyword, 'day');
    const dayResult = generateAlmanacSelection({ topic, startDate: dayDate, endDate: dayDate });
    const day = dayResult.days[0];
    assert.ok(day.avoids.some((item) => item.includes(keyword)));
    assert.ok(
      day.topicMatchFacts?.some(
        (fact) =>
          fact.sourceType === '原始忌项' &&
          fact.matchedItems.some((item) => item.includes(keyword)),
      ),
    );
    assert.equal(dayResult.evidenceAnalysis?.candidates[0].status, '慎用候选');

    const hourDate = findAlmanacAvoidDate(keyword, 'hour');
    const hourResult = generateAlmanacSelection({ topic, startDate: hourDate, endDate: hourDate });
    const hourDay = hourResult.days[0];
    const forbidden = hourDay.hours?.filter((hour) =>
      hour.avoids?.some((item) => item.includes(keyword)),
    );
    assert.ok(forbidden?.length);
    for (const hour of forbidden) {
      assert.ok(
        hour.topicMatchFacts?.some(
          (fact) =>
            fact.sourceType === '原始忌项' &&
            fact.matchedItems.some((item) => item.includes(keyword)),
        ),
      );
      assert.ok(
        !hourResult.evidenceAnalysis?.candidates[0].usableHours.some(
          (candidate) => candidate.name === hour.name,
        ),
      );
    }
  }
});
