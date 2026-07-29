import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  analyzeLiuyaoLineStrength,
  analyzeLiuyaoSanxingFormations,
  generateLiuyao,
  getLiuyaoChangeDirection,
  getLiuyaoChangeRelation,
  getLiuyaoChangeRelations,
  getLiuyaoFanFuRelations,
  getLiuyaoFlyingHiddenRelation,
  getLiuyaoGuaShenBranch,
  getLiuyaoHexagramRelation,
  getLiuyaoHexagramRelations,
  getLiuyaoNaJiaTiangan,
  getLiuyaoPalaceStage,
} from 'mingyu-core/divination/liuyao';
import type { LiuyaoYaoDetail } from 'mingyu-core/types';

// 2025-01-01 排盘为丙子月（子月：水旺木相金休土囚火死）、庚午日（日支午）
// 该日期的卦象固定，用于回归月令旺衰、暗动、回头生克冲的字段输出。
const SAMPLE_DATE = new Date('2025-01-01T08:00:00+08:00');
const SHAN_HUO_BI_YAOS = [7, 8, 7, 8, 8, 7] as const;
const XUN_WEI_FENG_YAOS = [8, 7, 7, 8, 7, 7] as const;
const DUI_WEI_ZE_YAOS = [7, 7, 8, 7, 7, 8] as const;
const FENG_SHUI_HUAN_YAOS = [8, 7, 8, 8, 7, 7] as const;
const KAN_WEI_SHUI_YAOS = [8, 7, 8, 8, 7, 8] as const;
const TIAN_FENG_GOU_YAOS = [8, 7, 7, 7, 7, 7] as const;
const TIAN_SHAN_DUN_YAOS = [8, 8, 7, 7, 7, 7] as const;
const LEI_SHUI_JIE_YAOS = [8, 7, 8, 7, 8, 8] as const;

function generateSampleLiuyao(yaos: readonly number[] = SHAN_HUO_BI_YAOS) {
  return generateLiuyao(SAMPLE_DATE, { yaos });
}

function makeYao(
  position: number,
  branch: string,
  wuxing: string,
  overrides: Partial<LiuyaoYaoDetail> = {},
): LiuyaoYaoDetail {
  return {
    position,
    rawValue: 7,
    yaoType: '阳',
    isChanging: false,
    changeType: '静爻',
    sixGod: '青龙',
    sixRelative: '兄弟',
    najiaDizhi: branch,
    wuxing,
    isWorld: false,
    isResponse: false,
    isVoid: false,
    ...overrides,
  };
}

test('六爻：各爻输出月令旺相休囚死状态', () => {
  const data = generateSampleLiuyao();
  const monthBranch = data.ganzhi.month.slice(1);
  assert.equal(monthBranch, '子', '样本日期应为子月');

  for (const yao of data.yaosDetail) {
    assert.ok(yao.seasonState, `第${yao.position}爻应输出 seasonState，实际 ${yao.seasonState}`);
    // 子月水旺，水爻应为"旺"
    if (yao.wuxing === '水') {
      assert.equal(yao.seasonState, '旺', `第${yao.position}爻水在子月应旺`);
    }
    // 子月火死（令克火，水克火），火爻应为"死"
    if (yao.wuxing === '火') {
      assert.equal(yao.seasonState, '死', `第${yao.position}爻火在子月应死`);
    }
    // 子月土囚（土克令水，我克令者囚），土爻应为"囚"
    if (yao.wuxing === '土') {
      assert.equal(yao.seasonState, '囚', `第${yao.position}爻土在子月应囚`);
    }
  }
});

test('六爻：月生日克与月克日生应保留为支持、限制并见', () => {
  const wood = makeYao(1, '卯', '木');
  const monthSupports = analyzeLiuyaoLineStrength(wood, '亥', '酉', [wood]);
  const daySupports = analyzeLiuyaoLineStrength(wood, '申', '子', [wood]);

  assert.ok(monthSupports.calendarSupport.includes('月建生本爻'));
  assert.ok(monthSupports.calendarConstraints.includes('日辰克本爻'));
  assert.equal(monthSupports.status, '支持与限制并见');
  assert.ok(daySupports.calendarConstraints.includes('月建克本爻'));
  assert.ok(daySupports.calendarSupport.includes('日辰生本爻'));
  assert.equal(daySupports.status, '支持与限制并见');
});

test('六爻：休囚动爻仍能克旺相爻，旺相静爻也能生休囚静爻', () => {
  const strongWater = makeYao(1, '亥', '水');
  const weakMovingEarth = makeYao(2, '辰', '土', {
    rawValue: 9,
    isChanging: true,
    changeType: '老阳',
  });
  const strongTarget = analyzeLiuyaoLineStrength(strongWater, '子', '卯', [
    strongWater,
    weakMovingEarth,
  ]);
  assert.ok(strongTarget.lineConstraints.includes('第2爻明动克本爻'));

  const weakFire = makeYao(1, '巳', '火');
  const strongStaticWood = makeYao(2, '卯', '木');
  const weakTarget = analyzeLiuyaoLineStrength(weakFire, '子', '辰', [weakFire, strongStaticWood]);
  assert.ok(weakTarget.lineSupport.includes('第2爻旺相静爻生本爻'));
});

test('六爻：变爻只作用本位动爻，且化长生、化墓与基础关系可并见', () => {
  const targetWood = makeYao(1, '卯', '木');
  const movingWater = makeYao(2, '子', '水', {
    rawValue: 9,
    isChanging: true,
    changeType: '老阳',
    changedYao: {
      dizhi: '酉',
      wuxing: '金',
      liuqin: '父母',
      isVoid: false,
    },
  });
  const targetAnalysis = analyzeLiuyaoLineStrength(targetWood, '亥', '辰', [
    targetWood,
    movingWater,
  ]);
  assert.ok(targetAnalysis.lineSupport.includes('第2爻明动生本爻'));
  assert.ok(!targetAnalysis.lineConstraints.some((item) => item.includes('变爻')));

  const growingWood = makeYao(1, '卯', '木', {
    rawValue: 9,
    isChanging: true,
    changeType: '老阳',
    changedYao: {
      dizhi: '亥',
      wuxing: '水',
      liuqin: '父母',
      isVoid: false,
    },
  });
  const growingAnalysis = analyzeLiuyaoLineStrength(growingWood, '寅', '子', [growingWood]);
  assert.deepEqual(growingAnalysis.changeSupport, ['回头生', '化长生']);

  const tombWood = makeYao(1, '卯', '木', {
    rawValue: 9,
    isChanging: true,
    changeType: '老阳',
    changedYao: {
      dizhi: '未',
      wuxing: '土',
      liuqin: '妻财',
      isVoid: false,
    },
  });
  const tombAnalysis = analyzeLiuyaoLineStrength(tombWood, '亥', '子', [tombWood]);
  assert.ok(tombAnalysis.calendarSupport.includes('月建生本爻'));
  assert.deepEqual(tombAnalysis.changeConstraints, ['化耗', '化墓']);
  assert.equal(tombAnalysis.status, '支持与限制并见');
});

test('六爻：变爻受月建冲应重算为化破', () => {
  const movingWater = makeYao(1, '子', '水', {
    rawValue: 9,
    isChanging: true,
    changeType: '老阳',
    changedYao: {
      dizhi: '午',
      wuxing: '火',
      liuqin: '妻财',
      isVoid: false,
    },
  });
  const analysis = analyzeLiuyaoLineStrength(movingWater, '子', '辰', [movingWater]);

  assert.ok(analysis.changeConstraints.includes('化破'));
});

test('六爻：主卦、动变与伏神均应保留完整纳甲干支', () => {
  const data = generateSampleLiuyao([9, 6, 9, 8, 8, 7]);

  assert.equal(data.originalName, '山火贲');
  assert.deepEqual(data.najiaTiangan, ['己', '己', '己', '丙', '丙', '丙']);
  assert.deepEqual(
    data.yaosDetail.map((yao) => `${yao.najiaTiangan}${yao.najiaDizhi}`),
    ['己卯', '己丑', '己亥', '丙戌', '丙子', '丙寅'],
  );
  assert.ok(
    data.yaosDetail
      .filter((yao) => yao.isChanging)
      .every((yao) => yao.changedYao?.tiangan && yao.changedYao.dizhi),
  );
  assert.deepEqual(
    data.hiddenSpirits?.map((item) => ({
      najia: `${item.najiaTiangan}${item.najiaDizhi}`,
      flying: `${item.underYao.najiaTiangan}${item.underYao.najiaDizhi}`,
    })),
    [
      { najia: '丙午', flying: '己丑' },
      { najia: '丙申', flying: '己亥' },
    ],
  );
});

test('六爻：飞伏五行关系应完整区分主客方向', () => {
  assert.equal(getLiuyaoFlyingHiddenRelation('木', '水'), '飞来生伏');
  assert.equal(getLiuyaoFlyingHiddenRelation('水', '土'), '飞来克伏');
  assert.equal(getLiuyaoFlyingHiddenRelation('水', '木'), '伏去生飞');
  assert.equal(getLiuyaoFlyingHiddenRelation('土', '水'), '伏克飞神');
  assert.equal(getLiuyaoFlyingHiddenRelation('金', '金'), '飞伏比和');
  assert.throws(() => getLiuyaoFlyingHiddenRelation('风', '水'), /伏神五行无效/);
});

test('六爻：原典姤遁例应分别识别飞来生伏与飞来克伏', () => {
  const gou = generateSampleLiuyao(TIAN_FENG_GOU_YAOS);
  const dun = generateSampleLiuyao(TIAN_SHAN_DUN_YAOS);
  const gouWealth = gou.hiddenSpirits?.find((item) => item.sixRelative === '妻财');
  const dunChild = dun.hiddenSpirits?.find((item) => item.sixRelative === '子孙');

  assert.equal(gou.originalName, '天风姤');
  assert.equal(gouWealth?.position, 2);
  assert.equal(gouWealth?.najiaDizhi, '寅');
  assert.equal(gouWealth?.underYao.najiaDizhi, '亥');
  assert.equal(gouWealth?.conditionAnalysis?.flyingRelation, '飞来生伏');
  assert.ok(gouWealth?.conditionAnalysis?.support.includes('飞来生伏'));
  assert.ok(gouWealth?.conditionAnalysis?.support.includes('月建生伏神'));
  assert.ok(gouWealth?.conditionAnalysis?.support.includes('伏神月令相'));
  assert.ok(!gouWealth?.conditionAnalysis?.constraints.some((item) => item.includes('飞神克伏')));

  assert.equal(dun.originalName, '天山遁');
  assert.equal(dunChild?.position, 1);
  assert.equal(dunChild?.najiaDizhi, '子');
  assert.equal(dunChild?.underYao.najiaDizhi, '辰');
  assert.equal(dunChild?.conditionAnalysis?.flyingRelation, '飞来克伏');
  assert.ok(dunChild?.conditionAnalysis?.constraints.includes('飞来克伏（月令囚）'));
  assert.ok(dunChild?.conditionAnalysis?.constraints.includes('日辰冲伏神'));
  assert.ok(dunChild?.conditionAnalysis?.support.includes('飞神月令囚'));
});

test('六爻：寅巳申与丑戌未须三支齐备且至少两爻发动', () => {
  const complete = [
    makeYao(1, '寅', '木', { isChanging: true }),
    makeYao(2, '巳', '火', { isChanging: true }),
    makeYao(3, '申', '金'),
    makeYao(4, '丑', '土', { isChanging: true }),
    makeYao(5, '戌', '土', { isChanging: true }),
    makeYao(6, '未', '土'),
  ];
  const incomplete = complete.map((item) =>
    item.position === 6 ? { ...item, najiaDizhi: '酉', wuxing: '金' } : item,
  );
  const staticLines = complete.map((item) => ({ ...item, isChanging: false }));

  assert.deepEqual(
    analyzeLiuyaoSanxingFormations(complete, '子', '辰').map((item) => item.type),
    ['无恩之刑', '恃势之刑'],
  );
  assert.deepEqual(
    analyzeLiuyaoSanxingFormations(incomplete, '子', '辰').map((item) => item.type),
    ['无恩之刑'],
  );
  assert.deepEqual(analyzeLiuyaoSanxingFormations(staticLines, '子', '辰'), []);
});

test('六爻：静态两支互见不得冒充恃势之刑', () => {
  const data = generateSampleLiuyao();

  assert.equal(data.originalName, '山火贲');
  assert.deepEqual(
    data.yaosDetail.map((yao) => yao.najiaDizhi),
    ['卯', '丑', '亥', '戌', '子', '寅'],
  );
  assert.ok(!data.sanxingInYaos?.some((item) => item.type === '恃势之刑'));
});

test('六爻：子卯相刑须至少一爻明动或暗动并回指参与爻', () => {
  const data = generateSampleLiuyao([9, 8, 7, 8, 8, 7]);
  const formation = data.sanxingInYaos?.find((item) => item.pattern === '子卯相刑');

  assert.deepEqual(formation?.branches, ['子', '卯']);
  assert.deepEqual(
    formation?.participants.map((item) => [item.position, item.branch, item.activity]),
    [
      [5, '子', '暗动'],
      [1, '卯', '明动'],
    ],
  );
  assert.deepEqual(formation?.activePositions, [1, 5]);
});

test('六爻：重复自刑须同支两爻且至少一爻发动', () => {
  const staticData = generateSampleLiuyao(LEI_SHUI_JIE_YAOS);
  const movingData = generateSampleLiuyao([8, 7, 6, 7, 8, 8]);
  const formation = movingData.sanxingInYaos?.find((item) => item.pattern === '重复自刑');

  assert.equal(staticData.originalName, '雷水解');
  assert.ok(!staticData.sanxingInYaos?.some((item) => item.pattern === '重复自刑'));
  assert.equal(formation?.type, '自刑');
  assert.deepEqual(formation?.branches, ['午', '午']);
  assert.deepEqual(formation?.activePositions, [3]);
});

test('六爻：日冲原始事实应与暗动、日破互斥分类', () => {
  const strongStatic = generateSampleLiuyao(KAN_WEI_SHUI_YAOS).yaosDetail[5];
  const weakStatic = generateLiuyao(new Date('2025-05-01T08:00:00+08:00'), {
    yaos: KAN_WEI_SHUI_YAOS,
  }).yaosDetail[5];
  const weakMoving = generateLiuyao(new Date('2025-05-01T08:00:00+08:00'), {
    yaos: [8, 7, 8, 8, 7, 6],
  }).yaosDetail[5];

  assert.deepEqual(
    {
      branch: strongStatic.najiaDizhi,
      season: strongStatic.seasonState,
      changing: strongStatic.isChanging,
      dayClash: strongStatic.isDayClash,
      hiddenMove: strongStatic.isHiddenMove,
      dayBreak: strongStatic.isDayBreak,
    },
    {
      branch: '子',
      season: '旺',
      changing: false,
      dayClash: true,
      hiddenMove: true,
      dayBreak: false,
    },
  );
  assert.deepEqual(
    {
      branch: weakStatic.najiaDizhi,
      season: weakStatic.seasonState,
      changing: weakStatic.isChanging,
      dayClash: weakStatic.isDayClash,
      hiddenMove: weakStatic.isHiddenMove,
      dayBreak: weakStatic.isDayBreak,
    },
    {
      branch: '子',
      season: '死',
      changing: false,
      dayClash: true,
      hiddenMove: false,
      dayBreak: true,
    },
  );
  assert.deepEqual(
    {
      branch: weakMoving.najiaDizhi,
      season: weakMoving.seasonState,
      changing: weakMoving.isChanging,
      dayClash: weakMoving.isDayClash,
      hiddenMove: weakMoving.isHiddenMove,
      dayBreak: weakMoving.isDayBreak,
    },
    {
      branch: '子',
      season: '死',
      changing: true,
      dayClash: true,
      hiddenMove: false,
      dayBreak: false,
    },
  );
});

test('六爻：动爻变爻应完整输出回头、化泄、化耗等五行关系', () => {
  const data = generateSampleLiuyao([9, 6, 9, 6, 9, 6]);
  const changingYaos = data.yaosDetail.filter((y) => y.isChanging);

  for (const yao of changingYaos as LiuyaoYaoDetail[]) {
    if (yao.changedYao) {
      assert.ok(
        yao.changeRelation,
        `第${yao.position}爻动变应输出 changeRelation，实际 ${yao.changeRelation}`,
      );
      assert.ok(
        ['回头生', '回头克', '回头冲', '化扶', '化空', '比和', '化泄', '化耗'].includes(
          yao.changeRelation!,
        ),
        `第${yao.position}爻 changeRelation 值非法：${yao.changeRelation}`,
      );
      assert.ok(yao.changeRelations?.length, `第${yao.position}爻应输出完整 changeRelations`);
      assert.ok(
        yao.changeRelations?.includes(yao.changeRelation!),
        `第${yao.position}爻兼容单值应包含在完整关系列表中`,
      );
    }
  }
});

test('六爻：变爻旬空与回头生克等基础动变条件可以并见', () => {
  assert.deepEqual(getLiuyaoChangeRelations('木', '水', '寅', '子', true), ['回头生', '化空']);
  assert.deepEqual(getLiuyaoChangeRelations('木', '金', '卯', '酉', true), [
    '回头冲',
    '回头克',
    '化空',
  ]);
  assert.deepEqual(getLiuyaoChangeRelations('木', '土', '寅', '辰', true), ['化耗', '化空']);

  // 旧单值入口继续保持既有口径，避免已有调用方升级后结果突变。
  assert.equal(getLiuyaoChangeRelation('木', '水', '寅', '子', true), '化空');
});

test('六爻：回头冲与五行生克应分别保存', () => {
  assert.deepEqual(getLiuyaoChangeRelations('木', '金', '卯', '酉', false), ['回头冲', '回头克']);
  assert.deepEqual(getLiuyaoChangeRelations('金', '木', '酉', '卯', false), ['回头冲', '化耗']);
  assert.equal(getLiuyaoChangeRelation('金', '木', '酉', '卯', false), '回头冲');
});

test('六爻：动爻化六合应在基础五行关系外另记化扶', () => {
  assert.deepEqual(getLiuyaoChangeRelations('水', '土', '子', '丑', false), ['回头克', '化扶']);
  assert.equal(getLiuyaoChangeRelation('水', '土', '子', '丑', false), '回头克');
});

test('六爻：进退神按增删卜易明表判定，不按地支循环外推', () => {
  const advancingChanges: Array<[string, string]> = [
    ['亥', '子'],
    ['寅', '卯'],
    ['巳', '午'],
    ['申', '酉'],
    ['丑', '辰'],
    ['辰', '未'],
    ['未', '戌'],
  ];
  const retreatingChanges: Array<[string, string]> = [
    ['子', '亥'],
    ['卯', '寅'],
    ['午', '巳'],
    ['酉', '申'],
    ['辰', '丑'],
    ['未', '辰'],
    ['戌', '未'],
  ];

  for (const [originalBranch, changedBranch] of advancingChanges) {
    assert.equal(getLiuyaoChangeDirection(originalBranch, changedBranch), '化进神');
  }
  for (const [originalBranch, changedBranch] of retreatingChanges) {
    assert.equal(getLiuyaoChangeDirection(originalBranch, changedBranch), '化退神');
  }

  assert.equal(getLiuyaoChangeDirection('戌', '丑'), null);
  assert.equal(getLiuyaoChangeDirection('丑', '戌'), null);
});

test('六爻：整卦六合六冲应按初四二五三上爻支成组判断', () => {
  assert.equal(getLiuyaoHexagramRelation('乾为天'), '六冲卦');
  assert.equal(getLiuyaoHexagramRelation('巽为风'), '六冲卦');
  assert.equal(getLiuyaoHexagramRelation('天地否'), '六合卦');
  assert.equal(getLiuyaoHexagramRelation('地天泰'), '六合卦');
  assert.equal(getLiuyaoHexagramRelation('风水涣'), null);

  assert.deepEqual(getLiuyaoHexagramRelations('乾为天', '地天泰', true), {
    original: '六冲卦',
    changed: '六合卦',
    transition: '六冲变六合',
  });
  assert.deepEqual(getLiuyaoHexagramRelations('天地否', '坤为地', true), {
    original: '六合卦',
    changed: '六冲卦',
    transition: '六合变六冲',
  });

  const data = generateLiuyao(new Date('2025-01-01T01:00:00+08:00'), {
    yaos: XUN_WEI_FENG_YAOS,
  });
  assert.equal(data.originalName, '巽为风');
  assert.equal(data.hexagramRelations?.original, '六冲卦');
});

test('六爻：公开卦名助手应拒绝未知卦名，不应返回空结果掩盖输入错误', () => {
  assert.throws(() => getLiuyaoNaJiaTiangan('不存在的卦'), /找不到卦象/);
  assert.throws(() => getLiuyaoHexagramRelation('不存在的卦'), /找不到卦象/);
  assert.throws(() => getLiuyaoHexagramRelations('不存在的卦', '乾为天', true), /找不到卦象/);
  assert.throws(() => getLiuyaoFanFuRelations('乾为天', '不存在的卦', true), /找不到卦象/);
  assert.throws(() => getLiuyaoFanFuRelations('不存在的卦', undefined, false), /找不到卦象/);
});

test('六爻：反吟伏吟应按卦变和纳甲地支判断', () => {
  const guaFanyin = getLiuyaoFanFuRelations('乾为天', '巽为风', true);
  assert.deepEqual(
    guaFanyin.fanyin.map(({ kind, scope, label }) => ({ kind, scope, label })),
    [{ kind: '卦反吟', scope: '内外', label: '内外反吟' }],
  );
  assert.deepEqual(guaFanyin.fuyin, []);
  assert.deepEqual(guaFanyin.labels, ['内外反吟']);

  const yaoFanyin = getLiuyaoFanFuRelations('风地观', '地风升', true);
  assert.deepEqual(
    yaoFanyin.fanyin.map(({ kind, scope, label }) => ({ kind, scope, label })),
    [{ kind: '爻反吟', scope: '内外', label: '内外爻反吟' }],
  );
  assert.deepEqual(yaoFanyin.labels, ['内外爻反吟']);

  const outerFuyin = getLiuyaoFanFuRelations('天风姤', '雷风恒', true);
  assert.deepEqual(
    outerFuyin.fuyin.map(({ kind, scope, label }) => ({ kind, scope, label })),
    [{ kind: '伏吟', scope: '外卦', label: '外卦伏吟' }],
  );
  assert.deepEqual(outerFuyin.fanyin, []);

  const innerFuyin = getLiuyaoFanFuRelations('风天小畜', '风雷益', true);
  assert.deepEqual(
    innerFuyin.fuyin.map(({ kind, scope, label }) => ({ kind, scope, label })),
    [{ kind: '伏吟', scope: '内卦', label: '内卦伏吟' }],
  );

  const staticHexagram = getLiuyaoFanFuRelations('乾为天', '乾为天', false);
  assert.deepEqual(staticHexagram.labels, []);

  const data = generateSampleLiuyao();
  assert.ok(data.fanfuRelations);
  assert.ok(Array.isArray(data.fanfuRelations.labels));
});

test('六爻：八宫卦位应输出首卦一世游魂归魂等卦序', () => {
  assert.equal(getLiuyaoPalaceStage('乾为天'), '首卦');
  assert.equal(getLiuyaoPalaceStage('天风姤'), '一世');
  assert.equal(getLiuyaoPalaceStage('山地剥'), '五世');
  assert.equal(getLiuyaoPalaceStage('火地晋'), '游魂');
  assert.equal(getLiuyaoPalaceStage('火天大有'), '归魂');

  const data = generateLiuyao(new Date('2025-01-01T16:00:00+08:00'), {
    yaos: FENG_SHUI_HUAN_YAOS,
  });
  assert.equal(data.originalName, '风水涣');
  assert.equal(data.palaceStage, '五世');
});

test('六爻：静卦不能仅凭静态纳甲支凑成三合局', () => {
  const data = generateLiuyao(new Date('2025-01-01T00:00:00+08:00'), {
    yaos: KAN_WEI_SHUI_YAOS,
  });

  assert.equal(data.ganzhi.month.slice(1), '子');
  assert.equal(data.ganzhi.day.slice(1), '午');
  assert.deepEqual(data.najiaDizhi, ['寅', '辰', '午', '申', '戌', '子']);

  assert.equal(data.changingYaos.length, 0);
  assert.equal(data.sanheWithDay, null);
  assert.equal(data.sanheWithMonth, null);
  assert.deepEqual(data.sanheFormations, []);
});

test('六爻：两个不同动爻的变爻可以与日辰补成三合并保留空破条件', () => {
  const data = generateLiuyao(new Date('2025-01-01T00:00:00+08:00'), {
    yaos: [7, 6, 7, 7, 7, 6],
  });

  assert.equal(data.ganzhi.day.slice(1), '午');
  assert.equal(data.originalName, '泽火革');
  assert.equal(data.changedName, '乾为天');
  assert.deepEqual(
    data.yaosDetail
      .filter((yao) => yao.isChanging)
      .map((yao) => [yao.najiaDizhi, yao.changedYao?.dizhi]),
    [
      ['丑', '寅'],
      ['未', '戌'],
    ],
  );
  assert.equal(data.sanheWithDay?.group, '火局');
  assert.deepEqual(data.sanheWithDay?.members, ['寅', '午', '戌']);
  assert.match(data.sanheWithDay?.description || '', /日辰午补足寅、午、戌火局/);
  assert.equal(data.sanheWithDay?.status, '待填实');
  assert.deepEqual(
    data.sanheWithDay?.participants?.map((item) => item.position),
    [2, 6],
  );
  assert.equal(data.sanheWithMonth, null);
});

test('六爻：同一动爻的本支变支不得冒充日月补局所需的两个活动爻', () => {
  const dayCase = generateLiuyao(new Date('2024-01-03T12:00:00+08:00'), {
    method: 'manual',
    yaos: [6, 6, 6, 6, 6, 7],
  });
  const monthCase = generateLiuyao(new Date('2024-02-05T12:00:00+08:00'), {
    method: 'manual',
    yaos: [6, 6, 6, 6, 6, 7],
  });

  assert.equal(dayCase.sanheWithDay, null);
  assert.equal(monthCase.sanheWithMonth, null);
});

test('六爻：两动一静及初三四六动变应分别识别为卦内三合', () => {
  const twoMovingOneStatic = generateLiuyao(new Date('2024-01-01T12:00:00+08:00'), {
    method: 'manual',
    yaos: [7, 6, 6, 6, 6, 6],
  });
  const trigramChange = generateLiuyao(new Date('2024-01-01T12:00:00+08:00'), {
    method: 'manual',
    yaos: [9, 7, 6, 6, 6, 6],
  });

  const twoMovingFormation = twoMovingOneStatic.sanheFormations?.find(
    (item) => item.group === '水局' && item.pattern === '两动一静',
  );
  assert.ok(twoMovingFormation);
  assert.equal(twoMovingFormation.status, '成立待静爻逢值');
  assert.ok(twoMovingFormation.participants.some((item) => item.activity === '静爻'));

  const trigramFormation = trigramChange.sanheFormations?.find(
    (item) => item.group === '金局' && item.pattern === '初三爻动变成局',
  );
  assert.ok(trigramFormation);
  assert.deepEqual(
    new Set(trigramFormation.participants.map((item) => item.position)),
    new Set([1, 3]),
  );
  assert.ok(trigramFormation.participants.some((item) => item.source === '变爻'));
});

test('六爻：静爻逢月日合为合起，明暗动爻逢合为合绊', () => {
  const date = new Date('2025-01-01T00:00:00+08:00');
  const moving = generateLiuyao(date, { method: 'manual', yaos: [6, 6, 6, 6, 6, 6] });
  const staticChart = generateLiuyao(date, { method: 'manual', yaos: [8, 8, 8, 8, 8, 8] });
  const movingChou = moving.yaosDetail.find((item) => item.najiaDizhi === '丑');
  const staticChou = staticChart.yaosDetail.find((item) => item.najiaDizhi === '丑');

  assert.ok(movingChou?.strengthAnalysis?.calendarConstraints.includes('月建合绊本爻'));
  assert.ok(!movingChou?.strengthAnalysis?.calendarSupport.includes('静爻逢月建合起'));
  assert.ok(staticChou?.strengthAnalysis?.calendarSupport.includes('静爻逢月建合起'));
  assert.ok(!staticChou?.strengthAnalysis?.calendarConstraints.includes('月建合绊本爻'));
});

test('六爻：月卦身应按阳世起子、阴世起午逐爻顺数', () => {
  const yangShi = generateLiuyao(new Date('2025-01-01T16:00:00+08:00'), {
    yaos: FENG_SHUI_HUAN_YAOS,
  });
  assert.equal(yangShi.originalName, '风水涣');
  assert.equal(yangShi.worldAndResponse.indexOf('世') + 1, 5);
  assert.equal(yangShi.yaosDetail[4].yaoType, '阳');
  assert.equal(yangShi.guaShen?.branch, '辰');
  assert.equal(yangShi.guaShen?.position, 2);

  const yinShi = generateLiuyao(new Date('2025-01-01T01:00:00+08:00'), {
    yaos: DUI_WEI_ZE_YAOS,
  });
  assert.equal(yinShi.originalName, '兑为泽');
  assert.equal(yinShi.worldAndResponse.indexOf('世') + 1, 6);
  assert.equal(yinShi.yaosDetail[5].yaoType, '阴');
  assert.equal(yinShi.guaShen?.branch, '亥');
  assert.equal(yinShi.guaShen?.position, 4);
});

test('六爻：动变关系与月卦身应拒绝非法资料', () => {
  assert.throws(() => getLiuyaoChangeRelation('', '火', '子', '午', false), /动变五行无效/);
  assert.throws(() => getLiuyaoChangeRelation('水', '火', '无', '午', false), /动变地支无效/);
  assert.throws(
    () => getLiuyaoChangeRelation('水', '火', '子', '午', undefined as never),
    /旬空标记必须是布尔值/,
  );
  assert.throws(() => getLiuyaoGuaShenBranch(0, true), /世爻位置无效/);
  assert.throws(() => getLiuyaoGuaShenBranch(7, false), /世爻位置无效/);
  assert.throws(() => getLiuyaoGuaShenBranch(1, undefined as never), /阴阳标记必须是布尔值/);
  assert.throws(
    () =>
      analyzeLiuyaoSanxingFormations(
        Array.from({ length: 5 }, (_, i) => makeYao(i + 1, '子', '水')),
        '子',
        '午',
      ),
    /必须提供完整六爻/,
  );
  assert.throws(
    () =>
      analyzeLiuyaoSanxingFormations(
        Array.from({ length: 6 }, (_, i) => makeYao(i + 1, i === 0 ? '无' : '子', '水')),
        '子',
        '午',
      ),
    /第1爻地支无效/,
  );
});

test('六爻：手工三钱法爻值应严格校验长度与取值', () => {
  assert.throws(() => generateLiuyao(SAMPLE_DATE, { yaos: [7, 8, 7] }), /必须恰好包含 6 爻/);
  assert.throws(
    () => generateLiuyao(SAMPLE_DATE, { yaos: [7, 8, 7, 8, 8, 5] }),
    /只能是 6、7、8、9/,
  );
});
