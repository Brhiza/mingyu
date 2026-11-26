import { mountains, mountainTrigram } from '../compass';
import {
  detectXuankongCombinations,
  type Formation,
  type PalaceKey,
  type XuankongPalaceResult,
} from './combinations';

const PALACE_DEFS: ReadonlyArray<{
  key: PalaceKey;
  name: string;
  direction: string;
  earth: number;
  row: 0 | 1 | 2;
  col: 0 | 1 | 2;
}> = [
  { key: 'xun', name: '巽', direction: '东南', earth: 4, row: 0, col: 0 },
  { key: 'li', name: '离', direction: '南', earth: 9, row: 0, col: 1 },
  { key: 'kun', name: '坤', direction: '西南', earth: 2, row: 0, col: 2 },
  { key: 'zhen', name: '震', direction: '东', earth: 3, row: 1, col: 0 },
  { key: 'center', name: '中', direction: '中', earth: 5, row: 1, col: 1 },
  { key: 'dui', name: '兑', direction: '西', earth: 7, row: 1, col: 2 },
  { key: 'gen', name: '艮', direction: '东北', earth: 8, row: 2, col: 0 },
  { key: 'kan', name: '坎', direction: '北', earth: 1, row: 2, col: 1 },
  { key: 'qian', name: '乾', direction: '西北', earth: 6, row: 2, col: 2 },
];

const home: Record<number, readonly [string, string, string]> = {
  1: ['壬', '子', '癸'], 2: ['未', '坤', '申'], 3: ['甲', '卯', '乙'], 4: ['辰', '巽', '巳'],
  6: ['戌', '乾', '亥'], 7: ['庚', '酉', '辛'], 8: ['丑', '艮', '寅'], 9: ['丙', '午', '丁'],
};
const substituteGroups: ReadonlyArray<readonly [string, number]> = [
  ['子癸甲申', 1], ['壬卯乙未坤', 2], ['乾亥辰巽巳戌', 6], ['酉辛丑艮丙', 7], ['寅午庚丁', 9],
];
const trigramGong: Record<string, number> = { 坎: 1, 坤: 2, 震: 3, 巽: 4, 乾: 6, 兑: 7, 艮: 8, 离: 9 };
const forwardMountains = '壬甲丙庚艮寅巽巳坤申乾亥';
type Direction = '顺飞' | '逆飞';

/** 按洛书宫序飞布，数组索引 0–8 分别对应一至九宫。 */
export function flyStars(center: number, direction: Direction) {
  if (!Number.isInteger(center) || center < 1 || center > 9 || !['顺飞', '逆飞'].includes(direction)) {
    throw new Error('飞星须提供 1 至 9 的入中星与明确顺逆。');
  }
  const result = Array<number>(9);
  const order = [5, 6, 7, 8, 9, 1, 2, 3, 4];
  order.forEach((gong, index) => {
    result[gong - 1] = ((center - 1 + (direction === '顺飞' ? index : -index) + 18) % 9) + 1;
  });
  return result;
}

/** 按 1864 年一运的二十年周期；交运首年只给年份时保留交界双候选标记。 */
export function resolvePeriod(year: number) {
  if (!Number.isInteger(year) || year < 1800 || year > 2200) {
    throw new Error('建造或起运年份须在 1800 至 2200 之间。');
  }
  const elapsed = Math.floor((year - 1864) / 20);
  const yun = ((elapsed % 9) + 9) % 9 + 1;
  const startYear = 1864 + elapsed * 20;
  return {
    year,
    yun,
    yuan: yun <= 3 ? '上元' as const : yun <= 6 ? '中元' as const : '下元' as const,
    startYear,
    endYear: startYear + 19,
    boundaryUncertain: year === startYear,
  };
}

function resolveMountainLeg(mountain: string, originalCenterStar: number) {
  const index = mountains.indexOf(mountain);
  if (index < 0) throw new Error('坐向须为二十四山。');
  const yuan = (index + 1) % 3;
  const referenceMountain = originalCenterStar === 5 ? mountain : home[originalCenterStar]?.[yuan];
  if (!referenceMountain) throw new Error('无法确定飞星参考山。');
  const direction: Direction = forwardMountains.includes(referenceMountain) ? '顺飞' : '逆飞';
  return { yuan, referenceMountain, direction };
}

function replacementLeg(mountain: string, originalCenterStar: number) {
  const { referenceMountain, direction } = resolveMountainLeg(mountain, originalCenterStar);
  const replacementStar = originalCenterStar === 5
    ? 5
    : substituteGroups.find(([group]) => group.includes(referenceMountain))?.[1];
  if (!replacementStar) throw new Error('无法确定替星。');
  return { originalCenterStar, referenceMountain, replacementStar, direction };
}

function classify(yun: number, sit: number, facing: number, shan: number[], xiang: number[]) {
  if (shan[sit - 1] === yun && xiang[facing - 1] === yun) return '旺山旺向';
  if (shan[facing - 1] === yun && xiang[sit - 1] === yun) return '上山下水';
  if (shan[facing - 1] === yun && xiang[facing - 1] === yun) return '双星到向';
  if (shan[sit - 1] === yun && xiang[sit - 1] === yun) return '双星到坐';
  return '替卦未成四正局';
}

/** 按已确定的坐山计算下卦或替卦；替卦的兼向核定由上层完成。 */
export function calculateXuanKongPlate(year: number, sitMountain: string, mode: '下卦' | '替卦') {
  const period = resolvePeriod(year);
  const index = mountains.indexOf(sitMountain);
  if (index < 0 || !['下卦', '替卦'].includes(mode)) throw new Error('须提供有效二十四坐山及起法。');
  const facingMountain = mountains[(index + 12) % 24];
  const sitGong = trigramGong[mountainTrigram(sitMountain)];
  const facingGong = trigramGong[mountainTrigram(facingMountain)];
  const yun = flyStars(period.yun, '顺飞');
  const initialShan = flyStars(yun[sitGong - 1], resolveMountainLeg(sitMountain, yun[sitGong - 1]).direction);
  const initialXiang = flyStars(yun[facingGong - 1], resolveMountainLeg(facingMountain, yun[facingGong - 1]).direction);

  const replacement = mode === '替卦'
    ? {
        mountain: replacementLeg(sitMountain, yun[sitGong - 1]),
        facing: replacementLeg(facingMountain, yun[facingGong - 1]),
      }
    : undefined;
  const shan = replacement
    ? flyStars(replacement.mountain.replacementStar, replacement.mountain.direction)
    : initialShan;
  const xiang = replacement
    ? flyStars(replacement.facing.replacementStar, replacement.facing.direction)
    : initialXiang;

  const replacementApplied = Boolean(
    replacement && (
      replacement.mountain.originalCenterStar !== replacement.mountain.replacementStar ||
      replacement.facing.originalCenterStar !== replacement.facing.replacementStar
    ),
  );
  const plateFormation = classify(period.yun, sitGong, facingGong, shan, xiang);
  const nonSubstitutable = (period.yun === 4 && '甲庚'.includes(sitMountain)) || (period.yun === 8 && '丑未'.includes(sitMountain));
  const formation = replacement && plateFormation === '旺山旺向' && !replacementApplied && nonSubstitutable
    ? '替卦到山到向未成旺局'
    : plateFormation;

  const palaceGrid: XuankongPalaceResult[] = PALACE_DEFS.map((def) => ({
    ...def,
    period: yun[def.earth - 1],
    mountain: shan[def.earth - 1],
    water: xiang[def.earth - 1],
  }));
  const palaces = [...palaceGrid].sort((a, b) => a.earth - b.earth);
  const facingPalace = PALACE_DEFS.find((def) => def.earth === facingGong)!.key;
  const combinations = detectXuankongCombinations(
    period.yun,
    formation as Formation,
    facingPalace,
    replacement ? palaces : palaceGrid,
  );

  return {
    period,
    sitMountain,
    facingMountain,
    mode,
    plates: { yun, shan, xiang },
    formation,
    replacement,
    replacementApplied,
    palaces,
    combinations,
    arrival: {
      shanToMountain: shan[sitGong - 1] === period.yun,
      xiangToFacing: xiang[facingGong - 1] === period.yun,
    },
    limitation: '替卦须由调用方核定兼向；山向盘与格局为传统计算结果，不包含形峦或现实结果。',
  };
}
