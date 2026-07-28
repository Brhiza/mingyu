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

test('天干五合须日干紧贴、得规定月令且无克破争合才作成化', () => {
  const pillars = [
    createPillar('年柱', '戊', '戌', ['戊', '辛', '丁']),
    createPillar('月柱', '己', '戌', ['戊', '辛', '丁']),
    createPillar('日柱', '甲', '丑', ['己', '癸', '辛']),
    createPillar('时柱', '丁', '巳', ['丙', '戊', '庚']),
  ];

  const profile = assessStemHarmonyTransform('己', '月柱', '甲', '日柱', '戌', pillars);

  assert.equal(profile.type, '天干五合');
  assert.equal(profile.transformElement, '土');
  assert.equal(profile.transformStem, '戊');
  assert.equal(profile.monthSupported, true);
  assert.equal(profile.transformStemVisible, true);
  assert.equal(profile.transformRooted, true);
  assert.equal(profile.hasControllingElement, false);
  assert.ok(!('score' in profile));
  assert.equal(profile.level, '成化');
  assert.equal(profile.direction, '向化');
  assert.equal(profile.dayStemInvolved, true);
  assert.equal(profile.participantsAdjacent, true);
  assert.equal(profile.isTransformed, true);
  assert.ok(profile.evidence.some((item) => item.includes('月令戌对化神土为旺')));
  assert.ok(profile.evidence.includes('日干参与五合'));
  assert.ok(profile.evidence.includes('两干紧贴'));
});

test('休囚月令不再被误标为支持成化', () => {
  const pillars = [
    createPillar('年柱', '戊', '戌', ['戊', '辛', '丁']),
    createPillar('月柱', '己', '子', ['癸']),
    createPillar('日柱', '甲', '丑', ['己', '癸', '辛']),
    createPillar('时柱', '丁', '巳', ['丙', '戊', '庚']),
  ];

  const profile = assessStemHarmonyTransform('己', '月柱', '甲', '日柱', '子', pillars);

  assert.equal(profile.monthSupported, false);
  assert.equal(profile.level, '合而不化');
  assert.equal(profile.isTransformed, false);
  assert.match(profile.consequences.join('；'), /合而不化/);
});

test('五种天干化气的规定月令应逐项核验，不由旺相休囚分值代替', () => {
  const cases = [
    {
      label: '甲己化土',
      stem1: '己',
      stem2: '甲',
      monthBranch: '戌',
      pillars: [
        createPillar('年柱', '戊', '戌', ['戊', '辛', '丁']),
        createPillar('月柱', '己', '戌', ['戊', '辛', '丁']),
        createPillar('日柱', '甲', '丑', ['己', '癸', '辛']),
        createPillar('时柱', '丁', '巳', ['丙', '戊', '庚']),
      ],
    },
    {
      label: '乙庚化金',
      stem1: '乙',
      stem2: '庚',
      monthBranch: '酉',
      pillars: [
        createPillar('年柱', '癸', '申', ['庚', '壬', '戊']),
        createPillar('月柱', '乙', '酉', ['辛']),
        createPillar('日柱', '庚', '丑', ['己', '癸', '辛']),
        createPillar('时柱', '壬', '子', ['癸']),
      ],
    },
    {
      label: '丙辛化水',
      stem1: '丙',
      stem2: '辛',
      monthBranch: '子',
      pillars: [
        createPillar('年柱', '庚', '申', ['庚', '壬', '戊']),
        createPillar('月柱', '丙', '子', ['癸']),
        createPillar('日柱', '辛', '亥', ['壬', '甲']),
        createPillar('时柱', '癸', '酉', ['辛']),
      ],
    },
    {
      label: '丁壬化木',
      stem1: '丁',
      stem2: '壬',
      monthBranch: '卯',
      pillars: [
        createPillar('年柱', '戊', '亥', ['壬', '甲']),
        createPillar('月柱', '丁', '卯', ['乙']),
        createPillar('日柱', '壬', '未', ['己', '丁', '乙']),
        createPillar('时柱', '甲', '子', ['癸']),
      ],
    },
    {
      label: '戊癸化火',
      stem1: '戊',
      stem2: '癸',
      monthBranch: '午',
      pillars: [
        createPillar('年柱', '甲', '寅', ['甲', '丙', '戊']),
        createPillar('月柱', '戊', '午', ['丁', '己']),
        createPillar('日柱', '癸', '戌', ['戊', '辛', '丁']),
        createPillar('时柱', '丙', '巳', ['丙', '戊', '庚']),
      ],
    },
  ];

  for (const item of cases) {
    const profile = assessStemHarmonyTransform(
      item.stem1,
      '月柱',
      item.stem2,
      '日柱',
      item.monthBranch,
      item.pillars,
    );
    assert.equal(profile.monthSupported, true, item.label);
    assert.equal(profile.level, '成化', item.label);
    assert.equal(profile.isTransformed, true, item.label);
  }
});

test('化神受克或另干争合时不得以其他条件抵消', () => {
  const controlledPillars = [
    createPillar('年柱', '戊', '戌', ['戊', '辛', '丁']),
    createPillar('月柱', '己', '戌', ['戊', '辛', '丁']),
    createPillar('日柱', '甲', '丑', ['己', '癸', '辛']),
    createPillar('时柱', '乙', '巳', ['丙', '戊', '庚']),
  ];
  const competingPillars = [
    createPillar('年柱', '甲', '戌', ['戊', '辛', '丁']),
    createPillar('月柱', '己', '戌', ['戊', '辛', '丁']),
    createPillar('日柱', '甲', '丑', ['己', '癸', '辛']),
    createPillar('时柱', '丁', '巳', ['丙', '戊', '庚']),
  ];

  const controlled = assessStemHarmonyTransform(
    '己',
    '月柱',
    '甲',
    '日柱',
    '戌',
    controlledPillars,
  );
  const competing = assessStemHarmonyTransform('己', '月柱', '甲', '日柱', '戌', competingPillars);

  assert.equal(controlled.hasControllingElement, true);
  assert.equal(controlled.level, '合而不化');
  assert.equal(controlled.isTransformed, false);
  assert.equal(competing.hasCompetition, true);
  assert.equal(competing.level, '争合不专');
  assert.equal(competing.isTransformed, false);
});

test('日干与隔位天干相合也不得作成化', () => {
  const pillars = [
    createPillar('年柱', '己', '戌', ['戊', '辛', '丁']),
    createPillar('月柱', '戊', '午', ['丁', '己']),
    createPillar('日柱', '甲', '丑', ['己', '癸', '辛']),
    createPillar('时柱', '丁', '巳', ['丙', '戊', '庚']),
  ];

  const profile = assessStemHarmonyTransform('己', '年柱', '甲', '日柱', '午', pillars);

  assert.equal(profile.monthSupported, true);
  assert.equal(profile.level, '合而不化');
  assert.equal(profile.isTransformed, false);
  assert.ok(profile.evidence.includes('两干隔位，不作成化'));
});

test('地支六合只论相合，冲合并见时标记破合而不裁成化', () => {
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
  assert.equal(clean.transformStemVisible, false);
  assert.equal(clean.transformRooted, false);
  assert.equal(clean.monthSupported, false);
  assert.equal(clean.level, '合而不化');
  assert.equal(clean.isTransformed, false);
  assert.equal(clashed.hasClashBreak, true);
  assert.equal(clean.hasClashBreak, false);
  assert.equal(clashed.level, '逢冲破合');
  assert.equal(clashed.direction, '破合');
  assert.equal(clashed.isTransformed, false);
  assert.match(clean.evidence.join('；'), /只论相合，不直接作化土论/);
});

test('两个地支隔位时只记六合对应关系，不作有效相合', () => {
  const pillars = [
    createPillar('年柱', '甲', '子', ['癸']),
    createPillar('月柱', '丙', '辰', ['戊', '乙', '癸']),
    createPillar('日柱', '戊', '丑', ['己', '癸', '辛']),
    createPillar('时柱', '庚', '申', ['庚', '壬', '戊']),
  ];

  const profile = assessBranchHarmonyTransform('子', '年柱', '丑', '日柱', '辰', pillars);

  assert.equal(profile.participantsAdjacent, false);
  assert.equal(profile.level, '隔位不合');
  assert.equal(profile.direction, '不合');
  assert.equal(profile.isTransformed, false);
  assert.match(profile.evidence.join('；'), /隔位.*不作有效相合/);
});

test('透干和根气多少只作旁证，不再累计成任意分数', () => {
  const lessEvidence = [
    createPillar('年柱', '壬', '酉', ['辛']),
    createPillar('月柱', '己', '戌', ['戊', '辛', '丁']),
    createPillar('日柱', '甲', '丑', ['己', '癸', '辛']),
    createPillar('时柱', '丁', '子', ['癸']),
  ];
  const moreEvidence = [
    createPillar('年柱', '戊', '戌', ['戊', '辛', '丁']),
    createPillar('月柱', '己', '戌', ['戊', '辛', '丁']),
    createPillar('日柱', '甲', '丑', ['己', '癸', '辛']),
    createPillar('时柱', '丁', '巳', ['丙', '戊', '庚']),
  ];

  const less = assessStemHarmonyTransform('己', '月柱', '甲', '日柱', '戌', lessEvidence);
  const more = assessStemHarmonyTransform('己', '月柱', '甲', '日柱', '戌', moreEvidence);

  assert.equal(less.transformStemVisible, false);
  assert.equal(more.transformStemVisible, true);
  assert.equal(less.level, '成化');
  assert.equal(more.level, '成化');
  assert.equal(less.isTransformed, more.isTransformed);
  assert.doesNotMatch([...less.evidence, ...more.evidence].join('；'), /\d+分/);
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

test('格式化输出应保留逐项条件且不外显内部分数，非法组合应抛出错误', () => {
  const pillars = [
    createPillar('年柱', '戊', '戌', ['戊', '辛', '丁']),
    createPillar('月柱', '己', '戌', ['戊', '辛', '丁']),
    createPillar('日柱', '甲', '丑', ['己', '癸', '辛']),
    createPillar('时柱', '丁', '巳', ['丙', '戊', '庚']),
  ];

  const profile = assessStemHarmonyTransform('己', '月柱', '甲', '日柱', '戌', pillars);
  const formatted = formatHarmonyTransformProfile(profile);

  assert.ok(formatted.some((line) => line.includes('条件明细')));
  assert.ok(formatted.some((line) => line.includes('月令条件')));
  assert.ok(formatted.some((line) => line.includes('条件判定：成化')));
  assert.doesNotMatch(formatted.join('\n'), /评分明细|\d+分/);
  assert.throws(() => assessStemHarmonyTransform('甲', '日柱', '乙', '时柱', '戌', pillars));
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
