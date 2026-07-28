import test from 'node:test';
import assert from 'node:assert/strict';
import { generateQizheng } from '../packages/core/src/qi_zheng/index.ts';

test('七政真太阳时只校正传统命身宫，天体位置保持同一时刻', () => {
  const input = {
    year: 1990,
    month: 5,
    day: 12,
    hour: 8,
    minute: 30,
    latitude: 31.2,
    longitude: 121.5,
    timezone: 8,
  } as const;
  const civil = generateQizheng(input);
  const trueSolar = generateQizheng({ ...input, useTrueSolarTime: true });

  assert.equal(trueSolar.calculationContext.palaceTimeMode, '真太阳时混合口径');
  assert.match(trueSolar.calculationContext.palaceTimeNote ?? '', /真太阳时校正/);
  assert.deepEqual(
    trueSolar.stars.map((star) => [star.name, star.longitude, star.xiu]),
    civil.stars.map((star) => [star.name, star.longitude, star.xiu]),
  );
});
