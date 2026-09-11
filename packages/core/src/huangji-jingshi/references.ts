import { EARTHLY_BRANCHES, SIXTY_CYCLE, type EarthlyBranch } from '../ganzhi/data';

/** 固定资料查询表的版本信息。 */
export interface HuangjiReferenceSource {
  readonly title: string;
  readonly edition: string;
  readonly revision: string;
  readonly url: string;
}

export const HUANGJI_REFERENCE_SOURCES = Object.freeze({
  overview: Object.freeze({
    title: '《皇极经世书》（四库全书本）',
    edition: '维基文库固定全览修订版',
    revision: '624182',
    url: 'https://zh.wikisource.org/w/index.php?oldid=624182&title=%E7%9A%87%E6%A5%B5%E7%B6%93%E4%B8%96%E6%9B%B8_%28%E5%9B%9B%E5%BA%AB%E5%85%A8%E6%9B%B8%E6%9C%AC%29%2F%E5%85%A8%E8%A6%BD',
  }),
  volume3Upper: Object.freeze({
    title: '《皇极经世书》（四库全书本）卷三上',
    edition: '维基文库固定卷页修订版',
    revision: '789511',
    url: 'https://zh.wikisource.org/w/index.php?oldid=789511&title=%E7%9A%87%E6%A5%B5%E7%B6%93%E4%B8%96%E6%9B%B8_%28%E5%9B%9B%E5%BA%AB%E5%85%A8%E6%9B%B8%E6%9C%AC%29%2F%E5%8D%B703%E4%B8%8A',
  }),
  volume3Lower: Object.freeze({
    title: '《皇极经世书》（四库全书本）卷三下',
    edition: '维基文库固定卷页修订版',
    revision: '789512',
    url: 'https://zh.wikisource.org/w/index.php?oldid=789512&title=%E7%9A%87%E6%A5%B5%E7%B6%93%E4%B8%96%E6%9B%B8_%28%E5%9B%9B%E5%BA%AB%E5%85%A8%E6%9B%B8%E6%9C%AC%29%2F%E5%8D%B703%E4%B8%8B',
  }),
  volume10Lower: Object.freeze({
    title: '《皇极经世书》（四库全书本）卷十下',
    edition: '维基文库固定卷页修订版',
    revision: '789545',
    url: 'https://zh.wikisource.org/w/index.php?oldid=789545&title=%E7%9A%87%E6%A5%B5%E7%B6%93%E4%B8%96%E6%9B%B8_%28%E5%9B%9B%E5%BA%AB%E5%85%A8%E6%9B%B8%E6%9C%AC%29%2F%E5%8D%B710%E4%B8%8B',
  }),
  soundCommentary: Object.freeze({
    title: '邵氏皇极经世声音律吕图总论',
    edition: '识典古籍固定章节页',
    revision: 'SK1996/1lbez9aejtfsi',
    url: 'https://www.shidianguji.com/book/SK1996/chapter/1lbez9aejtfsi',
  }),
}) satisfies Record<string, HuangjiReferenceSource>;

export type HuangjiReferenceTableId = 'sound-rhythm' | 'animal-plant' | 'historical-era';

export interface HuangjiSoundRhythmReference {
  readonly table: 'sound-rhythm';
  readonly title: '声音律吕图';
  readonly source: readonly HuangjiReferenceSource[];
  readonly bodyCounts: {
    readonly heavenlyBody: 160;
    readonly earthlyBody: 192;
    readonly heavenlyUseSound: 112;
    readonly earthlyUseTone: 152;
  };
  readonly soundCategories: readonly ['平', '上', '去', '入'];
  readonly toneCategories: readonly ['开', '发', '收', '闭'];
  readonly pairings: readonly [
    { readonly image: '日'; readonly sound: '声'; readonly tone: '音'; readonly element: '水' },
    { readonly image: '月'; readonly sound: '声'; readonly tone: '音'; readonly element: '火' },
    { readonly image: '星'; readonly sound: '声'; readonly tone: '音'; readonly element: '土' },
    { readonly image: '辰'; readonly sound: '声'; readonly tone: '音'; readonly element: '石' },
  ];
  readonly rules: readonly string[];
  readonly limitations: readonly string[];
}

export interface HuangjiAnimalPlantReference {
  readonly table: 'animal-plant';
  readonly title: '动植物数';
  readonly source: readonly HuangjiReferenceSource[];
  readonly counts: readonly {
    readonly name: string;
    readonly value: number;
    readonly formula: string;
  }[];
  readonly limitations: readonly string[];
}

export interface HuangjiHistoricalEraRow {
  readonly rowIndex: number;
  readonly ganzhi: string;
  readonly historicalLabel?: string;
}

export interface HuangjiHistoricalEraEntry {
  readonly rowIndex: number;
  readonly ganzhi: string;
  readonly label: string;
}

export interface HuangjiHistoricalEraReference {
  readonly table: 'historical-era';
  readonly title: '经辰历史纪年原表';
  readonly source: HuangjiReferenceSource;
  readonly shiIndex: number;
  readonly sourceBranch: string;
  readonly branch: EarthlyBranch;
  readonly sourceBranchNote?: string;
  readonly rows: readonly HuangjiHistoricalEraRow[];
  readonly namedEntries: readonly HuangjiHistoricalEraEntry[];
  readonly limitations: readonly string[];
}

export type HuangjiReferenceResult =
  HuangjiSoundRhythmReference | HuangjiAnimalPlantReference | HuangjiHistoricalEraReference;

export type HuangjiReferenceQuery =
  | { readonly table: 'sound-rhythm' }
  | { readonly table: 'animal-plant' }
  | { readonly table: 'historical-era'; readonly shiIndex: number };

const SOUND_RHYTHM_RULES = Object.freeze([
  '日月星辰为声，水火土石为音；声皆为律，音皆为吕。',
  '声别平、上、去、入；音别开、发、收、闭。',
  '奇数取声清、音辟；偶数取声浊、音翕。',
  '直看、横看皆以日声水音、月声火音、星声土音、辰声石音为四象次序。',
] as const);

const SOUND_RHYTHM_LIMITATIONS = Object.freeze([
  '本表只输出固定版本中可直接核对的数目、分类和四象关系，不把卷十下图中的缺字符号转换成现代读音。',
  '识典章节该处转录为“一百一十二因一百二十二”而结果给出一万七千二十四；动植物数表按同段上下文以112×152复算，原字仍待底本影像逐字校核。',
] as const);

const HUANGJI_SOUND_RHYTHM_REFERENCE = Object.freeze<HuangjiSoundRhythmReference>({
  table: 'sound-rhythm',
  title: '声音律吕图',
  source: [HUANGJI_REFERENCE_SOURCES.volume10Lower, HUANGJI_REFERENCE_SOURCES.soundCommentary],
  bodyCounts: {
    heavenlyBody: 160,
    earthlyBody: 192,
    heavenlyUseSound: 112,
    earthlyUseTone: 152,
  },
  soundCategories: ['平', '上', '去', '入'],
  toneCategories: ['开', '发', '收', '闭'],
  pairings: [
    { image: '日', sound: '声', tone: '音', element: '水' },
    { image: '月', sound: '声', tone: '音', element: '火' },
    { image: '星', sound: '声', tone: '音', element: '土' },
    { image: '辰', sound: '声', tone: '音', element: '石' },
  ] as const,
  rules: SOUND_RHYTHM_RULES,
  limitations: SOUND_RHYTHM_LIMITATIONS,
});

const HUANGJI_ANIMAL_PLANT_REFERENCE: HuangjiAnimalPlantReference = Object.freeze({
  table: 'animal-plant',
  title: '动植物数',
  source: [HUANGJI_REFERENCE_SOURCES.soundCommentary, HUANGJI_REFERENCE_SOURCES.volume10Lower],
  counts: [
    { name: '天之体数', value: 160, formula: '10×16' },
    { name: '地之体数', value: 192, formula: '12×16' },
    { name: '动植之全数', value: 30720, formula: '160×192' },
    { name: '动物之用数', value: 17024, formula: '112×152' },
    { name: '植物之用数', value: 17024, formula: '152×112' },
    { name: '动物通数', value: 289816576, formula: '17024×17024' },
  ],
  limitations: SOUND_RHYTHM_LIMITATIONS,
});

const HUANGJI_HISTORICAL_EVENTS: readonly {
  readonly shiIndex: number;
  readonly ganzhi: string;
  readonly label: string;
}[] = [
  { shiIndex: 2156, ganzhi: '甲辰', label: '唐堯' },
  { shiIndex: 2158, ganzhi: '丙辰', label: '虞舜' },
  { shiIndex: 2160, ganzhi: '丁巳', label: '夏禹' },
  { shiIndex: 2161, ganzhi: '甲申', label: '夏啓' },
  { shiIndex: 2161, ganzhi: '癸巳', label: '夏太康' },
  { shiIndex: 2162, ganzhi: '壬戌', label: '夏仲康' },
  { shiIndex: 2163, ganzhi: '乙亥', label: '夏相' },
  { shiIndex: 2164, ganzhi: '癸卯', label: '夏少康' },
  { shiIndex: 2165, ganzhi: '壬午', label: '夏少康立' },
  { shiIndex: 2166, ganzhi: '甲辰', label: '夏杼' },
  { shiIndex: 2166, ganzhi: '辛酉', label: '夏槐' },
  { shiIndex: 2167, ganzhi: '丁亥', label: '夏芒' },
  { shiIndex: 2168, ganzhi: '乙巳', label: '夏泄' },
  { shiIndex: 2168, ganzhi: '辛酉', label: '夏不降' },
  { shiIndex: 2170, ganzhi: '庚申', label: '夏扄' },
  { shiIndex: 2171, ganzhi: '辛巳', label: '夏厪' },
  { shiIndex: 2172, ganzhi: '壬寅', label: '夏孔甲' },
  { shiIndex: 2173, ganzhi: '癸酉', label: '夏臯' },
  { shiIndex: 2173, ganzhi: '甲申', label: '夏發' },
  { shiIndex: 2174, ganzhi: '癸卯', label: '夏癸' },
  { shiIndex: 2176, ganzhi: '乙未', label: '商湯' },
  { shiIndex: 2176, ganzhi: '戊申', label: '商太甲' },
  { shiIndex: 2177, ganzhi: '辛巳', label: '商沃丁' },
  { shiIndex: 2178, ganzhi: '庚戌', label: '商太庚' },
  { shiIndex: 2179, ganzhi: '乙亥', label: '商小甲' },
  { shiIndex: 2179, ganzhi: '壬辰', label: '商雍己' },
  { shiIndex: 2180, ganzhi: '甲辰', label: '商太戊' },
  { shiIndex: 2182, ganzhi: '己未', label: '商仲丁' },
  { shiIndex: 2183, ganzhi: '壬申', label: '商外壬' },
  { shiIndex: 2183, ganzhi: '丁亥', label: '商河亶甲' },
  { shiIndex: 2184, ganzhi: '丙申', label: '商祖乙' },
  { shiIndex: 2184, ganzhi: '乙卯', label: '商祖辛' },
  { shiIndex: 2185, ganzhi: '辛未', label: '商沃甲' },
  { shiIndex: 2186, ganzhi: '丙申', label: '商祖丁' },
  { shiIndex: 2187, ganzhi: '戊辰', label: '商南庚' },
  { shiIndex: 2187, ganzhi: '癸巳', label: '商陽甲' },
  { shiIndex: 2188, ganzhi: '庚子', label: '商盤庚' },
  { shiIndex: 2189, ganzhi: '戊辰', label: '商小辛' },
  { shiIndex: 2189, ganzhi: '己丑', label: '商小乙' },
  { shiIndex: 2190, ganzhi: '丁巳', label: '商武丁' },
  { shiIndex: 2192, ganzhi: '丙辰', label: '商祖庚' },
  { shiIndex: 2192, ganzhi: '癸亥', label: '商祖甲' },
  { shiIndex: 2194, ganzhi: '丙申', label: '商廩辛' },
  { shiIndex: 2194, ganzhi: '壬寅', label: '商庚丁' },
  { shiIndex: 2194, ganzhi: '癸亥', label: '商武乙' },
  { shiIndex: 2195, ganzhi: '丁卯', label: '商太丁' },
  { shiIndex: 2195, ganzhi: '庚午', label: '商帝乙' },
  { shiIndex: 2196, ganzhi: '丁未', label: '商受辛' },
  { shiIndex: 2197, ganzhi: '己卯', label: '周武王' },
  { shiIndex: 2197, ganzhi: '丙戌', label: '周成王' },
  { shiIndex: 2198, ganzhi: '癸亥', label: '周康王' },
  { shiIndex: 2199, ganzhi: '己丑', label: '周昭王' },
  { shiIndex: 2201, ganzhi: '庚辰', label: '周穆王' },
  { shiIndex: 2203, ganzhi: '乙亥', label: '周恭王' },
  { shiIndex: 2203, ganzhi: '丁亥', label: '周懿王' },
  { shiIndex: 2204, ganzhi: '壬子', label: '周孝王' },
  { shiIndex: 2205, ganzhi: '丁卯', label: '周夷王' },
  { shiIndex: 2205, ganzhi: '癸未', label: '周厲王' },
  { shiIndex: 2207, ganzhi: '甲戌', label: '周宣王' },
  { shiIndex: 2208, ganzhi: '庚申', label: '周幽王' },
] as const;

const HUANGJI_SOURCE_BRANCH_CORRECTIONS: Readonly<Record<number, string>> = Object.freeze({
  2178: '己',
  2190: '己',
});

const HISTORICAL_LIMITATIONS = Object.freeze([
  '本表按固定卷三上、卷三下逐“经辰”区块保留三十个六十甲子顺序与原文标出的历史名称；普通行不擅自解释为现代公历年。',
  '卷页文字本在第2178、2190区块将顺序地支录作“己”；接口同时返回原文字和按经辰序列校出的“巳”，方便复核，不把校正值当作另一套纪年算法。',
] as const);

function cloneSource(source: HuangjiReferenceSource): HuangjiReferenceSource {
  return { ...source };
}

function getHistoricalSource(shiIndex: number): HuangjiReferenceSource {
  return cloneSource(
    shiIndex <= 2184
      ? HUANGJI_REFERENCE_SOURCES.volume3Upper
      : HUANGJI_REFERENCE_SOURCES.volume3Lower,
  );
}

export function getHuangjiHistoricalEraBlock(shiIndex: number): HuangjiHistoricalEraReference {
  if (!Number.isSafeInteger(shiIndex) || shiIndex < 2149 || shiIndex > 2208) {
    throw new Error('经辰序号必须是2149至2208之间的整数。');
  }

  const branch = EARTHLY_BRANCHES[(shiIndex - 2149) % EARTHLY_BRANCHES.length];
  const sourceBranch = HUANGJI_SOURCE_BRANCH_CORRECTIONS[shiIndex] ?? branch;
  const events = HUANGJI_HISTORICAL_EVENTS.filter((event) => event.shiIndex === shiIndex);
  const start = ((shiIndex - 2149) * 30) % SIXTY_CYCLE.length;
  const rows = Array.from({ length: 30 }, (_, index) => {
    const ganzhi = SIXTY_CYCLE[(start + index) % SIXTY_CYCLE.length];
    const event = events.find((item) => item.ganzhi === ganzhi);
    return {
      rowIndex: index + 1,
      ganzhi,
      ...(event ? { historicalLabel: event.label } : {}),
    };
  });

  return {
    table: 'historical-era',
    title: '经辰历史纪年原表',
    source: getHistoricalSource(shiIndex),
    shiIndex,
    sourceBranch,
    branch,
    ...(sourceBranch !== branch
      ? { sourceBranchNote: '固定卷页文字作“己”；按相邻经辰的子丑寅卯辰巳顺序校为“巳”。' }
      : {}),
    rows,
    namedEntries: events.map((event) => ({
      rowIndex: rows.findIndex((row) => row.ganzhi === event.ganzhi) + 1,
      ganzhi: event.ganzhi,
      label: event.label,
    })),
    limitations: [...HISTORICAL_LIMITATIONS],
  };
}

export function queryHuangjiReference(query: HuangjiReferenceQuery): HuangjiReferenceResult {
  switch (query.table) {
    case 'sound-rhythm':
      return {
        ...HUANGJI_SOUND_RHYTHM_REFERENCE,
        source: HUANGJI_SOUND_RHYTHM_REFERENCE.source.map(cloneSource),
        bodyCounts: { ...HUANGJI_SOUND_RHYTHM_REFERENCE.bodyCounts },
        soundCategories: [...HUANGJI_SOUND_RHYTHM_REFERENCE.soundCategories],
        toneCategories: [...HUANGJI_SOUND_RHYTHM_REFERENCE.toneCategories],
        pairings: structuredClone(HUANGJI_SOUND_RHYTHM_REFERENCE.pairings),
        rules: [...HUANGJI_SOUND_RHYTHM_REFERENCE.rules],
        limitations: [...HUANGJI_SOUND_RHYTHM_REFERENCE.limitations],
      };
    case 'animal-plant':
      return {
        ...HUANGJI_ANIMAL_PLANT_REFERENCE,
        source: HUANGJI_ANIMAL_PLANT_REFERENCE.source.map(cloneSource),
        counts: HUANGJI_ANIMAL_PLANT_REFERENCE.counts.map((item) => ({ ...item })),
        limitations: [...HUANGJI_ANIMAL_PLANT_REFERENCE.limitations],
      };
    case 'historical-era':
      return getHuangjiHistoricalEraBlock(query.shiIndex);
    default:
      throw new Error('未知皇极经世资料表。');
  }
}
