/**
 * @file 六爻排盘算法
 * @description 基于京房八宫法，实现六爻卦象的完整排盘。
 * @流派 京房易
 * @核心思想
 * 1. 起卦来源：兼容时间种子模拟三钱、手工六爻值与三钱记录/模拟。
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
  trigramNaJiaTiangan,
} from '../../divination/divination-data';
import { getDivinationTime } from '../../calendar/timeManager';
import { assertOptionalRecord } from '../../shared/validation';
import type { RandomOptions, RandomTrace } from '../../shared/random';
import { createRandomContext, hasRandomOptions, randomInt } from '../../shared/random';
import { attachResultMeta } from '../../shared/result';
import { analyzeLiuyaoEvidence } from '../liuyao-evidence';
import {
  analyzeLiuyaoActivityPattern,
  analyzeLiuyaoHiddenSpiritConditions,
  analyzeLiuyaoLineStrength,
  analyzeLiuyaoMonthGuaShen,
  analyzeLiuyaoSanheFormations,
  analyzeLiuyaoSanxingFormations,
  getLiuyaoChangeDirection,
  getLiuyaoFanFuRelations,
  getLiuyaoTwelveStage,
  isLiuyaoElementInTomb,
} from '../liuyao-rules';
import type { LiuyaoChangeRelation, LiuyaoData, LiuyaoYaoDetail } from '../../types/divination';
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
} from '../../ganzhi';

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
  return getLiuyaoTwelveStage(wuxing, branch);
}

/** 判断爻之地支是否入墓（按地支五行入墓支） */
function isRuMu(branchWuxing: string, monthBranch: string): boolean {
  return isLiuyaoElementInTomb(branchWuxing, monthBranch);
}

/** 判断爻之地支是否在当月为月墓 */
function isYueMu(branch: string, monthBranch: string): boolean {
  const wuxing = BRANCH_WUXING[branch];
  return isRuMu(wuxing, monthBranch);
}

/** 判断爻之地支是否入日墓 */
function isRiMu(branch: string, dayBranch: string): boolean {
  const wuxing = BRANCH_WUXING[branch];
  return isLiuyaoElementInTomb(wuxing, dayBranch);
}

// 六合月日暗助检测（已在 yaosDetail 中通过 seasonState + isDayClash + isChanging 实现暗动判定）

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
  if (isLiuhe(originalBranch, changedBranch)) relations.push('化扶');
  if (changedIsVoid) relations.push('化空');
  return relations;
}

/** 判断爻支是否与日辰相冲；日冲还须按动静与旺衰再分暗动、日破。 */
function isDayClash(branch: string, dayBranch: string): boolean {
  return isLiuchong(branch, dayBranch);
}

/**
 * 判断是否为月破：爻的地支被月建地支冲克
 */
function isMonthBreak(branch: string, monthBranch: string): boolean {
  return isLiuchong(branch, monthBranch);
}

export type LiuyaoHexagramRelation = '六合卦' | '六冲卦';

export type LiuyaoPalaceStage =
  '首卦' | '一世' | '二世' | '三世' | '四世' | '五世' | '游魂' | '归魂';

const WHOLE_HEXAGRAM_PAIR_INDEXES: Array<[number, number]> = [
  [0, 3],
  [1, 4],
  [2, 5],
];

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

/**
 * 取得六爻浑天纳甲的六个天干。
 * 《卜筮正宗》《卜筮全书》纳甲装卦歌均以经卦区分内外：
 * 乾内甲外壬、坤内乙外癸，其余六卦内外同干。
 */
export function getLiuyaoNaJiaTiangan(hexagramName: string): string[] {
  const hexagram = getRequiredHexagramData(hexagramName);
  const lowerRule = trigramNaJiaTiangan[hexagram.lower];
  const upperRule = trigramNaJiaTiangan[hexagram.upper];
  if (!lowerRule || !upperRule) {
    throw new Error(`找不到卦象 "${hexagramName}" 的纳甲天干信息。`);
  }
  return [
    lowerRule.lower,
    lowerRule.lower,
    lowerRule.lower,
    upperRule.upper,
    upperRule.upper,
    upperRule.upper,
  ];
}

function getNaJiaBranches(hexagramName: string) {
  getRequiredHexagramData(hexagramName);
  const branches = hexagramNaJia[hexagramName];
  if (!branches || branches.length !== 6) {
    throw new Error(`找不到卦象 "${hexagramName}" 的完整纳甲信息。`);
  }
  return branches;
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
 * @returns 返回一个包含六个爻的天干、地支、五行、六亲信息的数组
 */
function getNaJiaAndLiuQin(mainHexagramName: string, palace: { name: string; wuxing: string }) {
  const yaosWithInfo: Array<{
    tiangan: string;
    dizhi: string;
    wuxing: string;
    liuqin: string;
  }> = [];
  const najiaDizhiArray = hexagramNaJia[mainHexagramName];
  const najiaTianganArray = getLiuyaoNaJiaTiangan(mainHexagramName);

  if (!najiaDizhiArray || najiaDizhiArray.length !== 6) {
    throw new Error(`找不到卦象 "${mainHexagramName}" 的纳甲信息。`);
  }

  for (let i = 0; i < 6; i++) {
    const dizhi = najiaDizhiArray[i];
    const tiangan = najiaTianganArray[i];
    if (!tiangan) {
      throw new Error(`找不到卦象 "${mainHexagramName}" 第${i + 1}爻的纳甲天干。`);
    }
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
    yaosWithInfo.push({ tiangan, dizhi, wuxing: yaoWuxing, liuqin });
  }
  return yaosWithInfo;
}

function buildHiddenSpirits(params: {
  originalName: string;
  palace: { name: string; wuxing: string };
  yaosDetail: LiuyaoYaoDetail[];
  voidBranches: string[];
  monthBranch: string;
  dayBranch: string;
}) {
  const { originalName, palace, yaosDetail, voidBranches, monthBranch, dayBranch } = params;
  const homeHexagramName = palaceHexagrams[palace.name as keyof typeof palaceHexagrams]?.[0];

  if (!homeHexagramName || homeHexagramName === originalName) {
    return [];
  }

  const appearedRelatives = new Set(yaosDetail.map((item) => item.sixRelative));
  const homeYaos = getNaJiaAndLiuQin(homeHexagramName, palace);

  const hiddenSpirits = homeYaos
    .map((homeYao, index) => ({
      sixRelative: homeYao.liuqin,
      position: index + 1,
      najiaTiangan: homeYao.tiangan,
      najiaDizhi: homeYao.dizhi,
      wuxing: homeYao.wuxing,
      isVoid: voidBranches.includes(homeYao.dizhi),
      underYao: {
        position: yaosDetail[index].position,
        sixRelative: yaosDetail[index].sixRelative,
        najiaTiangan: yaosDetail[index].najiaTiangan,
        najiaDizhi: yaosDetail[index].najiaDizhi,
        wuxing: yaosDetail[index].wuxing,
      },
    }))
    .filter((item) => !appearedRelatives.has(item.sixRelative));

  return hiddenSpirits.map((spirit) => ({
    ...spirit,
    conditionAnalysis: analyzeLiuyaoHiddenSpiritConditions(
      spirit,
      monthBranch,
      dayBranch,
      yaosDetail,
    ),
  }));
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

/**
 * 生成六爻卦盘
 *
 * 使用京房八宫法排盘。兼容 `time` 方法名，但该方法并非传统历数起卦，
 * 而是以当前或自定义时间戳固定随机种子，再按三钱概率生成六爻。
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
  /** 起卦方式；默认有 yaos 时为 manual，有 coinThrows 时为 coins，否则为 time。 */
  method?: LiuyaoGenerationMethod;
  /** 可选手工三钱法爻值，按初爻到上爻传入 6、7、8、9。 */
  yaos?: readonly number[];
  /** 调用方提供的逐爻三钱记录，按初爻到上爻传入；字面记 2，背面记 3。 */
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
    generation: {
      method,
      source: method === 'time' ? 'time-seeded-coin-simulation' : 'random-coin-simulation',
      coinThrows,
    },
    randomTrace: context.getTrace(),
  };
}

function resolveRawYaos(
  timestamp: number,
  options?: LiuyaoGenerationOptions,
): { yaos: number[]; generation: LiuyaoGeneration; randomTrace?: RandomTrace } {
  assertOptionalRecord(options, '六爻起卦设置');
  const method =
    options?.method ??
    (options?.yaos !== undefined ? 'manual' : options?.coinThrows !== undefined ? 'coins' : 'time');
  if (!['time', 'manual', 'coins'].includes(method)) {
    throw new Error(`未知的六爻起卦方式: ${method}`);
  }
  const usesRandomOptions = hasRandomOptions(options);
  if (method === 'time') {
    if (options?.yaos !== undefined) throw new Error('六爻时间种子模拟不能同时提供手工爻值。');
    if (options?.coinThrows !== undefined)
      throw new Error('六爻时间种子模拟不能同时提供三钱记录。');
    if (usesRandomOptions) throw new Error('六爻时间种子模拟不接受额外随机选项。');
    return generateCoinYaos('time', { seed: `时间起卦:${timestamp}` });
  }
  if (method === 'coins') {
    if (options?.yaos !== undefined) throw new Error('六爻模拟投掷不能同时提供手工爻值。');
    if (options?.coinThrows !== undefined) {
      if (usesRandomOptions) throw new Error('六爻三钱记录不能同时提供随机选项。');
      if (!Array.isArray(options.coinThrows)) {
        throw new Error('六爻三钱记录必须是数组。');
      }
      if (options.coinThrows.length !== 6) {
        throw new Error('六爻三钱记录必须恰好包含 6 爻。');
      }
      const coinThrows = options.coinThrows.map((item, index) => {
        if (item === null || typeof item !== 'object' || Array.isArray(item)) {
          throw new Error(`第${index + 1}爻三钱记录必须是对象。`);
        }
        if (
          !Array.isArray(item.coins) ||
          item.coins.length !== 3 ||
          !item.coins.every((coin: unknown) => coin === 2 || coin === 3)
        ) {
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
        generation: { method: 'coins', source: 'provided-coin-throws', coinThrows },
      };
    }
    return generateCoinYaos('coins', options ?? {});
  }
  if (options?.coinThrows !== undefined) throw new Error('六爻手工起卦不能同时提供三钱记录。');
  if (usesRandomOptions) throw new Error('六爻手工起卦不接受随机选项。');
  if (options?.yaos === undefined) throw new Error('六爻手工起卦必须提供六个爻值。');
  if (!Array.isArray(options.yaos)) {
    throw new Error('六爻手工爻值必须是数组。');
  }
  if (options.yaos.length !== 6) {
    throw new Error('六爻手工爻值必须恰好包含 6 爻。');
  }
  const yaos = [...options.yaos];
  if (!yaos.every((value) => Number.isInteger(value) && value >= 6 && value <= 9)) {
    throw new Error('六爻手工爻值只能是 6、7、8、9。');
  }
  return { yaos, generation: { method: 'manual', source: 'manual-yao-values' } };
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

  const activityPattern = analyzeLiuyaoActivityPattern(rawYaos, mainHexagram.name);
  const specialPattern =
    activityPattern.scriptureReference ??
    (activityPattern.kind === '多爻发动' ? undefined : activityPattern.kind);
  const specialAdvice = activityPattern.guidance;
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
  const baseYaosDetail: LiuyaoYaoDetail[] = yaosInfo.map((info, index) => {
    const isChanging = rawYaos[index] === 6 || rawYaos[index] === 9;
    const changedInfo = isChanging ? changedYaosInfo[index] : null;
    const isDayClashFlag = isDayClash(info.dizhi, dayBranch);
    const isMonthBreakFlag = isMonthBreak(info.dizhi, monthBranch);
    const changeDirection = changedInfo
      ? getLiuyaoChangeDirection(info.dizhi, changedInfo.dizhi)
      : null;

    // 月令旺衰：按月建定爻之五行的旺相休囚死。旺相为有力，休囚死为无力。
    const seasonState = getSeasonState(info.wuxing, monthBranch);
    // 《增删卜易·日辰章、暗动章》：旺相静爻日冲为暗动，休囚静爻日冲为日破。
    // 明动爻即使与日辰相冲，也只保留日冲事实，不冒充静爻日破。
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
      najiaTiangan: info.tiangan,
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
      isRuMu: isRuMu(info.wuxing, dayBranch) || isRuMu(info.wuxing, monthBranch),
      shiErGong: getShiErGong(info.wuxing, info.dizhi),
      isYueMu: isYueMu(info.dizhi, monthBranch),
      isRiMu: isRiMu(info.dizhi, dayBranch),
      changedYao: changedInfo
        ? {
            tiangan: changedInfo.tiangan,
            dizhi: changedInfo.dizhi,
            wuxing: changedInfo.wuxing,
            liuqin: changedInfo.liuqin,
            isVoid: voids.includes(changedInfo.dizhi),
          }
        : null,
    };
  });
  const yaosDetail: LiuyaoYaoDetail[] = baseYaosDetail.map((yao) => ({
    ...yao,
    strengthAnalysis: analyzeLiuyaoLineStrength(yao, monthBranch, dayBranch, baseYaosDetail),
  }));
  const hiddenSpirits = buildHiddenSpirits({
    originalName: mainHexagram.name,
    palace,
    yaosDetail,
    voidBranches: voids,
    monthBranch,
    dayBranch,
  });

  const sanheFormations = analyzeLiuyaoSanheFormations(yaosDetail, monthBranch, dayBranch);
  const dayFormation = sanheFormations.find((item) => item.pattern === '日辰补局');
  const monthFormation = sanheFormations.find((item) => item.pattern === '月建补局');
  const toTriggeredSanhe = (formation: typeof dayFormation) =>
    formation
      ? {
          group: formation.group,
          members: formation.members,
          description: formation.description,
          formationKey: formation.key,
          status: formation.status,
          participants: formation.participants,
          issues: formation.issues,
        }
      : null;
  const sanheWithDay = toTriggeredSanhe(dayFormation);
  const sanheWithMonth = toTriggeredSanhe(monthFormation);

  const sanxingInYaos = analyzeLiuyaoSanxingFormations(yaosDetail, monthBranch, dayBranch);

  const guaShen = analyzeLiuyaoMonthGuaShen(yaosDetail);

  const result: LiuyaoData = {
    originalName: mainHexagram.name,
    changedName: changedHexagram.name,
    interName: interHexagram.name,
    yaoArray: rawYaos,
    changingYaos: changingYaosResult,
    sixGods: animals,
    sixRelatives: yaosInfo.map((info) => info.liuqin),
    najiaTiangan: yaosInfo.map((info) => info.tiangan),
    najiaDizhi: yaosInfo.map((info) => info.dizhi),
    wuxing: yaosInfo.map((info) => info.wuxing),
    worldAndResponse: getWorldAndResponseArray(shiYing),
    voidBranches: voids,
    palace,
    palaceStage,
    ganzhi,
    activityPattern,
    specialPattern,
    specialAdvice,
    isChaotic: false,
    yaosDetail,
    hiddenSpirits,
    hexagramRelations,
    fanfuRelations,
    sanheWithDay,
    sanheWithMonth,
    sanheFormations,
    sanxingInYaos,
    guaShen,
    generation: resolvedGeneration.generation,
    timestamp,
  };
  const resultWithMeta = attachResultMeta(result, {
    algorithm: 'liuyao',
    input: {
      method: resolvedGeneration.generation.method,
      source: resolvedGeneration.generation.source,
      timestamp,
      yaos: resolvedGeneration.generation.method === 'manual' ? rawYaos : undefined,
      coinThrows:
        resolvedGeneration.generation.source === 'provided-coin-throws'
          ? resolvedGeneration.generation.coinThrows
          : undefined,
    },
    calculatedAt: timestamp,
    random: resolvedGeneration.randomTrace,
  });
  return { ...resultWithMeta, evidenceAnalysis: analyzeLiuyaoEvidence(resultWithMeta) };
}

export { buildHiddenSpirits };
export { analyzeLiuyaoEvidence, conditionLiuyaoTraditionalText } from '../liuyao-evidence';
export {
  analyzeLiuyaoActivityPattern,
  analyzeLiuyaoFanFuRelations,
  analyzeLiuyaoHiddenSpiritConditions,
  analyzeLiuyaoLineStrength,
  analyzeLiuyaoMonthGuaShen,
  analyzeLiuyaoSanheFormations,
  analyzeLiuyaoSanxingFormations,
  getLiuyaoChangeDirection,
  getLiuyaoFanFuRelations,
  getLiuyaoFlyingHiddenRelation,
  getLiuyaoGuaShenBranch,
  getLiuyaoTwelveStage,
  isLiuyaoElementInTomb,
} from '../liuyao-rules';
export type {
  LiuyaoFanFuKind,
  LiuyaoFanFuRelationItem,
  LiuyaoFanFuRelations,
  LiuyaoFanFuScope,
  LiuyaoLineStrengthAnalysis,
  LiuyaoMonthGuaShenAnalysis,
  LiuyaoMonthGuaShenMatch,
  LiuyaoMonthGuaShenStatus,
} from '../../types/divination';
export type {
  LiuyaoCounterEvidenceFact,
  LiuyaoCounterSummaryFact,
  LiuyaoEvidenceAnalysis,
  LiuyaoEvidenceOptions,
  LiuyaoEvidenceTopic,
  LiuyaoGodEffectStatus,
  LiuyaoGodInteractionAssessmentFact,
  LiuyaoGodInteractionBalanceStatus,
  LiuyaoGodInteractionFact,
  LiuyaoGodInteractionKind,
  LiuyaoGodInteractionPathStep,
  LiuyaoGodInteractionRelation,
  LiuyaoGodInteractionRole,
  LiuyaoGodReferenceActivity,
  LiuyaoGodReferenceEffectFact,
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
  LiuyaoUsefulGodMatchingTier,
  LiuyaoUsefulGodSelectionFact,
  LiuyaoYaoReference,
} from '../liuyao-evidence';
