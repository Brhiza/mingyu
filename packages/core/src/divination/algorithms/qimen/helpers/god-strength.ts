/**
 * 八神旺衰评估（《奇门遁甲秘籍大全》神煞落宫章）
 *
 * 八神各有五行，落宫后有旺衰之分：
 * - 比和（神与宫同五行）→ 强
 * - 神克宫 → 强
 * - 宫生神 → 中
 * - 神生宫 → 弱
 * - 宫克神 → 弱
 * - 空亡会使强降为中，中降为弱
 */

import { isGenerating, isControlling, diPanPalaces } from './_constants';
import { WUXING } from '../../../../wuxing';

/** 八神五行 */
export const GOD_WUXING: Record<string, string> = {
  值符: '土',
  螣蛇: '火',
  太阴: '金',
  六合: '木',
  白虎: '金',
  玄武: '水',
  九地: '土',
  九天: '金',
};

export type GodStrength = '强' | '中' | '弱';

export interface GodStrengthResult {
  god: string;
  palace: number;
  gong: number;
  strength: GodStrength;
}

/**
 * 评估单个八神在宫位中的旺衰
 */
export function evaluateSingleGodStrength(
  god: string,
  gong: number,
  palaceElement: string,
  isVoid?: boolean,
): GodStrengthResult {
  if (!Number.isInteger(gong) || gong < 1 || gong > 9 || gong === 5) {
    throw new Error(`宫位 "${gong}" 无效，八神落宫必须是 1-9 之间的外宫。`);
  }
  if (!(WUXING as readonly string[]).includes(palaceElement)) {
    throw new Error(`宫位五行 "${palaceElement}" 无法识别，不能评估八神旺衰。`);
  }
  const godElement = GOD_WUXING[god];
  if (!godElement) {
    throw new Error(`八神 "${god}" 无法识别，不能评估旺衰。`);
  }

  let base: GodStrength = '中';

  // 比和：神与宫同五行
  if (godElement === palaceElement) {
    base = '强';
  }
  // 神克宫
  else if (isControlling(godElement, palaceElement)) {
    base = '强';
  }
  // 宫生神
  else if (isGenerating(palaceElement, godElement)) {
    base = '中';
  }
  // 神生宫
  else if (isGenerating(godElement, palaceElement)) {
    base = '弱';
  }
  // 宫克神
  else if (isControlling(palaceElement, godElement)) {
    base = '弱';
  }

  // 空亡降低一级：强→中，中→弱，弱不变
  if (isVoid) {
    if (base === '强') {
      base = '中';
    } else if (base === '中') {
      base = '弱';
    }
  }

  return { god, palace: gong, gong, strength: base };
}

/**
 * 评估整盘中所有八神的旺衰
 *
 * @param jiuGongGe - 九宫格数组，每项须含 gong、element、shenPan.god
 * @param voidBranches - 空亡地支数组（如 ['寅', '卯']），用于判断宫位是否逢空
 * @returns 每个有神宫位的旺衰评估结果
 */
export function evaluateGodPalaceStrength(
  jiuGongGe: Array<{
    gong: number;
    name: string;
    element: string;
    shenPan: { god: string };
  }>,
  voidBranches?: string[],
): GodStrengthResult[] {
  const results: GodStrengthResult[] = [];

  for (const palace of jiuGongGe) {
    if (!palace.shenPan.god) continue;
    if (palace.gong === 5) continue; // 中五宫无神

    const isVoid = voidBranches
      ? voidBranches.some((vb) => diPanPalaces[vb] === palace.gong)
      : false;

    results.push(
      evaluateSingleGodStrength(palace.shenPan.god, palace.gong, palace.element, isVoid),
    );
  }

  return results;
}
