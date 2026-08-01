/**
 * @file 奇门可复算位置与五行标签
 * @description 只记录能由当前九宫直接复算的位置、五行和固定落宫事实。
 * 未完成版本与适用情境审核的三奇、符使组合等旧格局不在此旁路输出；所有标签说明
 * 都禁止直接扩写成现实吉凶、人物意图、成败、行动建议或固定应期。
 */

import type { QimenJiuGongGe, QimenScope } from '../../../../types/divination';
import { qimen } from '../../../../divination/divination-data';
import { isKe } from '../../../../ganzhi';
import { getDoorElement, getOppositePalace } from './palace-utils';

const { palaceStars, doorPalaceMap } = qimen;

/**
 * 六仪击刑固定落宫表。
 *
 * 《遁甲符应经》《奇门遁甲统宗》《奇门旨归》《奇门法窍》均列：
 * 甲子戊临震三、甲戌己临坤二、甲申庚临艮八、甲午辛临离九、
 * 甲辰壬与甲寅癸同临巽四。该规则只用于时家盘面的位置事实。
 */
export const QIMEN_INSTRUMENT_PUNISHMENT_PALACES: Readonly<Record<string, number>> = {
  戊: 3,
  己: 2,
  庚: 8,
  辛: 9,
  壬: 4,
  癸: 4,
};

/** 判断时家天盘六仪是否命中六仪击刑固定落宫。 */
export function isQimenInstrumentPunishment(stem: string, palace: number): boolean {
  return QIMEN_INSTRUMENT_PUNISHMENT_PALACES[stem] === palace;
}

const AUDITED_PATTERN_TAG_PREFIXES = [
  '星伏吟',
  '星反吟',
  '门伏吟',
  '门反吟',
  '门克宫',
  '击刑落宫',
  '马星落宫',
] as const;

/** 判断标签是否属于正式允许输出的可复算位置或五行事实。 */
export function isAuditedQimenPatternTag(tag: string): boolean {
  return AUDITED_PATTERN_TAG_PREFIXES.some((prefix) => tag.startsWith(prefix));
}

function getMenPoTags(jiuGongGe: QimenJiuGongGe[]): string[] {
  return jiuGongGe
    .filter((palace) => palace.renPan.door)
    .filter((palace) => isKe(getDoorElement(palace.renPan.door), palace.element))
    .map((palace) => `门克宫（${palace.name}${palace.renPan.door}克宫五行${palace.element}）`);
}

function getJiXingTag(stem: string, palace: number, palaceName: string): string | null {
  return isQimenInstrumentPunishment(stem, palace)
    ? `击刑落宫（时干所遁六仪${stem}落${palaceName}）`
    : null;
}

export interface QimenPatternTagParams {
  zhiFu: string;
  zhiShi: string;
  zhiFuLandingPalace: number;
  zhiShiLandingPalace: number;
  jiuGongGe: QimenJiuGongGe[];
  hourGanForFind: string;
  scope?: QimenScope;
  horsePalace?: number;
  horsePalaceName?: string;
}

/**
 * 返回正式允许进入提示词的位置标签。
 *
 * 星门伏吟/反吟、门克宫、击刑和马星均只记录可复算命中条件；不在此处解释
 * 吉凶和现实后果。三奇得、三奇得使、三奇游六仪、符使同宫等旧标签失败关闭。
 */
export function getQimenPatternTags(params: QimenPatternTagParams): string[] {
  const {
    zhiFu,
    zhiShi,
    zhiFuLandingPalace,
    zhiShiLandingPalace,
    jiuGongGe,
    hourGanForFind,
    scope = 'hour',
    horsePalace,
    horsePalaceName,
  } = params;
  const tags: string[] = [];

  const zhiFuOriginalPalace = palaceStars.indexOf(zhiFu) + 1;
  if (zhiFu && zhiFuOriginalPalace === 0) {
    throw new Error(`值符星 "${zhiFu}" 无法识别。`);
  }
  if (zhiFu && zhiFuLandingPalace === zhiFuOriginalPalace) {
    tags.push('星伏吟（值符星回原宫）');
  } else if (zhiFu && getOppositePalace(zhiFuOriginalPalace) === zhiFuLandingPalace) {
    tags.push('星反吟（值符星落原宫对冲宫）');
  }

  const zhiShiOriginalPalace = doorPalaceMap[zhiShi as keyof typeof doorPalaceMap];
  if (!zhiShiOriginalPalace) {
    throw new Error(`值使门 "${zhiShi}" 无法识别。`);
  }
  if (zhiShiLandingPalace === zhiShiOriginalPalace) {
    tags.push('门伏吟（值使门回本宫）');
  } else if (getOppositePalace(zhiShiOriginalPalace) === zhiShiLandingPalace) {
    tags.push('门反吟（值使门落本宫对冲宫）');
  }

  tags.push(...getMenPoTags(jiuGongGe));

  const zhiFuLandingGong = jiuGongGe.find((palace) => palace.gong === zhiFuLandingPalace);
  if (scope === 'hour' && zhiFuLandingGong) {
    const jiXingTag = getJiXingTag(hourGanForFind, zhiFuLandingPalace, zhiFuLandingGong.name);
    if (jiXingTag) tags.push(jiXingTag);
  }

  if (horsePalace !== undefined) {
    const horseGong = jiuGongGe.find((palace) => palace.gong === horsePalace);
    if (horseGong) {
      tags.push(`马星落宫（驿马落${horsePalaceName || horseGong.name}）`);
    }
  }

  return tags;
}

export interface PatternDetail {
  tag: string;
  summary: string;
}

function getPatternSummary(tag: string): string {
  if (tag.startsWith('星伏吟')) {
    return '值符星返回其原宫；这里只记录九星位置关系，不据此单独判断现实进度。';
  }
  if (tag.startsWith('星反吟')) {
    return '值符星落在其原宫的对冲宫；这里只记录九星位置关系，不据此单独判断现实变化。';
  }
  if (tag.startsWith('门伏吟')) {
    return '值使门返回本宫；这里只记录八门位置关系，不据此单独判断现实进度。';
  }
  if (tag.startsWith('门反吟')) {
    return '值使门落在本宫的对冲宫；这里只记录八门位置关系，不据此单独判断现实变化。';
  }
  if (tag.startsWith('门克宫')) {
    return '门五行克所在宫五行；这里只记录同宫五行关系，不自动换算成吉凶或方位建议。';
  }
  if (tag.startsWith('击刑落宫')) {
    return '时家时干所遁六仪命中六仪击刑固定落宫表；这里只记录命中条件，不据此单独断事。';
  }
  if (tag.startsWith('马星落宫')) {
    return '驿马所在宫位已记录；是否与问题相关、是否发动及如何取用需结合具体用神。';
  }
  return '当前标签没有已声明的正式解释，不得补造现实断语。';
}

export function buildPatternDetails(patternTags: string[]): PatternDetail[] {
  return patternTags
    .filter(isAuditedQimenPatternTag)
    .map((tag) => ({ tag, summary: getPatternSummary(tag) }));
}
