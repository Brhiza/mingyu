import assert from 'node:assert/strict';
import test from 'node:test';
import { generateQimen } from '../packages/core/src/divination/algorithms/qimen/index.ts';
import { TimeManager } from '../packages/core/src/calendar/timeManager.ts';

const BEFORE_RAIN_WATER = new Date('2024-02-19T12:13:11+08:00');
const RAIN_WATER_INSTANT = new Date('2024-02-19T12:13:12+08:00');
const BEFORE_SPRING_EQUINOX = new Date('2024-03-20T11:06:24+08:00');
const SPRING_EQUINOX_INSTANT = new Date('2024-03-20T11:06:25+08:00');

test('仅传 IANA 时区时，交节瞬时点与当地日时柱按同一时区计算', () => {
  const instant = SPRING_EQUINOX_INSTANT;
  const iana = generateQimen(instant, 'zhuanpan', 'hour', 'chaibu', undefined, 'America/New_York');
  const explicit = generateQimen(instant, 'zhuanpan', 'hour', 'chaibu', -240);

  assert.equal(iana.timeInfo.solarTerm, '春分');
  assert.equal(iana.ganzhi.day, explicit.ganzhi.day);
  assert.equal(iana.ganzhi.hour, explicit.ganzhi.hour);
  assert.equal(iana.timeInfo.epoch, explicit.timeInfo.epoch);
  assert.equal(iana.juShu, explicit.juShu);
  assert.equal(iana.isYangDun, explicit.isYangDun);
  assert.deepEqual(iana.seasonality?.jieQiPhase, explicit.seasonality?.jieQiPhase);
});

test('奇门沿用全局 UTC−5 时区时仍在春分真实瞬时点换节与换局', () => {
  TimeManager.setTimezoneOffsetMinutesOverride(-300);
  try {
    const before = generateQimen(BEFORE_SPRING_EQUINOX);
    const at = generateQimen(SPRING_EQUINOX_INSTANT);
    const explicit = generateQimen(SPRING_EQUINOX_INSTANT, 'zhuanpan', 'hour', 'chaibu', -300);

    assert.equal(before.timeInfo.solarTerm, '惊蛰');
    assert.equal(before.seasonality?.currentJieQi, '惊蛰');
    assert.equal(before.juShu, 1);
    assert.equal(at.timeInfo.solarTerm, '春分');
    assert.equal(at.seasonality?.currentJieQi, '春分');
    assert.equal(at.juShu, 3);
    assert.equal(at.timeInfo.chaoShenOrJieQi, '超神');
    assert.deepEqual(at.seasonality?.jieQiPhase, explicit.seasonality?.jieQiPhase);
    assert.deepEqual(
      { timeInfo: at.timeInfo, juShu: at.juShu, ganzhi: at.ganzhi },
      { timeInfo: explicit.timeInfo, juShu: explicit.juShu, ganzhi: explicit.ganzhi },
    );
  } finally {
    TimeManager.setTimezoneOffsetMinutesOverride(480);
  }
});

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
