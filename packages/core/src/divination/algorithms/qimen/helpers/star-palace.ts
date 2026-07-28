/**
 * @file 九星旺衰落宫评估（《烟波钓叟歌》九星落宫章）
 * @description 评估九星在九宫格中各宫位的旺相休囚死状态。
 *
 * 九星各有本宫（原始宫位），落宫不同则旺衰有别：
 * - 本宫：星归原位 → 旺（力量最强）
 * - 比和：星与宫同五行（非本宫） → 相（同气得助）
 * - 旺地（同气）：宫生星 → 相（得生助）
 * - 生地（受生）：星生宫 → 休（泄气耗力）
 * - 囚地（受耗）：星克宫 → 囚（耗力受困）
 * - 受克（受制）：宫克星 → 死（受制最弱）
 *
 * 古籍依据：
 *   - 《烟波钓叟歌》：「九星各有本宫，旺相休囚死，落宫不同力量不同」
 *   - 《奇门遁甲秘籍大全》：「九星飞宫，各以其五行与本宫五行参看旺衰」
 *
 * 九星原宫（宫位 1-9）：
 *   坎 1 → 天蓬, 坤 2 → 天芮, 震 3 → 天冲, 巽 4 → 天辅,
 *   中 5 → 天禽（寄坤 2）, 乾 6 → 天心, 兑 7 → 天柱,
 *   艮 8 → 天任, 离 9 → 天英
 *
 * 九星五行：
 *   天蓬水, 天芮土, 天冲木, 天辅木, 天禽土,
 *   天心金, 天柱金, 天任土, 天英火
 */

import { starElements } from './_constants';
import { isGenerating, isControlling } from './_constants';
import { WUXING } from '../../../../wuxing';
import { getTianPanStars, hasTianPanStar } from './palace-utils';

const WUXING_ELEMENTS = new Set<string>(WUXING);

// ============================================================================
// 1. 九星原宫映射
// ============================================================================

/**
 * 九星 → 原宫（本宫）映射表
 *
 * 《烟波钓叟歌》载九星各有所属之宫：
 *   天蓬星在坎一，天芮星在坤二，天冲星在震三，天辅星在巽四，
 *   天禽星在中五（寄坤二），天心星在乾六，天柱星在兑七，
 *   天任星在艮八，天英星在离九。
 *
 * 星归本宫则旺，落他宫则衰。
 */
export const STAR_ORIGINAL_PALACES: Record<string, number> = {
  天蓬: 1,
  天芮: 2,
  天冲: 3,
  天辅: 4,
  天禽: 5,
  天心: 6,
  天柱: 7,
  天任: 8,
  天英: 9,
};

// ============================================================================
// 2. 类型定义
// ============================================================================

/** 九星旺衰五态 */
export type StarState = '旺' | '相' | '休' | '囚' | '死';

/**
 * 九星宫位评估结果
 */
export interface StarPalaceResult {
  /** 星名，如 "天蓬" */
  star: string;
  /** 原宫序号（1-9） */
  originalPalace: number;
  /** 当前落宫序号（1-9） */
  gong: number;
  /** 旺衰状态 */
  state: StarState;
  /**
   * 评分：
   *   旺 = 3  （本宫，最强）
   *   相 = 2  （得生助或同气）
   *   休 = 0  （泄气，能量输出）
   *   囚 = -1 （克宫耗力）
   *   死 = -2 （受制最弱）
   */
  score: number;
  /** 详细描述 */
  detail: string;
  /** 值符星特殊判断（仅值符星有此字段） */
  specialJudgement?: string;
}

/** evaluateStarPalaces 输入参数 */
export interface StarPalaceInput {
  /** 九宫格数据，每宫须含 gong、element、tianPan.star */
  jiuGongGe: Array<{
    gong: number;
    element: string;
    tianPan: { star: string; companionStar?: string };
  }>;
}

/** getZhiFuStarJudgement 输入参数 */
export interface ZhiFuJudgementInput extends StarPalaceInput {
  /** 值符星名（如 "天蓬"） */
  zhiFu: string;
}

// ============================================================================
// 3. 核心函数：evaluateSingleStar
// ============================================================================

/**
 * 评估单个九星在宫位中的旺衰状态
 *
 * 判断逻辑（按优先级）：
 *   1. 本宫（同宫）           → 旺（score: 3）
 *   2. 比和（同五行，非本宫）   → 相（score: 2）
 *   3. 宫生星（旺地）          → 相（score: 2）
 *   4. 星生宫（生地）          → 休（score: 0）
 *   5. 星克宫（囚地）          → 囚（score: -1）
 *   6. 宫克星（受克）          → 死（score: -2）
 *
 * 比和（五行相同）在传统奇门中属同气得助，故归为"相"。
 * 本宫则固有"旺"，不受五行规则约束。
 *
 * @param star            星名（如 "天蓬"）
 * @param currentGong     当前落宫序号（1-9）
 * @param palaceElement   宫位五行（木/火/土/金/水）
 * @returns 评估结果
 */
export function evaluateSingleStar(
  star: string,
  currentGong: number,
  palaceElement: string,
): StarPalaceResult {
  const starWuxing = starElements[star];
  const originalPalace = STAR_ORIGINAL_PALACES[star];

  if (!starWuxing) {
    throw new Error(`九星 "${star}" 无法识别，不能评估旺衰。`);
  }
  if (!originalPalace) {
    throw new Error(`九星 "${star}" 缺少本宫映射，不能评估旺衰。`);
  }
  if (!Number.isInteger(currentGong) || currentGong < 1 || currentGong > 9) {
    throw new Error(`宫位 "${currentGong}" 无效，必须是 1-9 的整数。`);
  }
  if (!WUXING_ELEMENTS.has(palaceElement)) {
    throw new Error(`宫位五行 "${palaceElement}" 无法识别，不能评估九星旺衰。`);
  }

  let state: StarState;
  let score: number;

  // 1. 本宫 → 旺
  if (currentGong === originalPalace) {
    state = '旺';
    score = 3;
  }
  // 2. 比和：星与宫同五行（非本宫）→ 相
  else if (starWuxing === palaceElement) {
    state = '相';
    score = 2;
  }
  // 3. 宫生星 → 相
  else if (isGenerating(palaceElement, starWuxing)) {
    state = '相';
    score = 2;
  }
  // 4. 星生宫 → 休
  else if (isGenerating(starWuxing, palaceElement)) {
    state = '休';
    score = 0;
  }
  // 5. 星克宫 → 囚
  else if (isControlling(starWuxing, palaceElement)) {
    state = '囚';
    score = -1;
  }
  // 6. 宫克星 → 死（五行循环的剩余组合只有此情况）
  else {
    state = '死';
    score = -2;
  }

  const detail = `${star}落${currentGong}宫（${state}）`;
  return { star, originalPalace, gong: currentGong, state, score, detail };
}

// ============================================================================
// 4. evaluateStarPalaces：整盘九星旺衰评估
// ============================================================================

/**
 * 评估整盘中所有九星的旺衰状态
 *
 * 遍历九宫格中每个有星的宫位，计算各星的旺相休囚死状态。
 * 中五宫如果有星也会参与评估。
 *
 * @param result - 含 jiuGongGe 的输入对象
 * @param result.jiuGongGe - 九宫格数据，每宫含 gong、element、tianPan.star
 * @returns 每颗星的旺衰评估结果数组
 *
 * @example
 * ```ts
 * const starResults = evaluateStarPalaces({ jiuGongGe: qimenResult.jiuGongGe });
 * // 结果示例：
 * // [
 * //   { star: '天蓬', originalPalace: 1, gong: 6, state: '相', score: 2, detail: '天蓬落6宫（相）' },
 * //   { star: '天芮', originalPalace: 2, gong: 2, state: '旺', score: 3, detail: '天芮落2宫（旺）' },
 * // ]
 * ```
 */
export function evaluateStarPalaces(result: StarPalaceInput): StarPalaceResult[] {
  const results: StarPalaceResult[] = [];

  for (const palace of result.jiuGongGe) {
    for (const star of getTianPanStars(palace)) {
      results.push(evaluateSingleStar(star, palace.gong, palace.element));
    }
  }

  if (results.length !== 9) {
    throw new Error(`整盘应有九星，实际读取到 ${results.length} 星。`);
  }

  return results;
}

// ============================================================================
// 5. getZhiFuStarJudgement：值符星特殊判断
// ============================================================================

/**
 * 值符星的特殊旺衰判断
 *
 * 值符星为九星之首，统摄全局。其旺衰状态对整体局势有放大效应：
 *   - 旺/相 → 吉事加倍，凶事有救（加持）
 *   - 休     → 值符能量中性，按常理断
 *   - 囚     → 值符受困，吉事减力，凶事易发
 *   - 死     → 值符失位，大势不利，宜守不宜攻
 *
 * 先计算值符星在其落宫的标准旺衰状态，再附加特殊解读。
 *
 * @param result - 含 jiuGongGe 和 zhiFu 的输入对象
 * @param result.jiuGongGe - 九宫格数据
 * @param result.zhiFu - 值符星名（如 "天蓬"）
 * @returns 值符星的评估结果，含 specialJudgement 字段；
 *          若找不到值符星落宫则返回 null
 *
 * @example
 * ```ts
 * const judgement = getZhiFuStarJudgement({
 *   jiuGongGe: qimenResult.jiuGongGe,
 *   zhiFu: qimenResult.zhiFu,
 * });
 * // => { star: '天蓬', gong: 6, state: '相', score: 2, specialJudgement: '值符得助，吉事加持' }
 * ```
 */
export function getZhiFuStarJudgement(result: ZhiFuJudgementInput): StarPalaceResult | null {
  const { jiuGongGe, zhiFu } = result;

  if (!zhiFu) {
    throw new Error('值符星不能为空。');
  }
  if (!STAR_ORIGINAL_PALACES[zhiFu]) {
    throw new Error(`值符星 "${zhiFu}" 无法识别。`);
  }

  // 找到值符星的落宫
  const palace = jiuGongGe.find((g) => hasTianPanStar(g, zhiFu));
  if (!palace) {
    throw new Error(`找不到值符星 "${zhiFu}" 的落宫。`);
  }

  // 计算标准旺衰
  const baseResult = evaluateSingleStar(zhiFu, palace.gong, palace.element);

  // 附加特殊解读
  let specialJudgement: string;
  switch (baseResult.state) {
    case '旺':
      specialJudgement = '值符归位，势在我方，百事可为';
      break;
    case '相':
      specialJudgement = '值符得助，吉事加持，凶中有救';
      break;
    case '休':
      specialJudgement = '值符泄气，宜守不宜攻，待时而动';
      break;
    case '囚':
      specialJudgement = '值符受困，事倍功半，谨防反复';
      break;
    case '死':
      specialJudgement = '值符失位，大势不利，隐忍为上';
      break;
    default:
      specialJudgement = '值符状态不明，审慎行事';
  }

  return { ...baseResult, specialJudgement };
}
