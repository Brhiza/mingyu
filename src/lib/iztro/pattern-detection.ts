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
    description: '命宫三方四正见天机、太阴、天同、天梁，主温和稳健、适合稳定型职业。',
    priority: 86,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
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
    description: '命宫三方四正同时见禄存与化禄，主财源流畅、贵显富厚。',
    priority: 88,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      const hasLuStar = surroundedHasOneOf(context, ming, ['禄存']);
      const surroundedBirth = getSurroundedMutagens(context, ming, 'birth_mutagen');
      const surroundedScope = getSurroundedMutagens(context, ming, 'active_scope_mutagen');
      const hasHuaLu = surroundedBirth.includes('禄') || surroundedScope.includes('禄');
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
    description: '禄存或化禄坐命，对宫亦见禄星，主明暗皆得财、收入隐稳。',
    priority: 80,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      const opposite = getOppositePalace(context, ming);
      if (!opposite) return null;
      const mingHasLu =
        hasStar(ming, '禄存') ||
        getAllStars(ming).some(
          (star) => star.birth_mutagen === '禄' || star.active_scope_mutagen === '禄',
        );
      const oppositeHasLu =
        hasStar(opposite, '禄存') ||
        getAllStars(opposite).some(
          (star) => star.birth_mutagen === '禄' || star.active_scope_mutagen === '禄',
        );
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
        const prevHasYang = hasStar(prev, '擎羊');
        const nextHasTuo = hasStar(next, '陀罗');
        const prevHasTuo = hasStar(prev, '陀罗');
        const nextHasYang = hasStar(next, '擎羊');
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
      if (ming.index === 11 && hasStar(ming, '太阴')) {
        return { palaces: [ming], stars: ['太阴'] };
      }
      return null;
    },
  },
  {
    id: 'ri-zhao-lei-men',
    name: '日照雷门',
    kind: 'auspicious',
    description:
      '太阳坐命卯宫（震位/雷门），主少年得志、声名早显、富贵可期。卯为震卦日出之方，日居卯为旭日初升。',
    priority: 93,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      if (ming.index === 3 && hasStar(ming, '太阳')) {
        return { palaces: [ming], stars: ['太阳'] };
      }
      return null;
    },
  },
  {
    id: 'lu-ma-jiao-chi',
    name: '禄马交驰',
    kind: 'auspicious',
    description: '命宫三方四正同时见禄存（或化禄）与天马，主财禄双美、动中得财。',
    priority: 90,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      const hasLu = surroundedHasOneOf(context, ming, ['禄存']);
      const luMutagen = getSurroundedMutagens(context, ming, 'birth_mutagen').includes('禄');
      const hasMa = surroundedHasOneOf(context, ming, ['天马']);
      if ((hasLu || luMutagen) && hasMa) {
        return { palaces: [ming], stars: ['禄存', '天马'] };
      }
      return null;
    },
  },
  {
    id: 'cai-yin-jia-yin',
    name: '财荫夹印',
    kind: 'auspicious',
    description: '命宫前一宫后一宫分别为天相（印）与天府（财）/化禄夹拱，主因财得官、富贵绵延。',
    priority: 88,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      const { prev, next } = getNeighborPalaces(context, ming);
      if (!prev || !next) return null;
      const hasYin = hasStar(prev, '天相') || hasStar(next, '天相');
      const hasCai = hasStar(prev, '天府') || hasStar(next, '天府');
      if (hasYin && hasCai) {
        return { palaces: [ming, prev, next], stars: ['天相', '天府'] };
      }
      return null;
    },
  },
  {
    id: 'ming-zhu-chu-hai',
    name: '明珠出海',
    kind: 'auspicious',
    description: '命宫在未（命宫无主星借对宫天同巨门），三合方见日卯月亥，主光耀门楣、中年大展。',
    priority: 87,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      const qian = getPalaceByName(context, '迁移');
      if (!ming || !qian) return null;
      if (ming.index !== 7) return null;
      const mStars = getAllStars(ming);
      const hasSunMoonSurrounded =
        surroundedHasOneOf(context, ming, ['太阳']) && surroundedHasOneOf(context, ming, ['太阴']);
      if (mStars.length === 0 && hasSunMoonSurrounded) {
        return { palaces: [ming], stars: ['太阳', '太阴'] };
      }
      return null;
    },
  },
  {
    id: 'xiong-su-qian-yuan',
    name: '雄宿乾元',
    kind: 'auspicious',
    description: '廉贞坐命亥宫（乾位），主刚毅果断、智勇双全。廉贞为雄宿，亥为乾元。',
    priority: 91,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      if (ming.index === 11 && hasStar(ming, '廉贞')) {
        return { palaces: [ming], stars: ['廉贞'] };
      }
      return null;
    },
  },
  {
    id: 'qi-sha-chao-dou',
    name: '七杀朝斗',
    kind: 'auspicious',
    description: '七杀坐命寅或申宫，三方四正见紫微拱照，主刚毅果敢、将帅之才。',
    priority: 89,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      if ((ming.index === 2 || ming.index === 8) && hasStar(ming, '七杀')) {
        return { palaces: [ming], stars: ['七杀'] };
      }
      return null;
    },
  },
  {
    id: 'shi-zhong-yin-yu',
    name: '石中隐玉',
    kind: 'auspicious',
    description: '巨门坐命子宫，三方四正见化禄/化权/化科之一，主才华内敛、晚发。',
    priority: 85,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      if (ming.index === 0 && hasStar(ming, '巨门')) {
        const mutagens = getSurroundedMutagens(context, ming, 'birth_mutagen');
        if (mutagens.some((m) => ['禄', '权', '科'].includes(m))) {
          return { palaces: [ming], stars: ['巨门'] };
        }
      }
      return null;
    },
  },
  {
    id: 'jun-chen-qing-hui',
    name: '君臣庆会',
    kind: 'auspicious',
    description: '紫微坐命，三方四正见天府、天相、左辅、右弼等辅星拱照，主贵气凝聚。',
    priority: 90,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      if (hasStar(ming, '紫微')) {
        const aux = ['左辅', '右弼', '天魁', '天钺', '文昌', '文曲'];
        const count = aux.filter((s) => surroundedHasOneOf(context, ming, [s])).length;
        if (count >= 2) {
          return { palaces: [ming], stars: ['紫微'] };
        }
      }
      return null;
    },
  },

  // ── 凶格 ──
  {
    id: 'xing-qiu-jia-yin',
    name: '刑囚夹印',
    kind: 'inauspicious',
    description:
      '天相（印）被廉贞（囚）与擎羊/巨门（刑）前后夹制，主官非、刑伤。天相所在宫被廉贞与擎羊夹。',
    priority: 90,
    detect(context) {
      for (const palace of context.palaces) {
        if (!hasStar(palace, '天相')) continue;
        const { prev, next } = getNeighborPalaces(context, palace);
        if (!prev || !next) continue;
        const lz = hasStar(prev, '廉贞') || hasStar(next, '廉贞');
        const qyOrJm =
          hasStar(prev, '擎羊') ||
          hasStar(next, '擎羊') ||
          hasStar(prev, '巨门') ||
          hasStar(next, '巨门');
        if (lz && qyOrJm) {
          return { palaces: [palace, prev, next], stars: ['廉贞', '天相'] };
        }
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
      const huo = hasStar(prev, '火星') || hasStar(next, '火星');
      const ling = hasStar(prev, '铃星') || hasStar(next, '铃星');
      if (huo && ling) {
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
    description: '天同坐命午宫（马头），三方四正见擎羊（箭），主中年奔波劳苦、孤克。',
    priority: 86,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      if (ming.index === 6 && hasStar(ming, '天同')) {
        if (surroundedHasOneOf(context, ming, ['擎羊'])) {
          return { palaces: [ming], stars: ['天同', '擎羊'] };
        }
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
      const kong = hasStar(prev, '地空') || hasStar(next, '地空');
      const jie = hasStar(prev, '地劫') || hasStar(next, '地劫');
      if (kong && jie) {
        return { palaces: [ming, prev, next], stars: ['地空', '地劫'] };
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
      if (ming.index === 10 && hasStar(ming, '太阳')) {
        return { palaces: [ming], stars: ['太阳'] };
      }
      if (ming.index === 4 && hasStar(ming, '太阴')) {
        return { palaces: [ming], stars: ['太阴'] };
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
      if (ming.index === 4) {
        return { palaces: [ming], stars: [] };
      }
      if (ming.index === 10) {
        return { palaces: [ming], stars: [] };
      }
      return null;
    },
  },

  // ═══════ 以下为新增补全格局 ═══════

  {
    id: 'wu-tan-tong-xing',
    name: '武贪同行',
    kind: 'neutral',
    description: '武曲与贪狼同坐命宫或财帛宫，主少年艰难、三十后发越。武贪不发少年人。发福在晚。',
    priority: 88,
    detect(context) {
      for (const targetName of ['命宫', '财帛']) {
        const target = getPalaceByName(context, targetName);
        if (!target) continue;
        if (hasAllStars(target, ['武曲', '贪狼'])) {
          return { palaces: [target], stars: ['武曲', '贪狼'] };
        }
      }
      return null;
    },
  },
  {
    id: 'huo-tan-ge',
    name: '火贪格',
    kind: 'auspicious',
    description: '火星与贪狼同坐命宫，主暴发、突发之财，横发横破。限运逢之亦然。',
    priority: 92,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      if (hasStar(ming, '火星') && hasStar(ming, '贪狼')) {
        return { palaces: [ming], stars: ['火星', '贪狼'] };
      }
      return null;
    },
  },
  {
    id: 'ling-tan-ge',
    name: '铃贪格',
    kind: 'auspicious',
    description: '铃星与贪狼同坐命宫，主异路功名、偏财爆发，限运逢之亦然。',
    priority: 90,
    detect(context) {
      const ming = getPalaceByName(context, '命宫');
      if (!ming) return null;
      if (hasStar(ming, '铃星') && hasStar(ming, '贪狼')) {
        return { palaces: [ming], stars: ['铃星', '贪狼'] };
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
      const hasHuaLu = getSurroundedMutagens(context, ming, 'birth_mutagen').includes('禄');
      if (hasYang && hasLiang && hasChang && (hasLu || hasHuaLu)) {
        return { palaces: [ming], stars: ['太阳', '天梁', '文昌', '禄存'] };
      }
      return null;
    },
  },
  {
    id: 'ju-ri-tong-gong',
    name: '巨日同宫',
    kind: 'neutral',
    description: '巨门与太阳同坐命宫或迁移宫，主口才辩给、靠嘴谋生。日蔽则减力。',
    priority: 85,
    detect(context) {
      for (const targetName of ['命宫', '迁移']) {
        const target = getPalaceByName(context, targetName);
        if (!target) continue;
        if (hasAllStars(target, ['巨门', '太阳'])) {
          return { palaces: [target], stars: ['巨门', '太阳'] };
        }
      }
      return null;
    },
  },
];

export function detectPatterns(params: { palaces: PalaceFact[] }): PatternFact[] {
  const { palaces } = params;
  if (!palaces.length) return [];

  const palaceByName = new Map<string, PalaceFact>();
  const palaceByIndex = new Map<number, PalaceFact>();

  palaces.forEach((palace) => {
    palaceByName.set(normalizePalaceName(palace.name), palace);
    palaceByIndex.set(palace.index, palace);
  });

  const context: PatternContext = { palaces, palaceByName, palaceByIndex };
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
