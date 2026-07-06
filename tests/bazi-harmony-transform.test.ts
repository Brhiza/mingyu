import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assessAllHarmonyTransforms,
  assessBranchHarmonyTransform,
  assessStemHarmonyTransform,
  formatHarmonyTransformProfile,
  type HarmonyPillarInput,
} from '../packages/core/src/bazi';

function createPillar(
  label: string,
  gan: string,
  zhi: string,
  hiddenStems: string[],
): HarmonyPillarInput {
  return {
    label,
    gan,
    zhi,
    hiddenStems,
  };
}

test('天干五合评分应体现月令、透干、根气和清杂', () => {
  const pillars = [
    createPillar('年柱', '甲', '辰', ['戊', '乙', '癸']),
    createPillar('月柱', '己', '戌', ['戊', '辛', '丁']),
    createPillar('日柱', '乙', '丑', ['己', '癸', '辛']),
    createPillar('时柱', '戊', '午', ['丁', '己']),
  ];

  const profile = assessStemHarmonyTransform('甲', '年柱', '己', '月柱', '戌', pillars);

  assert.equal(profile.type, '天干五合');
  assert.equal(profile.transformElement, '土');
  assert.equal(profile.transformStem, '戊');
  assert.equal(profile.monthSupport, 40);
  assert.equal(profile.stemScore, 20);
  assert.equal(profile.rootScore, 20);
  assert.equal(profile.purityScore, 5);
  assert.equal(profile.score, 85);
  assert.equal(profile.level, '大部分化');
  assert.equal(profile.direction, '向化');
  assert.equal(profile.isTransformed, true);
  assert.ok(profile.evidence.some((item) => item.includes('月令戌对土为旺')));
});

test('月令不支持时不应直接按成功合化处理', () => {
  const pillars = [
    createPillar('年柱', '甲', '辰', ['戊', '乙', '癸']),
    createPillar('月柱', '己', '子', ['癸']),
    createPillar('日柱', '乙', '亥', ['壬', '甲']),
    createPillar('时柱', '戊', '丑', ['己', '癸', '辛']),
  ];

  const profile = assessStemHarmonyTransform('甲', '年柱', '己', '月柱', '子', pillars);

  assert.equal(profile.monthSupport, 8);
  assert.equal(profile.isTransformed, false);
  assert.ok(profile.score < 80);
  assert.match(profile.consequences.join('；'), /不化|半化半绊/);
});

test('地支六合评分应识别化神透干和冲破影响', () => {
  const cleanPillars = [
    createPillar('年柱', '甲', '子', ['癸']),
    createPillar('月柱', '己', '丑', ['己', '癸', '辛']),
    createPillar('日柱', '戊', '辰', ['戊', '乙', '癸']),
    createPillar('时柱', '庚', '申', ['庚', '壬', '戊']),
  ];
  const clashedPillars = [
    createPillar('年柱', '甲', '子', ['癸']),
    createPillar('月柱', '己', '丑', ['己', '癸', '辛']),
    createPillar('日柱', '戊', '午', ['丁', '己']),
    createPillar('时柱', '庚', '申', ['庚', '壬', '戊']),
  ];

  const clean = assessBranchHarmonyTransform('子', '年柱', '丑', '月柱', '丑', cleanPillars);
  const clashed = assessBranchHarmonyTransform('子', '年柱', '丑', '月柱', '丑', clashedPillars);

  assert.equal(clean.type, '地支六合');
  assert.equal(clean.transformElement, '土');
  assert.equal(clean.stemScore, 20);
  assert.equal(clean.rootScore, 15);
  assert.equal(clashed.clashPenalty, -15);
  assert.ok(clashed.score < clean.score);
});

test('自动扫描应只返回原局存在的天干五合和地支六合', () => {
  const pillars = [
    createPillar('年柱', '甲', '子', ['癸']),
    createPillar('月柱', '己', '丑', ['己', '癸', '辛']),
    createPillar('日柱', '戊', '辰', ['戊', '乙', '癸']),
    createPillar('时柱', '庚', '申', ['庚', '壬', '戊']),
  ];

  const profiles = assessAllHarmonyTransforms(pillars);

  assert.equal(profiles.length, 2);
  assert.ok(profiles.some((profile) => profile.type === '天干五合'));
  assert.ok(profiles.some((profile) => profile.type === '地支六合'));
});

test('格式化输出应保留评分明细，非法组合应抛出错误', () => {
  const pillars = [
    createPillar('年柱', '甲', '辰', ['戊', '乙', '癸']),
    createPillar('月柱', '己', '戌', ['戊', '辛', '丁']),
    createPillar('日柱', '乙', '丑', ['己', '癸', '辛']),
    createPillar('时柱', '戊', '午', ['丁', '己']),
  ];

  const profile = assessStemHarmonyTransform('甲', '年柱', '己', '月柱', '戌', pillars);
  const formatted = formatHarmonyTransformProfile(profile);

  assert.ok(formatted.some((line) => line.includes('评分明细')));
  assert.throws(() => assessStemHarmonyTransform('甲', '年柱', '乙', '日柱', '戌', pillars));
  assert.throws(() => assessBranchHarmonyTransform('子', '年柱', '寅', '日柱', '戌', pillars));
});

test('合化评分应拒绝非法干支和藏干，不应生成未知月令证据', () => {
  const pillars = [
    createPillar('年柱', '甲', '辰', ['戊', '乙', '癸']),
    createPillar('月柱', '己', '戌', ['戊', '辛', '丁']),
    createPillar('日柱', '乙', '丑', ['己', '癸', '辛']),
    createPillar('时柱', '戊', '午', ['丁', '己']),
  ];

  assert.throws(
    () => assessStemHarmonyTransform('风', '年柱', '己', '月柱', '戌', pillars),
    /年柱天干无效/,
  );
  assert.throws(
    () => assessStemHarmonyTransform('甲', '年柱', '己', '月柱', '风', pillars),
    /月支无效/,
  );
  assert.throws(
    () =>
      assessAllHarmonyTransforms([
        createPillar('年柱', '甲', '辰', ['戊', '乙', '癸']),
        createPillar('月柱', '己', '戌', ['风']),
        createPillar('日柱', '乙', '丑', ['己', '癸', '辛']),
        createPillar('时柱', '戊', '午', ['丁', '己']),
      ]),
    /月柱藏干无效/,
  );
});
