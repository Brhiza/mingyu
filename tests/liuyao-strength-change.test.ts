import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  generateLiuyao,
  getLiuyaoChangeDirection,
  getLiuyaoChangeRelation,
  getLiuyaoChangeRelations,
  getLiuyaoFanFuRelations,
  getLiuyaoGuaShenBranch,
  getLiuyaoHexagramRelation,
  getLiuyaoHexagramRelations,
  getLiuyaoPalaceStage,
} from 'mingyu-core/divination/liuyao';
import { formatEnhancedDivinationInfo } from 'mingyu-core/prompt';
import type { LiuyaoYaoDetail } from 'mingyu-core/types';

// 2025-01-01 农历为丙子月（子月：水旺木相金休土囚火死）、丙寅日（日支寅）
// 该日期的卦象固定，用于回归月令旺衰、暗动、回头生克冲的字段输出。
const SAMPLE_DATE = new Date('2025-01-01T08:00:00+08:00');
const SHAN_HUO_BI_YAOS = [7, 8, 7, 8, 8, 7] as const;
const XUN_WEI_FENG_YAOS = [8, 7, 7, 8, 7, 7] as const;
const DUI_WEI_ZE_YAOS = [7, 7, 8, 7, 7, 8] as const;
const FENG_SHUI_HUAN_YAOS = [8, 7, 8, 8, 7, 7] as const;
const KAN_WEI_SHUI_YAOS = [8, 7, 8, 8, 7, 8] as const;

function generateSampleLiuyao(yaos: readonly number[] = SHAN_HUO_BI_YAOS) {
  return generateLiuyao(SAMPLE_DATE, { yaos });
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

test('六爻：月建为墓库支时不得直接判作入月墓', () => {
  // 辰月水爻只按月令判断旺衰；《增删卜易》三墓为日墓、动墓、化墓，不含月墓。
  const data = generateLiuyao(new Date('2025-04-10T08:00:00+08:00'), {
    yaos: SHAN_HUO_BI_YAOS,
  });

  assert.equal(data.ganzhi.month.slice(1), '辰');
  assert.notEqual(data.ganzhi.day.slice(1), '辰');
  const waterYaos = data.yaosDetail.filter((yao) => yao.wuxing === '水');
  assert.ok(waterYaos.length > 0, '样本卦应包含水爻');
  for (const yao of waterYaos) {
    assert.equal(yao.isYueMu, false, `第${yao.position}爻不得因辰月直接判作入月墓`);
    assert.equal(yao.isRuMu, false, `第${yao.position}爻未逢日墓时不得汇总为入墓`);
  }
  assert.doesNotMatch(data.evidenceAnalysis?.promptText ?? '', /入月墓/);
});

test('六爻：爻内三刑汇总应按共享三刑口径识别两支互见', () => {
  const data = generateSampleLiuyao();

  assert.equal(data.originalName, '山火贲');
  assert.deepEqual(
    data.yaosDetail.map((yao) => yao.najiaDizhi),
    ['卯', '丑', '亥', '戌', '子', '寅'],
  );
  assert.ok(
    data.sanxingInYaos?.some(
      (item) => item.type === '恃势之刑' && item.branches.join('') === '丑戌',
    ),
  );
});

test('六爻：日冲应按旺相静爻、休囚静爻与动爻分别处理', () => {
  const hiddenMoveData = generateLiuyao(new Date('2025-01-01T00:00:00+08:00'), {
    yaos: KAN_WEI_SHUI_YAOS,
  });
  const hiddenMoveYao = hiddenMoveData.yaosDetail.find((yao) => yao.najiaDizhi === '子');
  assert.equal(hiddenMoveData.ganzhi.month.slice(1), '子');
  assert.equal(hiddenMoveData.ganzhi.day.slice(1), '午');
  assert.equal(hiddenMoveYao?.seasonState, '旺');
  assert.equal(hiddenMoveYao?.isDayClash, true);
  assert.equal(hiddenMoveYao?.isHiddenMove, true);
  assert.equal(hiddenMoveYao?.isDayBreak, false);
  assert.match(formatEnhancedDivinationInfo('liuyao', hiddenMoveData), /暗动/);

  const dayClashDate = new Date('2025-01-07T08:00:00+08:00');
  const dayBreakData = generateLiuyao(dayClashDate, { yaos: [7, 7, 7, 7, 7, 7] });
  const dayBreakYao = dayBreakData.yaosDetail.find((yao) => yao.najiaDizhi === '午');
  assert.equal(dayBreakData.ganzhi.month.slice(1), '丑');
  assert.equal(dayBreakData.ganzhi.day.slice(1), '子');
  assert.equal(dayBreakYao?.seasonState, '休');
  assert.equal(dayBreakYao?.isDayClash, true);
  assert.equal(dayBreakYao?.isHiddenMove, false);
  assert.equal(dayBreakYao?.isDayBreak, true);

  const movingData = generateLiuyao(dayClashDate, { yaos: [7, 7, 7, 9, 7, 7] });
  const movingYao = movingData.yaosDetail.find((yao) => yao.najiaDizhi === '午');
  assert.equal(movingYao?.isChanging, true);
  assert.equal(movingYao?.isDayClash, true);
  assert.equal(movingYao?.isHiddenMove, false);
  assert.equal(movingYao?.isDayBreak, false);
  const movingFact = movingData.evidenceAnalysis?.lineFacts.find((item) => item.position === 4);
  assert.ok(movingFact?.dayState.relations.includes('日辰冲动'));
  assert.ok(!movingFact?.dayState.relations.includes('日冲成破'));
  assert.match(formatEnhancedDivinationInfo('liuyao', movingData), /日辰冲动/);
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
        ['回头生', '回头克', '回头冲', '化空', '比和', '化泄', '化耗'].includes(
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

test('六爻：公开关系助手应拒绝未知卦名，不应返回空关系掩盖输入错误', () => {
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
});

test('六爻：动爻的变爻可以与日辰补成完整三合局', () => {
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
  assert.match(data.sanheWithDay?.description || '', /日辰午引动三合火局/);
  assert.equal(data.sanheWithMonth, null);
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
});

test('六爻：手工三钱法爻值应严格校验长度与取值', () => {
  assert.throws(() => generateLiuyao(SAMPLE_DATE, { yaos: [7, 8, 7] }), /必须恰好包含 6 爻/);
  assert.throws(
    () => generateLiuyao(SAMPLE_DATE, { yaos: [7, 8, 7, 8, 8, 5] }),
    /只能是 6、7、8、9/,
  );
});
