import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { generateAlmanacSelection } from '../packages/core/src/divination/algorithms/almanac.ts';

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

test('四立节气前一日按四绝事项规则进入慎用候选，原始宜项保持原值', () => {
  for (const [date, term] of [
    ['2025-02-02', '立春'],
    ['2025-05-04', '立夏'],
    ['2025-08-06', '立秋'],
    ['2025-11-06', '立冬'],
  ]) {
    const result = generateAlmanacSelection({
      topic: 'marriage',
      startDate: date,
      endDate: date,
    });
    const day = result.days[0];
    const fact = day.topicMatchFacts?.find((item) => item.key.endsWith(':rule-four-terminations'));
    const candidate = result.evidenceAnalysis?.candidates[0];
    assert.ok(fact, date);
    assert.equal(fact.status, '限制');
    assert.ok(fact.inputItems.includes(`${term}前一日`));
    assert.equal(candidate?.status, '慎用候选');
    assert.ok(candidate?.decisionFact.limitingFactKeys.includes(fact.key));
    assert.ok(result.evidenceAnalysis?.promptText.includes(fact.promptText));
    if (date === '2025-11-06') {
      assert.ok(day.recommends.includes('嫁娶'));
      assert.ok(!day.gods.includes('四绝'));
    }
  }

  for (const [topic, date] of [
    ['marriage', '2025-11-07'],
    ['custom', '2025-11-06'],
  ] as const) {
    const result = generateAlmanacSelection({ topic, startDate: date, endDate: date });
    assert.ok(
      !result.days[0].topicMatchFacts?.some((item) => item.key.endsWith(':rule-four-terminations')),
    );
  }
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

test('安葬和修造的原始忌项同时约束候选日与具体时辰', () => {
  for (const { topic, date, keyword, forbiddenHours } of [
    {
      topic: 'burial',
      date: '2025-01-06',
      keyword: '入殓',
      forbiddenHours: [
        { name: '早子时', range: '00:00-01:00', ganzhi: '丙子' },
        { name: '戌时', range: '19:00-21:00', ganzhi: '丙戌' },
      ],
    },
    {
      topic: 'renovation',
      date: '2025-01-05',
      keyword: '盖屋',
      forbiddenHours: [
        { name: '寅时', range: '03:00-05:00', ganzhi: '丙寅' },
        { name: '晚子时', range: '23:00-24:00', ganzhi: '丙子' },
      ],
    },
  ] as const) {
    const result = generateAlmanacSelection({ topic, startDate: date, endDate: date });
    assert.equal(result.days.length, 1);
    const day = result.days[0];
    assert.equal(day.date, date);
    assert.ok(day.avoids.includes(keyword));
    assert.ok(
      day.topicMatchFacts?.some(
        (fact) =>
          fact.status === '限制' &&
          fact.sourceType === '原始忌项' &&
          fact.matchedItems.includes(keyword),
      ),
    );
    const candidate = result.evidenceAnalysis?.candidates[0];
    assert.ok(candidate);
    assert.equal(candidate.status, '慎用候选');

    for (const expected of forbiddenHours) {
      const hour = day.hours?.find((item) => item.name === expected.name);
      assert.ok(hour);
      assert.equal(hour.range, expected.range);
      assert.equal(hour.ganzhi, expected.ganzhi);
      assert.ok(hour.avoids?.includes(keyword));
      assert.ok(
        hour.topicMatchFacts?.some(
          (fact) =>
            fact.status === '限制' &&
            fact.sourceType === '原始忌项' &&
            fact.matchedItems.includes(keyword),
        ),
      );
      assert.ok(!candidate.usableHours.some((usable) => usable.name === expected.name));
    }
  }
});
