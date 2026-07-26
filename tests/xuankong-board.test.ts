import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateXuanKong,
  flyStars,
  resolveXuanKongPeriod,
} from '../packages/core/src/xuan_kong/index.ts';

test('三元九运：2024 应落入下元九运区间附近可复现运表', () => {
  const period = resolveXuanKongPeriod(2024);
  assert.equal(period.yunStar, period.yun);
  assert.ok(period.startYear <= 2024 && period.endYear >= 2024);
  assert.match(period.label, /运/);
});

test('飞星入中：方向由调用方明确提供，不再按星数奇偶猜测', () => {
  const oneForward = flyStars(1, '顺飞');
  const oneReverse = flyStars(1, '逆飞');
  const twoForward = flyStars(2, '顺飞');
  const twoReverse = flyStars(2, '逆飞');
  assert.equal(oneForward[4], 1);
  assert.equal(oneReverse[4], 1);
  assert.equal(twoForward[4], 2);
  assert.equal(twoReverse[4], 2);
  assert.notDeepEqual(oneForward, oneReverse);
  assert.notDeepEqual(twoForward, twoReverse);
});

test('玄空飞星使用元龙阴阳下卦引擎生成金标盘、局型与组合', () => {
  const result = generateXuanKong({ year: 2008, sitMountain: '子' });
  assert.equal(result.sitMountain, '子');
  assert.equal(result.facingMountain, '午');
  assert.equal(result.plates.yun.length, 9);
  assert.equal(result.plates.shan.length, 9);
  assert.equal(result.plates.xiang.length, 9);
  assert.equal(result.palaces.length, 9);
  assert.equal(result.formation, '双星到向');
  assert.ok(result.combinations.some((item) => item.name === '七星真打劫'));
  assert.deepEqual(result.engine, {
    name: '@soul-atelier/xuankong',
    version: '0.2.1',
    mode: '下卦',
  });
  assert.ok(result.prompt.includes('玄空飞星'));
  assert.equal(result.evidenceAnalysis.key, 'xuankong:evidence');
  assert.match(result.evidenceAnalysis.promptText, /元龙阴阳|双星到向|七星真打劫/);
});

test('玄空飞星拒绝缺年、不相对坐向和尚未实现的替卦', () => {
  assert.throws(
    () => generateXuanKong({ sitMountain: '子' } as Parameters<typeof generateXuanKong>[0]),
    /year 必须是/,
  );
  assert.throws(
    () => generateXuanKong({ year: 2024, sitMountain: '子', facingMountain: '卯' }),
    /坐向必须严格相对/,
  );
  assert.throws(
    () => generateXuanKong({ year: 2024, sitMountain: '子', guaType: '替卦' }),
    /当前只支持下卦/,
  );
  assert.throws(() => generateXuanKong({ year: 2024, sitDegree: 7 }), /触发兼向替卦条件/);
  assert.throws(
    () =>
      generateXuanKong({
        year: 2024,
        sitDegree: 0,
        measurementUncertaintyDegrees: Number.NaN,
      }),
    /measurementUncertaintyDegrees/,
  );

  const explicit = generateXuanKong({ year: 2024, sitDegree: 7, guaType: '下卦' });
  assert.equal(explicit.guaType, '下卦');
  assert.equal(explicit.replacementApplied, false);
});

test('测量误差跨边界时标记山向边界敏感', () => {
  const result = generateXuanKong({
    year: 2024,
    sitDegree: 5.5,
    measurementUncertaintyDegrees: 3,
  });
  assert.ok(result.measurement);
  assert.equal(result.measurement?.stability, '山向边界敏感');
});

test('玄空边界敏感时应输出候选山向', () => {
  const result = generateXuanKong({
    year: 2024,
    sitDegree: 7.5,
    measurementUncertaintyDegrees: 1,
    guaType: '下卦',
  });
  assert.equal(result.measurement?.stability, '山向边界敏感');
  assert.ok((result.measurement?.candidateMountains?.length ?? 0) >= 1);
  assert.match(result.prompt, /候选/);
});
