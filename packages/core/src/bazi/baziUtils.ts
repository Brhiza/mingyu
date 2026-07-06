/**
 * @file Bazi Utils
 * @description Contains stateless utility functions for Bazi calculations.
 */

import { BASIC_MAPPINGS, HIDDEN_STEMS, SEASON_STATUS, shenShaTypes } from './baziDefinitions';
import type { Pillars, Wuxing } from './baziTypes';

const ctg = BASIC_MAPPINGS.HEAVENLY_STEMS as readonly string[];
const cdz = BASIC_MAPPINGS.EARTHLY_BRANCHES as readonly string[];
const wxtg = BASIC_MAPPINGS.STEM_WUXING as Wuxing[];
const wxdz = BASIC_MAPPINGS.BRANCH_WUXING as Wuxing[];

export function isHeavenlyStem(value: string): boolean {
  return ctg.includes(value);
}

export function isEarthlyBranch(value: string): boolean {
  return cdz.includes(value);
}

export function isGanZhiPair(gan: string, zhi: string): boolean {
  return (
    isHeavenlyStem(gan) &&
    isEarthlyBranch(zhi) &&
    BASIC_MAPPINGS.SIXTY_CYCLE.includes(`${gan}${zhi}`)
  );
}

export function assertHeavenlyStem(value: string, label = '天干'): void {
  if (!isHeavenlyStem(value)) {
    throw new Error(`${label}无效：${value}`);
  }
}

export function assertEarthlyBranch(value: string, label = '地支'): void {
  if (!isEarthlyBranch(value)) {
    throw new Error(`${label}无效：${value}`);
  }
}

export function assertGanZhiPair(gan: string, zhi: string, label = '干支'): void {
  assertHeavenlyStem(gan, `${label}天干`);
  assertEarthlyBranch(zhi, `${label}地支`);

  if (!isGanZhiPair(gan, zhi)) {
    throw new Error(`${label}不是有效六十甲子：${gan}${zhi}`);
  }
}

export function assertGanZhiName(ganZhi: string, label = '干支'): void {
  if (typeof ganZhi !== 'string' || ganZhi.length !== 2) {
    throw new Error(`${label}格式无效：${ganZhi}`);
  }

  assertGanZhiPair(ganZhi[0], ganZhi[1], label);
}

export function assertBaziGender(gender: string): asserts gender is 'male' | 'female' {
  if (gender !== 'male' && gender !== 'female') {
    throw new Error(`性别无效：${gender}`);
  }
}

export function assertPillars(pillars: Pillars): void {
  const keys = ['year', 'month', 'day', 'hour'] as const;

  for (const key of keys) {
    const pillar = pillars[key];
    if (!pillar) {
      throw new Error(`四柱缺少${key}`);
    }

    assertGanZhiPair(pillar.gan, pillar.zhi, `${key}柱`);

    if (pillar.ganZhi && pillar.ganZhi !== `${pillar.gan}${pillar.zhi}`) {
      throw new Error(`${key}柱干支不一致：${pillar.ganZhi}`);
    }
  }
}

/**
 * 获取天干或地支的五行
 */
export function getWuxing(ganOrZhi: string): Wuxing | '未知' {
  const stemIndex = ctg.indexOf(ganOrZhi);
  if (stemIndex !== -1) return wxtg[stemIndex];
  const branchIndex = cdz.indexOf(ganOrZhi);
  if (branchIndex !== -1) return wxdz[branchIndex];
  return '未知';
}

/**
 * 获取天干阴阳
 */
export function getGanYinYang(gan: string): string {
  const stemIndex = ctg.indexOf(gan);
  if (stemIndex === -1) return '未知';
  return BASIC_MAPPINGS.STEM_YINYANG[stemIndex];
}

/**
 * 获取两个天干之间的十神关系
 */
export function getTenGod(gan: string, dayMaster: string): string {
  const ganIndex = ctg.indexOf(gan);
  const dayMasterIndex = ctg.indexOf(dayMaster);
  if (ganIndex === -1 || dayMasterIndex === -1) return '未知';
  const tenGodMatrix = [
    ['比肩', '劫财', '食神', '伤官', '偏财', '正财', '七杀', '正官', '偏印', '正印'],
    ['劫财', '比肩', '伤官', '食神', '正财', '偏财', '正官', '七杀', '正印', '偏印'],
    ['偏印', '正印', '比肩', '劫财', '食神', '伤官', '偏财', '正财', '七杀', '正官'],
    ['正印', '偏印', '劫财', '比肩', '伤官', '食神', '正财', '偏财', '正官', '七杀'],
    ['七杀', '正官', '偏印', '正印', '比肩', '劫财', '食神', '伤官', '偏财', '正财'],
    ['正官', '七杀', '正印', '偏印', '劫财', '比肩', '伤官', '食神', '正财', '偏财'],
    ['偏财', '正财', '七杀', '正官', '偏印', '正印', '比肩', '劫财', '食神', '伤官'],
    ['正财', '偏财', '正官', '七杀', '正印', '偏印', '劫财', '比肩', '伤官', '食神'],
    ['食神', '伤官', '偏财', '正财', '七杀', '正官', '偏印', '正印', '比肩', '劫财'],
    ['伤官', '食神', '正财', '偏财', '正官', '七杀', '正印', '偏印', '劫财', '比肩'],
  ];
  return tenGodMatrix[dayMasterIndex][ganIndex];
}

/**
 * 获取地支对应的十神（取藏干主气）
 */
export function getTenGodForBranch(zhi: string, dayMaster: string): string {
  const mainHiddenStem = HIDDEN_STEMS[zhi]?.[0];
  if (mainHiddenStem) {
    return getTenGod(mainHiddenStem, dayMaster);
  }
  return '未知';
}

/**
 * 获取月支对应的五行旺衰状态
 * @param monthBranch 月支
 * @returns 一个包含各五行状态的对象
 */
export function getSeasonStatus(monthBranch: string): Record<string, string> {
  return SEASON_STATUS[monthBranch] || {};
}
/**
 * 获取神煞属性 (吉/凶/中性)
 * @param shensha 神煞名称
 * @returns 属性名称
 */
export const getShenShaType = (shensha: string): '吉' | '凶' | '中性' => {
  if (shenShaTypes.lucky.includes(shensha)) {
    return '吉';
  } else if (shenShaTypes.unlucky.includes(shensha)) {
    return '凶';
  } else {
    return '中性';
  }
};
