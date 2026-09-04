/**
 * @file 七政四余古典恩难仇用与昼夜分金定性算法
 * @传统依据 《果老星宗·论五行相克》《果老星宗·昼夜篇》：生我者为恩，克我者为难，我生者为用，克恩者为仇；昼生以日为尊，夜生以月为重。
 */
import type { QizhengAspect } from './index';

export type WuxingElement = '木' | '火' | '土' | '金' | '水';

export const STAR_WUXING: Record<string, WuxingElement> = {
  太阳: '火',
  太阴: '水',
  水星: '水',
  金星: '金',
  火星: '火',
  木星: '木',
  土星: '土',
  紫炁: '木',
  月孛: '水',
  罗睺: '火',
  计都: '土',
};

const ELEMENT_SHENG: Record<WuxingElement, WuxingElement> = {
  木: '火',
  火: '土',
  土: '金',
  金: '水',
  水: '木',
};

const ELEMENT_KE: Record<WuxingElement, WuxingElement> = {
  木: '土',
  土: '水',
  水: '火',
  火: '金',
  金: '木',
};

export interface QizhengEnNanProfile {
  sect: '昼生' | '夜生';
  sectSummary: string;
  mingZhu: string;
  mingElement: WuxingElement;
  enStars: string[];
  nanStars: string[];
  chouStars: string[];
  yongStars: string[];
  aspectInteraction: string[];
  summary: string;
}

/**
 * 依据《果老星宗》推导昼夜分金与恩难仇用星曜交会实效
 */
export function evaluateQizhengEnNan(params: {
  hour: number;
  mingZhu: string;
  aspects: QizhengAspect[];
}): QizhengEnNanProfile {
  const { hour, mingZhu, aspects } = params;

  // 1. 昼夜分金：卯时（5-7）至酉时（17-19）为昼，其余为夜
  const isDay = hour >= 6 && hour < 18;
  const sect: '昼生' | '夜生' = isDay ? '昼生' : '夜生';
  const sectSummary = isDay ? '昼生以日为尊，太阳高朗为贵' : '夜生以月为重，太阴清辉为吉';

  // 2. 命主五行与恩难仇用角色划分
  const mingElement = STAR_WUXING[mingZhu] ?? '木';

  // 生我者为恩
  const enElement = Object.entries(ELEMENT_SHENG).find(
    ([, v]) => v === mingElement,
  )?.[0] as WuxingElement;
  // 克我者为难
  const nanElement = Object.entries(ELEMENT_KE).find(
    ([, v]) => v === mingElement,
  )?.[0] as WuxingElement;
  // 我生者为用
  const yongElement = ELEMENT_SHENG[mingElement];
  // 克恩者为仇
  const chouElement = Object.entries(ELEMENT_KE).find(
    ([, v]) => v === enElement,
  )?.[0] as WuxingElement;

  const enStars: string[] = [];
  const nanStars: string[] = [];
  const chouStars: string[] = [];
  const yongStars: string[] = [];

  for (const [starName, element] of Object.entries(STAR_WUXING)) {
    if (starName === mingZhu) continue;
    if (element === enElement) enStars.push(starName);
    else if (element === nanElement) nanStars.push(starName);
    else if (element === chouElement) chouStars.push(starName);
    else if (element === yongElement) yongStars.push(starName);
  }

  // 3. 扫描吊照中与命主星交会的相位
  const aspectInteraction: string[] = [];
  const mingZhuAspects = aspects.filter((a) => a.star1 === mingZhu || a.star2 === mingZhu);

  for (const aspect of mingZhuAspects) {
    const counterpart = aspect.star1 === mingZhu ? aspect.star2 : aspect.star1;
    if (nanStars.includes(counterpart)) {
      aspectInteraction.push(`难星${counterpart}${aspect.type}相加，须防动荡受挫`);
    } else if (enStars.includes(counterpart)) {
      aspectInteraction.push(`恩星${counterpart}${aspect.type}相助，逢险有救应`);
    }
  }

  const interactionDesc = aspectInteraction.length
    ? aspectInteraction.slice(0, 2).join('；')
    : `恩星${enStars.slice(0, 2).join('、')}拱护，难星${nanStars.slice(0, 2).join('、')}受约`;

  const summary = `【七政恩难】${sect}人（${sectSummary}）；命主${mingZhu}（${mingElement}），${interactionDesc}`;

  return {
    sect,
    sectSummary,
    mingZhu,
    mingElement,
    enStars,
    nanStars,
    chouStars,
    yongStars,
    aspectInteraction,
    summary,
  };
}
