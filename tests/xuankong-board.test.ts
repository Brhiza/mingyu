import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateXuanKong,
  flyStars,
  resolveXuanKongPeriod,
} from '../packages/core/src/xuan_kong/index.ts';
import { TWENTY_FOUR_MOUNTAINS } from '../packages/core/src/direction/index.ts';

const NINE_STARS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

test('三元九运：2024 应落入下元九运区间附近可复现运表', () => {
  const period = resolveXuanKongPeriod(2024);
  assert.deepEqual(period, {
    year: 2024,
    yuan: '下元',
    yun: 9,
    yunStar: 9,
    startYear: 2024,
    endYear: 2043,
    label: '下元9运（2024-2043）',
  });
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
  assert.equal('guaType' in result, false);
  assert.equal('replacementApplied' in result, false);
  assert.equal('replacementReason' in result, false);
});

test('玄空飞星拒绝缺年和不相对坐向，且不再生成替卦分支', () => {
  assert.throws(
    () => generateXuanKong({ sitMountain: '子' } as Parameters<typeof generateXuanKong>[0]),
    /year 必须是/,
  );
  assert.throws(
    () => generateXuanKong({ year: 2024, sitMountain: '子', facingMountain: '卯' }),
    /坐向必须严格相对/,
  );

  const boundaryDegree = generateXuanKong({ year: 2024, sitDegree: 7 });
  assert.equal(boundaryDegree.engine.mode, '下卦');
  assert.equal('guaType' in boundaryDegree, false);
  assert.equal('replacementApplied' in boundaryDegree, false);
  assert.equal('replacementReason' in boundaryDegree, false);

  assert.throws(
    () =>
      generateXuanKong({
        year: 2024,
        sitDegree: 0,
        measurementUncertaintyDegrees: Number.NaN,
      }),
    /measurementUncertaintyDegrees/,
  );
});

test('测量误差跨边界时标记山向边界敏感，仍使用下卦', () => {
  const result = generateXuanKong({
    year: 2024,
    sitDegree: 5.5,
    measurementUncertaintyDegrees: 3,
  });
  assert.ok(result.measurement);
  assert.equal(result.measurement?.stability, '山向边界敏感');
  assert.equal(result.engine.mode, '下卦');
});

test('玄空边界敏感时应输出候选山向', () => {
  const result = generateXuanKong({
    year: 2024,
    sitDegree: 7.5,
    measurementUncertaintyDegrees: 1,
  });
  assert.equal(result.measurement?.stability, '山向边界敏感');
  assert.ok((result.measurement?.candidateMountains?.length ?? 0) >= 1);
  assert.match(result.prompt, /候选/);
});

test('玄空测量误差范围应枚举全部覆盖山向，不得只取左中右三个采样点', () => {
  const result = generateXuanKong({
    year: 2024,
    sitDegree: 0,
    measurementUncertaintyDegrees: 45,
  });

  assert.deepEqual(
    result.measurement?.candidateMountains?.map((item) => item.sitMountain),
    ['子', '癸', '丑', '艮', '乾', '亥', '壬'],
  );
  assert.ok(
    result.measurement?.candidateMountains?.every(
      (item) =>
        TWENTY_FOUR_MOUNTAINS.indexOf(item.facingMountain) ===
        (TWENTY_FOUR_MOUNTAINS.indexOf(item.sitMountain) + 12) % 24,
    ),
  );
});

test('玄空九运乘二十四山的 216 盘应保持三盘、九宫和坐向完整', () => {
  for (let yun = 1; yun <= 9; yun += 1) {
    const year = 1864 + (yun - 1) * 20;

    for (let mountainIndex = 0; mountainIndex < TWENTY_FOUR_MOUNTAINS.length; mountainIndex += 1) {
      const sitMountain = TWENTY_FOUR_MOUNTAINS[mountainIndex];
      const expectedFacing = TWENTY_FOUR_MOUNTAINS[(mountainIndex + 12) % 24];
      const result = generateXuanKong({ year, sitMountain });

      assert.equal(result.period.yun, yun);
      assert.equal(result.sitMountain, sitMountain);
      assert.equal(result.facingMountain, expectedFacing);
      assert.equal(result.engine.mode, '下卦');
      assert.deepEqual([...result.plates.yun].sort(), NINE_STARS);
      assert.deepEqual([...result.plates.shan].sort(), NINE_STARS);
      assert.deepEqual([...result.plates.xiang].sort(), NINE_STARS);
      assert.deepEqual(result.palaces.map((palace) => palace.gong).sort(), NINE_STARS);

      for (const palace of result.palaces) {
        assert.equal(palace.yunStar, result.plates.yun[palace.gong - 1]);
        assert.equal(palace.shanStar, result.plates.shan[palace.gong - 1]);
        assert.equal(palace.xiangStar, result.plates.xiang[palace.gong - 1]);
      }
      assert.ok(
        result.combinations.every((item) =>
          (item.palaces || []).every((gong) => NINE_STARS.includes(gong)),
        ),
      );
      assert.equal(result.evidenceAnalysis.key, 'xuankong:evidence');
    }
  }
});
