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

/** 命主单字与古称到恩难模块标准星曜名的对应 */
const STAR_ALIAS_TO_CANONICAL: Record<string, string> = {
  日: '太阳',
  月: '太阴',
  水: '水星',
  金: '金星',
  火: '火星',
  木: '木星',
  土: '土星',
  辰星: '水星',
  太白: '金星',
  荧惑: '火星',
  岁星: '木星',
  镇星: '土星',
};

/** 将命主或相位星曜名称归一到 STAR_WUXING 的标准名；无法识别时返回 undefined */
function resolveCanonicalStar(name: string): string | undefined {
  if (STAR_WUXING[name]) return name;
  if (STAR_ALIAS_TO_CANONICAL[name]) return STAR_ALIAS_TO_CANONICAL[name];
  // 兼容“辰星(水)”“罗睺(火余)”等带括注的展示名
  const base = name.replace(/[（(].*$/, '').trim();
  if (STAR_ALIAS_TO_CANONICAL[base]) return STAR_ALIAS_TO_CANONICAL[base];
  return undefined;
}

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

  // 1. 昼夜分金：按固定钟表时段 6:00—18:00 判昼夜（固定时段约定，
  //    未按地点、季节的日出日没或太阳高度计算，与天文昼夜是两种口径）
  const isDay = hour >= 6 && hour < 18;
  const sect: '昼生' | '夜生' = isDay ? '昼生' : '夜生';
  const sectSummary = isDay ? '昼生以日为尊，太阳高朗为贵' : '夜生以月为重，太阴清辉为吉';

  // 2. 命主五行与恩难仇用角色划分
  // 命主名称按别名表归一（支持日/月/水等单字与太阳等全名），未知名称保留错误，不再默认作木
  const canonicalMingZhu = resolveCanonicalStar(mingZhu);
  if (!canonicalMingZhu) {
    throw new Error(`七政四余恩难命主名称无法识别：${mingZhu}`);
  }
  const mingElement = STAR_WUXING[canonicalMingZhu]!;

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
    if (starName === canonicalMingZhu) continue;
    if (element === enElement) enStars.push(starName);
    else if (element === nanElement) nanStars.push(starName);
    else if (element === chouElement) chouStars.push(starName);
    else if (element === yongElement) yongStars.push(starName);
  }

  // 3. 扫描吊照中与命主星交会的相位
  // 相位星曜按同一别名表归一后再比对，避免单字命主与展示名互不匹配
  const aspectInteraction: string[] = [];
  const mingZhuAspects = aspects.filter((a) => {
    const s1 = resolveCanonicalStar(a.star1);
    const s2 = resolveCanonicalStar(a.star2);
    return s1 === canonicalMingZhu || s2 === canonicalMingZhu;
  });

  for (const aspect of mingZhuAspects) {
    const s1 = resolveCanonicalStar(aspect.star1);
    const counterpart = s1 === canonicalMingZhu ? aspect.star2 : aspect.star1;
    const counterpartCanonical = resolveCanonicalStar(counterpart);
    if (!counterpartCanonical) continue;
    const counterpartElement = STAR_WUXING[counterpartCanonical]!;
    if (counterpartElement === nanElement) {
      aspectInteraction.push(`难星${counterpart}${aspect.type}相加，须防动荡受挫`);
    } else if (counterpartElement === enElement) {
      aspectInteraction.push(`恩星${counterpart}${aspect.type}相助，逢险有救应`);
    }
  }

  // 无命主相位时不得径直给出拱护、受约等结论
  const interactionDesc = aspectInteraction.length
    ? aspectInteraction.slice(0, 2).join('；')
    : '命主未见恩难星曜直接交会相位，恩难实效待吊照与行运另行核对';

  const summary = `【七政恩难】${sect}人（${sectSummary}）；命主${mingZhu}（${mingElement}），${interactionDesc}；昼夜按 6:00—18:00 固定钟表时段判定，非按日出日没计算`;

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
