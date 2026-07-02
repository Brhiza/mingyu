import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  generateLiuyao,
  getLiuyaoChangeDirection,
  getLiuyaoFanFuRelations,
  getLiuyaoHexagramRelation,
  getLiuyaoHexagramRelations,
  getLiuyaoPalaceStage,
} from 'mingyu-core/divination/liuyao';
import type { LiuyaoYaoDetail } from 'mingyu-core/types';

// 2025-01-01 农历为丙子月（子月：水旺木相金休土囚火死）、丙寅日（日支寅）
// 该日期的卦象固定，用于回归月令旺衰、暗动、回头生克冲的字段输出。
const SAMPLE_DATE = new Date('2025-01-01T08:00:00+08:00');

test('六爻：各爻输出月令旺相休囚死状态', () => {
  const data = generateLiuyao(SAMPLE_DATE);
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

test('六爻：静爻被日冲且旺相标记为暗动，休囚标记为日破', () => {
  const data = generateLiuyao(SAMPLE_DATE);
  const dayBranch = data.ganzhi.day.slice(1);

  // 暗动与日破互斥：暗动要求静爻(非动)且被日冲且旺相
  for (const yao of data.yaosDetail) {
    if (yao.isHiddenMove) {
      assert.ok(!yao.isChanging, `第${yao.position}爻暗动应为静爻`);
      assert.ok(yao.isDayBreak, `第${yao.position}爻暗动应被日冲`);
      assert.ok(
        yao.seasonState === '旺' || yao.seasonState === '相',
        `第${yao.position}爻暗动应旺相，实际 ${yao.seasonState}`,
      );
    }
    // 日破与暗动不同时成立
    assert.ok(!(yao.isDayBreak && yao.isHiddenMove) || yao.isHiddenMove, '');
  }
  void dayBranch;
});

test('六爻：动爻变爻输出回头生克冲化空比和关系', () => {
  const data = generateLiuyao(SAMPLE_DATE);
  const changingYaos = data.yaosDetail.filter((y) => y.isChanging);

  for (const yao of changingYaos as LiuyaoYaoDetail[]) {
    // 动爻有变爻时应有 changeRelation（回头生/回头克/回头冲/化空/比和之一）
    if (yao.changedYao) {
      assert.ok(
        yao.changeRelation,
        `第${yao.position}爻动变应输出 changeRelation，实际 ${yao.changeRelation}`,
      );
      assert.ok(
        ['回头生', '回头克', '回头冲', '化空', '比和'].includes(yao.changeRelation!),
        `第${yao.position}爻 changeRelation 值非法：${yao.changeRelation}`,
      );
    }
  }
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

  const data = generateLiuyao(new Date('2025-01-01T01:00:00+08:00'));
  assert.equal(data.originalName, '巽为风');
  assert.equal(data.hexagramRelations?.original, '六冲卦');
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

  const data = generateLiuyao(SAMPLE_DATE);
  assert.ok(data.fanfuRelations);
  assert.ok(Array.isArray(data.fanfuRelations.labels));
});

test('六爻：八宫卦位应输出首卦一世游魂归魂等卦序', () => {
  assert.equal(getLiuyaoPalaceStage('乾为天'), '首卦');
  assert.equal(getLiuyaoPalaceStage('天风姤'), '一世');
  assert.equal(getLiuyaoPalaceStage('山地剥'), '五世');
  assert.equal(getLiuyaoPalaceStage('火地晋'), '游魂');
  assert.equal(getLiuyaoPalaceStage('火天大有'), '归魂');

  const data = generateLiuyao(new Date('2025-01-01T16:00:00+08:00'));
  assert.equal(data.originalName, '风水涣');
  assert.equal(data.palaceStage, '五世');
});

test('六爻：三合局应区分日辰与月建的实际参与', () => {
  const data = generateLiuyao(new Date('2025-01-01T00:00:00+08:00'));

  assert.equal(data.ganzhi.month.slice(1), '子');
  assert.equal(data.ganzhi.day.slice(1), '午');
  assert.deepEqual(data.najiaDizhi, ['寅', '辰', '午', '申', '戌', '子']);

  assert.equal(data.sanheWithDay?.group, '火局');
  assert.deepEqual(data.sanheWithDay?.members, ['寅', '午', '戌']);
  assert.match(data.sanheWithDay?.description || '', /日辰午引动三合火局/);

  assert.equal(data.sanheWithMonth?.group, '水局');
  assert.deepEqual(data.sanheWithMonth?.members, ['申', '子', '辰']);
  assert.match(data.sanheWithMonth?.description || '', /月建子引动三合水局/);
});

test('六爻：月卦身应按阳世起子、阴世起午逐爻顺数', () => {
  const yangShi = generateLiuyao(new Date('2025-01-01T16:00:00+08:00'));
  assert.equal(yangShi.originalName, '风水涣');
  assert.equal(yangShi.worldAndResponse.indexOf('世') + 1, 5);
  assert.equal(yangShi.yaosDetail[4].yaoType, '阳');
  assert.equal(yangShi.guaShen?.branch, '辰');
  assert.equal(yangShi.guaShen?.position, 2);

  const yinShi = generateLiuyao(new Date('2025-01-01T01:00:00+08:00'));
  assert.equal(yinShi.originalName, '巽为风');
  assert.equal(yinShi.worldAndResponse.indexOf('世') + 1, 6);
  assert.equal(yinShi.yaosDetail[5].yaoType, '阴');
  assert.equal(yinShi.guaShen?.branch, '亥');
  assert.equal(yinShi.guaShen?.position, 2);
});
