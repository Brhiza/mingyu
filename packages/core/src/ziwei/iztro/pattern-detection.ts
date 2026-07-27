/**
 * @file 紫微斗数格局检测与证据边界
 * @description 只执行已登记古籍版本、卷次、原文和可复算条件的格局规则。
 */

import type {
  PalaceFact,
  PatternFact,
  StarFact,
  ZiweiPatternAnalysis,
  ZiweiPatternCalculationStep,
  ZiweiPatternCounterEvidenceFact,
  ZiweiPatternLimitationFact,
  ZiweiPatternSummaryFact,
} from '../../types/analysis';

const ZIWEI_PALACE_COUNT = 12;
const RETIRED_UNVERIFIED_PATTERN_COUNT = 84;
const PATTERN_RULE_STEP_KEY = 'ziwei:pattern:calculation:rule-evaluation';
const PATTERN_MATCHED_FACTS_STEP_KEY = 'ziwei:pattern:calculation:matched-facts';
const VOLUME_ONE_URL =
  'https://zh.wikisource.org/w/index.php?title=紫微斗數全書/卷一&oldid=2665454';
const VOLUME_THREE_URL =
  'https://zh.wikisource.org/w/index.php?title=紫微斗數全書/卷三&oldid=2268626';

export const ZIWEI_TRADITIONAL_PATTERN_BOUNDARIES = [
  {
    name: '禄马佩印',
    source: `${VOLUME_ONE_URL}（卷一·定贵局）`,
    quote: '禄马佩印，马前有禄印星同宫是也。',
    reason: '固定版本没有明确“印星”所指星曜，也没有定义“马前”的宫位方向，不能唯一复算。',
  },
  {
    name: '紫府朝垣',
    source: `${VOLUME_ONE_URL}（卷一·定贵局）`,
    quote: '紫府朝垣，见前批注。',
    reason: '同一版本没有给出独立于紫府同宫、紫府夹命的唯一条件，不能重复造一条同义规则。',
  },
  {
    name: '明珠出海',
    source: `${VOLUME_ONE_URL}（卷一·定贵局）`,
    quote: '明珠出海，见前批注。',
    reason: '固定版本只保留名称和“见前批注”，没有明确主星、宫位与生旺条件。',
  },
  {
    name: '日月同临',
    source: `${VOLUME_ONE_URL}（卷一·定贵局）`,
    quote: '日月同临，见前批注。',
    reason: '固定版本没有说明同临命、身或其他宫位，也没有给出庙旺和吉煞必要条件。',
  },
  {
    name: '文星暗拱',
    source: `${VOLUME_ONE_URL}（卷一·定贵局）`,
    quote: '文星暗拱，见前批注。',
    reason: '固定版本没有定义文星范围及“暗拱”采用六合、三方还是相邻宫，不能唯一复算。',
  },
  {
    name: '明禄暗禄',
    source: `${VOLUME_ONE_URL}（卷一·定贵局）`,
    quote: '明禄暗禄，见前批注。',
    reason: '固定版本没有定义“暗禄”的宫位关系，不能直接采用后世流派的六合解释。',
  },
  {
    name: '科明暗禄',
    source: `${VOLUME_ONE_URL}（卷一·定贵局）`,
    quote: '科明暗禄，见前批注。',
    reason: '固定版本没有给出化科、明禄、暗禄的具体落宫与会照关系。',
  },
  {
    name: '科权禄主',
    source: `${VOLUME_ONE_URL}（卷一·论科权禄主格）`,
    quote: '禄权周勃命中逢，迎合权星兼吉曜。',
    reason: '标题含科权禄，正文只明确禄权与吉曜，没有说明化科的必要位置，条件不闭合。',
  },
  {
    name: '财荫夹印',
    source: `${VOLUME_ONE_URL}（卷一·定富局）`,
    quote: '财荫夹印，相守命武梁来夹是也，田宅宫亦然。',
    reason:
      '若逐字取天相守中宫、武曲天梁分夹，则与十四主星固定排布矛盾；若把“财”改释为化禄，又超出该版本原文，故不伪造规则。',
  },
  {
    name: '昌曲夹命',
    source: `${VOLUME_THREE_URL}（卷三·文昌文曲）`,
    quote: '昌曲夹命最为奇，假若命在丑宫，文昌在寅，文曲在子是也。不贵即富，吉多方论此为贵。',
    reason:
      '固定版本没有定义“吉多”的吉曜范围、取用宫位和比较阈值，不能用项目自定星表代替原典条件。',
  },
  {
    name: '日月夹命',
    source: `${VOLUME_ONE_URL}（卷一·定贵局）`,
    quote: '日月夹命，不坐空亡遇逢本宫有吉星是也。',
    reason: '固定版本没有定义“吉星”的完整星曜范围，不能用项目自定星表决定是否命中。',
  },
  {
    name: '羊刃入庙',
    source: `${VOLUME_ONE_URL}（卷一·定贵局）`,
    quote: '羊刃入庙，辰戍丑未守命遇吉是也。',
    reason: '固定版本没有定义“遇吉”所指星曜与会照范围，条件不能唯一复算。',
  },
  {
    name: '左辅文昌',
    source: `${VOLUME_ONE_URL}（卷一·斗数骨髓赋）`,
    quote: '左辅文昌会吉星尊居八座。',
    reason:
      '固定版本没有定义“会吉星”的星曜范围和宫位关系，卷三又仅写“左辅文昌位至三台”，两处口径不能唯一合并。',
  },
  {
    name: '贪铃并守',
    source: `${VOLUME_THREE_URL}（卷三·贪狼）`,
    quote: '贪狼遇铃火四墓宫豪富家资侯伯贵，辰戌宫佳，丑未宫次之，若守照俱可论吉。',
    reason:
      '原文同时包含铃星、火星以及守、照两种关系，现有名称不足以唯一确定哪些分支属于必要条件。',
  },
  {
    name: '廉杀巳亥',
    source: `${VOLUME_THREE_URL}（卷三·廉贞）`,
    quote: '廉贞七杀居巳亥流荡天涯。',
    reason:
      '当前固定安星体系中廉贞、七杀只会同宫于丑、未，不可能同守巳、亥；原文与当前排盘体系冲突。',
  },
  {
    name: '日月反背',
    source: `${VOLUME_THREE_URL}（卷三·太阳太阴拱照）`,
    quote: '若反背日戌月辰，子月午。若出外离宗成家也吉。勿概以反背论。',
    reason: '“日戌月辰，子月午”标点与主语残缺，无法唯一判断子、午两宫分别对应太阳还是太阴。',
  },
  {
    name: '日照雷门',
    source: `${VOLUME_THREE_URL}（卷三·太阳）`,
    quote: '日照雷门子辰卯地昼生富贵声扬。',
    reason: '“子辰卯地”的断句与“子”字含义不明，不能静默省略子宫后只执行卯、辰两宫。',
  },
  {
    name: '金舆扶驾',
    source: `${VOLUME_ONE_URL}（卷一·定富贵局）`,
    quote: '金舆扶驾，紫微守命前后有日月来夹是也。',
    reason:
      '当前固定安星体系中太阳与紫微始终相隔三宫，不可能与太阴分居紫微相邻两宫；原文与当前排盘体系冲突。',
  },
  {
    name: '科权禄拱命',
    source: `${VOLUME_THREE_URL}（卷三·紫微）`,
    quote: '紫微居子午科权禄照最为奇，科权禄三方照是也。',
    reason:
      '按当前固定的十干四化和主辅星排布逐项枚举，紫微守子、午命宫时不存在禄、权、科齐从命宫以外三方会照的本命盘；不能伪造命中样本。',
  },
  {
    name: '荫印拱身',
    source: `${VOLUME_ONE_URL}（卷一·定富局）`,
    quote: '荫印拱身，身临田宅梁相拱冲是也，勿坐空亡。',
    reason:
      '当前固定安命身宫公式中，身宫相对命宫只会落在偶数间隔的宫位，不可能落在相隔三宫的田宅宫；“身临田宅”与当前排盘体系冲突。',
  },
  {
    name: '财印夹禄',
    source: `${VOLUME_ONE_URL}（卷一·定贵局）`,
    quote: '财印夹禄，禄守命梁相来夹是也，入财亦然。',
    reason:
      '当前固定主星排布中天相、天梁始终相邻，不可能分居任一宫位的前后两宫；原文的“夹”不能按当前相邻夹宫口径复算。',
  },
  {
    name: '马头带剑',
    source: `${VOLUME_ONE_URL}（卷一·定贵局）`,
    quote: '马头带剑，谓马有刃是也，不是居午格。',
    reason:
      '按当前以生年干安擎羊、以生年支安天马的规则遍历六十甲子，两星不会同宫；原文“马有刃”不能直接等同为本命天马与擎羊同守。',
  },
  {
    name: '紫禄同宫',
    source: `${VOLUME_THREE_URL}（卷三·紫微）`,
    quote: '紫禄同宫日月照贵不可言，紫微禄存同宫，日月三合拱照。',
    reason:
      '当前固定主星排布中太阳与紫微始终相隔三宫，太阳不会落入紫微的三方四正；即使紫微、禄存同宫也不能满足原文所述日月三合。',
  },
  {
    name: '廉杀庙旺',
    source: `${VOLUME_THREE_URL}（卷三·廉贞）`,
    quote: '廉贞七杀居庙旺反为积富之人。',
    reason:
      '当前固定主星排布中廉贞、七杀只会同宫于丑、未，而当前亮度表把两宫的廉贞都标为“利”而非“庙”或“旺”；不能擅自把“利”改作原文的庙旺。',
  },
  ...[
    '风云际会',
    '锦上添花',
    '禄衰马困',
    '衣锦还乡',
    '步数无依',
    '水上驾星',
    '吉凶相伴',
    '枯木逢春',
  ].map((name) => ({
    name,
    source: `${VOLUME_ONE_URL}（卷一·定杂局）`,
    quote: `定杂局所列“${name}”运限条目。`,
    reason: '该条目以大限、流年或前后限变化为必要条件，不属于当前本命十二宫格局检测范围。',
  })),
] as const;

const PATTERN_CALCULATION_LIMITATION =
  '紫微格局计算步骤只证明登记规则如何核对当前十二宫、星曜、亮度、四化与宫位关系；不得把命中数量解释为命盘分数、现实概率或必然事件' as const;
const PATTERN_COUNTER_LIMITATION =
  '紫微格局反证只记录十二宫资料、登记规则与未命中数量的覆盖状态；未命中不等于没有其他传统格局，也不证明现实有利或不利' as const;
const PATTERN_SUMMARY_LIMITATION =
  '紫微格局汇总只统计当前登记规则的评估覆盖和命中分类；不得按吉格、凶格、中性格或命中数量生成综合吉凶、权重、概率与固定应期' as const;
const PATTERN_FACT_LIMITATION =
  '紫微格局限制事实用于约束规则命中可以支持的解释范围，不得被反向当作现实因果、人物命运、吉凶概率或保证有效建议的证据' as const;

type PatternContext = {
  palaces: PalaceFact[];
  palaceByIndex: Map<number, PalaceFact>;
  soulPalace: PalaceFact;
  birthYearHeavenlyStem?: string;
};

const TEMPLE_OR_PROSPEROUS_BRIGHTNESS = new Set(['庙', '旺']);
const FOUR_MALEFICS = ['擎羊', '陀罗', '火星', '铃星'] as const;
const VOID_STARS = ['空亡', '旬空', '天空', '截空', '截路', '截路空亡'] as const;
const KONG_JIE_STARS = ['地空', '地劫'] as const;
type PatternMatch = {
  palaces: PalaceFact[];
  stars: string[];
  conditions: string[];
};

type VerifiedPatternRule = {
  id: string;
  name: string;
  kind: PatternFact['kind'];
  description: string;
  traditionalInterpretation: string;
  sourceTitle: string;
  sourceUrl: string;
  sourceQuote: string;
  calculation: string;
  canEvaluate?: (context: PatternContext) => boolean;
  detect: (context: PatternContext) => PatternMatch | null;
};

function normalizePalaceName(name: string) {
  return name.endsWith('宫') ? name.slice(0, -1) : name;
}

function natalStars(palace: PalaceFact): StarFact[] {
  return [...palace.major_stars, ...palace.minor_stars, ...palace.other_stars];
}

function hasStar(palace: PalaceFact, name: string): boolean {
  return natalStars(palace).some((star) => star.name === name);
}

function hasAllStars(palace: PalaceFact, names: string[]): boolean {
  return names.every((name) => hasStar(palace, name));
}

function getStar(palace: PalaceFact, name: string): StarFact | undefined {
  return natalStars(palace).find((star) => star.name === name);
}

function getMatchedStarNames(palace: PalaceFact, names: readonly string[]): string[] {
  return names.filter((name) => hasStar(palace, name));
}

function getBirthMutagenStars(palace: PalaceFact, mutagens: readonly string[]): StarFact[] {
  return natalStars(palace).filter(
    (star) => !!star.birth_mutagen && mutagens.includes(star.birth_mutagen),
  );
}

function isTempleOrProsperous(star?: StarFact): boolean {
  return !!star?.brightness && TEMPLE_OR_PROSPEROUS_BRIGHTNESS.has(star.brightness);
}

function hasVoidStar(palace: PalaceFact): boolean {
  return getMatchedStarNames(palace, VOID_STARS).length > 0;
}

function hasAnyMalefic(palaces: PalaceFact[]): boolean {
  return palaces.some((palace) => getMatchedStarNames(palace, FOUR_MALEFICS).length > 0);
}

function getSoulAndBodyPalaces(context: PatternContext): PalaceFact[] {
  return uniquePalaces([
    context.soulPalace,
    ...context.palaces.filter((palace) => palace.is_body_palace),
  ]);
}

function uniquePalaces(palaces: PalaceFact[]): PalaceFact[] {
  return [...new Map(palaces.map((palace) => [palace.index, palace])).values()];
}

function getNeighborPalaces(context: PatternContext, palace: PalaceFact): PalaceFact[] {
  return [
    context.palaceByIndex.get((palace.index + ZIWEI_PALACE_COUNT - 1) % ZIWEI_PALACE_COUNT),
    context.palaceByIndex.get((palace.index + 1) % ZIWEI_PALACE_COUNT),
  ].filter((item): item is PalaceFact => !!item);
}

function getSurroundedPalaces(context: PatternContext, palace: PalaceFact): PalaceFact[] {
  return palace.surrounded_palace_indexes
    .map((index) => context.palaceByIndex.get(index))
    .filter((item): item is PalaceFact => !!item);
}

function getSurroundedStarPalace(
  context: PatternContext,
  palace: PalaceFact,
  starName: string,
): PalaceFact | undefined {
  return findStarPalace(getSurroundedPalaces(context, palace), starName);
}

function getFlankingMatch(
  context: PatternContext,
  palace: PalaceFact,
  firstStar: string,
  secondStar: string,
): PalaceFact[] | null {
  const neighbors = getNeighborPalaces(context, palace);
  if (neighbors.length !== 2) return null;
  const matched =
    (hasStar(neighbors[0], firstStar) && hasStar(neighbors[1], secondStar)) ||
    (hasStar(neighbors[0], secondStar) && hasStar(neighbors[1], firstStar));
  return matched ? neighbors : null;
}

function findStarPalace(palaces: PalaceFact[], starName: string): PalaceFact | undefined {
  return palaces.find((palace) => hasStar(palace, starName));
}

function getPalaceByName(context: PatternContext, name: string): PalaceFact | undefined {
  const normalizedName = normalizePalaceName(name);
  return context.palaces.find((palace) => normalizePalaceName(palace.name) === normalizedName);
}

function hasSingleMajorStar(palace: PalaceFact, name: string): boolean {
  return palace.major_stars.length === 1 && palace.major_stars[0]?.name === name;
}

const VERIFIED_PATTERN_RULES: VerifiedPatternRule[] = [
  {
    id: 'ziwei-tianfu-tonggong',
    name: '紫府同宫',
    kind: 'auspicious',
    description: '紫微与天府同坐命宫。',
    traditionalInterpretation: '《紫微斗数全书》把此组合列为传统富贵格，但仍须合看吉煞与庙旺。',
    sourceTitle: '《紫微斗数全书》卷一·太微赋',
    sourceUrl: VOLUME_ONE_URL,
    sourceQuote: '紫府同宫终身福厚。',
    calculation: '检查本命命宫的原局星曜是否同时包含紫微与天府。',
    detect({ soulPalace }) {
      return hasAllStars(soulPalace, ['紫微', '天府'])
        ? {
            palaces: [soulPalace],
            stars: ['紫微', '天府'],
            conditions: ['紫微与天府同坐命宫'],
          }
        : null;
    },
  },
  {
    id: 'fu-bi-gong-zhu',
    name: '辅弼拱主',
    kind: 'auspicious',
    description: '紫微守命，左辅、右弼从三方四正拱照或前后夹命。',
    traditionalInterpretation: '古籍以辅弼拱夹紫微为传统助力结构。',
    sourceTitle: '《紫微斗数全书》卷一·定富贵局',
    sourceUrl: VOLUME_ONE_URL,
    sourceQuote: '辅弼拱主，紫微守命二星来拱是也，夹之亦然。',
    calculation: '先检查紫微守命，再在命宫三方四正与相邻两宫寻找左辅、右弼。',
    detect(context) {
      const { soulPalace } = context;
      if (!hasStar(soulPalace, '紫微')) return null;

      const neighbors = getNeighborPalaces(context, soulPalace);
      if (
        neighbors.length === 2 &&
        ((hasStar(neighbors[0], '左辅') && hasStar(neighbors[1], '右弼')) ||
          (hasStar(neighbors[0], '右弼') && hasStar(neighbors[1], '左辅')))
      ) {
        return {
          palaces: [soulPalace, ...neighbors],
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
    traditionalInterpretation: '古籍把紫微与左右同守命宫列为君臣庆会。',
    sourceTitle: '《紫微斗数全书》卷一·定富贵局',
    sourceUrl: VOLUME_ONE_URL,
    sourceQuote: '君臣庆会，紫微左右同守命是也，更会相武阴妙上。',
    calculation: '检查本命命宫的原局星曜是否同时包含紫微、左辅与右弼。',
    detect({ soulPalace }) {
      return hasAllStars(soulPalace, ['紫微', '左辅', '右弼'])
        ? {
            palaces: [soulPalace],
            stars: ['紫微', '左辅', '右弼'],
            conditions: ['紫微、左辅、右弼同守命宫'],
          }
        : null;
    },
  },
  {
    id: 'zuo-you-jia-ming',
    name: '左右夹命',
    kind: 'auspicious',
    description: '左辅、右弼分居命宫相邻两宫。',
    traditionalInterpretation: '古籍把左辅、右弼前后夹命列为传统贵格。',
    sourceTitle: '《紫微斗数全书》卷三·左辅右弼',
    sourceUrl: VOLUME_THREE_URL,
    sourceQuote: '左右夹命为贵格，如安命在丑宫，左辅在子宫，右弼在寅宫。',
    calculation: '检查命宫前后相邻两宫是否分别出现左辅与右弼。',
    detect(context) {
      const neighbors = getNeighborPalaces(context, context.soulPalace);
      if (neighbors.length !== 2) return null;
      const matched =
        (hasStar(neighbors[0], '左辅') && hasStar(neighbors[1], '右弼')) ||
        (hasStar(neighbors[0], '右弼') && hasStar(neighbors[1], '左辅'));
      return matched
        ? {
            palaces: [context.soulPalace, ...neighbors],
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
    traditionalInterpretation: '古籍把魁钺在命宫与对宫相互坐拱列为传统贵格。',
    sourceTitle: '《紫微斗数全书》卷一·定富贵局',
    sourceUrl: VOLUME_ONE_URL,
    sourceQuote: '坐贵向贵，谓魁钺在命迭相坐拱是也。',
    calculation: '检查命宫与对宫是否分别出现天魁、天钺。',
    detect(context) {
      const opposite = context.palaceByIndex.get(context.soulPalace.opposite_palace_index);
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
    traditionalInterpretation: '古籍把文曲、武曲同临命身列为兼文武。',
    sourceTitle: '《紫微斗数全书》卷一·论兼文武格',
    sourceUrl: VOLUME_ONE_URL,
    sourceQuote: '论兼文武格，文曲武曲在身命是也。',
    calculation: '在本命命宫及身宫检查文曲、武曲是否同宫。',
    detect(context) {
      const target = context.palaces.find(
        (palace) =>
          (palace.index === context.soulPalace.index || palace.is_body_palace) &&
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
    traditionalInterpretation: '古籍把双禄坐命又遇空劫列为传统受制结构。',
    sourceTitle: '《紫微斗数全书》卷一·定贫贱局',
    sourceUrl: VOLUME_ONE_URL,
    sourceQuote: '两重华盖，谓禄存化禄坐命遇空劫是也。',
    calculation: '检查命宫是否同时包含禄存、生年化禄星，并出现地空或地劫。',
    detect({ soulPalace }) {
      const huaLu = natalStars(soulPalace).find((star) => star.birth_mutagen === '禄');
      const voidStars = ['地空', '地劫'].filter((name) => hasStar(soulPalace, name));
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
    traditionalInterpretation: '古籍以月在亥宫守命称为月朗天门。',
    sourceTitle: '《紫微斗数全书》卷一·定富贵局',
    sourceUrl: VOLUME_ONE_URL,
    sourceQuote: '月落亥宫，月在亥守命是也，又名月朗天门。',
    calculation: '检查本命命宫是否位于亥宫，并由太阴守命。',
    detect({ soulPalace }) {
      return soulPalace.earthly_branch === '亥' && hasStar(soulPalace, '太阴')
        ? {
            palaces: [soulPalace],
            stars: ['太阴'],
            conditions: ['太阴在亥宫守命'],
          }
        : null;
    },
  },
  {
    id: 'yue-sheng-cang-hai',
    name: '月生沧海',
    kind: 'auspicious',
    description: '太阴在子宫守田宅宫。',
    traditionalInterpretation: '古籍以月在子宫守田宅称为月生沧海。',
    sourceTitle: '《紫微斗数全书》卷一·定富贵局',
    sourceUrl: VOLUME_ONE_URL,
    sourceQuote: '月生沧海，月在子宫守田宅是也。',
    calculation: '检查本命田宅宫是否位于子宫，并由太阴守宫。',
    detect(context) {
      const target = getPalaceByName(context, '田宅');
      return target?.earthly_branch === '子' && hasStar(target, '太阴')
        ? {
            palaces: [target],
            stars: ['太阴'],
            conditions: ['太阴在子宫守田宅宫'],
          }
        : null;
    },
  },
  {
    id: 'jin-can-guang-hui',
    name: '金灿光辉',
    kind: 'auspicious',
    description: '太阳单守午宫命宫。',
    traditionalInterpretation: '古籍以太阳单守午宫命宫称为金灿光辉。',
    sourceTitle: '《紫微斗数全书》卷一·定富贵局',
    sourceUrl: VOLUME_ONE_URL,
    sourceQuote: '金灿光辉，太阳单守，命在午宫是也。',
    calculation: '检查本命命宫是否位于午宫，并且仅有太阳一颗主星守命。',
    detect({ soulPalace }) {
      return soulPalace.earthly_branch === '午' && hasSingleMajorStar(soulPalace, '太阳')
        ? {
            palaces: [soulPalace],
            stars: ['太阳'],
            conditions: ['太阳单守午宫命宫'],
          }
        : null;
    },
  },
  {
    id: 'ri-chu-fu-sang',
    name: '日出扶桑',
    kind: 'auspicious',
    description: '太阳在卯宫守命宫或官禄宫。',
    traditionalInterpretation: '古籍以日在卯宫守命或守官禄称为日出扶桑。',
    sourceTitle: '《紫微斗数全书》卷一·定富贵局',
    sourceUrl: VOLUME_ONE_URL,
    sourceQuote: '日出扶桑，日在卯守命是也，守官禄宫亦然。',
    calculation: '分别检查本命命宫与官禄宫，登记太阳在卯宫守宫的实际命中宫位。',
    detect(context) {
      const targets = [context.soulPalace, getPalaceByName(context, '官禄')].filter(
        (palace): palace is PalaceFact =>
          !!palace && palace.earthly_branch === '卯' && hasStar(palace, '太阳'),
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
    traditionalInterpretation: '古籍以太阳会文昌于官禄称为皇殿朝班。',
    sourceTitle: '《紫微斗数全书》卷一·定富贵局',
    sourceUrl: VOLUME_ONE_URL,
    sourceQuote: '太陽會文昌於官祿，皇殿朝班，富貴全美。',
    calculation: '检查本命官禄宫是否同时包含太阳与文昌。',
    detect(context) {
      const target = getPalaceByName(context, '官禄');
      return target && hasAllStars(target, ['太阳', '文昌'])
        ? {
            palaces: [target],
            stars: ['太阳', '文昌'],
            conditions: ['太阳与文昌同守官禄宫'],
          }
        : null;
    },
  },
  {
    id: 'lu-ma-jiao-chi',
    name: '禄马交驰',
    kind: 'auspicious',
    description: '禄存与天马同坐命宫或身宫。',
    traditionalInterpretation: '古籍在身命驿马论中，把天马与禄存同宫称为禄马交驰。',
    sourceTitle: '《紫微斗数全书》卷一·问天马星所主若何',
    sourceUrl: VOLUME_ONE_URL,
    sourceQuote: '如身命临之谓之驿马……如与禄存同宫，谓之禄马交驰。',
    calculation: '在本命命宫及身宫检查禄存与天马是否同宫。',
    detect(context) {
      const targets = context.palaces.filter(
        (palace) =>
          (palace.index === context.soulPalace.index || palace.is_body_palace) &&
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
    traditionalInterpretation: '古籍把马守命而武曲、禄存来夹称为财禄夹马。',
    sourceTitle: '《紫微斗数全书》卷一·定富贵局',
    sourceUrl: VOLUME_ONE_URL,
    sourceQuote: '财禄夹马，马守命武禄来夹是也，逢生旺尤妙。',
    calculation: '先检查天马守命，再检查命宫相邻两宫是否分别出现武曲与禄存。',
    detect(context) {
      if (!hasStar(context.soulPalace, '天马')) return null;
      const neighbors = getNeighborPalaces(context, context.soulPalace);
      if (neighbors.length !== 2) return null;
      const matched =
        (hasStar(neighbors[0], '武曲') && hasStar(neighbors[1], '禄存')) ||
        (hasStar(neighbors[0], '禄存') && hasStar(neighbors[1], '武曲'));
      return matched
        ? {
            palaces: [context.soulPalace, ...neighbors],
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
    traditionalInterpretation: '古籍以日月同临田宅宫称为日月照璧，并另说明居墓库更佳。',
    sourceTitle: '《紫微斗数全书》卷一·定富贵局',
    sourceUrl: VOLUME_ONE_URL,
    sourceQuote: '日月照璧，日月临田宅宫是也，喜居墓库。',
    calculation: '检查本命田宅宫是否同时包含太阳与太阴；墓库只作古籍附加条件，不扩大基本命中。',
    detect(context) {
      const target = getPalaceByName(context, '田宅');
      return target && hasAllStars(target, ['太阳', '太阴'])
        ? {
            palaces: [target],
            stars: ['太阳', '太阴'],
            conditions: [
              '太阳与太阴同守田宅宫',
              `田宅宫在${target.earthly_branch}${['辰', '戌', '丑', '未'].includes(target.earthly_branch) ? '，属于古籍所喜墓库' : '，不附加墓库条件'}`,
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
    traditionalInterpretation: '古籍以命在子午而逢巨门称为石中隐玉，三方科禄属于加强条件。',
    sourceTitle: '《紫微斗数全书》卷一·论石中隐玉格',
    sourceUrl: VOLUME_ONE_URL,
    sourceQuote: '论石中隐玉格，命在子午逢巨门是也。',
    calculation: '检查本命命宫是否位于子宫或午宫，并由巨门守命。',
    detect({ soulPalace }) {
      return ['子', '午'].includes(soulPalace.earthly_branch) && hasStar(soulPalace, '巨门')
        ? {
            palaces: [soulPalace],
            stars: ['巨门'],
            conditions: [`巨门在${soulPalace.earthly_branch}宫守命`],
          }
        : null;
    },
  },
  {
    id: 'zi-fu-jia-ming',
    name: '紫府夹命',
    kind: 'auspicious',
    description: '紫微与天府分居命宫相邻两宫。',
    traditionalInterpretation: '古籍把紫微、天府前后夹命列为传统贵格。',
    sourceTitle: '《紫微斗数全书》卷三·紫微',
    sourceUrl: VOLUME_THREE_URL,
    sourceQuote: '紫府夹命为贵格。',
    calculation: '检查命宫前后相邻两宫是否分别出现紫微与天府。',
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
    traditionalInterpretation: '古籍把寅申命宫会齐机月同梁列为传统任职结构，并要求另看吉煞。',
    sourceTitle: '《紫微斗数全书》卷三·天机',
    sourceUrl: VOLUME_THREE_URL,
    sourceQuote: '机月同梁作吏人，命在寅申方论，加吉不论，无吉无杀亦是平常人，凶杀空劫化忌为下格。',
    calculation: '先检查命宫地支为寅或申，再在命宫三方四正核对天机、太阴、天同、天梁。',
    detect(context) {
      if (!['寅', '申'].includes(context.soulPalace.earthly_branch)) return null;
      const required = ['天机', '太阴', '天同', '天梁'];
      const starPalaces = required.map((star) =>
        getSurroundedStarPalace(context, context.soulPalace, star),
      );
      return starPalaces.every((palace) => !!palace)
        ? {
            palaces: uniquePalaces([context.soulPalace, ...(starPalaces as PalaceFact[])]),
            stars: required,
            conditions: [
              `命宫在${context.soulPalace.earthly_branch}宫`,
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
    traditionalInterpretation: '古籍以上格口径把寅申命宫、府相分守财帛官禄列为府相朝垣。',
    sourceTitle: '《紫微斗数全书》卷三·天府',
    sourceUrl: VOLUME_THREE_URL,
    sourceQuote: '府相朝垣千锺食禄，命寅申，府相在财帛宫，禄官朝者，上格别宫次之。',
    calculation: '检查命宫是否在寅申，再核对天府、天相是否分别坐财帛宫与官禄宫。',
    detect(context) {
      if (!['寅', '申'].includes(context.soulPalace.earthly_branch)) return null;
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
              `命宫在${context.soulPalace.earthly_branch}宫`,
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
    traditionalInterpretation: '古籍把天魁、天钺前后夹命列为奇格。',
    sourceTitle: '《紫微斗数全书》卷三·魁钺',
    sourceUrl: VOLUME_THREE_URL,
    sourceQuote: '魁钺夹命为奇格，如命安在辰宫，魁在卯，钺在巳宫是也。',
    calculation: '检查命宫前后相邻两宫是否分别出现天魁与天钺。',
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
    traditionalInterpretation: '古籍把昌曲同居福德宫称为玉袖天香，并以另见紫微为加强条件。',
    sourceTitle: '《紫微斗数全书》卷三·文昌文曲',
    sourceUrl: VOLUME_THREE_URL,
    sourceQuote: '昌曲吉星居福德谓之玉袖天香，更得紫微，居午宫妙。',
    calculation: '检查本命福德宫是否同时包含文昌与文曲；紫微只登记为古籍加强条件。',
    detect(context) {
      const target = getPalaceByName(context, '福德');
      return target && hasAllStars(target, ['文昌', '文曲'])
        ? {
            palaces: [target],
            stars: ['文昌', '文曲', ...getMatchedStarNames(target, ['紫微'])],
            conditions: [
              '文昌与文曲同守福德宫',
              hasStar(target, '紫微') ? '福德宫同时见紫微加强条件' : '未附加紫微加强条件',
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
    traditionalInterpretation: '古籍把太阴与昌曲之一同守夫妻宫称为蟾宫折桂。',
    sourceTitle: '《紫微斗数全书》卷三·太阴',
    sourceUrl: VOLUME_THREE_URL,
    sourceQuote: '太阴同文曲于妻宫蟾宫折桂，文昌同亦然。',
    calculation: '检查本命夫妻宫是否有太阴，并同见文昌或文曲。',
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
    traditionalInterpretation: '古籍强调日月照合并明，并须避免用落陷的日月反背冒充。',
    sourceTitle: '《紫微斗数全书》卷三·太阳太阴拱照',
    sourceUrl: VOLUME_THREE_URL,
    sourceQuote: '日月守命不如照合并明。',
    calculation: '在命宫三方四正分别定位太阳、太阴，并核对两曜亮度均为庙或旺。',
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
    traditionalInterpretation: '古籍把左辅、右弼在命宫三方会照列为左右朝垣。',
    sourceTitle: '《紫微斗数全书》卷一·论左右朝垣格',
    sourceUrl: VOLUME_ONE_URL,
    sourceQuote: '论左右朝垣格：天星左右最高明，若在三方禄位兴。',
    calculation: '在命宫以外的三个会照宫位分别定位左辅与右弼。',
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
    traditionalInterpretation: '古籍把文昌、文曲同值命宫列为文星朝命，并以三方另见吉曜为加强条件。',
    sourceTitle: '《紫微斗数全书》卷一·论文星朝命格',
    sourceUrl: VOLUME_ONE_URL,
    sourceQuote: '文昌文曲最荣华，值此须生富贵家，更得三方祥曜拱，却如锦上又添花。',
    calculation: '检查本命命宫是否同时包含文昌与文曲。',
    detect({ soulPalace }) {
      return hasAllStars(soulPalace, ['文昌', '文曲'])
        ? {
            palaces: [soulPalace],
            stars: ['文昌', '文曲'],
            conditions: ['文昌与文曲同守命宫'],
          }
        : null;
    },
  },
  {
    id: 'dui-mian-chao-dou',
    name: '对面朝斗',
    kind: 'auspicious',
    description: '迁移宫位于子或午宫并见禄存。',
    traditionalInterpretation: '古籍把禄存在子午迁移宫对命相照列为对面朝斗。',
    sourceTitle: '《紫微斗数全书》卷一·论对面朝斗格',
    sourceUrl: VOLUME_ONE_URL,
    sourceQuote: '论对面朝斗格，子午宫逢禄存是也；禄有对面在迁移。',
    calculation: '检查本命迁移宫是否位于子或午宫，并由禄存坐守。',
    detect(context) {
      const target = getPalaceByName(context, '迁移');
      return target && ['子', '午'].includes(target.earthly_branch) && hasStar(target, '禄存')
        ? {
            palaces: [context.soulPalace, target],
            stars: ['禄存'],
            conditions: [`禄存在${target.earthly_branch}宫守迁移，对照命宫`],
          }
        : null;
    },
  },
  {
    id: 'ri-yue-jia-cai',
    name: '日月夹财',
    kind: 'auspicious',
    description: '武曲守命宫或财帛宫，太阳、太阴分居该宫相邻两宫。',
    traditionalInterpretation: '古籍以武曲为财星，把日月前后夹武曲守命或守财列为日月夹财。',
    sourceTitle: '《紫微斗数全书》卷一·定富局',
    sourceUrl: VOLUME_ONE_URL,
    sourceQuote: '日月夹财，武守命日月来夹是也，财帛宫亦然。',
    calculation: '依次检查命宫与财帛宫；目标宫有武曲时，再核对太阳、太阴是否分居相邻两宫。',
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
    traditionalInterpretation: '古籍把七杀在寅申子午守命称为七杀朝斗。',
    sourceTitle: '《紫微斗数全书》卷三·七杀',
    sourceUrl: VOLUME_THREE_URL,
    sourceQuote: '七杀寅申子午一生爵禄荣昌，为七杀朝斗格。',
    calculation: '检查本命命宫是否位于寅、申、子或午宫，并由七杀守命。',
    detect({ soulPalace }) {
      return ['寅', '申', '子', '午'].includes(soulPalace.earthly_branch) &&
        hasStar(soulPalace, '七杀')
        ? {
            palaces: [soulPalace],
            stars: ['七杀'],
            conditions: [`七杀在${soulPalace.earthly_branch}宫守命`],
          }
        : null;
    },
  },
  {
    id: 'tan-huo-xiang-feng',
    name: '贪火相逢',
    kind: 'auspicious',
    description: '贪狼与火星同守命宫，且两曜均为庙或旺。',
    traditionalInterpretation: '古籍把贪狼、火星在命宫同居庙旺列为贪火相逢。',
    sourceTitle: '《紫微斗数全书》卷一·定贵局',
    sourceUrl: VOLUME_ONE_URL,
    sourceQuote: '贪火相逢，谓二星守命同居庙旺是也。',
    calculation: '检查命宫是否同时有贪狼、火星，并核对两曜亮度均为庙或旺。',
    detect({ soulPalace }) {
      return isTempleOrProsperous(getStar(soulPalace, '贪狼')) &&
        isTempleOrProsperous(getStar(soulPalace, '火星'))
        ? {
            palaces: [soulPalace],
            stars: ['贪狼', '火星'],
            conditions: ['贪狼与火星同守命宫', '贪狼、火星亮度均为庙或旺'],
          }
        : null;
    },
  },
  {
    id: 'wu-qu-shou-yuan',
    name: '武曲守垣',
    kind: 'auspicious',
    description: '武曲在卯宫守命。',
    traditionalInterpretation:
      '古籍定贵局把武曲在卯宫守命单列为武曲守垣；本规则严格采用该版本原文。',
    sourceTitle: '《紫微斗数全书》卷一·定贵局',
    sourceUrl: VOLUME_ONE_URL,
    sourceQuote: '武曲守垣，武守命卯宫是也，余不是。',
    calculation: '检查本命命宫是否位于卯宫，并由武曲守命。',
    detect({ soulPalace }) {
      return soulPalace.earthly_branch === '卯' && hasStar(soulPalace, '武曲')
        ? {
            palaces: [soulPalace],
            stars: ['武曲'],
            conditions: ['武曲在卯宫守命'],
          }
        : null;
    },
  },
  {
    id: 'quan-lu-sheng-feng',
    name: '权禄生逢',
    kind: 'auspicious',
    description: '生年化权、生年化禄同守命宫，且两颗化曜均为庙或旺。',
    traditionalInterpretation: '古籍把权禄二曜在命宫庙旺同守列为权禄生逢。',
    sourceTitle: '《紫微斗数全书》卷一·定贵局',
    sourceUrl: VOLUME_ONE_URL,
    sourceQuote: '权禄生逢，二星守命庙旺是也，陷不是。',
    calculation: '只读取命宫原局生年化权、化禄，核对两颗化曜均为庙或旺，不混入运限四化。',
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
    traditionalInterpretation: '古籍定贵局以天刑、廉贞同临命身登记此传统结构。',
    sourceTitle: '《紫微斗数全书》卷一·定贵局',
    sourceUrl: VOLUME_ONE_URL,
    sourceQuote: '刑囚夹印，天刑廉贞同临身命主武勇之人。',
    calculation: '在本命命宫及身宫检查天刑、廉贞是否同宫。',
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
    traditionalInterpretation: '古籍把廉贞在申未且无煞守命称为雄宿朝元。',
    sourceTitle: '《紫微斗数全书》卷三·廉贞',
    sourceUrl: VOLUME_THREE_URL,
    sourceQuote: '廉贞申未宫无杀富贵声扬播远名，雄宿朝元格，加杀平常。',
    calculation: '检查廉贞是否在申或未宫守命，并排除命宫羊陀火铃。',
    detect({ soulPalace }) {
      return ['申', '未'].includes(soulPalace.earthly_branch) &&
        hasStar(soulPalace, '廉贞') &&
        !hasAnyMalefic([soulPalace])
        ? {
            palaces: [soulPalace],
            stars: ['廉贞'],
            conditions: [`廉贞在${soulPalace.earthly_branch}宫守命`, '命宫不见羊陀火铃'],
          }
        : null;
    },
  },
  {
    id: 'po-jun-zi-wu',
    name: '破军子午',
    kind: 'auspicious',
    description: '破军在子或午宫守命，命宫不见羊陀火铃。',
    traditionalInterpretation: '古籍把破军在子午无煞守命列为传统清显结构。',
    sourceTitle: '《紫微斗数全书》卷三·破军',
    sourceUrl: VOLUME_THREE_URL,
    sourceQuote: '破军子午宫无杀官资清显至三公。',
    calculation: '检查破军是否在子或午宫守命，并排除命宫羊陀火铃。',
    detect({ soulPalace }) {
      return ['子', '午'].includes(soulPalace.earthly_branch) &&
        hasStar(soulPalace, '破军') &&
        !hasAnyMalefic([soulPalace])
        ? {
            palaces: [soulPalace],
            stars: ['破军'],
            conditions: [`破军在${soulPalace.earthly_branch}宫守命`, '命宫不见羊陀火铃'],
          }
        : null;
    },
  },
  {
    id: 'sheng-bu-feng-shi',
    name: '生不逢时',
    kind: 'inauspicious',
    description: '廉贞守命，命宫同时坐空亡类星曜。',
    traditionalInterpretation: '古籍把廉贞守命又坐空亡列为生不逢时。',
    sourceTitle: '《紫微斗数全书》卷一·定贫贱局',
    sourceUrl: VOLUME_ONE_URL,
    sourceQuote: '生不逢时，命坐空亡逢廉贞是也。',
    calculation: '检查本命命宫是否有廉贞，并同见空亡、旬空、天空、截空或截路空亡。',
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
    traditionalInterpretation: '古籍把禄曜落空亡并再逢空劫列为禄逢两杀。',
    sourceTitle: '《紫微斗数全书》卷一·定贫贱局',
    sourceUrl: VOLUME_ONE_URL,
    sourceQuote: '禄逢两杀，禄坐空亡又逢空劫杀星是也。',
    calculation: '在命宫三方四正寻找禄存，并检查同宫是否同时有空亡类星曜及地空或地劫。',
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
    traditionalInterpretation: '古籍把天马落空亡列为马落空亡，并说明禄曜会照不能取消这一结构。',
    sourceTitle: '《紫微斗数全书》卷一·定贫贱局',
    sourceUrl: VOLUME_ONE_URL,
    sourceQuote: '马落空亡，马既落亡虽禄冲会无用主奔波。',
    calculation: '在命宫三方四正寻找天马，并检查其同宫是否有空亡、旬空、天空、截空或截路空亡。',
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
    traditionalInterpretation: '古籍把日月反背又逢巨门暗曜列为日月藏辉。',
    sourceTitle: '《紫微斗数全书》卷一·定贫贱局',
    sourceUrl: VOLUME_ONE_URL,
    sourceQuote: '日月藏辉，日月反背又逢巨暗是也。',
    calculation: '在命宫三方四正定位太阳、太阴、巨门，并核对太阳在戌、太阴在辰。',
    detect(context) {
      const surrounded = getSurroundedPalaces(context, context.soulPalace);
      const sun = surrounded.find(
        (palace) => palace.earthly_branch === '戌' && hasStar(palace, '太阳'),
      );
      const moon = surrounded.find(
        (palace) => palace.earthly_branch === '辰' && hasStar(palace, '太阴'),
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
    traditionalInterpretation: '古籍以武曲为财、廉贞为囚，把二星分临身命列为财与囚仇。',
    sourceTitle: '《紫微斗数全书》卷一·定贫贱局',
    sourceUrl: VOLUME_ONE_URL,
    sourceQuote: '财与囚仇，武贞同守身命是也。',
    calculation: '定位命宫与身宫，检查武曲、廉贞是否分别守在这两个宫位；命身同宫时不作分守命中。',
    detect(context) {
      const body = context.palaces.find((palace) => palace.is_body_palace);
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
    traditionalInterpretation: '古籍把破军落陷守命列为一生孤贫；名称只保留传统分类，不作现实断语。',
    sourceTitle: '《紫微斗数全书》卷一·定贫贱局',
    sourceUrl: VOLUME_ONE_URL,
    sourceQuote: '一生孤贫，谓破守命星陷地是也。',
    calculation: '检查本命命宫是否有破军，并核对其亮度明确为“陷”。',
    detect({ soulPalace }) {
      return getStar(soulPalace, '破军')?.brightness === '陷'
        ? {
            palaces: [soulPalace],
            stars: ['破军'],
            conditions: ['破军以“陷”亮度守命'],
          }
        : null;
    },
  },
  {
    id: 'jun-zi-zai-ye',
    name: '君子在野',
    kind: 'inauspicious',
    description: '命宫或身宫有羊陀火铃之一以“陷”亮度坐守。',
    traditionalInterpretation: '古籍把四煞临陷守命身列为君子在野；名称只保留传统分类。',
    sourceTitle: '《紫微斗数全书》卷一·定贫贱局',
    sourceUrl: VOLUME_ONE_URL,
    sourceQuote: '君子在野，谓四杀守身命而言临陷地是也。',
    calculation: '在命宫与身宫寻找擎羊、陀罗、火星、铃星，并核对至少一曜亮度明确为“陷”。',
    detect(context) {
      const target = getSoulAndBodyPalaces(context).find((palace) =>
        natalStars(palace).some(
          (star) =>
            FOUR_MALEFICS.includes(star.name as (typeof FOUR_MALEFICS)[number]) &&
            star.brightness === '陷',
        ),
      );
      if (!target) return null;
      const fallen = natalStars(target)
        .filter(
          (star) =>
            FOUR_MALEFICS.includes(star.name as (typeof FOUR_MALEFICS)[number]) &&
            star.brightness === '陷',
        )
        .map((star) => star.name);
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
    traditionalInterpretation: '古籍以命宫逢忌、羊陀前后夹命为败局。',
    sourceTitle: '《紫微斗数全书》卷三·擎羊',
    sourceUrl: VOLUME_THREE_URL,
    sourceQuote: '羊陀夹忌为败局，假如安命在申宫，又逢忌星，羊在酉陀在未夹之。',
    calculation: '只检查命宫的原局生年化忌，再核对命宫相邻两宫是否分别有擎羊、陀罗。',
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
    kind: 'neutral',
    description: '火星、铃星分居命宫相邻两宫。',
    traditionalInterpretation: '古籍把火铃前后夹命列为败局，并说明吉曜多时须另论。',
    sourceTitle: '《紫微斗数全书》卷三·火星铃星',
    sourceUrl: VOLUME_THREE_URL,
    sourceQuote: '火铃夹命为败局，如命安寅申，火星在丑，铃星在卯。吉多尚可。',
    calculation: '检查命宫前后相邻两宫是否分别出现火星与铃星；只登记结构，不据此作整盘断语。',
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
    traditionalInterpretation: '古籍把空劫前后夹命列为败局；名称只保留传统分类。',
    sourceTitle: '《紫微斗数全书》卷三·劫空',
    sourceUrl: VOLUME_THREE_URL,
    sourceQuote: '劫空夹命为败局。',
    calculation: '检查命宫前后相邻两宫是否分别出现地空与地劫。',
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
    traditionalInterpretation: '古籍把贪狼在亥子又遇羊陀称为泛水桃花；名称只保留传统分类。',
    sourceTitle: '《紫微斗数全书》卷三·贪狼',
    sourceUrl: VOLUME_THREE_URL,
    sourceQuote: '贪遇羊陀居亥子名为泛水桃花，有吉曜则吉。',
    calculation: '检查贪狼是否在亥或子宫守命，并核对命宫同时出现擎羊或陀罗。',
    detect({ soulPalace }) {
      const malefics = getMatchedStarNames(soulPalace, ['擎羊', '陀罗']);
      return ['亥', '子'].includes(soulPalace.earthly_branch) &&
        hasStar(soulPalace, '贪狼') &&
        malefics.length > 0
        ? {
            palaces: [soulPalace],
            stars: ['贪狼', ...malefics],
            conditions: [
              `贪狼在${soulPalace.earthly_branch}宫守命`,
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
    traditionalInterpretation: '古籍把太阴在子宫守命称为水澄桂萼。',
    sourceTitle: '《紫微斗数全书》卷一·太微赋',
    sourceUrl: VOLUME_ONE_URL,
    sourceQuote: '太阴居子，号曰水澄桂萼。',
    calculation: '检查本命命宫是否位于子宫，并由太阴守命。',
    detect({ soulPalace }) {
      return soulPalace.earthly_branch === '子' && hasStar(soulPalace, '太阴')
        ? {
            palaces: [soulPalace],
            stars: ['太阴'],
            conditions: ['太阴在子宫守命'],
          }
        : null;
    },
  },
  {
    id: 'tian-liang-ju-wu',
    name: '天梁居午',
    kind: 'auspicious',
    description: '天梁在午宫守命。',
    traditionalInterpretation: '古籍把天梁在午宫守命列为传统清显结构。',
    sourceTitle: '《紫微斗数全书》卷三·天梁',
    sourceUrl: VOLUME_THREE_URL,
    sourceQuote: '天梁居午位官资清显朝堂。',
    calculation: '检查本命命宫是否位于午宫，并由天梁守命。',
    detect({ soulPalace }) {
      return soulPalace.earthly_branch === '午' && hasStar(soulPalace, '天梁')
        ? {
            palaces: [soulPalace],
            stars: ['天梁'],
            conditions: ['天梁在午宫守命'],
          }
        : null;
    },
  },
  {
    id: 'liang-chang-miao-wang',
    name: '梁昌庙旺',
    kind: 'auspicious',
    description: '天梁、文昌同守命宫且均为庙或旺。',
    traditionalInterpretation: '古籍把天梁文昌居庙旺列为传统台纲结构。',
    sourceTitle: '《紫微斗数全书》卷三·天梁',
    sourceUrl: VOLUME_THREE_URL,
    sourceQuote: '天梁文昌居庙旺位至台纲。',
    calculation: '检查天梁、文昌是否同守命宫，并核对两曜亮度均为庙或旺。',
    detect({ soulPalace }) {
      return isTempleOrProsperous(getStar(soulPalace, '天梁')) &&
        isTempleOrProsperous(getStar(soulPalace, '文昌'))
        ? {
            palaces: [soulPalace],
            stars: ['天梁', '文昌'],
            conditions: ['天梁、文昌同守命宫', '天梁、文昌亮度均为庙或旺'],
          }
        : null;
    },
  },
  {
    id: 'yang-liang-chang-lu',
    name: '阳梁昌禄',
    kind: 'auspicious',
    description: '命宫三方四正齐见太阳、天梁、文昌、禄存。',
    traditionalInterpretation: '古籍把天梁会太阳、文昌、禄存列为传统科名结构。',
    sourceTitle: '《紫微斗数全书》卷三·天梁',
    sourceUrl: VOLUME_THREE_URL,
    sourceQuote: '天梁太阳昌禄会胪传第一名。',
    calculation: '在命宫三方四正分别定位太阳、天梁、文昌与禄存。',
    detect(context) {
      const required = ['太阳', '天梁', '文昌', '禄存'];
      const starPalaces = required.map((star) =>
        getSurroundedStarPalace(context, context.soulPalace, star),
      );
      return starPalaces.every((palace) => !!palace)
        ? {
            palaces: uniquePalaces([context.soulPalace, ...(starPalaces as PalaceFact[])]),
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
    traditionalInterpretation: '古籍把巨门、太阳同宫列为传统组合，仍须另看宫位与吉煞。',
    sourceTitle: '《紫微斗数全书》卷一·斗数骨髓赋',
    sourceUrl: VOLUME_ONE_URL,
    sourceQuote: '巨日同宫官封三代。',
    calculation: '检查本命命宫是否同时包含巨门与太阳。',
    detect({ soulPalace }) {
      return hasAllStars(soulPalace, ['巨门', '太阳'])
        ? {
            palaces: [soulPalace],
            stars: ['巨门', '太阳'],
            conditions: ['巨门、太阳同守命宫'],
          }
        : null;
    },
  },
  {
    id: 'ju-huo-qing-yang',
    name: '巨火擎羊',
    kind: 'inauspicious',
    description: '巨门守命，命宫三方四正齐见火星、擎羊、陀罗。',
    traditionalInterpretation: '古籍把巨门会火曜、羊陀及恶曜列为传统受制结构。',
    sourceTitle: '《紫微斗数全书》卷三·巨门',
    sourceUrl: VOLUME_THREE_URL,
    sourceQuote: '巨火擎羊陀逢恶曜防缢死投河。',
    calculation: '先检查巨门守命，再在命宫三方四正分别定位火星、擎羊与陀罗。',
    detect(context) {
      if (!hasStar(context.soulPalace, '巨门')) return null;
      const required = ['火星', '擎羊', '陀罗'];
      const starPalaces = required.map((star) =>
        getSurroundedStarPalace(context, context.soulPalace, star),
      );
      return starPalaces.every((palace) => !!palace)
        ? {
            palaces: uniquePalaces([context.soulPalace, ...(starPalaces as PalaceFact[])]),
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
    traditionalInterpretation: '古籍把武曲贪狼同行列为传统组合，并另要求结合宫位、吉煞与年龄判断。',
    sourceTitle: '《紫微斗数全书》卷一·斗数骨髓赋',
    sourceUrl: VOLUME_ONE_URL,
    sourceQuote: '贪武同行威镇边夷。',
    calculation: '检查本命命宫是否同时包含武曲与贪狼。',
    detect({ soulPalace }) {
      return hasAllStars(soulPalace, ['武曲', '贪狼'])
        ? {
            palaces: [soulPalace],
            stars: ['武曲', '贪狼'],
            conditions: ['武曲、贪狼同守命宫'],
          }
        : null;
    },
  },
  {
    id: 'huo-gui',
    name: '火贵格',
    kind: 'auspicious',
    description: '贪狼、火星从命宫或身宫同一组三方会照，且该组三方不见羊陀铃。',
    traditionalInterpretation: '古籍把贪狼火星从同一组三方照身或照命且无凶煞列为火贵格。',
    sourceTitle: '《紫微斗数全书》卷一·论火贵格',
    sourceUrl: VOLUME_ONE_URL,
    sourceQuote: '论贪狼遇火名为火贵格，三合照身命是也；三方倘若无凶杀。',
    calculation:
      '分别以命宫、身宫为目标，在各自三个会照宫位定位贪狼、火星并排除擎羊、陀罗、铃星；不得跨两组宫位拼接。',
    detect(context) {
      for (const target of getSoulAndBodyPalaces(context)) {
        const surrounded = getSurroundedPalaces(context, target).filter(
          (palace) => palace.index !== target.index,
        );
        const greed = findStarPalace(surrounded, '贪狼');
        const fire = findStarPalace(surrounded, '火星');
        const forbidden = surrounded.flatMap((palace) =>
          getMatchedStarNames(palace, ['擎羊', '陀罗', '铃星']),
        );
        if (greed && fire && forbidden.length === 0) {
          const targetLabel =
            target.index === context.soulPalace.index ? '命宫' : `身宫（${target.name}）`;
          return {
            palaces: uniquePalaces([target, greed, fire]),
            stars: ['贪狼', '火星'],
            conditions: [
              `贪狼、火星从${targetLabel}同一组三方会照`,
              `${targetLabel}三个会照宫位不见擎羊、陀罗、铃星`,
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
    traditionalInterpretation: '古籍把贪狼陀罗同居寅宫称为风流彩杖；名称只保留传统分类。',
    sourceTitle: '《紫微斗数全书》卷三·贪狼',
    sourceUrl: VOLUME_THREE_URL,
    sourceQuote: '贪狼陀罗在寅宫号曰风流彩杖。',
    calculation: '检查本命命宫是否位于寅宫，并同时包含贪狼、陀罗。',
    detect({ soulPalace }) {
      return soulPalace.earthly_branch === '寅' && hasAllStars(soulPalace, ['贪狼', '陀罗'])
        ? {
            palaces: [soulPalace],
            stars: ['贪狼', '陀罗'],
            conditions: ['贪狼、陀罗同守寅宫命宫'],
          }
        : null;
    },
  },
  {
    id: 'ju-ji-ju-mao',
    name: '巨机居卯',
    kind: 'auspicious',
    description: '巨门、天机同守卯宫命宫，生年天干为乙、辛、己或丙。',
    traditionalInterpretation: '古籍把巨机同居卯宫且符合生年天干条件列为传统贵格。',
    sourceTitle: '《紫微斗数全书》卷三·巨门',
    sourceUrl: VOLUME_THREE_URL,
    sourceQuote: '巨机居卯乙辛己丙至公卿，甲人平常。',
    calculation: '检查巨门、天机是否同守卯宫命宫，并从四柱年柱核对生年天干为乙、辛、己或丙。',
    canEvaluate: (context) => !!context.birthYearHeavenlyStem,
    detect(context) {
      return context.soulPalace.earthly_branch === '卯' &&
        hasAllStars(context.soulPalace, ['巨门', '天机']) &&
        !!context.birthYearHeavenlyStem &&
        ['乙', '辛', '己', '丙'].includes(context.birthYearHeavenlyStem)
        ? {
            palaces: [context.soulPalace],
            stars: ['巨门', '天机'],
            conditions: ['巨门、天机同守卯宫命宫', `生年天干为${context.birthYearHeavenlyStem}`],
          }
        : null;
    },
  },
];

export const VERIFIED_ZIWEI_PATTERN_RULE_COUNT = VERIFIED_PATTERN_RULES.length;
export const ZIWEI_TRADITIONAL_PATTERN_CATALOG_COUNT =
  VERIFIED_ZIWEI_PATTERN_RULE_COUNT + ZIWEI_TRADITIONAL_PATTERN_BOUNDARIES.length;
const VERIFIED_ZIWEI_PATTERN_STABLE_KEYS = new Set(
  VERIFIED_PATTERN_RULES.map((rule) => `ziwei:verified-pattern:${rule.id}`),
);

export function isVerifiedZiweiPatternKey(value: unknown): value is string {
  return typeof value === 'string' && VERIFIED_ZIWEI_PATTERN_STABLE_KEYS.has(value);
}

function assertValidPatternPalaces(
  palaces: PalaceFact[] | undefined,
): asserts palaces is PalaceFact[] {
  if (!Array.isArray(palaces) || palaces.length !== ZIWEI_PALACE_COUNT) {
    throw new Error('紫微格局检测需要完整 12 宫数据。');
  }

  const seenIndexes = new Set<number>();
  let soulPalaceCount = 0;

  palaces.forEach((palace, position) => {
    if (
      !Number.isInteger(palace?.index) ||
      palace.index < 0 ||
      palace.index >= ZIWEI_PALACE_COUNT
    ) {
      throw new Error(`紫微格局检测第 ${position + 1} 个宫位索引无效。`);
    }
    if (seenIndexes.has(palace.index)) {
      throw new Error(`紫微格局检测宫位索引 ${palace.index} 重复。`);
    }
    seenIndexes.add(palace.index);

    if (typeof palace.name !== 'string' || !palace.name.trim()) {
      throw new Error(`紫微格局检测第 ${position + 1} 个宫位名称缺失。`);
    }
    if (normalizePalaceName(palace.name) === '命') soulPalaceCount += 1;
    if (typeof palace.earthly_branch !== 'string' || !palace.earthly_branch.trim()) {
      throw new Error(`紫微格局检测${palace.name}地支缺失。`);
    }
    if (!Array.isArray(palace.major_stars)) {
      throw new Error(`紫微格局检测${palace.name}主星数据无效。`);
    }
    if (!Array.isArray(palace.minor_stars)) {
      throw new Error(`紫微格局检测${palace.name}辅星数据无效。`);
    }
    if (!Array.isArray(palace.other_stars)) {
      throw new Error(`紫微格局检测${palace.name}杂曜数据无效。`);
    }
    if (!Array.isArray(palace.scope_stars)) {
      throw new Error(`紫微格局检测${palace.name}运限星曜数据无效。`);
    }
  });

  if (soulPalaceCount !== 1) {
    throw new Error('紫微格局检测必须且只能包含一个命宫。');
  }

  palaces.forEach((palace) => {
    if (
      !Number.isInteger(palace.opposite_palace_index) ||
      !seenIndexes.has(palace.opposite_palace_index)
    ) {
      throw new Error(`紫微格局检测${palace.name}对宫索引无效。`);
    }
    if (
      !Array.isArray(palace.surrounded_palace_indexes) ||
      palace.surrounded_palace_indexes.length === 0
    ) {
      throw new Error(`紫微格局检测${palace.name}三方四正数据无效。`);
    }
    palace.surrounded_palace_indexes.forEach((index) => {
      if (!Number.isInteger(index) || !seenIndexes.has(index)) {
        throw new Error(`紫微格局检测${palace.name}三方四正宫位索引无效。`);
      }
    });
  });
}

function hasValidPatternPalaces(palaces: PalaceFact[] | undefined): boolean {
  try {
    assertValidPatternPalaces(palaces);
    return true;
  } catch {
    return false;
  }
}

function createPatternContext(params: {
  palaces: PalaceFact[];
  birthYearHeavenlyStem?: string;
}): PatternContext {
  const soulPalace = params.palaces.find((palace) => normalizePalaceName(palace.name) === '命');
  if (!soulPalace) throw new Error('紫微格局检测缺少命宫。');
  return {
    palaces: params.palaces,
    palaceByIndex: new Map(params.palaces.map((palace) => [palace.index, palace])),
    soulPalace,
    birthYearHeavenlyStem: params.birthYearHeavenlyStem,
  };
}

function canEvaluatePatternRule(rule: VerifiedPatternRule, context: PatternContext): boolean {
  return rule.canEvaluate?.(context) ?? true;
}

export const ZIWEI_PATTERN_AUDIT_NOTICE =
  `原有${RETIRED_UNVERIFIED_PATTERN_COUNT}条项目格局规则已全部退役；固定版本传统目录现登记${ZIWEI_TRADITIONAL_PATTERN_CATALOG_COUNT}项，其中${VERIFIED_ZIWEI_PATTERN_RULE_COUNT}条具备卷次、原文和可复算条件，${ZIWEI_TRADITIONAL_PATTERN_BOUNDARIES.length}项明确登记为不可唯一复算边界` as const;

export function detectPatterns(params: {
  palaces: PalaceFact[];
  birthTimeLabel?: string;
  birthTimeRange?: string;
  birthYearHeavenlyStem?: string;
}): PatternFact[] {
  assertValidPatternPalaces(params.palaces);
  const context = createPatternContext(params);

  return VERIFIED_PATTERN_RULES.flatMap((rule): PatternFact[] => {
    if (!canEvaluatePatternRule(rule, context)) return [];
    const match = rule.detect(context);
    if (!match) return [];
    const stableKey = `ziwei:verified-pattern:${rule.id}`;
    const sources = [`${rule.sourceTitle}：“${rule.sourceQuote}”`, `${rule.sourceUrl}`];
    return [
      {
        id: rule.id,
        stable_key: stableKey,
        key: stableKey,
        status: '已命中',
        name: rule.name,
        kind: rule.kind,
        description: rule.description,
        palace_indexes: uniquePalaces(match.palaces).map((palace) => palace.index),
        palace_names: uniquePalaces(match.palaces).map((palace) => palace.name),
        star_names: [...new Set(match.stars)],
        matched_conditions: match.conditions,
        traditional_interpretation: rule.traditionalInterpretation,
        source: rule.sourceUrl,
        sources,
        calculation: rule.calculation,
        calculationStepKey: PATTERN_MATCHED_FACTS_STEP_KEY,
        dependsOnStepKeys: [PATTERN_RULE_STEP_KEY],
        promptText: `${rule.name}：${match.conditions.join('；')}。`,
        limitation: PATTERN_FACT_LIMITATION,
        limitations: [
          '命中只表示当前盘面满足这一条登记条件，不代表整盘吉凶或现实结果。',
          '只评估当前已登记规则；未输出的格局不得解释为不存在。',
        ],
      },
    ];
  });
}

export function selectVerifiedZiweiPatterns(params: {
  patterns: PatternFact[];
  palaces: PalaceFact[];
  birthTimeLabel?: string;
  birthTimeRange?: string;
  birthYearHeavenlyStem?: string;
}): PatternFact[] {
  if (!hasValidPatternPalaces(params.palaces)) return [];

  const requestedStableKeys = new Set(
    params.patterns.flatMap((pattern) => {
      const stableKey = pattern.stable_key ?? pattern.key;
      const hasConflictingKeys =
        pattern.stable_key !== undefined &&
        pattern.key !== undefined &&
        pattern.stable_key !== pattern.key;
      return pattern.status === '已命中' &&
        !hasConflictingKeys &&
        isVerifiedZiweiPatternKey(stableKey)
        ? [stableKey]
        : [];
    }),
  );

  return detectPatterns({
    palaces: params.palaces,
    birthTimeLabel: params.birthTimeLabel,
    birthTimeRange: params.birthTimeRange,
    birthYearHeavenlyStem: params.birthYearHeavenlyStem,
  }).filter((pattern) => requestedStableKeys.has(pattern.stable_key ?? pattern.key ?? ''));
}

export function buildPatternAnalysis(params: {
  patterns: PatternFact[];
  palaces: PalaceFact[];
  skipped?: boolean;
  sourceUnverified?: boolean;
  birthTimeLabel?: string;
  birthTimeRange?: string;
  birthYearHeavenlyStem?: string;
}): ZiweiPatternAnalysis {
  const { patterns, palaces, skipped = false, sourceUnverified = false } = params;
  const blockedBySourceAudit = sourceUnverified;
  const uniquePalaceIndexCount = new Set(palaces.map((item) => item.index)).size;
  const palaceDataComplete = hasValidPatternPalaces(palaces);
  const registeredRuleCount = blockedBySourceAudit ? 0 : VERIFIED_ZIWEI_PATTERN_RULE_COUNT;
  const evaluationContext = palaceDataComplete
    ? createPatternContext({
        palaces,
        birthYearHeavenlyStem: params.birthYearHeavenlyStem,
      })
    : null;
  const evaluatedRuleCount =
    skipped || blockedBySourceAudit || !evaluationContext
      ? 0
      : VERIFIED_PATTERN_RULES.filter((rule) => canEvaluatePatternRule(rule, evaluationContext))
          .length;
  const unevaluatedRuleCount = registeredRuleCount - evaluatedRuleCount;
  const acceptedPatterns =
    skipped || blockedBySourceAudit
      ? []
      : selectVerifiedZiweiPatterns({
          patterns,
          palaces,
          birthTimeLabel: params.birthTimeLabel,
          birthTimeRange: params.birthTimeRange,
          birthYearHeavenlyStem: params.birthYearHeavenlyStem,
        });
  const matchedPatternCount = acceptedPatterns.length;
  const unmatchedRuleCount = Math.max(0, evaluatedRuleCount - matchedPatternCount);
  const patternFactKeys = acceptedPatterns.flatMap((item) => {
    const stableKey = item.stable_key ?? item.key;
    return isVerifiedZiweiPatternKey(stableKey) ? [stableKey] : [];
  });
  const summaryStatus: ZiweiPatternSummaryFact['status'] =
    skipped || blockedBySourceAudit
      ? '未生成'
      : !palaceDataComplete || unevaluatedRuleCount > 0
        ? '资料不足'
        : matchedPatternCount === 0
          ? '未命中'
          : '已完成';
  const analysisStatus: ZiweiPatternAnalysis['status'] =
    skipped || blockedBySourceAudit
      ? '未生成'
      : !palaceDataComplete || unevaluatedRuleCount > 0
        ? '资料不足'
        : matchedPatternCount === 0
          ? '未命中'
          : '已计算';

  const calculationSteps: ZiweiPatternCalculationStep[] = [
    {
      key: 'ziwei:pattern:calculation:input',
      stage: '十二宫输入校验',
      status: palaceDataComplete ? '已计算' : '资料不足',
      dependsOnStepKeys: [],
      inputs: { palaceCount: palaces.length },
      result: { palaceDataComplete, uniquePalaceIndexCount },
      promptText: palaceDataComplete
        ? '已校验完整十二宫及唯一宫位索引'
        : `当前仅有${palaces.length}项宫位资料或宫位索引不唯一，不执行格局规则评估`,
      sources: ['紫微十二宫结构化盘面资料'],
      limitation: PATTERN_CALCULATION_LIMITATION,
    },
    {
      key: PATTERN_RULE_STEP_KEY,
      stage: '格局规则评估',
      status:
        skipped || blockedBySourceAudit
          ? '未生成'
          : palaceDataComplete && unevaluatedRuleCount === 0
            ? '已计算'
            : '资料不足',
      dependsOnStepKeys: ['ziwei:pattern:calculation:input'],
      inputs: {
        registeredRuleCount,
        palaceDataComplete,
        birthYearHeavenlyStem: params.birthYearHeavenlyStem ?? '未提供',
      },
      result: { evaluatedRuleCount, unevaluatedRuleCount },
      promptText: skipped
        ? '本次明确跳过格局规则评估，未生成格局命中或未命中事实'
        : blockedBySourceAudit
          ? `${ZIWEI_PATTERN_AUDIT_NOTICE}，本次调用未接入已校勘登记表`
          : `已按固定古籍版本逐条评估${evaluatedRuleCount}条可复算规则；${unevaluatedRuleCount}条因必要输入不足未评估；另有${ZIWEI_TRADITIONAL_PATTERN_BOUNDARIES.length}项原典边界未伪造命中`,
      sources: [
        `《紫微斗数全书》卷一固定修订版 ${VOLUME_ONE_URL}`,
        `《紫微斗数全书》卷三固定修订版 ${VOLUME_THREE_URL}`,
      ],
      limitation: PATTERN_CALCULATION_LIMITATION,
    },
    {
      key: PATTERN_MATCHED_FACTS_STEP_KEY,
      stage: '命中事实登记',
      status:
        skipped || blockedBySourceAudit
          ? '未生成'
          : palaceDataComplete && unevaluatedRuleCount === 0
            ? '已计算'
            : '资料不足',
      dependsOnStepKeys: [PATTERN_RULE_STEP_KEY],
      inputs: { evaluatedRuleCount },
      result: { matchedPatternCount, unmatchedRuleCount, matchedPatternKeys: patternFactKeys },
      promptText: skipped
        ? '本次明确跳过格局命中事实登记'
        : blockedBySourceAudit
          ? '本次调用未使用已校勘登记表，不生成格局命中事实'
          : `登记${matchedPatternCount}项已校勘格局事实`,
      sources: ['逐条规则评估结果与实际命中宫位、星曜'],
      limitation: PATTERN_CALCULATION_LIMITATION,
    },
    {
      key: 'ziwei:pattern:calculation:summary',
      stage: '格局覆盖汇总',
      status:
        skipped || blockedBySourceAudit
          ? '未生成'
          : palaceDataComplete && unevaluatedRuleCount === 0
            ? '已计算'
            : '资料不足',
      dependsOnStepKeys: [PATTERN_MATCHED_FACTS_STEP_KEY],
      inputs: { registeredRuleCount, evaluatedRuleCount, matchedPatternCount },
      result: { summaryStatus, unmatchedRuleCount, unevaluatedRuleCount },
      promptText: `格局规则覆盖状态为${summaryStatus}；登记${registeredRuleCount}条，评估${evaluatedRuleCount}条，命中${matchedPatternCount}项`,
      sources: ['格局规则来源审查与命中事实汇总'],
      limitation: PATTERN_CALCULATION_LIMITATION,
    },
  ];

  const counterEvidenceFacts: ZiweiPatternCounterEvidenceFact[] = [
    {
      key: 'ziwei:pattern:counter:palace-coverage',
      type: '十二宫资料覆盖',
      status:
        skipped || blockedBySourceAudit ? '未生成' : palaceDataComplete ? '有可用证据' : '资料不足',
      ownerFactKeys: ['ziwei:pattern:calculation:input'],
      promptText: skipped
        ? '本次明确跳过格局分析，未使用十二宫资料形成格局结论'
        : palaceDataComplete
          ? '十二宫资料与宫位索引完整'
          : '十二宫资料不完整，格局分析必须降级且不得补造命中结果',
      sources: ['十二宫输入校验结果'],
      limitation: PATTERN_COUNTER_LIMITATION,
    },
    {
      key: 'ziwei:pattern:counter:rule-coverage',
      type: '登记规则覆盖',
      status:
        skipped || blockedBySourceAudit
          ? '未生成'
          : palaceDataComplete && unevaluatedRuleCount === 0
            ? '有可用证据'
            : '资料不足',
      ownerFactKeys: [PATTERN_RULE_STEP_KEY, ...patternFactKeys],
      promptText: skipped
        ? '本次明确跳过登记规则评估，不形成格局覆盖结论'
        : blockedBySourceAudit
          ? `${ZIWEI_PATTERN_AUDIT_NOTICE}；不得把空结果解释为没有传统格局`
          : `当前登记${registeredRuleCount}条已校勘规则，其中已评估${evaluatedRuleCount}条、必要输入不足${unevaluatedRuleCount}条；另登记${ZIWEI_TRADITIONAL_PATTERN_BOUNDARIES.length}项不可唯一复算边界，目录外格局不作判断`,
      sources: ['登记规则固定古籍版本、卷次、原文与计算条件'],
      limitation: PATTERN_COUNTER_LIMITATION,
    },
    {
      key: 'ziwei:pattern:counter:unmatched-boundary',
      type: '未命中规则边界',
      status:
        skipped || blockedBySourceAudit
          ? '未生成'
          : palaceDataComplete && unevaluatedRuleCount === 0
            ? '未命中'
            : '资料不足',
      ownerFactKeys: [PATTERN_MATCHED_FACTS_STEP_KEY, ...patternFactKeys],
      promptText: skipped
        ? '本次明确跳过规则评估，不形成格局未命中结论'
        : `已评估规则中有${unmatchedRuleCount}条未命中；这不代表命盘没有其他传统格局`,
      sources: ['当前登记规则逐条评估结果'],
      limitation: PATTERN_COUNTER_LIMITATION,
    },
  ];

  const summaryFact: ZiweiPatternSummaryFact = {
    key: 'ziwei:pattern-summary',
    status: summaryStatus,
    factKeys: [
      ...calculationSteps.map((item) => item.key),
      ...patternFactKeys,
      ...counterEvidenceFacts.map((item) => item.key),
    ],
    registeredRuleCount,
    evaluatedRuleCount,
    unevaluatedRuleCount,
    matchedPatternCount,
    unmatchedRuleCount,
    auspiciousPatternCount: acceptedPatterns.filter((item) => item.kind === 'auspicious').length,
    inauspiciousPatternCount: acceptedPatterns.filter((item) => item.kind === 'inauspicious')
      .length,
    neutralPatternCount: acceptedPatterns.filter((item) => item.kind === 'neutral').length,
    counterEvidenceCount: counterEvidenceFacts.length,
    limitationFactCount: 4,
    promptText: `格局证据状态为${summaryStatus}；传统目录${ZIWEI_TRADITIONAL_PATTERN_CATALOG_COUNT}项，其中可复算规则${registeredRuleCount}条、已评估${evaluatedRuleCount}条、命中${matchedPatternCount}项，另有${ZIWEI_TRADITIONAL_PATTERN_BOUNDARIES.length}项不可唯一复算边界`,
    sources: ['格局规则固定版本、十二宫盘面与命中事实汇总'],
    limitation: PATTERN_SUMMARY_LIMITATION,
  };

  const limitationDefinitions: Array<
    Pick<ZiweiPatternLimitationFact, 'key' | 'type' | 'ownerFactKeys' | 'promptText' | 'sources'>
  > = [
    {
      key: 'ziwei:pattern:limitation:traditional-classification',
      type: '传统分类边界',
      ownerFactKeys: [summaryFact.key, ...patternFactKeys],
      promptText: '吉格、凶格和中性格只属于传统分类标签，不是命盘总分，也不能相互加减抵消',
      sources: ['传统格局分类与量化评分分离原则'],
    },
    {
      key: 'ziwei:pattern:limitation:rule-coverage',
      type: '规则覆盖边界',
      ownerFactKeys: [summaryFact.key, PATTERN_RULE_STEP_KEY],
      promptText: `固定版本传统目录共${ZIWEI_TRADITIONAL_PATTERN_CATALOG_COUNT}项；只对其中${registeredRuleCount}条条件闭合规则计算命中，${ZIWEI_TRADITIONAL_PATTERN_BOUNDARIES.length}项原文含糊或依赖运限的边界不伪造结论`,
      sources: ['紫微格局逐条来源审查结果'],
    },
    {
      key: 'ziwei:pattern:limitation:reality-causality',
      type: '现实因果边界',
      ownerFactKeys: [summaryFact.key, ...patternFactKeys],
      promptText: '规则命中只证明盘面满足登记条件，传统释义不得直接写成现实结果',
      sources: ['盘面结构事实与现实因果分离原则'],
    },
    {
      key: 'ziwei:pattern:limitation:high-risk-output',
      type: '高风险输出边界',
      ownerFactKeys: [summaryFact.key, ...summaryFact.factKeys],
      promptText: '不得根据格局名称、传统分类或命中数量生成概率、保证、必然断语或固定应期',
      sources: ['传统规则事实与高风险现实结论分离原则'],
    },
  ];
  const limitationFacts: ZiweiPatternLimitationFact[] = limitationDefinitions.map((definition) => ({
    ...definition,
    status: '适用',
    limitation: PATTERN_FACT_LIMITATION,
  }));
  const counterEvidence = counterEvidenceFacts
    .filter((item) => item.status !== '有可用证据')
    .map((item) => item.promptText);
  const limitations = limitationFacts.map((item) => item.promptText);

  return {
    key: 'ziwei:patterns',
    status: analysisStatus,
    calculationSteps,
    calculationChain: calculationSteps.map((item) => item.promptText),
    counterEvidence,
    counterEvidenceFacts,
    summaryFact,
    limitations,
    limitationFacts,
    promptText: [
      '【紫微格局结构化证据】',
      `计算链：${calculationSteps.map((item) => item.promptText).join(' → ')}。`,
      `反证核验：${counterEvidence.join('；') || '当前登记规则已完成逐条评估'}。`,
      `证据汇总：${summaryFact.promptText}。`,
      `解释限制：${limitations.join('；')}。`,
    ].join('\n'),
    methodology: {
      notes: [
        `仅执行${VERIFIED_ZIWEI_PATTERN_RULE_COUNT}条具备固定版本、卷次、原文与可复算条件的登记规则。`,
        `另登记${ZIWEI_TRADITIONAL_PATTERN_BOUNDARIES.length}项固定版本原典边界，逐项保留名称、原文与不能复算的原因。`,
        `原有${RETIRED_UNVERIFIED_PATTERN_COUNT}条规则已整体退役，未通过校勘的部分不会借用旧实现。`,
        '空格局列表只表示当前登记规则未命中，不代表命盘不存在其他传统格局。',
      ],
    },
  };
}
