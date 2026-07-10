/**
 * @file 方位 / 罗盘模块（地基层）
 * @description 八卦方位、二十四山、坐向→宅卦、八宅大游年（四吉四凶方）。
 * 供八宅风水、奇门方位应期、玄空等系统复用。设计为可继续拓展。
 */

import { NineStar, Zone } from 'tyme4ts';

/** 八卦（后天方位） */
export const BAGUA: string[] = ['坎', '艮', '震', '巽', '离', '坤', '兑', '乾'];

/** 八卦方位（后天八卦） */
export const BAGUA_DIRECTION: Record<string, string> = {
  坎: '北',
  艮: '东北',
  震: '东',
  巽: '东南',
  离: '南',
  坤: '西南',
  兑: '西',
  乾: '西北',
};

/** 八卦中心度数（罗盘，正北为 0°，顺时针） */
export const BAGUA_DEGREE: Record<string, number> = {
  坎: 0,
  艮: 45,
  震: 90,
  巽: 135,
  离: 180,
  坤: 225,
  兑: 270,
  乾: 315,
};

/** 二十四山（罗盘顺序，自正北子山起顺时针） */
export const TWENTY_FOUR_MOUNTAINS: string[] = [
  '子',
  '癸',
  '丑',
  '艮',
  '寅',
  '甲',
  '卯',
  '乙',
  '辰',
  '巽',
  '巳',
  '丙',
  '午',
  '丁',
  '未',
  '坤',
  '申',
  '庚',
  '酉',
  '辛',
  '戌',
  '乾',
  '亥',
  '壬',
];

/**
 * tyme4ts 的 `Zone` 表示二十八宿四象（东、北、西、南），并不包含二十四山。
 * 这里公开权威名称供星宿/方位模块复用；二十四山仍保留罗盘专用表，避免错误替换。
 */
export const FOUR_ZONES: string[] = Zone.NAMES.map((name: string) => Zone.fromName(name).getName());

export interface NineStarProfile {
  number: string;
  color: string;
  element: string;
  dipper: string;
  direction: string;
  name: string;
}

/** 九星资料（委托 tyme4ts） */
export function getNineStarProfile(index: number): NineStarProfile {
  const star = NineStar.fromIndex(index);
  return {
    number: star.getName(),
    color: star.getColor(),
    element: star.getElement().getName(),
    dipper: star.getDipper().getName(),
    direction: star.getDirection().getName(),
    name: star.toString(),
  };
}

export const NINE_STARS: NineStarProfile[] = Array.from({ length: 9 }, (_, index) =>
  getNineStarProfile(index),
);

/** 二十四山所属八卦 */
export const MOUNTAIN_TO_BAGUA: Record<string, string> = {
  子: '坎',
  癸: '坎',
  丑: '艮',
  艮: '艮',
  寅: '艮',
  甲: '震',
  卯: '震',
  乙: '震',
  辰: '巽',
  巽: '巽',
  巳: '巽',
  丙: '离',
  午: '离',
  丁: '离',
  未: '坤',
  坤: '坤',
  申: '坤',
  庚: '兑',
  酉: '兑',
  辛: '兑',
  戌: '乾',
  乾: '乾',
  亥: '乾',
  壬: '坎',
};

/** 由坐山（二十四山）取宅卦 */
export function getHouseTrigram(mountain: string): string {
  const gua = MOUNTAIN_TO_BAGUA[mountain];
  if (!gua) throw new Error(`坐山无效：${mountain}`);
  return gua;
}

/** 由坐向（如「子山午向」）取宅卦 */
export function getHouseTrigramFromSitFacing(sitMountain: string): string {
  return getHouseTrigram(sitMountain);
}

/** 八宅大游年吉凶标签 */
export type BaZhaiLabel = '伏位' | '生气' | '延年' | '天医' | '绝命' | '五鬼' | '六煞' | '祸害';

const LUCKY_LABELS: BaZhaiLabel[] = ['伏位', '生气', '延年', '天医'];

function isLucky(label: BaZhaiLabel): boolean {
  return LUCKY_LABELS.includes(label);
}

/** 八宅大游年表：基准卦 → 八宫（坎艮震巽离坤兑乾顺序）的吉凶标签 */
const BA_ZHAI_TABLE: Record<string, BaZhaiLabel[]> = {
  乾: ['祸害', '天医', '五鬼', '六煞', '绝命', '延年', '生气', '伏位'],
  坎: ['伏位', '五鬼', '天医', '生气', '延年', '绝命', '祸害', '六煞'],
  艮: ['五鬼', '伏位', '祸害', '绝命', '六煞', '生气', '延年', '天医'],
  震: ['天医', '五鬼', '伏位', '延年', '生气', '祸害', '绝命', '六煞'],
  巽: ['生气', '六煞', '延年', '伏位', '天医', '五鬼', '祸害', '绝命'],
  离: ['延年', '绝命', '生气', '天医', '伏位', '祸害', '五鬼', '六煞'],
  坤: ['绝命', '生气', '六煞', '祸害', '天医', '伏位', '五鬼', '延年'],
  兑: ['六煞', '延年', '绝命', '天医', '祸害', '五鬼', '伏位', '生气'],
};

export interface BaZhaiPalace {
  gua: string;
  direction: string;
  degree: number;
  label: BaZhaiLabel;
  luck: '吉' | '凶';
}

/**
 * 八宅大游年盘
 * @param baseGua 基准卦（可为命卦或宅卦）
 * @returns 八个方位的吉凶
 */
export function getBaZhaiPalace(baseGua: string): BaZhaiPalace[] {
  const row = BA_ZHAI_TABLE[baseGua];
  if (!row) throw new Error(`基准卦无效（需为八卦之一）：${baseGua}`);
  return BAGUA.map((gua, i) => ({
    gua,
    direction: BAGUA_DIRECTION[gua],
    degree: BAGUA_DEGREE[gua],
    label: row[i],
    luck: isLucky(row[i]) ? '吉' : '凶',
  }));
}

/** 命卦所属东四/西四 */
export function getEastWestGroup(gua: string): '东四命' | '西四命' {
  return ['坎', '离', '震', '巽'].includes(gua) ? '东四命' : '西四命';
}

export interface EightMansionResult {
  mingGua: string;
  group: '东四命' | '西四命';
  lucky: BaZhaiPalace[];
  unlucky: BaZhaiPalace[];
  summary: string;
}

/** 命卦 → 八宅四吉四凶方 */
export function getEightMansion(mingGua: string): EightMansionResult {
  const palace = getBaZhaiPalace(mingGua);
  const lucky = palace.filter((p) => p.luck === '吉');
  const unlucky = palace.filter((p) => p.luck === '凶');
  const group = getEastWestGroup(mingGua);
  return {
    mingGua,
    group,
    lucky,
    unlucky,
    summary: `命卦${mingGua}属${group}；四吉方：${lucky
      .map((p) => `${p.direction}(${p.label})`)
      .join('、')}；四凶方：${unlucky.map((p) => `${p.direction}(${p.label})`).join('、')}。`,
  };
}

export const direction = {
  BAGUA,
  BAGUA_DIRECTION,
  BAGUA_DEGREE,
  TWENTY_FOUR_MOUNTAINS,
  FOUR_ZONES,
  NINE_STARS,
  MOUNTAIN_TO_BAGUA,
  getNineStarProfile,
  getHouseTrigram,
  getHouseTrigramFromSitFacing,
  getBaZhaiPalace,
  getEastWestGroup,
  getEightMansion,
};
