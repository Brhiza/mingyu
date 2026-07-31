import test from 'node:test';
import assert from 'node:assert/strict';
import { generateQizheng } from '../packages/core/src/qi_zheng/index.ts';

test('七政真太阳时只改变命宫所用时辰与年界，身宫和天体位置保持同一时刻', () => {
  const input = {
    year: 1990,
    month: 1,
    day: 1,
    hour: 1,
    minute: 15,
    latitude: 30,
    longitude: 105,
    timezone: 8,
  } as const;
  const civil = generateQizheng(input);
  const trueSolar = generateQizheng({ ...input, useTrueSolarTime: true });

  assert.equal(trueSolar.calculationContext.palaceTimeMode, '真太阳时混合口径');
  assert.match(
    trueSolar.calculationContext.palaceTimeNote ?? '',
    /命宫所用生时.*真太阳时校正.*身宫直接取太阴所在宫/,
  );
  assert.notEqual(trueSolar.mingGong, civil.mingGong);
  assert.equal(trueSolar.shenGong, civil.shenGong);
  assert.deepEqual(
    trueSolar.stars.map((star) => [star.name, star.longitude, star.xiu]),
    civil.stars.map((star) => [star.name, star.longitude, star.xiu]),
  );
  assert.doesNotMatch(trueSolar.prompt, /真太阳时校正传统命身|身宫已按真太阳时校正/);
});
