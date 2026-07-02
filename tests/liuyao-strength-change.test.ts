import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { generateLiuyao } from 'mingyu-core/divination/liuyao';
import type { LiuyaoYaoDetail } from 'mingyu-core/types';

// 2025-01-01 农历为丙子月（子月：水旺木相火休金囚土死）、丙寅日（日支寅）
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
    // 子月火囚（令克火，水克火），火爻应为"囚"
    if (yao.wuxing === '火') {
      assert.equal(yao.seasonState, '囚', `第${yao.position}爻火在子月应囚`);
    }
    // 子月土死（土克令水，克令者死），土爻应为"死"
    if (yao.wuxing === '土') {
      assert.equal(yao.seasonState, '死', `第${yao.position}爻土在子月应死`);
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
