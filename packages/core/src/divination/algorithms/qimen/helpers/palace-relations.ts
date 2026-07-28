/**
 * @file 单宫门星神关系分析
 * @description 分析一个宫位内八门、九星、八神之间的五行生克关系，
 * 判断宫位内部的和谐程度，为宫位能量解读提供基础。
 *
 * 古籍依据：
 *   - 《烟波钓叟歌》：「九星八门八神配五行，生克判吉凶」
 *   - 《奇门遁甲秘籍大全·门星神合参章》：「门为事体，星为事主，神为事机。
 *     三者相生则吉，比和则顺，相克则阻。」
 *   - 《遁甲演义》：「凡门星神三者比和，此宫为吉；三者相克，此宫大凶；
 *     凡生我者为恩，克我者为仇，我生者为泄，我克者为制。」
 *
 * 门星神三者的五行生克是判断宫位能量是否协调的核心：
 *   - 比和（同五行）：相互支持，和谐稳定
 *   - 相生（我生/生我）：有助力或宣泄，整体偏正
 *   - 相克（我克/克我）：有压制或反抗，有矛盾张力
 */

import { doorElements, starElements, isGenerating, isControlling } from './_constants';
import type { QimenJiuGongGe } from '../../../../types/divination';
import { WUXING } from '../../../../wuxing';

// ============================================================================
// 1. 八神五行映射
// ============================================================================

/**
 * 八神五行属性
 *
 * 古籍依据：
 *   - 《太白阴经》：「值符之气属土，其性厚重；螣蛇之气属火，其性虚幻；
 *     太阴之气属金，其性肃杀；六合之气属木，其性和合；
 *     白虎之气属金，其性凶悍；玄武之气属水，其性暗昧；
 *     九地之气属土，其性隐伏；九天之气属金，其性高远。」
 *   - 《奇门遁甲秘籍大全》：「八神各有本气，随五行转宫，吉凶各有所主。」
 */
const godElements: Record<string, string> = {
  值符: '土',
  螣蛇: '火',
  太阴: '金',
  六合: '木',
  白虎: '金',
  玄武: '水',
  九地: '土',
  九天: '金',
};

const WUXING_ELEMENTS = new Set<string>(WUXING);

function assertKnownElement(
  value: string,
  element: string | undefined,
  label: string,
): asserts element is string {
  if (!value || !element) {
    throw new Error(`${label} "${value}" 无法识别，不能计算门星神五行关系。`);
  }
  if (!WUXING_ELEMENTS.has(element)) {
    throw new Error(`${label} "${value}" 的五行 "${element}" 无法识别。`);
  }
}

// ============================================================================
// 2. 元素获取函数
// ============================================================================

/**
 * 获取八门的五行属性
 *
 * @param door 八门名称（如 "休门"、"生门"）
 * @returns 对应的五行（"水"、"火"、"木"、"金"、"土"）
 *
 * @example
 * ```ts
 * getDoorElement('休门'); // '水'
 * getDoorElement('景门'); // '火'
 * ```
 */
export function getDoorElement(door: string): string {
  const element = doorElements[door];
  assertKnownElement(door, element, '八门');
  return element;
}

/**
 * 获取九星的五行属性
 *
 * @param star 九星名称（如 "天蓬"、"天芮"）
 * @returns 对应的五行（"水"、"火"、"木"、"金"、"土"）
 *
 * @example
 * ```ts
 * getStarElement('天蓬'); // '水'
 * getStarElement('天英'); // '火'
 * ```
 */
export function getStarElement(star: string): string {
  const element = starElements[star];
  assertKnownElement(star, element, '九星');
  return element;
}

/**
 * 获取八神的五行属性
 *
 * @param god 八神名称（如 "值符"、"螣蛇"）
 * @returns 对应的五行（"水"、"火"、"木"、"金"、"土"）
 *
 * @example
 * ```ts
 * getGodElement('值符'); // '土'
 * getGodElement('螣蛇'); // '火'
 * getGodElement('太阴'); // '金'
 * ```
 */
export function getGodElement(god: string): string {
  const element = godElements[god];
  assertKnownElement(god, element, '八神');
  return element;
}

// ============================================================================
// 3. 关系判定类型
// ============================================================================

/** 单对关系结果 */
export interface PairRelation {
  /** 第一个元素名称（门/星/神） */
  first: string;
  /** 第二个元素名称（门/星/神） */
  second: string;
  /** 第一个元素的五行 */
  firstElement: string;
  /** 第二个元素的五行 */
  secondElement: string;
  /** 关系类型：比和（同五行）、相生、相克 */
  relation: '比和' | '相生' | '相克';
  /** 关系的中文描述 */
  description: string;
}

/** 宫位内所有关系的综合分析结果 */
export interface PalaceRelationsResult {
  /** 门与星的关系 */
  doorStar: PairRelation;
  /** 门与神的关系 */
  doorGod: PairRelation;
  /** 星与神的关系 */
  starGod: PairRelation;
  /** 整体和谐等级 */
  harmony: '和谐' | '有拉扯' | '冲突';
  /** 三组可复核关系的分类计数。 */
  relationCounts: { supporting: number; controlling: number };
  /** @deprecated 仅为兼容旧调用保留；解释与提示词不得展示为吉凶强度。 */
  score: number;
  /** 整体关系的中文描述 */
  description: string;
}

// ============================================================================
// 4. 五行生克关系判定
// ============================================================================

/**
 * 判断两个五行的生克关系
 *
 * @param elem1 第一个五行
 * @param elem2 第二个五行
 * @returns '比和' | '相生' | '相克'
 *
 * 比和：两五行相同，互相支持
 * 相生：一方生另一方（双向判断，无论谁生谁）
 * 相克：一方克另一方（双向判断，无论谁克谁）
 */
function getWuxingRelation(elem1: string, elem2: string): '比和' | '相生' | '相克' {
  if (!WUXING_ELEMENTS.has(elem1) || !WUXING_ELEMENTS.has(elem2)) {
    throw new Error(`五行 "${elem1}" 与 "${elem2}" 无法识别，不能计算生克关系。`);
  }
  if (elem1 === elem2) return '比和';
  if (isGenerating(elem1, elem2) || isGenerating(elem2, elem1)) return '相生';
  return '相克';
}

/**
 * 生成单对关系的中文描述
 *
 * @param name1 第一个元素名称
 * @param elem1 第一个元素五行
 * @param name2 第二个元素名称
 * @param elem2 第二个元素五行
 * @param relation 关系类型
 * @returns 描述文本
 */
function buildPairDescription(
  name1: string,
  elem1: string,
  name2: string,
  elem2: string,
  relation: '比和' | '相生' | '相克',
): string {
  switch (relation) {
    case '比和':
      return `${name1}（${elem1}）与 ${name2}（${elem2}）五行相同，比和相助，能量稳定。`;
    case '相生':
      if (isGenerating(elem1, elem2)) {
        return `${name1}（${elem1}）生 ${name2}（${elem2}），前者生助后者，能量流动顺畅。`;
      }
      return `${name2}（${elem2}）生 ${name1}（${elem1}），后者生助前者，有幕后支撑。`;
    case '相克':
      if (isControlling(elem1, elem2)) {
        return `${name1}（${elem1}）克 ${name2}（${elem2}），前者克制后者，存在压制关系。`;
      }
      return `${name2}（${elem2}）克 ${name1}（${elem1}），后者克制前者，有反制牵制。`;
  }
}

// ============================================================================
// 5. 宫位关系综合分析
// ============================================================================

/**
 * 分析单个宫位中门、星、神之间的两两五行关系
 *
 * 逐一计算门与星、门与神、星与神的五行生克，汇总得到宫位内部能量状态。
 * 门星神三者的和谐程度决定了该宫位行事是否顺畅：
 *   - 和谐：多数为相生或比和，能量协同，利于在该宫方位行事
 *   - 有拉扯：生克参半，有助力也有阻力，需要具体分析矛盾项
 *   - 冲突：多数为相克，矛盾突出，在该宫方位易生阻碍
 *
 * @param palace 宫位数据（须含 renPan.door、tianPan.star、shenPan.god）
 * @returns 包含三对关系详情、综合等级和评分的结果对象
 *
 * @example
 * ```ts
 * const result = analyzePalaceRelations(jiuGongGe[0]);
 * // {
 * //   doorStar: { first: '休门', second: '天蓬', firstElement: '水', secondElement: '水', relation: '比和', description: '...' },
 * //   harmony: '和谐',
 * //   score: 3,
 * //   description: '该宫门星神三者关系和谐，利于行事。'
 * // }
 * ```
 */
export function analyzePalaceRelations(
  palace: Pick<QimenJiuGongGe, 'renPan' | 'tianPan' | 'shenPan'>,
): PalaceRelationsResult {
  const door = palace.renPan.door;
  const star = palace.tianPan.star;
  const god = palace.shenPan.god;

  const doorElem = getDoorElement(door);
  const starElem = getStarElement(star);
  const godElem = getGodElement(god);

  // 分析三对关系
  const doorStarRel = getWuxingRelation(doorElem, starElem);
  const doorGodRel = getWuxingRelation(doorElem, godElem);
  const starGodRel = getWuxingRelation(starElem, godElem);

  // 构建配对详情
  const doorStar: PairRelation = {
    first: door,
    second: star,
    firstElement: doorElem,
    secondElement: starElem,
    relation: doorStarRel,
    description: buildPairDescription(door, doorElem, star, starElem, doorStarRel),
  };

  const doorGod: PairRelation = {
    first: door,
    second: god,
    firstElement: doorElem,
    secondElement: godElem,
    relation: doorGodRel,
    description: buildPairDescription(door, doorElem, god, godElem, doorGodRel),
  };

  const starGod: PairRelation = {
    first: star,
    second: god,
    firstElement: starElem,
    secondElement: godElem,
    relation: starGodRel,
    description: buildPairDescription(star, starElem, god, godElem, starGodRel),
  };

  // 仅用三组关系是否全部同向确定描述标签；score 只为旧调用兼容保留。
  const relations = [doorStarRel, doorGodRel, starGodRel];
  const relationCounts = {
    supporting: relations.filter((relation) => relation !== '相克').length,
    controlling: relations.filter((relation) => relation === '相克').length,
  };

  // 生助/比和与相克并见时保留两边事实，不用加减分阈值压成单一结论。
  let harmony: '和谐' | '有拉扯' | '冲突';
  if (relationCounts.controlling === 0) {
    harmony = '和谐';
  } else if (relationCounts.supporting === 0) {
    harmony = '冲突';
  } else {
    harmony = '有拉扯';
  }

  const score = relationCounts.supporting - relationCounts.controlling;

  // 构建综合描述
  const description = buildOverallDescription(
    door,
    star,
    god,
    doorElem,
    starElem,
    godElem,
    harmony,
    relations,
  );

  return { doorStar, doorGod, starGod, harmony, relationCounts, score, description };
}

/**
 * 构建宫位关系的综合描述文本
 */
function buildOverallDescription(
  door: string,
  star: string,
  god: string,
  doorElem: string,
  starElem: string,
  godElem: string,
  harmony: '和谐' | '有拉扯' | '冲突',
  relations: Array<'比和' | '相生' | '相克'>,
): string {
  const pairLabels = ['门星', '门神', '星神'];
  const relationText = relations.map((rel, i) => `${pairLabels[i]}${rel}`).join('，');

  switch (harmony) {
    case '和谐':
      return (
        `该宫门（${door}·${doorElem}）星（${star}·${starElem}）神（${god}·${godElem}）` +
        `关系中生助或比和占多数（${relationText}）。这只描述门星神五行结构，` +
        `是否适合推进仍须结合用神、格局、空亡及现实条件。`
      );
    case '冲突':
      return (
        `该宫门（${door}·${doorElem}）星（${star}·${starElem}）神（${god}·${godElem}）` +
        `关系中相克占多数（${relationText}）。这表示宫内牵制项较多，` +
        `不得脱离用神、格局和现实条件直接判为凶方。`
      );
    case '有拉扯':
      return (
        `该宫门（${door}·${doorElem}）星（${star}·${starElem}）神（${god}·${godElem}）` +
        `关系生克并见（${relationText}），支持与牵制须分别保留，` +
        `不能压缩成单一吉凶结论。`
      );
  }
}

// ============================================================================
// 6. 宫位和谐总分
// ============================================================================

/**
 * 获取宫位门星神三者的整体和谐评分
 *
 * 评分规则（-3 ~ +3，整数）：
 *   门-星：比和 +1 | 相生 +1 | 相克 -1
 *   门-神：比和 +1 | 相生 +1 | 相克 -1
 *   星-神：比和 +1 | 相生 +1 | 相克 -1
 *
 * 分值含义：
 *   +3 ~ +2：能量协同，吉顺
 *   +1 ~ -1：有拉扯，需具体分析
 *   -2 ~ -3：能量冲突，多阻碍
 *
 * @param palace 宫位数据（须含 renPan.door、tianPan.star、shenPan.god）
 * @returns 和谐评分，-3（最冲突）到 +3（最和谐）
 *
 * @example
 * ```ts
 * const score = getPalaceHarmony(jiuGongGe[1]); // 返回 -1, 2, 等
 * ```
 */
export function getPalaceHarmony(
  palace: Pick<QimenJiuGongGe, 'renPan' | 'tianPan' | 'shenPan'>,
): number {
  return analyzePalaceRelations(palace).score;
}
