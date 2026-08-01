import {
  BRANCH_ORDER,
  BRANCH_WUXING,
  CHANGSHENG_ORDER,
  SANHE_GROUPS,
  getSanxingType,
  getSeasonState,
  isKe,
  isLiuchong,
  isLiuhe,
  isSheng,
} from '../ganzhi';
import { hexagramsData } from './hexagram-data';
import { hexagramNaJia } from './divination-data';
import type {
  LiuyaoActivityPattern,
  LiuyaoData,
  LiuyaoFanFuKind,
  LiuyaoFanFuRelationItem,
  LiuyaoFanFuRelations,
  LiuyaoFanFuScope,
  LiuyaoFlyingHiddenRelation,
  LiuyaoHiddenSpirit,
  LiuyaoHiddenSpiritConditionAnalysis,
  LiuyaoLineStrengthAnalysis,
  LiuyaoMonthGuaShenAnalysis,
  LiuyaoSanheFormation,
  LiuyaoSanheParticipant,
  LiuyaoSanhePattern,
  LiuyaoSanheStatus,
  LiuyaoSanxingFormation,
  LiuyaoSanxingParticipant,
  LiuyaoYaoDetail,
} from '../types/divination';

const LIUYAO_ELEMENTS = new Set(['木', '火', '土', '金', '水']);

const LIUYAO_FANYIN_TRIGRAM_PAIRS: Record<string, string> = {
  乾: '巽',
  巽: '乾',
  坎: '离',
  离: '坎',
  震: '兑',
  兑: '震',
  坤: '艮',
  艮: '坤',
};

function getRequiredFanFuHexagramData(hexagramName: string) {
  const hexagram = hexagramsData.find((item) => item.name === hexagramName);
  if (!hexagram) {
    throw new Error(`找不到卦象 "${hexagramName}"。`);
  }
  return hexagram;
}

function getFanFuNaJiaBranches(hexagramName: string) {
  getRequiredFanFuHexagramData(hexagramName);
  const branches = hexagramNaJia[hexagramName];
  if (!branches || branches.length !== 6) {
    throw new Error(`找不到卦象 "${hexagramName}" 的完整纳甲信息。`);
  }
  return branches;
}

function getFanFuScope(lowerMatched: boolean, upperMatched: boolean): LiuyaoFanFuScope | null {
  if (lowerMatched && upperMatched) return '内外';
  if (lowerMatched) return '内卦';
  if (upperMatched) return '外卦';
  return null;
}

function getFanFuScopes(scope: LiuyaoFanFuScope): Array<'内卦' | '外卦'> {
  return scope === '内外' ? ['内卦', '外卦'] : [scope];
}

function buildFanyinLabel(kind: Exclude<LiuyaoFanFuKind, '伏吟'>, scope: LiuyaoFanFuScope) {
  if (kind === '爻反吟') {
    return scope === '内外' ? '内外爻反吟' : `${scope}爻反吟`;
  }
  return scope === '内外' ? '内外反吟' : `${scope}反吟`;
}

function buildFanyinDescription(
  kind: Exclude<LiuyaoFanFuKind, '伏吟'>,
  scope: LiuyaoFanFuScope,
  original: { upper: string; lower: string },
  changed: { upper: string; lower: string },
) {
  const parts = getFanFuScopes(scope).map((item) =>
    item === '内卦'
      ? `内卦${original.lower}变${changed.lower}`
      : `外卦${original.upper}变${changed.upper}`,
  );
  const rule = kind === '爻反吟' ? '对应纳甲地支逐位相冲' : '按乾巽、坎离、震兑、坤艮相变';
  return `${parts.join('，')}，${rule}`;
}

function buildFuyinDescription(
  scope: LiuyaoFanFuScope,
  original: { upper: string; lower: string },
  changed: { upper: string; lower: string },
) {
  const parts = getFanFuScopes(scope).map((item) =>
    item === '内卦'
      ? `内卦${original.lower}变${changed.lower}`
      : `外卦${original.upper}变${changed.upper}`,
  );
  return `${parts.join('，')}，动变后纳甲地支不变`;
}

function pushFanyinItem(
  items: LiuyaoFanFuRelationItem[],
  kind: Exclude<LiuyaoFanFuKind, '伏吟'> | null,
  scope: LiuyaoFanFuScope | null,
  original: { upper: string; lower: string },
  changed: { upper: string; lower: string },
) {
  if (!kind || !scope) return;
  items.push({
    kind,
    scope,
    label: buildFanyinLabel(kind, scope),
    description: buildFanyinDescription(kind, scope, original, changed),
  });
}

/**
 * 判断六爻卦变层面的反吟、伏吟。
 *
 * 《增删卜易》“反吟伏吟”：
 * - 卦反吟：乾巽、坎离、震兑、坤艮相变。
 * - 爻反吟：对应爻纳甲地支逐位相冲。
 * - 伏吟：卦有动变，但变后六爻纳甲地支不变，并分内卦、外卦、内外。
 */
export function getLiuyaoFanFuRelations(
  originalName: string,
  changedName: string | undefined,
  hasChangingYaos: boolean,
): LiuyaoFanFuRelations {
  const empty: LiuyaoFanFuRelations = { fanyin: [], fuyin: [], labels: [] };
  const original = getRequiredFanFuHexagramData(originalName);
  const originalBranches = getFanFuNaJiaBranches(originalName);

  if (!hasChangingYaos || !changedName) return empty;

  const changed = getRequiredFanFuHexagramData(changedName);
  const changedBranches = getFanFuNaJiaBranches(changedName);
  const lowerYaoFanyin = originalBranches
    .slice(0, 3)
    .every((branch, index) => isLiuchong(branch, changedBranches[index]));
  const upperYaoFanyin = originalBranches
    .slice(3)
    .every((branch, index) => isLiuchong(branch, changedBranches[index + 3]));
  const lowerGuaFanyin = LIUYAO_FANYIN_TRIGRAM_PAIRS[original.lower] === changed.lower;
  const upperGuaFanyin = LIUYAO_FANYIN_TRIGRAM_PAIRS[original.upper] === changed.upper;
  const lowerFanyinKind = lowerYaoFanyin ? '爻反吟' : lowerGuaFanyin ? '卦反吟' : null;
  const upperFanyinKind = upperYaoFanyin ? '爻反吟' : upperGuaFanyin ? '卦反吟' : null;
  const fanyin: LiuyaoFanFuRelationItem[] = [];

  if (lowerFanyinKind && lowerFanyinKind === upperFanyinKind) {
    pushFanyinItem(fanyin, lowerFanyinKind, '内外', original, changed);
  } else {
    pushFanyinItem(fanyin, lowerFanyinKind, lowerFanyinKind ? '内卦' : null, original, changed);
    pushFanyinItem(fanyin, upperFanyinKind, upperFanyinKind ? '外卦' : null, original, changed);
  }

  const lowerFuyin =
    original.lower !== changed.lower &&
    originalBranches.slice(0, 3).every((branch, index) => branch === changedBranches[index]);
  const upperFuyin =
    original.upper !== changed.upper &&
    originalBranches.slice(3).every((branch, index) => branch === changedBranches[index + 3]);
  const fuyinScope = getFanFuScope(lowerFuyin, upperFuyin);
  const fuyin: LiuyaoFanFuRelationItem[] = fuyinScope
    ? [
        {
          kind: '伏吟',
          scope: fuyinScope,
          label: fuyinScope === '内外' ? '内外伏吟' : `${fuyinScope}伏吟`,
          description: buildFuyinDescription(fuyinScope, original, changed),
        },
      ]
    : [];

  return { fanyin, fuyin, labels: [...fanyin, ...fuyin].map((item) => item.label) };
}

/** 从主卦、变卦和原始爻值重算反吟伏吟，不采信缓存的动爻或反吟伏吟字段。 */
export function analyzeLiuyaoFanFuRelations(
  data: Pick<LiuyaoData, 'originalName' | 'changedName' | 'yaoArray'>,
): LiuyaoFanFuRelations {
  const activityPattern = analyzeLiuyaoActivityPattern(data.yaoArray, data.originalName);
  return getLiuyaoFanFuRelations(
    data.originalName,
    data.changedName,
    activityPattern.movingCount > 0,
  );
}

const SHI_YANG_TO_GUA_SHEN: Record<number, string> = {
  1: '子',
  2: '丑',
  3: '寅',
  4: '卯',
  5: '辰',
  6: '巳',
};

const SHI_YIN_TO_GUA_SHEN: Record<number, string> = {
  1: '午',
  2: '未',
  3: '申',
  4: '酉',
  5: '戌',
  6: '亥',
};

/** 《卜筮全书·起月卦身诀》：阳世从子、阴世从午，自初爻数至世爻。 */
export function getLiuyaoGuaShenBranch(shiPosition: number, shiYaoIsYang: boolean): string {
  if (!Number.isInteger(shiPosition) || shiPosition < 1 || shiPosition > 6) {
    throw new Error(`六爻世爻位置无效：${shiPosition}`);
  }
  if (typeof shiYaoIsYang !== 'boolean') {
    throw new Error('六爻世爻阴阳标记必须是布尔值');
  }
  const branch = (shiYaoIsYang ? SHI_YANG_TO_GUA_SHEN : SHI_YIN_TO_GUA_SHEN)[shiPosition];
  if (!branch) {
    throw new Error(`六爻月卦身资料缺失：世爻${shiPosition}，${shiYaoIsYang ? '阳' : '阴'}`);
  }
  return branch;
}

/**
 * 从完整本卦重算月卦身，并保留不入卦及同支多现状态。
 *
 * 月卦身先由世爻阴阳与爻位定支，再查本卦同支爻位；“不入卦”不等于没有月卦身，
 * 同支两现时也不得只取数组中的第一爻。
 */
export function analyzeLiuyaoMonthGuaShen(
  yaosDetail: readonly LiuyaoYaoDetail[],
): LiuyaoMonthGuaShenAnalysis {
  if (
    yaosDetail.length !== 6 ||
    new Set(yaosDetail.map((item) => item.position)).size !== 6 ||
    yaosDetail.some(
      (item) =>
        !Number.isInteger(item.position) ||
        item.position < 1 ||
        item.position > 6 ||
        !BRANCH_ORDER.includes(item.najiaDizhi),
    )
  ) {
    throw new Error('六爻月卦身需要初爻至上爻六个有效本卦爻位。');
  }
  const worldYaos = yaosDetail.filter((item) => item.isWorld);
  if (worldYaos.length !== 1) {
    throw new Error(`六爻月卦身需要唯一世爻，实际 ${worldYaos.length} 个。`);
  }
  const worldYao = worldYaos[0];
  if (worldYao.yaoType !== '阳' && worldYao.yaoType !== '阴') {
    throw new Error(`六爻世爻资料缺失：第${worldYao.position}爻`);
  }
  const branch = getLiuyaoGuaShenBranch(worldYao.position, worldYao.yaoType === '阳');
  const matches = yaosDetail
    .filter((item) => item.najiaDizhi === branch)
    .sort((left, right) => left.position - right.position)
    .map((item) => ({
      position: item.position,
      sixRelative: item.sixRelative,
      ...(item.najiaTiangan ? { najiaTiangan: item.najiaTiangan } : {}),
    }));
  return {
    branch,
    status: matches.length ? '入卦' : '不入卦',
    matches,
  };
}

/**
 * 从原始爻值重算明动结构。
 *
 * 《增删卜易·独发章》以一动为独发、五动为独静，并明确不得舍用神执结构断事；
 * 对两至四爻只登记“多爻发动”，不把不同原典中的“乱动”描述硬编码成数值阈值。
 */
export function analyzeLiuyaoActivityPattern(
  yaoArray: readonly number[],
  originalName = '',
): LiuyaoActivityPattern {
  if (
    yaoArray.length !== 6 ||
    yaoArray.some((value) => !Number.isInteger(value) || ![6, 7, 8, 9].includes(value))
  ) {
    throw new Error('六爻动静结构需要六个有效爻值（6、7、8、9）。');
  }

  const movingPositions = yaoArray
    .map((value, index) => (value === 6 || value === 9 ? index + 1 : 0))
    .filter((position) => position > 0);
  const stillPositions = yaoArray
    .map((value, index) => (value === 7 || value === 8 ? index + 1 : 0))
    .filter((position) => position > 0);
  const movingCount = movingPositions.length;
  const kind: LiuyaoActivityPattern['kind'] =
    movingCount === 0
      ? '静卦'
      : movingCount === 1
        ? '独发卦'
        : movingCount === 5
          ? '独静卦'
          : movingCount === 6
            ? '全动卦'
            : '多爻发动';
  const scriptureReference =
    movingCount === 6 && originalName === '乾为天'
      ? ('乾卦用九' as const)
      : movingCount === 6 && originalName === '坤为地'
        ? ('坤卦用六' as const)
        : undefined;
  const guidance =
    kind === '静卦'
      ? '六爻无明动，先核对用神、月日、世应、日冲暗动与空亡；无明动爻时不立变爻作用。'
      : kind === '独发卦'
        ? `仅第${movingPositions[0]}爻明动，属于独发结构；动爻可作动变重点，但成败与应期仍须回到用神、月日、世应及生克制化。`
        : kind === '独静卦'
          ? `仅第${stillPositions[0]}爻不动，属于独静结构；不得舍用神而仅凭独静爻裁定成败或应期。`
          : kind === '全动卦'
            ? `六爻俱动，须从用神、月日、世应及各爻动变生克综合辨向${scriptureReference ? `；${scriptureReference}只作《周易》经文参考` : ''}，不得仅凭全动结构裁定吉凶。`
            : `${movingCount}爻明动，只登记多爻发动事实；“乱动”在不同原典中没有一致的数值阈值，不据动爻数量直接裁断。`;

  return {
    kind,
    movingCount,
    movingPositions,
    stillPositions,
    scriptureReference,
    guidance,
  };
}

/** 《卜筮正宗·墓库章》《增删卜易·入墓》所用五行墓支。 */
export const LIUYAO_ELEMENT_TOMB_BRANCH: Record<string, string> = {
  金: '丑',
  木: '未',
  火: '戌',
  水: '辰',
  土: '辰',
};

const LIUYAO_CHANGSHENG_START: Record<string, string> = {
  金: '巳',
  木: '亥',
  火: '寅',
  水: '申',
  土: '申',
};

const LIUYAO_ADVANCING_CHANGE: Record<string, string> = {
  亥: '子',
  寅: '卯',
  巳: '午',
  申: '酉',
  丑: '辰',
  辰: '未',
  未: '戌',
};

const LIUYAO_RETREATING_CHANGE: Record<string, string> = {
  子: '亥',
  卯: '寅',
  午: '巳',
  酉: '申',
  辰: '丑',
  未: '辰',
  戌: '未',
};

function assertElement(element: string, label: string) {
  if (!LIUYAO_ELEMENTS.has(element)) {
    throw new Error(`${label}五行无效：${element || '空'}`);
  }
}

function getBranchElement(branch: string, label: string) {
  const element = BRANCH_WUXING[branch];
  if (!element) {
    throw new Error(`${label}地支无效：${branch || '空'}`);
  }
  return element;
}

export function getLiuyaoTwelveStage(element: string, branch: string): string {
  assertElement(element, '六爻十二长生');
  getBranchElement(branch, '六爻十二长生');
  const startBranch = LIUYAO_CHANGSHENG_START[element];
  const startIndex = BRANCH_ORDER.indexOf(startBranch);
  const branchIndex = BRANCH_ORDER.indexOf(branch);
  const offset = (((branchIndex - startIndex) % 12) + 12) % 12;
  const stage = CHANGSHENG_ORDER[offset];
  if (!stage) {
    throw new Error(`六爻十二长生无法定位 ${element} 在 ${branch} 支的状态。`);
  }
  return stage;
}

export function isLiuyaoElementInTomb(element: string, branch: string): boolean {
  assertElement(element, '六爻入墓');
  getBranchElement(branch, '六爻入墓');
  return LIUYAO_ELEMENT_TOMB_BRANCH[element] === branch;
}

/** 《增删卜易·进神退神章》明表，不按十二地支循环外推。 */
export function getLiuyaoChangeDirection(
  originalBranch: string,
  changedBranch: string,
): '化进神' | '化退神' | null {
  getBranchElement(originalBranch, '六爻动爻');
  getBranchElement(changedBranch, '六爻变爻');
  if (LIUYAO_ADVANCING_CHANGE[originalBranch] === changedBranch) return '化进神';
  if (LIUYAO_RETREATING_CHANGE[originalBranch] === changedBranch) return '化退神';
  return null;
}

/**
 * 《增删卜易·飞伏神章》以“飞来生伏”“飞来克伏”说明飞伏关系。
 * 其余方向按同一五行生克主客完整登记，但不由关系名称直接推出吉凶。
 */
export function getLiuyaoFlyingHiddenRelation(
  hiddenElement: string,
  flyingElement: string,
): LiuyaoFlyingHiddenRelation {
  assertElement(hiddenElement, '六爻伏神');
  assertElement(flyingElement, '六爻飞神');
  if (isSheng(flyingElement, hiddenElement)) return '飞来生伏';
  if (isKe(flyingElement, hiddenElement)) return '飞来克伏';
  if (isSheng(hiddenElement, flyingElement)) return '伏去生飞';
  if (isKe(hiddenElement, flyingElement)) return '伏克飞神';
  return '飞伏比和';
}

function unique(items: string[]) {
  return [...new Set(items)];
}

function isWeakSeason(state: string) {
  return state === '休' || state === '囚' || state === '死';
}

function isStrongSeason(state: string) {
  return state === '旺' || state === '相';
}

function hasHiddenMove(
  yao: Pick<LiuyaoYaoDetail, 'isChanging' | 'najiaDizhi' | 'wuxing'>,
  monthBranch: string,
  dayBranch: string,
) {
  return (
    !yao.isChanging &&
    isLiuchong(yao.najiaDizhi, dayBranch) &&
    isStrongSeason(getSeasonState(yao.wuxing, monthBranch))
  );
}

function getLineActivity(
  yao: LiuyaoYaoDetail,
  monthBranch: string,
  dayBranch: string,
): LiuyaoSanheParticipant['activity'] {
  if (yao.isChanging) return '明动';
  return hasHiddenMove(yao, monthBranch, dayBranch) ? '暗动' : '静爻';
}

function getSanheParticipantConditions(
  participant: Pick<
    LiuyaoSanheParticipant,
    'source' | 'position' | 'branch' | 'activity' | 'isVoid'
  >,
  element: string,
  monthBranch: string,
  dayBranch: string,
) {
  const label = `${participant.source}第${participant.position}爻${participant.branch}`;
  const conditions: string[] = [];
  if (participant.isVoid) conditions.push(`${label}空亡`);
  if (isLiuchong(participant.branch, monthBranch)) conditions.push(`${label}月破`);
  if (
    participant.source === '本卦' &&
    participant.activity === '静爻' &&
    isLiuchong(participant.branch, dayBranch)
  ) {
    conditions.push(`${label}日破`);
  }
  if (isLiuyaoElementInTomb(element, monthBranch)) conditions.push(`${label}入月墓`);
  if (isLiuyaoElementInTomb(element, dayBranch)) conditions.push(`${label}入日墓`);
  if (participant.activity === '静爻') conditions.push(`${label}静爻待值`);
  return conditions;
}

function buildSanheParticipants(
  yaosDetail: LiuyaoYaoDetail[],
  monthBranch: string,
  dayBranch: string,
) {
  return yaosDetail.flatMap((yao): LiuyaoSanheParticipant[] => {
    const activity = getLineActivity(yao, monthBranch, dayBranch);
    const original: LiuyaoSanheParticipant = {
      source: '本卦',
      position: yao.position,
      branch: yao.najiaDizhi,
      activity,
      isVoid: yao.isVoid,
      conditions: [],
    };
    original.conditions = getSanheParticipantConditions(
      original,
      getBranchElement(original.branch, `六爻第${yao.position}爻`),
      monthBranch,
      dayBranch,
    );
    if (!yao.changedYao || yao.changedYao.dizhi === yao.najiaDizhi) return [original];
    const changed: LiuyaoSanheParticipant = {
      source: '变爻',
      position: yao.position,
      branch: yao.changedYao.dizhi,
      activity,
      isVoid: yao.changedYao.isVoid,
      conditions: [],
    };
    changed.conditions = getSanheParticipantConditions(
      changed,
      getBranchElement(changed.branch, `六爻第${yao.position}爻变爻`),
      monthBranch,
      dayBranch,
    );
    return [original, changed];
  });
}

function enumerateSanheAssignments(
  members: string[],
  participants: LiuyaoSanheParticipant[],
): LiuyaoSanheParticipant[][] {
  const assignments: LiuyaoSanheParticipant[][] = [];
  const walk = (index: number, selected: LiuyaoSanheParticipant[]) => {
    if (index === members.length) {
      assignments.push(selected);
      return;
    }
    for (const participant of participants.filter((item) => item.branch === members[index])) {
      walk(index + 1, [...selected, participant]);
    }
  };
  walk(0, []);
  return assignments;
}

function getSanhePattern(
  participants: LiuyaoSanheParticipant[],
): Exclude<LiuyaoSanhePattern, '日辰补局' | '月建补局' | '虚一待用'> | null {
  const positions = new Set(participants.map((item) => item.position));
  const activePositions = new Set(
    participants.filter((item) => item.activity !== '静爻').map((item) => item.position),
  );
  if (positions.size === 3 && activePositions.size >= 2) {
    return activePositions.size === 3 ? '三爻齐动' : '两动一静';
  }
  const positionKey = [...positions].sort((left, right) => left - right).join(',');
  if (
    activePositions.size === 2 &&
    participants.some((item) => item.source === '变爻') &&
    positionKey === '1,3'
  ) {
    return '初三爻动变成局';
  }
  if (
    activePositions.size === 2 &&
    participants.some((item) => item.source === '变爻') &&
    positionKey === '4,6'
  ) {
    return '四六爻动变成局';
  }
  return null;
}

function getSanheStatus(
  pattern: LiuyaoSanhePattern,
  participants: LiuyaoSanheParticipant[],
): { status: LiuyaoSanheStatus; issues: string[] } {
  const issues = unique(participants.flatMap((item) => item.conditions));
  if (pattern === '虚一待用') return { status: '虚一待补', issues };
  const needsFilling = issues.some((item) => /空亡|月破|日破/.test(item));
  const needsOpeningTomb = issues.some((item) => /墓/.test(item));
  if (needsFilling && needsOpeningTomb) return { status: '待填实并冲墓', issues };
  if (needsFilling) return { status: '待填实', issues };
  if (needsOpeningTomb) return { status: '待冲墓', issues };
  if (issues.some((item) => /静爻待值/.test(item))) {
    return { status: '成立待静爻逢值', issues };
  }
  return { status: '成立', issues };
}

function formatSanheParticipant(participant: LiuyaoSanheParticipant) {
  return `${participant.source}第${participant.position}爻${participant.branch}（${participant.activity}）`;
}

function buildSanheFormation(params: {
  group: string;
  members: string[];
  pattern: LiuyaoSanhePattern;
  participants: LiuyaoSanheParticipant[];
  trigger?: LiuyaoSanheFormation['trigger'];
  missingBranch?: string;
}): LiuyaoSanheFormation {
  const { group, members, pattern, participants, trigger, missingBranch } = params;
  const { status, issues: participantIssues } = getSanheStatus(pattern, participants);
  const issues = unique([
    ...participantIssues,
    ...(missingBranch ? [`缺${missingBranch}支，须待月日补入`] : []),
  ]);
  const participantText = participants.map(formatSanheParticipant).join('、');
  const baseDescription =
    pattern === '虚一待用'
      ? `${participantText}已见${participants.map((item) => item.branch).join('、')}，${group}缺${missingBranch}支，列为虚一待用`
      : trigger
        ? `${trigger.source}${trigger.branch}补足${members.join('、')}${group}，另两支来自${participantText}`
        : `${participantText}组成${members.join('、')}${group}（${pattern}）`;
  const participantKey = participants
    .map((item) => `${item.source}:${item.position}:${item.branch}`)
    .sort()
    .join('|');
  return {
    key: `liuyao:sanhe:${group}:${pattern}:${trigger ? `${trigger.source}${trigger.branch}` : '卦内'}:${missingBranch ?? '齐'}:${participantKey}`,
    group,
    element: group.slice(0, 1),
    members: [...members],
    pattern,
    status,
    participants,
    ...(trigger ? { trigger } : {}),
    ...(missingBranch ? { missingBranch } : {}),
    issues,
    description: `${baseDescription}；状态${status}${issues.length ? `；条件${issues.join('、')}` : ''}`,
  };
}

/**
 * 复核《增删卜易·六合章》四类三合与“虚一待用”：
 * 三爻齐动、两动一静、初三或四六爻动变成局，以及两活动爻由日月补足。
 * 同一动爻的本支与变支可以参加初三/四六动变成局，但不能冒充日月补局所需的
 * 两个不同活动爻；空破墓与静爻待值只记录成立条件，不直接换算吉凶或日期。
 */
export function analyzeLiuyaoSanheFormations(
  yaosDetail: LiuyaoYaoDetail[],
  monthBranch: string,
  dayBranch: string,
): LiuyaoSanheFormation[] {
  getBranchElement(monthBranch, '六爻月建');
  getBranchElement(dayBranch, '六爻日辰');
  if (yaosDetail.length !== 6) throw new Error('六爻三合分析必须提供完整六爻。');
  const participants = buildSanheParticipants(yaosDetail, monthBranch, dayBranch);
  const formations: LiuyaoSanheFormation[] = [];
  const formationKeys = new Set<string>();
  const addFormation = (formation: LiuyaoSanheFormation) => {
    if (formationKeys.has(formation.key)) return;
    formationKeys.add(formation.key);
    formations.push(formation);
  };

  for (const [group, members] of Object.entries(SANHE_GROUPS)) {
    for (const assignment of enumerateSanheAssignments(members, participants)) {
      const pattern = getSanhePattern(assignment);
      if (!pattern) continue;
      addFormation(buildSanheFormation({ group, members, pattern, participants: assignment }));
    }
  }

  for (const [source, triggerBranch, pattern] of [
    ['日辰', dayBranch, '日辰补局'],
    ['月建', monthBranch, '月建补局'],
  ] as const) {
    for (const [group, members] of Object.entries(SANHE_GROUPS)) {
      if (!members.includes(triggerBranch)) continue;
      const requiredMembers = members.filter((member) => member !== triggerBranch);
      for (const assignment of enumerateSanheAssignments(requiredMembers, participants)) {
        if (assignment.some((item) => item.activity === '静爻')) continue;
        if (new Set(assignment.map((item) => item.position)).size !== 2) continue;
        addFormation(
          buildSanheFormation({
            group,
            members,
            pattern,
            participants: assignment,
            trigger: { source, branch: triggerBranch },
          }),
        );
      }
    }
  }

  const completedGroups = new Set(
    formations.filter((item) => item.pattern !== '虚一待用').map((item) => item.group),
  );
  for (const [group, members] of Object.entries(SANHE_GROUPS)) {
    if (completedGroups.has(group)) continue;
    for (const missingBranch of members) {
      const presentMembers = members.filter((member) => member !== missingBranch);
      for (const assignment of enumerateSanheAssignments(presentMembers, participants)) {
        if (assignment.some((item) => item.activity === '静爻')) continue;
        if (new Set(assignment.map((item) => item.position)).size !== 2) continue;
        addFormation(
          buildSanheFormation({
            group,
            members,
            pattern: '虚一待用',
            participants: assignment,
            missingBranch,
          }),
        );
      }
    }
  }
  return formations;
}

const LIUYAO_SANXING_GROUPS: Array<{
  members: string[];
  pattern: LiuyaoSanxingFormation['pattern'];
}> = [
  { members: ['寅', '巳', '申'], pattern: '三支齐备' },
  { members: ['丑', '戌', '未'], pattern: '三支齐备' },
  { members: ['子', '卯'], pattern: '子卯相刑' },
];

function buildSanxingParticipant(
  yao: LiuyaoYaoDetail,
  monthBranch: string,
  dayBranch: string,
): LiuyaoSanxingParticipant {
  return {
    position: yao.position,
    branch: yao.najiaDizhi,
    activity: getLineActivity(yao, monthBranch, dayBranch),
    isWorld: yao.isWorld,
    isResponse: yao.isResponse,
  };
}

function enumerateSanxingAssignments(
  members: string[],
  participants: LiuyaoSanxingParticipant[],
): LiuyaoSanxingParticipant[][] {
  const assignments: LiuyaoSanxingParticipant[][] = [];
  const walk = (index: number, selected: LiuyaoSanxingParticipant[]) => {
    if (index === members.length) {
      if (new Set(selected.map((item) => item.position)).size === selected.length) {
        assignments.push(selected);
      }
      return;
    }
    for (const participant of participants.filter((item) => item.branch === members[index])) {
      walk(index + 1, [...selected, participant]);
    }
  };
  walk(0, []);
  return assignments;
}

function buildSanxingFormation(
  pattern: LiuyaoSanxingFormation['pattern'],
  participants: LiuyaoSanxingParticipant[],
): LiuyaoSanxingFormation {
  const branches = participants.map((item) => item.branch);
  const type = getSanxingType(branches[0]);
  if (!type) throw new Error(`六爻三刑类型无法判定：${branches.join('、')}`);
  const activePositions = unique(
    participants.filter((item) => item.activity !== '静爻').map((item) => String(item.position)),
  )
    .map(Number)
    .sort((left, right) => left - right);
  const participantText = participants
    .map((item) => `第${item.position}爻${item.branch}（${item.activity}）`)
    .join('、');
  const participantKey = participants
    .map((item) => `${item.position}:${item.branch}`)
    .sort()
    .join('|');
  return {
    key: `liuyao:sanxing:${type}:${pattern}:${participantKey}`,
    type,
    branches,
    pattern,
    status: '作用待辨',
    participants,
    activePositions,
    description: `${participantText}构成${type}（${pattern}）；须结合所问事项、用神、世应、旺衰及旁爻制化辨明刑我刑他，不由刑名直接定吉凶`,
  };
}

/**
 * 复核《卜筮全书·天玄赋》“三刑须全”及“须见两爻动，刑得一爻起”：
 * 寅巳申、丑戌未须三支齐备且至少两爻明动或暗动；子卯相刑与重复自刑
 * 至少须有一爻实际发动。静爻仅同盘或三支不全时不登记为已成立三刑。
 */
export function analyzeLiuyaoSanxingFormations(
  yaosDetail: LiuyaoYaoDetail[],
  monthBranch: string,
  dayBranch: string,
): LiuyaoSanxingFormation[] {
  getBranchElement(monthBranch, '六爻月建');
  getBranchElement(dayBranch, '六爻日辰');
  if (yaosDetail.length !== 6) throw new Error('六爻三刑分析必须提供完整六爻。');
  const participants = yaosDetail.map((yao) => {
    getBranchElement(yao.najiaDizhi, `六爻第${yao.position}爻`);
    return buildSanxingParticipant(yao, monthBranch, dayBranch);
  });
  const formations = new Map<string, LiuyaoSanxingFormation>();

  for (const group of LIUYAO_SANXING_GROUPS) {
    for (const assignment of enumerateSanxingAssignments(group.members, participants)) {
      const activeCount = assignment.filter((item) => item.activity !== '静爻').length;
      const requiredActiveCount = group.pattern === '三支齐备' ? 2 : 1;
      if (activeCount < requiredActiveCount) continue;
      const formation = buildSanxingFormation(group.pattern, assignment);
      formations.set(formation.key, formation);
    }
  }

  for (const branch of ['辰', '午', '酉', '亥']) {
    const matches = participants.filter((item) => item.branch === branch);
    for (let left = 0; left < matches.length; left += 1) {
      for (let right = left + 1; right < matches.length; right += 1) {
        const assignment = [matches[left], matches[right]];
        if (assignment.every((item) => item.activity === '静爻')) continue;
        const formation = buildSanxingFormation('重复自刑', assignment);
        formations.set(formation.key, formation);
      }
    }
  }

  return [...formations.values()];
}

function addLineRelation(
  source: LiuyaoYaoDetail,
  target: LiuyaoYaoDetail,
  label: string,
  sourceIsActive: boolean,
  targetIsActive: boolean,
  support: string[],
  constraints: string[],
) {
  if (isSheng(source.wuxing, target.wuxing)) support.push(`${label}生本爻`);
  if (source.wuxing === target.wuxing) support.push(`${label}比扶本爻`);
  if (isLiuhe(source.najiaDizhi, target.najiaDizhi)) {
    support.push(sourceIsActive && targetIsActive ? `${label}与本爻合好` : `${label}合起本爻`);
  }
  if (isKe(source.wuxing, target.wuxing)) constraints.push(`${label}克本爻`);
  if (isLiuchong(source.najiaDizhi, target.najiaDizhi)) constraints.push(`${label}冲本爻`);
}

/**
 * 逐层登记《增删卜易·动静生克章》《月将章》《日辰章》及长生墓绝、动变规则。
 *
 * 本函数只给出可复核的支持与限制条件：条件允许并见，不按数量打分，也不据此
 * 直接裁定最终强弱、用神有无效、吉凶或应期。变爻只作用本位动爻。
 */
export function analyzeLiuyaoLineStrength(
  yao: LiuyaoYaoDetail,
  monthBranch: string,
  dayBranch: string,
  yaosDetail: LiuyaoYaoDetail[],
): LiuyaoLineStrengthAnalysis {
  const monthElement = getBranchElement(monthBranch, '六爻月建');
  const dayElement = getBranchElement(dayBranch, '六爻日辰');
  assertElement(yao.wuxing, `六爻第${yao.position}爻`);
  getBranchElement(yao.najiaDizhi, `六爻第${yao.position}爻`);

  const seasonState = getSeasonState(yao.wuxing, monthBranch);
  const monthStage = getLiuyaoTwelveStage(yao.wuxing, monthBranch);
  const dayStage = getLiuyaoTwelveStage(yao.wuxing, dayBranch);
  const selfSupport: string[] = [];
  const selfConstraints: string[] = [];
  const calendarSupport: string[] = [];
  const calendarConstraints: string[] = [];
  const lineSupport: string[] = [];
  const lineConstraints: string[] = [];
  const changeSupport: string[] = [];
  const changeConstraints: string[] = [];

  const hiddenMove = hasHiddenMove(yao, monthBranch, dayBranch);
  if (yao.isChanging) selfSupport.push('明动');
  if (hiddenMove) selfSupport.push('暗动');
  if (yao.isVoid) selfConstraints.push('本爻空亡');

  if (isStrongSeason(seasonState)) calendarSupport.push(`月令${seasonState}`);
  if (isWeakSeason(seasonState)) calendarConstraints.push(`月令${seasonState}`);

  const addCalendarRelation = (
    label: '月建' | '日辰',
    branch: string,
    element: string,
    stage: string,
  ) => {
    if (yao.najiaDizhi === branch) calendarSupport.push(`值${label}`);
    if (isSheng(element, yao.wuxing)) calendarSupport.push(`${label}生本爻`);
    if (element === yao.wuxing) calendarSupport.push(`${label}比扶本爻`);
    if (isLiuhe(yao.najiaDizhi, branch)) {
      if (yao.isChanging || hiddenMove) calendarConstraints.push(`${label}合绊本爻`);
      else calendarSupport.push(`静爻逢${label}合起`);
    }
    if (stage === '长生' || stage === '帝旺') calendarSupport.push(`${label}为${stage}`);
    if (isKe(element, yao.wuxing)) calendarConstraints.push(`${label}克本爻`);
    if (stage === '墓') calendarConstraints.push(`入${label === '月建' ? '月' : '日'}墓`);
    if (stage === '绝') calendarConstraints.push(`绝于${label}`);
  };
  addCalendarRelation('月建', monthBranch, monthElement, monthStage);
  addCalendarRelation('日辰', dayBranch, dayElement, dayStage);

  if (isLiuchong(yao.najiaDizhi, monthBranch)) calendarConstraints.push('月破');
  if (isLiuchong(yao.najiaDizhi, dayBranch)) {
    if (hiddenMove) {
      calendarSupport.push('日冲暗动');
    } else if (!yao.isChanging) {
      calendarConstraints.push('日破');
    } else {
      calendarConstraints.push('日辰冲本爻');
    }
  }

  const targetIsWeakStatic = isWeakSeason(seasonState) && !yao.isChanging && !hiddenMove;
  for (const source of yaosDetail) {
    if (source.position === yao.position) continue;
    assertElement(source.wuxing, `六爻第${source.position}爻`);
    getBranchElement(source.najiaDizhi, `六爻第${source.position}爻`);
    const sourceHiddenMove = hasHiddenMove(source, monthBranch, dayBranch);
    if (source.isChanging || sourceHiddenMove) {
      addLineRelation(
        source,
        yao,
        `第${source.position}爻${source.isChanging ? '明动' : '暗动'}`,
        true,
        yao.isChanging || hiddenMove,
        lineSupport,
        lineConstraints,
      );
      continue;
    }

    const sourceSeasonState = getSeasonState(source.wuxing, monthBranch);
    if (!targetIsWeakStatic || !isStrongSeason(sourceSeasonState)) continue;
    const label = `第${source.position}爻旺相静爻`;
    if (isSheng(source.wuxing, yao.wuxing)) lineSupport.push(`${label}生本爻`);
    if (isKe(source.wuxing, yao.wuxing)) lineConstraints.push(`${label}克本爻`);
  }

  let changedStage: string | undefined;
  if (yao.isChanging && yao.changedYao) {
    assertElement(yao.changedYao.wuxing, `六爻第${yao.position}爻变爻`);
    getBranchElement(yao.changedYao.dizhi, `六爻第${yao.position}爻变爻`);
    changedStage = getLiuyaoTwelveStage(yao.wuxing, yao.changedYao.dizhi);
    const changeDirection = getLiuyaoChangeDirection(yao.najiaDizhi, yao.changedYao.dizhi);
    if (isSheng(yao.changedYao.wuxing, yao.wuxing)) changeSupport.push('回头生');
    if (yao.changedYao.wuxing === yao.wuxing) changeSupport.push('比和');
    if (isLiuhe(yao.najiaDizhi, yao.changedYao.dizhi)) changeSupport.push('化扶');
    if (changeDirection === '化进神') changeSupport.push('化进神');
    if (changedStage === '长生' || changedStage === '帝旺') {
      changeSupport.push(`化${changedStage}`);
    }
    if (isKe(yao.changedYao.wuxing, yao.wuxing)) changeConstraints.push('回头克');
    if (isLiuchong(yao.changedYao.dizhi, yao.najiaDizhi)) changeConstraints.push('回头冲');
    if (isSheng(yao.wuxing, yao.changedYao.wuxing)) changeConstraints.push('化泄');
    if (isKe(yao.wuxing, yao.changedYao.wuxing)) changeConstraints.push('化耗');
    if (yao.changedYao.isVoid) changeConstraints.push('化空');
    if (isLiuchong(yao.changedYao.dizhi, monthBranch)) changeConstraints.push('化破');
    if (changeDirection === '化退神') changeConstraints.push('化退神');
    if (changedStage === '墓' || changedStage === '绝') {
      changeConstraints.push(`化${changedStage}`);
    }
  }

  const normalizedSelfSupport = unique(selfSupport);
  const normalizedSelfConstraints = unique(selfConstraints);
  const normalizedCalendarSupport = unique(calendarSupport);
  const normalizedCalendarConstraints = unique(calendarConstraints);
  const normalizedLineSupport = unique(lineSupport);
  const normalizedLineConstraints = unique(lineConstraints);
  const normalizedChangeSupport = unique(changeSupport);
  const normalizedChangeConstraints = unique(changeConstraints);
  const support = unique([
    ...normalizedSelfSupport,
    ...normalizedCalendarSupport,
    ...normalizedLineSupport,
    ...normalizedChangeSupport,
  ]);
  const constraints = unique([
    ...normalizedSelfConstraints,
    ...normalizedCalendarConstraints,
    ...normalizedLineConstraints,
    ...normalizedChangeConstraints,
  ]);

  return {
    seasonState,
    monthStage,
    dayStage,
    ...(changedStage ? { changedStage } : {}),
    selfSupport: normalizedSelfSupport,
    selfConstraints: normalizedSelfConstraints,
    calendarSupport: normalizedCalendarSupport,
    calendarConstraints: normalizedCalendarConstraints,
    lineSupport: normalizedLineSupport,
    lineConstraints: normalizedLineConstraints,
    changeSupport: normalizedChangeSupport,
    changeConstraints: normalizedChangeConstraints,
    support,
    constraints,
    status:
      support.length && constraints.length
        ? '支持与限制并见'
        : support.length
          ? '仅见支持条件'
          : '仅见限制条件',
  };
}

/**
 * 逐项登记《增删卜易·飞伏神章》所列伏神得助、飞神松动与伏神受制条件。
 * 支持与限制可以并见；本函数不把条件数量压成“有用/无用”、吉凶或应期结论。
 */
export function analyzeLiuyaoHiddenSpiritConditions(
  spirit: LiuyaoHiddenSpirit,
  monthBranch: string,
  dayBranch: string,
  yaosDetail: LiuyaoYaoDetail[],
): LiuyaoHiddenSpiritConditionAnalysis {
  const monthElement = getBranchElement(monthBranch, '六爻月建');
  const dayElement = getBranchElement(dayBranch, '六爻日辰');
  assertElement(spirit.wuxing, '六爻伏神');
  assertElement(spirit.underYao.wuxing, '六爻飞神');

  const flyingLine = yaosDetail.find((item) => item.position === spirit.position);
  if (!flyingLine) {
    throw new Error(`六爻伏神第${spirit.position}爻缺少对应飞神。`);
  }
  const flyingRelation = getLiuyaoFlyingHiddenRelation(spirit.wuxing, spirit.underYao.wuxing);
  const hiddenSeasonState = getSeasonState(spirit.wuxing, monthBranch);
  const flyingSeasonState = getSeasonState(spirit.underYao.wuxing, monthBranch);
  const hiddenMonthStage = getLiuyaoTwelveStage(spirit.wuxing, monthBranch);
  const hiddenDayStage = getLiuyaoTwelveStage(spirit.wuxing, dayBranch);
  const hiddenFlyingStage = getLiuyaoTwelveStage(spirit.wuxing, spirit.underYao.najiaDizhi);
  const flyingMonthStage = getLiuyaoTwelveStage(spirit.underYao.wuxing, monthBranch);
  const flyingDayStage = getLiuyaoTwelveStage(spirit.underYao.wuxing, dayBranch);
  const support: string[] = [];
  const constraints: string[] = [];

  if (hiddenSeasonState === '旺' || hiddenSeasonState === '相') {
    support.push(`伏神月令${hiddenSeasonState}`);
  } else if (isWeakSeason(hiddenSeasonState)) {
    constraints.push(`伏神月令${hiddenSeasonState}`);
  }
  if (flyingRelation === '飞来生伏') support.push('飞来生伏');
  if (flyingRelation === '飞来克伏') {
    constraints.push(
      flyingSeasonState === '旺' || flyingSeasonState === '相'
        ? `旺相飞神克伏（月令${flyingSeasonState}）`
        : `飞来克伏（月令${flyingSeasonState}）`,
    );
  }

  const addCalendarRelations = (label: '月建' | '日辰', branch: string, element: string) => {
    if (isSheng(element, spirit.wuxing)) support.push(`${label}生伏神`);
    if (isLiuchong(branch, spirit.najiaDizhi)) constraints.push(`${label}冲伏神`);
    if (isKe(element, spirit.wuxing)) constraints.push(`${label}克伏神`);
    if (isLiuchong(branch, spirit.underYao.najiaDizhi)) support.push(`${label}冲飞神`);
    if (isKe(element, spirit.underYao.wuxing)) support.push(`${label}克飞神`);
  };
  addCalendarRelations('月建', monthBranch, monthElement);
  addCalendarRelations('日辰', dayBranch, dayElement);

  for (const yao of yaosDetail) {
    const hiddenMove = hasHiddenMove(yao, monthBranch, dayBranch);
    if (!yao.isChanging && !hiddenMove) continue;
    const label = `第${yao.position}爻${yao.isChanging ? '明动' : '暗动'}`;
    if (isSheng(yao.wuxing, spirit.wuxing)) support.push(`${label}生伏神`);
    if (isLiuchong(yao.najiaDizhi, spirit.underYao.najiaDizhi)) {
      support.push(`${label}冲飞神`);
    }
    if (isKe(yao.wuxing, spirit.underYao.wuxing)) support.push(`${label}克飞神`);
  }

  const flyingIsMonthBreak = isLiuchong(spirit.underYao.najiaDizhi, monthBranch);
  const flyingIsMonthTomb = isLiuyaoElementInTomb(spirit.underYao.wuxing, monthBranch);
  const flyingIsDayTomb = isLiuyaoElementInTomb(spirit.underYao.wuxing, dayBranch);
  if (flyingLine.isVoid) support.push('飞神旬空');
  if (flyingIsMonthBreak) support.push('飞神月破');
  if (isWeakSeason(flyingSeasonState)) support.push(`飞神月令${flyingSeasonState}`);
  if (flyingIsMonthTomb) support.push('飞神入月墓');
  if (flyingIsDayTomb) support.push('飞神入日墓');
  if (flyingMonthStage === '绝') support.push('飞神绝于月建');
  if (flyingDayStage === '绝') support.push('飞神绝于日辰');

  const hiddenIsMonthBreak = isLiuchong(spirit.najiaDizhi, monthBranch);
  const hiddenIsMonthTomb = isLiuyaoElementInTomb(spirit.wuxing, monthBranch);
  const hiddenIsDayTomb = isLiuyaoElementInTomb(spirit.wuxing, dayBranch);
  const hiddenIsFlyingTomb = isLiuyaoElementInTomb(spirit.wuxing, spirit.underYao.najiaDizhi);
  if (spirit.isVoid) constraints.push('伏神旬空');
  if (hiddenIsMonthBreak) constraints.push('伏神月破');
  if (hiddenIsMonthTomb) constraints.push('伏神入月墓');
  if (hiddenIsDayTomb) constraints.push('伏神入日墓');
  if (hiddenIsFlyingTomb) constraints.push('伏神墓于飞神');
  if (hiddenMonthStage === '绝') constraints.push('伏神绝于月建');
  if (hiddenDayStage === '绝') constraints.push('伏神绝于日辰');
  if (hiddenFlyingStage === '绝') constraints.push('伏神绝于飞神');

  return {
    flyingRelation,
    hiddenSeasonState,
    hiddenMonthStage,
    hiddenDayStage,
    hiddenFlyingStage,
    flyingSeasonState,
    flyingMonthStage,
    flyingDayStage,
    support: unique(support),
    constraints: unique(constraints),
  };
}
