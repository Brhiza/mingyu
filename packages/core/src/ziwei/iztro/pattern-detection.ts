/**
 * @file 紫微斗数格局检测引擎
 * @description 按《紫微斗数全书》《紫微斗数全集》《紫微斗数讲义》收录并检测传统吉凶格局。
 * @古籍依据 《紫微斗数全书》卷二"诸星问答"、《紫微斗数全集》"格局篇"
 *
 * 格局检测规则：
 * - 按命宫/三方四正/对宫/邻宫夹制等层面检测星曜组合
 * - 每格返回涉及宫位与主星，供AI细化解读
 * - 优先级评分越高（0-100），格局越典型
 *
 * 格局体系：
 * - 吉格：紫府同宫/紫府夹命/日月并明/日月夹命/日月夹财/日月照璧/辅弼拱主/左右夹命/左右朝垣/魁钺同行/昌曲夹命/文星朝命/玉袖天香/蟾宫折桂/左辅文昌/坐贵向贵/金舆扶驾/科权禄拱命/仰面朝斗/月朗天门/水澄桂萼/日照雷门/日出扶桑/皇殿朝班/天梁居午/对面朝斗/兼文武/文昌武曲/荫印拱身/禄马交驰/禄马佩印/财禄夹马/财印夹禄/财居财位/紫禄同宫/巨机居卯/雄宿朝元/机梁加吉/梁昌庙旺/曲遇梁星/廉杀庙旺/紫破加吉/破军子午/武曲守垣/武贪同行/火贪/贪火相逢/铃贪/权禄生逢/羊刃入庙/阳梁昌禄等
 * - 凶格：羊陀夹忌/火铃夹命/刑囚夹印/财与囚仇/泛水桃花/廉杀巳亥/一生孤贫/君子在野/生不逢时/禄逢两杀/马落空亡/日月藏辉/巨火擎羊/马头带箭/空劫夹命/两重华盖/铃昌陀武等
 * - 平格：杀破狼/日月反背/天罗地网/巨日同宫/武贪同行等
 */

import type { PalaceFact, PatternFact, StarFact } from '../../types/analysis';

type PatternRule = {
  id: string;
  name: string;
  kind: 'auspicious' | 'inauspicious' | 'neutral';
  description: string;
  priority: number;
  detect: (context: PatternContext) => DetectResult | null;
};

type PatternContext = {
  palaces: PalaceFact[];
  palaceByName: Map<string, PalaceFact>;
  palaceByIndex: Map<number, PalaceFact>;
  birthTimeLabel?: string;
  birthTimeRange?: string;
};

type DetectResult = {
  palaces: PalaceFact[];
  stars: string[];
};

function normalizePalaceName(name: string): string {
  return name.endsWith('宫') ? name.slice(0, -1) : name;
}

function getAllStars(palace: PalaceFact): StarFact[] {
  return [...palace.major_stars, ...palace.minor_stars, ...palace.other_stars];
}

function hasStar(palace: PalaceFact, starName: string): boolean {
  return getAllStars(palace).some((star) => star.name === starName);
}

function hasAllStars(palace: PalaceFact, names: string[]): boolean {
  return names.every((name) => hasStar(palace, name));
}

function hasSingleMajorStar(palace: PalaceFact, starName: string): boolean {
  return palace.major_stars.length === 1 && palace.major_stars[0]?.name === starName;
}

/** 检查宫位中是否存在某生年星（scope 为 origin） */
function hasOriginStar(palace: PalaceFact, starName: string): boolean {
  return getAllStars(palace).some((star) => star.name === starName && star.scope === 'origin');
}

function getSurroundedPalaces(context: PatternContext, palace: PalaceFact): PalaceFact[] {
  return palace.surrounded_palace_indexes
    .map((index) => context.palaceByIndex.get(index))
    .filter((item): item is PalaceFact => !!item);
}

function getSurroundedStars(context: PatternContext, palace: PalaceFact): string[] {
  const seen = new Set<string>();
  getSurroundedPalaces(context, palace).forEach((target) => {
    getAllStars(target).forEach((star) => seen.add(star.name));
  });
  return Array.from(seen);
}

function getSurroundedMatchedStarNames(
  context: PatternContext,
  palace: PalaceFact,
  starNames: string[],
): string[] {
  const present = new Set(getSurroundedStars(context, palace));
  return starNames.filter((starName) => present.has(starName));
}

function getSurroundedMutagens(
  context: PatternContext,
  palace: PalaceFact,
  key: 'birth_mutagen' | 'active_scope_mutagen' | 'horoscope_mutagen',
): string[] {
  const seen = new Set<string>();
  getSurroundedPalaces(context, palace).forEach((target) => {
    getAllStars(target).forEach((star) => {
      const value = star[key];
      if (value) seen.add(value);
    });
  });
  return Array.from(seen);
}

function surroundedHasAll(context: PatternContext, palace: PalaceFact, stars: string[]): boolean {
  const all = new Set(getSurroundedStars(context, palace));
  return stars.every((name) => all.has(name));
}

function surroundedHasOneOf(context: PatternContext, palace: PalaceFact, stars: string[]): boolean {
  const all = new Set(getSurroundedStars(context, palace));
  return stars.some((name) => all.has(name));
}

function getPalaceByName(context: PatternContext, name: string): PalaceFact | undefined {
  return context.palaceByName.get(normalizePalaceName(name));
}

function palaceInBranch(palace: PalaceFact, branches: string[]): boolean {
  return branches.includes(palace.earthly_branch);
}

function getOppositePalace(context: PatternContext, palace: PalaceFact): PalaceFact | undefined {
  return context.palaceByIndex.get(palace.opposite_palace_index);
}

function getNeighborPalaces(
  context: PatternContext,
  palace: PalaceFact,
): { prev?: PalaceFact; next?: PalaceFact } {
  const prevIndex = (palace.index + 11) % 12;
  const nextIndex = (palace.index + 1) % 12;
  return {
    prev: context.palaceByIndex.get(prevIndex),
    next: context.palaceByIndex.get(nextIndex),
  };
}

const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const DAYTIME_BRANCHES = new Set(['卯', '辰', '巳', '午', '未', '申']);
const FOUR_MALEFICS = ['擎羊', '陀罗', '火星', '铃星'];
const VOID_STARS = ['空亡', '旬空', '天空', '截空', '截路', '截路空亡'];
const KONG_JIE_STARS = ['地空', '地劫'];
const AUSPICIOUS_SUPPORT_STARS = ['左辅', '右弼', '文昌', '文曲', '天魁', '天钺', '禄存'];
const TEMPLE_OR_PROSPEROUS_BRIGHTNESS = ['庙', '旺'];

function getMatchedStarNames(palace: PalaceFact, starNames: string[]): string[] {
  const present = new Set(getAllStars(palace).map((star) => star.name));
  return starNames.filter((starName) => present.has(starName));
}

function getVoidStars(palace: PalaceFact): string[] {
  return getMatchedStarNames(palace, VOID_STARS);
}

function hasVoidStar(palace: PalaceFact): boolean {
  return getVoidStars(palace).length > 0;
}

function getStarFact(palace: PalaceFact, starName: string): StarFact | undefined {
  return getAllStars(palace).find((star) => star.name === starName);
}

function isTempleOrProsperous(star?: StarFact): boolean {
  return !!star?.brightness && TEMPLE_OR_PROSPEROUS_BRIGHTNESS.includes(star.brightness);
}

function getTempleOrProsperousBirthMutagenStars(
  palace: PalaceFact,
  mutagen: '禄' | '权',
): StarFact[] {
  return getAllStars(palace).filter(
    (star) => star.birth_mutagen === mutagen && isTempleOrProsperous(star),
  );
}

function getKongJieStars(palace: PalaceFact): string[] {
  return getMatchedStarNames(palace, KONG_JIE_STARS);
}

function getAuspiciousSupportStars(palace: PalaceFact): string[] {
  const supportStars = getMatchedStarNames(palace, AUSPICIOUS_SUPPORT_STARS);
  const mutagens = getAllStars(palace)
    .map((star) => star.birth_mutagen)
    .filter((mutagen): mutagen is '禄' | '权' | '科' => !!mutagen && mutagen !== '忌')
    .map((mutagen) => `化${mutagen}`);
  return Array.from(new Set([...supportStars, ...mutagens]));
}

function hasBirthJiOrTianXing(palace: PalaceFact): boolean {
  return hasStar(palace, '天刑') || getAllStars(palace).some((star) => star.birth_mutagen === '忌');
}

function extractBranchFromText(value?: string): string | undefined {
  if (!value) return undefined;
  return BRANCHES.find((branch) => value.includes(branch));
}

function extractStartHour(value?: string): number | undefined {
  if (!value) return undefined;
  const match = /(\d{1,2}):\d{2}/.exec(value);
  if (!match) return undefined;
  const hour = Number(match[1]);
  return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : undefined;
}

function isDaytimeBirth(context: PatternContext): boolean {
  const branch = extractBranchFromText(context.birthTimeLabel);
  if (branch) {
    return DAYTIME_BRANCHES.has(branch);
  }

  const startHour = extractStartHour(context.birthTimeRange);
  return startHour !== undefined && startHour >= 5 && startHour < 17;
}

function isRiYueFanBei(palace: PalaceFact): boolean {
  return (
    (palaceInBranch(palace, ['戌']) && hasStar(palace, '太阳')) ||
    (palaceInBranch(palace, ['辰']) && hasStar(palace, '太阴'))
  );
}

const PATTERN_RULES: PatternRule[] = [
  {
    id: 'ziwei-tianfu-tonggong',
    name: '紫府同宫',
    kind: 'auspicious',
    description: '紫微与天府同坐命宫，主格局稳重、领导力强、人生底盘扎实。',
    priority: 92,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      if (hasAllStars(ming, ['紫微', '天府'])) {
        return { palaces: [ming], stars: ['紫微', '天府'] };
      }
      return null;
    },
  },
  {
    id: 'zi-fu-jia-ming',
    name: '紫府夹命',
    kind: 'auspicious',
    description: '命宫被紫微与天府一前一后夹拱，主贵气扶持、格局厚重。',
    priority: 88,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      const { prev, next } = getNeighborPalaces(context, ming);
      if (!prev || !next) return null;
      const isFlanked =
        (hasStar(prev, '紫微') && hasStar(next, '天府')) ||
        (hasStar(prev, '天府') && hasStar(next, '紫微'));
      if (isFlanked) {
        return { palaces: [ming, prev, next], stars: ['紫微', '天府'] };
      }
      return null;
    },
  },
  {
    id: 'sha-po-lang',
    name: '杀破狼',
    kind: 'neutral',
    description: '命宫三方四正见七杀、破军、贪狼，主一生多变化、需以动制静。',
    priority: 90,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      const required = ['七杀', '破军', '贪狼'];
      if (surroundedHasAll(context, ming, required)) {
        return { palaces: [ming], stars: required };
      }
      return null;
    },
  },
  {
    id: 'ji-yue-tong-liang',
    name: '机月同梁',
    kind: 'auspicious',
    description: '寅申命宫三方四正见天机、太阴、天同、天梁，主温和稳健、适合稳定型职业。',
    priority: 86,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      if (!palaceInBranch(ming, ['寅', '申'])) return null;
      const required = ['天机', '太阴', '天同', '天梁'];
      if (surroundedHasAll(context, ming, required)) {
        return { palaces: [ming], stars: required };
      }
      return null;
    },
  },
  {
    id: 'fu-xiang-chao-yuan',
    name: '府相朝垣',
    kind: 'auspicious',
    description: '命宫三方四正见天府与天相同时拱照，主衣食无忧、得贵人扶持。',
    priority: 84,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      if (surroundedHasAll(context, ming, ['天府', '天相'])) {
        return { palaces: [ming], stars: ['天府', '天相'] };
      }
      return null;
    },
  },
  {
    id: 'fu-bi-gong-zhu',
    name: '辅弼拱主',
    kind: 'auspicious',
    description: '紫微守命，左辅右弼三方来拱或左右夹命，主得助力、贵人扶持。',
    priority: 87,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming || !hasStar(ming, '紫微')) return null;

      const { prev, next } = getNeighborPalaces(context, ming);
      const isJiaMing =
        !!prev &&
        !!next &&
        ((hasStar(prev, '左辅') && hasStar(next, '右弼')) ||
          (hasStar(prev, '右弼') && hasStar(next, '左辅')));
      if (isJiaMing) {
        return { palaces: [ming, prev, next], stars: ['紫微', '左辅', '右弼'] };
      }

      const gongPalaces = getSurroundedPalaces(context, ming).filter(
        (palace) => palace.index !== ming.index,
      );
      const hasZuoFu = gongPalaces.some((palace) => hasStar(palace, '左辅'));
      const hasYouBi = gongPalaces.some((palace) => hasStar(palace, '右弼'));
      if (hasZuoFu && hasYouBi) {
        const palaces = [
          ming,
          ...gongPalaces.filter((palace) => hasStar(palace, '左辅') || hasStar(palace, '右弼')),
        ];
        return { palaces, stars: ['紫微', '左辅', '右弼'] };
      }

      return null;
    },
  },
  {
    id: 'zuo-fu-wen-chang',
    name: '左辅文昌',
    kind: 'auspicious',
    description: '左辅、文昌同守命宫，主才名得助、台辅相扶。',
    priority: 87,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      if (hasAllStars(ming, ['左辅', '文昌'])) {
        return { palaces: [ming], stars: ['左辅', '文昌'] };
      }
      return null;
    },
  },
  {
    id: 'kui-yue-tong-xing',
    name: '魁钺同行',
    kind: 'auspicious',
    description: '天魁、天钺同守命宫，主得贵人台辅、科名助力。',
    priority: 88,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      if (hasAllStars(ming, ['天魁', '天钺'])) {
        return { palaces: [ming], stars: ['天魁', '天钺'] };
      }
      return null;
    },
  },
  {
    id: 'kui-yue-jia-ming',
    name: '魁钺夹命',
    kind: 'auspicious',
    description: '命宫被天魁与天钺一前一后夹拱，主得贵人扶助、科名机缘。',
    priority: 86,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      const { prev, next } = getNeighborPalaces(context, ming);
      if (!prev || !next) return null;
      const isFlanked =
        (hasStar(prev, '天魁') && hasStar(next, '天钺')) ||
        (hasStar(prev, '天钺') && hasStar(next, '天魁'));
      if (isFlanked) {
        return { palaces: [ming, prev, next], stars: ['天魁', '天钺'] };
      }
      return null;
    },
  },
  {
    id: 'chang-qu-jia-ming',
    name: '昌曲夹命',
    kind: 'auspicious',
    description: '命宫被文昌与文曲一前一后夹拱，主文名才学、不贵即富。',
    priority: 86,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      const { prev, next } = getNeighborPalaces(context, ming);
      if (!prev || !next) return null;
      const isFlanked =
        (hasStar(prev, '文昌') && hasStar(next, '文曲')) ||
        (hasStar(prev, '文曲') && hasStar(next, '文昌'));
      if (isFlanked) {
        return { palaces: [ming, prev, next], stars: ['文昌', '文曲'] };
      }
      return null;
    },
  },
  {
    id: 'yu-xiu-tian-xiang',
    name: '玉袖天香',
    kind: 'auspicious',
    description: '文昌、文曲同居福德宫，主福德文曜相扶、才名清雅。',
    priority: 86,
    detect(context) {
      const fuDe = getPalaceByName(context, '福德');
      if (!fuDe) return null;
      if (hasAllStars(fuDe, ['文昌', '文曲'])) {
        return { palaces: [fuDe], stars: ['文昌', '文曲'] };
      }
      return null;
    },
  },
  {
    id: 'chan-gong-zhe-gui',
    name: '蟾宫折桂',
    kind: 'auspicious',
    description: '太阴同文昌或文曲居夫妻宫，主因配偶宫得文曜月华相扶。',
    priority: 86,
    detect(context) {
      const spouse = getPalaceByName(context, '夫妻');
      if (!spouse || !hasStar(spouse, '太阴')) return null;
      const literaryStars = getMatchedStarNames(spouse, ['文昌', '文曲']);
      if (literaryStars.length > 0) {
        return { palaces: [spouse], stars: ['太阴', ...literaryStars] };
      }
      return null;
    },
  },
  {
    id: 'zuo-gui-xiang-gui',
    name: '坐贵向贵',
    kind: 'auspicious',
    description: '天魁或天钺坐命，另一贵星在对宫拱照，主贵人扶助、声名科第。',
    priority: 85,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      const opposite = getOppositePalace(context, ming);
      if (!opposite) return null;
      const isZuoXiang =
        (hasStar(ming, '天魁') && hasStar(opposite, '天钺')) ||
        (hasStar(ming, '天钺') && hasStar(opposite, '天魁'));
      if (isZuoXiang) {
        return { palaces: [ming, opposite], stars: ['天魁', '天钺'] };
      }
      return null;
    },
  },
  {
    id: 'ri-yue-bing-ming',
    name: '日月并明',
    kind: 'auspicious',
    description: '命宫三方四正同见太阳与太阴，主才情智慧并济、阴阳调和。',
    priority: 82,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      if (surroundedHasAll(context, ming, ['太阳', '太阴'])) {
        return { palaces: [ming], stars: ['太阳', '太阴'] };
      }
      return null;
    },
  },
  {
    id: 'ri-yue-jia-ming',
    name: '日月夹命',
    kind: 'auspicious',
    description: '命宫不坐空亡，有吉曜坐守，前后由太阳、太阴夹命，主不权则富。',
    priority: 87,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming || hasVoidStar(ming)) return null;
      const supportStars = getAuspiciousSupportStars(ming);
      if (supportStars.length === 0) return null;
      const { prev, next } = getNeighborPalaces(context, ming);
      if (!prev || !next) return null;
      const isFlanked =
        (hasStar(prev, '太阳') && hasStar(next, '太阴')) ||
        (hasStar(prev, '太阴') && hasStar(next, '太阳'));
      if (isFlanked) {
        return { palaces: [ming, prev, next], stars: ['太阳', '太阴', ...supportStars] };
      }
      return null;
    },
  },
  {
    id: 'ke-quan-lu-gong-ming',
    name: '科权禄拱命',
    kind: 'auspicious',
    description: '命宫三方四正同时见化科、化权、化禄，主功名利禄三全。',
    priority: 95,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      // 三奇拱命（科权禄嘉会）按传统口径取生年四化三曜齐会命三方四正；
      // 运限四化不并入，避免大限/流年化科权与生年化禄混算误判三奇。
      const birthMutagens = new Set(getSurroundedMutagens(context, ming, 'birth_mutagen'));
      const required: Array<'禄' | '权' | '科'> = ['禄', '权', '科'];
      if (required.every((item) => birthMutagens.has(item))) {
        return { palaces: [ming], stars: required };
      }
      return null;
    },
  },
  {
    id: 'shuang-lu-jiao-liu',
    name: '双禄交流',
    kind: 'auspicious',
    description: '命宫三方四正同时见禄存与生年化禄，主财源流畅、贵显富厚。',
    priority: 88,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      const hasLuStar = surroundedHasOneOf(context, ming, ['禄存']);
      // 双禄交流按传统只取生年化禄，不含运限化禄
      const hasHuaLu = getSurroundedMutagens(context, ming, 'birth_mutagen').includes('禄');
      if (hasLuStar && hasHuaLu) {
        return { palaces: [ming], stars: ['禄存', '化禄'] };
      }
      return null;
    },
  },
  {
    id: 'ming-lu-an-lu',
    name: '明禄暗禄',
    kind: 'auspicious',
    description: '禄存或生年化禄坐命，对宫亦见禄星，主明暗皆得财、收入隐稳。',
    priority: 80,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      const opposite = getOppositePalace(context, ming);
      if (!opposite) return null;
      // 明禄暗禄：传统指禄存或生年化禄在命宫（明）和对宫（暗）对应，
      // 不含运限化禄——本命格局不应随大限/流年变化
      const mingHasLu =
        hasStar(ming, '禄存') || getAllStars(ming).some((star) => star.birth_mutagen === '禄');
      const oppositeHasLu =
        hasStar(opposite, '禄存') ||
        getAllStars(opposite).some((star) => star.birth_mutagen === '禄');
      if (mingHasLu && oppositeHasLu) {
        return { palaces: [ming, opposite], stars: ['禄存', '化禄'] };
      }
      return null;
    },
  },
  {
    id: 'yang-tuo-jia-ji',
    name: '羊陀夹忌',
    kind: 'inauspicious',
    description: '化忌坐宫，前一宫见擎羊、后一宫见陀罗夹拱，主该宫主题受双煞夹制。',
    priority: 90,
    detect(context) {
      for (const palace of context.palaces) {
        // 羊陀夹忌按传统口径取生年化忌被生年擎羊、陀罗所夹；
        // 运限化忌不并入，避免大限/流年化忌被夹误判此凶格。
        const hasJi = getAllStars(palace).some((star) => star.birth_mutagen === '忌');
        if (!hasJi) continue;
        const { prev, next } = getNeighborPalaces(context, palace);
        if (!prev || !next) continue;
        // 擎羊和陀罗也限制为生年星（scope === 'origin'），
        // 避免运限擎羊/陀罗临夹时误判本命凶格
        const prevHasYang = hasOriginStar(prev, '擎羊');
        const nextHasTuo = hasOriginStar(next, '陀罗');
        const prevHasTuo = hasOriginStar(prev, '陀罗');
        const nextHasYang = hasOriginStar(next, '擎羊');
        if ((prevHasYang && nextHasTuo) || (prevHasTuo && nextHasYang)) {
          return {
            palaces: [palace, prev, next],
            stars: ['化忌', '擎羊', '陀罗'],
          };
        }
      }
      return null;
    },
  },
  {
    id: 'ling-chang-tuo-wu',
    name: '铃昌陀武',
    kind: 'inauspicious',
    description: '命宫三方四正同时见铃星、文昌、陀罗与武曲，主限运易出意外波折。',
    priority: 78,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      const required = ['铃星', '文昌', '陀罗', '武曲'];
      if (surroundedHasAll(context, ming, required)) {
        return { palaces: [ming], stars: required };
      }
      return null;
    },
  },

  // ═══════ 以下为按《紫微斗数全书》补充的核心格局 ═══════

  // ── 吉格 ──
  {
    id: 'yue-lang-tian-men',
    name: '月朗天门',
    kind: 'auspicious',
    description:
      '太阴坐命亥宫（天门位），主清贵、学识渊博、晚运亨通。亥为天门，月为太阴，夜生人尤吉。',
    priority: 94,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      if (palaceInBranch(ming, ['亥']) && hasStar(ming, '太阴')) {
        return { palaces: [ming], stars: ['太阴'] };
      }
      return null;
    },
  },
  {
    id: 'shui-cheng-gui-e',
    name: '水澄桂萼',
    kind: 'auspicious',
    description: '太阴守命子宫，主清要忠良、月华得位。',
    priority: 93,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      if (palaceInBranch(ming, ['子']) && hasStar(ming, '太阴')) {
        return { palaces: [ming], stars: ['太阴'] };
      }
      return null;
    },
  },
  {
    id: 'yue-sheng-cang-hai',
    name: '月生沧海',
    kind: 'auspicious',
    description: '太阴守田宅子宫，主田宅财资有根基。月在子宫守田宅是也。',
    priority: 88,
    detect(context) {
      const tianZhai = getPalaceByName(context, '田宅');
      if (!tianZhai) return null;
      if (palaceInBranch(tianZhai, ['子']) && hasStar(tianZhai, '太阴')) {
        return { palaces: [tianZhai], stars: ['太阴'] };
      }
      return null;
    },
  },
  {
    id: 'ri-zhao-lei-men',
    name: '日照雷门',
    kind: 'auspicious',
    description:
      '太阳坐命子、辰、卯且昼生，主少年得志、声名早显、富贵可期。卯为震卦日出之方，日居雷门尤典型。',
    priority: 93,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      if (
        palaceInBranch(ming, ['子', '辰', '卯']) &&
        hasStar(ming, '太阳') &&
        isDaytimeBirth(context)
      ) {
        return { palaces: [ming], stars: ['太阳'] };
      }
      return null;
    },
  },
  {
    id: 'jin-can-guang-hui',
    name: '金灿光辉',
    kind: 'auspicious',
    description: '太阳单守午宫命宫，主光明显达。太阳单守，命在午宫是也。',
    priority: 93,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      if (palaceInBranch(ming, ['午']) && hasSingleMajorStar(ming, '太阳')) {
        return { palaces: [ming], stars: ['太阳'] };
      }
      return null;
    },
  },
  {
    id: 'ri-chu-fu-sang',
    name: '日出扶桑',
    kind: 'auspicious',
    description: '太阳在卯守命宫或官禄宫，主名誉显达。日在卯守命是也，守官禄宫亦然。',
    priority: 92,
    detect(context) {
      const targets: PalaceFact[] = [];
      const addTarget = (palace?: PalaceFact) => {
        if (
          palace &&
          palaceInBranch(palace, ['卯']) &&
          hasStar(palace, '太阳') &&
          !targets.some((item) => item.index === palace.index)
        ) {
          targets.push(palace);
        }
      };

      addTarget(getPalaceByName(context, '命宫'));
      addTarget(getPalaceByName(context, '官禄'));

      if (targets.length > 0) {
        return { palaces: targets, stars: ['太阳'] };
      }
      return null;
    },
  },
  {
    id: 'huang-dian-chao-ban',
    name: '皇殿朝班',
    kind: 'auspicious',
    description: '太阳、文昌同居官禄宫，主文章声名入仕、官禄清贵。',
    priority: 88,
    detect(context) {
      const guanLu = getPalaceByName(context, '官禄');
      if (!guanLu) return null;
      if (hasAllStars(guanLu, ['太阳', '文昌'])) {
        return { palaces: [guanLu], stars: ['太阳', '文昌'] };
      }
      return null;
    },
  },
  {
    id: 'tian-liang-ju-wu',
    name: '天梁居午',
    kind: 'auspicious',
    description: '天梁守命午宫，主官资清显、声望端正。',
    priority: 88,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      if (palaceInBranch(ming, ['午']) && hasStar(ming, '天梁')) {
        return { palaces: [ming], stars: ['天梁'] };
      }
      return null;
    },
  },
  {
    id: 'lu-ma-jiao-chi',
    name: '禄马交驰',
    kind: 'auspicious',
    description: '命宫三方四正同时见禄存与天马，主财禄双美、动中得财。',
    priority: 90,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      const hasLu = surroundedHasOneOf(context, ming, ['禄存']);
      const hasMa = surroundedHasOneOf(context, ming, ['天马']);
      if (hasLu && hasMa) {
        return { palaces: [ming], stars: ['禄存', '天马'] };
      }
      return null;
    },
  },
  {
    id: 'cai-lu-jia-ma',
    name: '财禄夹马',
    kind: 'auspicious',
    description: '天马守命，命宫前后由武曲与禄存夹拱，主财禄动中得发。',
    priority: 86,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming || !hasStar(ming, '天马')) return null;
      const { prev, next } = getNeighborPalaces(context, ming);
      if (!prev || !next) return null;
      const isFlanked =
        (hasStar(prev, '武曲') && hasStar(next, '禄存')) ||
        (hasStar(prev, '禄存') && hasStar(next, '武曲'));
      if (isFlanked) {
        return { palaces: [ming, prev, next], stars: ['天马', '武曲', '禄存'] };
      }
      return null;
    },
  },
  {
    id: 'wu-qu-shou-yuan',
    name: '武曲守垣',
    kind: 'auspicious',
    description: '武曲守命卯宫为贵局；原文限定“余不是”，不扩大到其他宫位。',
    priority: 89,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      if (palaceInBranch(ming, ['卯']) && hasStar(ming, '武曲')) {
        return { palaces: [ming], stars: ['武曲'] };
      }
      return null;
    },
  },
  {
    id: 'cai-yin-jia-yin',
    name: '财荫夹印',
    kind: 'auspicious',
    description:
      '天相（印）坐命宫或田宅宫，被武曲（财星）与天梁（荫星）邻宫夹拱，主因财得官、富贵绵延。',
    priority: 88,
    detect(context) {
      for (const targetName of ['命宫', '田宅']) {
        const target = getPalaceByName(context, targetName);
        if (!target || !hasStar(target, '天相')) continue;
        const { prev, next } = getNeighborPalaces(context, target);
        if (!prev || !next) continue;
        const hasCaiOnLeft = hasStar(prev, '武曲');
        const hasYinOnRight = hasStar(next, '天梁');
        const hasCaiOnRight = hasStar(next, '武曲');
        const hasYinOnLeft = hasStar(prev, '天梁');
        const bothSides = (hasCaiOnLeft && hasYinOnRight) || (hasCaiOnRight && hasYinOnLeft);
        if (bothSides) {
          return { palaces: [target, prev, next], stars: ['天相', '武曲', '天梁'] };
        }
      }
      return null;
    },
  },
  {
    id: 'ri-yue-jia-cai',
    name: '日月夹财',
    kind: 'auspicious',
    description: '命宫武曲，或财帛宫见武曲、天府，前后由太阳、太阴夹拱，主财气丰厚。',
    priority: 87,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      const caiBo = getPalaceByName(context, '财帛');
      const targets: Array<{ palace: PalaceFact; centerStar: string }> = [];
      if (ming && hasStar(ming, '武曲')) {
        targets.push({ palace: ming, centerStar: '武曲' });
      }
      if (caiBo && hasStar(caiBo, '武曲')) {
        targets.push({ palace: caiBo, centerStar: '武曲' });
      } else if (caiBo && hasStar(caiBo, '天府')) {
        targets.push({ palace: caiBo, centerStar: '天府' });
      }

      for (const { palace, centerStar } of targets) {
        const { prev, next } = getNeighborPalaces(context, palace);
        if (!prev || !next) continue;
        const isFlanked =
          (hasStar(prev, '太阳') && hasStar(next, '太阴')) ||
          (hasStar(prev, '太阴') && hasStar(next, '太阳'));
        if (isFlanked) {
          return { palaces: [palace, prev, next], stars: [centerStar, '太阳', '太阴'] };
        }
      }

      return null;
    },
  },
  {
    id: 'cai-ju-cai-wei',
    name: '财居财位',
    kind: 'auspicious',
    description: '武曲守财帛宫且不坐空亡，主财星入财位、财库有根。',
    priority: 87,
    detect(context) {
      const caiBo = getPalaceByName(context, '财帛');
      if (!caiBo || hasVoidStar(caiBo)) return null;
      if (hasStar(caiBo, '武曲')) {
        return { palaces: [caiBo], stars: ['武曲'] };
      }
      return null;
    },
  },
  {
    id: 'ri-yue-zhao-bi',
    name: '日月照璧',
    kind: 'auspicious',
    description: '太阳、太阴同临田宅宫，主田宅资产得日月照临；田宅居辰戌丑未更典型。',
    priority: 85,
    detect(context) {
      const tianZhai = getPalaceByName(context, '田宅');
      if (!tianZhai) return null;
      if (hasAllStars(tianZhai, ['太阳', '太阴'])) {
        return { palaces: [tianZhai], stars: ['太阳', '太阴'] };
      }
      return null;
    },
  },
  {
    id: 'cai-yin-jia-lu',
    name: '财印夹禄',
    kind: 'auspicious',
    description: '禄存守命宫或财帛宫，前后由天梁、天相夹拱，主财禄与声望相辅。',
    priority: 86,
    detect(context) {
      const targets = [getPalaceByName(context, '命宫'), getPalaceByName(context, '财帛')].filter(
        (palace): palace is PalaceFact => !!palace && hasStar(palace, '禄存'),
      );

      for (const target of targets) {
        const { prev, next } = getNeighborPalaces(context, target);
        if (!prev || !next) continue;
        const isFlanked =
          (hasStar(prev, '天梁') && hasStar(next, '天相')) ||
          (hasStar(prev, '天相') && hasStar(next, '天梁'));
        if (isFlanked) {
          return { palaces: [target, prev, next], stars: ['禄存', '天梁', '天相'] };
        }
      }

      return null;
    },
  },
  {
    id: 'dui-mian-chao-dou',
    name: '对面朝斗',
    kind: 'auspicious',
    description: '命宫在子午宫且逢禄存，主得禄朝垣、财禄有根。',
    priority: 87,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      if (palaceInBranch(ming, ['子', '午']) && hasStar(ming, '禄存')) {
        return { palaces: [ming], stars: ['禄存'] };
      }
      return null;
    },
  },
  {
    id: 'jian-wen-wu',
    name: '兼文武',
    kind: 'auspicious',
    description: '文曲、武曲同在命宫或身宫，主文武兼备、才艺与执行力并见。',
    priority: 86,
    detect(context) {
      const candidates: PalaceFact[] = [];
      const addCandidate = (palace?: PalaceFact) => {
        if (palace && !candidates.some((item) => item.index === palace.index)) {
          candidates.push(palace);
        }
      };

      addCandidate(getPalaceByName(context, '命宫'));
      context.palaces.filter((palace) => palace.is_body_palace).forEach(addCandidate);

      const target = candidates.find((palace) => hasAllStars(palace, ['文曲', '武曲']));
      if (target) {
        return { palaces: [target], stars: ['文曲', '武曲'] };
      }
      return null;
    },
  },
  {
    id: 'wen-chang-wu-qu',
    name: '文昌武曲',
    kind: 'auspicious',
    description: '文昌、武曲同守命宫或身宫，主文正兼备、多学多能。',
    priority: 86,
    detect(context) {
      const candidates: PalaceFact[] = [];
      const ming = getPalaceByName(context, '命宫');
      if (ming) candidates.push(ming);
      context.palaces
        .filter(
          (palace) =>
            palace.is_body_palace && !candidates.some((item) => item.index === palace.index),
        )
        .forEach((palace) => candidates.push(palace));

      const target = candidates.find((palace) => hasAllStars(palace, ['文昌', '武曲']));
      if (target) {
        return { palaces: [target], stars: ['文昌', '武曲'] };
      }
      return null;
    },
  },
  {
    id: 'lu-ma-pei-yin',
    name: '禄马佩印',
    kind: 'auspicious',
    description: '命宫三方四正内见天马，马前一宫禄存与天相同宫，主禄马带印、动中得贵。',
    priority: 86,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      const maPalace = getSurroundedPalaces(context, ming).find((palace) => hasStar(palace, '天马'));
      if (!maPalace) return null;
      const frontPalace = context.palaceByIndex.get((maPalace.index + 1) % 12);
      if (frontPalace && hasAllStars(frontPalace, ['禄存', '天相'])) {
        return { palaces: [maPalace, frontPalace], stars: ['天马', '禄存', '天相'] };
      }
      return null;
    },
  },
  {
    id: 'tan-huo-xiang-feng',
    name: '贪火相逢',
    kind: 'auspicious',
    description: '贪狼与火星同守命宫且同居庙旺，主突发显达；落陷不按此格输出。',
    priority: 90,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      const tanLang = getStarFact(ming, '贪狼');
      const huoXing = getStarFact(ming, '火星');
      if (isTempleOrProsperous(tanLang) && isTempleOrProsperous(huoXing)) {
        return { palaces: [ming], stars: ['贪狼', '火星'] };
      }
      return null;
    },
  },
  {
    id: 'quan-lu-sheng-feng',
    name: '权禄生逢',
    kind: 'auspicious',
    description: '生年化权、化禄同守命宫且星曜庙旺，主财官双美；落陷不按此格输出。',
    priority: 89,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      const huaLuStars = getTempleOrProsperousBirthMutagenStars(ming, '禄');
      const huaQuanStars = getTempleOrProsperousBirthMutagenStars(ming, '权');
      if (huaLuStars.length > 0 && huaQuanStars.length > 0) {
        const starNames = Array.from(
          new Set([
            ...huaLuStars.map((star) => star.name),
            ...huaQuanStars.map((star) => star.name),
            '化禄',
            '化权',
          ]),
        );
        return { palaces: [ming], stars: starNames };
      }
      return null;
    },
  },
  {
    id: 'yang-ren-ru-miao',
    name: '羊刃入庙',
    kind: 'auspicious',
    description: '擎羊守命辰戌丑未入庙，又遇吉曜扶助，主刚勇有为、凶曜转用。',
    priority: 86,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      if (!palaceInBranch(ming, ['辰', '戌', '丑', '未']) || !hasStar(ming, '擎羊')) {
        return null;
      }
      const supportStars = getAuspiciousSupportStars(ming);
      if (supportStars.length > 0) {
        return { palaces: [ming], stars: ['擎羊', ...supportStars] };
      }
      return null;
    },
  },
  {
    id: 'zuo-you-jia-ming',
    name: '左右夹命',
    kind: 'auspicious',
    description: '命宫被左辅、右弼一前一后夹拱，主得辅佐助力，不贵则大富。',
    priority: 86,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      const { prev, next } = getNeighborPalaces(context, ming);
      if (!prev || !next) return null;
      const isFlanked =
        (hasStar(prev, '左辅') && hasStar(next, '右弼')) ||
        (hasStar(prev, '右弼') && hasStar(next, '左辅'));
      if (isFlanked) {
        return { palaces: [ming, prev, next], stars: ['左辅', '右弼'] };
      }
      return null;
    },
  },
  {
    id: 'yang-mian-chao-dou',
    name: '仰面朝斗',
    kind: 'auspicious',
    description: '紫微守命子午宫，三方四正见生年科权禄齐照，主贵气显达。',
    priority: 91,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming || !palaceInBranch(ming, ['子', '午']) || !hasStar(ming, '紫微')) return null;
      const mutagens = new Set(getSurroundedMutagens(context, ming, 'birth_mutagen'));
      if (['科', '权', '禄'].every((mutagen) => mutagens.has(mutagen))) {
        return { palaces: [ming], stars: ['紫微', '化科', '化权', '化禄'] };
      }
      return null;
    },
  },
  {
    id: 'zi-lu-tong-gong',
    name: '紫禄同宫',
    kind: 'auspicious',
    description: '紫微与禄存同守命宫，太阳、太阴三方拱照，主贵不可言。',
    priority: 89,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming || !hasAllStars(ming, ['紫微', '禄存'])) return null;
      const shiningPalaces = getSurroundedPalaces(context, ming).filter(
        (palace) => palace.index !== ming.index,
      );
      const hasSun = shiningPalaces.some((palace) => hasStar(palace, '太阳'));
      const hasMoon = shiningPalaces.some((palace) => hasStar(palace, '太阴'));
      if (hasSun && hasMoon) {
        return { palaces: [ming], stars: ['紫微', '禄存', '太阳', '太阴'] };
      }
      return null;
    },
  },
  {
    id: 'ju-ji-ju-mao',
    name: '巨机居卯',
    kind: 'auspicious',
    description: '天机、巨门同守卯宫命宫，主不贵即富；同宫见擎羊则按破格处理。',
    priority: 87,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      if (palaceInBranch(ming, ['卯']) && hasAllStars(ming, ['天机', '巨门']) && !hasStar(ming, '擎羊')) {
        return { palaces: [ming], stars: ['天机', '巨门'] };
      }
      return null;
    },
  },
  {
    id: 'zuo-you-chao-yuan',
    name: '左右朝垣',
    kind: 'auspicious',
    description: '命宫三方四正见左辅、右弼朝拱，主左右扶助、文武显佐。',
    priority: 86,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      if (surroundedHasAll(context, ming, ['左辅', '右弼'])) {
        return { palaces: [ming], stars: ['左辅', '右弼'] };
      }
      return null;
    },
  },
  {
    id: 'wen-xing-chao-ming',
    name: '文星朝命',
    kind: 'auspicious',
    description: '命宫三方四正见文昌、文曲朝拱，主文名才学、科名文章。',
    priority: 86,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      if (surroundedHasAll(context, ming, ['文昌', '文曲'])) {
        return { palaces: [ming], stars: ['文昌', '文曲'] };
      }
      return null;
    },
  },
  {
    id: 'zi-po-jia-ji',
    name: '紫破加吉',
    kind: 'auspicious',
    description: '紫微、破军同守四墓命宫并同宫加吉曜，主富贵可期；无吉不按此格输出。',
    priority: 86,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming || !palaceInBranch(ming, ['辰', '戌', '丑', '未'])) return null;
      if (!hasAllStars(ming, ['紫微', '破军'])) return null;
      const supportStars = getAuspiciousSupportStars(ming);
      if (supportStars.length > 0) {
        return { palaces: [ming], stars: ['紫微', '破军', ...supportStars] };
      }
      return null;
    },
  },
  {
    id: 'po-jun-zi-wu',
    name: '破军子午',
    kind: 'auspicious',
    description: '破军守命子午宫，三方四正不见羊陀火铃，主官资清显。',
    priority: 86,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming || !palaceInBranch(ming, ['子', '午']) || !hasStar(ming, '破军')) return null;
      const maleficStars = getSurroundedMatchedStarNames(context, ming, FOUR_MALEFICS);
      if (maleficStars.length === 0) {
        return { palaces: [ming], stars: ['破军'] };
      }
      return null;
    },
  },
  {
    id: 'yin-yin-gong-shen',
    name: '荫印拱身',
    kind: 'auspicious',
    description: '身宫临田宅且不坐空亡，三方四正见天梁、天相拱冲，主田宅根基与声望相辅。',
    priority: 86,
    detect(context) {
      const targets = context.palaces.filter(
        (palace) => palace.is_body_palace && normalizePalaceName(palace.name) === '田宅',
      );
      const target = targets.find(
        (palace) => !hasVoidStar(palace) && surroundedHasAll(context, palace, ['天梁', '天相']),
      );
      if (target) {
        return { palaces: [target], stars: ['天梁', '天相'] };
      }
      return null;
    },
  },
  {
    id: 'jin-yu-fu-jia',
    name: '金舆扶驾',
    kind: 'auspicious',
    description: '紫微守命，命宫前后由太阳、太阴夹辅，主得日月扶助。',
    priority: 89,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming || !hasStar(ming, '紫微')) return null;
      const { prev, next } = getNeighborPalaces(context, ming);
      if (!prev || !next) return null;
      const sunMoonJia =
        (hasStar(prev, '太阳') && hasStar(next, '太阴')) ||
        (hasStar(prev, '太阴') && hasStar(next, '太阳'));
      if (sunMoonJia) {
        return { palaces: [ming, prev, next], stars: ['紫微', '太阳', '太阴'] };
      }
      return null;
    },
  },
  {
    id: 'ming-zhu-chu-hai',
    name: '明珠出海',
    kind: 'auspicious',
    description: '命宫在未且无主星，太阳在卯、太阴在亥三方拱照，主光耀门楣、中年大展。',
    priority: 87,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      if (!palaceInBranch(ming, ['未'])) return null;
      const surrounded = getSurroundedPalaces(context, ming);
      const hasSunAtMao = surrounded.some(
        (palace) => palaceInBranch(palace, ['卯']) && hasStar(palace, '太阳'),
      );
      const hasMoonAtHai = surrounded.some(
        (palace) => palaceInBranch(palace, ['亥']) && hasStar(palace, '太阴'),
      );
      if (ming.empty_state && hasSunAtMao && hasMoonAtHai) {
        return { palaces: [ming], stars: ['太阳', '太阴'] };
      }
      return null;
    },
  },
  {
    id: 'xiong-su-chao-yuan',
    name: '雄宿朝元',
    kind: 'auspicious',
    description: '廉贞守命申、未宫，且同宫不见四杀，主富贵声扬、刚毅有成。',
    priority: 91,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      if (
        palaceInBranch(ming, ['申', '未']) &&
        hasStar(ming, '廉贞') &&
        getMatchedStarNames(ming, FOUR_MALEFICS).length === 0
      ) {
        return { palaces: [ming], stars: ['廉贞'] };
      }
      return null;
    },
  },
  {
    id: 'ji-liang-jia-ji',
    name: '机梁加吉',
    kind: 'auspicious',
    description: '天机、天梁同守命宫，同宫见辅弼昌曲魁钺禄存或生年化禄权科，且不见刑忌。',
    priority: 88,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      if (
        hasAllStars(ming, ['天机', '天梁']) &&
        getAuspiciousSupportStars(ming).length > 0 &&
        !hasBirthJiOrTianXing(ming)
      ) {
        return { palaces: [ming], stars: ['天机', '天梁', ...getAuspiciousSupportStars(ming)] };
      }
      return null;
    },
  },
  {
    id: 'liang-chang-miao-wang',
    name: '梁昌庙旺',
    kind: 'auspicious',
    description: '天梁、文昌同守命宫，二星同居庙旺，主台纲声望、文职清贵。',
    priority: 88,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      const tianLiang = getStarFact(ming, '天梁');
      const wenChang = getStarFact(ming, '文昌');
      if (isTempleOrProsperous(tianLiang) && isTempleOrProsperous(wenChang)) {
        return { palaces: [ming], stars: ['天梁', '文昌'] };
      }
      return null;
    },
  },
  {
    id: 'qu-yu-liang-xing',
    name: '曲遇梁星',
    kind: 'auspicious',
    description: '天梁、文曲同守命宫，二星同居庙旺，主文名清贵、台纲声望。',
    priority: 87,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      const tianLiang = getStarFact(ming, '天梁');
      const wenQu = getStarFact(ming, '文曲');
      if (isTempleOrProsperous(tianLiang) && isTempleOrProsperous(wenQu)) {
        return { palaces: [ming], stars: ['天梁', '文曲'] };
      }
      return null;
    },
  },
  {
    id: 'lian-sha-miao-wang',
    name: '廉杀庙旺',
    kind: 'auspicious',
    description: '廉贞、七杀同守命宫，二星同居庙旺且不见生年化忌，主反为积富。',
    priority: 88,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      const lianZhen = getStarFact(ming, '廉贞');
      const qiSha = getStarFact(ming, '七杀');
      if (
        isTempleOrProsperous(lianZhen) &&
        isTempleOrProsperous(qiSha) &&
        !getAllStars(ming).some((star) => star.birth_mutagen === '忌')
      ) {
        return { palaces: [ming], stars: ['廉贞', '七杀'] };
      }
      return null;
    },
  },
  {
    id: 'lian-sha-si-hai',
    name: '廉杀巳亥',
    kind: 'inauspicious',
    description: '廉贞、七杀同守巳亥命宫，且不按二星同居庙旺论吉，主漂荡波折。',
    priority: 84,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming || !palaceInBranch(ming, ['巳', '亥'])) return null;
      const lianZhen = getStarFact(ming, '廉贞');
      const qiSha = getStarFact(ming, '七杀');
      if (!lianZhen || !qiSha) return null;
      if (isTempleOrProsperous(lianZhen) && isTempleOrProsperous(qiSha)) return null;
      return { palaces: [ming], stars: ['廉贞', '七杀'] };
    },
  },
  {
    id: 'qi-sha-chao-dou',
    name: '七杀朝斗',
    kind: 'auspicious',
    description: '七杀坐命寅、申、子、午宫，主刚毅果敢、将帅之才；会吉曜则爵禄荣昌。',
    priority: 89,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      if (palaceInBranch(ming, ['寅', '申', '子', '午']) && hasStar(ming, '七杀')) {
        return { palaces: [ming], stars: ['七杀'] };
      }
      return null;
    },
  },
  {
    id: 'shi-zhong-yin-yu',
    name: '石中隐玉',
    kind: 'auspicious',
    description: '巨门坐命子午宫，三方四正见化禄/化权/化科之一，主才华内敛、晚发。',
    priority: 85,
    detect(context) {
      const candidates: PalaceFact[] = [];
      const addCandidate = (palace?: PalaceFact) => {
        if (palace && !candidates.some((item) => item.index === palace.index)) {
          candidates.push(palace);
        }
      };

      addCandidate(getPalaceByName(context, '命宫'));
      context.palaces.filter((palace) => palace.is_body_palace).forEach(addCandidate);

      for (const target of candidates) {
        if (!palaceInBranch(target, ['子', '午']) || !hasStar(target, '巨门')) continue;
        const mutagens = getSurroundedMutagens(context, target, 'birth_mutagen');
        if (mutagens.some((m) => ['禄', '权', '科'].includes(m))) {
          return { palaces: [target], stars: ['巨门'] };
        }
      }
      return null;
    },
  },
  {
    id: 'jun-chen-qing-hui',
    name: '君臣庆会',
    kind: 'auspicious',
    description: '紫微与左辅、右弼同守命宫，更会天相、武曲、太阴尤佳，主贵气凝聚。',
    priority: 90,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      if (hasAllStars(ming, ['紫微', '左辅', '右弼'])) {
        const enhancers = ['天相', '武曲', '太阴'].filter((starName) =>
          surroundedHasOneOf(context, ming, [starName]),
        );
        return { palaces: [ming], stars: ['紫微', '左辅', '右弼', ...enhancers] };
      }
      return null;
    },
  },

  // ── 凶格 ──
  {
    id: 'xing-qiu-jia-yin',
    name: '刑囚夹印',
    kind: 'inauspicious',
    description: '天刑与廉贞同临命宫或身宫，主武勇刚烈，也需留意刑伤是非。',
    priority: 90,
    detect(context) {
      const candidates: PalaceFact[] = [];
      const addCandidate = (palace?: PalaceFact) => {
        if (palace && !candidates.some((item) => item.index === palace.index)) {
          candidates.push(palace);
        }
      };

      addCandidate(getPalaceByName(context, '命宫'));
      context.palaces.filter((palace) => palace.is_body_palace).forEach(addCandidate);

      const target = candidates.find((palace) => hasAllStars(palace, ['天刑', '廉贞']));
      if (target) {
        return { palaces: [target], stars: ['天刑', '廉贞'] };
      }
      return null;
    },
  },
  {
    id: 'cai-yu-qiu-chou',
    name: '财与囚仇',
    kind: 'inauspicious',
    description: '武曲与廉贞同临命宫或身宫，财星遇囚曜，主因财招扰、是非牵缠。',
    priority: 86,
    detect(context) {
      const candidates: PalaceFact[] = [];
      const addCandidate = (palace?: PalaceFact) => {
        if (palace && !candidates.some((item) => item.index === palace.index)) {
          candidates.push(palace);
        }
      };

      addCandidate(getPalaceByName(context, '命宫'));
      context.palaces.filter((palace) => palace.is_body_palace).forEach(addCandidate);

      const target = candidates.find((palace) => hasAllStars(palace, ['武曲', '廉贞']));
      if (target) {
        return { palaces: [target], stars: ['武曲', '廉贞'] };
      }
      return null;
    },
  },
  {
    id: 'fan-shui-tao-hua',
    name: '泛水桃花',
    kind: 'inauspicious',
    description: '贪狼守亥子命宫，又遇擎羊或陀罗，主桃花酒色与刑耗牵缠。',
    priority: 85,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming || !palaceInBranch(ming, ['亥', '子']) || !hasStar(ming, '贪狼')) return null;
      const shaStars = getMatchedStarNames(ming, ['擎羊', '陀罗']);
      if (shaStars.length > 0) {
        return { palaces: [ming], stars: ['贪狼', ...shaStars] };
      }
      return null;
    },
  },
  {
    id: 'yi-sheng-gu-pin',
    name: '一生孤贫',
    kind: 'inauspicious',
    description: '破军陷地守命，主格局孤贫辛劳；只按命宫破军落陷判断。',
    priority: 84,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      const poJunXian = getAllStars(ming).find(
        (star) => star.name === '破军' && star.brightness === '陷',
      );
      if (poJunXian) {
        return { palaces: [ming], stars: ['破军'] };
      }
      return null;
    },
  },
  {
    id: 'jun-zi-zai-ye',
    name: '君子在野',
    kind: 'inauspicious',
    description: '羊陀火铃四杀之一落陷守命宫或身宫，主才志受抑、格局难伸。',
    priority: 83,
    detect(context) {
      const candidates: PalaceFact[] = [];
      const addCandidate = (palace?: PalaceFact) => {
        if (palace && !candidates.some((item) => item.index === palace.index)) {
          candidates.push(palace);
        }
      };

      addCandidate(getPalaceByName(context, '命宫'));
      context.palaces.filter((palace) => palace.is_body_palace).forEach(addCandidate);

      const target = candidates.find((palace) =>
        getAllStars(palace).some(
          (star) => FOUR_MALEFICS.includes(star.name) && star.brightness === '陷',
        ),
      );
      if (target) {
        const matchedStars = Array.from(
          new Set(
            getAllStars(target)
              .filter((star) => FOUR_MALEFICS.includes(star.name) && star.brightness === '陷')
              .map((star) => star.name),
          ),
        );
        return { palaces: [target], stars: matchedStars };
      }
      return null;
    },
  },
  {
    id: 'huo-ling-jia-ming',
    name: '火铃夹命',
    kind: 'inauspicious',
    description: '命宫被火星与铃星一前一后夹拱，主中年灾厄、突发波折。',
    priority: 88,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      const { prev, next } = getNeighborPalaces(context, ming);
      if (!prev || !next) return null;
      const isFlanked =
        (hasStar(prev, '火星') && hasStar(next, '铃星')) ||
        (hasStar(prev, '铃星') && hasStar(next, '火星'));
      if (isFlanked) {
        return { palaces: [ming, prev, next], stars: ['火星', '铃星'] };
      }
      return null;
    },
  },
  {
    id: 'ju-huo-qing-yang',
    name: '巨火擎羊',
    kind: 'inauspicious',
    description: '巨门坐命且三方四正见火星与擎羊，主口舌是非、刑伤暴躁。',
    priority: 87,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      if (hasStar(ming, '巨门')) {
        if (
          surroundedHasOneOf(context, ming, ['火星']) &&
          surroundedHasOneOf(context, ming, ['擎羊'])
        ) {
          return { palaces: [ming], stars: ['巨门', '火星', '擎羊'] };
        }
      }
      return null;
    },
  },
  {
    id: 'ma-tou-dai-jian',
    name: '马头带箭',
    kind: 'inauspicious',
    description: '命宫或身宫天马与擎羊同宫（马有刃），主奔波刑伤；不是单凭午宫论格。',
    priority: 86,
    detect(context) {
      const candidates: PalaceFact[] = [];
      const addCandidate = (palace?: PalaceFact) => {
        if (palace && !candidates.some((item) => item.index === palace.index)) {
          candidates.push(palace);
        }
      };

      addCandidate(getPalaceByName(context, '命宫'));
      context.palaces.filter((palace) => palace.is_body_palace).forEach(addCandidate);

      const target = candidates.find(
        (palace) => hasOriginStar(palace, '天马') && hasOriginStar(palace, '擎羊'),
      );
      if (target) {
        return { palaces: [target], stars: ['天马', '擎羊'] };
      }
      return null;
    },
  },
  {
    id: 'kong-jie-jia-ming',
    name: '空劫夹命',
    kind: 'inauspicious',
    description: '命宫被地空与地劫前后夹拱，主一生起伏不定、际遇多舛。',
    priority: 85,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      const { prev, next } = getNeighborPalaces(context, ming);
      if (!prev || !next) return null;
      const isFlanked =
        (hasStar(prev, '地空') && hasStar(next, '地劫')) ||
        (hasStar(prev, '地劫') && hasStar(next, '地空'));
      if (isFlanked) {
        return { palaces: [ming, prev, next], stars: ['地空', '地劫'] };
      }
      return null;
    },
  },
  {
    id: 'liang-chong-hua-gai',
    name: '两重华盖',
    kind: 'inauspicious',
    description: '禄存与生年化禄同坐命宫，又逢地空或地劫，主双禄被空劫折损。',
    priority: 84,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      const hasLuCun = hasStar(ming, '禄存');
      const hasBirthHuaLu = getAllStars(ming).some((star) => star.birth_mutagen === '禄');
      const kongJieStars = ['地空', '地劫'].filter((starName) => hasStar(ming, starName));
      if (hasLuCun && hasBirthHuaLu && kongJieStars.length > 0) {
        return { palaces: [ming], stars: ['禄存', '化禄', ...kongJieStars] };
      }
      return null;
    },
  },
  {
    id: 'sheng-bu-feng-shi',
    name: '生不逢时',
    kind: 'inauspicious',
    description: '廉贞守命又坐空亡类星曜，主时运不偶、发展多受阻。',
    priority: 84,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming || !hasStar(ming, '廉贞')) return null;
      const voidStars = getVoidStars(ming);
      if (voidStars.length > 0) {
        return { palaces: [ming], stars: ['廉贞', ...voidStars] };
      }
      return null;
    },
  },
  {
    id: 'lu-feng-liang-sha',
    name: '禄逢两杀',
    kind: 'inauspicious',
    description: '命宫三方四正内禄存坐空亡，又同逢地空或地劫，主财禄受损、得而难守。',
    priority: 84,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      const target = getSurroundedPalaces(context, ming).find((palace) => {
        if (!hasStar(palace, '禄存') || !hasVoidStar(palace)) return false;
        return getKongJieStars(palace).length > 0;
      });
      if (target) {
        return {
          palaces: [target],
          stars: ['禄存', ...getVoidStars(target), ...getKongJieStars(target)],
        };
      }
      return null;
    },
  },
  {
    id: 'ma-luo-kong-wang',
    name: '马落空亡',
    kind: 'inauspicious',
    description: '命宫三方四正内天马落空亡类星曜，主奔波劳碌、动而难成。',
    priority: 83,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      const target = getSurroundedPalaces(context, ming).find(
        (palace) => hasStar(palace, '天马') && hasVoidStar(palace),
      );
      if (target) {
        return { palaces: [target], stars: ['天马', ...getVoidStars(target)] };
      }
      return null;
    },
  },
  {
    id: 'ri-yue-cang-hui',
    name: '日月藏辉',
    kind: 'inauspicious',
    description: '日月反背又逢巨门暗曜，主光辉受蔽、劳碌是非加重。',
    priority: 83,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming || !isRiYueFanBei(ming)) return null;
      if (surroundedHasOneOf(context, ming, ['巨门'])) {
        const luminary = hasStar(ming, '太阳') ? '太阳' : '太阴';
        return { palaces: [ming], stars: [luminary, '巨门'] };
      }
      return null;
    },
  },
  {
    id: 'ri-yue-fan-bei',
    name: '日月反背',
    kind: 'neutral',
    description: '太阳坐命戌宫或太阴坐命辰宫，主早年辛劳、中年后发力。日月失其正位，先苦后甜。',
    priority: 82,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      if (isRiYueFanBei(ming)) {
        const luminaries = ['太阳', '太阴'].filter((name) => hasStar(ming, name));
        return { palaces: [ming], stars: luminaries };
      }
      return null;
    },
  },

  // ── 夹制格 ──
  {
    id: 'tian-luo-di-wang',
    name: '天罗地网',
    kind: 'neutral',
    description: '命宫坐辰（天罗）或戌（地网），主早年受困、怀才不遇，需冲破罗网方能大成。',
    priority: 80,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      if (!palaceInBranch(ming, ['辰', '戌'])) return null;
      // 判断是否有吉星解网：紫微、天府坐罗网可解，天同、天梁亦能缓解
      const jieWangStars = ['紫微', '天府', '天同', '天梁', '太阳', '贪狼'];
      const hasJieWang = jieWangStars.some((n) => hasStar(ming, n));
      return {
        palaces: [ming],
        stars: hasJieWang ? jieWangStars.filter((n) => hasStar(ming, n)) : [],
      };
    },
  },

  // ═══════ 以下为新增补全格局 ═══════

  {
    id: 'wu-tan-tong-xing',
    name: '武贪同行',
    kind: 'neutral',
    description:
      '命宫三方四正或身宫、财帛、田宅见武曲与贪狼同宫，主少年艰难、三十后发越。武贪不发少年人。发福在晚。',
    priority: 88,
    detect(context) {
      const candidates: PalaceFact[] = [];
      const addCandidate = (palace?: PalaceFact) => {
        if (palace && !candidates.some((item) => item.index === palace.index)) {
          candidates.push(palace);
        }
      };

      const ming = getPalaceByName(context, '命宫');
      if (ming) {
        getSurroundedPalaces(context, ming).forEach(addCandidate);
      }

      addCandidate(context.palaces.find((palace) => palace.is_body_palace));

      for (const targetName of ['财帛', '田宅']) {
        const target = getPalaceByName(context, targetName);
        addCandidate(target);
      }

      const target = candidates.find((palace) => hasAllStars(palace, ['武曲', '贪狼']));
      if (target) {
        return { palaces: [target], stars: ['武曲', '贪狼'] };
      }
      return null;
    },
  },
  {
    id: 'huo-tan-ge',
    name: '火贪格',
    kind: 'auspicious',
    description: '火星与贪狼同宫照命，主暴发、突发之财，横发横破。限运逢之亦然。',
    priority: 92,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      const target = getSurroundedPalaces(context, ming).find((palace) =>
        hasAllStars(palace, ['火星', '贪狼']),
      );
      if (target) {
        return { palaces: [target], stars: ['火星', '贪狼'] };
      }
      return null;
    },
  },
  {
    id: 'ling-tan-ge',
    name: '铃贪格',
    kind: 'auspicious',
    description: '铃星与贪狼同宫照命，主异路功名、偏财爆发，限运逢之亦然。',
    priority: 90,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      const target = getSurroundedPalaces(context, ming).find((palace) =>
        hasAllStars(palace, ['铃星', '贪狼']),
      );
      if (target) {
        return { palaces: [target], stars: ['铃星', '贪狼'] };
      }
      return null;
    },
  },
  {
    id: 'yang-liang-chang-lu',
    name: '阳梁昌禄',
    kind: 'auspicious',
    description: '太阳、天梁、文昌、禄存会照命宫三方四正，主考试大利、学历高、官运亨通。',
    priority: 91,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      const hasYang = surroundedHasOneOf(context, ming, ['太阳']);
      const hasLiang = surroundedHasOneOf(context, ming, ['天梁']);
      const hasChang = surroundedHasOneOf(context, ming, ['文昌']);
      const hasLu = surroundedHasOneOf(context, ming, ['禄存']);
      if (hasYang && hasLiang && hasChang && hasLu) {
        return { palaces: [ming], stars: ['太阳', '天梁', '文昌', '禄存'] };
      }
      return null;
    },
  },
  {
    id: 'ju-ri-tong-gong',
    name: '巨日同宫',
    kind: 'neutral',
    description: '命宫三方四正见巨门与太阳同宫或拱照，主口才辩给、靠嘴谋生。日蔽则减力。',
    priority: 85,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      if (surroundedHasAll(context, ming, ['巨门', '太阳'])) {
        return { palaces: [ming], stars: ['巨门', '太阳'] };
      }
      return null;
    },
  },
];

export function detectPatterns(params: {
  palaces: PalaceFact[];
  birthTimeLabel?: string;
  birthTimeRange?: string;
}): PatternFact[] {
  const { palaces, birthTimeLabel, birthTimeRange } = params;
  if (!palaces.length) return [];

  const palaceByName = new Map<string, PalaceFact>();
  const palaceByIndex = new Map<number, PalaceFact>();

  palaces.forEach((palace) => {
    palaceByName.set(normalizePalaceName(palace.name), palace);
    palaceByIndex.set(palace.index, palace);
  });

  const context: PatternContext = {
    palaces,
    palaceByName,
    palaceByIndex,
    birthTimeLabel,
    birthTimeRange,
  };
  const patterns: PatternFact[] = [];

  PATTERN_RULES.forEach((rule, index) => {
    const matched = rule.detect(context);
    if (!matched) return;

    patterns.push({
      id: `P${index + 1}`,
      name: rule.name,
      kind: rule.kind,
      description: rule.description,
      priority: rule.priority,
      palace_indexes: matched.palaces.map((palace) => palace.index),
      palace_names: matched.palaces.map((palace) => palace.name),
      star_names: matched.stars,
    });
  });

  return patterns.sort((left, right) => right.priority - left.priority);
}
