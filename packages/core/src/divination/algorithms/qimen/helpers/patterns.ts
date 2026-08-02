/**
 * @file 奇门可复算位置与五行标签
 * @description 只记录能由当前九宫直接复算的位置、五行和固定落宫事实。
 * 未完成版本与适用情境审核的三奇、符使组合等旧格局不在此旁路输出；所有标签说明
 * 都禁止直接扩写成现实吉凶、人物意图、成败、行动建议或固定应期。
 */

import type { QimenJiuGongGe, QimenScope } from '../../../../types/divination';
import { qimen } from '../../../../divination/divination-data';
import { getVoidBranches } from '../../../../calendar/lunar';
import { isKe, isValidGanZhi } from '../../../../ganzhi';
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

/**
 * 返回当前已审核层级允许公开的旬空地支。
 *
 * 《奇门法窍》明确区分“日奇重日旬空亡，时奇重时旬空亡”。当前日家未开放，
 * 月家、年家也没有取得把主动月柱或年柱直接当作旬空依据的闭合原文，因此只保留时家时旬空。
 */
export function getAuditedQimenVoidBranches(scope: QimenScope, activeGanZhi: string): string[] {
  if (scope !== 'hour') return [];
  const branches = getVoidBranches(activeGanZhi);
  if (branches.length !== 2 || new Set(branches).size !== 2) {
    throw new Error(`奇门时家时柱“${activeGanZhi}”未取得两个唯一旬空地支。`);
  }
  return branches;
}

/**
 * 时家日马固定起例。
 *
 * 《奇门遁甲秘笈大全》明确列出：寅午戌日马在申、申子辰日马在寅、
 * 巳酉丑日马在亥、亥卯未日马在巳。这里只登记日支到日马支的固定映射，
 * 不把同一表外推成时马、月马或年马，也不据日马单独生成应期和现实断语。
 */
export const QIMEN_DAY_HORSE_BY_DAY_BRANCH: Readonly<Record<string, string>> = {
  子: '寅',
  丑: '亥',
  寅: '申',
  卯: '巳',
  辰: '寅',
  巳: '亥',
  午: '申',
  未: '巳',
  申: '寅',
  酉: '亥',
  戌: '申',
  亥: '巳',
};

/** 返回当前审核层级允许公开的日马地支；月家、年家及未开放日家不外推。 */
export function getAuditedQimenDayHorseBranch(scope: QimenScope, dayGanZhi: string): string | null {
  if (scope !== 'hour') return null;
  if (!isValidGanZhi(dayGanZhi)) {
    throw new Error(`奇门时家日马需要完整且合法的日柱，当前为“${String(dayGanZhi)}”。`);
  }
  const dayBranch = dayGanZhi.charAt(1);
  const horseBranch = QIMEN_DAY_HORSE_BY_DAY_BRANCH[dayBranch];
  if (!horseBranch) {
    throw new Error(`奇门时家日支“${dayBranch}”未取得已审核日马地支。`);
  }
  return horseBranch;
}

const AUDITED_PATTERN_TAG_PREFIXES = [
  '星伏吟',
  '星反吟',
  '门伏吟',
  '门反吟',
  '门克宫',
  '击刑落宫',
] as const;

/** 判断标签是否属于正式允许输出的可复算位置或五行事实。 */
export function isAuditedQimenPatternTag(tag: string): boolean {
  return AUDITED_PATTERN_TAG_PREFIXES.some((prefix) => tag.startsWith(prefix));
}

/**
 * 只记录八门五行克所在宫五行的直接结构。
 *
 * 古籍对“门迫/宫迫”的名称互有倒置，且“迫制和义格”的命名层级并不统一，
 * 因此这里不借用任何争议格名，也不附加吉凶、主客或行动断语。
 */
function getDoorControlsPalaceTags(jiuGongGe: QimenJiuGongGe[]): string[] {
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
}

/**
 * 返回正式允许进入提示词的位置标签。
 *
 * 时家星门伏吟/反吟、门克宫和时家击刑只记录可复算命中条件；不在此处解释吉凶和现实
 * 后果。六甲时直接视为伏吟、天禽寄宫伏反吟、月家年家伏反吟、跨层级马星，以及三奇得、
 * 三奇得使、三奇游六仪等旧标签失败关闭。“符使同宫”原文只说明符使同起于旬首甲遁宫
 * 后分别加临，不足以命名当前落宫独立吉格；当前同宫只由证据层并列保留两个位置索引。
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
  } = params;
  const tags: string[] = [];

  const zhiFuOriginalPalace = palaceStars.indexOf(zhiFu) + 1;
  if (zhiFu && zhiFuOriginalPalace === 0) {
    throw new Error(`值符星 "${zhiFu}" 无法识别。`);
  }

  const zhiShiOriginalPalace = doorPalaceMap[zhiShi as keyof typeof doorPalaceMap];
  if (!zhiShiOriginalPalace) {
    throw new Error(`值使门 "${zhiShi}" 无法识别。`);
  }

  if (scope === 'hour') {
    // 天禽居中五，转盘又涉及寄宫版本；完成单一寄宫口径校勘前不自动命名伏反吟。
    if (zhiFu !== '天禽' && zhiFuLandingPalace === zhiFuOriginalPalace) {
      tags.push('星伏吟（值符星回原宫）');
    } else if (zhiFu !== '天禽' && getOppositePalace(zhiFuOriginalPalace) === zhiFuLandingPalace) {
      tags.push('星反吟（值符星落原宫对冲宫）');
    }

    if (zhiShiLandingPalace === zhiShiOriginalPalace) {
      tags.push('门伏吟（值使门回本宫）');
    } else if (getOppositePalace(zhiShiOriginalPalace) === zhiShiLandingPalace) {
      tags.push('门反吟（值使门落本宫对冲宫）');
    }
  }

  tags.push(...getDoorControlsPalaceTags(jiuGongGe));

  const zhiFuLandingGong = jiuGongGe.find((palace) => palace.gong === zhiFuLandingPalace);
  if (scope === 'hour' && zhiFuLandingGong) {
    const jiXingTag = getJiXingTag(hourGanForFind, zhiFuLandingPalace, zhiFuLandingGong.name);
    if (jiXingTag) tags.push(jiXingTag);
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
    return '门五行克所在宫五行；这里只记录同宫五行关系，不自动命名门迫、宫迫或迫制和义格，也不换算成吉凶或方位建议。';
  }
  if (tag.startsWith('击刑落宫')) {
    return '时家时干所遁六仪命中六仪击刑固定落宫表；这里只记录命中条件，不据此单独断事。';
  }
  return '当前标签没有已声明的正式解释，不得补造现实断语。';
}

export function buildPatternDetails(patternTags: string[]): PatternDetail[] {
  return patternTags
    .filter(isAuditedQimenPatternTag)
    .map((tag) => ({ tag, summary: getPatternSummary(tag) }));
}
