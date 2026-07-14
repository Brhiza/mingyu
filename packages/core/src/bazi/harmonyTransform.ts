/**
 * @file 合化程度评分
 * @description 在已识别天干五合、地支六合的基础上，按月令、透干、根气、冲破、清杂、争合给出结构化评分。
 */
import type {
  HarmonyTransformDirection,
  HarmonyTransformLevel,
  HarmonyTransformProfile,
} from '../types/analysis';
import { WUXING, type Wuxing } from './baziTypes';
import { SEASON_STATUS } from './baziElementData';
import { BASIC_MAPPINGS, HIDDEN_STEMS } from './baziMappingsData';
import { assertEarthlyBranch, assertHeavenlyStem } from './baziUtils';

export interface HarmonyPillarInput {
  label?: string;
  gan: string;
  zhi: string;
  hiddenStems?: string[];
}

type NormalizedHarmonyPillar = Required<HarmonyPillarInput>;

const PILLAR_LABELS = ['year', 'month', 'day', 'hour'];

const STEM_TRANSFORM_RULES: Record<string, { partner: string; element: Wuxing; stem: string }> = {
  甲: { partner: '己', element: '土', stem: '戊' },
  己: { partner: '甲', element: '土', stem: '戊' },
  乙: { partner: '庚', element: '金', stem: '庚' },
  庚: { partner: '乙', element: '金', stem: '庚' },
  丙: { partner: '辛', element: '水', stem: '壬' },
  辛: { partner: '丙', element: '水', stem: '壬' },
  丁: { partner: '壬', element: '木', stem: '甲' },
  壬: { partner: '丁', element: '木', stem: '甲' },
  戊: { partner: '癸', element: '火', stem: '丙' },
  癸: { partner: '戊', element: '火', stem: '丙' },
};

const BRANCH_TRANSFORM_RULES: Record<string, { partner: string; element: Wuxing }> = {
  子: { partner: '丑', element: '土' },
  丑: { partner: '子', element: '土' },
  寅: { partner: '亥', element: '木' },
  亥: { partner: '寅', element: '木' },
  卯: { partner: '戌', element: '火' },
  戌: { partner: '卯', element: '火' },
  辰: { partner: '酉', element: '金' },
  酉: { partner: '辰', element: '金' },
  巳: { partner: '申', element: '水' },
  申: { partner: '巳', element: '水' },
  午: { partner: '未', element: '土' },
  未: { partner: '午', element: '土' },
};

const ELEMENT_STEMS: Record<Wuxing, string[]> = {
  木: ['甲', '乙'],
  火: ['丙', '丁'],
  土: ['戊', '己'],
  金: ['庚', '辛'],
  水: ['壬', '癸'],
};

function assertWuxing(value: string, label: string): asserts value is Wuxing {
  if (!(WUXING as readonly string[]).includes(value)) {
    throw new Error(`${label}五行无效：${value}`);
  }
}

function normalizePillars(pillars: HarmonyPillarInput[]): NormalizedHarmonyPillar[] {
  if (pillars.length !== 4) {
    throw new Error(`四柱数量无效：${pillars.length}`);
  }

  return pillars
    .map((pillar, index) => ({
      label: pillar.label || PILLAR_LABELS[index] || `pillar${index + 1}`,
      gan: pillar.gan,
      zhi: pillar.zhi,
      hiddenStems: pillar.hiddenStems || HIDDEN_STEMS[pillar.zhi] || [],
    }))
    .map((pillar, index) => {
      assertHeavenlyStem(pillar.gan, `${pillar.label || `第${index + 1}柱`}天干`);
      assertEarthlyBranch(pillar.zhi, `${pillar.label || `第${index + 1}柱`}地支`);
      pillar.hiddenStems.forEach((stem) => assertHeavenlyStem(stem, `${pillar.label}藏干`));
      return pillar;
    });
}

function getMonthSupport(monthBranch: string, element: Wuxing): number {
  assertEarthlyBranch(monthBranch, '月支');
  assertWuxing(element, '化神');
  const status = SEASON_STATUS[monthBranch]?.[element];
  if (!status) {
    throw new Error(`月令旺衰数据缺失：${monthBranch}/${element}`);
  }
  const scoreMap: Record<string, number> = {
    旺: 40,
    相: 30,
    休: 15,
    囚: 8,
    死: 0,
  };
  return scoreMap[status || ''] ?? 0;
}

function buildMonthSupportEvidence(monthBranch: string, element: Wuxing, _score: number): string {
  assertEarthlyBranch(monthBranch, '月支');
  assertWuxing(element, '化神');
  const status = SEASON_STATUS[monthBranch]?.[element];
  if (!status) {
    throw new Error(`月令旺衰数据缺失：${monthBranch}/${element}`);
  }
  return `月令${monthBranch}对化神${element}为${status}`;
}

function getControllingElement(element: Wuxing): Wuxing | undefined {
  return Object.entries(BASIC_MAPPINGS.WUXING_KE).find(([, target]) => target === element)?.[0] as
    Wuxing | undefined;
}

function getStemRootScore(element: Wuxing, pillars: NormalizedHarmonyPillar[]): number {
  const stems = ELEMENT_STEMS[element];
  const rootCount = pillars.filter((pillar) =>
    pillar.hiddenStems.some((hiddenStem) => stems.includes(hiddenStem)),
  ).length;

  if (rootCount >= 3) return 20;
  if (rootCount === 2) return 15;
  if (rootCount === 1) return 8;
  return 0;
}

function buildRootEvidence(
  element: Wuxing,
  _score: number,
  pillars: NormalizedHarmonyPillar[],
): string {
  const stems = ELEMENT_STEMS[element];
  const rootCount = pillars.filter((pillar) =>
    pillar.hiddenStems.some((hiddenStem) => stems.includes(hiddenStem)),
  ).length;

  return rootCount > 0 ? `化神${element}在${rootCount}支有根` : `化神${element}无根`;
}

function resolveLevel(score: number): HarmonyTransformLevel {
  if (score >= 95) return '完全合化';
  if (score >= 80) return '大部分化';
  if (score >= 60) return '半化半绊';
  if (score >= 40) return '合而不化';
  return '纯粹牵绊';
}

function resolveDirection(
  score: number,
  clashPenalty: number,
  competitionPenalty: number,
): HarmonyTransformDirection {
  if (score >= 80 && clashPenalty === 0 && competitionPenalty === 0) return '向化';
  if (score >= 40) return '合绊';
  return '合去';
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}

function buildConsequences(
  typeLabel: string,
  participant1: string,
  participant2: string,
  transformElement: Wuxing,
  score: number,
): string[] {
  if (score >= 80) {
    return [
      `${participant1}与${participant2}${typeLabel}化${transformElement}力量较足`,
      `原组合可按化神${transformElement}参与后续结构判断`,
    ];
  }
  if (score >= 60) {
    return [
      `${participant1}与${participant2}${typeLabel}半化半绊`,
      '双方仍保留原有属性，岁运补足月令、透干或根气时再复核',
    ];
  }
  if (score >= 40) {
    return [`${participant1}与${participant2}${typeLabel}合而不化`, '主要表现为相互牵制'];
  }
  return [
    `${participant1}与${participant2}${typeLabel}纯粹牵绊`,
    '化神力量不足，不宜直接按成化处理',
  ];
}

export function assessStemHarmonyTransform(
  stem1: string,
  pillar1: string,
  stem2: string,
  pillar2: string,
  monthBranch: string,
  allPillars: HarmonyPillarInput[],
): HarmonyTransformProfile {
  assertHeavenlyStem(stem1, `${pillar1}天干`);
  assertHeavenlyStem(stem2, `${pillar2}天干`);
  assertEarthlyBranch(monthBranch, '月支');

  const rule = STEM_TRANSFORM_RULES[stem1];
  if (!rule || rule.partner !== stem2) {
    throw new Error(`${stem1}与${stem2}不构成天干五合`);
  }

  const pillars = normalizePillars(allPillars);
  const evidence: string[] = [`${stem1}${stem2}合化${rule.element}，化神为${rule.stem}`];
  const monthSupport = getMonthSupport(monthBranch, rule.element);
  evidence.push(buildMonthSupportEvidence(monthBranch, rule.element, monthSupport));

  const transformStemPillar = pillars.find((pillar) => pillar.gan === rule.stem);
  const stemScore = transformStemPillar ? 20 : 0;
  evidence.push(
    transformStemPillar
      ? `化神${rule.stem}透出于${transformStemPillar.label}`
      : `化神${rule.stem}未透干`,
  );

  const rootScore = getStemRootScore(rule.element, pillars);
  evidence.push(buildRootEvidence(rule.element, rootScore, pillars));

  let clashPenalty = 0;
  const clash1 = BASIC_MAPPINGS.TIAN_GAN_CHONG[stem1];
  const clash2 = BASIC_MAPPINGS.TIAN_GAN_CHONG[stem2];
  if (
    clash1 &&
    pillars.some((pillar) => pillar.gan === clash1 && ![pillar1, pillar2].includes(pillar.label))
  ) {
    clashPenalty -= 15;
    evidence.push(`${stem1}被${clash1}相冲，构成冲破条件`);
  }
  if (
    clash2 &&
    pillars.some((pillar) => pillar.gan === clash2 && ![pillar1, pillar2].includes(pillar.label))
  ) {
    clashPenalty -= 15;
    evidence.push(`${stem2}被${clash2}相冲，构成冲破条件`);
  }

  const controllingElement = getControllingElement(rule.element);
  const controllingStems = controllingElement ? ELEMENT_STEMS[controllingElement] : [];
  const hasControl = pillars.some(
    (pillar) => controllingStems.includes(pillar.gan) && ![pillar1, pillar2].includes(pillar.label),
  );
  const purityScore = hasControl ? 5 : 20;
  evidence.push(
    hasControl
      ? `有${controllingElement}克制化神${rule.element}`
      : `无明显五行克制化神${rule.element}`,
  );

  let competitionPenalty = 0;
  const hasCompetitionWithStem1 = pillars.some(
    (pillar) =>
      ![pillar1, pillar2].includes(pillar.label) &&
      STEM_TRANSFORM_RULES[pillar.gan]?.partner === stem1,
  );
  const hasCompetitionWithStem2 = pillars.some(
    (pillar) =>
      ![pillar1, pillar2].includes(pillar.label) &&
      STEM_TRANSFORM_RULES[pillar.gan]?.partner === stem2,
  );
  if (hasCompetitionWithStem1) {
    competitionPenalty -= 10;
    evidence.push(`有其他天干争合${stem1}`);
  }
  if (hasCompetitionWithStem2) {
    competitionPenalty -= 10;
    evidence.push(`有其他天干争合${stem2}`);
  }

  const score = clampScore(
    monthSupport + stemScore + rootScore + clashPenalty + purityScore + competitionPenalty,
  );
  const level = resolveLevel(score);
  const direction = resolveDirection(score, clashPenalty, competitionPenalty);
  const participants = [`${pillar1}${stem1}`, `${pillar2}${stem2}`];

  return {
    type: '天干五合',
    participants,
    transformElement: rule.element,
    transformStem: rule.stem,
    score,
    level,
    direction,
    monthSupport,
    stemScore,
    rootScore,
    clashPenalty,
    purityScore,
    competitionPenalty,
    evidence,
    isTransformed: score >= 80,
    consequences: buildConsequences('合', participants[0], participants[1], rule.element, score),
  };
}

export function assessBranchHarmonyTransform(
  branch1: string,
  pillar1: string,
  branch2: string,
  pillar2: string,
  monthBranch: string,
  allPillars: HarmonyPillarInput[],
): HarmonyTransformProfile {
  assertEarthlyBranch(branch1, `${pillar1}地支`);
  assertEarthlyBranch(branch2, `${pillar2}地支`);
  assertEarthlyBranch(monthBranch, '月支');

  const rule = BRANCH_TRANSFORM_RULES[branch1];
  if (!rule || rule.partner !== branch2) {
    throw new Error(`${branch1}与${branch2}不构成地支六合`);
  }

  const pillars = normalizePillars(allPillars);
  const evidence: string[] = [`${branch1}${branch2}六合化${rule.element}`];
  const monthSupport = getMonthSupport(monthBranch, rule.element);
  evidence.push(buildMonthSupportEvidence(monthBranch, rule.element, monthSupport));

  const transformStems = ELEMENT_STEMS[rule.element];
  const transformStemVisible = pillars.find((pillar) => transformStems.includes(pillar.gan));
  const stemScore = transformStemVisible ? 20 : 0;
  evidence.push(
    transformStemVisible
      ? `化神${rule.element}透出于${transformStemVisible.label}`
      : `化神${rule.element}未透干`,
  );

  const rootScore = 15;
  evidence.push('六合地支本身带有化神根气');

  let clashPenalty = 0;
  const clash1 = BASIC_MAPPINGS.DI_ZHI_CHONG[branch1];
  const clash2 = BASIC_MAPPINGS.DI_ZHI_CHONG[branch2];
  if (
    clash1 &&
    pillars.some((pillar) => pillar.zhi === clash1 && ![pillar1, pillar2].includes(pillar.label))
  ) {
    clashPenalty -= 15;
    evidence.push(`${branch1}被${clash1}相冲，构成冲破条件`);
  }
  if (
    clash2 &&
    pillars.some((pillar) => pillar.zhi === clash2 && ![pillar1, pillar2].includes(pillar.label))
  ) {
    clashPenalty -= 15;
    evidence.push(`${branch2}被${clash2}相冲，构成冲破条件`);
  }

  const controllingElement = getControllingElement(rule.element);
  const controllingStems = controllingElement ? ELEMENT_STEMS[controllingElement] : [];
  const hasControl = pillars.some((pillar) => controllingStems.includes(pillar.gan));
  const purityScore = hasControl ? 5 : 20;
  evidence.push(
    hasControl
      ? `有${controllingElement}克制化神${rule.element}`
      : `无明显五行克制化神${rule.element}`,
  );

  const competitionPenalty = 0;
  const score = clampScore(monthSupport + stemScore + rootScore + clashPenalty + purityScore);
  const level = resolveLevel(score);
  const direction = resolveDirection(score, clashPenalty, competitionPenalty);
  const participants = [`${pillar1}${branch1}`, `${pillar2}${branch2}`];

  return {
    type: '地支六合',
    participants,
    transformElement: rule.element,
    score,
    level,
    direction,
    monthSupport,
    stemScore,
    rootScore,
    clashPenalty,
    purityScore,
    competitionPenalty,
    evidence,
    isTransformed: score >= 80,
    consequences: buildConsequences('六合', participants[0], participants[1], rule.element, score),
  };
}

export function assessAllHarmonyTransforms(
  pillars: HarmonyPillarInput[],
  monthBranch?: string,
): HarmonyTransformProfile[] {
  const normalizedPillars = normalizePillars(pillars);
  const resolvedMonthBranch = monthBranch || normalizedPillars[1]?.zhi;
  if (!resolvedMonthBranch) return [];

  const profiles: HarmonyTransformProfile[] = [];

  for (let i = 0; i < normalizedPillars.length; i += 1) {
    for (let j = i + 1; j < normalizedPillars.length; j += 1) {
      const left = normalizedPillars[i];
      const right = normalizedPillars[j];

      if (BASIC_MAPPINGS.TIAN_GAN_WU_HE[left.gan] === right.gan) {
        profiles.push(
          assessStemHarmonyTransform(
            left.gan,
            left.label,
            right.gan,
            right.label,
            resolvedMonthBranch,
            normalizedPillars,
          ),
        );
      }

      if (BASIC_MAPPINGS.DI_ZHI_LIU_HE[left.zhi] === right.zhi) {
        profiles.push(
          assessBranchHarmonyTransform(
            left.zhi,
            left.label,
            right.zhi,
            right.label,
            resolvedMonthBranch,
            normalizedPillars,
          ),
        );
      }
    }
  }

  return profiles;
}

export function formatHarmonyTransformProfile(profile: HarmonyTransformProfile): string[] {
  const conditions = [
    `月令条件：${profile.evidence.find((item) => item.startsWith('月令')) ?? '未记录'}`,
    `化神透干：${profile.stemScore > 0 ? '有' : '无'}`,
    `化神根气：${profile.rootScore > 0 ? '有' : '无'}`,
    `冲破：${profile.clashPenalty < 0 ? '有' : '无'}`,
    `争合：${profile.competitionPenalty < 0 ? '有' : '无'}`,
  ];
  return [
    `【${profile.type}】${profile.participants.join('与')}化${profile.transformElement}${
      profile.transformStem ? `（化神${profile.transformStem}）` : ''
    }`,
    `合化程度：${profile.level}`,
    `合化方向：${profile.direction}`,
    `条件明细：${conditions.join('；')}`,
    `评估依据：${profile.evidence.join('；')}`,
    `后续影响：${profile.consequences.join('；')}`,
  ];
}
