import { createRandomContext, randomInt, type RandomOptions } from '../shared/random';
import {
  CHARACTER_TUPLES,
  SANCAI_DATA,
  SHULI_DATA,
  type GeneratedCharacterData,
} from './generated-data';
import { ZHUGE_SIGNS } from './zhuge-signs';

export type Wuxing = '金' | '木' | '水' | '火' | '土';
export type NamingGender = '男' | '女' | '通用';
type CharacterDetail = GeneratedCharacterData;
export interface CharacterSearchFilter {
  strokes?: number;
  strokesMin?: number;
  strokesMax?: number;
  wuxing?: Wuxing;
  radical?: string;
  pinyin?: string;
  commonOnly?: boolean;
  limit?: number;
}

const characterData: Record<string, CharacterDetail> = {};
const allCharacters: CharacterDetail[] = CHARACTER_TUPLES.map(
  ([simplified, traditional, kangxiStrokes, radical, wuxing, pinyin, definition]) => ({
    char: simplified,
    simplified,
    traditional,
    kangxiStrokes,
    radical: radical ?? undefined,
    wuxing,
    pinyin: pinyin ?? undefined,
    definition,
    common: true,
  }),
);
for (const item of allCharacters) {
  characterData[item.simplified] = item;
  characterData[item.traditional] = item;
}
const characterEntries = Object.entries(characterData);

function charDetail(char: string): CharacterDetail | null {
  return characterData[char] ?? null;
}

function searchChars(filter: CharacterSearchFilter = {}) {
  const pinyin = filter.pinyin
    ?.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const unique = new Set<string>();
  const results = [];
  for (const [, item] of characterEntries) {
    if (unique.has(item.char)) continue;
    unique.add(item.char);
    if ((filter.commonOnly ?? true) && !item.common) continue;
    if (filter.strokes !== undefined && item.kangxiStrokes !== filter.strokes) continue;
    if (filter.strokesMin !== undefined && item.kangxiStrokes < filter.strokesMin) continue;
    if (filter.strokesMax !== undefined && item.kangxiStrokes > filter.strokesMax) continue;
    if (filter.wuxing && item.wuxing !== filter.wuxing) continue;
    if (filter.radical && item.radical !== filter.radical) continue;
    if (
      pinyin &&
      !(item.pinyin ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .startsWith(pinyin)
    )
      continue;
    results.push(item);
  }
  return results.slice(0, Math.min(Math.max(filter.limit ?? 50, 0), 200));
}

function shuliEntry(number: number) {
  const reduced = number > 81 ? ((number - 1) % 80) + 1 : number;
  return SHULI_DATA[reduced - 1];
}

function shuliWuxing(number: number): Wuxing {
  return (
    {
      0: '水',
      1: '木',
      2: '木',
      3: '火',
      4: '火',
      5: '土',
      6: '土',
      7: '金',
      8: '金',
      9: '水',
    } as const
  )[number % 10]!;
}

function wuge(surnameStrokes: number[], givenStrokes: number[]) {
  const tian =
    surnameStrokes.length === 1 ? surnameStrokes[0] + 1 : surnameStrokes[0] + surnameStrokes[1];
  const ren = surnameStrokes.at(-1)! + givenStrokes[0];
  const di = givenStrokes.length === 1 ? givenStrokes[0] + 1 : givenStrokes[0] + givenStrokes[1];
  const zong = [...surnameStrokes, ...givenStrokes].reduce((sum, item) => sum + item, 0);
  const wai =
    surnameStrokes.length === 1 && givenStrokes.length === 1
      ? 2
      : surnameStrokes.length === 1
        ? givenStrokes.at(-1)! + 1
        : givenStrokes.length === 1
          ? surnameStrokes[0] + 1
          : surnameStrokes[0] + givenStrokes.at(-1)!;
  return { tian, ren, di, wai, zong };
}

const LEVEL_POINTS: Record<string, number> = { 大吉: 100, 吉: 85, 半吉: 60, 凶: 30, 大凶: 12 };

function scoreName(surname: string, given: string, options: { xiYong?: Wuxing[] } = {}) {
  const surnameDetails = [...surname].map(charDetail);
  const givenDetails = [...given].map(charDetail);
  if ([...surnameDetails, ...givenDetails].some((item) => !item))
    throw new Error('姓名中含字典未收录的汉字');
  const rawGrids = wuge(
    surnameDetails.map((item) => item!.kangxiStrokes),
    givenDetails.map((item) => item!.kangxiStrokes),
  );
  const roles = { tian: '祖运', ren: '主运', di: '前运', wai: '副运', zong: '后运' } as const;
  const grids = Object.fromEntries(
    Object.entries(rawGrids).map(([key, num]) => [
      key,
      { num, wuxing: shuliWuxing(num), role: roles[key as keyof typeof roles], ...shuliEntry(num) },
    ]),
  );
  const combo = `${shuliWuxing(rawGrids.tian)}${shuliWuxing(rawGrids.ren)}${shuliWuxing(rawGrids.di)}`;
  const sancai = (
    SANCAI_DATA as Record<
      string,
      { combo: string; tian_ren: string; ren_di: string; level: string; text: string }
    >
  )[combo];
  const shuli = Math.round(
    LEVEL_POINTS[grids.ren.level] * 0.4 +
      LEVEL_POINTS[grids.zong.level] * 0.25 +
      LEVEL_POINTS[grids.di.level] * 0.2 +
      LEVEL_POINTS[grids.wai.level] * 0.15,
  );
  const sancaiScore = LEVEL_POINTS[sancai.level] ?? 60;
  const preferred = options.xiYong ?? [];
  const matches = givenDetails.filter(
    (item) => item!.wuxing && preferred.includes(item!.wuxing as Wuxing),
  ).length;
  const elementScore = preferred.length
    ? Math.round(40 + (matches / givenDetails.length) * 60)
    : null;
  const total =
    elementScore === null
      ? Math.round(shuli * 0.62 + sancaiScore * 0.38)
      : Math.round(shuli * 0.34 + sancaiScore * 0.21 + elementScore * 0.45);
  return {
    surname,
    given,
    chars: [
      ...surnameDetails.map((item) => ({ ...item!, isSurname: true })),
      ...givenDetails.map((item) => ({ ...item!, isSurname: false })),
    ],
    rawGrids,
    grids,
    sancai,
    scores: { shuli, sancai: sancaiScore, elements: elementScore, total },
  };
}

const NAMING_CHARACTERS: Record<NamingGender, string> = {
  男: '宇宸泽轩睿浩博彦辰昊铭骏承远航嘉瑞景安宁朗修文哲谦毅恒翊晨旭恺峻川源柏森楷钧锦熙煜昭曜清和弘允卓凡',
  女: '宁悦欣妍涵瑶琪琳玥璇诗雅舒婉晴萱芷若依然语桐清欢知夏念安嘉怡可馨慧敏灵韵昭月星澜雪柔梦竹云舒锦书沐瑾',
  通用: '安宁嘉瑞清和知远明轩景行言希思齐书言亦辰予墨乐川星野云舟望舒怀瑾若水之恒以沫允和卓然修远闻溪',
};

const KONGMING_HEXAGRAMS = [
  ['●●●●●', '星震卦', '上上', '彩凤呈祥瑞，麒麟降帝都，祸除迎福到，喜气自然生。'],
  ['●○○○○', '从革卦', '上平', '从革宜变更，时来合运迁，龙门鱼跃过，凡骨作神仙。'],
  ['○●○○○', '曲直卦', '中平', '动作因风便，求谋可托人，若逢戊己土，事事得遂心。'],
  ['○○●○○', '润下卦', '小平', '船放江湖内，滩边获宝多，更宜将大用，灾散福来居。'],
  ['○○○●○', '炎上卦', '下下', '此卦按南方，灾难不可当，官司多不利，目下有灾殃。'],
  ['○○○○●', '稼穑卦', '中平', '且安君子分，勿用小人言，凡事皆当谨，作福保安然。'],
  ['●●○○○', '进求卦', '上上', '国治人安泰，家财见崭兴，进财求旺吉，有福亦平安。'],
  ['●○○○●', '进宝卦', '上吉', '好事承天佑，门楣喜气新，有人相助力，获福尽欢欣。'],
  ['●○●○●', '获安卦', '中吉', '目下如冬树，只待春色到，看看喜色动，渐渐发萌芽。'],
  ['●○○●○', '遂心卦', '中平', '时融逢和气，衰残物再兴，更逢微雨细，喜色又还生。'],
  ['○●●○●', '灾散卦', '大吉', '灾散福门开，无边喜气来，目下相逢处，须当得横财。'],
  ['○●○●○', '上进卦', '上平', '进取逢通达，寒儒衣锦回，何人占此卦，凡事任施为。'],
  ['○●○○●', '暗昧卦', '下凶', '井底观明月，见形却无影，钱财多散失，谨守得安宁。'],
  ['○○●●○', '安静卦', '下中', '心思多不定，求谋未得成，忍耐方为福，守分免灾星。'],
  ['○○●○●', '阻隔卦', '下凶', '枯木逢霜雪，扁舟遇大风，心事无可托，百事不遂通。'],
  ['○○○●●', '保安卦', '平吉', '日出临东海，光辉天下明，动用和合吉，百事自然成。'],
  ['●●●○○', '喜至卦', '中吉', '众恶皆消无，端然福气生，如人行暗夜，今已得天明。'],
  ['●●○●○', '保命卦', '中平', '服药将自保，缠绵词讼连，百凡宜守旧，作福自然安。'],
  ['●●○○●', '犹豫卦', '下下', '卦中多恍惚，钱财暗里磨，恩爱反成怨，人情难相和。'],
  ['●○●●○', '丰稔卦', '上吉', '根实枝叶茂，林多格式高，经营多得利，兰蕙似蓬蒿。'],
  ['●○○●●', '得禄卦', '吉', '高名居禄位，笼鸟得逃生，出入多财宝，更宜远方行。'],
  ['●○●○○', '明显卦', '吉', '明月青天上，今宵照绮筵，家家沾往泽，万里净云烟。'],
  ['○●●●○', '祐福卦', '吉', '福禄得安康，荣华保吉昌，所得皆遂意，千里共兰香。'],
  ['○●●○○', '凝滞卦', '下下', '羸马登程去，饥人走远途，前程多阻隔，后福方无忧。'],
  ['○●○●●', '显达卦', '吉', '三姓俱相伴，祥光得共生，更宜分造化，百福自然增。'],
  ['○○●●●', '福源卦', '吉', '此卦占太和，求谋喜事多，远人归故里，身乐得欢歌。'],
  ['○●●●●', '太平卦', '吉', '春雨滋苗稼，何愁不广收，自然心得乐，安然总无忧。'],
  ['●●●○●', '颠险卦', '不吉', '迢迢途中旋，云横日坠山，心事无可托，前后总皆难。'],
  ['●●○●●', '开发卦', '平', '蚌中珠自见，石内玉增光，进财求旺吉，有祸不成殃。'],
  ['●●●●○', '鹰扬卦', '吉', '天兵诛贼寇，旌旗得胜归，功成班将帅，门第有光辉。'],
  ['●○●●●', '后吉卦', '平', '履薄登冰地，危桥得渡时，重重忧险过，喜色自芳菲。'],
  ['○○○○○', '无数卦', '凶', '尘埋青铜镜，美玉陷淤泥，何时重出世，再得显光辉。'],
] as const;

export function analyzeChineseCharacters(text: string) {
  const normalized = text.trim();
  if (!normalized || [...normalized].length > 20) throw new Error('请输入 1 至 20 个汉字');
  const characters = [...normalized].map((char) => ({ char, detail: charDetail(char) }));
  return {
    text: normalized,
    characters,
    totalKangxiStrokes: characters.every((item) => item.detail)
      ? characters.reduce((sum, item) => sum + item.detail!.kangxiStrokes, 0)
      : null,
    unknownCharacters: characters.filter((item) => item.detail === null).map((item) => item.char),
  };
}

export function selectChineseCharacters(filter: CharacterSearchFilter) {
  return searchChars({
    ...filter,
    commonOnly: filter.commonOnly ?? true,
    limit: filter.limit ?? 50,
  });
}

export function analyzeChineseName(input: {
  fullName: string;
  surnameLength?: 1 | 2;
  xiYong?: Wuxing[];
  jiShen?: Wuxing[];
  zodiac?: string;
}) {
  const chars = [...input.fullName.trim()];
  const surnameLength = input.surnameLength ?? 1;
  if (chars.length <= surnameLength || chars.length > surnameLength + 2) {
    throw new Error('姓名需由 1 至 2 字姓氏和 1 至 2 字名字组成');
  }
  return scoreName(chars.slice(0, surnameLength).join(''), chars.slice(surnameLength).join(''), {
    xiYong: input.xiYong,
  });
}

export function generateChineseNames(input: {
  surname: string;
  gender?: NamingGender;
  givenNameLength?: 1 | 2;
  preferredElements?: Wuxing[];
  zodiac?: string;
  limit?: number;
}) {
  const surname = input.surname.trim();
  if (![1, 2].includes([...surname].length)) throw new Error('姓氏需为 1 至 2 个汉字');
  const gender = input.gender ?? '通用';
  const length = input.givenNameLength ?? 2;
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);
  const pool = [...new Set([...`${NAMING_CHARACTERS[gender]}${NAMING_CHARACTERS.通用}`])]
    .map((char) => charDetail(char))
    .filter(
      (item) =>
        item &&
        (!input.preferredElements?.length ||
          (item.wuxing && input.preferredElements.includes(item.wuxing as Wuxing))),
    )
    .slice(0, length === 2 ? 48 : 80);
  if (!pool.length) throw new Error('当前条件没有匹配的常用候选字，请放宽五行条件');
  const options = { xiYong: input.preferredElements };
  const candidates: Array<{
    fullName: string;
    givenName: string;
    score: ReturnType<typeof scoreName>;
  }> = [];
  for (let first = 0; first < pool.length; first += 1) {
    const secondStart = length === 1 ? first : 0;
    const secondEnd = length === 1 ? first + 1 : pool.length;
    for (let second = secondStart; second < secondEnd; second += 1) {
      if (length === 2 && first === second) continue;
      const givenName =
        length === 1 ? pool[first]!.char : `${pool[first]!.char}${pool[second]!.char}`;
      try {
        candidates.push({
          fullName: `${surname}${givenName}`,
          givenName,
          score: scoreName(surname, givenName, options),
        });
      } catch {
        continue;
      }
    }
  }
  candidates.sort(
    (a, b) =>
      b.score.scores.total - a.score.scores.total || a.fullName.localeCompare(b.fullName, 'zh-CN'),
  );
  const selected: typeof candidates = [];
  const firstCharCounts = new Map<string, number>();
  for (const candidate of candidates) {
    const firstChar = [...candidate.givenName][0];
    if ((firstCharCounts.get(firstChar) ?? 0) >= 2) continue;
    selected.push(candidate);
    firstCharCounts.set(firstChar, (firstCharCounts.get(firstChar) ?? 0) + 1);
    if (selected.length >= limit) break;
  }
  return selected;
}

function reduceBy80(value: bigint) {
  const remainder = Number(value % 80n);
  return remainder === 0 ? 80 : remainder;
}

export function analyzeNumber(input: string, purpose: 'phone' | 'plate' | 'general' = 'general') {
  const normalized = input.trim().toUpperCase().replace(/[\s-]/g, '');
  if (!normalized || normalized.length > 64) throw new Error('请输入 1 至 64 位号码');
  const digits = [...normalized].filter((char) => /\d/.test(char));
  const letters = [...normalized].filter((char) => /[A-Z]/.test(char));
  if (!digits.length && !letters.length) throw new Error('号码中需包含数字或英文字母');
  const digitValue = digits.length ? BigInt(digits.join('')) : 0n;
  const digitSum = digits.reduce((total, digit) => total + Number(digit), 0);
  const alphanumericSum =
    digitSum + letters.reduce((total, letter) => total + letter.charCodeAt(0) - 64, 0);
  const primaryIndex =
    purpose === 'plate'
      ? reduceBy80(BigInt(alphanumericSum))
      : reduceBy80(digitValue || BigInt(alphanumericSum));
  const sumIndex = reduceBy80(BigInt(alphanumericSum));
  return {
    input,
    normalized,
    purpose,
    digitCount: digits.length,
    letterCount: letters.length,
    digitSum,
    alphanumericSum,
    oddCount: digits.filter((digit) => Number(digit) % 2 === 1).length,
    evenCount: digits.filter((digit) => Number(digit) % 2 === 0).length,
    repeatedGroups: normalized.match(/(.)\1+/g) ?? [],
    primaryIndex,
    primaryNumerology: shuliEntry(primaryIndex),
    sumIndex,
    sumNumerology: shuliEntry(sumIndex),
    formula:
      purpose === 'plate'
        ? '数字按原值、字母按 A=1 至 Z=26 相加，再按 80 循环取数。'
        : '提取全部数字组成整数，再按 80 循环取数；整除时取 80。',
  };
}

export function calculateZhugeNumber(text: string) {
  const chars = [...text.trim()];
  if (chars.length !== 3) throw new Error('诸葛神数需输入恰好三个汉字');
  const details = chars.map((char) => charDetail(char));
  if (details.some((item) => item === null)) throw new Error('输入中含字典未收录的汉字');
  const strokes = details.map((item) => item!.kangxiStrokes);
  const digits = strokes.map((count) => count % 10);
  const rawNumber = digits[0] * 100 + digits[1] * 10 + digits[2];
  const number = rawNumber % 384 || 384;
  return {
    text: chars.join(''),
    chars,
    strokes,
    digits,
    rawNumber,
    number,
    sign: ZHUGE_SIGNS[number - 1],
  };
}

export function castKongmingHexagram(pattern?: string, options?: RandomOptions) {
  let resolvedPattern = pattern?.trim();
  let randomTrace: ReturnType<ReturnType<typeof createRandomContext>['getTrace']> | undefined;
  if (!resolvedPattern) {
    const context = createRandomContext(options);
    resolvedPattern = Array.from({ length: 5 }, () =>
      randomInt(2, context.random) === 1 ? '●' : '○',
    ).join('');
    randomTrace = context.getTrace();
  }
  const normalized = resolvedPattern.replace(/[阳正公1]/g, '●').replace(/[阴反字0]/g, '○');
  if (!/^[●○]{5}$/.test(normalized)) throw new Error('卦象需由五个阴阳结果组成');
  const index = KONGMING_HEXAGRAMS.findIndex((item) => item[0] === normalized);
  if (index < 0) throw new Error('未找到对应卦象');
  const [symbol, name, grade, poem] = KONGMING_HEXAGRAMS[index];
  return { number: index + 1, symbol, name, grade, poem, random: randomTrace };
}
