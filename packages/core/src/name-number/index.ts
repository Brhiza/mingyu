import {
  CHARACTER_TUPLES,
  SANCAI_DATA,
  SHULI_DATA,
  type GeneratedCharacterData,
} from './generated-data';
export { getZhugeInterpretation } from './zhuge-interpretations';
import { analyzeNameSancai, formatNamingTradition, NAMING_TRADITION } from './naming-tradition';
import { analyzeNumberEnergyPair, NUMBER_ENERGY_TRADITION } from './number-energy-tradition';
export { getKongmingInterpretation } from './kongming-interpretations';
export { analyzeNumberEnergyPair } from './number-energy-tradition';
export { analyzeNameSancai } from './naming-tradition';
import { calculateBaziChartFromInput, type BaziChartInputDraft } from '../bazi/input';
import { CHARACTER_STROKE_NOTES, CHARACTER_READING_NOTES } from './character-annotations';

export type Wuxing = '金' | '木' | '水' | '火' | '土';
export type NamingGender = '男' | '女' | '通用';
export type CharacterDetail = GeneratedCharacterData & {
  kangxiText?: string | null;
  strokeNote?: string;
  readingNote?: string;
};
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

const COMPOUND_SURNAME_READINGS: Readonly<Record<string, readonly string[]>> = {
  单于: ['chán', 'yú'],
  万俟: ['mò', 'qí'],
  长孙: ['zhǎng', 'sūn'],
  令狐: ['lìng', 'hú'],
};

export type NamingBirthInput = BaziChartInputDraft;

export function calculateNamingBirthContext(input: NamingBirthInput) {
  const chart = calculateBaziChartFromInput(input);
  const strength = chart.analysis.dayMasterStrength;
  const favorableElements = (chart.analysis.usefulGod.favorableWuxing ?? []).filter(
    (item): item is Wuxing => ['金', '木', '水', '火', '土'].includes(item),
  );
  const unfavorableElements = (chart.analysis.usefulGod.unfavorableWuxing ?? []).filter(
    (item): item is Wuxing => ['金', '木', '水', '火', '土'].includes(item),
  );
  return {
    solarDate: `${chart.solarDate.year}-${String(chart.solarDate.month).padStart(2, '0')}-${String(chart.solarDate.day).padStart(2, '0')}`,
    timeBasis: {
      inputDate: `${input.dateType === 'lunar' ? '农历' : '公历'}${Number(input.year)}年${input.dateType === 'lunar' && input.isLeapMonth ? '闰' : ''}${Number(input.month)}月${Number(input.day)}日`,
      inputTime: input.useTrueSolarTime
        ? `${String(Number(input.birthHour)).padStart(2, '0')}:${String(Number(input.birthMinute)).padStart(2, '0')}`
        : `${chart.timeInfo.name}（${chart.timeInfo.range}）`,
      mode: input.useTrueSolarTime ? '真太阳时' : '时辰',
      place: input.birthPlace?.trim() || '',
      longitude: input.useTrueSolarTime ? Number(input.birthLongitude) : null,
      calculatedTime: chart.timing
        ? `${String(chart.timing.correctedTime.hour).padStart(2, '0')}:${String(chart.timing.correctedTime.minute).padStart(2, '0')}`
        : `${chart.timeInfo.name}（${chart.timeInfo.range}）`,
    },
    lunarDate: `${chart.lunarDate.year}年${chart.lunarDate.monthName}${chart.lunarDate.dayName}`,
    pillars: Object.values(chart.pillars).map((pillar) => pillar.ganZhi),
    dayMaster: chart.dayMaster.gan,
    zodiac: chart.zodiac,
    favorableElements,
    unfavorableElements,
    usefulGodReason: chart.analysis.usefulGod.primaryReason ?? chart.analysis.usefulGod.useful,
    monthContext: {
      branch: chart.pillars.month.zhi,
      commander: chart.monthCommander,
      season: chart.seasonInfo.currentSeason,
      term: chart.seasonInfo.currentJieqi,
    },
    pillarDetails: (
      [
        ['year', '年柱'],
        ['month', '月柱'],
        ['day', '日柱'],
        ['hour', '时柱'],
      ] as const
    ).map(([key, label]) => ({
      label,
      ganZhi: chart.pillars[key].ganZhi,
      hiddenStems: chart.hiddenStems[key].map((stem, index) => ({
        stem,
        tenGod: chart.hiddenTenGods[key]?.[index] ?? '',
      })),
    })),
    strength: {
      status: strength.status,
      basis: [
        `月令作用：${strength.details.seasonalEffect}`,
        `司令作用：${strength.details.commanderEffect}`,
        `成局作用：${strength.details.formationEffect}`,
        `通根：${strength.details.hasStrongRoot ? '有强根' : strength.details.hasRoot ? '有根' : '根气不足'}`,
        `天干扶助：${strength.details.hasSupport ? '有扶助' : '扶助不足'}`,
        `天干制约：${strength.details.hasConstraint ? '有制约' : '制约较少'}`,
      ],
    },
    climate: chart.climate ? { ...chart.climate } : null,
    warnings: chart.warnings,
  };
}

const characterData: Record<string, CharacterDetail> = {};
const allCharacters: CharacterDetail[] = CHARACTER_TUPLES.map(
  ([
    simplified,
    traditional,
    kangxiStrokes,
    radical,
    wuxing,
    pinyin,
    definition,
    simplifiedStrokes,
    traditionalStrokes,
    structure,
    kangxiVolume,
    kangxiSection,
    common,
  ]) => ({
    char: simplified,
    simplified,
    traditional,
    kangxiStrokes,
    radical: radical ?? undefined,
    wuxing,
    pinyin: CHARACTER_READING_NOTES[simplified]?.readings.join('、') ?? pinyin ?? undefined,
    ...(CHARACTER_READING_NOTES[simplified]
      ? { readingNote: CHARACTER_READING_NOTES[simplified].note }
      : {}),
    definition,
    simplifiedStrokes,
    traditionalStrokes,
    structure,
    kangxiVolume,
    kangxiSection,
    ...(CHARACTER_STROKE_NOTES[simplified]
      ? { strokeNote: CHARACTER_STROKE_NOTES[simplified] }
      : {}),
    common,
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

function normalizePinyin(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/u\u0308|u:/g, 'v')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[1-5]/g, '');
}

function searchChars(filter: CharacterSearchFilter = {}) {
  const pinyin = normalizePinyin(filter.pinyin ?? '');
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
      !normalizePinyin(item.pinyin ?? '')
        .split(/[^a-zv]+/)
        .some((reading) => reading.startsWith(pinyin))
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

function describeWuge(surnameStrokes: number[], givenStrokes: number[]) {
  const singleSurname = surnameStrokes.length === 1;
  const singleGiven = givenStrokes.length === 1;
  const definitions = [
    {
      key: 'tian',
      name: '天格',
      operands: singleSurname ? [surnameStrokes[0], 1] : surnameStrokes,
      rule: singleSurname ? '单姓笔画加一' : '复姓两字笔画相加',
    },
    {
      key: 'ren',
      name: '人格',
      operands: [surnameStrokes.at(-1)!, givenStrokes[0]],
      rule: '姓氏末字与名字首字笔画相加',
    },
    {
      key: 'di',
      name: '地格',
      operands: singleGiven ? [givenStrokes[0], 1] : givenStrokes,
      rule: singleGiven ? '单字名笔画加一' : '名字两字笔画相加',
    },
    {
      key: 'wai',
      name: '外格',
      operands: [singleSurname ? 1 : surnameStrokes[0], singleGiven ? 1 : givenStrokes.at(-1)!],
      rule: '取姓氏外侧与名字外侧笔画，单姓或单字名一侧以一补位',
    },
    {
      key: 'zong',
      name: '总格',
      operands: [...surnameStrokes, ...givenStrokes],
      rule: '姓名全部汉字笔画相加',
    },
  ] as const;
  return definitions.map((item) => ({
    ...item,
    value: item.operands.reduce((total, value) => total + value, 0),
    expression: `${item.operands.join(' + ')} = ${item.operands.reduce((total, value) => total + value, 0)}`,
  }));
}

function analyzeNameStructure(
  surname: string,
  given: string,
  options: {
    xiYong?: Wuxing[];
    birthContext?: ReturnType<typeof calculateNamingBirthContext>;
  } = {},
) {
  const surnameDetails = [...surname].map(charDetail);
  const givenDetails = [...given].map(charDetail);
  if ([...surnameDetails, ...givenDetails].some((item) => !item))
    throw new Error('姓名中含字典未收录的汉字');
  const canonicalSurname = surnameDetails.map((item) => item!.simplified).join('');
  const compoundReadings = COMPOUND_SURNAME_READINGS[canonicalSurname];
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
  const sancaiEvidence = analyzeNameSancai(rawGrids);
  const combo = sancaiEvidence.combo;
  const sancai = (
    SANCAI_DATA as Record<
      string,
      { combo: string; tian_ren: string; ren_di: string; level: string; text: string }
    >
  )[combo];
  const preferred = options.xiYong ?? [];
  return {
    surname,
    given,
    chars: [
      ...surnameDetails.map((item, index) => ({
        ...item!,
        isSurname: true,
        surnameReading:
          surnameDetails.length === 1
            ? CHARACTER_READING_NOTES[item!.simplified]?.surname
            : compoundReadings?.[index],
      })),
      ...givenDetails.map((item) => ({ ...item!, isSurname: false, surnameReading: undefined })),
    ],
    rawGrids,
    gridDerivations: describeWuge(
      surnameDetails.map((item) => item!.kangxiStrokes),
      givenDetails.map((item) => item!.kangxiStrokes),
    ),
    namingTradition: NAMING_TRADITION,
    grids,
    sancai,
    sancaiEvidence,
    preferredElements: [...preferred],
    birthContext: options.birthContext ?? null,
    elementMatches: preferred.length
      ? givenDetails
          .filter((item) => item!.wuxing && preferred.includes(item!.wuxing as Wuxing))
          .map((item) => item!.char)
      : [],
  };
}

const NAMING_CHARACTERS: Record<NamingGender, string> = {
  男: '宇宸泽轩睿浩博彦辰昊铭骏承远航嘉瑞景安宁朗修文哲谦毅恒翊晨旭恺峻川源柏森楷钧锦熙煜昭曜清和弘允卓凡',
  女: '宁悦欣妍涵瑶琪琳玥璇诗雅舒婉晴萱芷若依然语桐清欢知夏念安嘉怡可馨慧敏灵韵昭月星澜雪柔梦竹云舒锦书沐瑾',
  通用: '安宁嘉瑞清和知远明轩景行言希思齐书言亦辰予墨乐川星野云舟望舒怀瑾若水之恒以沫允和卓然修远闻溪',
};

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

export async function analyzeChineseCharactersWithReferences(text: string) {
  const analysis = analyzeChineseCharacters(text);
  if (analysis.characters.every((item) => item.detail === null)) return analysis;
  const { KANGXI_TEXT_BY_CHARACTER } = await import('./generated-character-references.js').catch(
    (cause: unknown) => {
      throw new Error('字典原文加载失败，请重试', { cause });
    },
  );
  return {
    ...analysis,
    characters: analysis.characters.map(({ char, detail }) => ({
      char,
      detail: detail
        ? { ...detail, kangxiText: KANGXI_TEXT_BY_CHARACTER[detail.simplified] ?? null }
        : null,
    })),
  };
}

export function buildChineseCharacterPrompt(input: {
  analysis: ReturnType<typeof analyzeChineseCharacters>;
  question?: string;
}) {
  const entries = input.analysis.characters.map(({ char, detail }) => {
    if (!detail) return `【${char}】\n字典资料暂缺。`;
    return [
      `【${char}】`,
      `简体：${detail.simplified}；繁体：${detail.traditional}`,
      `读音：${detail.pinyin || '待考'}`,
      ...(detail.readingNote ? [`音义用法：${detail.readingNote}`] : []),
      `用字范围：${detail.common ? 'GB2312一级字' : '补充用字'}`,
      `简体笔画：${detail.simplifiedStrokes ?? '待考'}；繁体笔画：${detail.traditionalStrokes ?? '待考'}；姓名学康熙笔画：${detail.kangxiStrokes}`,
      ...(detail.strokeNote ? [`笔画用法：${detail.strokeNote}`] : []),
      `部首：${detail.radical || '待考'}；结构：${detail.structure || '待考'}；姓名学五行：${detail.wuxing || '待考'}`,
      `字义：${detail.definition || '待考'}`,
      ...(detail.kangxiText ? ['康熙字典原文：', detail.kangxiText] : []),
    ].join('\n');
  });
  return [
    '【任务】',
    '结合字义、读音、字形和所列字书原文，解析各字的含义与使用语境，并比较用作姓名时的表达。',
    '',
    ...entries,
    '',
    '【问题】',
    input.question?.trim() || '这些字分别有什么含义，如何选字和搭配？',
    '',
    '【输出要求】',
    '逐字说明常用义、古义、读音适用语境、字形特点及姓名搭配。引用典籍时标明篇名并对应所列原文；推测性联想与字书释义分别表述。繁简笔画、字书原文笔画和姓名学笔画分别说明，五行归属作为姓名学取象参考。结合音义提出候选搭配及适用理由，也可按相同意向补充其他汉字。',
  ].join('\n');
}

export function analyzeChineseName(input: {
  fullName: string;
  surnameLength?: 1 | 2;
  xiYong?: Wuxing[];
  birth?: NamingBirthInput;
}) {
  const chars = [...input.fullName.trim()];
  const surnameLength = input.surnameLength ?? 1;
  if (chars.length <= surnameLength || chars.length > surnameLength + 2) {
    throw new Error('姓名需由 1 至 2 字姓氏和 1 至 2 字名字组成');
  }
  const birthContext = input.birth ? calculateNamingBirthContext(input.birth) : undefined;
  return analyzeNameStructure(
    chars.slice(0, surnameLength).join(''),
    chars.slice(surnameLength).join(''),
    {
      xiYong: input.xiYong?.length ? input.xiYong : birthContext?.favorableElements,
      birthContext,
    },
  );
}

function namingCharacters(value?: string) {
  return [...new Set([...(value ?? '')].filter((char) => /\p{Script=Han}/u.test(char)))];
}

function namingCharacterKey(char: string) {
  return charDetail(char)?.simplified ?? char;
}

export type GenerationCharacterPosition = 'first' | 'second';

export function selectNamingCharacters(input: {
  gender?: NamingGender;
  preferredElements?: Wuxing[];
  preferredCharacters?: string;
  forbiddenCharacters?: string;
  birth?: NamingBirthInput;
  limit?: number;
}) {
  const gender = input.gender ?? '通用';
  const birthContext = input.birth ? calculateNamingBirthContext(input.birth) : undefined;
  const preferredElements = input.preferredElements?.length
    ? input.preferredElements
    : birthContext?.favorableElements;
  const forbidden = new Set(namingCharacters(input.forbiddenCharacters).map(namingCharacterKey));
  const preferred = namingCharacters(input.preferredCharacters).filter(
    (char) => !forbidden.has(namingCharacterKey(char)),
  );
  const common = [...new Set([...`${NAMING_CHARACTERS[gender]}${NAMING_CHARACTERS.通用}`])];
  const ordered = [
    ...preferred,
    ...common.filter((char) => {
      const detail = charDetail(char);
      return detail?.wuxing && preferredElements?.includes(detail.wuxing as Wuxing);
    }),
    ...common,
  ];
  return [...new Set(ordered.map(namingCharacterKey))]
    .filter((char) => !forbidden.has(char))
    .map((char) => charDetail(char))
    .filter((item): item is CharacterDetail => item !== null)
    .slice(0, Math.min(Math.max(input.limit ?? 48, 1), 100));
}

export function generateChineseNames(input: {
  surname: string;
  gender?: NamingGender;
  givenNameLength?: 1 | 2;
  preferredElements?: Wuxing[];
  preferredCharacters?: string;
  forbiddenCharacters?: string;
  generationCharacter?: string;
  generationPosition?: GenerationCharacterPosition;
  limit?: number;
  birth?: NamingBirthInput;
}) {
  const surname = input.surname.trim();
  if (![1, 2].includes([...surname].length)) throw new Error('姓氏需为 1 至 2 个汉字');
  // 枚举前先核验姓氏用字，避免候选分析异常被吞掉后误报为“无可用名字”
  const missingSurnameChars = [...surname].filter((char) => !charDetail(char));
  if (missingSurnameChars.length) {
    throw new Error(`姓氏用字暂未收录在字典中：${missingSurnameChars.join('、')}`);
  }
  const gender = input.gender ?? '通用';
  const length = input.givenNameLength ?? 2;
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);
  const birthContext = input.birth ? calculateNamingBirthContext(input.birth) : undefined;
  const preferredElements = input.preferredElements?.length
    ? input.preferredElements
    : birthContext?.favorableElements;
  const forbidden = new Set(namingCharacters(input.forbiddenCharacters).map(namingCharacterKey));
  const preferred = new Set(
    namingCharacters(input.preferredCharacters)
      .map(namingCharacterKey)
      .filter((char) => !forbidden.has(char)),
  );
  const generationCharacters = namingCharacters(input.generationCharacter);
  if (generationCharacters.length > 1) throw new Error('辈分字只能填写一个汉字');
  const generationCharacter = generationCharacters[0];
  if (generationCharacter && forbidden.has(namingCharacterKey(generationCharacter)))
    throw new Error('辈分字不能同时设为忌用字');
  if (generationCharacter && !charDetail(generationCharacter))
    throw new Error('辈分字暂未收录在字典中');
  const pool = selectNamingCharacters({
    gender,
    preferredElements,
    preferredCharacters: input.preferredCharacters,
    forbiddenCharacters: input.forbiddenCharacters,
    birth: input.birth,
    limit: length === 2 ? 48 : 80,
  });
  if (!pool.length) throw new Error('当前用字条件没有可用候选字');
  const options = { xiYong: preferredElements, birthContext };
  const candidates: Array<{
    fullName: string;
    givenName: string;
    analysis: ReturnType<typeof analyzeNameStructure>;
    selectionEvidence: {
      preferredCharacters: string[];
      generationCharacter: string | null;
      generationPosition: GenerationCharacterPosition | null;
      favorableElementCharacters: string[];
    };
  }> = [];
  let candidateFailures = 0;
  const givenNames =
    length === 1
      ? generationCharacter
        ? [generationCharacter]
        : pool.map((item) => item.char)
      : generationCharacter
        ? pool.map((item) =>
            input.generationPosition === 'second'
              ? `${item.char}${generationCharacter}`
              : `${generationCharacter}${item.char}`,
          )
        : pool.flatMap((first) =>
            pool
              .filter((second) => first.char !== second.char)
              .map((second) => `${first.char}${second.char}`),
          );
  for (const givenName of givenNames) {
    const givenKeys = [...givenName].map(namingCharacterKey);
    if (givenKeys.some((char) => forbidden.has(char))) continue;
    if (length === 2 && givenKeys[0] === givenKeys[1]) continue;
    try {
      const analysis = analyzeNameStructure(surname, givenName, options);
      candidates.push({
        fullName: `${surname}${givenName}`,
        givenName,
        analysis,
        selectionEvidence: {
          preferredCharacters: [...givenName].filter((char) =>
            preferred.has(namingCharacterKey(char)),
          ),
          generationCharacter: generationCharacter ?? null,
          generationPosition: generationCharacter ? (input.generationPosition ?? 'first') : null,
          favorableElementCharacters: [...analysis.elementMatches],
        },
      });
    } catch {
      candidateFailures += 1;
      continue;
    }
  }
  // 全部候选都分析失败时保留原因，不用空数组掩盖输入或资料问题
  if (!candidates.length && candidateFailures > 0) {
    throw new Error(`候选名字分析全部失败（共${candidateFailures}个候选），请检查用字资料`);
  }
  const uniqueCandidates = [...new Map(candidates.map((item) => [item.fullName, item])).values()];
  const selected: typeof candidates = [];
  const firstCharCounts = new Map<string, number>();
  for (const candidate of uniqueCandidates) {
    const firstChar = [...candidate.givenName][0];
    if (!generationCharacter && (firstCharCounts.get(firstChar) ?? 0) >= 2) continue;
    selected.push(candidate);
    firstCharCounts.set(firstChar, (firstCharCounts.get(firstChar) ?? 0) + 1);
    if (selected.length >= limit) break;
  }
  return selected;
}

function formatBirthContext(context: ReturnType<typeof calculateNamingBirthContext> | null) {
  if (!context) return '本次未结合出生资料。';
  return [
    `出生记录：${context.timeBasis.inputDate} ${context.timeBasis.inputTime}`,
    `时间口径：${context.timeBasis.mode}${context.timeBasis.longitude !== null ? `；出生地${context.timeBasis.place || '按经度定位'}；经度${context.timeBasis.longitude}°` : ''}`,
    `排盘公历：${context.solarDate} ${context.timeBasis.calculatedTime}`,
    `农历：${context.lunarDate}`,
    `四柱：${context.pillars.join(' ')}`,
    `日主：${context.dayMaster}`,
    `生肖：${context.zodiac}`,
    `月令：${context.monthContext.branch}月；司令${context.monthContext.commander}；${context.monthContext.season}；节气${context.monthContext.term}`,
    ...context.pillarDetails.map(
      (pillar) =>
        `${pillar.label}${pillar.ganZhi}藏干：${pillar.hiddenStems.map((item) => `${item.stem}${item.tenGod ? `（${item.tenGod}）` : ''}`).join('、')}`,
    ),
    `旺衰：${context.strength.status}；${context.strength.basis.join('；')}`,
    ...(context.climate
      ? [`调候：${context.climate.nature}；${context.climate.summary}；${context.climate.medicine}`]
      : []),
    `喜用五行：${context.favorableElements.join('、') || '以整体命局复核'}`,
    `取用依据：${context.usefulGodReason}`,
    ...context.warnings.map((warning) => `出生时刻说明：${warning}`),
  ].join('\n');
}

function formatNameAnalysis(result: ReturnType<typeof analyzeChineseName>) {
  const meanings = result.chars
    .filter((item) => item.definition?.trim())
    .map((item) => `${item.char}：${item.definition}`);
  return [
    `姓名：${result.surname}${result.given}`,
    `逐字：${result.chars.map((item) => `${item.char}（康熙${item.kangxiStrokes}画、${item.wuxing ?? '五行未定'}、${item.pinyin ?? '读音未录'}）`).join('；')}`,
    ...result.chars.flatMap((item) => [
      ...(item.surnameReading
        ? [`${item.char}姓氏读音参考：${item.surnameReading}；实际读音以本人及家族用法为准。`]
        : []),
      ...(item.readingNote ? [`${item.char}音义用法：${item.readingNote}`] : []),
    ]),
    meanings.length ? `字义：${meanings.join('；')}` : '',
    ...[...new Set(result.chars.map((item) => item.strokeNote).filter(Boolean))].map(
      (note) => `笔画用法：${note}`,
    ),
    `五格：${result.gridDerivations
      .map((derivation) => {
        const item = result.grids[derivation.key];
        return `${derivation.name}${item.num}（${item.wuxing}、${item.keywords}）；${derivation.rule}：${derivation.expression}`;
      })
      .join('；')}`,
    `三才：${result.sancai.combo}；${result.sancai.text}`,
    `三才取数：${result.sancaiEvidence.positions.map((position) => position.explanation).join('；')}`,
    `三才生克：${result.sancaiEvidence.relations.map((relation) => relation.explanation).join('；')}`,
    result.preferredElements.length
      ? `本次选字五行：${result.preferredElements.join('、')}；名字中相应五行用字：${result.elementMatches.join('、') || '无'}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function conciseNamingText(value?: string | null, limit = 96) {
  const normalized = value?.replace(/\s+/g, ' ').trim() ?? '';
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit).replace(/[，、；：。！？]?$/, '')}…`;
}

function formatNamingCharacter(detail: CharacterDetail) {
  const basics = [
    detail.wuxing ? `${detail.wuxing}行` : '',
    detail.pinyin || '',
    `康熙${detail.kangxiStrokes}画`,
    conciseNamingText(detail.definition),
  ].filter(Boolean);
  return `${detail.char}（${basics.join('、')}）${detail.readingNote ? `；${detail.char}音义用法：${detail.readingNote}` : ''}`;
}

function formatNamingCharacterBrief(detail: CharacterDetail) {
  return `${detail.char}（${[
    detail.wuxing ? `${detail.wuxing}行` : '',
    detail.pinyin || '',
    `康熙${detail.kangxiStrokes}画`,
  ]
    .filter(Boolean)
    .join('、')}）`;
}

function formatNamingCandidate(
  candidate: ReturnType<typeof generateChineseNames>[number],
  index: number,
) {
  const result = candidate.analysis;
  const givenCharacters = result.chars.filter((item) => !item.isSurname);
  const evidence = candidate.selectionEvidence;
  const conditions = [
    evidence.preferredCharacters.length
      ? `使用偏好字${evidence.preferredCharacters.join('、')}`
      : '',
    evidence.generationCharacter
      ? `辈分字${evidence.generationCharacter}位于${evidence.generationPosition === 'second' ? '名字末字' : '名字首字'}`
      : '',
    evidence.favorableElementCharacters.length
      ? `出生取用相应字${evidence.favorableElementCharacters.join('、')}`
      : '',
  ].filter(Boolean);
  return [
    `${index + 1}. ${candidate.fullName}`,
    `名字用字：${givenCharacters.map((item) => formatNamingCharacterBrief(item)).join('；')}`,
    `五格取数：${result.gridDerivations.map((item) => `${item.name}${item.value}`).join('、')}`,
    `五格算式：${result.gridDerivations.map((item) => `${item.name}${item.expression}`).join('；')}`,
    `三才：${result.sancai.combo}；${result.sancaiEvidence.relations.map((item) => item.explanation).join('；')}`,
    ...(conditions.length ? [`用字条件：${conditions.join('；')}`] : []),
  ].join('\n');
}

export function buildChineseNameAnalysisPrompt(input: {
  analysis: ReturnType<typeof analyzeChineseName>;
  question?: string;
}) {
  return [
    '【任务】',
    '综合出生取用、姓名字义、音律、书写辨识、谐音联想、三才五格与现代使用场景，评价这个姓名的整体适配度；说明各项依据之间如何互相支持或制约，并给出自然可用的优化方向。',
    '',
    '【出生资料】',
    formatBirthContext(input.analysis.birthContext),
    '',
    '【姓名资料】',
    formatNameAnalysis(input.analysis),
    '',
    '【传统依据】',
    formatNamingTradition(),
    '',
    '【问题】',
    input.question?.trim() ||
      `请完整解析“${input.analysis.surname}${input.analysis.given}”这个姓名。`,
    '',
    '【输出要求】',
    '先给整体结论，再分别说明出生适配、字义组合、读音节奏、书写辨识、谐音与社会使用感受、三才五格，最后给出可直接比较的优点、留意点和优化建议。',
  ].join('\n');
}

export function buildChineseNamingPrompt(input: {
  surname: string;
  gender?: NamingGender;
  candidates: ReturnType<typeof generateChineseNames>;
  suitableCharacters?: CharacterDetail[];
  preferredCharacters?: string;
  forbiddenCharacters?: string;
  generationCharacter?: string;
  generationPosition?: GenerationCharacterPosition;
}) {
  if (!input.candidates.length) throw new Error('请先生成姓名候选');
  const forbidden = new Set(namingCharacters(input.forbiddenCharacters).map(namingCharacterKey));
  const preferred = namingCharacters(input.preferredCharacters).filter(
    (char) => !forbidden.has(namingCharacterKey(char)),
  );
  const forbiddenVariants = [...forbidden].map((char) => {
    const detail = charDetail(char);
    return detail && detail.traditional !== char ? `${char}（${detail.traditional}）` : char;
  });
  const surnameReadings = input.candidates[0]!.analysis.chars.filter(
    (item) => item.isSurname && item.surnameReading,
  ).map((item) => item.surnameReading);
  const namingCharacterDetails = [
    ...(input.suitableCharacters ?? []),
    ...input.candidates.flatMap((candidate) =>
      candidate.analysis.chars.filter((item) => !item.isSurname),
    ),
  ].filter((item, index, items) => {
    const key = namingCharacterKey(item.char);
    return (
      !forbidden.has(key) &&
      items.findIndex((entry) => namingCharacterKey(entry.char) === key) === index
    );
  });
  return [
    '【任务】',
    '综合出生取用、用字条件、字义搭配、音律节奏、字形协调、谐音联想和现代社会使用场景设计姓名。候选姓名只是比较起点，可以重新组合适配字，也可以补充同类常用字并提出更合适的新名字。',
    '',
    '【出生资料】',
    formatBirthContext(input.candidates[0]!.analysis.birthContext),
    '',
    '【起名资料】',
    [
      `姓氏：${input.surname}`,
      ...(surnameReadings.length
        ? [
            `${input.surname}姓氏读音参考：${surnameReadings.join(' ')}；实际读音以本人及家族用法为准。`,
          ]
        : []),
      `取向：${input.gender ?? '通用'}`,
      `偏好字：${preferred.join('、') || '自然、易读、易写'}`,
      `回避用字：${forbiddenVariants.join('、') || '无'}`,
      `辈分字：${namingCharacters(input.generationCharacter).join('') || '无'}${input.generationCharacter ? `（${input.generationPosition === 'second' ? '名字末字' : '名字首字'}）` : ''}`,
      `适配字池：${namingCharacterDetails.map(formatNamingCharacter).join('；') || '结合出生资料与用字条件补充'}`,
      `候选姓名：\n${input.candidates.map(formatNamingCandidate).join('\n\n')}`,
    ].join('\n'),
    '',
    '【传统依据】',
    formatNamingTradition(),
    '',
    '【输出要求】',
    '先说明选字思路，再给出不少于八个姓名方案。每个方案说明出生适配、字义组合、读音节奏、字形、谐音联想、辨识度与三才五格，明确标注哪些来自候选样本、哪些是重新设计；最后给出首选名及两个备选名。',
  ].join('\n');
}

function reduceBy80(value: bigint) {
  const remainder = Number(value % 80n);
  return remainder === 0 ? 80 : remainder;
}

export type NumberPurpose = 'phone' | 'plate' | 'general';
export type NumberEnergyName =
  '天医' | '生气' | '延年' | '伏位' | '绝命' | '五鬼' | '六煞' | '祸害';
export type NumberEnergyNature = '助益' | '守成' | '考验';

const NUMBER_ENERGY_DEFINITIONS: Array<{
  name: NumberEnergyName;
  nature: NumberEnergyNature;
  keywords: string[];
  meaning: string;
  pairs: string[];
}> = [
  {
    name: '天医',
    nature: '助益',
    keywords: ['资源', '成果', '正向关系'],
    meaning: '重视资源积累、成果兑现与稳定关系，也需要把机会落实为长期安排。',
    pairs: ['13', '68', '49', '27'],
  },
  {
    name: '生气',
    nature: '助益',
    keywords: ['贵人', '机会', '适应'],
    meaning: '象征开放、乐观与外部助力，适合通过协作和变化打开局面。',
    pairs: ['14', '67', '39', '28'],
  },
  {
    name: '延年',
    nature: '助益',
    keywords: ['专业', '执行', '责任'],
    meaning: '强调能力、承担与持续推进，容易把注意力放在工作标准和掌控感上。',
    pairs: ['19', '78', '34', '26'],
  },
  {
    name: '伏位',
    nature: '守成',
    keywords: ['延续', '蓄势', '谨慎'],
    meaning: '延续前一状态并积蓄力量，适合稳定推进，也要留意迟疑和停滞。',
    pairs: ['11', '22', '33', '44', '66', '77', '88', '99'],
  },
  {
    name: '绝命',
    nature: '考验',
    keywords: ['决断', '投入', '起伏'],
    meaning: '行动直接、敢于投入并追求突破，重要决定更需要衡量承受范围。',
    pairs: ['12', '69', '48', '37'],
  },
  {
    name: '五鬼',
    nature: '考验',
    keywords: ['灵感', '变化', '敏感'],
    meaning: '思路活跃、反应快速且不拘常规，变化较多时需要保持节奏和可执行性。',
    pairs: ['18', '79', '36', '24'],
  },
  {
    name: '六煞',
    nature: '考验',
    keywords: ['情绪', '人际', '审美'],
    meaning: '感受细腻并重视关系氛围，面对牵绊时需要清晰表达边界和需求。',
    pairs: ['16', '47', '38', '29'],
  },
  {
    name: '祸害',
    nature: '考验',
    keywords: ['表达', '争执', '压力'],
    meaning: '语言和立场容易成为焦点，适合把表达能力用于协商并减少无谓消耗。',
    pairs: ['17', '89', '46', '23'],
  },
];

const numberEnergyPairMap = new Map<string, (typeof NUMBER_ENERGY_DEFINITIONS)[number]>();
for (const definition of NUMBER_ENERGY_DEFINITIONS) {
  definition.pairs.forEach((pair) => {
    numberEnergyPairMap.set(pair, definition);
    numberEnergyPairMap.set([...pair].reverse().join(''), definition);
  });
}

function analyzeNumberEnergySequence(alphanumeric: string) {
  const letterConversions: Array<{ letter: string; value: number; digits: string }> = [];
  const energyDigits: Array<{
    digit: number;
    source: string;
    sourceIndex: number;
    energyIndex: number;
  }> = [];

  for (const [sourceIndex, char] of [...alphanumeric].entries()) {
    const converted = /[A-Z]/.test(char) ? String(char.charCodeAt(0) - 64) : char;
    if (/[A-Z]/.test(char)) {
      letterConversions.push({ letter: char, value: Number(converted), digits: converted });
    }
    for (const digit of converted) {
      energyDigits.push({
        digit: Number(digit),
        source: char,
        sourceIndex,
        energyIndex: energyDigits.length,
      });
    }
  }

  const modifiers = energyDigits
    .filter((item) => item.digit === 0 || item.digit === 5)
    .map((item) => ({
      digit: item.digit as 0 | 5,
      position: item.energyIndex,
      effect: item.digit === 0 ? ('隐藏' as const) : ('增强' as const),
      meaning:
        item.digit === 0
          ? '使相邻磁场的表现更内隐或延后，需要结合前后数字观察。'
          : '使相邻磁场更容易被强调或显现，需要结合前后数字观察。',
    }));

  const energyPairs: Array<{
    pair: string;
    span: string;
    start: number;
    end: number;
    sourceText: string;
    sourceStart: number;
    sourceEnd: number;
    name: NumberEnergyName;
    nature: NumberEnergyNature;
    keywords: string[];
    meaning: string;
    trigramEvidence: ReturnType<typeof analyzeNumberEnergyPair>;
    modifiers: Array<{ digit: 0 | 5; effect: '隐藏' | '增强' }>;
  }> = [];
  let previous: (typeof energyDigits)[number] | undefined;
  let pendingModifiers: Array<{ digit: 0 | 5; effect: '隐藏' | '增强' }> = [];

  for (const item of energyDigits) {
    if (item.digit === 0 || item.digit === 5) {
      if (previous) {
        pendingModifiers.push({
          digit: item.digit,
          effect: item.digit === 0 ? '隐藏' : '增强',
        });
      }
      continue;
    }
    if (previous) {
      const pair = `${previous.digit}${item.digit}`;
      const definition = numberEnergyPairMap.get(pair)!;
      energyPairs.push({
        pair,
        span: energyDigits
          .slice(previous.energyIndex, item.energyIndex + 1)
          .map((entry) => entry.digit)
          .join(''),
        start: previous.energyIndex,
        end: item.energyIndex,
        sourceText: alphanumeric.slice(previous.sourceIndex, item.sourceIndex + 1),
        sourceStart: previous.sourceIndex,
        sourceEnd: item.sourceIndex,
        name: definition.name,
        nature: definition.nature,
        keywords: definition.keywords,
        meaning: definition.meaning,
        trigramEvidence: analyzeNumberEnergyPair(previous.digit, item.digit),
        modifiers: pendingModifiers,
      });
    }
    previous = item;
    pendingModifiers = [];
  }

  const magneticDistribution = NUMBER_ENERGY_DEFINITIONS.map((definition) => ({
    name: definition.name,
    nature: definition.nature,
    count: energyPairs.filter((pair) => pair.name === definition.name).length,
    keywords: definition.keywords,
  })).filter((item) => item.count > 0);
  const maxCount = Math.max(0, ...magneticDistribution.map((item) => item.count));
  const magneticSegments: Array<{
    name: NumberEnergyName;
    nature: NumberEnergyNature;
    start: number;
    end: number;
    pairCount: number;
    span: string;
  }> = [];
  for (const pair of energyPairs) {
    const last = magneticSegments[magneticSegments.length - 1];
    if (last?.name === pair.name) {
      last.end = pair.end;
      last.pairCount += 1;
      last.span = energyDigits
        .slice(last.start, last.end + 1)
        .map((item) => item.digit)
        .join('');
    } else {
      magneticSegments.push({
        name: pair.name,
        nature: pair.nature,
        start: pair.start,
        end: pair.end,
        pairCount: 1,
        span: pair.span,
      });
    }
  }

  return {
    letterConversions,
    energySequence: energyDigits.map((item) => item.digit).join(''),
    energyPairs,
    modifiers: modifiers.map((modifier) => {
      const pair = energyPairs.find(
        (item) => item.start < modifier.position && item.end > modifier.position,
      );
      const hasLeft = energyDigits.some(
        (item) => item.energyIndex < modifier.position && item.digit !== 0 && item.digit !== 5,
      );
      const hasRight = energyDigits.some(
        (item) => item.energyIndex > modifier.position && item.digit !== 0 && item.digit !== 5,
      );
      const placement = pair ? '组内' : hasLeft ? '尾部' : hasRight ? '头部' : '独立';
      return {
        ...modifier,
        placement,
        relatedPair: pair
          ? { pair: pair.pair, span: pair.span, name: pair.name, start: pair.start, end: pair.end }
          : null,
        meaning: pair
          ? `${pair.span} 取 ${pair.pair}，对应${pair.name}；按夹数口径，${modifier.digit}取${modifier.effect}象意。`
          : `${placement}位置，两端有效数字不足，保留${modifier.digit}的位置供整体阅读。`,
      };
    }),
    magneticDistribution,
    magneticSegments,
    dominantFields: magneticDistribution
      .filter((item) => item.count === maxCount)
      .map((item) => item.name),
    magneticSummary: {
      pairCount: energyPairs.length,
      supportiveCount: energyPairs.filter((item) => item.nature === '助益').length,
      steadyCount: energyPairs.filter((item) => item.nature === '守成').length,
      challengingCount: energyPairs.filter((item) => item.nature === '考验').length,
    },
  };
}

export function analyzeNumber(input: string, purpose: NumberPurpose = 'general') {
  const normalized = input
    .replace(/[！-～]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .trim()
    .replace(/[a-z]/g, (char) => char.toUpperCase())
    .replace(/[\s-]/g, '');
  if (!normalized || normalized.length > 64) throw new Error('请输入 1 至 64 位号码');
  const digits = [...normalized].filter((char) => /\d/.test(char));
  const letters = [...normalized].filter((char) => /[A-Z]/.test(char));
  if (!digits.length && !letters.length) throw new Error('号码中需包含数字或英文字母');
  const alphanumeric = [...normalized].filter((char) => /[0-9A-Z]/.test(char)).join('');
  const excludedCharacters = [
    ...new Set([...normalized].filter((char) => !/[0-9A-Z·.()]/.test(char))),
  ];
  const digitValue = digits.length ? BigInt(digits.join('')) : 0n;
  const digitSum = digits.reduce((total, digit) => total + Number(digit), 0);
  const alphanumericSum =
    digitSum + letters.reduce((total, letter) => total + letter.charCodeAt(0) - 64, 0);
  const primaryIndex =
    purpose === 'plate'
      ? reduceBy80(BigInt(alphanumericSum))
      : reduceBy80(digitValue || BigInt(alphanumericSum));
  const sumIndex = reduceBy80(BigInt(alphanumericSum));
  const energy = analyzeNumberEnergySequence(alphanumeric);
  return {
    input,
    normalized,
    alphanumeric,
    excludedCharacters,
    purpose,
    digitCount: digits.length,
    letterCount: letters.length,
    digitSum,
    alphanumericSum,
    oddCount: digits.filter((digit) => Number(digit) % 2 === 1).length,
    evenCount: digits.filter((digit) => Number(digit) % 2 === 0).length,
    repeatedGroups: alphanumeric.match(/(.)\1+/g) ?? [],
    primaryIndex,
    primaryNumerology: shuliEntry(primaryIndex),
    sumIndex,
    sumNumerology: shuliEntry(sumIndex),
    formula:
      purpose === 'plate'
        ? '数字按原值、字母按 A=1 至 Z=26 相加，再按 80 循环取数。'
        : digitValue
          ? '提取全部数字组成整数，再按 80 循环取数；整除时取 80。'
          : '数字与字母序号相加，再按 80 循环取数；整除时取 80。',
    energyFormula:
      '数字按原值排列，字母按 A=1 至 Z=26 展开；相邻有效数字组成八星磁场。夹在两端有效数字之间的 0 取隐藏、5 取增强象意；头尾的 0、5 单独保留位置。',
    tradition: NUMBER_ENERGY_TRADITION,
    ...energy,
  };
}

export function buildNumberEnergyPrompt(input: {
  analysis: ReturnType<typeof analyzeNumber>;
  question?: string;
}) {
  const { analysis } = input;
  const purposeLabel =
    analysis.purpose === 'phone'
      ? '手机号'
      : analysis.purpose === 'plate'
        ? '车牌号'
        : '数字字母编号';
  const conversion = analysis.letterConversions.length
    ? analysis.letterConversions.map((item) => `${item.letter}=${item.value}`).join('、')
    : '没有字母换算';
  const pairs = analysis.energyPairs.length
    ? analysis.energyPairs
        .map((item, index) => {
          const modifier = item.modifiers.length
            ? `，中间含${item.modifiers.map((entry) => `${entry.digit}（${entry.effect}）`).join('、')}`
            : '';
          return `${index + 1}. ${item.span} → ${item.pair}：${item.name}（${item.nature}）${modifier}；${item.keywords.join('、')}；${item.meaning}\n位置：能量序列第${item.start + 1}—${item.end + 1}位，对应数字字母第${item.sourceStart + 1}—${item.sourceEnd + 1}位「${item.sourceText}」\n卦变：${item.trigramEvidence.explanation}`;
        })
        .join('\n')
    : '当前序列不足以形成八星磁场组合。';
  const distribution = analysis.magneticDistribution.length
    ? analysis.magneticDistribution.map((item) => `${item.name}${item.count}组`).join('、')
    : '暂无可归类组合';
  const usageFocus =
    analysis.purpose === 'phone'
      ? '手机号结合日常联络、工作沟通、关系维护与号码记忆辨识来解读；个人经历以本人提供的事实为准。'
      : analysis.purpose === 'plate'
        ? '车牌结合出行用途、号码辨识与个人审美来解读；驾驶安全以交通规则、车辆状况和驾驶行为为判断依据。'
        : '数字字母编号结合提问中说明的实际用途来解读；用途未明时先给通用象意，并列出需要补充的使用背景。';

  return [
    '【任务】',
    '依据八星数字能量的相邻数组体系，综合解读号码中的高频磁场、连续组合、前后作用和现实使用侧重点。',
    '',
    '【号码资料】',
    `类型：${purposeLabel}`,
    `原始内容：${analysis.input}`,
    `数字字母：${analysis.alphanumeric}`,
    ...(analysis.excludedCharacters.length
      ? [`号码标记：${analysis.excludedCharacters.join('、')}；磁场按上述数字字母序列计算。`]
      : []),
    `字母换算：${conversion}`,
    `能量序列：${analysis.energySequence}`,
    `磁场分布：${distribution}`,
    `高频磁场：${analysis.dominantFields.join('、') || '暂无'}`,
    '',
    '【磁场组合】',
    pairs,
    ...(analysis.magneticSegments.length
      ? [
          '',
          '【磁场顺序】',
          analysis.magneticSegments
            .map(
              (item) =>
                `${item.name}（${item.span}，${item.pairCount}组，能量序列第${item.start + 1}—${item.end + 1}位）`,
            )
            .join(' → '),
          '相邻组合共享连接处的数字；同类连续组合合并成段，组数表示出现次数。请沿序列说明象意的延续与转换，并将统计频次与现实影响程度分别讨论。',
        ]
      : []),
    ...(analysis.modifiers.length
      ? [
          '',
          '【0与5的位置】',
          ...analysis.modifiers.map(
            (item) =>
              `能量序列第${item.position + 1}位：${item.digit}${item.relatedPair ? `（${item.effect}）` : ''}；${item.placement}，${item.meaning}`,
          ),
        ]
      : []),
    '',
    '【传统依据】',
    `${analysis.tradition.title}：${analysis.tradition.passage}`,
    analysis.tradition.scope,
    analysis.tradition.numberMapping,
    '',
    '【取数口径】',
    analysis.tradition.conversion,
    '',
    '【问题】',
    input.question?.trim() || `请完整解读这个${purposeLabel}的数字能量。`,
    '',
    '【输出要求】',
    '将磁场作为民俗象意解释，并以实际使用体验和个人选择为现实判断依据。',
    usageFocus,
    '先概括高频磁场，再按号码顺序解释每组磁场及其衔接，结合号码类型说明资源、行动、关系、表达与稳定性等现实倾向，最后给出平衡使用这些倾向的建议。',
  ].join('\n');
}

export {
  calculateZhugeNumber,
  castKongmingHexagram,
  type ZhugeNumberResult,
  type KongmingHexagramResult,
} from './oracles';
