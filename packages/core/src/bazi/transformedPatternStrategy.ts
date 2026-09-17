/**
 * @file 五合化气主格核验
 * @description
 * 只把具备完整事实链的日干五合提升为化气主格；普通五合、次令、弱根和
 * 冲破等情况保留为结构候选，不覆盖原有月令格局。
 */

import { assessStemHarmonyTransform, type HarmonyPillarInput } from './harmonyTransform';
import { BASIC_MAPPINGS, HIDDEN_STEMS, TWELVE_STAGES_MAP } from './baziDefinitions';
import { collectEstablishedBranchFormations } from './baziFormationUtils';
import { collectAdjudicatedRootFacts, type RootClashStatus } from './baziRootAdjudication';
import {
  getRootTraditionalKind,
  hasStrongRootStage,
  type RootTraditionalKind,
} from './baziRootFacts';
import type { HiddenStems, PatternTransformationEvidence, Pillars, Wuxing } from './baziTypes';
import { assertPillars, getWuxing } from './baziUtils';

export interface TransformedPatternAssessment extends PatternTransformationEvidence {
  pattern: string;
  pair: [string, string];
}

interface TransformRule {
  pair: [string, string];
  element: Wuxing;
  pattern: string;
  jealousStem: string;
}

interface RootFact {
  stem: string;
  branch: string;
  pillar: string;
  traditionalKind: RootTraditionalKind;
  stage?: string;
  stable: boolean;
  actionable: boolean;
  clashStatus: RootClashStatus;
  clashed: boolean;
}

const PILLAR_KEYS = ['year', 'month', 'day', 'hour'] as const;
const PILLAR_LABELS = ['年柱', '月柱', '日柱', '时柱'] as const;
const TRANSFORM_RULES: TransformRule[] = [
  { pair: ['甲', '己'], element: '土', pattern: '甲己化土格', jealousStem: '乙' },
  { pair: ['乙', '庚'], element: '金', pattern: '乙庚化金格', jealousStem: '甲' },
  { pair: ['丙', '辛'], element: '水', pattern: '丙辛化水格', jealousStem: '丁' },
  { pair: ['丁', '壬'], element: '木', pattern: '丁壬化木格', jealousStem: '丙' },
  { pair: ['戊', '癸'], element: '火', pattern: '戊癸化火格', jealousStem: '己' },
];

function getStemElement(stem: string): Wuxing {
  const index = (BASIC_MAPPINGS.HEAVENLY_STEMS as readonly string[]).indexOf(stem);
  if (index < 0) {
    throw new Error('天干五行数据缺失：' + stem);
  }
  return BASIC_MAPPINGS.STEM_WUXING[index] as Wuxing;
}

function getControllingElement(element: Wuxing): Wuxing {
  const controller = Object.entries(BASIC_MAPPINGS.WUXING_KE).find(
    ([, target]) => target === element,
  )?.[0];
  if (!controller) {
    throw new Error('五行克制数据缺失：' + element);
  }
  return controller as Wuxing;
}

function getGeneratingElement(element: Wuxing): Wuxing {
  const resource = Object.entries(BASIC_MAPPINGS.WUXING_SHENG).find(
    ([, target]) => target === element,
  )?.[0];
  if (!resource) {
    throw new Error('五行生扶数据缺失：' + element);
  }
  return resource as Wuxing;
}

function collectRootFacts(
  element: Wuxing,
  pillars: Pillars,
  excludedIndexes = new Set<number>(),
): RootFact[] {
  const hiddenStems = Object.fromEntries(
    PILLAR_KEYS.map((key) => [key, HIDDEN_STEMS[pillars[key].zhi]]),
  ) as unknown as HiddenStems;
  return collectAdjudicatedRootFacts(pillars, hiddenStems, element, getWuxing)
    .filter((root) => !excludedIndexes.has(PILLAR_KEYS.indexOf(root.position)))
    .map((root) => ({
      stem: root.stem,
      branch: root.branch,
      pillar: PILLAR_LABELS[PILLAR_KEYS.indexOf(root.position)],
      traditionalKind: getRootTraditionalKind(root),
      stage: TWELVE_STAGES_MAP[root.stem]?.[root.branch],
      stable: root.stable,
      actionable: root.actionable,
      clashStatus: root.clashStatus,
      clashed: !root.stable,
    }));
}

/** 化神得根采用所有经裁决可用的传统结构根，包括墓库、余气轻根。 */
function supportsTransformElement(fact: RootFact): boolean {
  return fact.traditionalKind !== '弱藏';
}

/** 精确本干采用本气、生禄、余气；异干同五行仍须达到长生、临官或帝旺。 */
function blocksOriginalElement(fact: RootFact, dayStem: string): boolean {
  if (fact.stem !== dayStem) return hasStrongRootStage(fact);
  return ['本气', '生禄', '余气'].includes(fact.traditionalKind);
}

/** 印根返性保留长生、临官、帝旺门槛，不把墓库本气自动升格。 */
function blocksByResourceReturn(fact: RootFact): boolean {
  return hasStrongRootStage(fact);
}

function formatRootFact(fact: RootFact): string {
  const kind =
    fact.traditionalKind === '正库' || fact.traditionalKind === '余气'
      ? fact.traditionalKind + '轻根'
      : fact.traditionalKind === '生禄'
        ? (fact.stage || '生禄') + '根'
        : fact.traditionalKind;
  return (
    fact.pillar +
    fact.branch +
    '藏' +
    fact.stem +
    '（' +
    kind +
    (fact.stage && fact.traditionalKind !== '生禄' ? '、' + fact.stage : '') +
    (fact.clashed ? '、所在支受冲、' + fact.clashStatus : '') +
    '）'
  );
}

function createHarmonyPillars(pillars: Pillars): HarmonyPillarInput[] {
  return PILLAR_KEYS.map((key, index) => ({
    label: PILLAR_LABELS[index],
    gan: pillars[key].gan,
    zhi: pillars[key].zhi,
    hiddenStems: HIDDEN_STEMS[pillars[key].zhi],
  }));
}

function findRule(dayStem: string): TransformRule | undefined {
  return TRANSFORM_RULES.find((rule) => rule.pair.includes(dayStem));
}

function createEvidence(
  rule: TransformRule,
  dayStem: string,
  partnerStem: string,
  status: PatternTransformationEvidence['status'],
  evidence: string[],
  conditions: string[],
): TransformedPatternAssessment {
  const statusText =
    status === '成化'
      ? '化神' + rule.element + '条件闭合'
      : status === '待核验'
        ? '化神' + rule.element + '仍有条件待核验'
        : '化神' + rule.element + '存在破化反证';
  const basis =
    '依据《子平真诠·论杂格》与《滴天髓》化气口径，日干' +
    dayStem +
    '与' +
    partnerStem +
    '成' +
    rule.pair.join('') +
    '合，' +
    statusText +
    '。';

  return {
    pattern: rule.pattern,
    pair: rule.pair,
    element: rule.element,
    status,
    basis,
    evidence,
    conditions,
  };
}

/**
 * 评估日干五合是否足以进入化气主格。
 *
 * 评估层只使用结构化事实：日干位置、月令本气或已成立会局、明干、根气层次、
 * 冲破、争合和本气控制。不会从 harmonyTransform 的展示文本反解析条件。
 */
export function evaluateTransformedPattern(
  pillars: Pillars,
): TransformedPatternAssessment | undefined {
  assertPillars(pillars);

  const dayStem = pillars.day.gan;
  const rule = findRule(dayStem);
  if (!rule) return undefined;

  const partnerStem = rule.pair.find((stem) => stem !== dayStem);
  if (!partnerStem) return undefined;

  const partnerIndexes = PILLAR_KEYS.map((key, index) =>
    pillars[key].gan === partnerStem ? index : -1,
  ).filter((index) => index >= 0);
  if (!partnerIndexes.length) return undefined;

  const partnerIndex = [...partnerIndexes].sort((left, right) => {
    const leftDistance = Math.abs(left - 2);
    const rightDistance = Math.abs(right - 2);
    if (leftDistance !== rightDistance) return leftDistance - rightDistance;
    return left - right;
  })[0];
  const harmonyPillars = createHarmonyPillars(pillars);
  const harmony = assessStemHarmonyTransform(
    dayStem,
    '日柱',
    partnerStem,
    PILLAR_LABELS[partnerIndex],
    pillars.month.zhi,
    harmonyPillars,
  );

  const evidence: string[] = [
    '日干' +
      dayStem +
      '与' +
      partnerStem +
      '构成' +
      rule.pair.join('') +
      '合，配干位于' +
      PILLAR_LABELS[partnerIndex],
  ];
  const conditions: string[] = [];
  const blockers: string[] = [];
  const pending: string[] = [];

  if (harmony.participantsAdjacent) {
    evidence.push('日干与配干紧贴于' + PILLAR_LABELS[partnerIndex]);
    conditions.push('日干与配干紧贴：满足');
  } else {
    evidence.push('日干与配干隔位，' + PILLAR_LABELS[partnerIndex] + '不能作为紧贴配干');
    conditions.push('日干与配干紧贴：不满足');
    blockers.push('日干与配干隔位');
  }

  const monthPrincipalStem = HIDDEN_STEMS[pillars.month.zhi]?.[0];
  const monthPrincipalElement = monthPrincipalStem ? getStemElement(monthPrincipalStem) : undefined;
  const establishedFormations = collectEstablishedBranchFormations(pillars).filter(
    (formation) => formation.wuxing === rule.element,
  );
  const hasMonthPrincipalSupport = monthPrincipalElement === rule.element;
  if (hasMonthPrincipalSupport) {
    evidence.push(
      '月令' +
        pillars.month.zhi +
        '本气' +
        monthPrincipalStem +
        '属' +
        rule.element +
        '，化神得月令本气支持',
    );
    conditions.push('月令本气同化神：满足');
  } else if (establishedFormations.length) {
    evidence.push(
      ...establishedFormations.map(
        (formation) =>
          '地支' +
          formation.branches.join('、') +
          '已成立' +
          formation.type +
          rule.element +
          '局，月令状态为' +
          formation.monthStatus,
      ),
    );
    conditions.push('化神有已成立三合或三会局支持：满足');
  } else {
    evidence.push(
      '月令' + pillars.month.zhi + '本气不属' + rule.element + '，当前未见化神已成立支局',
    );
    conditions.push('月令本气或已成立支局支持：待核验');
    pending.push('化神未见月令本气或已成立支局支持');
  }

  const participantIndexes = new Set([2, partnerIndex]);
  const visibleTransformStems = PILLAR_KEYS.flatMap((key, index) => {
    if (participantIndexes.has(index)) return [];
    return getStemElement(pillars[key].gan) === rule.element
      ? ['' + PILLAR_LABELS[index] + '透' + pillars[key].gan]
      : [];
  });
  const transformRootFacts = collectRootFacts(rule.element, pillars, participantIndexes);
  const actionableTransformRoots = transformRootFacts.filter(
    (fact) => supportsTransformElement(fact) && fact.actionable,
  );
  const pendingTransformRoots = transformRootFacts.filter(
    (fact) => supportsTransformElement(fact) && !fact.actionable,
  );
  const weakTransformRoots = transformRootFacts.filter((fact) => !supportsTransformElement(fact));

  if (visibleTransformStems.length) {
    evidence.push('化神明透：' + visibleTransformStems.join('、'));
    conditions.push('化神明透或有独立有效根：满足');
  } else if (actionableTransformRoots.length) {
    evidence.push('化神独立有效根：' + actionableTransformRoots.map(formatRootFact).join('、'));
    conditions.push('化神明透或有独立有效根：满足');
  } else {
    if (pendingTransformRoots.length) {
      evidence.push('化神受冲根待核：' + pendingTransformRoots.map(formatRootFact).join('、'));
    }
    if (weakTransformRoots.length) {
      evidence.push('化神仅见弱层根气：' + weakTransformRoots.map(formatRootFact).join('、'));
    }
    conditions.push('化神明透或有独立有效根：待核验');
    pending.push('化神尚无明透或经裁决可用的独立有效根');
  }

  const dayElement = getStemElement(dayStem);
  const dayRootFacts = collectRootFacts(dayElement, pillars);
  if (dayElement === rule.element) {
    evidence.push('日干' + dayStem + '与化神' + rule.element + '同气，所见根气归入化神根证据');
    conditions.push('原日干根气阻化：不适用');
  } else {
    const blockingRoots = dayRootFacts.filter((fact) => blocksOriginalElement(fact, dayStem));
    const actionableExactRoots = blockingRoots.filter(
      (fact) => fact.stem === dayStem && fact.actionable,
    );
    const actionableStrongRoots = blockingRoots.filter(
      (fact) => fact.stem !== dayStem && fact.actionable,
    );
    const pendingRoots = blockingRoots.filter((fact) => !fact.actionable);
    const weakRoots = dayRootFacts.filter((fact) => !blocksOriginalElement(fact, dayStem));

    if (actionableExactRoots.length || actionableStrongRoots.length) {
      evidence.push(
        ...actionableExactRoots.map((fact) => '日干原根：' + formatRootFact(fact)),
        ...actionableStrongRoots.map((fact) => '日干同气强根：' + formatRootFact(fact)),
      );
      conditions.push('原日干根气阻化：存在');
      blockers.push('日干仍有经裁决可用的本根或同气强根');
    } else {
      conditions.push('原日干根气阻化：未见');
    }
    if (pendingRoots.length) {
      evidence.push(
        ...pendingRoots.map((fact) => '日干根气受冲，保留待核：' + formatRootFact(fact)),
      );
      pending.push('日干根气有受冲事实，稳定性仍需核验');
    }
    if (weakRoots.length) {
      evidence.push(
        ...weakRoots.map(
          (fact) =>
            (fact.stem === dayStem ? '日干原根' : '日干同气根') +
            '仅为弱层旁证：' +
            formatRootFact(fact),
        ),
      );
    }
  }

  const resourceElement = getGeneratingElement(dayElement);
  if (dayElement === rule.element) {
    conditions.push('原日主印根返性阻化：不适用');
  } else if (resourceElement === rule.element) {
    evidence.push(
      '日主印根' + resourceElement + '与化神' + rule.element + '同气，根气归入化神证据',
    );
    conditions.push('原日主印根返性阻化：不适用');
  } else {
    const resourceRootFacts = collectRootFacts(resourceElement, pillars);
    const actionableResourceRoots = resourceRootFacts.filter(
      (fact) => blocksByResourceReturn(fact) && fact.actionable,
    );
    const pendingResourceRoots = resourceRootFacts.filter(
      (fact) => blocksByResourceReturn(fact) && !fact.actionable,
    );
    const weakResourceRoots = resourceRootFacts.filter((fact) => !blocksByResourceReturn(fact));

    if (actionableResourceRoots.length) {
      evidence.push(
        ...actionableResourceRoots.map((fact) => '日主印根返性：' + formatRootFact(fact)),
      );
      conditions.push('原日主印根返性阻化：存在');
      blockers.push('原日主有经裁决可用的印根，返性未尽');
    } else {
      conditions.push('原日主印根返性阻化：未见');
    }
    if (pendingResourceRoots.length) {
      evidence.push(
        ...pendingResourceRoots.map((fact) => '日主印根受冲，保留待核：' + formatRootFact(fact)),
      );
      pending.push('原日主印根有受冲事实，返性稳定性仍需核验');
    }
    if (weakResourceRoots.length) {
      evidence.push(
        ...weakResourceRoots.map((fact) => '日主印根仅为弱层旁证：' + formatRootFact(fact)),
      );
    }
  }

  const controllingElement = getControllingElement(rule.element);
  if (harmony.hasControllingElement) {
    evidence.push('明干或地支本气见' + controllingElement + '克制化神' + rule.element);
    conditions.push('明干或本气克化神：存在' + controllingElement + '克制');
    blockers.push('明干或地支本气见' + controllingElement + '克化神');
  } else {
    conditions.push('明干或本气克化神：未见' + controllingElement + '克制');
  }

  const visibleStems = PILLAR_KEYS.map((key) => pillars[key].gan);
  const hasRepeatedPairStem =
    visibleStems.filter((stem) => stem === dayStem).length > 1 ||
    visibleStems.filter((stem) => stem === partnerStem).length > 1;
  const hasJealousStem = visibleStems.some(
    (stem, index) => !participantIndexes.has(index) && stem === rule.jealousStem,
  );
  if (harmony.hasCompetition || hasRepeatedPairStem || hasJealousStem) {
    const competitionFacts = [
      harmony.hasCompetition ? '另有天干争合' : '',
      hasRepeatedPairStem ? '配合天干重复' : '',
      hasJealousStem ? '见' + rule.jealousStem + '妒合' : '',
    ].filter(Boolean);
    evidence.push('配合不专：' + competitionFacts.join('、'));
    conditions.push('争合、妒合与配合重复：存在');
    blockers.push(...competitionFacts);
  } else {
    conditions.push('争合、妒合与配合重复：未见');
  }

  if (harmony.hasClashBreak) {
    evidence.push('配合天干见外干冲破');
    conditions.push('配合天干冲破：存在');
    blockers.push('配合天干受冲破');
  } else {
    conditions.push('配合天干冲破：未见');
  }

  if (
    pendingTransformRoots.length &&
    !visibleTransformStems.length &&
    !actionableTransformRoots.length
  ) {
    pending.push('化神有效根所在支受冲，根气稳定性仍需核验');
  }

  const status: PatternTransformationEvidence['status'] = blockers.length
    ? '存在反证'
    : pending.length
      ? '待核验'
      : '成化';

  if (status === '待核验') {
    conditions.push(...pending.map((item) => item + '：待核验'));
  }
  if (status === '存在反证') {
    conditions.push(...blockers.map((item) => item + '：不满足'));
  }

  return createEvidence(rule, dayStem, partnerStem, status, evidence, conditions);
}
