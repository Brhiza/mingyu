/**
 * @file 七政四余古典恩难仇用与昼夜分金定性算法
 * @传统依据 《果老星宗·论五行相克》《果老星宗·昼夜篇》：生我者为恩，克我者为难，我生者为用，克恩者为仇；昼生以日为尊，夜生以月为重。
 */
import type { QizhengAspect, QizhengStar } from './index';
import type { SolarCrossingEvidence } from '../calendar/solar-illumination-evidence';
import { QIZHENG_ASPECTS } from './aspect-rules';

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
  if (STAR_WUXING[base]) return base;
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

type SunriseSunset = Pick<SolarCrossingEvidence, 'status' | 'crossings'>;

/** 按该民用日内全部升落交点的真实瞬时判昼夜，兼容极昼、极夜与单交点日期。 */
export function isQizhengDaylightAtBirth(utcTimestamp: number, crossing: SunriseSunset): boolean {
  if (!Number.isFinite(utcTimestamp)) throw new Error('七政四余昼夜分金需要有效的出生时刻。');
  if (!Array.isArray(crossing.crossings)) throw new Error('七政四余昼夜分金缺少完整日出日落交点。');
  if (crossing.status === '全天高于阈值') return true;
  if (crossing.status === '全天低于阈值') return false;
  const events = crossing.crossings;
  if (!events.length) throw new Error('七政四余昼夜分金缺少日出日落交点。');
  let lastDirection: (typeof events)[number]['direction'] | undefined;
  for (const event of events) {
    if (!Number.isFinite(event.utcTimestamp)) throw new Error('七政四余日出日落交点时间无效。');
    if (event.utcTimestamp > utcTimestamp) break;
    lastDirection = event.direction;
  }
  return (lastDirection ?? (events[0].direction === '上行' ? '下行' : '上行')) === '上行';
}

/**
 * 依据《果老星宗》推导昼夜分金与恩难仇用星曜交会实效
 */
export function evaluateQizhengEnNan(params: {
  birthUtcTimestamp: number;
  sunriseSunset: SunriseSunset;
  mingZhu: string;
  stars: ReadonlyArray<Pick<QizhengStar, 'name' | 'longitude'>>;
  aspects: QizhengAspect[];
}): QizhengEnNanProfile {
  const { birthUtcTimestamp, sunriseSunset, mingZhu, stars, aspects } = params;
  if (!Array.isArray(stars)) throw new Error('七政四余恩难需要本命星曜黄经。');

  const isDay = isQizhengDaylightAtBirth(birthUtcTimestamp, sunriseSunset);
  const sect: '昼生' | '夜生' = isDay ? '昼生' : '夜生';
  const sectSummary = isDay ? '昼生以日为尊' : '夜生以月为重';

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

  // 3. 逐项核对本命星曜当前黄经，再采用相位记录描述恩难交会。
  // 相位字段可能来自旧盘，不能单凭缓存的类型或角距形成当前交会事实。
  const aspectInteraction: string[] = [];
  const interactionRoleFacts: string[] = [];
  const longitudeByStar = new Map(
    stars.map((star) => [resolveCanonicalStar(star.name), star.longitude]),
  );
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
    const firstLongitude = longitudeByStar.get(s1);
    const secondLongitude = longitudeByStar.get(resolveCanonicalStar(aspect.star2));
    const rule = QIZHENG_ASPECTS.find((item) => item.type === aspect.type);
    if (
      firstLongitude === undefined ||
      secondLongitude === undefined ||
      !Number.isFinite(firstLongitude) ||
      !Number.isFinite(secondLongitude) ||
      !rule
    )
      continue;
    const separation = Math.abs((((firstLongitude - secondLongitude) % 360) + 360) % 360);
    const actualAngle = Math.min(separation, 360 - separation);
    if (Math.abs(actualAngle - rule.angle) > rule.orb) continue;
    const counterpartElement = STAR_WUXING[counterpartCanonical]!;
    const relation = aspect.type === '同宫' ? '合相' : aspect.type;
    if (counterpartElement === nanElement) {
      aspectInteraction.push(`难星${counterpart}与命主形成${relation}吊照`);
      interactionRoleFacts.push(`命主难星：${counterpart}`);
    } else if (counterpartElement === enElement) {
      aspectInteraction.push(`恩星${counterpart}与命主形成${relation}吊照`);
      interactionRoleFacts.push(`命主恩星：${counterpart}`);
    }
  }

  const interactionDesc = interactionRoleFacts.length
    ? [...new Set(interactionRoleFacts)].join('；')
    : '';

  const summary = `【七政恩难】${sect}（${sectSummary}）；命主：${mingZhu}（${mingElement}）${interactionDesc ? `；${interactionDesc}` : ''}；按出生时刻与当地太阳高度阈值划分昼夜（太阳中心名义高度-0.833°，含标准太阳半径与近地平折射近似）`;

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
