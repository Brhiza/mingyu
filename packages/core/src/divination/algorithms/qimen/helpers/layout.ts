/**
 * @file 奇门遁甲九宫排盘算法
 * @description 实现时家奇门转盘法与飞盘法的完整九宫格排盘，包含地盘、天盘、人盘、神盘四层。
 *
 * ─── 古籍依据 ───
 *
 * 《烟波钓叟歌》：
 *   "先观九宫分八卦，次详六甲与三奇。
 *    直符直使从中起，顺逆推算莫差迟。"
 *
 * 《奇门遁甲秘籍大全》卷三"排盘诀"：
 *   第一步 布地盘三奇六仪 —— "阳遁顺布六仪，逆布三奇；阴遁逆布六仪，顺布三奇"
 *   第二步 定值符值使落宫 —— "旬首所值之星为值符，所值之门为值使"
 *   第三步 排天盘九星 —— "星随符转，各归其所"（《遁甲演义》）
 *   第四步 排人盘八门 —— "门随地转，宫中无门不入"
 *   第五步 排神盘八神 —— "八神随遁顺逆，中宫无神位"（《遁甲演义》）
 *
 * 《易纬·乾凿度》：
 *   太一九宫体系 —— "戴九履一，左三右七，二四为肩，六八为足，五居中央"
 *   洛书轨迹 —— "一居坎、八居艮、三居震、四居巽、九居离、二居坤、七居兑、六居乾"
 *
 * 流派说明：
 *   转盘法（zhuanpan）为时家奇门主流，天盘九星整体旋转、人盘八门沿洛书轨迹旋转。
 *   飞盘法（feipan）按洛书飞宫路径布九星，作为可选争议口径提供。
 */

import { jiazi, qimen, tiangan } from '../../../../divination/divination-data';
import { getDunJiaStem } from './palace-utils';
import type { QimenJiuGongGe } from '../../../../types/divination';

// ─── 数据源 ───

const { palaceStars, palaceDoors, yangGods, yinGods, ninePositions } = qimen;

const sanQiLiuYi = ['戊', '己', '庚', '辛', '壬', '癸', '丁', '丙', '乙'];
const luoShuDoorPath = [1, 8, 3, 4, 9, 2, 7, 6];
const feipanStarOrder = ['天蓬', '天任', '天冲', '天辅', '天英', '天芮', '天柱', '天心', '天禽'];
const feipanStarPath = [1, 8, 3, 4, 5, 9, 2, 7, 6];
const starHomePalace: Record<string, number> = {
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

// ─── 类型定义 ───

/**
 * 奇门排盘方法
 * - 'zhuanpan': 转盘法（默认），天盘九星、人盘八门整体旋转，神盘八神飞布
 * - 'feipan': 飞盘法，天盘九星按洛书轨迹飞布，人盘八门仍随值使旋转
 */
export type QimenMethod = 'zhuanpan' | 'feipan';

function advanceNinePalace(startPalace: number, steps: number, isYangDun: boolean): number {
  if (!Number.isInteger(startPalace) || startPalace < 1 || startPalace > 9) {
    throw new Error(`无效九宫编号 "${startPalace}"。`);
  }
  const offset = isYangDun ? steps : -steps;
  return ((startPalace - 1 + offset + 90) % 9) + 1;
}

function normalizeNoDoorPalace(palace: number): number {
  return palace === 5 ? 2 : palace;
}

function getGanZhiStepInXun(ganZhi: string): number {
  if (!jiazi.includes(ganZhi)) {
    throw new Error(`无法识别干支 "${ganZhi}" 的旬内步数。`);
  }

  const ganIndex = tiangan.indexOf(ganZhi.charAt(0));
  if (ganIndex === -1) {
    throw new Error(`无法识别干支 "${ganZhi}" 的天干。`);
  }

  return ganIndex;
}

function getStarHomeStem(
  star: string,
  jiuGong: QimenJiuGongGe[],
  centerJiGongStem: string,
): string {
  const homePalace = starHomePalace[star];
  if (!homePalace) {
    throw new Error(`找不到九星 "${star}" 的本宫。`);
  }

  if (star === '天禽' && centerJiGongStem) {
    return centerJiGongStem;
  }

  if (homePalace === 5 && !jiuGong[4].diPan.stem) {
    return jiuGong[1].diPan.stem;
  }

  return jiuGong[homePalace - 1].diPan.stem;
}

export function resolveZhiShiLandingPalace(
  isYangDun: boolean,
  zhiShi: string,
  ganZhi: string,
): number {
  const zhiShiDoorIndex = palaceDoors.indexOf(zhiShi);
  if (zhiShiDoorIndex === -1) {
    throw new Error(`找不到值使门 "${zhiShi}"，请检查八门数据。`);
  }

  const startPalace = luoShuDoorPath[zhiShiDoorIndex];
  const steps = getGanZhiStepInXun(ganZhi);
  return normalizeNoDoorPalace(advanceNinePalace(startPalace, steps, isYangDun));
}

// ─── 排盘主函数 ───

/**
 * 排九宫格（转盘法）
 *
 * 按照《奇门遁甲秘籍大全》卷三"排盘诀"所述五大步骤，生成完整的九宫格数据。
 * 每宫包含：宫位信息、地盘干、天盘星与干、人盘门、神盘神。
 *
 * @param isYangDun  是否为阳遁
 * @param juShu      局数（1-9）
 * @param zhiFu      值符星名（如 "天蓬"）
 * @param zhiShi     值使门名（如 "休门"）
 * @param ganzhi     时辰干支，如 { hour: "甲子" }
 * @param method     排盘方法，默认 'zhuanpan'（转盘法）
 *
 * @returns 包含九宫完整排盘数据的数组，每宫含 tianPan / diPan / renPan / shenPan 四盘
 *
 * @throws 当找不到时干落宫或时支对应的地盘宫位时
 *
 * @example
 * ```ts
 * const jiuGong = arrangeJiuGongGe(true, 3, '天冲', '伤门', { hour: '乙丑' });
 * console.log(jiuGong[0]); // { gong: 1, name: '坎一宫', tianPan: {...}, ... }
 * ```
 */
export function arrangeJiuGongGe(
  isYangDun: boolean,
  juShu: number,
  zhiFu: string,
  zhiShi: string,
  ganzhi: { hour: string },
  method: QimenMethod = 'zhuanpan',
): QimenJiuGongGe[] {
  // ──────────────────────────────────────────────
  // 第一步：初始化九宫
  // ──────────────────────────────────────────────
  // 创建 9 个宫位，四盘（天/地/人/神）全部重置为空
  const jiuGong: QimenJiuGongGe[] = Array.from({ length: 9 }, (_, i) => ({
    gong: i + 1,
    name: ninePositions[i].name,
    direction: ninePositions[i].direction,
    element: ninePositions[i].element,
    tianPan: { star: '', stem: '' },
    diPan: { stem: '' },
    renPan: { door: '' },
    shenPan: { god: '' },
  }));

  // ──────────────────────────────────────────────
  // 第二步：布地盘三奇六仪（DiPan）
  // ──────────────────────────────────────────────
  //
  // 法理（《烟波钓叟歌》）：
  //   "六甲元号六仪名，三奇即是乙丙丁。
  //    阳遁顺仪奇逆布，阴遁逆仪奇顺行。"
  //
  // 固定顺序：戊 → 己 → 庚 → 辛 → 壬 → 癸 → 丁 → 丙 → 乙
  // 阳遁：从局数宫位起，顺九宫序布列
  // 阴遁：从局数宫位起，逆九宫序布列
  // 戊土居中五宫，中五无专位，寄于坤二宫。
  let centerJiGongStem = ''; // 中五宫戊土寄宫记录

  for (let i = 0; i < 9; i++) {
    const palaceNum = isYangDun ? ((juShu + i - 1 + 9) % 9) + 1 : ((juShu - i - 1 + 9) % 9) + 1;
    jiuGong[palaceNum - 1].diPan.stem = sanQiLiuYi[i];
  }

  // 戊土寄宫：中五宫戊土寄于坤二宫
  // 中五宫有戊土时，将戊土寄至坤二，中五宫地盘不再布干
  if (jiuGong[4].diPan.stem === '戊') {
    centerJiGongStem = '戊';
    jiuGong[4].diPan.stem = '';
  }

  // ──────────────────────────────────────────────
  // 第三步：定值符与值使的落宫
  // ──────────────────────────────────────────────
  //
  // 法理（《烟波钓叟歌》）：
  //   "直符直使各有时，时干直符时支使。"
  //
  // 值符星追时干：找到时干的遁干在地盘中的落宫，值符星即落此宫。
  // 值使门按当前干支在本旬中的步数顺逆行宫，中五无门时寄坤二。
  const hourGanForFind = getDunJiaStem(ganzhi.hour); // 遁干（甲遁于六仪之下）

  // ── 3a. 定值符落宫 ──
  let zhiFuLandingPalace = -1;

  for (let i = 0; i < 9; i++) {
    if (jiuGong[i].diPan.stem === hourGanForFind) {
      zhiFuLandingPalace = i + 1;
      break;
    }
  }

  // 若时干遁干为戊且戊寄于坤二宫，则在坤二宫查找
  if (zhiFuLandingPalace === -1) {
    if (centerJiGongStem && hourGanForFind === centerJiGongStem) {
      zhiFuLandingPalace = 2; // 坤二宫
    }
  }

  // 兜底：仍然找不到则报错
  if (zhiFuLandingPalace === -1) {
    throw new Error(
      `找不到时干 "${ganzhi.hour}" 遁干 "${hourGanForFind}" 在地盘的落宫，请检查地盘排布逻辑。`,
    );
  }

  // ── 3b. 定值使落宫 ──
  const zhiShiLandingPalace = resolveZhiShiLandingPalace(isYangDun, zhiShi, ganzhi.hour);

  // ──────────────────────────────────────────────
  // 第四步：排天盘九星与天干（TianPan）
  // ──────────────────────────────────────────────
  //
  // 法理（《遁甲演义》）：
  //   "星随符转，各归其所。"
  //
  // 值符星（大值符）为九星之首，从值符落宫开始排布。
  // 阳遁顺九宫序（宫号递增）排布，阴遁逆九宫序排布。
  // 天盘干 = 该星在地盘"老家"之天干，即"星带干飞"。
  // 天禽星的中五宫原位无干时，取坤二宫的地盘干。
  //
  // 星的位置映射（老家）：
  //   天蓬→坎一、天芮→坤二、天冲→震三、天辅→巽四、
  //   天禽→中五、天心→乾六、天柱→兑七、天任→艮八、天英→离九

  if (method === 'zhuanpan') {
    // ── 转盘法：九星整体旋转 ──
    // 值符星为"把手"，从值符落宫开始，按九宫序（阳顺阴逆）放置九星，
    // 星序保持原固定位顺序（天蓬→天芮→天冲→...→天英）。
    const zhiFuStarIndex = palaceStars.indexOf(zhiFu);
    if (zhiFuStarIndex === -1) {
      throw new Error(`找不到值符星 "${zhiFu}"，请检查九星数据。`);
    }

    for (let i = 0; i < 9; i++) {
      // 目标宫位：从值符落宫开始，阳遁顺排（+i），阴遁逆排（-i）
      const palaceIndex = (zhiFuLandingPalace - 1 + (isYangDun ? i : -i) + 9) % 9;

      // 星索引：从值符星开始，始终按星序递增（阳阴都是正序取星）
      const starIndex = (zhiFuStarIndex + i + 9) % 9;
      const star = palaceStars[starIndex];
      jiuGong[palaceIndex].tianPan.star = star;

      jiuGong[palaceIndex].tianPan.stem = getStarHomeStem(star, jiuGong, centerJiGongStem);
    }
  } else {
    // ── 飞盘法：九星按洛书飞宫路径飞布，包含天禽中五 ──
    const zhiFuStarIndex = feipanStarOrder.indexOf(zhiFu);
    if (zhiFuStarIndex === -1) {
      throw new Error(`找不到值符星 "${zhiFu}"，请检查飞盘九星数据。`);
    }

    const zhiFuFeipanPathIndex = feipanStarPath.indexOf(zhiFuLandingPalace);
    if (zhiFuFeipanPathIndex === -1) {
      throw new Error(`值符落宫 "${zhiFuLandingPalace}" 不在飞盘九宫路径中。`);
    }

    for (let i = 0; i < 9; i++) {
      const starIndex = (zhiFuStarIndex + i + 9) % 9;
      const pathIndex = (zhiFuFeipanPathIndex + (isYangDun ? i : -i) + 9) % 9;
      const palaceNum = feipanStarPath[pathIndex];
      const star = feipanStarOrder[starIndex];
      jiuGong[palaceNum - 1].tianPan.star = star;
      jiuGong[palaceNum - 1].tianPan.stem = getStarHomeStem(star, jiuGong, centerJiGongStem);
    }
  }

  // ──────────────────────────────────────────────
  // 第五步：排人盘八门（RenPan）
  // ──────────────────────────────────────────────
  //
  // 法理（《烟波钓叟歌》）：
  //   "直使常随时支转，八门逐位配宫行。"
  //
  // 值使门为八门之主，从值使落宫开始，按洛书轨迹排布八门。
  // 洛书轨迹：1(坎) → 8(艮) → 3(震) → 4(巽) → 9(离) → 2(坤) → 7(兑) → 6(乾)
  // 阳遁顺转（沿洛书轨迹正向），阴遁逆转（沿洛书轨迹反向）。
  // 中五宫无门位，八门只布于八宫。
  //
  // 门序（对应洛书轨迹）：休门→生门→伤门→杜门→景门→死门→惊门→开门
  const zhiShiDoorIndex = palaceDoors.indexOf(zhiShi);
  const zhiShiLuoShuIndex = luoShuDoorPath.indexOf(zhiShiLandingPalace);

  if (zhiShiDoorIndex === -1) {
    throw new Error(`找不到值使门 "${zhiShi}"，请检查八门数据。`);
  }

  if (zhiShiLuoShuIndex === -1) {
    throw new Error(`值使落宫 "${zhiShiLandingPalace}" 不在洛书轨迹八宫中。`);
  }

  for (let i = 0; i < 8; i++) {
    // 目标宫位的洛书索引：从值使落宫开始，阳顺阴逆沿洛书轨迹
    const targetLuoShuIndex = (zhiShiLuoShuIndex + (isYangDun ? i : -i) + 8) % 8;
    const targetPalace = luoShuDoorPath[targetLuoShuIndex];

    // 门索引：从值使门开始，始终按门序正序递增
    const doorIndex = (zhiShiDoorIndex + i + 8) % 8;
    jiuGong[targetPalace - 1].renPan.door = palaceDoors[doorIndex];
  }

  // ──────────────────────────────────────────────
  // 第六步：排神盘八神（ShenPan）
  // ──────────────────────────────────────────────
  //
  // 法理（《遁甲演义》）：
  //   "八神随遁顺逆，中宫无神位。"
  //
  // 八神之首"值符神"（小值符）永远追随天盘值符星（大值符）。
  // 值符神落于天盘值符星所在之宫，其余七神依次排布。
  // 阳遁顺排（沿九宫序顺时针），阴遁逆排（沿九宫序逆时针）。
  // 中五宫不排神，值符落中五时借坤二宫起布。
  //
  // 阳遁七神顺序：螣蛇 → 太阴 → 六合 → 白虎 → 玄武 → 九地 → 九天
  // 阴遁七神顺序：九天 → 九地 → 玄武 → 白虎 → 六合 → 太阴 → 螣蛇
  // 八神之首"值符"固定在前端，随遁变迁
  const gods = isYangDun ? yangGods : yinGods;

  // 收集排神宫的宫位（跳过中五宫，共 8 宫）
  const shenPanPalaces: number[] = [];
  for (let offset = 0; shenPanPalaces.length < 8; offset++) {
    const palaceNum = ((zhiFuLandingPalace - 1 + (isYangDun ? offset : -offset) + 18) % 9) + 1;
    if (palaceNum === 5) {
      // 中五宫无神位，跳过
      continue;
    }
    shenPanPalaces.push(palaceNum);
  }

  // 值符神数组依次放入排神宫位
  for (let i = 0; i < 8; i++) {
    const palaceNum = shenPanPalaces[i];
    jiuGong[palaceNum - 1].shenPan.god = gods[i];
  }

  // ──────────────────────────────────────────────
  // 返回九宫格完整数据
  // ──────────────────────────────────────────────
  return jiuGong;
}
