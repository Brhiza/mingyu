/**
 * @file 六爻排盘算法
 * @description 基于京房八宫法，实现六爻卦象的完整排盘。
 * @古籍依据 《京氏易传》《火珠林》《卜筮正宗》《增删卜易》；具体事项取用随问题关系取证。
 * @流派 京房易
 * @核心思想
 * 1. 时间起卦：通过时间获取卦象的六个爻。
 * 2. 卦象转换：将主卦、变卦、互卦转换为二进制表示，并从数据中查找对应卦象。
 * 3. 安世应：根据主卦在其所属八宫中的位置（首卦、一世、二世...归魂）来确定世爻和应爻。
 * 4. 纳甲：为六个爻配上天干地支，此为定五行、六亲之本。
 * 5. 六亲：根据主卦宫位五行与各爻纳甲地支五行的生克关系，确定父母、官鬼、妻财、子孙、兄弟。
 * 6. 六神：根据起卦日的日干，安上青龙、朱雀、勾陈、螣蛇、白虎、玄武。
 * 7. 变卦分析：分析动爻变化后的爻，形成“父化财”等判断依据。
 */

import { hexagramsData } from '../../divination/hexagram-data';
import { getSixAnimals, getVoidBranches } from '../../calendar/lunar';
import {
  wuxing,
  liuqinRelations,
  hexagramNaJia, // 使用新的完整纳甲数据
  palaces,
  hexagramPalaceMap,
  palaceHexagrams,
} from '../../divination/divination-data';
import { getDivinationTime } from '../../calendar/timeManager';
import { assertOptionalRecord } from '../../shared/validation';
import type { RandomOptions, RandomTrace } from '../../shared/random';
import { createRandomContext, hasRandomOptions, randomInt } from '../../shared/random';
import { attachResultMeta } from '../../shared/result';
import { analyzeLiuyaoEvidence } from '../liuyao-evidence';
import type { LiuyaoChangeRelation, LiuyaoData } from '../../types/divination';
import {
  isSheng,
  isKe,
  isLiuhe,
  isLiuhai,
  isSanxing,
  getSanxingType,
  getSeasonState,
  isLiuchong,
  BRANCH_ORDER,
  BRANCH_WUXING,
  CHANGSHENG_ORDER,
  SANHE_GROUPS,
} from '../../ganzhi';

/**
 * 五行入墓支（《卜筮正宗》卷三《墓库章》、《增删卜易·入墓》定例）：
 * 金墓在丑、木墓在未、火墓在戌、水土墓在辰。
 * 《增删卜易》所列三墓为入日墓、入动墓、动而化墓；月建仅用于旺衰，
 * 不因月支恰为某五行墓库就直接判为“入月墓”。当前结构先准确提供日墓，
 * 动墓与化墓待结合动变关系另行结构化，避免把未实现的口径混入结果。
 */
const WUXING_RUMU: Record<string, string> = {
  金: '丑',
  木: '未',
  火: '戌',
  水: '辰',
  土: '辰',
};

/**
 * 五行十二宫（《三命通会》卷三论五行旺相、《卜筮正宗》卷四十二宫）：
 * 长生（气之始）、沐浴（败地）、冠带（渐成）、临官（禄地）、帝旺（极盛）、
 * 衰（始衰）、病（渐损）、死（气尽）、墓（入墓）、绝（无气）、胎（结胎）、养（孕养）。
 *
 * 各局长生位：
 * - 金长生在巳（巳酉丑）
 * - 木长生在亥（亥卯未）
 * - 火长生在寅（寅午戌）
 * - 水长生在申（申子辰）
 * - 土长生在申（水土共长生，《三命通会》卷三）
 */
function getShiErGong(wuxing: string, branch: string): string {
  // 五行各局的长生位：
  const ZHANG_SHENG_START: Record<string, string> = {
    金: '巳', // 金长生在巳
    木: '亥', // 木长生在亥
    火: '寅', // 火长生在寅
    水: '申', // 水长生在申
    土: '申', // 土长生在申（与火不同，按《三命通会》水土共长生）
  };
  const startBranch = ZHANG_SHENG_START[wuxing];
  if (!startBranch) {
    throw new Error(`六爻十二长生无法识别五行 "${wuxing}"。`);
  }
  const startIndex = BRANCH_ORDER.indexOf(startBranch);
  const branchIndex = BRANCH_ORDER.indexOf(branch);
  if (startIndex === -1 || branchIndex === -1) {
    throw new Error(`六爻十二长生无法识别地支 "${branch}"。`);
  }
  const offset = (((branchIndex - startIndex) % 12) + 12) % 12;
  const stage = CHANGSHENG_ORDER[offset];
  if (!stage) {
    throw new Error(`六爻十二长生无法定位 ${wuxing} 在 ${branch} 支的状态。`);
  }
  return stage;
}

/** 判断爻之地支是否入日墓 */
function isRiMu(branch: string, dayBranch: string): boolean {
  const wuxing = BRANCH_WUXING[branch];
  return WUXING_RUMU[wuxing] === dayBranch;
}

/**
 * 检测月建/日辰对爻的三合局触发（《卜筮正宗》卷三《三合局章》）：
 * 若月建或日辰为三合局中一支，再有两爻相配，即为完整三合局。
 * "三合主久远、多人协力，事势增强，吉凶随局而定。"
 */
function checkSanheWithTrigger(
  activeBranches: string[],
  triggerBranch: string,
  triggerLabel: '日辰' | '月建',
): { group: string; members: string[]; description: string } | null {
  const activeBranchSet = new Set(activeBranches);
  for (const [group, members] of Object.entries(SANHE_GROUPS)) {
    if (!members.includes(triggerBranch)) {
      continue;
    }
    const requiredYaoBranches = members.filter((member) => member !== triggerBranch);
    if (requiredYaoBranches.every((member) => activeBranchSet.has(member))) {
      return {
        group,
        members,
        description: `${triggerLabel}${triggerBranch}引动三合${group}，三合局成，事势增强`,
      };
    }
  }
  return null;
}

// 六合月日暗助检测（已在 yaosDetail 中通过月令旺衰、日冲与动静状态实现暗动判定）

/**
 * 回头生克冲：动爻变出之爻对动爻本身的关系。
 * - 回头生：变爻生动爻，如木爻动化水爻
 * - 回头克：变爻克动爻，如木爻动化金爻
 * - 回头冲：变爻冲动爻（六冲）
 * - 化空：变爻落旬空
 * - 化进/化退：同五行递进退（由 getLiuyaoChangeDirection 判定）
 * - 比和：同五行同比和
 * - 化泄：动爻生变爻，本爻之气外泄
 * - 化耗：动爻克变爻，本爻用力而耗
 */
const VALID_LIUYAO_WUXING = new Set(Object.keys(wuxing));

export function getLiuyaoChangeRelation(
  originalWuxing: string,
  changedWuxing: string,
  originalBranch: string,
  changedBranch: string,
  changedIsVoid: boolean,
): LiuyaoChangeRelation {
  const relations = getLiuyaoChangeRelations(
    originalWuxing,
    changedWuxing,
    originalBranch,
    changedBranch,
    changedIsVoid,
  );
  if (changedIsVoid) return '化空';
  const relation = relations[0];
  if (!relation) {
    throw new Error(`动变五行关系无法判定：${originalWuxing}→${changedWuxing}`);
  }
  return relation;
}

/**
 * 返回动变条件的完整并见列表。
 * 《增删卜易》分别论回头生克冲、化空、进退等条件；化空描述变爻旬空，
 * 不会抹掉变爻对本爻原有的生、克、冲或比泄耗关系。卷二《六冲章》又以
 * “酉金化卯冲世而不克世”明确区分冲与克，故相冲和五行关系也分别保存。
 */
export function getLiuyaoChangeRelations(
  originalWuxing: string,
  changedWuxing: string,
  originalBranch: string,
  changedBranch: string,
  changedIsVoid: boolean,
): LiuyaoChangeRelation[] {
  if (!VALID_LIUYAO_WUXING.has(originalWuxing) || !VALID_LIUYAO_WUXING.has(changedWuxing)) {
    throw new Error(`六爻动变五行无效：${originalWuxing || '空'}→${changedWuxing || '空'}`);
  }
  if (!BRANCH_ORDER.includes(originalBranch) || !BRANCH_ORDER.includes(changedBranch)) {
    throw new Error(`六爻动变地支无效：${originalBranch || '空'}→${changedBranch || '空'}`);
  }
  if (typeof changedIsVoid !== 'boolean') {
    throw new Error('六爻变爻旬空标记必须是布尔值');
  }
  const wuxingRelation: LiuyaoChangeRelation = isSheng(changedWuxing, originalWuxing)
    ? '回头生'
    : isKe(changedWuxing, originalWuxing)
      ? '回头克'
      : originalWuxing === changedWuxing
        ? '比和'
        : isSheng(originalWuxing, changedWuxing)
          ? '化泄'
          : isKe(originalWuxing, changedWuxing)
            ? '化耗'
            : (() => {
                throw new Error(`动变五行关系无法判定：${originalWuxing}→${changedWuxing}`);
              })();
  const relations: LiuyaoChangeRelation[] = isLiuchong(originalBranch, changedBranch)
    ? ['回头冲', wuxingRelation]
    : [wuxingRelation];
  if (changedIsVoid) relations.push('化空');
  return relations;
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

/** 判断爻支是否被日辰相冲；暗动、日破与动爻日冲须在此基础上再按动静旺衰区分。 */
function isDayClash(branch: string, dayBranch: string): boolean {
  return isLiuchong(branch, dayBranch);
}

/**
 * 判断是否为月破：爻的地支被月建地支冲克
 */
function isMonthBreak(branch: string, monthBranch: string): boolean {
  return isLiuchong(branch, monthBranch);
}

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

/**
 * 判断化进神/退神。
 * 按《增删卜易》进神退神章明表取用，不按十二地支循环外推。
 */
export function getLiuyaoChangeDirection(
  originalBranch: string,
  changedBranch: string,
): '化进神' | '化退神' | null {
  if (LIUYAO_ADVANCING_CHANGE[originalBranch] === changedBranch) {
    return '化进神';
  }
  if (LIUYAO_RETREATING_CHANGE[originalBranch] === changedBranch) {
    return '化退神';
  }
  return null;
}

export type LiuyaoHexagramRelation = '六合卦' | '六冲卦';
export type LiuyaoFanFuScope = '内卦' | '外卦' | '内外';
export type LiuyaoFanFuKind = '卦反吟' | '爻反吟' | '伏吟';

export interface LiuyaoFanFuRelationItem {
  kind: LiuyaoFanFuKind;
  scope: LiuyaoFanFuScope;
  label: string;
  description: string;
}

export interface LiuyaoFanFuRelations {
  /** 反吟结构，可能同时存在内卦、外卦不同类型 */
  fanyin: LiuyaoFanFuRelationItem[];
  /** 伏吟结构，按动变后纳甲地支不变识别 */
  fuyin: LiuyaoFanFuRelationItem[];
  /** 便于前端与提示词直接展示的标签 */
  labels: string[];
}

export type LiuyaoPalaceStage =
  '首卦' | '一世' | '二世' | '三世' | '四世' | '五世' | '游魂' | '归魂';

const WHOLE_HEXAGRAM_PAIR_INDEXES: Array<[number, number]> = [
  [0, 3],
  [1, 4],
  [2, 5],
];

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

function trimHexagramRelationSuffix(relation: LiuyaoHexagramRelation) {
  return relation.replace(/卦$/, '');
}

/**
 * 判断整卦层面的六合卦/六冲卦。
 * 《增删卜易》六合章、六冲章以初四、二五、三上三组爻支相合/相冲定整卦关系，
 * 如天地否为六合卦、乾为天为六冲卦。
 */
export function getLiuyaoHexagramRelation(hexagramName: string): LiuyaoHexagramRelation | null {
  const branches = getNaJiaBranches(hexagramName);

  if (
    WHOLE_HEXAGRAM_PAIR_INDEXES.every(([lower, upper]) => isLiuhe(branches[lower], branches[upper]))
  ) {
    return '六合卦';
  }

  if (
    WHOLE_HEXAGRAM_PAIR_INDEXES.every(([lower, upper]) =>
      isLiuchong(branches[lower], branches[upper]),
    )
  ) {
    return '六冲卦';
  }

  return null;
}

export function getLiuyaoHexagramRelations(
  originalName: string,
  changedName: string | undefined,
  hasChangingYaos: boolean,
) {
  const original = getLiuyaoHexagramRelation(originalName);
  const changed = hasChangingYaos && changedName ? getLiuyaoHexagramRelation(changedName) : null;
  const transition =
    original && changed
      ? `${trimHexagramRelationSuffix(original)}变${trimHexagramRelationSuffix(changed)}`
      : null;

  return {
    original,
    changed,
    transition,
  };
}

function collectSanxingInBranches(branches: string[]): Array<{ branches: string[]; type: string }> {
  const uniqueBranches = Array.from(new Set(branches));
  const result: Array<{ branches: string[]; type: string }> = [];
  const mutualGroups = [
    ['寅', '巳', '申'],
    ['丑', '戌', '未'],
    ['子', '卯'],
  ];

  for (const group of mutualGroups) {
    const present = group.filter((branch) => uniqueBranches.includes(branch));
    if (
      present.length >= 2 &&
      present.some((branch, index) =>
        present.slice(index + 1).some((other) => isSanxing(branch, other)),
      )
    ) {
      const type = getSanxingType(present[0]);
      if (type) {
        result.push({ branches: present, type });
      }
    }
  }

  for (const branch of ['辰', '午', '酉', '亥'] as const) {
    if (branches.filter((item) => item === branch).length >= 2 && isSanxing(branch, branch)) {
      const type = getSanxingType(branch);
      if (type) {
        result.push({ branches: [branch, branch], type });
      }
    }
  }

  return result;
}

function getHexagramDataByName(hexagramName: string) {
  return hexagramsData.find((item) => item.name === hexagramName);
}

function getRequiredHexagramData(hexagramName: string) {
  const hexagram = getHexagramDataByName(hexagramName);
  if (!hexagram) {
    throw new Error(`找不到卦象 "${hexagramName}"。`);
  }
  return hexagram;
}

function getNaJiaBranches(hexagramName: string) {
  getRequiredHexagramData(hexagramName);
  const branches = hexagramNaJia[hexagramName];
  if (!branches || branches.length !== 6) {
    throw new Error(`找不到卦象 "${hexagramName}" 的完整纳甲信息。`);
  }
  return branches;
}

function isTrigramFanyin(originalTrigram: string, changedTrigram: string) {
  return LIUYAO_FANYIN_TRIGRAM_PAIRS[originalTrigram] === changedTrigram;
}

function getScope(lowerMatched: boolean, upperMatched: boolean): LiuyaoFanFuScope | null {
  if (lowerMatched && upperMatched) return '内外';
  if (lowerMatched) return '内卦';
  if (upperMatched) return '外卦';
  return null;
}

function getScopes(scope: LiuyaoFanFuScope): Array<'内卦' | '外卦'> {
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
  const parts = getScopes(scope).map((item) =>
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
  const parts = getScopes(scope).map((item) =>
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
  if (!kind || !scope) {
    return;
  }
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
  const original = getRequiredHexagramData(originalName);
  const originalBranches = getNaJiaBranches(originalName);

  if (!hasChangingYaos || !changedName) {
    return empty;
  }

  const changed = getRequiredHexagramData(changedName);
  const changedBranches = getNaJiaBranches(changedName);

  const lowerYaoFanyin = originalBranches
    .slice(0, 3)
    .every((branch, index) => isLiuchong(branch, changedBranches[index]));
  const upperYaoFanyin = originalBranches
    .slice(3)
    .every((branch, index) => isLiuchong(branch, changedBranches[index + 3]));
  const lowerGuaFanyin = isTrigramFanyin(original.lower, changed.lower);
  const upperGuaFanyin = isTrigramFanyin(original.upper, changed.upper);

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
  const fuyinScope = getScope(lowerFuyin, upperFuyin);
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

  return {
    fanyin,
    fuyin,
    labels: [...fanyin, ...fuyin].map((item) => item.label),
  };
}

/**
 * 寻宫：根据卦名查找其所属的八宫
 * @param hexagramName 卦名，如“乾为天”
 * @returns 返回该卦所属的宫位对象，包含五行属性
 */
function findPalace(hexagramName: string) {
  const palaceName = hexagramPalaceMap[hexagramName as keyof typeof hexagramPalaceMap];
  const palace = palaces[palaceName as keyof typeof palaces];
  if (!palace) {
    throw new Error(`找不到卦象 "${hexagramName}" 的所属宫位。`);
  }
  return palace;
}

/**
 * 纳甲与安六亲
 * @param mainHexagramName 主卦卦名
 * @param palace 主卦所属宫位
 * @returns 返回一个包含六个爻的地支、五行、六亲信息的数组
 */
function getNaJiaAndLiuQin(mainHexagramName: string, palace: { name: string; wuxing: string }) {
  const yaosWithInfo: Array<{ dizhi: string; wuxing: string; liuqin: string }> = [];
  const najiaDizhiArray = hexagramNaJia[mainHexagramName];

  if (!najiaDizhiArray) {
    throw new Error(`找不到卦象 "${mainHexagramName}" 的纳甲信息。`);
  }

  for (let i = 0; i < 6; i++) {
    const dizhi = najiaDizhiArray[i];
    const yaoWuxing = Object.keys(wuxing).find((key) =>
      wuxing[key as keyof typeof wuxing].includes(dizhi),
    );
    if (!yaoWuxing) {
      throw new Error(`无法根据地支 "${dizhi}" 推导五行属性。`);
    }
    const palaceLiuqin = liuqinRelations[palace.wuxing as keyof typeof liuqinRelations];
    if (!palaceLiuqin) {
      throw new Error(`找不到宫位五行 "${palace.wuxing}" 的六亲关系。`);
    }
    const liuqin = palaceLiuqin[yaoWuxing as keyof typeof palaceLiuqin];
    if (!liuqin) {
      throw new Error(`找不到 "${palace.wuxing}" 与 "${yaoWuxing}" 的六亲关系。`);
    }
    yaosWithInfo.push({ dizhi, wuxing: yaoWuxing, liuqin });
  }
  return yaosWithInfo;
}

function buildHiddenSpirits(params: {
  originalName: string;
  palace: { name: string; wuxing: string };
  yaosDetail: Array<{
    position: number;
    sixRelative: string;
    najiaDizhi: string;
    wuxing: string;
  }>;
  voidBranches: string[];
}) {
  const { originalName, palace, yaosDetail, voidBranches } = params;
  const homeHexagramName = palaceHexagrams[palace.name as keyof typeof palaceHexagrams]?.[0];

  if (!homeHexagramName || homeHexagramName === originalName) {
    return [];
  }

  const appearedRelatives = new Set(yaosDetail.map((item) => item.sixRelative));
  const homeYaos = getNaJiaAndLiuQin(homeHexagramName, palace);

  return homeYaos
    .map((homeYao, index) => ({
      sixRelative: homeYao.liuqin,
      position: index + 1,
      najiaDizhi: homeYao.dizhi,
      wuxing: homeYao.wuxing,
      isVoid: voidBranches.includes(homeYao.dizhi),
      underYao: {
        position: yaosDetail[index].position,
        sixRelative: yaosDetail[index].sixRelative,
        najiaDizhi: yaosDetail[index].najiaDizhi,
        wuxing: yaosDetail[index].wuxing,
      },
    }))
    .filter((item) => !appearedRelatives.has(item.sixRelative));
}

/**
 * 安世应
 * @param hexagramName 卦名
 * @param palaceName 宫位名
 * @returns 返回世爻和应爻所在的爻位（1-6）
 */
export function getLiuyaoPalaceStage(hexagramName: string, palaceName?: string): LiuyaoPalaceStage {
  // 京房八宫卦序，决定了世爻的位置
  const palaceOrder: LiuyaoPalaceStage[] = [
    '首卦',
    '一世',
    '二世',
    '三世',
    '四世',
    '五世',
    '游魂',
    '归魂',
  ];
  const resolvedPalaceName =
    palaceName || hexagramPalaceMap[hexagramName as keyof typeof hexagramPalaceMap];
  const hexagramsInPalace = palaceHexagrams[resolvedPalaceName as keyof typeof palaceHexagrams];
  if (!hexagramsInPalace) {
    throw new Error(`找不到宫位 "${resolvedPalaceName}" 的卦象列表。`);
  }

  const generation = hexagramsInPalace.indexOf(hexagramName);
  if (generation === -1) {
    throw new Error(`卦象 "${hexagramName}" 不在宫位 "${resolvedPalaceName}" 的列表中。`);
  }

  return palaceOrder[generation];
}

function getShiYing(hexagramName: string, palaceName: string): { shi: number; ying: number } {
  const shiYaoMap: Record<LiuyaoPalaceStage, number> = {
    首卦: 6,
    一世: 1,
    二世: 2,
    三世: 3,
    四世: 4,
    五世: 5,
    游魂: 4,
    归魂: 3,
  };
  const palaceStage = getLiuyaoPalaceStage(hexagramName, palaceName);
  const shiYao = shiYaoMap[palaceStage];
  // 应爻永远在世爻之上或之下三位
  const yingYao = shiYao + 3 > 6 ? shiYao - 3 : shiYao + 3;
  return { shi: shiYao, ying: yingYao };
}

/**
 * 生成一个代表世应位置的字符串数组
 * @param shiYing 世应位置对象
 * @returns 一个六元素的数组，在世应位置上标记“世”或“应”
 */
function getWorldAndResponseArray(shiYing: { shi: number; ying: number }): string[] {
  const result = ['', '', '', '', '', ''];
  result[shiYing.shi - 1] = '世';
  result[shiYing.ying - 1] = '应';
  return result;
}

function getSpecialPattern(
  changingCount: number,
  mainHexagramName: string,
): {
  specialPattern?: '静卦' | '独静卦' | '全动卦' | '乾卦用九' | '坤卦用六';
  specialAdvice?: string;
  isChaotic: boolean;
  chaoticReason?: string;
} {
  if (changingCount === 0) {
    return {
      specialPattern: '静卦',
      specialAdvice: '六爻安静，以本卦卦意和世应用神为主，不取变爻之象。',
      isChaotic: false,
    };
  }

  if (changingCount === 5) {
    return {
      specialPattern: '独静卦',
      specialAdvice: '五爻俱动，一爻独静。常见取法以独静爻为关键，同时兼看变卦所示趋势。',
      isChaotic: false,
    };
  }

  if (changingCount === 6) {
    if (mainHexagramName === '乾为天') {
      return {
        specialPattern: '乾卦用九',
        specialAdvice:
          '乾卦六爻皆动，宜以用九“见群龙无首，吉”为主，兼参之卦总势，不按常规逐爻细断。',
        isChaotic: false,
      };
    }

    if (mainHexagramName === '坤为地') {
      return {
        specialPattern: '坤卦用六',
        specialAdvice: '坤卦六爻皆动，宜以用六“利永贞”为主，兼参之卦总势，不按常规逐爻细断。',
        isChaotic: false,
      };
    }

    return {
      specialPattern: '全动卦',
      specialAdvice: '六爻全动，宜总观本卦与变卦气势，不宜按常规逐爻细碎分断。',
      isChaotic: true,
      chaoticReason: '六爻全动，属于乱动卦。传统上此类卦不宜按常规多爻细断，宜另取用神旺衰总观。',
    };
  }

  return {
    isChaotic: false,
  };
}

/**
 * 生成六爻卦盘
 *
 * 使用京房八宫法，按时间起卦。支持传入自定义时间，不传则使用当前时间。
 * 返回完整的六爻卦盘，包含主卦、变卦、互卦、世应、纳甲、六亲、六神等信息。
 *
 * @param customDate 自定义起卦时间（可选），若不提供则使用当前时间。
 * @param options 可选手工三钱法爻值，用于复现真实投掷或固定卦例。
 * @returns 完整的六爻卦盘数据对象 LiuyaoData。
 *
 * @example
 * ```ts
 * const result = generateLiuyao();
 * // result 包含 mainHexagram、changedHexagram、yaos（六爻详情）等字段
 * ```
 */
export type LiuyaoGenerationMethod = 'time' | 'manual' | 'coins';

export interface LiuyaoGenerationOptions extends RandomOptions {
  /** 起卦方式；默认有 yaos 时为 manual，否则为 time。 */
  method?: LiuyaoGenerationMethod;
  /** 可选手工三钱法爻值，按初爻到上爻传入 6、7、8、9。 */
  yaos?: readonly number[];
  /** 用户逐爻手摇得到的三钱记录，按初爻到上爻传入。 */
  coinThrows?: readonly {
    coins: readonly (2 | 3)[];
    total: 6 | 7 | 8 | 9;
  }[];
}

type LiuyaoGeneration = NonNullable<import('../../types/divination').LiuyaoData['generation']>;

function generateCoinYaos(
  method: 'time' | 'coins',
  options: RandomOptions,
): {
  yaos: number[];
  generation: LiuyaoGeneration;
  randomTrace: RandomTrace;
} {
  const context = createRandomContext(options);
  const coinThrows: NonNullable<LiuyaoGeneration['coinThrows']> = [];
  const yaos: number[] = [];
  for (let yaoIndex = 0; yaoIndex < 6; yaoIndex++) {
    const coins = [0, 1, 2].map(() => (randomInt(2, context.random) === 0 ? 2 : 3)) as [
      2 | 3,
      2 | 3,
      2 | 3,
    ];
    const total = coins.reduce<number>((sum, coin) => sum + coin, 0) as 6 | 7 | 8 | 9;
    coinThrows.push({ coins, total });
    yaos.push(total);
  }
  return {
    yaos,
    generation: { method, coinThrows },
    randomTrace: context.getTrace(),
  };
}

function resolveRawYaos(
  timestamp: number,
  options?: LiuyaoGenerationOptions,
): { yaos: number[]; generation: LiuyaoGeneration; randomTrace?: RandomTrace } {
  assertOptionalRecord(options, '六爻起卦设置');
  const method = options?.method ?? (options?.yaos !== undefined ? 'manual' : 'time');
  if (!['time', 'manual', 'coins'].includes(method)) {
    throw new Error(`未知的六爻起卦方式: ${method}`);
  }
  const usesRandomOptions = hasRandomOptions(options);
  if (method === 'time') {
    if (options?.yaos !== undefined) throw new Error('六爻时间起卦不能同时提供手工爻值。');
    if (options?.coinThrows !== undefined) throw new Error('六爻时间起卦不能同时提供手摇记录。');
    if (usesRandomOptions) throw new Error('六爻时间起卦不接受额外随机选项。');
    return generateCoinYaos('time', { seed: `时间起卦:${timestamp}` });
  }
  if (method === 'coins') {
    if (options?.yaos !== undefined) throw new Error('六爻模拟投掷不能同时提供手工爻值。');
    if (options?.coinThrows !== undefined) {
      if (usesRandomOptions) throw new Error('六爻手摇记录不能同时提供随机选项。');
      if (options.coinThrows.length !== 6) {
        throw new Error('六爻手摇记录必须恰好包含 6 爻。');
      }
      const coinThrows = options.coinThrows.map((item, index) => {
        if (item.coins.length !== 3 || !item.coins.every((coin) => coin === 2 || coin === 3)) {
          throw new Error(`第${index + 1}爻必须包含三枚有效铜钱。`);
        }
        const coins = [...item.coins] as [2 | 3, 2 | 3, 2 | 3];
        const total = coins.reduce<number>((sum, coin) => sum + coin, 0) as 6 | 7 | 8 | 9;
        if (item.total !== total) {
          throw new Error(`第${index + 1}爻的铜钱合计与爻值不一致。`);
        }
        return { coins, total };
      });
      return {
        yaos: coinThrows.map((item) => item.total),
        generation: { method: 'coins', coinThrows },
      };
    }
    return generateCoinYaos('coins', options ?? {});
  }
  if (options?.coinThrows !== undefined) throw new Error('六爻手工起卦不能同时提供手摇记录。');
  if (usesRandomOptions) throw new Error('六爻手工起卦不接受随机选项。');
  if (options?.yaos === undefined) throw new Error('六爻手工起卦必须提供六个爻值。');
  if (options.yaos.length !== 6) {
    throw new Error('六爻手工爻值必须恰好包含 6 爻。');
  }
  const yaos = [...options.yaos];
  if (!yaos.every((value) => Number.isInteger(value) && value >= 6 && value <= 9)) {
    throw new Error('六爻手工爻值只能是 6、7、8、9。');
  }
  return { yaos, generation: { method: 'manual' } };
}

function toHexagramBinary(yaos: string[]): string {
  if (yaos.length !== 6) {
    throw new Error(`六爻卦象必须恰好包含 6 爻，实际 ${yaos.length} 爻。`);
  }
  if (!yaos.every((yao) => yao === '阳' || yao === '阴')) {
    throw new Error('六爻卦象只能包含阴爻或阳爻。');
  }
  const lines = yaos.map((yao) => (yao === '阳' ? '1' : '0'));
  // 六十四卦编码按“上卦、下卦”，每个经卦内部仍按初爻到三爻排列。
  return [...lines.slice(3, 6), ...lines.slice(0, 3)].join('');
}

export function generateLiuyao(customDate?: Date, options?: LiuyaoGenerationOptions) {
  // 1. 获取占卜时间的干支信息
  const { ganzhi, timestamp } = getDivinationTime(customDate);
  const resolvedGeneration = resolveRawYaos(timestamp, options);
  const rawYaos = resolvedGeneration.yaos;

  const mainYaos = rawYaos.map((yao) => (yao === 7 || yao === 9 ? '阳' : '阴'));
  const changedYaos = rawYaos.map((yao, index) => {
    if (yao === 6) return '阳';
    if (yao === 9) return '阴';
    return mainYaos[index];
  });

  const mainBinary = toHexagramBinary(mainYaos);
  const changedBinary = toHexagramBinary(changedYaos);

  const getInterHexagram = (yaos: string[]) => {
    const interLower = yaos.slice(1, 4);
    const interUpper = yaos.slice(2, 5);
    return [...interLower, ...interUpper];
  };
  const interYaos = getInterHexagram(mainYaos);
  const interBinary = toHexagramBinary(interYaos);

  const mainHexagram = hexagramsData.find((h) => h.binarySymbol === mainBinary);
  const changedHexagram = hexagramsData.find((h) => h.binarySymbol === changedBinary);
  const interHexagram = hexagramsData.find((h) => h.binarySymbol === interBinary);

  if (!mainHexagram || !changedHexagram || !interHexagram) {
    throw new Error(`卦象查找失败: 主=${mainBinary}, 变=${changedBinary}, 互=${interBinary}`);
  }

  const dayGan = ganzhi.day.substring(0, 1);
  const dayBranch = ganzhi.day.substring(1);
  const monthBranch = ganzhi.month.substring(1);
  const animals = getSixAnimals(dayGan);
  const palace = findPalace(mainHexagram.name);
  const yaosInfo = getNaJiaAndLiuQin(mainHexagram.name, palace);
  const shiYing = getShiYing(mainHexagram.name, palace.name);
  const palaceStage = getLiuyaoPalaceStage(mainHexagram.name, palace.name);
  const voids = getVoidBranches(ganzhi.day);

  //【核心修正：增加变卦分析】
  // 六爻占断，吉凶之机尽在“动变”二字。静爻观其本，动爻察其变。
  // 原算法只排主卦，不知其变，则吉凶难辨，故此为修正之核心。
  // 1. 获取变卦的纳甲六亲信息。
  // 2. 关键法理：变卦的宫位五行，永远跟从主卦的宫位五行来定六亲。
  //    例如，乾宫（金）的“天地否”变“风地观”，虽变卦“观”属巽宫（木），
  //    但在定六亲时，仍以主卦的乾金为“我”，来论其兄弟、子孙等。
  const changedYaosInfo = getNaJiaAndLiuQin(changedHexagram.name, palace);

  const changingYaosResult = rawYaos
    .map((yao, index) => ({
      position: index + 1,
      isChanging: yao === 6 || yao === 9,
      type: yao === 6 ? '老阴' : yao === 9 ? '老阳' : '静爻',
    }))
    .filter((yao) => yao.isChanging);

  const { specialPattern, specialAdvice, isChaotic, chaoticReason } = getSpecialPattern(
    changingYaosResult.length,
    mainHexagram.name,
  );
  const hexagramRelations = getLiuyaoHexagramRelations(
    mainHexagram.name,
    changedHexagram.name,
    changingYaosResult.length > 0,
  );
  const fanfuRelations = getLiuyaoFanFuRelations(
    mainHexagram.name,
    changedHexagram.name,
    changingYaosResult.length > 0,
  );
  const yaosDetail = yaosInfo.map((info, index) => {
    const isChanging = rawYaos[index] === 6 || rawYaos[index] === 9;
    const changedInfo = isChanging ? changedYaosInfo[index] : null;
    const isDayClashFlag = isDayClash(info.dizhi, dayBranch);
    const isMonthBreakFlag = isMonthBreak(info.dizhi, monthBranch);
    const changeDirection = changedInfo
      ? getLiuyaoChangeDirection(info.dizhi, changedInfo.dizhi)
      : null;

    // 月令旺衰：按月建定爻之五行的旺相休囚死。旺相为有力，休囚死为无力。
    const seasonState = getSeasonState(info.wuxing, monthBranch);
    // 《增删卜易·暗动章》：旺相静爻逢日冲为暗动，休囚静爻逢日冲为日破。
    // 动爻逢日冲另属“动散章”，原文强调不能见冲即断散，因此只记录日辰冲动事实。
    const isHiddenMove =
      !isChanging && isDayClashFlag && (seasonState === '旺' || seasonState === '相');
    const isDayBreakFlag = !isChanging && isDayClashFlag && !isHiddenMove;
    // 回头生克冲：动爻变出之爻对动爻本身的关系（仅动爻有变爻时计算）。
    const changeRelation = changedInfo
      ? getLiuyaoChangeRelation(
          info.wuxing,
          changedInfo.wuxing,
          info.dizhi,
          changedInfo.dizhi,
          voids.includes(changedInfo.dizhi),
        )
      : null;
    const changeRelations = changedInfo
      ? getLiuyaoChangeRelations(
          info.wuxing,
          changedInfo.wuxing,
          info.dizhi,
          changedInfo.dizhi,
          voids.includes(changedInfo.dizhi),
        )
      : [];

    return {
      position: index + 1,
      rawValue: rawYaos[index],
      yaoType: mainYaos[index] as '阳' | '阴',
      isChanging: isChanging,
      changeType: rawYaos[index] === 6 ? '老阴' : rawYaos[index] === 9 ? '老阳' : '静爻',
      sixGod: animals[index],
      sixRelative: info.liuqin,
      najiaDizhi: info.dizhi,
      wuxing: info.wuxing,
      isWorld: shiYing.shi === index + 1,
      isResponse: shiYing.ying === index + 1,
      isVoid: voids.includes(info.dizhi),
      isDayClash: isDayClashFlag,
      isDayBreak: isDayBreakFlag,
      isMonthBreak: isMonthBreakFlag,
      isHiddenMove: isHiddenMove,
      seasonState: seasonState,
      changeDirection: changeDirection,
      changeRelation: changeRelation,
      changeRelations,
      // 新增长支关系检测
      isSanxing: isSanxing(info.dizhi, dayBranch) || isSanxing(info.dizhi, monthBranch),
      sanxingType: getSanxingType(info.dizhi) || undefined,
      isLiuhe: isLiuhe(info.dizhi, dayBranch) || isLiuhe(info.dizhi, monthBranch),
      liuhePartner: isLiuhe(info.dizhi, dayBranch)
        ? dayBranch
        : isLiuhe(info.dizhi, monthBranch)
          ? monthBranch
          : undefined,
      isLiuhai: isLiuhai(info.dizhi, dayBranch) || isLiuhai(info.dizhi, monthBranch),
      isRuMu: isRiMu(info.dizhi, dayBranch),
      shiErGong: getShiErGong(info.wuxing, info.dizhi),
      // 兼容旧字段：古籍三墓不含“月墓”，因此固定为 false。
      isYueMu: false,
      isRiMu: isRiMu(info.dizhi, dayBranch),
      changedYao: changedInfo
        ? {
            dizhi: changedInfo.dizhi,
            wuxing: changedInfo.wuxing,
            liuqin: changedInfo.liuqin,
            isVoid: voids.includes(changedInfo.dizhi),
          }
        : null,
    };
  });
  const hiddenSpirits = buildHiddenSpirits({
    originalName: mainHexagram.name,
    palace,
    yaosDetail,
    voidBranches: voids,
  });

  // 三合局只取明动、暗动及其变爻；静态纳甲支不能自行凑局。
  const yaoBranches = yaosInfo.map((i) => i.dizhi);
  const activeBranches = yaosDetail.flatMap((yao) => {
    if (!yao.isChanging && !yao.isHiddenMove) {
      return [];
    }
    return yao.changedYao ? [yao.najiaDizhi, yao.changedYao.dizhi] : [yao.najiaDizhi];
  });
  const sanheWithDay = checkSanheWithTrigger(activeBranches, dayBranch, '日辰');
  const sanheWithMonth = checkSanheWithTrigger(activeBranches, monthBranch, '月建');

  const sanxingInYaos = collectSanxingInBranches(yaoBranches);

  // 月卦身（按六爻传统“阳世从子月起，阴世从午月生，从初数至世方真”）：
  // 阳世：初爻子、二爻丑、三爻寅、四爻卯、五爻辰、六爻巳
  // 阴世：初爻午、二爻未、三爻申、四爻酉、五爻戌、六爻亥
  // 世爻的阴阳决定卦身取阳表还是阴表
  const shiYaoType = mainYaos[shiYing.shi - 1];
  if (shiYaoType !== '阳' && shiYaoType !== '阴') {
    throw new Error(`六爻世爻资料缺失：第${shiYing.shi}爻`);
  }
  const guaShenBranch = getLiuyaoGuaShenBranch(shiYing.shi, shiYaoType === '阳');
  const guaShenYao = yaosInfo.find((i) => i.dizhi === guaShenBranch);
  const guaShen = guaShenYao
    ? {
        branch: guaShenBranch,
        sixRelative: guaShenYao.liuqin,
        position: yaosInfo.indexOf(guaShenYao) + 1,
      }
    : null;

  const result: LiuyaoData = {
    originalName: mainHexagram.name,
    changedName: changedHexagram.name,
    interName: interHexagram.name,
    yaoArray: rawYaos,
    changingYaos: changingYaosResult,
    sixGods: animals,
    sixRelatives: yaosInfo.map((info) => info.liuqin),
    najiaDizhi: yaosInfo.map((info) => info.dizhi),
    wuxing: yaosInfo.map((info) => info.wuxing),
    worldAndResponse: getWorldAndResponseArray(shiYing),
    voidBranches: voids,
    palace,
    palaceStage,
    ganzhi,
    specialPattern,
    specialAdvice,
    isChaotic,
    chaoticReason,
    yaosDetail,
    hiddenSpirits,
    hexagramRelations,
    fanfuRelations,
    sanheWithDay,
    sanheWithMonth,
    sanxingInYaos,
    guaShen,
    generation: resolvedGeneration.generation,
    timestamp,
  };
  const resultWithMeta = attachResultMeta(result, {
    algorithm: 'liuyao',
    input: {
      method: resolvedGeneration.generation.method,
      timestamp,
      yaos: resolvedGeneration.generation.method === 'manual' ? rawYaos : undefined,
    },
    calculatedAt: timestamp,
    random: resolvedGeneration.randomTrace,
  });
  return { ...resultWithMeta, evidenceAnalysis: analyzeLiuyaoEvidence(resultWithMeta) };
}

export { buildHiddenSpirits };
export { analyzeLiuyaoEvidence, conditionLiuyaoTraditionalText } from '../liuyao-evidence';
export type {
  LiuyaoCounterEvidenceFact,
  LiuyaoCounterSummaryFact,
  LiuyaoEvidenceAnalysis,
  LiuyaoEvidenceOptions,
  LiuyaoEvidenceTopic,
  LiuyaoGodChainItem,
  LiuyaoGodRole,
  LiuyaoHexagramStructureFact,
  LiuyaoHiddenSpiritCoverageFact,
  LiuyaoHiddenSpiritFact,
  LiuyaoLineCoverageFact,
  LiuyaoLineFact,
  LiuyaoTimingFact,
  LiuyaoTimingSummaryFact,
  LiuyaoTraditionalSymbolFact,
  LiuyaoUsefulGodCandidate,
  LiuyaoUsefulGodSelectionFact,
  LiuyaoYaoReference,
} from '../liuyao-evidence';
