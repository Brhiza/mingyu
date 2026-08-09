/**
 * @file 太乙神数年计
 * @description 依《太乙金镜式经》与固定版本 Kintaiyi 交叉校核年计七十二局基础盘。
 *
 * 当前只开放已完成来源校勘的年计：
 *   - 年计：太乙积年 10153917 起算。
 *   - 局数：积年除 72，余 0 作第 72 局。
 *   - 太乙、文昌（主目）、始击（客目）按七十二局逐局表定位。
 *   - 主算、客算按七十二局立成表取值，不再用洛书宫简单累加代替。
 *   - 年计采用阳遁立成。
 *
 * 《太乙金镜式经》虽载年、月、日、时四计，但月计须按逐月节气时刻，日时计还涉及
 * 章月、月法、日法、气应与小余。旧实现采用现代固定历元近似，未复现完整古籍历法链，
 * 因此月、日、时计在完成校勘前失败关闭，不输出近似盘冒充传统精确结果。
 */
import { getGanZhiFromDate, isValidGanZhi } from '../ganzhi';
import type { TaiyiModelInfo, TaiyiResult, TaiyiScope } from '../types/divination';
import { buildTaiyiEvidence } from './evidence';

export type { TaiyiModelInfo, TaiyiResult, TaiyiScope } from '../types/divination';
export type {
  TaiyiConditionFact,
  TaiyiCounterEvidenceFact,
  TaiyiCounterSummaryFact,
  TaiyiEvidenceAnalysis,
  TaiyiForceFact,
  TaiyiLimitationFact,
  TaiyiPositionFact,
  TaiyiSixteenGodFact,
} from './evidence';

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
const YIN_TAIYI_POINTS = Array.from(
  '巽巽巽子子子坤坤坤酉酉酉卯卯卯艮艮艮午午午乾乾乾巽巽巽子子子坤坤坤酉酉酉卯卯卯艮艮艮午午午乾乾乾巽巽巽子子子坤坤坤酉酉酉卯卯卯艮艮艮午午午乾乾乾',
);
const WENCHANG_POINTS = Array.from(
  '申酉戌乾乾亥子丑艮寅卯辰巽巳午未坤坤申酉戌乾乾亥子丑艮寅卯辰巽巳午未坤坤申酉戌乾乾亥子丑艮寅卯辰巽巳午未坤坤申酉戌乾乾亥子丑艮寅卯辰巽巳午未坤坤',
);
const YIN_WENCHANG_POINTS = Array.from(
  '寅卯辰巽巽巳午未坤申酉戌乾亥子丑艮艮寅卯辰巽巽巳午未坤申酉戌乾亥子丑艮艮寅卯辰巽巽巳午未坤申酉戌乾亥子丑艮艮寅卯辰巽巽巳午未坤申酉戌乾亥子丑艮艮',
);
const SHIJI_POINTS = Array.from(
  '坤戌亥丑寅辰巳坤酉乾丑寅辰午坤酉亥子艮辰巳未申戌亥艮卯巽未丑戌子艮卯巳午坤戌亥丑寅辰巳坤酉乾丑寅辰午坤酉亥子艮辰巳未申戌亥艮卯巽未丑戌子艮卯巳午',
);

/** 七十二局主算、客算、定算立成。 */
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

const YIN_CALCULATIONS: ReadonlyArray<readonly [number, number, number]> = [
  [5, 29, 7],
  [4, 17, 1],
  [1, 16, 30],
  [25, 33, 2],
  [25, 30, 1],
  [17, 26, 10],
  [2, 3, 3],
  [1, 7, 7],
  [7, 33, 27],
  [1, 24, 25],
  [6, 26, 19],
  [35, 23, 8],
  [12, 37, 12],
  [12, 27, 11],
  [11, 25, 4],
  [1, 15, 24],
  [3, 9, 16],
  [3, 8, 9],
  [14, 16, 16],
  [13, 10, 10],
  [10, 1, 39],
  [24, 14, 1],
  [24, 7, 40],
  [16, 1, 29],
  [31, 16, 32],
  [30, 7, 29],
  [29, 4, 26],
  [8, 25, 32],
  [7, 15, 26],
  [2, 8, 15],
  [27, 28, 28],
  [27, 26, 26],
  [26, 18, 15],
  [29, 22, 9],
  [25, 10, 1],
  [25, 9, 34],
  [1, 25, 3],
  [4, 13, 37],
  [37, 12, 26],
  [33, 1, 10],
  [33, 38, 9],
  [25, 34, 38],
  [2, 1, 1],
  [39, 38, 38],
  [38, 31, 25],
  [7, 1, 31],
  [6, 32, 25],
  [1, 29, 14],
  [16, 1, 17],
  [16, 31, 15],
  [15, 29, 4],
  [33, 7, 16],
  [32, 1, 8],
  [32, 8, 1],
  [16, 18, 18],
  [15, 12, 12],
  [12, 3, 1],
  [18, 8, 35],
  [18, 1, 34],
  [10, 35, 25],
  [27, 22, 28],
  [26, 3, 25],
  [25, 4, 12],
  [16, 33, 3],
  [15, 23, 34],
  [10, 16, 23],
  [25, 26, 26],
  [25, 24, 24],
  [24, 16, 13],
  [32, 28, 15],
  [31, 16, 7],
  [31, 15, 1],
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

const YIN_JISHEN_BY_BRANCH: Record<string, string> = {
  子: '申',
  丑: '未',
  寅: '午',
  卯: '巳',
  辰: '辰',
  巳: '卯',
  午: '寅',
  未: '丑',
  申: '子',
  酉: '亥',
  戌: '戌',
  亥: '酉',
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

export interface TaiyiInput {
  date?: Date;
  ganZhi?: string;
  scope?: TaiyiScope;
  year?: number;
}

export const TAIYI_MODEL_INFO: TaiyiModelInfo = {
  id: 'taiyi-year-calculation-72-table',
  name: '太乙年计七十二局基础盘',
  supportedScopes: ['year'],
  precision: '年计按积年与阳遁七十二局立成起局',
  sources: [
    {
      title: '《太乙金镜式经》',
      url: 'https://zh.wikisource.org/wiki/太乙金鏡式經_(四庫全書本)',
      evidence: '年计积年及太乙行宫、文昌、始击、主客算；月日时计历法条文仅用于确认当前缺口',
    },
    {
      title: 'Kintaiyi',
      url: 'https://github.com/kentang2017/kintaiyi/tree/9842d8f35e895ea6f09e9787edf6da5c16fab91b',
      evidence:
        '用于交叉核对年计积数、阳遁七十二局位置表与主客定算立成；其月日时简式和分计未作为古籍真值',
    },
  ],
};

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

function generalPalaceFromCount(value: number, side: 'lord' | 'guest' | 'set'): number {
  if (side === 'lord' && value % 10 === 0) return 1;
  const remainder = value % 10;
  return remainder === 0 ? 5 : remainder;
}

function assistantPalaceFromGeneral(general: number): number {
  const remainder = (general * 3) % 10;
  return remainder === 0 ? 5 : remainder;
}

function formatGeneralPalace(value: number): string {
  if (value === 5) return '5中宫';
  const profile = TAIYI_PALACES[value];
  return profile ? `${value}宫（${profile.gua}卦、${profile.dir}）` : `${value}宫`;
}

function createYearProbeDate(year: number): Date {
  const date = new Date(0);
  date.setHours(12, 0, 0, 0);
  date.setFullYear(year, 6, 1);
  return date;
}

const SCOPE_LABELS: Record<
  TaiyiScope,
  { title: string; accumulated: TaiyiResult['accumulatedLabel'] }
> = {
  year: { title: '年计', accumulated: '积年' },
  month: { title: '月计', accumulated: '积月' },
  day: { title: '日计', accumulated: '积日' },
  hour: { title: '时计', accumulated: '积时' },
};

function validateInput(input: TaiyiInput): {
  scope: TaiyiScope;
  year: number;
  date: Date;
  ganZhi: string;
} {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('太乙参数必须是对象。');
  }
  const scope = input.scope ?? 'year';
  if (!SCOPE_LABELS[scope]) throw new Error(`太乙计式无效：${String(scope)}`);
  if (scope !== 'year') {
    throw new Error(
      '太乙月计、日计、时计尚未完成章月、月法、日法、节气时刻、气应与小余的古籍历法链校勘，当前停止输出近似盘。',
    );
  }
  if (
    input.date !== undefined &&
    (typeof input.date.getTime !== 'function' || Number.isNaN(input.date.getTime()))
  ) {
    throw new Error('太乙日期无效。');
  }
  if (input.year === undefined) {
    throw new Error('太乙年计必须提供公历年份。');
  }
  if (input.date !== undefined) throw new Error('太乙年计只接受 year，不接受日期时间。');
  const year = input.year;
  if (typeof year !== 'number' || !Number.isSafeInteger(year) || year < 1 || year > 9999) {
    throw new Error('太乙年份必须是 1-9999 之间的整数。');
  }
  const date = input.date ?? createYearProbeDate(year);
  const pillars = getGanZhiFromDate(date);
  const calculatedGanZhi = pillars[scope];
  if (input.ganZhi !== undefined) {
    if (!isValidGanZhi(input.ganZhi)) throw new Error(`太乙干支无效：${input.ganZhi}`);
    if (input.ganZhi !== calculatedGanZhi) {
      throw new Error(
        `太乙${SCOPE_LABELS[scope].title}干支与日期不一致：应为 ${calculatedGanZhi}。`,
      );
    }
  }
  return { scope, year, date, ganZhi: input.ganZhi ?? calculatedGanZhi };
}

function calculateAccumulatedValue(year: number): number {
  return TAIYI_BASE_YEARS + year;
}

/** 生成太乙年计七十二局基础盘。 */
export function generateTaiyi(input: TaiyiInput): TaiyiResult {
  const { scope, year, date, ganZhi } = validateInput(input);
  const accumulatedValue = calculateAccumulatedValue(year);
  const entryYears = positiveOneBased(accumulatedValue, 360);
  const bureau = positiveOneBased(accumulatedValue, 72);
  const index = bureau - 1;
  const yinYang = '阳遁' as const;
  const taiyiPosition = (yinYang === '阳遁' ? TAIYI_POINTS : YIN_TAIYI_POINTS)[index];
  const wenChangPosition = (yinYang === '阳遁' ? WENCHANG_POINTS : YIN_WENCHANG_POINTS)[index];
  const shiJiPosition = SHIJI_POINTS[index];
  const taiyiPalace = pointToPalace(taiyiPosition);
  const wenChangPalace = pointToPalace(wenChangPosition);
  const shiJiPalace = pointToPalace(shiJiPosition);
  const cycleBranch = ganZhi[1];
  const jiShenPosition = (yinYang === '阳遁' ? YANG_JISHEN_BY_YEAR_BRANCH : YIN_JISHEN_BY_BRANCH)[
    cycleBranch
  ];
  const jiShenPalace = pointToPalace(jiShenPosition);
  const [lordCount, guestCount, setCount] = (
    yinYang === '阳遁' ? YEAR_CALCULATIONS : YIN_CALCULATIONS
  )[index];
  const lordGeneral = generalPalaceFromCount(lordCount, 'lord');
  const lordAssistant = assistantPalaceFromGeneral(lordGeneral);
  const guestGeneral = generalPalaceFromCount(guestCount, 'guest');
  const guestAssistant = assistantPalaceFromGeneral(guestGeneral);
  const setGeneral = generalPalaceFromCount(setCount, 'set');
  const setAssistant = assistantPalaceFromGeneral(setGeneral);
  const yuan = Math.ceil(entryYears / 72);
  const ji = Math.ceil(entryYears / 60);

  const judgments: string[] = [];
  if (shiJiPalace === taiyiPalace) judgments.push('掩：始击与太乙同宫，传统称客目掩太乙。');
  const imprisonedRoles = [
    wenChangPalace === taiyiPalace ? '文昌' : undefined,
    lordGeneral === taiyiPalace ? '主大将' : undefined,
    lordAssistant === taiyiPalace ? '主参将' : undefined,
    guestGeneral === taiyiPalace ? '客大将' : undefined,
    guestAssistant === taiyiPalace ? '客参将' : undefined,
  ].filter((item): item is string => item !== undefined);
  if (imprisonedRoles.length > 0) judgments.push(`囚：${imprisonedRoles.join('、')}与太乙同宫。`);
  const lordNature = countNature(lordCount);
  const guestNature = countNature(guestCount);
  const setNature = countNature(setCount);
  if (lordNature) judgments.push(`主算 ${lordCount} 为${lordNature}。`);
  if (guestNature) judgments.push(`客算 ${guestCount} 为${guestNature}。`);
  if (setNature) judgments.push(`定算 ${setCount} 为${setNature}。`);
  if (lordGeneral === 5 || lordAssistant === 5) {
    judgments.push('主大将或主参将居中宫。');
  }
  if (guestGeneral === 5 || guestAssistant === 5) {
    judgments.push('客大将或客参将居中宫。');
  }

  const sixteenGods = TAIYI_16_GODS.map(({ branch, name }) => ({ branch, god: name }));
  const taiyiProfile = TAIYI_PALACES[taiyiPalace];
  const scopeInfo = SCOPE_LABELS[scope];
  const dateTime = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  const evidenceAnalysis = buildTaiyiEvidence({
    scope,
    dateTime,
    ganZhi,
    accumulatedLabel: scopeInfo.accumulated,
    accumulatedValue,
    entryYears,
    yuan,
    ji,
    yinYang,
    bureau,
    taiyiPosition,
    taiyiPalace,
    wenChangPosition,
    wenChangPalace,
    shiJiPosition,
    shiJiPalace,
    jiShenPosition,
    jiShenPalace,
    lordCount,
    guestCount,
    setCount,
    countNatures: {
      lord: lordNature,
      guest: guestNature,
      set: setNature,
    },
    lordGeneral,
    lordAssistant,
    guestGeneral,
    guestAssistant,
    setGeneral,
    setAssistant,
    sixteenGods,
    model: TAIYI_MODEL_INFO,
  });
  const prompt = [
    `【太乙神数 · ${scopeInfo.title}】`,
    `本计干支：${ganZhi}。`,
    `${yinYang}第 ${bureau} 局。`,
    `核心宫位：太乙在${taiyiPosition}（第${taiyiPalace}宫，${taiyiProfile.gua}卦，${taiyiProfile.dir}，五行${taiyiProfile.wu}）；文昌（主目）在${wenChangPosition}（第${wenChangPalace}宫）；始击（客目）在${shiJiPosition}（第${shiJiPalace}宫）；计神在${jiShenPosition}（第${jiShenPalace}宫）。`,
    `主客定算：主算 ${lordCount}${lordNature ? `（${lordNature}）` : ''}；客算 ${guestCount}${guestNature ? `（${guestNature}）` : ''}；定算 ${setCount}${setNature ? `（${setNature}）` : ''}。`,
    `将参：主大将${formatGeneralPalace(lordGeneral)}、主参将${formatGeneralPalace(lordAssistant)}；客大将${formatGeneralPalace(guestGeneral)}、客参将${formatGeneralPalace(guestAssistant)}；定大将${formatGeneralPalace(setGeneral)}、定参将${formatGeneralPalace(setAssistant)}。`,
    ...(() => {
      const specialJudgments = judgments.filter(
        (item) => !/^(主算|客算|定算)\s*\d+\s*为/u.test(item),
      );
      return specialJudgments.length ? [`判断：${specialJudgments.join('；')}`] : [];
    })(),
  ].join('\n');

  return {
    scope,
    ganZhi,
    dateTime,
    accumulatedValue,
    accumulatedLabel: scopeInfo.accumulated,
    accumulatedYears: accumulatedValue,
    entryYears,
    yuan,
    ji,
    yinYang,
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
    setCount,
    lordGeneral,
    lordAssistant,
    guestGeneral,
    guestAssistant,
    setGeneral,
    setAssistant,
    sixteenGods,
    judgments,
    model: TAIYI_MODEL_INFO,
    evidenceAnalysis,
    prompt,
  };
}

export const taiyi = {
  generateTaiyi,
  TAIYI_16_GODS,
  TAIYI_BASE_YEARS,
  TAIYI_MODEL_INFO,
  buildTaiyiEvidence,
};
