import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateXuanKong,
  flyStars,
  resolveXuanKongPeriod,
} from '../packages/core/src/xuan_kong/index.ts';
import { TWENTY_FOUR_MOUNTAINS } from '../packages/core/src/direction/index.ts';

const NINE_STARS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const REFERENCE_REPLACEMENT_STARS: Record<string, number> = {
  子: 1,
  癸: 1,
  甲: 1,
  申: 1,
  壬: 2,
  卯: 2,
  乙: 2,
  未: 2,
  坤: 2,
  乾: 6,
  亥: 6,
  辰: 6,
  巽: 6,
  巳: 6,
  戌: 6,
  酉: 7,
  辛: 7,
  丑: 7,
  艮: 7,
  丙: 7,
  寅: 9,
  午: 9,
  庚: 9,
  丁: 9,
};
const REFERENCE_STAR_HOME_MOUNTAINS: Record<number, readonly [string, string, string]> = {
  1: ['壬', '子', '癸'],
  2: ['未', '坤', '申'],
  3: ['甲', '卯', '乙'],
  4: ['辰', '巽', '巳'],
  6: ['戌', '乾', '亥'],
  7: ['庚', '酉', '辛'],
  8: ['丑', '艮', '寅'],
  9: ['丙', '午', '丁'],
};
const REFERENCE_MOUNTAIN_DIRECTIONS: Record<string, '顺飞' | '逆飞'> = {
  壬: '顺飞',
  子: '逆飞',
  癸: '逆飞',
  未: '逆飞',
  坤: '顺飞',
  申: '顺飞',
  甲: '顺飞',
  卯: '逆飞',
  乙: '逆飞',
  辰: '逆飞',
  巽: '顺飞',
  巳: '顺飞',
  戌: '逆飞',
  乾: '顺飞',
  亥: '顺飞',
  庚: '顺飞',
  酉: '逆飞',
  辛: '逆飞',
  丑: '逆飞',
  艮: '顺飞',
  寅: '顺飞',
  丙: '顺飞',
  午: '逆飞',
  丁: '逆飞',
};

function resolveReferenceReplacementLeg(sourceMountain: string, originalCenterStar: number) {
  const homeMountains = Object.values(REFERENCE_STAR_HOME_MOUNTAINS);
  const sourceGroup = homeMountains.find((mountains) =>
    mountains.some((mountain) => mountain === sourceMountain),
  );
  const sourceYuan = sourceGroup?.findIndex((mountain) => mountain === sourceMountain);
  assert.ok(sourceYuan !== undefined && sourceYuan >= 0, `${sourceMountain}应有元龙位置`);
  const referenceMountain =
    originalCenterStar === 5
      ? sourceMountain
      : REFERENCE_STAR_HOME_MOUNTAINS[originalCenterStar]?.[sourceYuan];
  assert.ok(referenceMountain, `${originalCenterStar}星应有同元龙参考山`);
  return {
    originalCenterStar,
    referenceMountain,
    replacementStar: REFERENCE_REPLACEMENT_STARS[referenceMountain],
    direction: REFERENCE_MOUNTAIN_DIRECTIONS[referenceMountain],
  };
}

function flyReferenceStars(centerStar: number, direction: '顺飞' | '逆飞') {
  const plate = Array.from({ length: 9 }, () => 0);
  const loShuPalacePath = [5, 6, 7, 8, 9, 1, 2, 3, 4];
  loShuPalacePath.forEach((palace, step) => {
    const delta = direction === '顺飞' ? step : -step;
    plate[palace - 1] = ((centerStar - 1 + delta + 81) % 9) + 1;
  });
  return plate;
}

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
});

test('玄空飞星拒绝缺年和不相对坐向，并按兼向边界切换替卦', () => {
  assert.throws(
    () => generateXuanKong({ sitMountain: '子' } as Parameters<typeof generateXuanKong>[0]),
    /year 必须是/,
  );
  assert.throws(
    () => generateXuanKong({ year: 2024, sitMountain: '子', facingMountain: '卯' }),
    /坐向必须严格相对/,
  );
  assert.equal(generateXuanKong({ year: 2024, sitDegree: 7 }).guaType, '替卦');
  assert.equal(generateXuanKong({ year: 2024, sitDegree: 4.5 }).guaType, '替卦');
  assert.doesNotThrow(() => generateXuanKong({ year: 2024, sitDegree: 4.49 }));
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

test('玄空九运子山替卦应逐项记录五黄借山与同元龙替星', () => {
  const result = generateXuanKong({ year: 2024, sitMountain: '子', guaType: '替卦' });

  assert.equal(result.guaType, '替卦');
  assert.equal(result.replacementApplied, true);
  assert.deepEqual(result.replacement?.mountain, {
    originalCenterStar: 5,
    referenceMountain: '子',
    replacementStar: 1,
    direction: '逆飞',
  });
  assert.deepEqual(result.replacement?.facing, {
    originalCenterStar: 4,
    referenceMountain: '巽',
    replacementStar: 6,
    direction: '顺飞',
  });
  assert.deepEqual(result.plates.shan, [5, 4, 3, 2, 1, 9, 8, 7, 6]);
  assert.deepEqual(result.plates.xiang, [2, 3, 4, 5, 6, 7, 8, 9, 1]);
  assert.match(result.replacement?.sourceUrl ?? '', /bd7d85ea1af4be41cacab6e35a5e07023e469be9/);
  assert.match(
    result.replacement?.verificationSourceUrl ?? '',
    /324623c5460b035d537a8ff2da6b6567f9b85e9e/,
  );
  assert.match(result.evidenceAnalysis.promptText, /五黄|子山替为1逆飞|巽山替为6顺飞/);
});

test('玄空八运子山替卦应按入中星本宫同元龙取巽卯替星', () => {
  const result = generateXuanKong({ year: 2008, sitMountain: '子', guaType: '替卦' });

  assert.deepEqual(result.replacement?.mountain, {
    originalCenterStar: 4,
    referenceMountain: '巽',
    replacementStar: 6,
    direction: '顺飞',
  });
  assert.deepEqual(result.replacement?.facing, {
    originalCenterStar: 3,
    referenceMountain: '卯',
    replacementStar: 2,
    direction: '逆飞',
  });
  assert.equal(result.plates.shan[4], 6);
  assert.equal(result.plates.xiang[4], 2);
});

test('玄空替卦未成四正局时不得借用其他局型生成组合', () => {
  for (let yun = 1; yun <= 9; yun += 1) {
    const year = 1864 + (yun - 1) * 20;
    for (const sitMountain of TWENTY_FOUR_MOUNTAINS) {
      const result = generateXuanKong({ year, sitMountain, guaType: '替卦' });
      if (result.formation !== '替卦未成四正局') continue;
      assert.deepEqual(result.combinations, []);
      assert.match(result.evidenceAnalysis.promptText, /组合检测已保守跳过/);
    }
  }
});

test('测量误差跨边界时标记山向边界敏感', () => {
  const result = generateXuanKong({
    year: 2024,
    sitDegree: 5.5,
    measurementUncertaintyDegrees: 3,
    guaType: '下卦',
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

test('玄空测量误差范围应枚举全部覆盖山向，不得只取左中右三个采样点', () => {
  const result = generateXuanKong({
    year: 2024,
    sitDegree: 0,
    measurementUncertaintyDegrees: 45,
    guaType: '下卦',
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
      assert.equal(result.guaType, '下卦');
      assert.equal(result.replacementApplied, false);
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

test('玄空替卦九运乘二十四山的 216 盘应保持替星来源、三盘和九宫完整', () => {
  for (let yun = 1; yun <= 9; yun += 1) {
    const year = 1864 + (yun - 1) * 20;

    for (const sitMountain of TWENTY_FOUR_MOUNTAINS) {
      const result = generateXuanKong({ year, sitMountain, guaType: '替卦' });
      assert.equal(result.guaType, '替卦');
      assert.equal(result.replacementApplied, true);
      assert.ok(result.replacement);
      assert.match(result.replacement.sourceUrl, /bd7d85ea/);
      assert.match(result.replacement.verificationSourceUrl, /324623c/);
      assert.deepEqual(
        result.replacement.mountain,
        resolveReferenceReplacementLeg(
          result.sitMountain,
          result.replacement.mountain.originalCenterStar,
        ),
      );
      assert.deepEqual(
        result.replacement.facing,
        resolveReferenceReplacementLeg(
          result.facingMountain,
          result.replacement.facing.originalCenterStar,
        ),
      );
      assert.deepEqual(
        result.plates.shan,
        flyReferenceStars(
          result.replacement.mountain.replacementStar,
          result.replacement.mountain.direction,
        ),
      );
      assert.deepEqual(
        result.plates.xiang,
        flyReferenceStars(
          result.replacement.facing.replacementStar,
          result.replacement.facing.direction,
        ),
      );
      assert.deepEqual([...result.plates.yun].sort(), NINE_STARS);
      assert.deepEqual([...result.plates.shan].sort(), NINE_STARS);
      assert.deepEqual([...result.plates.xiang].sort(), NINE_STARS);
      assert.equal(result.palaces.length, 9);
      assert.ok([1, 2, 6, 7, 9].includes(result.replacement.mountain.replacementStar));
      assert.ok([1, 2, 6, 7, 9].includes(result.replacement.facing.replacementStar));
    }
  }
});
