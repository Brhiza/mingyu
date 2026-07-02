/**
 * @file 方位指引（《奇门遁甲秘籍大全》方位章）
 * @description 通过门、星、神、干五位一体综合评估九宫吉凶，提供行动方位建议。
 *
 * 古籍依据：
 *   - 《奇门遁甲秘籍大全》：「生门求财，开门求官，休门休养，值符见贵」
 *   - 《烟波钓叟歌》：「八门若遇开休生，诸事逢之总称情」
 *   - 《遁甲演义》：「三奇得使最为良，玉女守门喜非常」
 *
 * 评分体系（分数为正即吉，负即凶，绝对值越大影响越强）：
 *   门分：开/生/休=+3，景=+1，杜=0，死/惊=-2，伤=-1
 *   神分：值符/太阴/六合/九天=+2，九地=+1，螣蛇=-1，白虎=-2，玄武=-2
 *   星分：天心/天辅=+2，天禽/天任=+1，天冲/天英=0，天蓬/天芮/天柱=-1
 *   三奇合吉门加分：天盘乙/丙/丁同宫开/休/生=+2
 *   空亡扣分：-3
 *   格局调整：每个吉格+2，每个凶格-2
 */

import {
  auspiciousDoors,
  difficultDoors,
  supportiveGods,
  difficultGods,
  sanQiStems,
  diPanPalaces,
} from './_constants';

// ============================================================================
// 类型定义
// ============================================================================

/** 单个宫位评分输入 */
export interface PalaceScoreInput {
  gong: number;
  name: string;
  direction: string;
  element: string;
  tianPan: { stem: string; star: string };
  diPan: { stem: string };
  renPan: { door: string };
  shenPan: { god: string };
}

/** 方位建议条目 */
export interface DirectionAdvice {
  gong: number;
  name: string;
  direction: string;
  score: number;
  use: string;
  reasons: string[];
}

// ============================================================================
// 评分常量表
// ============================================================================

/** 门评分（《奇门遁甲秘籍大全》八门吉凶章） */
const DOOR_SCORES: Record<string, number> = {
  休门: 3,
  生门: 3,
  开门: 3,
  景门: 1,
  杜门: 0,
  伤门: -1,
  死门: -2,
  惊门: -2,
};

/** 神评分（《奇门遁甲秘籍大全》八神吉凶章） */
const GOD_SCORES: Record<string, number> = {
  值符: 2,
  太阴: 2,
  六合: 2,
  九天: 2,
  九地: 1,
  螣蛇: -1,
  白虎: -2,
  玄武: -2,
};

/** 星评分（《奇门遁甲秘籍大全》九星吉凶章） */
const STAR_SCORES: Record<string, number> = {
  天心: 2,
  天辅: 2,
  天禽: 1,
  天任: 1,
  天冲: 0,
  天英: 0,
  天蓬: -1,
  天芮: -1,
  天柱: -1,
};

function hasSanQiWithAuspiciousDoor(
  palace: Pick<PalaceScoreInput, 'tianPan' | 'renPan'>,
): boolean {
  return sanQiStems.includes(palace.tianPan.stem) && auspiciousDoors.includes(palace.renPan.door);
}

// ============================================================================
// getPalaceScore
// ============================================================================

/**
 * 计算单个宫位的综合得分
 *
 * 评分维度（按古籍《奇门遁甲秘籍大全》）：
 *   1. 门分：吉门加分，凶门减分。开/生/休为三吉门各+3，景门+1，杜门中平0，
 *      死/惊各-2，伤门-1。
 *   2. 神分：值符/太阴/六合/九天四吉神各+2，九地+1，螣蛇-1，白虎/玄武各-2。
 *   3. 星分：天心/天辅各+2，天禽/天任各+1，天冲/天英中平0，天蓬/天芮/天柱各-1。
 *   4. 三奇合吉门加分：天盘干为乙/丙/丁（日/月/星三奇），且同宫开/休/生三吉门 +2。
 *   5. 空亡扣分：宫位逢空亡-3（能量虚浮，不宜行动）。
 *   6. 经典格局调整：每个吉格（如九遁、三奇得使）+2，每个凶格（如门迫、击刑）-2。
 *
 * @param palace             - 宫位数据
 * @param isVoid             - 宫位是否空亡（默认 false）
 * @param patternAdjustment  - 经典格局净调整值（正数=加分，负数=扣分，默认 0）
 * @returns 综合得分（正数越吉，负数越凶）
 */
export function getPalaceScore(
  palace: PalaceScoreInput,
  isVoid: boolean = false,
  patternAdjustment: number = 0,
): number {
  let score = 0;

  // 1. 门分
  if (palace.renPan.door && DOOR_SCORES[palace.renPan.door] !== undefined) {
    score += DOOR_SCORES[palace.renPan.door];
  }

  // 2. 神分
  if (palace.shenPan.god && GOD_SCORES[palace.shenPan.god] !== undefined) {
    score += GOD_SCORES[palace.shenPan.god];
  }

  // 3. 星分
  if (palace.tianPan.star && STAR_SCORES[palace.tianPan.star] !== undefined) {
    score += STAR_SCORES[palace.tianPan.star];
  }

  // 4. 三奇合吉门加分。古籍以「奇门会合」为用，单见天盘三奇不单独加分。
  if (hasSanQiWithAuspiciousDoor(palace)) {
    score += 2;
  }

  // 5. 空亡扣分
  if (isVoid) {
    score -= 3;
  }

  // 6. 经典格局调整
  if (patternAdjustment !== 0) {
    score += patternAdjustment;
  }

  return score;
}

// ============================================================================
// 方向使用字典
// ============================================================================

/**
 * 根据八门和值符确定宫位推荐用途
 *
 * 古籍核心对应（《奇门遁甲秘籍大全》方位章）：
 *   生门 → 求财方位
 *   开门 → 求官/事业方位
 *   值符 → 见贵人方位
 *   休门 → 休养安宁方位
 */
function getDirectionUse(door: string, god: string): string {
  // 值符见贵不受门限制
  if (god === '值符') return '见贵人方位';
  switch (door) {
    case '开门':
      return '求官/事业/求职';
    case '生门':
      return '求财/合作/投资';
    case '休门':
      return '休养/安宁/关系';
    case '景门':
      return '文书/考试/宣传';
    default:
      return '综合吉利方位';
  }
}

// ============================================================================
// buildDirectionAdvice
// ============================================================================

/**
 * 生成方位建议
 *
 * 评估所有非中五宫位，按得分排序返回正分 top 3 吉方和 1 个避方。
 * 若全盘方位均为非正分，则不强行输出吉方。
 * 每个方位条目包含宫位名、方向、评分、推荐用途和判断原因。
 *
 * @param jiuGongGe       - 九宫格数据
 * @param voidBranches    - 空亡地支数组（如 ['寅', '卯']），用于判定宫位是否逢空
 * @param classicPatterns - 经典格局列表（用于格局调整评分），每项需含 score 和 palace/palaces
 * @returns 吉方与避方建议
 */
export function buildDirectionAdvice(
  jiuGongGe: PalaceScoreInput[],
  voidBranches?: string[],
  classicPatterns?: Array<{
    name: string;
    score: number;
    palace?: number;
    palaces?: number[];
  }>,
): { goodDirections: DirectionAdvice[]; avoidDirections: DirectionAdvice[] } {
  // ── 1. 确定空亡宫位集合 ──
  const voidGongs = new Set<number>();
  if (voidBranches) {
    for (const vb of voidBranches) {
      const g = diPanPalaces[vb];
      if (g) voidGongs.add(g);
    }
  }

  // ── 2. 计算每个宫位的经典格局净调整值 ──
  // 每有一个吉格（score>0）该宫 +2，每有一个凶格（score<0）该宫 -2
  const patternAdjustmentMap = new Map<number, number>();
  if (classicPatterns) {
    for (const pat of classicPatterns) {
      if (pat.score === 0) continue; // 中性格局不影响评分
      const affectedPalaces = pat.palaces ?? (pat.palace ? [pat.palace] : []);
      const delta = pat.score > 0 ? 2 : -2;
      for (const g of affectedPalaces) {
        patternAdjustmentMap.set(g, (patternAdjustmentMap.get(g) ?? 0) + delta);
      }
    }
  }

  // ── 3. 逐宫评分 ──
  const scored = jiuGongGe
    .filter((p) => p.gong !== 5) // 中五宫无方向，不参与评分
    .map((palace) => {
      const isVoid = voidGongs.has(palace.gong);
      const patAdj = patternAdjustmentMap.get(palace.gong) ?? 0;
      const score = getPalaceScore(palace, isVoid, patAdj);
      return { ...palace, score };
    })
    .sort((a, b) => b.score - a.score); // 降序：最高分在前

  // ── 4. 吉方：仅取正分 top 3 ──
  const goodDirections: DirectionAdvice[] = scored
    .filter((p) => p.score > 0)
    .slice(0, 3)
    .map((p) => {
      const reasons: string[] = [];

      if (auspiciousDoors.includes(p.renPan.door)) {
        reasons.push(p.renPan.door);
      }
      if (supportiveGods.includes(p.shenPan.god)) {
        reasons.push(`值${p.shenPan.god}`);
      }
      if (hasSanQiWithAuspiciousDoor(p)) {
        reasons.push(`${p.tianPan.stem}奇合${p.renPan.door}`);
      }
      if (p.tianPan.star && STAR_SCORES[p.tianPan.star] >= 2) {
        reasons.push(`${p.tianPan.star}到宫`);
      }

      return {
        gong: p.gong,
        name: p.name,
        direction: p.direction,
        score: p.score,
        use: getDirectionUse(p.renPan.door, p.shenPan.god),
        reasons,
      };
    });

  // ── 5. 避方：取得分最低的 1 个（排除已推吉方） ──
  const goodGongs = new Set(goodDirections.map((g) => g.gong));
  const avoidDirections: DirectionAdvice[] = scored
    .filter((p) => !goodGongs.has(p.gong))
    .slice(-1) // 降序排列中最后一个即最低分
    .map((p) => {
      const reasons: string[] = [];

      if (difficultDoors.includes(p.renPan.door)) {
        reasons.push(p.renPan.door);
      }
      if (difficultGods.includes(p.shenPan.god)) {
        reasons.push(p.shenPan.god);
      }
      if (voidGongs.has(p.gong)) {
        reasons.push('空亡');
      }
      if (reasons.length === 0) {
        reasons.push('综合评分偏低');
      }

      return {
        gong: p.gong,
        name: p.name,
        direction: p.direction,
        score: p.score,
        use: '宜避之方',
        reasons,
      };
    });

  return { goodDirections, avoidDirections };
}
