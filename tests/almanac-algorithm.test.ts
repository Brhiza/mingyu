import test from 'node:test';
import assert from 'node:assert/strict';

import { generateAlmanacSelection } from '../packages/core/src/divination/algorithms/almanac.ts';

test('黄历择日：tyme4ts 返回九星短名时也应补出九星详情', () => {
  const result = generateAlmanacSelection({
    topic: 'move',
    startDate: '2026-06-01',
    endDate: '2026-06-05',
  });

  assert.ok(result.days.length > 0);
  for (const day of result.days) {
    assert.ok(day.nineStar, `${day.date} 应有九星名称`);
    assert.ok(day.nineStarDetail, `${day.date} 的九星 ${day.nineStar} 应有详情`);
    assert.match(day.nineStarDetail.meaning, new RegExp(`^${day.nineStar}`));
  }
});

test('黄历择日：同一吉神不应因配置重复而重复加分和重复输出', () => {
  const result = generateAlmanacSelection({
    topic: 'move',
    startDate: '2026-06-01',
    endDate: '2026-06-01',
  });
  const day = result.days[0];

  assert.ok(day.gods.includes('天德合'));
  assert.doesNotMatch(day.highlights.join('；'), /天德合、天德合/);
});
