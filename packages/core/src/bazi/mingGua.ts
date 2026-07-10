/**
 * @file 命卦（八宅）计算
 * @description 按传统八宅明镜法计算命卦，用于东四命/西四命判定。
 * @古籍依据 《八宅明镜》
 *
 * 法理：
 *   - 以立春为年界，立春前出生按上一年计算
 *   - 年数取九余数（年命数）
 *   - 男命：(11 - 余数) 归一到 1-9
 *   - 女命：(4 + 余数) 归一到 1-9
 *   - 逢五黄入中：男命寄坤二，女命寄艮八
 *   - 1坎 2坤 3震 4巽 6乾 7兑 8艮 9离（5为中央无卦）
 *   - 东四命：坎离震巽；西四命：乾坤艮兑
 */
import type { MingGuaProfile } from '../types/analysis';

const MING_GUA_TABLE: Record<
  number,
  { gua: string; star: string; element: string; group: '东四命' | '西四命' }
> = {
  1: { gua: '坎', star: '一白贪狼', element: '水', group: '东四命' },
  2: { gua: '坤', star: '二黑巨门', element: '土', group: '西四命' },
  3: { gua: '震', star: '三碧禄存', element: '木', group: '东四命' },
  4: { gua: '巽', star: '四绿文曲', element: '木', group: '东四命' },
  6: { gua: '乾', star: '六白武曲', element: '金', group: '西四命' },
  7: { gua: '兑', star: '七赤破军', element: '金', group: '西四命' },
  8: { gua: '艮', star: '八白左辅', element: '土', group: '西四命' },
  9: { gua: '离', star: '九紫右弼', element: '火', group: '东四命' },
};

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

/** 将命卦数归一到 1-9 范围 */
function normalizeMingGuaNumber(value: number): number {
  return positiveModulo(value - 1, 9) + 1;
}

/**
 * 计算命卦
 * @param birthYear 出生公历年份（已按立春换年处理）
 * @param gender 性别 'male' | 'female'
 * @returns 命卦信息
 */
export function calculateMingGua(birthYear: number, gender: string): MingGuaProfile {
  if (!Number.isSafeInteger(birthYear) || birthYear < 1 || birthYear > 9999) {
    throw new Error('出生年份必须是有效整数（1-9999）。');
  }
  if (gender !== 'male' && gender !== 'female') {
    throw new Error('性别必须是 male 或 female。');
  }
  const remainder = positiveModulo(birthYear, 9);
  const rawNumber =
    gender === 'male'
      ? normalizeMingGuaNumber(11 - remainder)
      : normalizeMingGuaNumber(4 + remainder);
  // 五黄入中无卦：男寄坤二，女寄艮八
  const number = rawNumber === 5 ? (gender === 'male' ? 2 : 8) : rawNumber;
  const config = MING_GUA_TABLE[number];
  if (!config) {
    throw new Error(`命卦数无法映射：${number}`);
  }

  return {
    number,
    gua: config.gua,
    star: config.star,
    element: config.element,
    eastWest: config.group,
  };
}
