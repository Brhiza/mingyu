/**
 * @file 干支相合与天干成化条件
 * @description 依据《三命通会》可复核条件区分成化、合而不化、争合与破合，不使用百分制权重。
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

const TRANSFORM_MONTHS: Record<Wuxing, { principal: string[]; secondary: string[] }> = {
  木: { principal: ['亥', '卯', '未'], secondary: ['寅'] },
  火: { principal: ['寅', '午', '戌'], secondary: ['巳'] },
  土: { principal: ['辰', '戌', '丑', '未'], secondary: ['午'] },
  金: { principal: ['巳', '酉', '丑'], secondary: ['申'] },
  水: { principal: ['申', '子', '辰'], secondary: ['亥'] },
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
  supported: boolean;
  evidence: string;
} {
  assertEarthlyBranch(monthBranch, '月支');
  assertWuxing(element, '化神');
  const status = SEASON_STATUS[monthBranch]?.[element];
  if (!status) {
    throw new Error(`月令旺衰数据缺失：${monthBranch}/${element}`);
  }
  const months = TRANSFORM_MONTHS[element];
  const isPrincipal = months.principal.includes(monthBranch);
  const isSecondary = months.secondary.includes(monthBranch);
  const supported = isPrincipal || isSecondary;
  const sourceCondition = isPrincipal ? '正令' : isSecondary ? '次令' : '不在规定月令';

  return {
    supported,
    evidence: `月令${monthBranch}对化神${element}为${status}，${sourceCondition}`,
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

function resolveStemLevel(conditions: {
  isDayStemPair: boolean;
  isAdjacent: boolean;
  monthSupported: boolean;
  hasClashBreak: boolean;
  hasControllingElement: boolean;
  hasCompetition: boolean;
}): HarmonyTransformLevel {
  if (conditions.hasClashBreak) return '逢冲破合';
  if (conditions.hasCompetition) return '争合不专';
  if (
    conditions.isDayStemPair &&
    conditions.isAdjacent &&
    conditions.monthSupported &&
    !conditions.hasControllingElement
  ) {
    return '成化';
  }
  return '合而不化';
}

function resolveDirection(level: HarmonyTransformLevel): HarmonyTransformDirection {
  if (level === '成化') return '向化';
  if (level === '逢冲破合') return '破合';
  if (level === '隔位不合') return '不合';
  return '合绊';
}

function buildConsequences(
  typeLabel: string,
  participant1: string,
  participant2: string,
  transformElement: Wuxing,
  level: HarmonyTransformLevel,
): string[] {
  if (level === '成化') {
    return [
      `${participant1}与${participant2}${typeLabel}成化${transformElement}`,
      `原组合可按化神${transformElement}参与后续结构判断`,
    ];
  }
  if (level === '争合不专') {
    return [
      `${participant1}与${participant2}${typeLabel}见争合，合意不专`,
      '不按成化处理，仍须保留各干原有属性',
    ];
  }
  if (level === '逢冲破合') {
    return [`${participant1}与${participant2}${typeLabel}受冲破`, '不按成化处理'];
  }
  return [`${participant1}与${participant2}${typeLabel}合而不化`, '保留原有属性，只论相合牵制'];
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
  const participantIndex1 = findParticipantIndex(pillars, pillar1, stem1, 'gan');
  const participantIndex2 = findParticipantIndex(pillars, pillar2, stem2, 'gan');
  const participantIndexes = [participantIndex1, participantIndex2];
  const evidence: string[] = [`${stem1}${stem2}合化${rule.element}，化神为${rule.stem}`];
  const monthCondition = getMonthCondition(monthBranch, rule.element);
  evidence.push(monthCondition.evidence);

  const isDayStemPair = participantIndexes.includes(2);
  const isAdjacent = Math.abs(participantIndex1 - participantIndex2) === 1;
  evidence.push(
    isDayStemPair ? '日干参与五合' : '非日干配合，只记相合，不作化气',
    isAdjacent ? '两干紧贴' : '两干隔位，不作成化',
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
    clashEvidence.push(`${stem1}被${clash1}相冲，构成冲破条件`);
  }
  if (
    clash2 &&
    pillars.some((pillar, index) => pillar.gan === clash2 && !participantIndexes.includes(index))
  ) {
    clashEvidence.push(`${stem2}被${clash2}相冲，构成冲破条件`);
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
      ? `有${controllingElement}克制化神${rule.element}`
      : `无明显五行克制化神${rule.element}`,
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
  if (hasCompetitionWithStem1) {
    evidence.push(`有其他天干争合${stem1}`);
  }
  if (hasCompetitionWithStem2) {
    evidence.push(`有其他天干争合${stem2}`);
  }

  const hasClashBreak = clashEvidence.length > 0;
  const hasCompetition = hasCompetitionWithStem1 || hasCompetitionWithStem2;
  const level = resolveStemLevel({
    isDayStemPair,
    isAdjacent,
    monthSupported: monthCondition.supported,
    hasClashBreak,
    hasControllingElement: hasControl,
    hasCompetition,
  });
  const direction = resolveDirection(level);
  const participants = [`${pillar1}${stem1}`, `${pillar2}${stem2}`];

  return {
    type: '天干五合',
    participants,
    transformElement: rule.element,
    transformStem: rule.stem,
    level,
    direction,
    dayStemInvolved: isDayStemPair,
    participantsAdjacent: isAdjacent,
    monthSupported: monthCondition.supported,
    transformStemVisible: Boolean(transformStemPillar),
    transformRooted: rootCount > 0,
    hasClashBreak,
    hasControllingElement: hasControl,
    hasCompetition,
    evidence,
    isTransformed: level === '成化',
    consequences: buildConsequences('合', participants[0], participants[1], rule.element, level),
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
    isAdjacent
      ? `${branch1}${branch2}紧贴，构成地支六合`
      : `${branch1}${branch2}隔位，只记六合对应关系，不作有效相合`,
    `地支藏干复杂，只论相合，不直接作化${rule.element}论`,
  ];

  const clashEvidence: string[] = [];
  const clash1 = BASIC_MAPPINGS.DI_ZHI_CHONG[branch1];
  const clash2 = BASIC_MAPPINGS.DI_ZHI_CHONG[branch2];
  if (
    clash1 &&
    pillars.some((pillar, index) => pillar.zhi === clash1 && !participantIndexes.includes(index))
  ) {
    clashEvidence.push(`${branch1}被${clash1}相冲，构成冲破条件`);
  }
  if (
    clash2 &&
    pillars.some((pillar, index) => pillar.zhi === clash2 && !participantIndexes.includes(index))
  ) {
    clashEvidence.push(`${branch2}被${clash2}相冲，构成冲破条件`);
  }
  evidence.push(...clashEvidence);

  const hasCompetition = pillars.some(
    (pillar, index) =>
      !participantIndexes.includes(index) &&
      ((pillar.zhi === branch1 && Math.abs(index - participantIndex2) === 1) ||
        (pillar.zhi === branch2 && Math.abs(index - participantIndex1) === 1)),
  );
  if (hasCompetition) evidence.push('六合另见相同地支争合，合意不专');

  const hasClashBreak = clashEvidence.length > 0;
  const level: HarmonyTransformLevel = !isAdjacent
    ? '隔位不合'
    : hasClashBreak
      ? '逢冲破合'
      : hasCompetition
        ? '争合不专'
        : '合而不化';
  const direction = resolveDirection(level);
  const participants = [`${pillar1}${branch1}`, `${pillar2}${branch2}`];

  return {
    type: '地支六合',
    participants,
    transformElement: rule.element,
    level,
    direction,
    participantsAdjacent: isAdjacent,
    monthSupported: false,
    transformStemVisible: false,
    transformRooted: false,
    hasClashBreak,
    hasControllingElement: false,
    hasCompetition,
    evidence,
    isTransformed: false,
    consequences:
      level === '逢冲破合'
        ? [`${participants[0]}与${participants[1]}六合受冲破`, '只记录冲合并见，不作成化处理']
        : level === '隔位不合'
          ? [`${participants[0]}与${participants[1]}隔位`, '只记六合对应关系，不作有效相合']
          : level === '争合不专'
            ? [`${participants[0]}与${participants[1]}六合见争合`, '只记录合意不专，不作成化处理']
            : [
                `${participants[0]}与${participants[1]}构成六合`,
                '地支只论相合，不直接改按化神五行',
              ],
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
    `月令条件：${
      profile.type === '天干五合'
        ? (profile.evidence.find((item) => item.startsWith('月令')) ?? '未记录')
        : '地支六合不以化气月令裁定'
    }`,
    `规定月令：${
      profile.type === '天干五合' ? (profile.monthSupported ? '符合' : '不符合') : '不适用'
    }`,
    ...(profile.type === '天干五合'
      ? [
          `化神透干：${profile.transformStemVisible ? '有' : '无'}`,
          `化神根气：${profile.transformRooted ? '有' : '无'}`,
        ]
      : []),
    `冲破：${profile.hasClashBreak ? '有' : '无'}`,
    `争合：${profile.hasCompetition ? '有' : '无'}`,
    `位置：${profile.participantsAdjacent ? '紧贴' : '隔位'}`,
  ];
  return [
    profile.type === '天干五合'
      ? `【${profile.type}】${profile.participants.join('与')}化${profile.transformElement}${
          profile.transformStem ? `（化神${profile.transformStem}）` : ''
        }`
      : `【${profile.type}】${profile.participants.join('与')}（不直接作化${profile.transformElement}论）`,
    `条件判定：${profile.level}`,
    `相合作用：${profile.direction}`,
    `条件明细：${conditions.join('；')}`,
    `评估依据：${profile.evidence.join('；')}`,
    `后续影响：${profile.consequences.join('；')}`,
  ];
}
