import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assessAllHarmonyTransforms,
  assessBranchHarmonyTransform,
  assessStemHarmonyTransform,
  formatHarmonyTransformProfile,
  type HarmonyPillarInput,
} from '../packages/core/src/bazi';

const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;
const FORBIDDEN_VERDICT_KEYS = [
  'level',
  'direction',
  'transformElement',
  'transformStem',
  'monthSupported',
  'hasClashBreak',
  'hasControllingElement',
  'hasCompetition',
  'isTransformed',
  'consequences',
] as const;

function createPillar(
  label: string,
  gan: string,
  zhi: string,
  hiddenStems?: string[],
): HarmonyPillarInput {
  return {
    label,
    gan,
    zhi,
    ...(hiddenStems ? { hiddenStems } : {}),
  };
}

function assertNoAutomaticVerdict(profile: ReturnType<typeof assessStemHarmonyTransform>): void {
  for (const key of FORBIDDEN_VERDICT_KEYS) {
    assert.equal(key in profile, false, `不应保留旧裁决字段 ${key}`);
  }
  assert.equal(profile.interpretationStatus, '固定相合事实，合化作用待复核');
  assert.match(profile.interpretationLimit, /不得由单项或条件数量自动裁定/);
}

function hasAutomaticVerdict(profile: ReturnType<typeof assessStemHarmonyTransform>): boolean {
  return FORBIDDEN_VERDICT_KEYS.some((key) => key in profile);
}

test('天干五合只返回固定配对、传统化气资料与原始条件', () => {
  const pillars = [
    createPillar('年柱', '戊', '戌', ['戊', '辛', '丁']),
    createPillar('月柱', '己', '戌', ['戊', '辛', '丁']),
    createPillar('日柱', '甲', '丑', ['己', '癸', '辛']),
    createPillar('时柱', '丁', '巳', ['丙', '戊', '庚']),
  ];

  const profile = assessStemHarmonyTransform('己', '月柱', '甲', '日柱', '戌', pillars);

  assert.equal(profile.type, '天干五合');
  assert.equal(profile.traditionalTransformElement, '土');
  assert.equal(profile.traditionalTransformStem, '戊');
  assert.equal(profile.monthSeasonStatus, '旺');
  assert.equal(profile.transformStemVisible, true);
  assert.equal(profile.transformRooted, true);
  assert.equal(profile.dayStemInvolved, true);
  assert.equal(profile.participantsAdjacent, true);
  assert.ok(profile.evidence.some((item) => item.includes('这里只记录五行月令状态')));
  assert.ok(profile.evidence.includes('日干参与五合'));
  assert.ok(profile.evidence.includes('两干柱位紧贴'));
  assertNoAutomaticVerdict(profile);
});

test('五种天干五合与六种地支六合只登记固定传统资料', () => {
  const stemCases = [
    ['甲', '己', '土', '戊'],
    ['乙', '庚', '金', '庚'],
    ['丙', '辛', '水', '壬'],
    ['丁', '壬', '木', '甲'],
    ['戊', '癸', '火', '丙'],
  ] as const;
  const branchCases = [
    ['子', '丑', '土'],
    ['寅', '亥', '木'],
    ['卯', '戌', '火'],
    ['辰', '酉', '金'],
    ['巳', '申', '水'],
    ['午', '未', '土'],
  ] as const;

  for (const [left, right, element, transformStem] of stemCases) {
    const pillars = [
      createPillar('年柱', left, '辰'),
      createPillar('月柱', right, '午'),
      createPillar('日柱', '甲', '戌'),
      createPillar('时柱', '乙', '申'),
    ];
    const profile = assessStemHarmonyTransform(left, '年柱', right, '月柱', '午', pillars);
    assert.equal(profile.traditionalTransformElement, element);
    assert.equal(profile.traditionalTransformStem, transformStem);
    assertNoAutomaticVerdict(profile);
  }

  for (const [left, right, element] of branchCases) {
    const pillars = [
      createPillar('年柱', '甲', left),
      createPillar('月柱', '丙', right),
      createPillar('日柱', '戊', '辰'),
      createPillar('时柱', '庚', '午'),
    ];
    const profile = assessBranchHarmonyTransform(left, '年柱', right, '月柱', right, pillars);
    assert.equal(profile.traditionalTransformElement, element);
    assertNoAutomaticVerdict(profile);
  }
});

test('冲克、隔位与相同配对只作为候选事实，不生成结论', () => {
  const controlled = assessStemHarmonyTransform('己', '月柱', '甲', '日柱', '戌', [
    createPillar('年柱', '甲', '戌'),
    createPillar('月柱', '己', '戌'),
    createPillar('日柱', '甲', '丑'),
    createPillar('时柱', '乙', '巳'),
  ]);
  const clashed = assessBranchHarmonyTransform('子', '年柱', '丑', '月柱', '丑', [
    createPillar('年柱', '甲', '子'),
    createPillar('月柱', '丙', '丑'),
    createPillar('日柱', '戊', '午'),
    createPillar('时柱', '庚', '申'),
  ]);
  const separated = assessBranchHarmonyTransform('子', '年柱', '丑', '日柱', '辰', [
    createPillar('年柱', '甲', '子'),
    createPillar('月柱', '丙', '辰'),
    createPillar('日柱', '戊', '丑'),
    createPillar('时柱', '庚', '申'),
  ]);

  assert.equal(controlled.controllingElementPresent, true);
  assert.ok(controlled.competitionCandidates.length > 0);
  assert.ok(clashed.clashCandidates.some((item) => item.includes('子另见固定相冲对象午')));
  assert.equal(separated.participantsAdjacent, false);
  assertNoAutomaticVerdict(controlled);
  assertNoAutomaticVerdict(clashed);
  assertNoAutomaticVerdict(separated);
});

test('格式化输出明确合化待复核且不出现自动裁决', () => {
  const pillars = [
    createPillar('年柱', '戊', '戌'),
    createPillar('月柱', '己', '戌'),
    createPillar('日柱', '甲', '丑'),
    createPillar('时柱', '丁', '巳'),
  ];
  const formatted = formatHarmonyTransformProfile(
    assessStemHarmonyTransform('己', '月柱', '甲', '日柱', '戌', pillars),
  ).join('\n');

  assert.match(formatted, /固定相合事实，合化作用待复核/);
  assert.match(formatted, /这里只确认固定相合与原始条件事实/);
  assert.doesNotMatch(
    formatted,
    /条件判定：成化|作用向化|作用破合|合而不化|争合不专|隔位不合|原组合可按化神参与/,
  );
  assert.throws(() => assessStemHarmonyTransform('甲', '日柱', '乙', '时柱', '戌', pillars));
  assert.throws(() => assessBranchHarmonyTransform('子', '年柱', '寅', '日柱', '戌', pillars));
});

test('自动扫描只返回四柱实际存在的固定五合与六合', () => {
  const profiles = assessAllHarmonyTransforms([
    createPillar('年柱', '甲', '子'),
    createPillar('月柱', '己', '丑'),
    createPillar('日柱', '戊', '辰'),
    createPillar('时柱', '庚', '申'),
  ]);

  assert.equal(profiles.length, 2);
  assert.ok(profiles.some((profile) => profile.type === '天干五合'));
  assert.ok(profiles.some((profile) => profile.type === '地支六合'));
  profiles.forEach(assertNoAutomaticVerdict);
});

test('四干一万种组合穷举均无旧合化裁决旁路', () => {
  let combinationCount = 0;
  let profileCount = 0;

  for (const yearStem of STEMS) {
    for (const monthStem of STEMS) {
      for (const dayStem of STEMS) {
        for (const hourStem of STEMS) {
          combinationCount += 1;
          const profiles = assessAllHarmonyTransforms([
            createPillar('年柱', yearStem, '辰'),
            createPillar('月柱', monthStem, '午'),
            createPillar('日柱', dayStem, '戌'),
            createPillar('时柱', hourStem, '申'),
          ]).filter((profile) => profile.type === '天干五合');
          profileCount += profiles.length;
          for (const profile of profiles) {
            if (hasAutomaticVerdict(profile)) {
              assert.fail(`四干组合出现旧裁决字段：${JSON.stringify(profile)}`);
            }
            assert.equal(profile.interpretationStatus, '固定相合事实，合化作用待复核');
          }
        }
      }
    }
  }

  assert.equal(combinationCount, 10_000);
  assert.ok(profileCount > 0);
});

test('四支二万零七百三十六种组合穷举均无旧合化裁决旁路', () => {
  let combinationCount = 0;
  let profileCount = 0;

  for (const yearBranch of BRANCHES) {
    for (const monthBranch of BRANCHES) {
      for (const dayBranch of BRANCHES) {
        for (const hourBranch of BRANCHES) {
          combinationCount += 1;
          const profiles = assessAllHarmonyTransforms([
            createPillar('年柱', '甲', yearBranch),
            createPillar('月柱', '丙', monthBranch),
            createPillar('日柱', '戊', dayBranch),
            createPillar('时柱', '庚', hourBranch),
          ]).filter((profile) => profile.type === '地支六合');
          profileCount += profiles.length;
          for (const profile of profiles) {
            if (hasAutomaticVerdict(profile)) {
              assert.fail(`四支组合出现旧裁决字段：${JSON.stringify(profile)}`);
            }
            assert.equal(profile.interpretationStatus, '固定相合事实，合化作用待复核');
          }
        }
      }
    }
  }

  assert.equal(combinationCount, 20_736);
  assert.ok(profileCount > 0);
});

test('非法干支、藏干与四柱数量继续失败关闭', () => {
  const pillars = [
    createPillar('年柱', '甲', '辰'),
    createPillar('月柱', '己', '戌'),
    createPillar('日柱', '乙', '丑'),
    createPillar('时柱', '戊', '午'),
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
        createPillar('年柱', '甲', '辰'),
        createPillar('月柱', '己', '戌', ['风']),
        createPillar('日柱', '乙', '丑'),
        createPillar('时柱', '戊', '午'),
      ]),
    /月柱藏干无效/,
  );
  assert.throws(() => assessAllHarmonyTransforms(pillars.slice(0, 3)), /四柱数量无效/);
});
