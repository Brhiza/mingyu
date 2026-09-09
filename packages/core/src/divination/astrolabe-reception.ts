/**
 * @file 西洋古典占星合盘互溶与接纳（Mutual Reception & Reception）算法
 * @传统依据 托勒密与中世纪传统占星：行星落入对方本征尊贵（庙/旺）之座，形成互溶或接纳，为合盘化解刑冲、促成默契之核心依据。
 */
import type { AstrolabeData, AstrolabeSynastryAspect } from '../types/divination';

export interface AstrolabeSynastryReception {
  type: '互溶' | '接纳';
  person1Planet: string;
  person2Planet: string;
  person1PlanetLabel: string;
  person2PlanetLabel: string;
  sign1: string;
  sign2: string;
  summary: string;
}

const TRADITIONAL_RULERS: Record<number, string> = {
  0: 'Mars', // 白羊
  1: 'Venus', // 金牛
  2: 'Mercury', // 双子
  3: 'Moon', // 巨蟹
  4: 'Sun', // 狮子
  5: 'Mercury', // 处女
  6: 'Venus', // 天秤
  7: 'Mars', // 天蝎
  8: 'Jupiter', // 射手
  9: 'Saturn', // 摩羯
  10: 'Saturn', // 水瓶
  11: 'Jupiter', // 双鱼
};

const TRADITIONAL_EXALTATIONS: Record<number, string> = {
  0: 'Sun', // 白羊
  1: 'Moon', // 金牛
  3: 'Jupiter', // 巨蟹
  5: 'Mercury', // 处女
  6: 'Saturn', // 天秤
  9: 'Mars', // 摩羯
  11: 'Venus', // 双鱼
};

const ZODIAC_SIGNS = [
  '白羊座',
  '金牛座',
  '双子座',
  '巨蟹座',
  '狮子座',
  '处女座',
  '天秤座',
  '天蝎座',
  '射手座',
  '摩羯座',
  '水瓶座',
  '双鱼座',
];

const PLANET_LABELS: Record<string, string> = {
  Sun: '太阳',
  Moon: '月亮',
  Mercury: '水星',
  Venus: '金星',
  Mars: '火星',
  Jupiter: '木星',
  Saturn: '土星',
};

const SEVEN_PLANETS = new Set(['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn']);

/**
 * 依据古典占星守护与曜升计算双方行星互溶与接纳关系
 * @param aspects 全部命中相位（应传入未截断的完整命中列表）
 * @param options.pointNames 计算点筛选；提供时互溶与接纳均只考虑所选点位
 */
export function evaluateAstrolabeSynastryReceptions(
  chart1: AstrolabeData,
  chart2: AstrolabeData,
  aspects: AstrolabeSynastryAspect[] = [],
  options: { pointNames?: ReadonlySet<string> } = {},
): {
  receptions: AstrolabeSynastryReception[];
  summary: string;
} {
  const inScope = (name: string) => !options.pointNames || options.pointNames.has(name);
  const p1Planets = chart1.planets.filter((p) => SEVEN_PLANETS.has(p.name) && inScope(p.name));
  const p2Planets = chart2.planets.filter((p) => SEVEN_PLANETS.has(p.name) && inScope(p.name));

  const receptions: AstrolabeSynastryReception[] = [];
  const processedPairs = new Set<string>();

  // 1. 检查双方互溶（Mutual Reception）
  for (const p1 of p1Planets) {
    const sign1Index = Math.floor((((p1.longitude % 360) + 360) % 360) / 30);
    const rulerOfSign1 = TRADITIONAL_RULERS[sign1Index];

    for (const p2 of p2Planets) {
      const sign2Index = Math.floor((((p2.longitude % 360) + 360) % 360) / 30);
      const rulerOfSign2 = TRADITIONAL_RULERS[sign2Index];

      const pairKey = `${p1.name}:${p2.name}`;
      if (processedPairs.has(pairKey)) continue;

      if (p2.name === rulerOfSign1 && p1.name === rulerOfSign2) {
        processedPairs.add(pairKey);
        const l1 = PLANET_LABELS[p1.name] ?? p1.name;
        const l2 = PLANET_LABELS[p2.name] ?? p2.name;
        const s1 = ZODIAC_SIGNS[sign1Index];
        const s2 = ZODIAC_SIGNS[sign2Index];
        receptions.push({
          type: '互溶',
          person1Planet: p1.name,
          person2Planet: p2.name,
          person1PlanetLabel: l1,
          person2PlanetLabel: l2,
          sign1: s1,
          sign2: s2,
          // 此处仅核验入庙守护互溶，不含曜升互溶
          summary: `${chart1.birth.name}的${l1}落${s1}，${chart2.birth.name}的${l2}落${s2}；${s1}由${l2}入庙守护，${s2}由${l1}入庙守护，形成守护互溶；关系承接结合全盘相位与双方实际尊贵强弱判断`,
        });
      }
    }
  }

  // 2. 检查单向接纳（Reception）伴随相位者
  for (const aspect of aspects) {
    if (!SEVEN_PLANETS.has(aspect.point1Name) || !SEVEN_PLANETS.has(aspect.point2Name)) continue;
    const p1 = p1Planets.find((p) => p.name === aspect.point1Name);
    const p2 = p2Planets.find((p) => p.name === aspect.point2Name);
    if (!p1 || !p2) continue;

    const pairKey = `reception:${p1.name}:${p2.name}`;
    if (processedPairs.has(pairKey)) continue;

    const sign1Index = Math.floor((((p1.longitude % 360) + 360) % 360) / 30);
    const sign2Index = Math.floor((((p2.longitude % 360) + 360) % 360) / 30);

    const ruler1 = TRADITIONAL_RULERS[sign1Index];
    const exalt1 = TRADITIONAL_EXALTATIONS[sign1Index];
    const ruler2 = TRADITIONAL_RULERS[sign2Index];
    const exalt2 = TRADITIONAL_EXALTATIONS[sign2Index];

    const l1 = PLANET_LABELS[p1.name] ?? p1.name;
    const l2 = PLANET_LABELS[p2.name] ?? p2.name;

    // 双向分别判定并分别记录，两方向同时成立时不只保留第一个方向
    const p2ReceivesP1 =
      p2.name === ruler1 ? ('入庙' as const) : p2.name === exalt1 ? ('曜升' as const) : undefined;
    const p1ReceivesP2 =
      p1.name === ruler2 ? ('入庙' as const) : p1.name === exalt2 ? ('曜升' as const) : undefined;

    if (p2ReceivesP1) {
      processedPairs.add(pairKey);
      receptions.push({
        type: '接纳',
        person1Planet: p1.name,
        person2Planet: p2.name,
        person1PlanetLabel: l1,
        person2PlanetLabel: l2,
        sign1: ZODIAC_SIGNS[sign1Index],
        sign2: ZODIAC_SIGNS[sign2Index],
        summary: `${chart1.birth.name}的${l1}落${ZODIAC_SIGNS[sign1Index]}，${chart2.birth.name}的${l2}落${ZODIAC_SIGNS[sign2Index]}；${ZODIAC_SIGNS[sign1Index]}是${l2}的${p2ReceivesP1}星座，因此${chart2.birth.name}的${l2}接纳${chart1.birth.name}的${l1}，双方这两颗星伴随${aspect.type}`,
      });
    }
    if (p1ReceivesP2) {
      processedPairs.add(pairKey);
      receptions.push({
        type: '接纳',
        person1Planet: p1.name,
        person2Planet: p2.name,
        person1PlanetLabel: l1,
        person2PlanetLabel: l2,
        sign1: ZODIAC_SIGNS[sign1Index],
        sign2: ZODIAC_SIGNS[sign2Index],
        summary: `${chart1.birth.name}的${l1}落${ZODIAC_SIGNS[sign1Index]}，${chart2.birth.name}的${l2}落${ZODIAC_SIGNS[sign2Index]}；${ZODIAC_SIGNS[sign2Index]}是${l1}的${p1ReceivesP2}星座，因此${chart1.birth.name}的${l1}接纳${chart2.birth.name}的${l2}，双方这两颗星伴随${aspect.type}`,
      });
    }
  }

  const summary = receptions.length
    ? `【古典接纳互溶】${receptions.map((r) => r.summary).join('；')}`
    : '【古典接纳互溶】双方主要行星未见守护互溶或伴随相位的接纳结构，以常规几何相位交感为主';

  return {
    receptions,
    summary,
  };
}
