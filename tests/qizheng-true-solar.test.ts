import test from 'node:test';
import assert from 'node:assert/strict';
import { generateQizheng } from '../packages/core/src/qi_zheng/index.ts';

test('七政可选真太阳时只影响传统宫位口径', () => {
  const base = {
    year: 1990,
    month: 5,
    day: 12,
    hour: 8,
    minute: 30,
    latitude: 31.2,
    longitude: 121.5,
    timezone: 8,
  };
  const normal = generateQizheng(base);
  const trueSolar = generateQizheng({ ...base, useTrueSolarTime: true });
  assert.equal(normal.calculationContext.palaceTimeMode, '民用时间');
  assert.equal(trueSolar.calculationContext.palaceTimeMode, '真太阳时混合口径');
  assert.match(trueSolar.prompt, /真太阳时|混合|现代星历/);
  assert.ok(trueSolar.stars.length >= 11);
});
