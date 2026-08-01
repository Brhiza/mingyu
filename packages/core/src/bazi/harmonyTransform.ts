/**
 * @file 干支固定相合与合化原始条件
 * @description 只登记天干五合、地支六合及可复核的月令、透根、冲合并见和争合候选事实；不自动裁定合化、合绊、破合或实际作用。
 */
import type { HarmonyTransformProfile } from '../types/analysis';
import { WUXING, type Wuxing } from './baziTypes';
import { SEASON_STATUS } from './baziElementData';
import { BASIC_MAPPINGS, HIDDEN_STEMS } from './baziMappingsData';
import { assertEarthlyBranch, assertHeavenlyStem } from './baziUtils';
import { BRANCH_WUXING } from '../ganzhi/relations';

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

  const normalized = pillars
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

  const labels = normalized.map((pillar) => pillar.label);
  if (new Set(labels).size !== labels.length) {
    throw new Error('四柱标签不可重复');
  }

  return normalized;
}

function getMonthCondition(
  monthBranch: string,
  element: Wuxing,
): {
  status: string;
  evidence: string;
} {
  assertEarthlyBranch(monthBranch, '月支');
  assertWuxing(element, '化神');
  const status = SEASON_STATUS[monthBranch]?.[element];
  if (!status) {
    throw new Error(`月令旺衰数据缺失：${monthBranch}/${element}`);
  }
  return {
    status,
    evidence: `月令${monthBranch}对传统化气五行${element}为${status}；这里只记录五行月令状态，不采用来源与版本未闭合的固定月份表裁定合化`,
  };
}

function getControllingElement(element: Wuxing): Wuxing | undefined {
  return Object.entries(BASIC_MAPPINGS.WUXING_KE).find(([, target]) => target === element)?.[0] as
    Wuxing | undefined;
}

function getStemRootCount(element: Wuxing, pillars: NormalizedHarmonyPillar[]): number {
  const stems = ELEMENT_STEMS[element];
  return pillars.filter((pillar) =>
    pillar.hiddenStems.some((hiddenStem) => stems.includes(hiddenStem)),
  ).length;
}

function buildRootEvidence(element: Wuxing, pillars: NormalizedHarmonyPillar[]): string {
  const rootCount = getStemRootCount(element, pillars);

  return rootCount > 0 ? `化神${element}在${rootCount}支有根` : `化神${element}无根`;
}

function findParticipantIndex(
  pillars: NormalizedHarmonyPillar[],
  label: string,
  value: string,
  key: 'gan' | 'zhi',
): number {
  const index = pillars.findIndex((pillar) => pillar.label === label && pillar[key] === value);
  if (index < 0) {
    throw new Error(`${label}${value}不在所给四柱中`);
  }
  return index;
}

const HARMONY_INTERPRETATION_LIMIT =
  '这里只确认固定相合与原始条件事实；合化、合绊、破合、争合是否成立及其实际作用，须由上层在明确流派版本、全局旺衰、透根、位置、冲克与制化后继续推算，不得由单项或条件数量自动裁定';

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
  const participantIndex1 = findParticipantIndex(pillars, pillar1, stem1, 'gan');
  const participantIndex2 = findParticipantIndex(pillars, pillar2, stem2, 'gan');
  const participantIndexes = [participantIndex1, participantIndex2];
  const evidence: string[] = [
    `${stem1}${stem2}为天干五合固定配对；传统化气五行记${rule.element}，对应化气天干资料为${rule.stem}`,
  ];
  const monthCondition = getMonthCondition(monthBranch, rule.element);
  evidence.push(monthCondition.evidence);

  const isDayStemPair = participantIndexes.includes(2);
  const isAdjacent = Math.abs(participantIndex1 - participantIndex2) === 1;
  evidence.push(
    isDayStemPair ? '日干参与五合' : '日干未参与该五合',
    isAdjacent ? '两干柱位紧贴' : '两干柱位隔位',
  );

  const transformStemPillar = pillars.find(
    (pillar, index) => !participantIndexes.includes(index) && pillar.gan === rule.stem,
  );
  evidence.push(
    transformStemPillar
      ? `化神${rule.stem}透出于${transformStemPillar.label}`
      : `化神${rule.stem}未透干`,
  );

  const rootCount = getStemRootCount(rule.element, pillars);
  evidence.push(buildRootEvidence(rule.element, pillars));

  const clashEvidence: string[] = [];
  const clash1 = BASIC_MAPPINGS.TIAN_GAN_CHONG[stem1];
  const clash2 = BASIC_MAPPINGS.TIAN_GAN_CHONG[stem2];
  if (
    clash1 &&
    pillars.some((pillar, index) => pillar.gan === clash1 && !participantIndexes.includes(index))
  ) {
    clashEvidence.push(`${stem1}另见固定相冲对象${clash1}`);
  }
  if (
    clash2 &&
    pillars.some((pillar, index) => pillar.gan === clash2 && !participantIndexes.includes(index))
  ) {
    clashEvidence.push(`${stem2}另见固定相冲对象${clash2}`);
  }
  evidence.push(...clashEvidence);

  const controllingElement = getControllingElement(rule.element);
  const controllingStems = controllingElement ? ELEMENT_STEMS[controllingElement] : [];
  const hasControl = pillars.some(
    (pillar, index) =>
      (!participantIndexes.includes(index) && controllingStems.includes(pillar.gan)) ||
      BRANCH_WUXING[pillar.zhi] === controllingElement,
  );
  evidence.push(
    hasControl
      ? `盘面另见可克传统化气五行${rule.element}的${controllingElement}五行`
      : `盘面未见可克传统化气五行${rule.element}的${controllingElement}五行`,
  );

  const hasCompetitionWithStem1 = pillars.some(
    (pillar, index) =>
      !participantIndexes.includes(index) &&
      Math.abs(index - participantIndex1) === 1 &&
      STEM_TRANSFORM_RULES[pillar.gan]?.partner === stem1,
  );
  const hasCompetitionWithStem2 = pillars.some(
    (pillar, index) =>
      !participantIndexes.includes(index) &&
      Math.abs(index - participantIndex2) === 1 &&
      STEM_TRANSFORM_RULES[pillar.gan]?.partner === stem2,
  );
  const competitionCandidates = [
    ...(hasCompetitionWithStem1 ? [`另一天干也与${stem1}构成固定五合配对`] : []),
    ...(hasCompetitionWithStem2 ? [`另一天干也与${stem2}构成固定五合配对`] : []),
  ];
  evidence.push(...competitionCandidates);
  const participants = [`${pillar1}${stem1}`, `${pillar2}${stem2}`];

  return {
    type: '天干五合',
    participants,
    traditionalTransformElement: rule.element,
    traditionalTransformStem: rule.stem,
    dayStemInvolved: isDayStemPair,
    participantsAdjacent: isAdjacent,
    monthSeasonStatus: monthCondition.status,
    transformStemVisible: Boolean(transformStemPillar),
    transformRooted: rootCount > 0,
    clashCandidates: clashEvidence,
    controllingElementPresent: hasControl,
    competitionCandidates,
    evidence,
    sources: ['天干五合固定配对与传统化气五行表', '四柱位置、月令五行状态、透干藏干与固定天干冲表'],
    interpretationStatus: '固定相合事实，合化作用待复核',
    interpretationLimit: HARMONY_INTERPRETATION_LIMIT,
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
  const participantIndex1 = findParticipantIndex(pillars, pillar1, branch1, 'zhi');
  const participantIndex2 = findParticipantIndex(pillars, pillar2, branch2, 'zhi');
  const participantIndexes = [participantIndex1, participantIndex2];
  const isAdjacent = Math.abs(participantIndex1 - participantIndex2) === 1;
  const evidence: string[] = [
    `${branch1}${branch2}为地支六合固定配对`,
    isAdjacent ? '两支柱位紧贴' : '两支柱位隔位',
    `传统六合化气五行资料记${rule.element}；这里只保留版本化原始资料，不据此裁定实际合化`,
  ];

  const clashEvidence: string[] = [];
  const clash1 = BASIC_MAPPINGS.DI_ZHI_CHONG[branch1];
  const clash2 = BASIC_MAPPINGS.DI_ZHI_CHONG[branch2];
  if (
    clash1 &&
    pillars.some((pillar, index) => pillar.zhi === clash1 && !participantIndexes.includes(index))
  ) {
    clashEvidence.push(`${branch1}另见固定相冲对象${clash1}`);
  }
  if (
    clash2 &&
    pillars.some((pillar, index) => pillar.zhi === clash2 && !participantIndexes.includes(index))
  ) {
    clashEvidence.push(`${branch2}另见固定相冲对象${clash2}`);
  }
  evidence.push(...clashEvidence);

  const competitionCandidates = pillars.flatMap((pillar, index) => {
    if (participantIndexes.includes(index)) return [];
    if (pillar.zhi === branch1 && Math.abs(index - participantIndex2) === 1) {
      return [`另见${pillar.label}${branch1}与${pillar2}${branch2}构成固定六合配对`];
    }
    if (pillar.zhi === branch2 && Math.abs(index - participantIndex1) === 1) {
      return [`另见${pillar.label}${branch2}与${pillar1}${branch1}构成固定六合配对`];
    }
    return [];
  });
  evidence.push(...competitionCandidates);
  const participants = [`${pillar1}${branch1}`, `${pillar2}${branch2}`];

  return {
    type: '地支六合',
    participants,
    traditionalTransformElement: rule.element,
    participantsAdjacent: isAdjacent,
    transformStemVisible: false,
    transformRooted: false,
    clashCandidates: clashEvidence,
    controllingElementPresent: false,
    competitionCandidates,
    evidence,
    sources: ['地支六合固定配对与传统化气五行表', '四柱位置与固定地支冲表'],
    interpretationStatus: '固定相合事实，合化作用待复核',
    interpretationLimit: HARMONY_INTERPRETATION_LIMIT,
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
    `月令状态：${profile.type === '天干五合' ? (profile.monthSeasonStatus ?? '未记录') : '不适用'}`,
    ...(profile.type === '天干五合'
      ? [
          `化神透干：${profile.transformStemVisible ? '有' : '无'}`,
          `化神根气：${profile.transformRooted ? '有' : '无'}`,
        ]
      : []),
    `固定相冲同见：${profile.clashCandidates.length ? profile.clashCandidates.join('、') : '未见'}`,
    `相同配对候选：${profile.competitionCandidates.length ? profile.competitionCandidates.join('、') : '未见'}`,
    `位置：${profile.participantsAdjacent ? '紧贴' : '隔位'}`,
  ];
  return [
    profile.type === '天干五合'
      ? `【${profile.type}】${profile.participants.join('与')}；传统化气五行资料${profile.traditionalTransformElement}${
          profile.traditionalTransformStem ? `（对应天干${profile.traditionalTransformStem}）` : ''
        }`
      : `【${profile.type}】${profile.participants.join('与')}；传统化气五行资料${profile.traditionalTransformElement}`,
    `解释状态：${profile.interpretationStatus}`,
    `条件明细：${conditions.join('；')}`,
    `原始依据：${profile.evidence.join('；')}`,
    `解释边界：${profile.interpretationLimit}`,
  ];
}
