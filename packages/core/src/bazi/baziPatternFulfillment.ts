import { BASIC_MAPPINGS, HIDDEN_STEMS, LU_BRANCH_MAP, REN_BRANCH_MAP } from './baziDefinitions';
import { TIAN_GAN_HE } from '../ganzhi/relations';
import { assessAllHarmonyTransforms } from './harmonyTransform';
import type { HarmonyTransformProfile } from '../types/analysis';
import type { Pillars } from './baziTypes';
import { assertHeavenlyStem, assertPillars, getWuxing } from './baziUtils';

export type PatternConditionStatus = '满足' | '不满足' | '资料不足';

export interface PatternConditionFact {
  key: string;
  status: PatternConditionStatus;
  detail: string;
}

export interface PatternStemEvidence {
  stem: string;
  tenGod: string;
  pillar: 'year' | 'month' | 'day' | 'hour';
  pillarName: string;
  branch: string;
  placement: '透干' | '藏干';
  hiddenRole?: '本气' | '中气' | '余气';
  rooted: boolean;
  rootType: '本根' | '同类根' | '无根';
  rootPositions: string[];
  clashedRootPositions: string[];
}

export interface PatternInteractionEvidence {
  type: '天干五合' | '地支六合' | '地支冲' | '制化';
  relation: string;
  source: string;
  target: string;
  status: PatternConditionStatus;
  detail: string;
}

export type PatternPathPosition = '紧贴' | '隔位' | '未判定';

export interface PatternPathEvaluation {
  key: string;
  label: string;
  status: PatternConditionStatus;
  source: string[];
  target: string[];
  /** 来源与作用对象的结构化天干，供取用裁决引用，不从 detail 文本反解析。 */
  sourceStems: string[];
  targetStems: string[];
  /** 只记录四柱外干之间的实际位置，不把距离折算为分数。 */
  position: PatternPathPosition;
  positionPairs: string[];
  detail: string;
}

export interface PatternRemedy {
  stem: string;
  pillar: 'year' | 'month' | 'day' | 'hour';
  tenGod: string;
  effect: string;
  placement?: '透干' | '藏干';
}

export interface PatternFulfillmentResult {
  patternName: string;
  status: '成格' | '破格' | '破而复成' | '平常' | '未判定';
  basis: string;
  contradiction: string;
  remedies: PatternRemedy[];
  summary: string;
  evidence?: string[];
  conditions?: string[];
  conditionFacts?: PatternConditionFact[];
  rootEvidence?: PatternStemEvidence[];
  interactionEvidence?: PatternInteractionEvidence[];
  pathEvaluations?: PatternPathEvaluation[];
}

export interface PatternFulfillmentOptions {
  /** 复用旺衰规则链的定性结果；不在此处重新计算分值。 */
  strengthStatus?: string;
  /** 复用月令司权事实，处理交节分日司令口径。 */
  monthCommander?: string;
}

type GetTenGodFn = (gan: string, dayMaster: string) => string;
type PillarPosition = keyof Pillars;
type ObservedPlacement = '透干' | '藏干';

const POSITIONS: readonly PillarPosition[] = ['year', 'month', 'day', 'hour'];
const PILLAR_NAMES: Record<PillarPosition, string> = {
  year: '年柱',
  month: '月柱',
  day: '日柱',
  hour: '时柱',
};

const HIDDEN_ROLE: Record<number, PatternStemEvidence['hiddenRole']> = {
  0: '本气',
  1: '中气',
  2: '余气',
};

interface ObservedStem {
  stem: string;
  tenGod: string;
  pillar: PillarPosition;
  branch: string;
  placement: ObservedPlacement;
  hiddenRole?: PatternStemEvidence['hiddenRole'];
}

interface RootInfo {
  rooted: boolean;
  stable: boolean;
  rootType: PatternStemEvidence['rootType'];
  rootPositions: string[];
  clashedRootPositions: string[];
}

interface GodGroup {
  entries: ObservedStem[];
  visible: ObservedStem[];
  hidden: ObservedStem[];
  rooted: boolean;
  stable: boolean;
}

interface PathPositionEvidence {
  position: PatternPathPosition;
  pairs: string[];
  hasAdjacentPair: boolean;
}

interface GroupUsability {
  status: PatternConditionStatus;
  effective: boolean;
  uncertain: boolean;
  detail: string;
}

function normalizePatternName(patternName: string): string {
  return patternName.replace(/^杂气/, '').replace(/^偏官/, '七杀');
}

function buildObserved(
  pillars: Pillars,
  dayMaster: string,
  getTenGod: GetTenGodFn,
): ObservedStem[] {
  return POSITIONS.flatMap((pillar) => {
    const current = pillars[pillar];
    const visible =
      pillar === 'day'
        ? []
        : [
            {
              stem: current.gan,
              tenGod: getTenGod(current.gan, dayMaster),
              pillar,
              branch: current.zhi,
              placement: '透干' as const,
            },
          ];
    const hidden = (HIDDEN_STEMS[current.zhi] ?? []).map((stem, index) => ({
      stem,
      tenGod: getTenGod(stem, dayMaster),
      pillar,
      branch: current.zhi,
      placement: '藏干' as const,
      hiddenRole: HIDDEN_ROLE[index],
    }));
    return [...visible, ...hidden];
  });
}

function formatObserved(item: ObservedStem): string {
  const role = item.hiddenRole && item.hiddenRole !== '本气' ? `/${item.hiddenRole}` : '';
  return `${PILLAR_NAMES[item.pillar]}${item.placement}${role}${item.stem}（${item.tenGod}）`;
}

/**
 * 柱位只采用本库已有的“紧贴/隔位”事实：年、月、日、时相邻为紧贴，
 * 其余为隔位。这个边界来自 harmonyTransform 对五合、六合的现有口径，
 * 不是把柱距换算成强弱分数；通用制化规则也没有把隔位关系直接当成有效作用。
 */
function getPathPositionEvidence(
  source: ObservedStem[],
  target: ObservedStem[],
): PathPositionEvidence {
  const pairs = source.flatMap((sourceItem) =>
    target.map((targetItem) => {
      const distance = Math.abs(
        POSITIONS.indexOf(sourceItem.pillar) - POSITIONS.indexOf(targetItem.pillar),
      );
      return {
        distance,
        label: `${formatObserved(sourceItem)}与${formatObserved(targetItem)}`,
      };
    }),
  );
  const hasAdjacentPair = pairs.some((pair) => pair.distance === 1);
  return {
    position: hasAdjacentPair ? '紧贴' : pairs.length ? '隔位' : '未判定',
    pairs: pairs.map((pair) => pair.label),
    hasAdjacentPair,
  };
}

function formatPathPosition(evidence: PathPositionEvidence): string {
  if (!evidence.pairs.length) return '未判定（未形成两端明透组合）';
  return `${evidence.position}（${evidence.pairs.join('；')}）`;
}

function formatRootPosition(item: ObservedStem): string {
  return `${PILLAR_NAMES[item.pillar]}${item.branch}藏${item.stem}${item.hiddenRole ? `（${item.hiddenRole}）` : ''}`;
}

function isBranchClashed(branch: string, pillars: Pillars, ownPillar: PillarPosition): boolean {
  const clash = BASIC_MAPPINGS.DI_ZHI_CHONG[branch];
  return Boolean(
    clash &&
    POSITIONS.some((position) => position !== ownPillar && pillars[position].zhi === clash),
  );
}

function getRootInfo(item: ObservedStem, observed: ObservedStem[], pillars: Pillars): RootInfo {
  const itemWuxing = getWuxing(item.stem);
  const roots = observed.filter(
    (candidate) => candidate.placement === '藏干' && getWuxing(candidate.stem) === itemWuxing,
  );
  const exactRoots = roots.filter((candidate) => candidate.stem === item.stem);
  const rootPositions = roots.map(formatRootPosition);
  const clashedRootPositions = roots
    .filter((candidate) => isBranchClashed(candidate.branch, pillars, candidate.pillar))
    .map(formatRootPosition);

  return {
    rooted: roots.length > 0,
    stable: roots.length > 0 && clashedRootPositions.length < roots.length,
    rootType: exactRoots.length ? '本根' : roots.length ? '同类根' : '无根',
    rootPositions,
    clashedRootPositions,
  };
}

function getGodGroup(
  gods: readonly string[],
  observed: ObservedStem[],
  pillars: Pillars,
): GodGroup {
  const entries = observed.filter((item) => gods.includes(item.tenGod));
  const visible = entries.filter((item) => item.placement === '透干');
  const hidden = entries.filter((item) => item.placement === '藏干');
  const rootInfos = visible.length
    ? visible.map((item) => getRootInfo(item, observed, pillars))
    : hidden.map((item) => getRootInfo(item, observed, pillars));
  return {
    entries,
    visible,
    hidden,
    rooted: rootInfos.some((info) => info.rooted),
    stable: rootInfos.some((info) => info.stable),
  };
}

function toStemEvidence(
  item: ObservedStem,
  observed: ObservedStem[],
  pillars: Pillars,
): PatternStemEvidence {
  const root = getRootInfo(item, observed, pillars);
  return {
    stem: item.stem,
    tenGod: item.tenGod,
    pillar: item.pillar,
    pillarName: PILLAR_NAMES[item.pillar],
    branch: item.branch,
    placement: item.placement,
    ...(item.hiddenRole ? { hiddenRole: item.hiddenRole } : {}),
    rooted: root.rooted,
    rootType: root.rootType,
    rootPositions: root.rootPositions,
    clashedRootPositions: root.clashedRootPositions,
  };
}

function buildHarmonyProfiles(pillars: Pillars): HarmonyTransformProfile[] {
  return assessAllHarmonyTransforms(
    POSITIONS.map((pillar) => ({
      label: pillar,
      gan: pillars[pillar].gan,
      zhi: pillars[pillar].zhi,
      hiddenStems: HIDDEN_STEMS[pillars[pillar].zhi],
    })),
    pillars.month.zhi,
  );
}

function findHarmonyProfiles(
  item: ObservedStem,
  profiles: HarmonyTransformProfile[],
): HarmonyTransformProfile[] {
  if (item.placement !== '透干') return [];
  const token = `${item.pillar}${item.stem}`;
  return profiles.filter(
    (profile) => profile.type === '天干五合' && profile.participants.includes(token),
  );
}

function isStemBlocked(item: ObservedStem, profiles: HarmonyTransformProfile[]): boolean {
  return findHarmonyProfiles(item, profiles).some((profile) =>
    ['合而不化', '争合不专', '成化'].includes(profile.level),
  );
}

function assessGroupUsability(
  label: string,
  group: GodGroup,
  observed: ObservedStem[],
  pillars: Pillars,
  harmonyProfiles: HarmonyTransformProfile[],
): GroupUsability {
  if (!group.visible.length) {
    return {
      status: '不满足',
      effective: false,
      uncertain: false,
      detail: `${label}未透干。`,
    };
  }

  const roots = group.visible.map((item) => ({
    item,
    root: getRootInfo(item, observed, pillars),
  }));
  const stable = roots.filter(({ root }) => root.stable);
  const available = stable.filter(({ item }) => !isStemBlocked(item, harmonyProfiles));
  const blocked = stable.filter(({ item }) => isStemBlocked(item, harmonyProfiles));
  const withoutStableRoot = roots.filter(({ root }) => !root.stable);

  if (available.length) {
    const detail = [
      `${label}可用项：${available.map(({ item }) => formatObserved(item)).join('、')}，有稳定根气且未见合绊`,
      blocked.length
        ? `受合绊项：${blocked.map(({ item }) => formatObserved(item)).join('、')}`
        : '',
      withoutStableRoot.length
        ? `根气不足项：${withoutStableRoot.map(({ item }) => formatObserved(item)).join('、')}`
        : '',
    ]
      .filter(Boolean)
      .join('；');
    return {
      status: withoutStableRoot.length ? '资料不足' : '满足',
      effective: true,
      uncertain: withoutStableRoot.length > 0,
      detail: `${detail}。`,
    };
  }

  if (blocked.length === stable.length && stable.length === roots.length) {
    return {
      status: '不满足',
      effective: false,
      uncertain: false,
      detail: `${label}虽透且根气稳定，但${blocked
        .map(({ item }) =>
          findHarmonyProfiles(item, harmonyProfiles).map(formatHarmonyProfile).join('、'),
        )
        .filter(Boolean)
        .join('；')}使其受合绊、争合或成化，当前不计作有效作用。`,
    };
  }

  return {
    status: '资料不足',
    effective: false,
    uncertain: true,
    detail: `${label}虽透，但${roots
      .map(({ item, root }) => {
        if (!root.rooted) return `${formatObserved(item)}无同类藏根`;
        if (!root.stable)
          return `${formatObserved(item)}根气受冲（${root.clashedRootPositions.join('、')}）`;
        return `${formatObserved(item)}受合绊或作用未闭合`;
      })
      .join('；')}，当前不能确认其为有效作用。`,
  };
}

function formatHarmonyProfile(profile: HarmonyTransformProfile): string {
  return `${profile.participants.join('与')}：${profile.level}（${profile.direction}）`;
}

function buildHarmonyEvidence(profiles: HarmonyTransformProfile[]): PatternInteractionEvidence[] {
  return profiles.map((profile) => {
    const blocked = ['合而不化', '争合不专', '成化'].includes(profile.level);
    const status: PatternConditionStatus = blocked ? '不满足' : '满足';
    return {
      type: profile.type,
      relation: profile.level,
      source: profile.participants[0] ?? '未记录',
      target: profile.participants[1] ?? '未记录',
      status,
      detail: `${formatHarmonyProfile(profile)}；${profile.evidence.join('；')}`,
    };
  });
}

function formatGroup(group: GodGroup): string {
  return group.entries.length ? group.entries.map(formatObserved).join('、') : '未见';
}

function buildRootEvidence(
  groups: readonly GodGroup[],
  observed: ObservedStem[],
  pillars: Pillars,
): PatternStemEvidence[] {
  const keys = new Set<string>();
  return groups
    .flatMap((group) => group.entries)
    .filter((item) => {
      const key = `${item.pillar}:${item.placement}:${item.stem}:${item.tenGod}`;
      if (keys.has(key)) return false;
      keys.add(key);
      return true;
    })
    .map((item) => toStemEvidence(item, observed, pillars));
}

function buildGroupCondition(
  key: string,
  label: string,
  group: GodGroup,
  requireVisible = true,
  harmonyProfiles: HarmonyTransformProfile[] = [],
  observed: ObservedStem[] = [],
  pillars?: Pillars,
): PatternConditionFact {
  if (!group.entries.length) return { key, status: '不满足', detail: `${label}未见。` };
  if (requireVisible && !group.visible.length) {
    return {
      key,
      status: '资料不足',
      detail: `${label}仅见于${formatGroup(group)}，未透干，不能按明示格神直接定成败。`,
    };
  }
  if (!group.rooted) {
    return { key, status: '不满足', detail: `${label}虽有${formatGroup(group)}，但未见同类藏根。` };
  }
  if (!group.stable) {
    return { key, status: '不满足', detail: `${label}根气均落在被冲地支，根气不稳。` };
  }
  if (requireVisible && pillars && observed.length) {
    const usability = assessGroupUsability(label, group, observed, pillars, harmonyProfiles);
    if (!usability.effective) {
      return {
        key,
        status: usability.status,
        detail: usability.detail,
      };
    }
    if (usability.uncertain) {
      return {
        key,
        status: '资料不足',
        detail: `${usability.detail} 格神尚有未闭合的根气条件，不能直接定成格。`,
      };
    }
  }
  return {
    key,
    status: '满足',
    detail: `${label}见${formatGroup(group)}，有稳定根气；透干与柱位已分别记录。`,
  };
}

function evaluatePath(
  key: string,
  label: string,
  sourceGods: readonly string[],
  targetGods: readonly string[],
  observed: ObservedStem[],
  pillars: Pillars,
  harmonyProfiles: HarmonyTransformProfile[],
): PatternPathEvaluation {
  const sourceGroup = getGodGroup(sourceGods, observed, pillars);
  const targetGroup = getGodGroup(targetGods, observed, pillars);
  const source = sourceGroup.visible;
  const target = targetGroup.visible;
  const positionEvidence = getPathPositionEvidence(source, target);
  const createResult = (
    status: PatternConditionStatus,
    detail: string,
    sourceItems: ObservedStem[] = sourceGroup.entries,
    targetItems: ObservedStem[] = targetGroup.entries,
  ): PatternPathEvaluation => ({
    key,
    label,
    status,
    source: sourceItems.map(formatObserved),
    target: targetItems.map(formatObserved),
    sourceStems: sourceItems.map((item) => item.stem),
    targetStems: targetItems.map((item) => item.stem),
    position: positionEvidence.position,
    positionPairs: positionEvidence.pairs,
    detail,
  });

  if (!sourceGroup.entries.length || !targetGroup.entries.length) {
    return createResult(
      '不满足',
      `${label}缺少${!sourceGroup.entries.length ? '来源' : '作用对象'}；仅凭未出现的十神不能认定制化。`,
    );
  }
  if (!source.length || !target.length) {
    return createResult(
      '资料不足',
      `${label}的${!source.length ? '来源' : '作用对象'}仅藏不透，位置条件不足，不能认定有效作用。`,
    );
  }

  const rootedSource = source.filter((item) => getRootInfo(item, observed, pillars).stable);
  const rootedTarget = target.filter((item) => getRootInfo(item, observed, pillars).stable);
  if (!rootedSource.length || !rootedTarget.length) {
    return createResult(
      '不满足',
      `${label}要求双方有稳定根气；${!rootedSource.length ? '来源无稳定根' : ''}${!rootedSource.length && !rootedTarget.length ? '，' : ''}${!rootedTarget.length ? '作用对象无稳定根' : ''}。`,
      source,
      target,
    );
  }

  const blockedSource = rootedSource.filter((item) => isStemBlocked(item, harmonyProfiles));
  const blockedTarget = rootedTarget.filter((item) => isStemBlocked(item, harmonyProfiles));
  const availableSource = rootedSource.filter((item) => !isStemBlocked(item, harmonyProfiles));
  const availableTarget = rootedTarget.filter((item) => !isStemBlocked(item, harmonyProfiles));
  if (!availableSource.length || !availableTarget.length) {
    const blocked = [...blockedSource, ...blockedTarget]
      .flatMap((item) => findHarmonyProfiles(item, harmonyProfiles).map(formatHarmonyProfile))
      .join('；');
    return createResult(
      '不满足',
      `${label}的${!availableSource.length ? '来源' : '作用对象'}被合绊、争合或成化改变；${blocked || '未记录可用干支作用'}。`,
      source,
      target,
    );
  }

  const availablePosition = getPathPositionEvidence(availableSource, availableTarget);
  if (!availablePosition.hasAdjacentPair) {
    return createResult(
      '资料不足',
      `${label}虽有透干、稳定根气且未见合绊，但仅见${formatPathPosition(
        availablePosition,
      )}；依据当前紧贴柱位口径，隔位只记录事实，不自动认定为有效制化。`,
      availableSource,
      availableTarget,
    );
  }

  return createResult(
    '满足',
    `${label}来源${availableSource.map(formatObserved).join('、')}与作用对象${availableTarget
      .map(formatObserved)
      .join('、')}均透干、有稳定根气，${formatPathPosition(availablePosition)}且未见合绊阻断。`,
    availableSource,
    availableTarget,
  );
}

/**
 * 以日主本干作为明确作用对象评估“印生身”。日主不属于外透十神，
 * 不能用任意一枚比肩代替，否则会把比劫透干误当成印星已经生身。
 */
function evaluatePathToDayMaster(
  key: string,
  label: string,
  sourceGods: readonly string[],
  observed: ObservedStem[],
  pillars: Pillars,
  dayMaster: string,
  harmonyProfiles: HarmonyTransformProfile[],
): PatternPathEvaluation {
  const dayMasterTarget: ObservedStem = {
    stem: dayMaster,
    tenGod: '日主',
    pillar: 'day',
    branch: pillars.day.zhi,
    placement: '透干',
  };
  return evaluatePath(
    key,
    label,
    sourceGods,
    ['日主'],
    [...observed, dayMasterTarget],
    pillars,
    harmonyProfiles,
  );
}

/**
 * 把同一救应所需的连续作用链合成为一条可核验事实。
 * 每一段都满足才算链路满足；任一段明确不满足则链路不满足，
 * 其余情况保留资料不足，避免以后半段生克代替前半段承接。
 */
function combinePathChain(
  key: string,
  label: string,
  parts: PatternPathEvaluation[],
): PatternPathEvaluation {
  const hasFailure = parts.some((part) => part.status === '不满足');
  const hasUnknown = parts.some((part) => part.status === '资料不足');
  const status: PatternConditionStatus = hasFailure ? '不满足' : hasUnknown ? '资料不足' : '满足';
  const position: PatternPathPosition = parts.every((part) => part.position === '紧贴')
    ? '紧贴'
    : parts.some((part) => part.position === '未判定')
      ? '未判定'
      : '隔位';
  return {
    key,
    label,
    status,
    source: parts[0]?.source ?? [],
    target: parts.at(-1)?.target ?? [],
    sourceStems: parts[0]?.sourceStems ?? [],
    targetStems: parts.at(-1)?.targetStems ?? [],
    position,
    positionPairs: parts.flatMap((part) => part.positionPairs),
    detail: `${label}由${parts
      .map((part) => `${part.label}=${part.status}（${part.detail}）`)
      .join('；')}组成。`,
  };
}

function isMonthGate(
  targetGods: readonly string[],
  pillars: Pillars,
  observed: ObservedStem[],
  dayMaster: string,
  getTenGod: GetTenGodFn,
  monthCommander?: string,
): boolean {
  const monthTarget = observed.some(
    (item) =>
      item.pillar === 'month' && item.placement === '藏干' && targetGods.includes(item.tenGod),
  );
  const commanderTarget = Boolean(
    monthCommander && targetGods.includes(getTenGod(monthCommander, dayMaster)),
  );
  return (
    monthTarget || commanderTarget || targetGods.includes(getTenGod(pillars.month.gan, dayMaster))
  );
}

function isStrongStatus(status: string | undefined): boolean {
  return status === '极强' || status === '身强' || status === '偏强';
}

function isWeakStatus(status: string | undefined): boolean {
  return status === '极弱' || status === '身弱' || status === '偏弱';
}

function isKnownStrengthStatus(status: string | undefined): boolean {
  return isStrongStatus(status) || status === '中和' || isWeakStatus(status);
}

function addPathInteraction(
  path: PatternPathEvaluation,
  interactions: PatternInteractionEvidence[],
): void {
  interactions.push({
    type: '制化',
    relation: path.key,
    source: path.source.join('、') || '未见',
    target: path.target.join('、') || '未见',
    status: path.status,
    detail: path.detail,
  });
}

function addCandidate(
  remedies: PatternRemedy[],
  observed: ObservedStem[],
  gods: readonly string[],
  effect: string,
): void {
  observed
    .filter((entry) => gods.includes(entry.tenGod))
    .forEach((item) => {
      remedies.push({
        stem: item.stem,
        pillar: item.pillar,
        tenGod: item.tenGod,
        placement: item.placement,
        effect: `${formatObserved(item)}：可核对${effect}`,
      });
    });
}

function evaluateStatusForOrdinaryPattern(params: {
  patternName: string;
  targetGods: readonly string[];
  monthGate: boolean;
  targetCondition: PatternConditionFact;
  breakerGroups: Array<{
    label: string;
    group: GodGroup;
    repair?: PatternPathEvaluation;
    /** 多条救应路径均需成立的组合；数组中的每一项代表一条可选路径。 */
    repairOptions?: PatternPathEvaluation[][];
  }>;
  basis: string;
  observed: ObservedStem[];
  pillars: Pillars;
  harmonyProfiles: HarmonyTransformProfile[];
  conditionFacts: PatternConditionFact[];
}): { status: PatternFulfillmentResult['status']; detail: string } {
  const {
    patternName,
    targetGods,
    monthGate,
    targetCondition,
    breakerGroups,
    basis,
    observed,
    pillars,
    harmonyProfiles,
    conditionFacts,
  } = params;
  const assessedBreakers = breakerGroups.map((item, index) => {
    const usability = assessGroupUsability(
      item.label,
      item.group,
      observed,
      pillars,
      harmonyProfiles,
    );
    conditionFacts.push({
      key: `pattern.breaker.${index + 1}`,
      status: usability.status,
      detail: usability.detail,
    });
    const repairOptions = item.repairOptions ?? (item.repair ? [[item.repair]] : []);
    const repairStatuses = repairOptions.map((option) =>
      option.some((path) => path.status === '不满足')
        ? '不满足'
        : option.every((path) => path.status === '满足')
          ? '满足'
          : '资料不足',
    );
    return { ...item, usability, repairOptions, repairStatuses };
  });
  if (!monthGate) {
    return {
      status: '平常',
      detail: `月令未见${targetGods.join('或')}，当前${patternName}名称不能替代月令取格依据。`,
    };
  }
  if (targetCondition.status !== '满足') {
    return {
      status: targetCondition.status === '资料不足' ? '未判定' : '破格',
      detail: `${targetCondition.detail} ${basis}`,
    };
  }
  const uncertainBreakers = assessedBreakers.filter((item) => item.usability.uncertain);
  if (uncertainBreakers.length) {
    return {
      status: '未判定',
      detail: `${uncertainBreakers
        .map((item) => item.usability.detail)
        .join('；')} ${basis} 存在破格候选，但救应条件尚未完备，不能闭合成败。`,
    };
  }
  const activeBreakers = assessedBreakers.filter((item) => item.usability.effective);
  if (!activeBreakers.length) {
    const suppressed = assessedBreakers
      .filter((item) => item.group.visible.length > 0)
      .map((item) => item.usability.detail)
      .join('；');
    return {
      status: '成格',
      detail: `格神已透干且有稳定根气，当前未见有效明透破格项。${suppressed ? ` ${suppressed}` : ''}`,
    };
  }
  const unresolved = activeBreakers.filter(
    (item) => !item.repairStatuses.some((status) => status === '满足'),
  );
  const indeterminate = unresolved.filter((item) =>
    item.repairStatuses.some((status) => status === '资料不足'),
  );
  if (indeterminate.length) {
    return {
      status: '未判定',
      detail: `原局见${activeBreakers.map((item) => item.label).join('、')}，但救应路径仍有资料不足：${indeterminate
        .map((item) => {
          const details = item.repairOptions
            .flat()
            .map((path) => path.detail)
            .join('；');
          return details || `${item.label}未见明确救应路径`;
        })
        .join('；')}。`,
    };
  }
  if (!unresolved.length) {
    return {
      status: '破而复成',
      detail: `原局见${activeBreakers.map((item) => item.label).join('、')}，但每项均有明示且有效的救应路径。`,
    };
  }
  return {
    status: '破格',
    detail: `原局见${activeBreakers.map((item) => item.label).join('、')}；${unresolved
      .map((item) => {
        const details = item.repairOptions
          .flat()
          .map((path) => path.detail)
          .join('；');
        return details || item.repair?.detail || `${item.label}未见有效救应`;
      })
      .join('；')}`,
  };
}

/**
 * 按《子平真诠》“用神成败”与《渊海子平》十神取用的有限可复核条件，
 * 判断常见正格的月令、透干、根气、位置与制化是否成立。
 *
 * 这里不把十神出现次数换算成分数。未覆盖的派别条件保留“未判定”，
 * 已覆盖的条件则只在目标、根气、位置和作用链均满足时给出成格/破格结果。
 */
export function evaluatePatternFulfillment(
  pillars: Pillars,
  dayMaster: string,
  patternName: string,
  getTenGod: GetTenGodFn,
  options: PatternFulfillmentOptions = {},
): PatternFulfillmentResult {
  assertPillars(pillars);
  assertHeavenlyStem(dayMaster, '日主');
  if (dayMaster !== pillars.day.gan) {
    throw new Error(`日主与日柱天干不一致：${dayMaster}/${pillars.day.gan}`);
  }

  const observed = buildObserved(pillars, dayMaster, getTenGod);
  const name = normalizePatternName(patternName);
  const harmonyProfiles = buildHarmonyProfiles(pillars);
  const interactions = buildHarmonyEvidence(harmonyProfiles);
  const remedies: PatternRemedy[] = [];
  const conflicts: string[] = [];
  const pathEvaluations: PatternPathEvaluation[] = [];
  const conditionFacts: PatternConditionFact[] = [];
  const conditions = [
    '先按月令、透干、根气与制化条件核对所取格局，再分别判断日主承受与格神力量。',
    '透干与藏干分别定位；制化须核对双方根气、实际柱位与合绊，未列出的同局生克暂不作定论。',
  ];

  const addPath = (
    key: string,
    label: string,
    sourceGods: readonly string[],
    targetGods: readonly string[],
  ): PatternPathEvaluation => {
    const path = evaluatePath(
      key,
      label,
      sourceGods,
      targetGods,
      observed,
      pillars,
      harmonyProfiles,
    );
    pathEvaluations.push(path);
    addPathInteraction(path, interactions);
    conditionFacts.push({ key: `path.${key}`, status: path.status, detail: path.detail });
    return path;
  };

  const addPathToDayMaster = (
    key: string,
    label: string,
    sourceGods: readonly string[],
  ): PatternPathEvaluation => {
    const path = evaluatePathToDayMaster(
      key,
      label,
      sourceGods,
      observed,
      pillars,
      dayMaster,
      harmonyProfiles,
    );
    pathEvaluations.push(path);
    addPathInteraction(path, interactions);
    conditionFacts.push({ key: `path.${key}`, status: path.status, detail: path.detail });
    return path;
  };

  const addPathChain = (
    key: string,
    label: string,
    parts: PatternPathEvaluation[],
  ): PatternPathEvaluation => {
    const path = combinePathChain(key, label, parts);
    pathEvaluations.push(path);
    addPathInteraction(path, interactions);
    conditionFacts.push({ key: `path.${key}`, status: path.status, detail: path.detail });
    return path;
  };

  let basis = '以月令所取结构为起点，结合四柱位置、根气与全局制化判断成败。';
  let targetGods: string[] = [];
  let monthGate = false;
  let targetGroup: GodGroup = {
    entries: [],
    visible: [],
    hidden: [],
    rooted: false,
    stable: false,
  };
  let decision: { status: PatternFulfillmentResult['status']; detail: string } = {
    status: '未判定',
    detail: '当前格局名称尚无对应的成败条件，保留盘面证据供所用流派复核。',
  };

  const registerTarget = (label: string, gods: string[], gateLabel = label) => {
    targetGods = gods;
    targetGroup = getGodGroup(targetGods, observed, pillars);
    monthGate = isMonthGate(
      targetGods,
      pillars,
      observed,
      dayMaster,
      getTenGod,
      options.monthCommander,
    );
    const gateCondition: PatternConditionFact = {
      key: 'pattern.month-gate',
      status: monthGate ? '满足' : '不满足',
      detail: monthGate
        ? `月令${pillars.month.zhi}或司令${options.monthCommander || '未记录'}与${gateLabel}相应。`
        : `月令${pillars.month.zhi}及司令${options.monthCommander || '未记录'}未见${gateLabel}。`,
    };
    conditionFacts.push(gateCondition);
    const targetCondition = buildGroupCondition(
      'pattern.target',
      label,
      targetGroup,
      true,
      harmonyProfiles,
      observed,
      pillars,
    );
    conditionFacts.push(targetCondition);
    return targetCondition;
  };

  if (name.includes('正官')) {
    basis =
      '《子平真诠·论正官》重“无破无伤”；此处要求正官月令、透干、有稳定根气，并核对伤官、七杀及有效救应。';
    const targetCondition = registerTarget('正官', ['正官']);
    const hurtGroup = getGodGroup(['伤官'], observed, pillars);
    const killGroup = getGodGroup(['七杀'], observed, pillars);
    const hurtRepair = hurtGroup.visible.length
      ? addPath('印制伤官', '印星制伤官护官', ['正印', '偏印'], ['伤官'])
      : undefined;
    const killRepair = killGroup.visible.length
      ? addPath('食神制七杀', '食神制七杀取清', ['食神'], ['七杀'])
      : undefined;
    if (hurtGroup.visible.length) conflicts.push('正官与伤官同见，须核对印星是否实际制伤。');
    if (killGroup.visible.length) conflicts.push('官杀同见，须核对食神是否实际取清。');
    if (targetGroup.entries.length) {
      addCandidate(remedies, observed, ['正印', '偏印'], '印星护官、生身；伤官同见时核对制伤路径');
      addCandidate(remedies, observed, ['正财', '偏财'], '财星生官；财印位置与相碍另核');
    }
    if (targetGroup.entries.length && killGroup.visible.length)
      addCandidate(remedies, observed, ['食神'], '制杀取清并核对对正官的牵制');
    // 保留原有“劫财合杀取清”的具体柱位证据，不把五合本身直接当作已成化。
    for (const item of observed.filter(
      (entry) => entry.placement === '透干' && entry.tenGod === '劫财',
    )) {
      const targets = observed.filter(
        (entry) =>
          entry.placement === '透干' &&
          entry.tenGod === '七杀' &&
          TIAN_GAN_HE[item.stem]?.partner === entry.stem,
      );
      if (targets.length) {
        remedies.push({
          stem: item.stem,
          pillar: item.pillar,
          tenGod: item.tenGod,
          placement: item.placement,
          effect: `${formatObserved(item)}与${targets.map(formatObserved).join('、')}具五合关系；取清仍须核对争合、合绊与根气`,
        });
      }
    }
    decision = evaluateStatusForOrdinaryPattern({
      patternName,
      targetGods,
      monthGate,
      targetCondition,
      breakerGroups: [
        { label: '伤官见官', group: hurtGroup, repair: hurtRepair },
        { label: '官杀混杂', group: killGroup, repair: killRepair },
      ],
      basis,
      observed,
      pillars,
      harmonyProfiles,
      conditionFacts,
    });
    conditions.push(
      '正官以月令、透干、稳定根气为格神条件；伤官见官或官杀混杂时，只有有效印制/食神取清才记为破而复成；财印并见时分别核对位置与能否各起作用。',
    );
  } else if (name.includes('正财') || name.includes('偏财')) {
    const exact = name.includes('偏财') ? '偏财' : '正财';
    basis = '《子平真诠·论财》重身财承载、食伤生财与官星护财；此处按财星位置、根气和比劫制化核对。';
    const targetCondition = registerTarget(exact, [exact]);
    const companionGroup = getGodGroup(['比肩', '劫财'], observed, pillars);
    const companionOutputPath = companionGroup.visible.length
      ? addPath('比劫生食伤', '比劫泄秀生食伤', ['比肩', '劫财'], ['食神', '伤官'])
      : undefined;
    const outputPath = companionGroup.visible.length
      ? addPath('食伤生财', '食伤泄比生财', ['食神', '伤官'], targetGods)
      : undefined;
    const outputChain =
      companionOutputPath && outputPath
        ? addPathChain('比劫泄秀生财', '比劫→食伤→财', [companionOutputPath, outputPath])
        : undefined;
    const officerRepair = companionGroup.visible.length
      ? addPath('官杀护财', '官杀制比护财', ['正官', '七杀'], ['比肩', '劫财'])
      : undefined;
    if (companionGroup.visible.length)
      conflicts.push('财与比劫同见，须核对食伤生财或官杀护财是否有效。');
    if (targetGroup.entries.length) {
      addCandidate(
        remedies,
        observed,
        ['食神', '伤官'],
        companionGroup.visible.length
          ? '泄比生财；食伤生财，并核对印制食与日主承受'
          : '食伤生财，并核对日主承受',
      );
      addCandidate(
        remedies,
        observed,
        ['正官', '七杀'],
        companionGroup.visible.length
          ? '官杀护财，并核对官杀耗财及日主承受'
          : '官杀与财星的生克方向待核对',
      );
    }
    decision = evaluateStatusForOrdinaryPattern({
      patternName,
      targetGods,
      monthGate,
      targetCondition,
      breakerGroups: [
        {
          label: '比劫夺财',
          group: companionGroup,
          repairOptions: [
            ...(outputChain ? [[outputChain]] : []),
            ...(officerRepair ? [[officerRepair]] : []),
          ],
        },
      ],
      basis,
      observed,
      pillars,
      harmonyProfiles,
      conditionFacts,
    });
    conditions.push('财星出现只证明可见；财格成败须另核财根、日主承财、比劫位置及有效生护路径。');
  } else if (name.includes('偏印') || name.includes('正印')) {
    const exact = name.includes('偏印') ? '偏印' : '正印';
    basis =
      '《子平真诠·论印绶》将正印、偏印同归印格，重官杀生印、财星破印；枭神夺食是食神格的破格关系，不把食神出现直接当作偏印格的破格神。';
    const targetCondition = registerTarget(exact, [exact]);
    const breakerGods = ['正财', '偏财'];
    const breakerGroup = getGodGroup(breakerGods, observed, pillars);
    const repair = breakerGroup.visible.length
      ? addPath('比劫护印', '比劫制财存印', ['比肩', '劫财'], ['正财', '偏财'])
      : undefined;
    if (breakerGroup.visible.length) {
      conflicts.push('财印同见，须核对财星破印与比劫护印的位置和根气。');
    }
    addCandidate(remedies, observed, ['正官', '七杀'], '官杀生印，并核对身印轻重');
    addCandidate(remedies, observed, ['比肩', '劫财'], '制财存印，并核对是否真正护印');
    addCandidate(remedies, observed, ['正财', '偏财'], '财星破印，并核对比劫是否护印');
    decision = evaluateStatusForOrdinaryPattern({
      patternName,
      targetGods,
      monthGate,
      targetCondition,
      breakerGroups: [{ label: '财星破印', group: breakerGroup, repair }],
      basis,
      observed,
      pillars,
      harmonyProfiles,
      conditionFacts,
    });
    conditions.push(
      '印格先辨正偏印的透藏与根气，再按财星破印及比劫护印的具体路径判断；枭神夺食只在食神格中作为破格关系核对。',
    );
  } else if (name.includes('食神')) {
    basis =
      '《子平真诠·论食神》重食神生财、制杀与枭神夺食；此处按食神位置、根气和财制枭有效性核对。';
    const targetCondition = registerTarget('食神', ['食神']);
    const koGroup = getGodGroup(['偏印'], observed, pillars);
    const repair = koGroup.visible.length
      ? addPath('财制偏印', '财星制枭护食', ['正财', '偏财'], ['偏印'])
      : undefined;
    if (koGroup.visible.length) conflicts.push('食神与偏印同见，须核对财星是否实际制枭。');
    addCandidate(remedies, observed, ['正财', '偏财'], '食神生财；偏印同见时核对制枭护食');
    addCandidate(remedies, observed, ['食神'], '食神制杀，并核对财生杀及印制食牵制');
    decision = evaluateStatusForOrdinaryPattern({
      patternName,
      targetGods,
      monthGate,
      targetCondition,
      breakerGroups: [{ label: '枭神夺食', group: koGroup, repair }],
      basis,
      observed,
      pillars,
      harmonyProfiles,
      conditionFacts,
    });
    conditions.push(
      '食神生财与制杀是两条独立作用路径；偏印明透且无有效财制时，不能把食神出现判作成格。',
    );
  } else if (name.includes('七杀')) {
    basis =
      '《子平真诠·论偏官》重身杀两停、食神制杀与印化杀；此处按七杀透干、根气及两条制化路径核对。';
    const targetCondition = registerTarget('七杀', ['七杀']);
    const foodPath = addPath('食神制杀', '食神制七杀', ['食神'], ['七杀']);
    const killToSealPath = addPath('七杀生印', '七杀生印', ['七杀'], ['正印', '偏印']);
    const sealToSelfPath = addPathToDayMaster('印生身', '印星生身', ['正印', '偏印']);
    const sealPath = addPathChain('印化杀', '七杀→印→身', [killToSealPath, sealToSelfPath]);
    addCandidate(remedies, observed, ['食神'], '食神制杀，比较身、杀、食的根气与位置');
    addCandidate(
      remedies,
      observed,
      ['正印', '偏印'],
      '杀印相生（七杀生印、印星生身），核对两段根气、柱位及合绊',
    );
    if (
      getGodGroup(['食神'], observed, pillars).entries.length &&
      getGodGroup(['正印', '偏印'], observed, pillars).entries.length
    ) {
      conflicts.push('食神与印同见，两条制化路径并存，须核对印制食是否影响制杀。');
    }
    if (getGodGroup(['正财', '偏财'], observed, pillars).visible.length) {
      conflicts.push('财星明透可能生杀，须与食印制化放在同一作用链比较。');
    }
    if (monthGate && targetCondition.status === '满足') {
      const validPaths = [foodPath, sealPath].filter((path) => path.status === '满足');
      const uncertainPaths = [foodPath, sealPath].filter((path) => path.status === '资料不足');
      decision = validPaths.length
        ? {
            status: '成格',
            detail: `七杀透干且有稳定根气；${validPaths.map((path) => path.label).join('、')}路径双方有根、位置有效。`,
          }
        : uncertainPaths.length
          ? {
              status: '未判定',
              detail: `七杀虽见月令、透干与根气，但${uncertainPaths
                .map((path) => path.label)
                .join('、')}仍有柱位或作用条件资料不足，不能直接定成或破。`,
            }
          : {
              status: '破格',
              detail:
                '七杀虽见月令、透干与根气，但未见双方有根且未被合绊阻断的食神制杀或印化杀路径。',
            };
    } else {
      decision = evaluateStatusForOrdinaryPattern({
        patternName,
        targetGods,
        monthGate,
        targetCondition,
        breakerGroups: [],
        basis,
        observed,
        pillars,
        harmonyProfiles,
        conditionFacts,
      });
    }
    conditions.push(
      '七杀成格至少须有一条有效制化路径；食神制杀须核对食神→七杀，印化杀须同时核对七杀→印与印→日主两段；食神或印仅藏、无根或被合绊时，不视为已经制化。',
    );
  } else if (name.includes('伤官')) {
    basis =
      '《子平真诠·论伤官》重伤官配印、伤官生财及伤官见官；此处按伤官透干、根气与配印制伤核对。';
    const targetCondition = registerTarget('伤官', ['伤官']);
    const officerGroup = getGodGroup(['正官'], observed, pillars);
    const repair = officerGroup.visible.length
      ? addPath('印配伤官', '印星配伤官制伤', ['正印', '偏印'], ['伤官'])
      : undefined;
    if (officerGroup.visible.length) conflicts.push('伤官与正官同见，须核对印星制伤护官路径。');
    addCandidate(remedies, observed, ['正印', '偏印'], '配印制伤并核对印根');
    addCandidate(remedies, observed, ['正财', '偏财'], '伤官生财并核对财根与承受');
    decision = evaluateStatusForOrdinaryPattern({
      patternName,
      targetGods,
      monthGate,
      targetCondition,
      breakerGroups: [{ label: '伤官见官', group: officerGroup, repair }],
      basis,
      observed,
      pillars,
      harmonyProfiles,
      conditionFacts,
    });
    conditions.push(
      '伤官生财与配印是不同路径；正官明透而无有效印制时，不能只凭伤官得令判成；取印或财仍须结合日主旺衰，身弱优先印、身旺可取财。',
    );
  } else if (
    name.includes('建禄') ||
    name.includes('月刃') ||
    name.includes('劫财') ||
    name.includes('比肩')
  ) {
    const isRen = name.includes('月刃');
    const isLu = name.includes('建禄');
    const mapBranch = isRen ? REN_BRANCH_MAP[dayMaster] : LU_BRANCH_MAP[dayMaster];
    if (isLu || isRen) {
      monthGate = pillars.month.zhi === mapBranch;
      conditionFacts.push({
        key: 'pattern.month-gate',
        status: monthGate ? '满足' : '不满足',
        detail: monthGate
          ? `月支${pillars.month.zhi}命中日主${dayMaster}${isRen ? '羊刃' : '禄位'}。`
          : `月支${pillars.month.zhi}未命中日主${dayMaster}${isRen ? '羊刃' : '禄位'}（应为${mapBranch || '未记录'}）。`,
      });
    } else {
      targetGods = name.includes('劫财') ? ['劫财'] : ['比肩'];
      targetGroup = getGodGroup(targetGods, observed, pillars);
      monthGate = isMonthGate(
        targetGods,
        pillars,
        observed,
        dayMaster,
        getTenGod,
        options.monthCommander,
      );
      conditionFacts.push({
        key: 'pattern.month-gate',
        status: monthGate ? '满足' : '不满足',
        detail: monthGate
          ? `月令见${targetGods.join('或')}。`
          : `月令未见${targetGods.join('或')}。`,
      });
    }
    basis = isRen
      ? '《子平真诠·论阳刃》重官杀驾刃；此处要求月刃位置明确，并核对官杀透干、根气和合绊。'
      : '《子平真诠·论建禄月劫》重财官食伤透出；此处按禄劫刃月令与外来作用的实际位置、根气和制化核对。';
    const targetCondition =
      isLu || isRen
        ? {
            key: 'pattern.target',
            status: monthGate ? ('满足' as const) : ('不满足' as const),
            detail: monthGate
              ? `月令${isRen ? '羊刃' : '禄位'}位置成立。`
              : `月令${isRen ? '羊刃' : '禄位'}位置不成立。`,
          }
        : buildGroupCondition(
            'pattern.target',
            targetGods.join('或'),
            targetGroup,
            false,
            harmonyProfiles,
            observed,
            pillars,
          );
    conditionFacts.push(targetCondition);
    const officerPath = addPath('官杀制比劫', '官杀制比劫', ['正官', '七杀'], ['比肩', '劫财']);
    const outputPath = addPath('食伤泄秀', '食伤泄身发秀', ['食神', '伤官'], ['比肩', '劫财']);
    const wealthPath = addPath('财星承禄劫', '财星承接禄劫', ['正财', '偏财'], ['比肩', '劫财']);
    addCandidate(remedies, observed, ['正官', '七杀'], '官杀制比劫，并核对官杀根气与食伤牵制');
    addCandidate(remedies, observed, ['食神', '伤官'], '泄秀或生财，并核对食伤根气与财星承接');
    addCandidate(remedies, observed, ['正财', '偏财'], '财星承禄劫，并核对比劫是否夺财');
    const validPath = isRen
      ? officerPath.status === '满足'
        ? officerPath
        : undefined
      : [officerPath, outputPath, wealthPath].find((path) => path.status === '满足');
    const hasUncertainPath = [officerPath, outputPath, wealthPath].some(
      (path) => path.status === '资料不足',
    );
    if (!monthGate) {
      decision = {
        status: '平常',
        detail: '禄、刃或劫财月令条件未成立，当前名称不能替代月令位置核验。',
      };
    } else if (validPath) {
      decision = {
        status: '成格',
        detail: `${validPath.label}来源与作用对象均有透干、稳定根气且未被合绊阻断。`,
      };
    } else if (hasUncertainPath) {
      decision = {
        status: '未判定',
        detail: '月令条件成立，但至少一条候选作用路径存在柱位或根气资料不足，暂不闭合成败。',
      };
    } else {
      decision = {
        status: '破格',
        detail: isRen
          ? '月刃成立但未见有效官杀驾刃路径。'
          : '禄劫月令成立但未见有根透出的财、官杀或食伤承接路径。',
      };
    }
    conditions.push(
      isRen
        ? '月刃不以羊刃出现本身定成，须见有效官杀驾刃；官杀无根或被合绊时仍按未成路径处理。'
        : '建禄、劫财的月令只提供身旺背景，至少一条财官食伤的有效透干路径成立后才记成格。',
    );
  }

  const allGroups = [
    targetGroup,
    getGodGroup(['正官', '七杀'], observed, pillars),
    getGodGroup(['正财', '偏财'], observed, pillars),
    getGodGroup(['正印', '偏印'], observed, pillars),
    getGodGroup(['食神', '伤官'], observed, pillars),
    getGodGroup(['比肩', '劫财'], observed, pillars),
  ];
  const rootEvidence = buildRootEvidence(allGroups, observed, pillars);

  if (options.strengthStatus) {
    const strengthDataStatus = isKnownStrengthStatus(options.strengthStatus) ? '满足' : '资料不足';
    conditionFacts.push({
      key: 'bazi.day-master-strength',
      status: strengthDataStatus,
      detail:
        strengthDataStatus === '满足'
          ? `日主旺衰资料：${options.strengthStatus}（已提供）；身强身弱的取用作用另按格局条件核验。`
          : '日主旺衰资料未定，无法核验身强身弱的格局作用。',
    });
  } else {
    conditionFacts.push({
      key: 'bazi.day-master-strength',
      status: '资料不足',
      detail: '日主旺衰资料未定，无法完成强弱与格局条件的交叉核对。',
    });
  }

  const isWealthPattern = name.includes('正财') || name.includes('偏财');
  const wealthBearingStatus: PatternConditionStatus = options.strengthStatus
    ? isStrongStatus(options.strengthStatus) || options.strengthStatus === '中和'
      ? '满足'
      : isWeakStatus(options.strengthStatus)
        ? '不满足'
        : '资料不足'
    : '资料不足';
  if (isWealthPattern) {
    conditionFacts.push({
      key: 'bazi.wealth-bearing',
      status: wealthBearingStatus,
      detail: options.strengthStatus
        ? `日主旺衰为${options.strengthStatus}；财格的身承财条件${
            wealthBearingStatus === '满足' ? '可据此视为满足' : '暂不能视为满足'
          }。`
        : '未提供日主旺衰定性，不能核验财格的身承财条件。',
    });
    if (
      wealthBearingStatus !== '满足' &&
      (decision.status === '成格' || decision.status === '破而复成')
    ) {
      decision = {
        status: '未判定',
        detail: `原有有限格神结构为“${decision.status}”，但${
          wealthBearingStatus === '不满足' ? '日主偏弱或身弱' : '日主旺衰资料不足'
        }，尚不能称为完整财格成败：${decision.detail}`,
      };
    }
  }

  const exposed = observed.filter((item) => item.placement === '透干');
  const harmonyText = harmonyProfiles.length
    ? harmonyProfiles.map(formatHarmonyProfile).join('；')
    : '未见天干五合或地支六合资料';
  conditions.push(`合绊核验：${harmonyText}`);

  return {
    patternName,
    status: decision.status,
    basis,
    contradiction: conflicts.join('；'),
    remedies,
    evidence: POSITIONS.map(
      (pillar) =>
        `${PILLAR_NAMES[pillar]}${pillars[pillar].gan}${pillars[pillar].zhi}：${observed
          .filter((item) => item.pillar === pillar)
          .map(formatObserved)
          .join('、')}`,
    ),
    conditions,
    conditionFacts,
    rootEvidence,
    interactionEvidence: interactions,
    pathEvaluations,
    summary: `【${patternName}】当前判定：${decision.status}；${decision.detail} 透干所见：${
      exposed.map(formatObserved).join('、') || '未记录'
    }。`,
  };
}
