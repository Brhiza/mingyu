import test from 'node:test';
import assert from 'node:assert/strict';

import { generateEnhancedAnalysisSection } from '../packages/core/src/bazi/baziPromptEnhancement';
import {
  assessAllHarmonyTransforms,
  assessBranchHarmonyTransform,
  assessStemHarmonyTransform,
  type HarmonyPillarInput,
} from '../packages/core/src/bazi/harmonyTransform';

function createPillars(labels?: readonly string[]): HarmonyPillarInput[] {
  const values = [
    ['丙', '子', ['癸']],
    ['己', '丑', ['己', '癸', '辛']],
    ['甲', '寅', ['甲', '丙', '戊']],
    ['庚', '申', ['庚', '壬', '戊']],
  ] as const;

  return values.map(([gan, zhi, hiddenStems], index) => ({
    ...(labels?.[index] ? { label: labels[index] } : {}),
    gan,
    zhi,
    hiddenStems: [...hiddenStems],
  }));
}

function profileText(profiles: ReturnType<typeof assessAllHarmonyTransforms>): string {
  return profiles
    .flatMap((profile) => [...profile.participants, ...profile.evidence, ...profile.consequences])
    .join('；');
}

test('合化公开结果规范化缺省柱位并兼容英文参与定位', () => {
  const pillars = createPillars();
  const profiles = assessAllHarmonyTransforms(pillars, '丑');
  const stemProfile = profiles.find((profile) => profile.type === '天干五合');

  assert.deepEqual(stemProfile?.participants, ['月柱己', '日柱甲']);
  assert.match(stemProfile?.evidence.join('；') ?? '', /日柱寅本气为木，形成克制化神土的盘面关系/);
  assert.doesNotMatch(profileText(profiles), /\b(year|month|day|hour)/);

  const directStem = assessStemHarmonyTransform('己', 'month', '甲', 'day', '丑', pillars);
  assert.deepEqual(directStem.participants, ['月柱己', '日柱甲']);

  const directBranch = assessBranchHarmonyTransform('子', 'year', '丑', 'month', '丑', pillars);
  assert.deepEqual(directBranch.participants, ['年柱子', '月柱丑']);
  assert.doesNotMatch(
    [...directStem.evidence, ...directStem.consequences, ...directBranch.consequences].join('；'),
    /\b(year|month|day|hour)/,
  );
});

test('中文及自定义柱位标签保持规范化与原值', () => {
  const chinese = createPillars(['年柱', '月柱', '日柱', '时柱']);
  const chineseProfile = assessStemHarmonyTransform('己', '月柱', '甲', '日柱', '丑', chinese);
  assert.deepEqual(chineseProfile.participants, ['月柱己', '日柱甲']);

  const custom = createPillars(['年位', '月令位', '日主位', '时位']);
  const customProfile = assessStemHarmonyTransform('己', '月令位', '甲', '日主位', '丑', custom);
  assert.deepEqual(customProfile.participants, ['月令位己', '日主位甲']);
  assert.match(customProfile.consequences.join('；'), /月令位己与日主位甲/);
  const customKey = createPillars(['年位', 'toString', '日主位', '时位']);
  assert.deepEqual(
    assessStemHarmonyTransform('己', 'toString', '甲', '日主位', '丑', customKey).participants,
    ['toString己', '日主位甲'],
  );
});

test('规范化柱位进入错误文本且增强提示词不暴露内部控制门槛', () => {
  const pillars = createPillars();

  assert.throws(
    () => assessStemHarmonyTransform('风', 'day', '甲', 'month', '丑', pillars),
    /日柱天干无效/,
  );
  assert.throws(
    () => assessBranchHarmonyTransform('风', 'year', '丑', 'month', '丑', pillars),
    /年柱地支无效/,
  );
  assert.throws(
    () => assessStemHarmonyTransform('己', 'month', '甲', 'hour', '丑', pillars),
    /时柱甲不在所给四柱中/,
  );

  const section = generateEnhancedAnalysisSection({
    pillars: {
      year: { gan: '丙', zhi: '子' },
      month: { gan: '己', zhi: '丑' },
      day: { gan: '甲', zhi: '寅' },
      hour: { gan: '庚', zhi: '申' },
    },
    hiddenStems: {
      year: ['癸'],
      month: ['己', '癸', '辛'],
      day: ['甲', '丙', '戊'],
      hour: ['庚', '壬', '戊'],
    },
    analysis: { mingGe: { pattern: '普通格局', isSpecial: false } },
  } as any);

  assert.doesNotMatch(section, /按现有控制门槛计入/);
  assert.match(section, /形成克制化神土的盘面关系/);
  assert.doesNotMatch(
    section,
    /\b(year|month|day|hour)(?:干|支|[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥])/,
  );
});
