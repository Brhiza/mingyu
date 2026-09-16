import assert from 'node:assert/strict';
import test from 'node:test';
import { generateQimen } from '../packages/core/src/divination/algorithms/qimen/index.ts';

const BEFORE_RAIN_WATER = new Date('2024-02-19T12:13:11+08:00');
const RAIN_WATER_INSTANT = new Date('2024-02-19T12:13:12+08:00');
const BEFORE_SPRING_EQUINOX = new Date('2024-03-20T11:06:24+08:00');
const SPRING_EQUINOX_INSTANT = new Date('2024-03-20T11:06:25+08:00');

test('奇门默认与显式东八区在雨水整秒边界保持定局一致', () => {
  for (const scope of ['hour', 'day'] as const) {
    for (const juMethod of ['chaibu', 'zhirun'] as const) {
      const before = generateQimen(BEFORE_RAIN_WATER, 'zhuanpan', scope, juMethod);
      const defaultAtBoundary = generateQimen(RAIN_WATER_INSTANT, 'zhuanpan', scope, juMethod);
      const explicitAtBoundary = generateQimen(
        RAIN_WATER_INSTANT,
        'zhuanpan',
        scope,
        juMethod,
        480,
      );

      assert.equal(before.timeInfo.solarTerm, '立春');
      assert.equal(defaultAtBoundary.timeInfo.solarTerm, '雨水');
      assert.equal(defaultAtBoundary.seasonality?.currentJieQi, '雨水');
      assert.deepEqual(
        {
          solarTerm: defaultAtBoundary.timeInfo.solarTerm,
          juTerm: defaultAtBoundary.timeInfo.juTerm,
          epoch: defaultAtBoundary.timeInfo.epoch,
          juShu: defaultAtBoundary.juShu,
          isYangDun: defaultAtBoundary.isYangDun,
        },
        {
          solarTerm: explicitAtBoundary.timeInfo.solarTerm,
          juTerm: explicitAtBoundary.timeInfo.juTerm,
          epoch: explicitAtBoundary.timeInfo.epoch,
          juShu: explicitAtBoundary.juShu,
          isYangDun: explicitAtBoundary.isYangDun,
        },
      );

      if (juMethod === 'chaibu') {
        assert.equal(defaultAtBoundary.timeInfo.juTerm, '雨水');
        assert.equal(defaultAtBoundary.juShu, 9);
      }
    }
  }
});

test('奇门默认与显式东八区在春分整秒边界保持节气与季令一致', () => {
  const beforeDefault = generateQimen(BEFORE_SPRING_EQUINOX);
  const atDefault = generateQimen(SPRING_EQUINOX_INSTANT);
  const beforeExplicit = generateQimen(BEFORE_SPRING_EQUINOX, 'zhuanpan', 'hour', 'chaibu', 480);
  const atExplicit = generateQimen(SPRING_EQUINOX_INSTANT, 'zhuanpan', 'hour', 'chaibu', 480);

  assert.equal(beforeDefault.timeInfo.solarTerm, '惊蛰');
  assert.equal(beforeDefault.seasonality?.currentJieQi, '惊蛰');
  assert.equal(atDefault.timeInfo.solarTerm, '春分');
  assert.equal(atDefault.seasonality?.currentJieQi, '春分');
  assert.deepEqual(
    {
      solarTerm: beforeDefault.timeInfo.solarTerm,
      currentJieQi: beforeDefault.seasonality?.currentJieQi,
    },
    {
      solarTerm: beforeExplicit.timeInfo.solarTerm,
      currentJieQi: beforeExplicit.seasonality?.currentJieQi,
    },
  );
  assert.deepEqual(
    {
      solarTerm: atDefault.timeInfo.solarTerm,
      currentJieQi: atDefault.seasonality?.currentJieQi,
    },
    {
      solarTerm: atExplicit.timeInfo.solarTerm,
      currentJieQi: atExplicit.seasonality?.currentJieQi,
    },
  );
});
