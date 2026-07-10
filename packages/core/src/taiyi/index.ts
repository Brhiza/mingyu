/**
 * @file 年家太乙神数（Taiyi annual chart）
 * @description 依《太乙金镜式经》《太乙统宗宝鉴》年家七十二局复原基础式盘。
 *
 * 当前只开放已完成逐局表核对的年家盘：
 *   - 太乙积年：10153917 + 公元年。
 *   - 局数：积年除 72，余 0 作第 72 局。
 *   - 太乙、文昌（主目）、始击（客目）按七十二局逐局表定位。
 *   - 主算、客算按七十二局立成表取值，不再用洛书宫简单累加代替。
 *   - 计神按阳遁年支逆布取位。
 *
 * 月计、日计、时计各有独立积月、积日、积时和阴阳遁规则；旧实现只换标题而仍按
 * 公元年份起局，无法成立，因此在完整复原前不再暴露。
 */
import { getGanZhiFromDate, isValidGanZhi } from '../ganzhi';

/** 太乙统宗年家积年基数。 */
export const TAIYI_BASE_YEARS = 10153917;

/** 太乙八宫编号不是洛书九宫编号：1乾、2午、3艮、4卯、6酉、7坤、8子、9巽。 */
const TAIYI_PALACES: Record<number, { gua: string; dir: string; wu: string }> = {
  1: { gua: '乾', dir: '西北', wu: '金' },
  2: { gua: '离', dir: '南', wu: '火' },
  3: { gua: '艮', dir: '东北', wu: '土' },
  4: { gua: '震', dir: '东', wu: '木' },
  6: { gua: '兑', dir: '西', wu: '金' },
  7: { gua: '坤', dir: '西南', wu: '土' },
  8: { gua: '坎', dir: '北', wu: '水' },
  9: { gua: '巽', dir: '东南', wu: '木' },
};

const POINT_TO_PALACE: Record<string, number> = {
  戌: 1,
  乾: 1,
  巳: 2,
  午: 2,
  丑: 3,
  艮: 3,
  寅: 4,
  卯: 4,
  申: 6,
  酉: 6,
  未: 7,
  坤: 7,
  亥: 8,
  子: 8,
  辰: 9,
  巽: 9,
};

/** 七十二局太乙、文昌、始击位置，按第 1 局至第 72 局顺序。 */
const TAIYI_POINTS = Array.from(
  '乾乾乾午午午艮艮艮卯卯卯酉酉酉坤坤坤子子子巽巽巽乾乾乾午午午艮艮艮卯卯卯酉酉酉坤坤坤子子子巽巽巽乾乾乾午午午艮艮艮卯卯卯酉酉酉坤坤坤子子子巽巽巽',
);
const WENCHANG_POINTS = Array.from(
  '申酉戌乾乾亥子丑艮寅卯辰巽巳午未坤坤申酉戌乾乾亥子丑艮寅卯辰巽巳午未坤坤申酉戌乾乾亥子丑艮寅卯辰巽巳午未坤坤申酉戌乾乾亥子丑艮寅卯辰巽巳午未坤坤',
);
const SHIJI_POINTS = Array.from(
  '坤戌亥丑寅辰巳坤酉乾丑寅辰午坤酉亥子艮辰巳未申戌亥艮卯巽未丑戌子艮卯巳午坤戌亥丑寅辰巳坤酉乾丑寅辰午坤酉亥子艮辰巳未申戌亥艮卯巽未丑戌子艮卯巳午',
);

/** 七十二局主算、客算、定算立成；本模块当前公开前两项。 */
const YEAR_CALCULATIONS: ReadonlyArray<readonly [number, number, number]> = [
  [7, 13, 13],
  [6, 1, 1],
  [1, 40, 32],
  [25, 17, 10],
  [25, 14, 1],
  [25, 10, 12],
  [8, 25, 9],
  [1, 22, 3],
  [3, 15, 33],
  [1, 12, 25],
  [4, 4, 13],
  [37, 1, 4],
  [18, 19, 19],
  [10, 9, 9],
  [9, 7, 6],
  [1, 33, 26],
  [7, 27, 16],
  [7, 26, 11],
  [8, 32, 14],
  [7, 26, 2],
  [2, 17, 33],
  [16, 30, 1],
  [16, 23, 32],
  [16, 17, 23],
  [39, 40, 40],
  [32, 31, 31],
  [31, 28, 31],
  [14, 9, 38],
  [13, 39, 26],
  [10, 32, 17],
  [33, 10, 34],
  [25, 8, 24],
  [24, 3, 15],
  [26, 4, 11],
  [25, 28, 1],
  [25, 27, 36],
  [1, 7, 7],
  [6, 35, 35],
  [35, 34, 26],
  [27, 19, 12],
  [27, 16, 3],
  [27, 12, 34],
  [8, 17, 1],
  [23, 14, 32],
  [32, 7, 25],
  [5, 16, 29],
  [4, 8, 17],
  [1, 5, 8],
  [24, 25, 25],
  [16, 15, 15],
  [15, 13, 6],
  [39, 31, 24],
  [38, 25, 14],
  [38, 24, 9],
  [16, 3, 22],
  [15, 34, 10],
  [10, 25, 10],
  [12, 26, 27],
  [12, 19, 28],
  [12, 13, 19],
  [33, 34, 34],
  [26, 25, 25],
  [25, 22, 18],
  [16, 11, 7],
  [15, 1, 28],
  [12, 34, 19],
  [25, 2, 26],
  [17, 8, 16],
  [16, 32, 7],
  [30, 4, 15],
  [29, 32, 5],
  [29, 31, 9],
];

const YANG_JISHEN_BY_YEAR_BRANCH: Record<string, string> = {
  子: '寅',
  丑: '丑',
  寅: '子',
  卯: '亥',
  辰: '戌',
  巳: '酉',
  午: '申',
  未: '未',
  申: '午',
  酉: '巳',
  戌: '辰',
  亥: '卯',
};

/** 十六神固定宫位。 */
export const TAIYI_16_GODS: { name: string; branch: string }[] = [
  { name: '地主', branch: '子' },
  { name: '阳德', branch: '丑' },
  { name: '和德', branch: '艮' },
  { name: '吕申', branch: '寅' },
  { name: '高丛', branch: '卯' },
  { name: '太阳', branch: '辰' },
  { name: '大旲', branch: '巽' },
  { name: '大神', branch: '巳' },
  { name: '大威', branch: '午' },
  { name: '天道', branch: '未' },
  { name: '大武', branch: '坤' },
  { name: '武德', branch: '申' },
  { name: '太簇', branch: '酉' },
  { name: '阴主', branch: '戌' },
  { name: '阴德', branch: '乾' },
  { name: '大义', branch: '亥' },
];

export type TaiyiScope = 'year';

export interface TaiyiInput {
  date?: Date;
  ganZhi?: string;
  scope?: TaiyiScope;
  year?: number;
}

export interface TaiyiModelInfo {
  id: string;
  name: string;
  supportedScopes: TaiyiScope[];
  precision: string;
  sources: { title: string; url: string; evidence: string }[];
}

export const TAIYI_MODEL_INFO: TaiyiModelInfo = {
  id: 'taiyi-tongzong-annual-72-table',
  name: '年家太乙七十二局立成',
  supportedScopes: ['year'],
  precision: '年家基础式盘逐局表复原；月计、日计、时计尚未完整复原，不返回近似结果',
  sources: [
    {
      title: '《太乙金镜式经》',
      url: 'https://zh.wikisource.org/wiki/太乙金鏡式經_(四庫全書本)',
      evidence: '年计、太乙行宫、文昌、始击、主客算与七十二局立成',
    },
    {
      title: 'Kintaiyi',
      url: 'https://github.com/kentang2017/kintaiyi/tree/9842d8f35e895ea6f09e9787edf6da5c16fab91b',
      evidence: 'MIT 开源完整实现，用于交叉核对七十二局位置表与主客算立成',
    },
  ],
};

export interface TaiyiResult {
  scope: TaiyiScope;
  ganZhi: string;
  accumulatedYears: number;
  entryYears: number;
  yuan: number;
  ji: number;
  yinYang: '阳遁';
  bureau: number;
  taiyiPosition: string;
  taiyiPalace: number;
  taiyiGua: string;
  taiyiDir: string;
  wenChangPosition: string;
  wenChangPalace: number;
  shiJiPosition: string;
  shiJiPalace: number;
  jiShenPosition: string;
  jiShenPalace: number;
  lordCount: number;
  guestCount: number;
  sixteenGods: { branch: string; god: string }[];
  judgments: string[];
  model: TaiyiModelInfo;
  prompt: string;
}

function positiveOneBased(value: number, cycle: number): number {
  const remainder = ((value % cycle) + cycle) % cycle;
  return remainder === 0 ? cycle : remainder;
}

function pointToPalace(point: string): number {
  const palace = POINT_TO_PALACE[point];
  if (!palace) throw new Error(`太乙宫位数据缺失：${point}`);
  return palace;
}

function countNature(value: number): string | undefined {
  const map: Record<number, string> = {
    1: '杂阴',
    2: '纯阴',
    3: '纯阳',
    4: '杂阳',
    6: '纯阴',
    7: '杂阴',
    8: '杂阳',
    9: '纯阳',
    11: '阴中重阳',
    12: '下和',
    13: '杂重阳',
    14: '上和',
    16: '下和',
    17: '阴中重阳',
    18: '上和',
    19: '杂重阳',
    22: '纯阴',
    23: '次和',
    24: '杂重阴',
    26: '纯阴',
    27: '下和',
    28: '杂重阴',
    29: '次和',
    31: '杂重阳',
    32: '次和',
    33: '纯阳',
    34: '下和',
    37: '杂重阳',
    38: '下和',
    39: '纯阳',
  };
  return map[value];
}

function createYearProbeDate(year: number): Date {
  const date = new Date(0);
  date.setHours(12, 0, 0, 0);
  date.setFullYear(year, 6, 1);
  return date;
}

function validateInput(input: TaiyiInput): { year: number; ganZhi: string } {
  if (input.scope !== undefined && input.scope !== 'year') {
    throw new Error('当前仅支持已完成七十二局校核的年家太乙。');
  }
  if (
    input.date !== undefined &&
    (!(input.date instanceof Date) || Number.isNaN(input.date.getTime()))
  ) {
    throw new Error('太乙日期无效。');
  }
  const dateYear = input.date?.getFullYear();
  if (input.year !== undefined && dateYear !== undefined && input.year !== dateYear) {
    throw new Error('太乙 year 与 date 的公历年份不一致。');
  }
  const year = input.year ?? dateYear ?? new Date().getFullYear();
  if (!Number.isSafeInteger(year) || year < 1 || year > 9999) {
    throw new Error('太乙年份必须是 1-9999 之间的整数。');
  }
  const calculatedGanZhi = getGanZhiFromDate(createYearProbeDate(year)).year;
  if (input.ganZhi !== undefined) {
    if (!isValidGanZhi(input.ganZhi)) throw new Error(`太乙干支无效：${input.ganZhi}`);
    if (input.ganZhi !== calculatedGanZhi) {
      throw new Error(`太乙干支与公元 ${year} 年不一致：应为 ${calculatedGanZhi}。`);
    }
  }
  return { year, ganZhi: input.ganZhi ?? calculatedGanZhi };
}

/** 生成年家太乙七十二局基础盘。 */
export function generateTaiyi(input: TaiyiInput = {}): TaiyiResult {
  const { year, ganZhi } = validateInput(input);
  const accumulatedYears = TAIYI_BASE_YEARS + year;
  const entryYears = positiveOneBased(accumulatedYears, 360);
  const bureau = positiveOneBased(accumulatedYears, 72);
  const index = bureau - 1;
  const taiyiPosition = TAIYI_POINTS[index];
  const wenChangPosition = WENCHANG_POINTS[index];
  const shiJiPosition = SHIJI_POINTS[index];
  const taiyiPalace = pointToPalace(taiyiPosition);
  const wenChangPalace = pointToPalace(wenChangPosition);
  const shiJiPalace = pointToPalace(shiJiPosition);
  const yearBranch = ganZhi[1];
  const jiShenPosition = YANG_JISHEN_BY_YEAR_BRANCH[yearBranch];
  const jiShenPalace = pointToPalace(jiShenPosition);
  const [lordCount, guestCount] = YEAR_CALCULATIONS[index];
  const yuan = Math.ceil(entryYears / 72);
  const ji = Math.ceil(entryYears / 60);

  const judgments: string[] = [];
  if (shiJiPalace === taiyiPalace) judgments.push('掩：始击与太乙同宫，客目掩太乙。');
  if (wenChangPalace === taiyiPalace) judgments.push('囚：文昌与太乙同宫，主目囚太乙。');
  const lordNature = countNature(lordCount);
  const guestNature = countNature(guestCount);
  if (lordNature) judgments.push(`主算 ${lordCount} 为${lordNature}。`);
  if (guestNature) judgments.push(`客算 ${guestCount} 为${guestNature}。`);
  if (judgments.length === 0) judgments.push('本局未见主目、客目与太乙同位。');

  const sixteenGods = TAIYI_16_GODS.map(({ branch, name }) => ({ branch, god: name }));
  const taiyiProfile = TAIYI_PALACES[taiyiPalace];
  const prompt = [
    '【太乙神数 · 年家】',
    `干支：${ganZhi}；岁支：${yearBranch}。`,
    `模型：${TAIYI_MODEL_INFO.name}；${TAIYI_MODEL_INFO.precision}。`,
    `太乙积年：${accumulatedYears}；入纪元数：${entryYears}；第 ${yuan} 元、第 ${ji} 纪；阳遁第 ${bureau} 局。`,
    `太乙在${taiyiPosition}（第${taiyiPalace}宫，${taiyiProfile.dir}）；文昌（主目）在${wenChangPosition}；始击（客目）在${shiJiPosition}；计神在${jiShenPosition}。`,
    `主算 ${lordCount}，客算 ${guestCount}。`,
    `判断：${judgments.join('；')}`,
    '',
    '请依《太乙金镜式经》年家式理，结合太乙、文昌、始击、计神与主客算，分析气运、动静、攻守与时宜；不得把本结果扩写成尚未计算的月计、日计或时计。',
  ].join('\n');

  return {
    scope: 'year',
    ganZhi,
    accumulatedYears,
    entryYears,
    yuan,
    ji,
    yinYang: '阳遁',
    bureau,
    taiyiPosition,
    taiyiPalace,
    taiyiGua: taiyiProfile.gua,
    taiyiDir: taiyiProfile.dir,
    wenChangPosition,
    wenChangPalace,
    shiJiPosition,
    shiJiPalace,
    jiShenPosition,
    jiShenPalace,
    lordCount,
    guestCount,
    sixteenGods,
    judgments,
    model: TAIYI_MODEL_INFO,
    prompt,
  };
}

export const taiyi = {
  generateTaiyi,
  TAIYI_16_GODS,
  TAIYI_BASE_YEARS,
  TAIYI_MODEL_INFO,
};
