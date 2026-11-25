/**
 * 紫微斗数本命十二宫格局检测（独立 V2 实现，无 v1 依赖）。
 * 仅执行具备固定古籍版本、卷次、原文与可复算条件的已校勘规则。
 */

export type ZiweiPatternKind = 'auspicious' | 'inauspicious' | 'neutral';

export interface ZiweiPatternStar {
  name: string;
  brightness?: string;
  mutagen?: string;
}

export interface ZiweiPatternPalace {
  index: number;
  name: string;
  isBodyPalace: boolean;
  earthlyBranch: string;
  majorStars: readonly ZiweiPatternStar[];
  minorStars: readonly ZiweiPatternStar[];
  adjectiveStars: readonly ZiweiPatternStar[];
}

export interface ZiweiPattern {
  id: string;
  name: string;
  kind: ZiweiPatternKind;
  description: string;
  palaces: string[];
  stars: string[];
  conditions: string[];
  source: string;
  quote: string;
}

interface PatternContext {
  palaces: readonly ZiweiPatternPalace[];
  palaceByIndex: Map<number, ZiweiPatternPalace>;
  soulPalace: ZiweiPatternPalace;
  birthYearHeavenlyStem?: string;
}

interface PatternMatch {
  palaces: ZiweiPatternPalace[];
  stars: string[];
  conditions: string[];
}

interface VerifiedPatternRule {
  id: string;
  name: string;
  kind: ZiweiPatternKind;
  description: string;
  source: string;
  quote: string;
  canEvaluate?: (context: PatternContext) => boolean;
  detect: (context: PatternContext) => PatternMatch | null;
}

const PALACE_COUNT = 12;
const TEMPLE_OR_PROSPEROUS = new Set(['庙', '旺']);
const FOUR_MALEFICS = ['擎羊', '陀罗', '火星', '铃星'] as const;
const VOID_STARS = ['空亡', '旬空', '天空', '截空', '截路', '截路空亡'] as const;
const KONG_JIE_STARS = ['地空', '地劫'] as const;

const VOL_ONE = '《紫微斗数全书》卷一';
const VOL_THREE = '《紫微斗数全书》卷三';

const normalizePalaceName = (name: string) => (name.endsWith('宫') ? name.slice(0, -1) : name);

const natalStars = (palace: ZiweiPatternPalace): ZiweiPatternStar[] => [
  ...palace.majorStars,
  ...palace.minorStars,
  ...palace.adjectiveStars,
];

const hasStar = (palace: ZiweiPatternPalace, name: string) =>
  natalStars(palace).some((star) => star.name === name);

const hasAllStars = (palace: ZiweiPatternPalace, names: readonly string[]) =>
  names.every((name) => hasStar(palace, name));

const getStar = (palace: ZiweiPatternPalace, name: string) =>
  natalStars(palace).find((star) => star.name === name);

const getMatchedStarNames = (palace: ZiweiPatternPalace, names: readonly string[]) =>
  names.filter((name) => hasStar(palace, name));

const getBirthMutagenStars = (palace: ZiweiPatternPalace, mutagens: readonly string[]) =>
  natalStars(palace).filter((star) => !!star.mutagen && mutagens.includes(star.mutagen));

const isTempleOrProsperous = (star?: ZiweiPatternStar) =>
  !!star?.brightness && TEMPLE_OR_PROSPEROUS.has(star.brightness);

const hasVoidStar = (palace: ZiweiPatternPalace) =>
  getMatchedStarNames(palace, VOID_STARS).length > 0;

const hasAnyMalefic = (palaces: readonly ZiweiPatternPalace[]) =>
  palaces.some((palace) => getMatchedStarNames(palace, FOUR_MALEFICS).length > 0);

const uniquePalaces = (palaces: readonly ZiweiPatternPalace[]) => [
  ...new Map(palaces.map((palace) => [palace.index, palace])).values(),
];

const getSoulAndBodyPalaces = (context: PatternContext) =>
  uniquePalaces([
    context.soulPalace,
    ...context.palaces.filter((palace) => palace.isBodyPalace),
  ]);

const getPalaceByOffset = (
  context: PatternContext,
  palace: ZiweiPatternPalace,
  offset: number,
) => context.palaceByIndex.get((palace.index + offset + PALACE_COUNT) % PALACE_COUNT);

const getNeighborPalaces = (context: PatternContext, palace: ZiweiPatternPalace) =>
  [getPalaceByOffset(context, palace, -1), getPalaceByOffset(context, palace, 1)].filter(
    (item): item is ZiweiPatternPalace => !!item,
  );

const getOppositePalace = (context: PatternContext, palace: ZiweiPatternPalace) =>
  getPalaceByOffset(context, palace, 6);

const getSurroundedPalaces = (context: PatternContext, palace: ZiweiPatternPalace) =>
  [0, 4, 8, 6]
    .map((offset) => getPalaceByOffset(context, palace, offset))
    .filter((item): item is ZiweiPatternPalace => !!item);

const getTrinePalaces = (context: PatternContext, palace: ZiweiPatternPalace) =>
  [4, 8]
    .map((offset) => getPalaceByOffset(context, palace, offset))
    .filter((item): item is ZiweiPatternPalace => !!item);

const findStarPalace = (palaces: readonly ZiweiPatternPalace[], starName: string) =>
  palaces.find((palace) => hasStar(palace, starName));

const getSurroundedStarPalace = (
  context: PatternContext,
  palace: ZiweiPatternPalace,
  starName: string,
) => findStarPalace(getSurroundedPalaces(context, palace), starName);

const getFlankingMatch = (
  context: PatternContext,
  palace: ZiweiPatternPalace,
  firstStar: string,
  secondStar: string,
): ZiweiPatternPalace[] | null => {
  const neighbors = getNeighborPalaces(context, palace);
  if (neighbors.length !== 2) return null;
  const matched =
    (hasStar(neighbors[0], firstStar) && hasStar(neighbors[1], secondStar)) ||
    (hasStar(neighbors[0], secondStar) && hasStar(neighbors[1], firstStar));
  return matched ? neighbors : null;
};

const getPalaceByName = (context: PatternContext, name: string) => {
  const normalized = normalizePalaceName(name);
  return context.palaces.find((palace) => normalizePalaceName(palace.name) === normalized);
};

const hasSingleMajorStar = (palace: ZiweiPatternPalace, name: string) =>
  palace.majorStars.length === 1 && palace.majorStars[0]?.name === name;

const VERIFIED_PATTERN_RULES: VerifiedPatternRule[] = [
  {
    id: 'ziwei-tianfu-tonggong',
    name: '紫府同宫',
    kind: 'auspicious',
    description: '紫微与天府同坐命宫。',
    source: `${VOL_ONE}·太微赋`,
    quote: '紫府同宫终身福厚。',
    detect: ({ soulPalace }) =>
      hasAllStars(soulPalace, ['紫微', '天府'])
        ? { palaces: [soulPalace], stars: ['紫微', '天府'], conditions: ['紫微与天府同坐命宫'] }
        : null,
  },
  {
    id: 'fu-bi-gong-zhu',
    name: '辅弼拱主',
    kind: 'auspicious',
    description: '紫微守命，左辅、右弼从三方四正拱照或前后夹命。',
    source: `${VOL_ONE}·定富贵局`,
    quote: '辅弼拱主，紫微守命二星来拱是也，夹之亦然。',
    detect(context) {
      const { soulPalace } = context;
      if (!hasStar(soulPalace, '紫微')) return null;
      const flanks = getFlankingMatch(context, soulPalace, '左辅', '右弼');
      if (flanks) {
        return {
          palaces: [soulPalace, ...flanks],
          stars: ['紫微', '左辅', '右弼'],
          conditions: ['紫微守命', '左辅与右弼前后夹命'],
        };
      }
      const surrounded = getSurroundedPalaces(context, soulPalace).filter(
        (palace) => palace.index !== soulPalace.index,
      );
      const left = findStarPalace(surrounded, '左辅');
      const right = findStarPalace(surrounded, '右弼');
      return left && right
        ? {
            palaces: uniquePalaces([soulPalace, left, right]),
            stars: ['紫微', '左辅', '右弼'],
            conditions: ['紫微守命', '左辅与右弼从命宫三方四正拱照'],
          }
        : null;
    },
  },
  {
    id: 'jun-chen-qing-hui',
    name: '君臣庆会',
    kind: 'auspicious',
    description: '紫微、左辅、右弼同守命宫。',
    source: `${VOL_ONE}·定富贵局`,
    quote: '君臣庆会，紫微左右同守命是也，更会相武阴妙上。',
    detect: ({ soulPalace }) =>
      hasAllStars(soulPalace, ['紫微', '左辅', '右弼'])
        ? {
            palaces: [soulPalace],
            stars: ['紫微', '左辅', '右弼'],
            conditions: ['紫微、左辅、右弼同守命宫'],
          }
        : null,
  },
  {
    id: 'zuo-you-jia-ming',
    name: '左右夹命',
    kind: 'auspicious',
    description: '左辅、右弼分居命宫相邻两宫。',
    source: `${VOL_THREE}·左辅右弼`,
    quote: '左右夹命为贵格，如安命在丑宫，左辅在子宫，右弼在寅宫。',
    detect(context) {
      const flanks = getFlankingMatch(context, context.soulPalace, '左辅', '右弼');
      return flanks
        ? {
            palaces: [context.soulPalace, ...flanks],
            stars: ['左辅', '右弼'],
            conditions: ['左辅、右弼分居命宫相邻两宫'],
          }
        : null;
    },
  },
  {
    id: 'zuo-gui-xiang-gui',
    name: '坐贵向贵',
    kind: 'auspicious',
    description: '天魁、天钺一曜坐命，另一曜在对宫。',
    source: `${VOL_ONE}·定富贵局`,
    quote: '坐贵向贵，谓魁钺在命迭相坐拱是也。',
    detect(context) {
      const opposite = getOppositePalace(context, context.soulPalace);
      if (!opposite) return null;
      const matched =
        (hasStar(context.soulPalace, '天魁') && hasStar(opposite, '天钺')) ||
        (hasStar(context.soulPalace, '天钺') && hasStar(opposite, '天魁'));
      return matched
        ? {
            palaces: [context.soulPalace, opposite],
            stars: ['天魁', '天钺'],
            conditions: ['天魁、天钺一曜坐命，另一曜在对宫'],
          }
        : null;
    },
  },
  {
    id: 'jian-wen-wu',
    name: '兼文武',
    kind: 'auspicious',
    description: '文曲、武曲同坐命宫或身宫。',
    source: `${VOL_ONE}·论兼文武格`,
    quote: '论兼文武格，文曲武曲在身命是也。',
    detect(context) {
      const target = getSoulAndBodyPalaces(context).find((palace) =>
        hasAllStars(palace, ['文曲', '武曲']),
      );
      return target
        ? {
            palaces: [target],
            stars: ['文曲', '武曲'],
            conditions: [
              `文曲、武曲同坐${target.index === context.soulPalace.index ? '命宫' : '身宫'}`,
            ],
          }
        : null;
    },
  },
  {
    id: 'liang-chong-hua-gai',
    name: '两重华盖',
    kind: 'inauspicious',
    description: '禄存与生年化禄同坐命宫，并见地空或地劫。',
    source: `${VOL_ONE}·定贫贱局`,
    quote: '两重华盖，谓禄存化禄坐命遇空劫是也。',
    detect({ soulPalace }) {
      const huaLu = getBirthMutagenStars(soulPalace, ['禄'])[0];
      const voidStars = getMatchedStarNames(soulPalace, KONG_JIE_STARS);
      return hasStar(soulPalace, '禄存') && huaLu && voidStars.length > 0
        ? {
            palaces: [soulPalace],
            stars: ['禄存', `${huaLu.name}化禄`, ...voidStars],
            conditions: ['禄存与生年化禄同坐命宫', `命宫见${voidStars.join('、')}`],
          }
        : null;
    },
  },
  {
    id: 'yue-lang-tian-men',
    name: '月朗天门',
    kind: 'auspicious',
    description: '太阴在亥宫守命。',
    source: `${VOL_ONE}·定富贵局`,
    quote: '月落亥宫，月在亥守命是也，又名月朗天门。',
    detect: ({ soulPalace }) =>
      soulPalace.earthlyBranch === '亥' && hasStar(soulPalace, '太阴')
        ? { palaces: [soulPalace], stars: ['太阴'], conditions: ['太阴在亥宫守命'] }
        : null,
  },
  {
    id: 'yue-sheng-cang-hai',
    name: '月生沧海',
    kind: 'auspicious',
    description: '太阴在子宫守田宅宫。',
    source: `${VOL_ONE}·定富贵局`,
    quote: '月生沧海，月在子宫守田宅是也。',
    detect(context) {
      const target = getPalaceByName(context, '田宅');
      return target?.earthlyBranch === '子' && hasStar(target, '太阴')
        ? { palaces: [target], stars: ['太阴'], conditions: ['太阴在子宫守田宅宫'] }
        : null;
    },
  },
  {
    id: 'jin-can-guang-hui',
    name: '金灿光辉',
    kind: 'auspicious',
    description: '太阳单守午宫命宫。',
    source: `${VOL_ONE}·定富贵局`,
    quote: '金灿光辉，太阳单守，命在午宫是也。',
    detect: ({ soulPalace }) =>
      soulPalace.earthlyBranch === '午' && hasSingleMajorStar(soulPalace, '太阳')
        ? { palaces: [soulPalace], stars: ['太阳'], conditions: ['太阳单守午宫命宫'] }
        : null,
  },
  {
    id: 'ri-chu-fu-sang',
    name: '日出扶桑',
    kind: 'auspicious',
    description: '太阳在卯宫守命宫或官禄宫。',
    source: `${VOL_ONE}·定富贵局`,
    quote: '日出扶桑，日在卯守命是也，守官禄宫亦然。',
    detect(context) {
      const targets = [context.soulPalace, getPalaceByName(context, '官禄')].filter(
        (palace): palace is ZiweiPatternPalace =>
          !!palace && palace.earthlyBranch === '卯' && hasStar(palace, '太阳'),
      );
      return targets.length
        ? {
            palaces: targets,
            stars: ['太阳'],
            conditions: targets.map((palace) => `太阳在卯宫守${palace.name}`),
          }
        : null;
    },
  },
  {
    id: 'huang-dian-chao-ban',
    name: '皇殿朝班',
    kind: 'auspicious',
    description: '太阳与文昌同守官禄宫。',
    source: `${VOL_ONE}·定富贵局`,
    quote: '太陽會文昌於官祿，皇殿朝班，富貴全美。',
    detect(context) {
      const target = getPalaceByName(context, '官禄');
      return target && hasAllStars(target, ['太阳', '文昌'])
        ? { palaces: [target], stars: ['太阳', '文昌'], conditions: ['太阳与文昌同守官禄宫'] }
        : null;
    },
  },
  {
    id: 'lu-ma-jiao-chi',
    name: '禄马交驰',
    kind: 'auspicious',
    description: '禄存与天马同坐命宫或身宫。',
    source: `${VOL_ONE}·问天马星所主若何`,
    quote: '如身命临之谓之驿马……如与禄存同宫，谓之禄马交驰。',
    detect(context) {
      const targets = getSoulAndBodyPalaces(context).filter((palace) =>
        hasAllStars(palace, ['禄存', '天马']),
      );
      return targets.length
        ? {
            palaces: targets,
            stars: ['禄存', '天马'],
            conditions: targets.map(
              (palace) =>
                `禄存与天马同坐${palace.index === context.soulPalace.index ? '命宫' : '身宫'}`,
            ),
          }
        : null;
    },
  },
  {
    id: 'cai-lu-jia-ma',
    name: '财禄夹马',
    kind: 'auspicious',
    description: '天马守命，武曲与禄存分居命宫相邻两宫。',
    source: `${VOL_ONE}·定富贵局`,
    quote: '财禄夹马，马守命武禄来夹是也，逢生旺尤妙。',
    detect(context) {
      if (!hasStar(context.soulPalace, '天马')) return null;
      const flanks = getFlankingMatch(context, context.soulPalace, '武曲', '禄存');
      return flanks
        ? {
            palaces: [context.soulPalace, ...flanks],
            stars: ['天马', '武曲', '禄存'],
            conditions: ['天马守命', '武曲与禄存分居命宫相邻两宫'],
          }
        : null;
    },
  },
  {
    id: 'ri-yue-zhao-bi',
    name: '日月照璧',
    kind: 'auspicious',
    description: '太阳与太阴同守田宅宫。',
    source: `${VOL_ONE}·定富贵局`,
    quote: '日月照璧，日月临田宅宫是也，喜居墓库。',
    detect(context) {
      const target = getPalaceByName(context, '田宅');
      return target && hasAllStars(target, ['太阳', '太阴'])
        ? {
            palaces: [target],
            stars: ['太阳', '太阴'],
            conditions: [
              '太阳与太阴同守田宅宫',
              ...(['辰', '戌', '丑', '未'].includes(target.earthlyBranch)
                ? [`田宅宫在${target.earthlyBranch}，属于古籍所喜墓库`]
                : []),
            ],
          }
        : null;
    },
  },
  {
    id: 'shi-zhong-yin-yu',
    name: '石中隐玉',
    kind: 'auspicious',
    description: '巨门在子宫或午宫守命。',
    source: `${VOL_ONE}·论石中隐玉格`,
    quote: '论石中隐玉格，命在子午逢巨门是也。',
    detect: ({ soulPalace }) =>
      ['子', '午'].includes(soulPalace.earthlyBranch) && hasStar(soulPalace, '巨门')
        ? {
            palaces: [soulPalace],
            stars: ['巨门'],
            conditions: [`巨门在${soulPalace.earthlyBranch}宫守命`],
          }
        : null,
  },
  {
    id: 'zi-fu-jia-ming',
    name: '紫府夹命',
    kind: 'auspicious',
    description: '紫微与天府分居命宫相邻两宫。',
    source: `${VOL_THREE}·紫微`,
    quote: '紫府夹命为贵格。',
    detect(context) {
      const flanks = getFlankingMatch(context, context.soulPalace, '紫微', '天府');
      return flanks
        ? {
            palaces: [context.soulPalace, ...flanks],
            stars: ['紫微', '天府'],
            conditions: ['紫微与天府分居命宫相邻两宫'],
          }
        : null;
    },
  },
  {
    id: 'ji-yue-tong-liang',
    name: '机月同梁',
    kind: 'neutral',
    description: '命在寅或申，命宫三方四正齐见天机、太阴、天同、天梁。',
    source: `${VOL_THREE}·天机`,
    quote: '机月同梁作吏人，命在寅申方论，加吉不论，无吉无杀亦是平常人，凶杀空劫化忌为下格。',
    detect(context) {
      if (!['寅', '申'].includes(context.soulPalace.earthlyBranch)) return null;
      const required = ['天机', '太阴', '天同', '天梁'];
      const starPalaces = required.map((star) =>
        getSurroundedStarPalace(context, context.soulPalace, star),
      );
      return starPalaces.every((palace): palace is ZiweiPatternPalace => !!palace)
        ? {
            palaces: uniquePalaces([context.soulPalace, ...starPalaces]),
            stars: required,
            conditions: [
              `命宫在${context.soulPalace.earthlyBranch}宫`,
              '命宫三方四正齐见天机、太阴、天同、天梁',
            ],
          }
        : null;
    },
  },
  {
    id: 'fu-xiang-chao-yuan',
    name: '府相朝垣',
    kind: 'auspicious',
    description: '命在寅或申，财帛与官禄宫分别见天府、天相。',
    source: `${VOL_THREE}·天府`,
    quote: '府相朝垣千锺食禄，命寅申，府相在财帛宫，禄官朝者，上格别宫次之。',
    detect(context) {
      if (!['寅', '申'].includes(context.soulPalace.earthlyBranch)) return null;
      const wealth = getPalaceByName(context, '财帛');
      const career = getPalaceByName(context, '官禄');
      if (!wealth || !career) return null;
      const matched =
        (hasStar(wealth, '天府') && hasStar(career, '天相')) ||
        (hasStar(wealth, '天相') && hasStar(career, '天府'));
      return matched
        ? {
            palaces: [context.soulPalace, wealth, career],
            stars: ['天府', '天相'],
            conditions: [
              `命宫在${context.soulPalace.earthlyBranch}宫`,
              '天府、天相分别坐财帛宫与官禄宫',
            ],
          }
        : null;
    },
  },
  {
    id: 'kui-yue-jia-ming',
    name: '魁钺夹命',
    kind: 'auspicious',
    description: '天魁、天钺分居命宫相邻两宫。',
    source: `${VOL_THREE}·魁钺`,
    quote: '魁钺夹命为奇格，如命安在辰宫，魁在卯，钺在巳宫是也。',
    detect(context) {
      const flanks = getFlankingMatch(context, context.soulPalace, '天魁', '天钺');
      return flanks
        ? {
            palaces: [context.soulPalace, ...flanks],
            stars: ['天魁', '天钺'],
            conditions: ['天魁、天钺分居命宫相邻两宫'],
          }
        : null;
    },
  },
  {
    id: 'yu-xiu-tian-xiang',
    name: '玉袖天香',
    kind: 'auspicious',
    description: '文昌与文曲同守福德宫。',
    source: `${VOL_THREE}·文昌文曲`,
    quote: '昌曲吉星居福德谓之玉袖天香，更得紫微，居午宫妙。',
    detect(context) {
      const target = getPalaceByName(context, '福德');
      return target && hasAllStars(target, ['文昌', '文曲'])
        ? {
            palaces: [target],
            stars: ['文昌', '文曲', ...getMatchedStarNames(target, ['紫微'])],
            conditions: [
              '文昌与文曲同守福德宫',
              ...(hasStar(target, '紫微') ? ['福德宫同时见紫微加强条件'] : []),
            ],
          }
        : null;
    },
  },
  {
    id: 'chan-gong-zhe-gui',
    name: '蟾宫折桂',
    kind: 'auspicious',
    description: '太阴与文昌或文曲同守夫妻宫。',
    source: `${VOL_THREE}·太阴`,
    quote: '太阴同文曲于妻宫蟾宫折桂，文昌同亦然。',
    detect(context) {
      const target = getPalaceByName(context, '夫妻');
      const literaryStars = target ? getMatchedStarNames(target, ['文昌', '文曲']) : [];
      return target && hasStar(target, '太阴') && literaryStars.length > 0
        ? {
            palaces: [target],
            stars: ['太阴', ...literaryStars],
            conditions: [`太阴与${literaryStars.join('、')}同守夫妻宫`],
          }
        : null;
    },
  },
  {
    id: 'ri-yue-bing-ming',
    name: '日月并明',
    kind: 'auspicious',
    description: '太阳、太阴在命宫三方四正会照且均为庙或旺。',
    source: `${VOL_THREE}·太阳太阴拱照`,
    quote: '日月守命不如照合并明。',
    detect(context) {
      const surrounded = getSurroundedPalaces(context, context.soulPalace);
      const sunPalace = findStarPalace(surrounded, '太阳');
      const moonPalace = findStarPalace(surrounded, '太阴');
      return sunPalace &&
        moonPalace &&
        isTempleOrProsperous(getStar(sunPalace, '太阳')) &&
        isTempleOrProsperous(getStar(moonPalace, '太阴'))
        ? {
            palaces: uniquePalaces([context.soulPalace, sunPalace, moonPalace]),
            stars: ['太阳', '太阴'],
            conditions: ['太阳、太阴在命宫三方四正会照', '太阳与太阴亮度均为庙或旺'],
          }
        : null;
    },
  },
  {
    id: 'zuo-you-chao-yuan',
    name: '左右朝垣',
    kind: 'auspicious',
    description: '左辅、右弼分别从命宫三方来会。',
    source: `${VOL_ONE}·论左右朝垣格`,
    quote: '论左右朝垣格：天星左右最高明，若在三方禄位兴。',
    detect(context) {
      const surrounded = getSurroundedPalaces(context, context.soulPalace).filter(
        (palace) => palace.index !== context.soulPalace.index,
      );
      const left = findStarPalace(surrounded, '左辅');
      const right = findStarPalace(surrounded, '右弼');
      return left && right
        ? {
            palaces: uniquePalaces([context.soulPalace, left, right]),
            stars: ['左辅', '右弼'],
            conditions: ['左辅、右弼分别从命宫三方会照'],
          }
        : null;
    },
  },
  {
    id: 'wen-xing-chao-ming',
    name: '文星朝命',
    kind: 'auspicious',
    description: '文昌与文曲同守命宫。',
    source: `${VOL_ONE}·论文星朝命格`,
    quote: '文昌文曲最荣华，值此须生富贵家，更得三方祥曜拱，却如锦上又添花。',
    detect: ({ soulPalace }) =>
      hasAllStars(soulPalace, ['文昌', '文曲'])
        ? { palaces: [soulPalace], stars: ['文昌', '文曲'], conditions: ['文昌与文曲同守命宫'] }
        : null,
  },
  {
    id: 'dui-mian-chao-dou',
    name: '对面朝斗',
    kind: 'auspicious',
    description: '迁移宫位于子或午宫并见禄存。',
    source: `${VOL_ONE}·论对面朝斗格`,
    quote: '论对面朝斗格，子午宫逢禄存是也；禄有对面在迁移。',
    detect(context) {
      const target = getPalaceByName(context, '迁移');
      return target && ['子', '午'].includes(target.earthlyBranch) && hasStar(target, '禄存')
        ? {
            palaces: [context.soulPalace, target],
            stars: ['禄存'],
            conditions: [`禄存在${target.earthlyBranch}宫守迁移，对照命宫`],
          }
        : null;
    },
  },
  {
    id: 'ri-yue-jia-cai',
    name: '日月夹财',
    kind: 'auspicious',
    description: '武曲守命宫或财帛宫，太阳、太阴分居该宫相邻两宫。',
    source: `${VOL_ONE}·定富局`,
    quote: '日月夹财，武守命日月来夹是也，财帛宫亦然。',
    detect(context) {
      for (const targetName of ['命', '财帛']) {
        const target = getPalaceByName(context, targetName);
        if (!target || !hasStar(target, '武曲')) continue;
        const flanks = getFlankingMatch(context, target, '太阳', '太阴');
        if (flanks) {
          return {
            palaces: [target, ...flanks],
            stars: ['武曲', '太阳', '太阴'],
            conditions: [`武曲守${target.name}`, '太阳、太阴分居该宫相邻两宫'],
          };
        }
      }
      return null;
    },
  },
  {
    id: 'qi-sha-chao-dou',
    name: '七杀朝斗',
    kind: 'auspicious',
    description: '七杀在寅、申、子或午宫守命。',
    source: `${VOL_THREE}·七杀`,
    quote: '七杀寅申子午一生爵禄荣昌，为七杀朝斗格。',
    detect: ({ soulPalace }) =>
      ['寅', '申', '子', '午'].includes(soulPalace.earthlyBranch) && hasStar(soulPalace, '七杀')
        ? {
            palaces: [soulPalace],
            stars: ['七杀'],
            conditions: [`七杀在${soulPalace.earthlyBranch}宫守命`],
          }
        : null,
  },
  {
    id: 'tan-huo-xiang-feng',
    name: '贪火相逢',
    kind: 'auspicious',
    description: '贪狼与火星同守命宫，且两曜均为庙或旺。',
    source: `${VOL_ONE}·定贵局`,
    quote: '贪火相逢，谓二星守命同居庙旺是也。',
    detect: ({ soulPalace }) =>
      isTempleOrProsperous(getStar(soulPalace, '贪狼')) &&
      isTempleOrProsperous(getStar(soulPalace, '火星'))
        ? {
            palaces: [soulPalace],
            stars: ['贪狼', '火星'],
            conditions: ['贪狼与火星同守命宫', '贪狼、火星亮度均为庙或旺'],
          }
        : null,
  },
  {
    id: 'wu-qu-shou-yuan',
    name: '武曲守垣',
    kind: 'auspicious',
    description: '武曲在卯宫守命。',
    source: `${VOL_ONE}·定贵局`,
    quote: '武曲守垣，武守命卯宫是也，余不是。',
    detect: ({ soulPalace }) =>
      soulPalace.earthlyBranch === '卯' && hasStar(soulPalace, '武曲')
        ? { palaces: [soulPalace], stars: ['武曲'], conditions: ['武曲在卯宫守命'] }
        : null,
  },
  {
    id: 'quan-lu-sheng-feng',
    name: '权禄生逢',
    kind: 'auspicious',
    description: '生年化权、生年化禄同守命宫，且两颗化曜均为庙或旺。',
    source: `${VOL_ONE}·定贵局`,
    quote: '权禄生逢，二星守命庙旺是也，陷不是。',
    detect({ soulPalace }) {
      const huaQuan = getBirthMutagenStars(soulPalace, ['权']).find(isTempleOrProsperous);
      const huaLu = getBirthMutagenStars(soulPalace, ['禄']).find(isTempleOrProsperous);
      return huaQuan && huaLu
        ? {
            palaces: [soulPalace],
            stars: [`${huaQuan.name}化权`, `${huaLu.name}化禄`],
            conditions: ['生年化权、生年化禄同守命宫', '两颗化曜亮度均为庙或旺'],
          }
        : null;
    },
  },
  {
    id: 'xing-qiu-jia-yin',
    name: '刑囚夹印',
    kind: 'neutral',
    description: '天刑、廉贞同临命宫或身宫。',
    source: `${VOL_ONE}·定贵局`,
    quote: '刑囚夹印，天刑廉贞同临身命主武勇之人。',
    detect(context) {
      const target = getSoulAndBodyPalaces(context).find((palace) =>
        hasAllStars(palace, ['天刑', '廉贞']),
      );
      return target
        ? {
            palaces: [target],
            stars: ['天刑', '廉贞'],
            conditions: [
              `天刑、廉贞同临${target.index === context.soulPalace.index ? '命宫' : '身宫'}`,
            ],
          }
        : null;
    },
  },
  {
    id: 'xiong-su-chao-yuan',
    name: '雄宿朝元',
    kind: 'auspicious',
    description: '廉贞在申或未宫守命，命宫不见羊陀火铃。',
    source: `${VOL_THREE}·廉贞`,
    quote: '廉贞申未宫无杀富贵声扬播远名，雄宿朝元格，加杀平常。',
    detect: ({ soulPalace }) =>
      ['申', '未'].includes(soulPalace.earthlyBranch) &&
      hasStar(soulPalace, '廉贞') &&
      !hasAnyMalefic([soulPalace])
        ? {
            palaces: [soulPalace],
            stars: ['廉贞'],
            conditions: [`廉贞在${soulPalace.earthlyBranch}宫守命`, '命宫不见羊陀火铃'],
          }
        : null,
  },
  {
    id: 'po-jun-zi-wu',
    name: '破军子午',
    kind: 'auspicious',
    description: '破军在子或午宫守命，命宫不见羊陀火铃。',
    source: `${VOL_THREE}·破军`,
    quote: '破军子午宫无杀官资清显至三公。',
    detect: ({ soulPalace }) =>
      ['子', '午'].includes(soulPalace.earthlyBranch) &&
      hasStar(soulPalace, '破军') &&
      !hasAnyMalefic([soulPalace])
        ? {
            palaces: [soulPalace],
            stars: ['破军'],
            conditions: [`破军在${soulPalace.earthlyBranch}宫守命`, '命宫不见羊陀火铃'],
          }
        : null,
  },
  {
    id: 'sheng-bu-feng-shi',
    name: '生不逢时',
    kind: 'inauspicious',
    description: '廉贞守命，命宫同时坐空亡类星曜。',
    source: `${VOL_ONE}·定贫贱局`,
    quote: '生不逢时，命坐空亡逢廉贞是也。',
    detect({ soulPalace }) {
      const voidStars = getMatchedStarNames(soulPalace, VOID_STARS);
      return hasStar(soulPalace, '廉贞') && voidStars.length > 0
        ? {
            palaces: [soulPalace],
            stars: ['廉贞', ...voidStars],
            conditions: [`廉贞守命并同见${voidStars.join('、')}`],
          }
        : null;
    },
  },
  {
    id: 'lu-feng-liang-sha',
    name: '禄逢两杀',
    kind: 'inauspicious',
    description: '命宫三方四正内，禄存与空亡及地空或地劫同宫。',
    source: `${VOL_ONE}·定贫贱局`,
    quote: '禄逢两杀，禄坐空亡又逢空劫杀星是也。',
    detect(context) {
      const target = getSurroundedPalaces(context, context.soulPalace).find(
        (palace) =>
          hasStar(palace, '禄存') &&
          hasVoidStar(palace) &&
          getMatchedStarNames(palace, KONG_JIE_STARS).length > 0,
      );
      if (!target) return null;
      const voidStars = getMatchedStarNames(target, VOID_STARS);
      const kongJie = getMatchedStarNames(target, KONG_JIE_STARS);
      return {
        palaces: [target],
        stars: ['禄存', ...voidStars, ...kongJie],
        conditions: [`禄存与${voidStars.join('、')}及${kongJie.join('、')}同宫`],
      };
    },
  },
  {
    id: 'ma-luo-kong-wang',
    name: '马落空亡',
    kind: 'inauspicious',
    description: '命宫三方四正内，天马与空亡类星曜同宫。',
    source: `${VOL_ONE}·定贫贱局`,
    quote: '马落空亡，马既落亡虽禄冲会无用主奔波。',
    detect(context) {
      const target = getSurroundedPalaces(context, context.soulPalace).find(
        (palace) => hasStar(palace, '天马') && hasVoidStar(palace),
      );
      if (!target) return null;
      const voidStars = getMatchedStarNames(target, VOID_STARS);
      return {
        palaces: [target],
        stars: ['天马', ...voidStars],
        conditions: [`天马与${voidStars.join('、')}同宫`],
      };
    },
  },
  {
    id: 'ri-yue-cang-hui',
    name: '日月藏辉',
    kind: 'inauspicious',
    description: '太阳在戌、太阴在辰形成反背，并在命宫三方四正再见巨门。',
    source: `${VOL_ONE}·定贫贱局`,
    quote: '日月藏辉，日月反背又逢巨暗是也。',
    detect(context) {
      const surrounded = getSurroundedPalaces(context, context.soulPalace);
      const sun = surrounded.find(
        (palace) => palace.earthlyBranch === '戌' && hasStar(palace, '太阳'),
      );
      const moon = surrounded.find(
        (palace) => palace.earthlyBranch === '辰' && hasStar(palace, '太阴'),
      );
      const giant = findStarPalace(surrounded, '巨门');
      return sun && moon && giant
        ? {
            palaces: uniquePalaces([context.soulPalace, sun, moon, giant]),
            stars: ['太阳', '太阴', '巨门'],
            conditions: ['太阳在戌、太阴在辰形成反背', '命宫三方四正再见巨门'],
          }
        : null;
    },
  },
  {
    id: 'cai-yu-qiu-chou',
    name: '财与囚仇',
    kind: 'inauspicious',
    description: '武曲、廉贞分守命宫与身宫。',
    source: `${VOL_ONE}·定贫贱局`,
    quote: '财与囚仇，武贞同守身命是也。',
    detect(context) {
      const body = context.palaces.find((palace) => palace.isBodyPalace);
      if (!body || body.index === context.soulPalace.index) return null;
      const matched =
        (hasStar(context.soulPalace, '武曲') && hasStar(body, '廉贞')) ||
        (hasStar(context.soulPalace, '廉贞') && hasStar(body, '武曲'));
      return matched
        ? {
            palaces: [context.soulPalace, body],
            stars: ['武曲', '廉贞'],
            conditions: ['武曲、廉贞分守命宫与身宫'],
          }
        : null;
    },
  },
  {
    id: 'yi-sheng-gu-pin',
    name: '一生孤贫',
    kind: 'inauspicious',
    description: '破军以“陷”亮度守命。',
    source: `${VOL_ONE}·定贫贱局`,
    quote: '一生孤贫，谓破守命星陷地是也。',
    detect: ({ soulPalace }) =>
      getStar(soulPalace, '破军')?.brightness === '陷'
        ? { palaces: [soulPalace], stars: ['破军'], conditions: ['破军以“陷”亮度守命'] }
        : null,
  },
  {
    id: 'jun-zi-zai-ye',
    name: '君子在野',
    kind: 'inauspicious',
    description: '命宫或身宫有羊陀火铃之一以“陷”亮度坐守。',
    source: `${VOL_ONE}·定贫贱局`,
    quote: '君子在野，谓四杀守身命而言临陷地是也。',
    detect(context) {
      const isFallenMalefic = (star: ZiweiPatternStar) =>
        FOUR_MALEFICS.includes(star.name as (typeof FOUR_MALEFICS)[number]) &&
        star.brightness === '陷';
      const target = getSoulAndBodyPalaces(context).find((palace) =>
        natalStars(palace).some(isFallenMalefic),
      );
      if (!target) return null;
      const fallen = natalStars(target).filter(isFallenMalefic).map((star) => star.name);
      return {
        palaces: [target],
        stars: fallen,
        conditions: [`${fallen.join('、')}以“陷”亮度守${target.name}`],
      };
    },
  },
  {
    id: 'yang-tuo-jia-ji',
    name: '羊陀夹忌',
    kind: 'inauspicious',
    description: '生年化忌坐命，擎羊、陀罗分居命宫相邻两宫。',
    source: `${VOL_THREE}·擎羊`,
    quote: '羊陀夹忌为败局，假如安命在申宫，又逢忌星，羊在酉陀在未夹之。',
    detect(context) {
      const huaJi = getBirthMutagenStars(context.soulPalace, ['忌']);
      if (huaJi.length === 0) return null;
      const flanks = getFlankingMatch(context, context.soulPalace, '擎羊', '陀罗');
      return flanks
        ? {
            palaces: [context.soulPalace, ...flanks],
            stars: [...huaJi.map((star) => `${star.name}化忌`), '擎羊', '陀罗'],
            conditions: [
              `${huaJi.map((star) => `${star.name}生年化忌`).join('、')}坐命宫`,
              '擎羊、陀罗分居命宫相邻两宫',
            ],
          }
        : null;
    },
  },
  {
    id: 'huo-ling-jia-ming',
    name: '火铃夹命',
    kind: 'inauspicious',
    description: '火星、铃星分居命宫相邻两宫。',
    source: `${VOL_THREE}·火星铃星`,
    quote: '火铃夹命为败局，如命安寅申，火星在丑，铃星在卯。吉多尚可。',
    detect(context) {
      const flanks = getFlankingMatch(context, context.soulPalace, '火星', '铃星');
      return flanks
        ? {
            palaces: [context.soulPalace, ...flanks],
            stars: ['火星', '铃星'],
            conditions: ['火星、铃星分居命宫相邻两宫'],
          }
        : null;
    },
  },
  {
    id: 'kong-jie-jia-ming',
    name: '空劫夹命',
    kind: 'inauspicious',
    description: '地空、地劫分居命宫相邻两宫。',
    source: `${VOL_THREE}·劫空`,
    quote: '劫空夹命为败局。',
    detect(context) {
      const flanks = getFlankingMatch(context, context.soulPalace, '地空', '地劫');
      return flanks
        ? {
            palaces: [context.soulPalace, ...flanks],
            stars: ['地空', '地劫'],
            conditions: ['地空、地劫分居命宫相邻两宫'],
          }
        : null;
    },
  },
  {
    id: 'fan-shui-tao-hua',
    name: '泛水桃花',
    kind: 'neutral',
    description: '贪狼在亥或子宫守命，并同见擎羊或陀罗。',
    source: `${VOL_THREE}·贪狼`,
    quote: '贪遇羊陀居亥子名为泛水桃花，有吉曜则吉。',
    detect({ soulPalace }) {
      const malefics = getMatchedStarNames(soulPalace, ['擎羊', '陀罗']);
      return ['亥', '子'].includes(soulPalace.earthlyBranch) &&
        hasStar(soulPalace, '贪狼') &&
        malefics.length > 0
        ? {
            palaces: [soulPalace],
            stars: ['贪狼', ...malefics],
            conditions: [
              `贪狼在${soulPalace.earthlyBranch}宫守命`,
              `命宫同见${malefics.join('、')}`,
            ],
          }
        : null;
    },
  },
  {
    id: 'shui-cheng-gui-e',
    name: '水澄桂萼',
    kind: 'auspicious',
    description: '太阴在子宫守命。',
    source: `${VOL_ONE}·太微赋`,
    quote: '太阴居子，号曰水澄桂萼。',
    detect: ({ soulPalace }) =>
      soulPalace.earthlyBranch === '子' && hasStar(soulPalace, '太阴')
        ? { palaces: [soulPalace], stars: ['太阴'], conditions: ['太阴在子宫守命'] }
        : null,
  },
  {
    id: 'tian-liang-ju-wu',
    name: '天梁居午',
    kind: 'auspicious',
    description: '天梁在午宫守命。',
    source: `${VOL_THREE}·天梁`,
    quote: '天梁居午位官资清显朝堂。',
    detect: ({ soulPalace }) =>
      soulPalace.earthlyBranch === '午' && hasStar(soulPalace, '天梁')
        ? { palaces: [soulPalace], stars: ['天梁'], conditions: ['天梁在午宫守命'] }
        : null,
  },
  {
    id: 'liang-chang-miao-wang',
    name: '梁昌庙旺',
    kind: 'auspicious',
    description: '天梁、文昌同守命宫且均为庙或旺。',
    source: `${VOL_THREE}·天梁`,
    quote: '天梁文昌居庙旺位至台纲。',
    detect: ({ soulPalace }) =>
      isTempleOrProsperous(getStar(soulPalace, '天梁')) &&
      isTempleOrProsperous(getStar(soulPalace, '文昌'))
        ? {
            palaces: [soulPalace],
            stars: ['天梁', '文昌'],
            conditions: ['天梁、文昌同守命宫', '天梁、文昌亮度均为庙或旺'],
          }
        : null,
  },
  {
    id: 'yang-liang-chang-lu',
    name: '阳梁昌禄',
    kind: 'auspicious',
    description: '命宫三方四正齐见太阳、天梁、文昌、禄存。',
    source: `${VOL_THREE}·天梁`,
    quote: '天梁太阳昌禄会胪传第一名。',
    detect(context) {
      const required = ['太阳', '天梁', '文昌', '禄存'];
      const starPalaces = required.map((star) =>
        getSurroundedStarPalace(context, context.soulPalace, star),
      );
      return starPalaces.every((palace): palace is ZiweiPatternPalace => !!palace)
        ? {
            palaces: uniquePalaces([context.soulPalace, ...starPalaces]),
            stars: required,
            conditions: ['命宫三方四正齐见太阳、天梁、文昌、禄存'],
          }
        : null;
    },
  },
  {
    id: 'ju-ri-tong-gong',
    name: '巨日同宫',
    kind: 'auspicious',
    description: '巨门、太阳同守命宫。',
    source: `${VOL_ONE}·斗数骨髓赋`,
    quote: '巨日同宫官封三代。',
    detect: ({ soulPalace }) =>
      hasAllStars(soulPalace, ['巨门', '太阳'])
        ? { palaces: [soulPalace], stars: ['巨门', '太阳'], conditions: ['巨门、太阳同守命宫'] }
        : null,
  },
  {
    id: 'ju-huo-qing-yang',
    name: '巨火擎羊',
    kind: 'inauspicious',
    description: '巨门守命，命宫三方四正齐见火星、擎羊、陀罗。',
    source: `${VOL_THREE}·巨门`,
    quote: '巨火擎羊陀逢恶曜防缢死投河。',
    detect(context) {
      if (!hasStar(context.soulPalace, '巨门')) return null;
      const required = ['火星', '擎羊', '陀罗'];
      const starPalaces = required.map((star) =>
        getSurroundedStarPalace(context, context.soulPalace, star),
      );
      return starPalaces.every((palace): palace is ZiweiPatternPalace => !!palace)
        ? {
            palaces: uniquePalaces([context.soulPalace, ...starPalaces]),
            stars: ['巨门', ...required],
            conditions: ['巨门守命', '命宫三方四正齐见火星、擎羊、陀罗'],
          }
        : null;
    },
  },
  {
    id: 'wu-tan-tong-xing',
    name: '武贪同行',
    kind: 'neutral',
    description: '武曲、贪狼同守命宫。',
    source: `${VOL_ONE}·斗数骨髓赋`,
    quote: '贪武同行威镇边夷。',
    detect: ({ soulPalace }) =>
      hasAllStars(soulPalace, ['武曲', '贪狼'])
        ? { palaces: [soulPalace], stars: ['武曲', '贪狼'], conditions: ['武曲、贪狼同守命宫'] }
        : null,
  },
  {
    id: 'huo-gui',
    name: '火贵格',
    kind: 'auspicious',
    description: '贪狼、火星从命宫或身宫同一组三方会照，且该组三方不见羊陀铃。',
    source: `${VOL_ONE}·论火贵格`,
    quote: '论贪狼遇火名为火贵格，三合照身命是也；三方倘若无凶杀。',
    detect(context) {
      for (const target of getSoulAndBodyPalaces(context)) {
        const trines = getTrinePalaces(context, target);
        const greed = findStarPalace(trines, '贪狼');
        const fire = findStarPalace(trines, '火星');
        const forbidden = [target, ...trines].flatMap((palace) =>
          getMatchedStarNames(palace, ['擎羊', '陀罗', '铃星']),
        );
        if (greed && fire && forbidden.length === 0) {
          const label = target.index === context.soulPalace.index ? '命宫' : `身宫（${target.name}）`;
          return {
            palaces: uniquePalaces([target, greed, fire]),
            stars: ['贪狼', '火星'],
            conditions: [
              `贪狼、火星从${label}同一组三方会照`,
              `${label}三个会照宫位不见擎羊、陀罗、铃星`,
            ],
          };
        }
      }
      return null;
    },
  },
  {
    id: 'feng-liu-cai-zhang',
    name: '风流彩杖',
    kind: 'inauspicious',
    description: '贪狼、陀罗同守寅宫命宫。',
    source: `${VOL_THREE}·贪狼`,
    quote: '贪狼陀罗在寅宫号曰风流彩杖。',
    detect: ({ soulPalace }) =>
      soulPalace.earthlyBranch === '寅' && hasAllStars(soulPalace, ['贪狼', '陀罗'])
        ? { palaces: [soulPalace], stars: ['贪狼', '陀罗'], conditions: ['贪狼、陀罗同守寅宫命宫'] }
        : null,
  },
  {
    id: 'ju-ji-ju-mao',
    name: '巨机居卯',
    kind: 'auspicious',
    description: '巨门、天机同守卯宫命宫，生年天干为乙、辛、己或丙。',
    source: `${VOL_THREE}·巨门`,
    quote: '巨机居卯乙辛己丙至公卿，甲人平常。',
    canEvaluate: (context) => !!context.birthYearHeavenlyStem,
    detect: (context) =>
      context.soulPalace.earthlyBranch === '卯' &&
      hasAllStars(context.soulPalace, ['巨门', '天机']) &&
      !!context.birthYearHeavenlyStem &&
      ['乙', '辛', '己', '丙'].includes(context.birthYearHeavenlyStem)
        ? {
            palaces: [context.soulPalace],
            stars: ['巨门', '天机'],
            conditions: ['巨门、天机同守卯宫命宫', `生年天干为${context.birthYearHeavenlyStem}`],
          }
        : null,
  },
];

export const ZIWEI_VERIFIED_PATTERN_RULE_COUNT = VERIFIED_PATTERN_RULES.length;

function assertValidPalaces(palaces: readonly ZiweiPatternPalace[]) {
  if (!Array.isArray(palaces) || palaces.length !== PALACE_COUNT) {
    throw new Error('紫微格局检测需要完整 12 宫数据。');
  }
  const seen = new Set<number>();
  let soulCount = 0;
  for (const palace of palaces) {
    if (!Number.isInteger(palace?.index) || palace.index < 0 || palace.index >= PALACE_COUNT || seen.has(palace.index)) {
      throw new Error('紫微格局检测宫位索引无效或重复。');
    }
    seen.add(palace.index);
    if (normalizePalaceName(palace.name) === '命') soulCount += 1;
  }
  if (soulCount !== 1) {
    throw new Error('紫微格局检测必须且只能包含一个命宫。');
  }
}

/**
 * 检测本命十二宫命中的已校勘紫微格局。
 */
export function detectZiweiPatterns(
  palaces: readonly ZiweiPatternPalace[],
  birthYearHeavenlyStem?: string,
): ZiweiPattern[] {
  assertValidPalaces(palaces);
  const soulPalace = palaces.find((palace) => normalizePalaceName(palace.name) === '命')!;
  const context: PatternContext = {
    palaces,
    palaceByIndex: new Map(palaces.map((palace) => [palace.index, palace])),
    soulPalace,
    birthYearHeavenlyStem,
  };
  return VERIFIED_PATTERN_RULES.flatMap((rule): ZiweiPattern[] => {
    if (rule.canEvaluate && !rule.canEvaluate(context)) return [];
    const match = rule.detect(context);
    if (!match) return [];
    return [
      {
        id: rule.id,
        name: rule.name,
        kind: rule.kind,
        description: rule.description,
        palaces: uniquePalaces(match.palaces).map((palace) => palace.name),
        stars: [...new Set(match.stars)],
        conditions: match.conditions,
        source: rule.source,
        quote: rule.quote,
      },
    ];
  });
}

const kindLabels: Record<ZiweiPatternKind, string> = {
  auspicious: '吉格',
  inauspicious: '凶格',
  neutral: '中性',
};

/**
 * 将本命格局列表格式化为简洁的提示词文本。
 */
export function formatZiweiPatterns(patterns: readonly ZiweiPattern[]): string {
  if (patterns.length === 0) {
    return '未命中已登记本命格局（仅评估已校勘可复算规则，未命中不代表无其他传统格局）。';
  }
  return patterns
    .map(
      (pattern) =>
        `${pattern.name}（${kindLabels[pattern.kind]}）：${pattern.conditions.join('；')}［${pattern.palaces.join('、')}］`,
    )
    .join('\n');
}

export interface ZiweiPatternDamagedItem {
  patternId: string;
  patternName: string;
  status: '成中有破';
  breakers: string[];
}

export interface ZiweiPatternRescueItem {
  targetName: string;
  sourceKind: '凶格' | '落陷格';
  status: '有救可转' | '略有缓解（救应偏弱）' | '原局无明救';
  rescues: string[];
}

export interface ZiweiPatternRelations {
  synergies: string[];
  damagedAuspicious: ZiweiPatternDamagedItem[];
  inauspiciousRescues: ZiweiPatternRescueItem[];
}

const FIRE_GREED_IDS = new Set(['tan-huo-xiang-feng', 'huo-gui']);
const BREAKING_STARS = ['地空', '地劫', '擎羊', '陀罗', '火星', '铃星'] as const;
const RESCUE_AUX_STARS = ['禄存', '左辅', '右弼', '天魁', '天钺'] as const;

function collectPalaceMutagens(palace: ZiweiPatternPalace, mutagens: readonly string[]): string[] {
  return getBirthMutagenStars(palace, mutagens).map(
    (star) => `${palace.name}${star.name}化${star.mutagen}`,
  );
}

function collectSurroundedItems(
  palaces: readonly ZiweiPatternPalace[],
  starNames: readonly string[],
): string[] {
  const out: string[] = [];
  for (const palace of palaces) {
    for (const name of starNames) {
      if (hasStar(palace, name)) out.push(`${palace.name}${name}`);
    }
  }
  return out;
}

/**
 * 基于本命十二宫与实际命中格局，客观计算格局叠合、成中有破与凶格救应链。
 */
export function analyzeZiweiPatternRelations(
  palaces: readonly ZiweiPatternPalace[],
  patterns: readonly ZiweiPattern[],
): ZiweiPatternRelations {
  assertValidPalaces(palaces);
  const soulPalace = palaces.find((palace) => normalizePalaceName(palace.name) === '命')!;
  const context: PatternContext = {
    palaces,
    palaceByIndex: new Map(palaces.map((palace) => [palace.index, palace])),
    soulPalace,
  };
  const palaceByNormName = new Map(
    palaces.map((palace) => [normalizePalaceName(palace.name), palace]),
  );
  const surrounded = getSurroundedPalaces(context, soulPalace);
  const auspicious = patterns.filter((item) => item.kind === 'auspicious');
  const inauspicious = patterns.filter((item) => item.kind === 'inauspicious');

  // 1. 吉格叠加协同
  const synergies: string[] = [];
  if (auspicious.length >= 2) {
    synergies.push(`多吉格并见：${auspicious.map((item) => item.name).join(' + ')}`);
  }

  const luCunItems = collectSurroundedItems(surrounded, ['禄存']);
  const huaLuItems = surrounded.flatMap((palace) => collectPalaceMutagens(palace, ['禄']));
  const huaQuanItems = surrounded.flatMap((palace) => collectPalaceMutagens(palace, ['权']));
  const huaKeItems = surrounded.flatMap((palace) => collectPalaceMutagens(palace, ['科']));
  const fuBiItems = collectSurroundedItems(surrounded, ['左辅', '右弼']);
  const changQuItems = collectSurroundedItems(surrounded, ['文昌', '文曲']);
  const kuiYueItems = collectSurroundedItems(surrounded, ['天魁', '天钺']);

  const boosterTags: string[] = [];
  if (luCunItems.length > 0 && huaLuItems.length > 0) {
    boosterTags.push(`双禄会照（${[...luCunItems, ...huaLuItems].join('、')}）`);
  }
  if (
    findStarPalace(surrounded, '左辅') &&
    findStarPalace(surrounded, '右弼')
  ) {
    boosterTags.push(`辅弼齐会（${fuBiItems.join('、')}）`);
  }
  if (
    findStarPalace(surrounded, '文昌') &&
    findStarPalace(surrounded, '文曲')
  ) {
    boosterTags.push(`昌曲齐会（${changQuItems.join('、')}）`);
  }
  if (
    findStarPalace(surrounded, '天魁') &&
    findStarPalace(surrounded, '天钺')
  ) {
    boosterTags.push(`魁钺齐会（${kuiYueItems.join('、')}）`);
  }
  const sanQiItems = [...huaLuItems, ...huaQuanItems, ...huaKeItems];
  const sanQiKinds = [huaLuItems.length > 0, huaQuanItems.length > 0, huaKeItems.length > 0].filter(Boolean).length;
  if (sanQiKinds === 3) {
    boosterTags.push(`三奇加会（${sanQiItems.join('、')}）`);
  } else if (sanQiKinds === 2) {
    boosterTags.push(`双吉化会照（${sanQiItems.join('、')}）`);
  }

  const hasShaPoLang =
    !!findStarPalace(surrounded, '七杀') &&
    !!findStarPalace(surrounded, '破军') &&
    !!findStarPalace(surrounded, '贪狼');
  const fireGreedPatterns = patterns.filter((item) => FIRE_GREED_IDS.has(item.id));
  const coreBoostForAggressive = [...luCunItems, ...huaLuItems, ...huaQuanItems, ...fuBiItems];

  if (fireGreedPatterns.length > 0 && coreBoostForAggressive.length > 0) {
    synergies.push(
      `${fireGreedPatterns.map((item) => item.name).join('、')}叠见${coreBoostForAggressive.join('、')}，爆发力与承接力协同增强`,
    );
  }
  if (hasShaPoLang && coreBoostForAggressive.length > 0) {
    synergies.push(
      `命宫三方四正成杀破狼架构并叠见${coreBoostForAggressive.join('、')}，动局得禄权辅弼增力`,
    );
  }
  if (auspicious.length > 0 && boosterTags.length > 0) {
    synergies.push(`命宫三方四正协同增力：${boosterTags.join('；')}`);
  }

  // 2. 吉格受破警示（成中有破）
  const damagedAuspicious: ZiweiPatternDamagedItem[] = [];
  const flankChecks: Array<{ stars: [string, string]; label: string }> = [
    { stars: ['地空', '地劫'], label: '空劫夹命' },
    { stars: ['擎羊', '陀罗'], label: '羊陀夹命' },
    { stars: ['火星', '铃星'], label: '火铃夹命' },
  ];
  const soulFlankBreakers: string[] = [];
  for (const check of flankChecks) {
    const flanks = getFlankingMatch(context, soulPalace, check.stars[0], check.stars[1]);
    if (flanks) {
      soulFlankBreakers.push(
        `邻宫${check.label}（${flanks.map((p) => p.name).join('、')}）`,
      );
    }
  }

  for (const pattern of auspicious) {
    const patternPalaces = uniquePalaces(
      pattern.palaces
        .map((name) => palaceByNormName.get(normalizePalaceName(name)))
        .filter((palace): palace is ZiweiPatternPalace => !!palace),
    );
    const excludeFire = FIRE_GREED_IDS.has(pattern.id);
    const breakers: string[] = [];

    for (const palace of patternPalaces) {
      const malefics = getMatchedStarNames(palace, BREAKING_STARS).filter(
        (name) => !(excludeFire && name === '火星'),
      );
      const jiStars = getBirthMutagenStars(palace, ['忌']).map((s) => `${s.name}化忌`);
      const items = [...malefics, ...jiStars];
      if (items.length > 0) {
        breakers.push(`${palace.name}同宫见${items.join('、')}`);
      }
    }

    const involvesSoul = patternPalaces.some((palace) => palace.index === soulPalace.index);
    if (involvesSoul && soulFlankBreakers.length > 0) {
      breakers.push(...soulFlankBreakers);
    }

    if (breakers.length > 0) {
      damagedAuspicious.push({
        patternId: pattern.id,
        patternName: pattern.name,
        status: '成中有破',
        breakers: [...new Set(breakers)],
      });
    }
  }

  // 3. 凶格/落陷格救应链
  const rescueCandidates = [
    ...huaLuItems,
    ...huaQuanItems,
    ...huaKeItems,
    ...collectSurroundedItems(surrounded, RESCUE_AUX_STARS),
  ];
  const hasGoodMutagen = huaLuItems.length > 0 || huaQuanItems.length > 0 || huaKeItems.length > 0;
  const rescueStatus: ZiweiPatternRescueItem['status'] =
    rescueCandidates.length === 0
      ? '原局无明救'
      : rescueCandidates.length >= 2 && (hasGoodMutagen || fuBiItems.length >= 2 || luCunItems.length > 0)
        ? '有救可转'
        : rescueCandidates.length >= 2
          ? '有救可转'
          : '略有缓解（救应偏弱）';

  const inauspiciousRescues: ZiweiPatternRescueItem[] = [];
  for (const pattern of inauspicious) {
    inauspiciousRescues.push({
      targetName: pattern.name,
      sourceKind: '凶格',
      status: rescueStatus,
      rescues: rescueCandidates,
    });
  }

  // 补充核查：日月反背（未已被日月藏辉覆盖时）及命宫主星落陷
  const hasSunMoonReversePattern = inauspicious.some((item) => item.id === 'ri-yue-cang-hui');
  const sunInXu = surrounded.find((p) => p.earthlyBranch === '戌' && hasStar(p, '太阳'));
  const moonInChen = surrounded.find((p) => p.earthlyBranch === '辰' && hasStar(p, '太阴'));
  if (!hasSunMoonReversePattern && sunInXu && moonInChen) {
    inauspiciousRescues.push({
      targetName: '日月反背（太阳在戌、太阴在辰）',
      sourceKind: '落陷格',
      status: rescueStatus,
      rescues: rescueCandidates,
    });
  }

  const fallenSoulMajors = soulPalace.majorStars
    .filter((star) => star.brightness === '陷')
    .map((star) => star.name);
  if (fallenSoulMajors.length > 0) {
    inauspiciousRescues.push({
      targetName: `命宫主星落陷（${fallenSoulMajors.join('、')}）`,
      sourceKind: '落陷格',
      status: rescueStatus,
      rescues: rescueCandidates,
    });
  }

  return {
    synergies,
    damagedAuspicious,
    inauspiciousRescues,
  };
}

/**
 * 将紫微格局叠合与成败制衡关系格式化为客观结构化提示词区块。
 */
export function formatZiweiPatternRelations(
  palaces: readonly ZiweiPatternPalace[],
  patterns: readonly ZiweiPattern[],
): string {
  const relations = analyzeZiweiPatternRelations(palaces, patterns);
  const lines: string[] = [];

  if (relations.synergies.length > 0) {
    lines.push(`吉格叠加协同：${relations.synergies.join('；')}。`);
  } else {
    lines.push('吉格叠加协同：原局未见多吉格并见或三方四正双禄/辅弼/三奇叠合增力。');
  }

  if (relations.damagedAuspicious.length > 0) {
    const items = relations.damagedAuspicious.map(
      (item) => `${item.patternName}［${item.status}：${item.breakers.join('，')}］`,
    );
    lines.push(`吉格受破警示：${items.join('；')}。`);
  } else if (patterns.some((item) => item.kind === 'auspicious')) {
    lines.push('吉格受破警示：已命中吉格未见同宫煞忌空劫或命宫煞夹破格。');
  }

  if (relations.inauspiciousRescues.length > 0) {
    const items = relations.inauspiciousRescues.map((item) =>
      item.rescues.length > 0
        ? `${item.targetName}（${item.sourceKind}）→ ${item.status}［三方四正见${item.rescues.join('、')}］`
        : `${item.targetName}（${item.sourceKind}）→ ${item.status}［三方四正未见化禄/权/科、禄存及辅弼魁钺］`,
    );
    lines.push(`凶格/落陷格救应链：${items.join('；')}。`);
  } else {
    lines.push('凶格/落陷格救应链：未命中凶格，且命宫主星无落陷。');
  }

  return lines.join('\n');
}
