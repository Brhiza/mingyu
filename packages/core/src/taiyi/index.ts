/**
 * @file 太乙神数四计
 * @description 依《太乙金镜式经》《武备志》与固定版本 Kintaiyi 校核年、月、日、时四计七十二局基础盘。
 *
 * 四计使用各自时间尺度，不能用年计结果替代月、日、时计：
 *   - 年计：太乙积年 10153917 起算。
 *   - 月计：以逐月节气换月，闰月不另起一局。
 *   - 日计：按固定现代历元累计，并校正六十日干支序。
 *   - 时计：按固定现代历元累计十二时辰，冬至后阳遁、夏至后阴遁。
 *   - 局数：积年除 72，余 0 作第 72 局。
 *   - 太乙、文昌（主目）、始击（客目）按七十二局逐局表定位。
 *   - 主算、客算按七十二局立成表取值，不再用洛书宫简单累加代替。
 *
 * 日、时计采用现代历法定位来复现通行实用排法；结果元数据会明确这一口径，不把它冒充为
 * 古籍历法常数、小余和气应链的逐项复原。
 */
import { createUtcTimestamp } from '../calendar/date-validation';
import { SolarDay, SolarTime } from 'tyme4ts';
import { getSixtyCycle, isValidGanZhi } from '../ganzhi';
import type { TaiyiModelInfo, TaiyiResult, TaiyiScope } from '../types/divination';
import { evaluateTaiyiConditions } from './conditions';
import type { TaiyiRuleConditions } from './conditions';
import { buildTaiyiEvidence, getTaiyiCountNature } from './evidence';
import { getTaiyiPalaces, getTaiyiSixteenGods, type TaiyiPalaceProfile } from './fixed-data';

export { evaluateTaiyiConditions, TAIYI_POINT_WUXING } from './conditions';
export { assertTaiyiFixedFacts } from './evidence';

export type { TaiyiModelInfo, TaiyiResult, TaiyiScope } from '../types/divination';
export type {
  TaiyiConditionInput,
  TaiyiFiveGeneralsCondition,
  TaiyiFiveGeneralsRelation,
  TaiyiGateName,
  TaiyiGateRoleFact,
  TaiyiHostGuestElementFact,
  TaiyiHostGuestElementRelation,
  TaiyiPalaceRelation,
  TaiyiRuleConditions,
  TaiyiThreeGateCondition,
  TaiyiYinYangCondition,
  TaiyiYinYangPairFact,
  TaiyiWuxing,
} from './conditions';
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
const TAIYI_MONTH_BRANCHES = '寅卯辰巳午未申酉戌亥子丑';

export type { TaiyiPalaceProfile } from './fixed-data';

/** 太乙八宫编号不是洛书九宫编号：1乾、2午、3艮、4卯、6酉、7坤、8子、9巽。 */
const CANONICAL_TAIYI_PALACES: Readonly<Record<number, Readonly<TaiyiPalaceProfile>>> =
  getTaiyiPalaces();

export const TAIYI_PALACES: typeof CANONICAL_TAIYI_PALACES = Object.fromEntries(
  Object.entries(CANONICAL_TAIYI_PALACES).map(([key, profile]) => [key, { ...profile }]),
);

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
const YIN_TAIYI_POINTS = [...TAIYI_POINTS].reverse();
const WENCHANG_POINTS = Array.from(
  '申酉戌乾乾亥子丑艮寅卯辰巽巳午未坤坤申酉戌乾乾亥子丑艮寅卯辰巽巳午未坤坤申酉戌乾乾亥子丑艮寅卯辰巽巳午未坤坤申酉戌乾乾亥子丑艮寅卯辰巽巳午未坤坤',
);
const YIN_WENCHANG_POINTS = Array.from(
  '寅卯辰巽巽巳午未坤申酉戌乾亥子丑艮艮寅卯辰巽巽巳午未坤申酉戌乾亥子丑艮艮寅卯辰巽巽巳午未坤申酉戌乾亥子丑艮艮寅卯辰巽巽巳午未坤申酉戌乾亥子丑艮艮',
);
const SHIJI_POINTS = Array.from(
  '坤戌亥丑寅辰巳坤酉乾丑寅辰午坤酉亥子艮辰巳未申戌亥艮卯巽未申戌子艮卯巳午坤戌亥丑寅辰巳坤酉乾丑寅辰午坤酉亥子艮辰巳未申戌亥艮卯巽未申戌子艮卯巳午',
);
/** 七十二局主客算及按《武备志》六合定目、正间逐宫法校正的定算。 */
const YEAR_CALCULATIONS: ReadonlyArray<readonly [number, number, number]> = [
  [7, 13, 13],
  [6, 1, 1],
  [1, 40, 32],
  [25, 17, 10],
  [25, 14, 1],
  [25, 10, 32],
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
  [31, 28, 24],
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
  [33, 14, 32],
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
  [10, 25, 1],
  [12, 26, 37],
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
  [17, 26, 30],
  [2, 3, 3],
  [1, 7, 7],
  [7, 33, 27],
  [1, 34, 25],
  [6, 26, 19],
  [35, 23, 8],
  [12, 37, 13],
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
  [29, 4, 16],
  [8, 25, 32],
  [7, 15, 26],
  [2, 8, 15],
  [27, 28, 28],
  [27, 26, 26],
  [26, 18, 15],
  [26, 22, 9],
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
  [10, 35, 23],
  [27, 12, 28],
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
const CANONICAL_TAIYI_16_GODS = getTaiyiSixteenGods();

export const TAIYI_16_GODS: typeof CANONICAL_TAIYI_16_GODS = CANONICAL_TAIYI_16_GODS.map((god) => ({
  ...god,
}));

export interface TaiyiInput {
  date?: Date;
  /** 真太阳时起局时的实际占时；节气与年月干支按此瞬时确定。 */
  termReferenceDate?: Date;
  ganZhi?: string;
  scope?: TaiyiScope;
  year?: number;
}

export const TAIYI_MODEL_INFO: TaiyiModelInfo = {
  id: 'taiyi-four-calculations-72-table',
  name: '太乙四计七十二局基础盘',
  supportedScopes: ['year', 'month', 'day', 'hour'],
  precision:
    '年计按积年起局；月计按逐月节气换局；日、时计采用现代历法定位，时计按冬夏至分阴阳遁；三门、五将、阴阳和按所列《太乙金镜式经》条文复算，仍属于传统规则条件',
  sources: [
    {
      title: '《太乙金镜式经》',
      url: 'https://www.shidianguji.com/book/SK1615/chapter/1l9lir71oidda',
      evidence: '年、月、日、时四计积数规则及太乙行宫、文昌、始击、计神与主客算',
    },
    {
      title: 'Kintaiyi',
      url: 'https://github.com/kentang2017/kintaiyi/tree/9842d8f35e895ea6f09e9787edf6da5c16fab91b',
      evidence: '用于交叉核对四计积数、阴阳遁、七十二局位置表与初始算表',
    },
    {
      title: '《武备志》卷一百六十九·求定计目法',
      url: 'https://www.shidianguji.com/zh/book/CADAL02092259/chapter/1lb3wzm7f2qzs',
      evidence: '六合合神加本计支取定目，正宫按宫数、间神起一，逐宫行算至太乙宫前并定位定将参',
    },
    {
      title: '《太乙金镜式经》三门、五将与阴阳和条文',
      url: 'https://www.shidianguji.com/book/SK1615/chapter/1l9lir94lo45l',
      evidence: '用于计算三门直使、五将发不发与太乙及上下二目和算的阴阳配合条件',
    },
    {
      title: '《太乙统宗宝鉴》卷五·明三门具不具',
      url: 'https://www.shidianguji.com/book/CADAL02055529/chapter/1l5erimkclsn3',
      evidence: '三门具不具按太乙、天目所临开、休、生门判定；各目所临八门另行保留',
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

/** 《太乙统宗宝鉴》卷五的长短缓急与主客比较依据。 */
export function formatTaiyiTacticBasis(params: {
  lordCount: number;
  guestCount: number;
  lordNature?: string;
  guestNature?: string;
}): string {
  const { lordCount, guestCount, lordNature, guestNature } = params;
  const describe = (side: string, count: number, nature?: string) =>
    `${side}算${count}${nature ? `（${nature}）` : ''}，${count >= 11 ? '为长算，传统取缓而深入' : '为短算，传统取急而浅为'}`;
  return [
    describe('主', lordCount, lordNature),
    describe('客', guestCount, guestNature),
    '主客胜负须合看三门具否、五将发否、阴阳和否；主客吉凶条件相等时，再以算之长短比较',
  ].join('；');
}

export function formatTaiyiConditionSummary(conditions: TaiyiRuleConditions): string {
  return `${conditions.threeGates.status}（直使${conditions.threeGates.directGate}）；五将${conditions.fiveGenerals.launched ? '发' : '不发'}；阴阳${conditions.yinYangHarmony.matched ? '和' : '不和'}。`;
}

/** 按长短缓急法描述主客算，并结合门将条件审其胜负。 */
export function evaluateTaiyiTacticGuidance(params: {
  lordCount: number;
  guestCount: number;
  lordNature?: string;
  guestNature?: string;
  conditions?: TaiyiRuleConditions;
}): string {
  const { conditions } = params;
  const conditionText = conditions
    ? `盘面条件：${conditions.threeGates.status}（直使${conditions.threeGates.directGate}，${conditions.threeGates.blockedRoles.length ? `涉及${conditions.threeGates.blockedRoles.join('、')}` : '太乙与文昌主目均未落三吉门，始击门位单列'}）；五将${conditions.fiveGenerals.launched ? '发' : '不发'}；阴阳${conditions.yinYangHarmony.matched ? '和' : '不和'}`
    : '当前未传入三门、五将、阴阳和盘面事实，不能据长短单独断胜负';
  return `${formatTaiyiTacticBasis(params)}；${conditionText}`;
}

function generalPalaceFromCount(value: number): number {
  const remainder = value % 10;
  // 主、客、定算逢整十以九去之：十、二十、三十、四十分别入一至四宫。
  return remainder === 0 ? value % 9 : remainder;
}

function assistantPalaceFromGeneral(general: number): number {
  const remainder = (general * 3) % 10;
  return remainder === 0 ? 5 : remainder;
}

function formatGeneralPalace(value: number): string {
  if (value === 5) return '5中宫';
  const profile = CANONICAL_TAIYI_PALACES[value];
  return profile ? `${value}宫（${profile.gua}卦、${profile.dir}）` : `${value}宫`;
}

function createYearProbeDate(year: number): Date {
  // 东八区 7 月 1 日正午，与下游 readCivilParts 的日期口径一致。
  return new Date(createUtcTimestamp(year, 6, 1, 4));
}

/**
 * 太乙日期统一按东八区（UTC+8）读取民用字段。
 * Date 本身是绝对时刻，其本地字段随运行环境时区变化；固定按东八区读取
 * 可保证同一时刻在任何环境得到相同的积日、积时与局数。
 */
const TAIYI_TIMEZONE_OFFSET_MS = 8 * 3_600_000;

interface TaiyiCivilParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function readCivilParts(date: Date): TaiyiCivilParts {
  const shifted = new Date(date.getTime() + TAIYI_TIMEZONE_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
  };
}

function withTaiyiCalendarSupport<T>(operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.startsWith('illegal solar year:') ||
        error.message.startsWith('illegal solar day:'))
    ) {
      throw new Error('太乙日期无法在当前历法库支持的范围内换算为干支或节气。', {
        cause: error,
      });
    }
    throw error;
  }
}

/** 按东八区民用字段推四柱，并以指定瞬时核对节气年、月。 */
function getTaiyiGanZhiFromDate(
  date: Date,
  termReferenceDate = date,
): {
  year: string;
  month: string;
  day: string;
  hour: string;
} {
  const parts = readCivilParts(date);
  const eightChar = withTaiyiCalendarSupport(() =>
    SolarTime.fromYmdHms(parts.year, parts.month, parts.day, parts.hour, parts.minute, parts.second)
      .getLunarHour()
      .getEightChar(),
  );
  const termEightChar =
    termReferenceDate.getTime() === date.getTime()
      ? eightChar
      : withTaiyiCalendarSupport(() => {
          const termParts = readCivilParts(termReferenceDate);
          return SolarTime.fromYmdHms(
            termParts.year,
            termParts.month,
            termParts.day,
            termParts.hour,
            termParts.minute,
            termParts.second,
          )
            .getLunarHour()
            .getEightChar();
        });
  return {
    year: termEightChar.getYear().getName(),
    month: termEightChar.getMonth().getName(),
    day: eightChar.getDay().getName(),
    hour: eightChar.getHour().getName(),
  };
}

function daysSince(date: Date, year: number, month: number, day: number): number {
  const parts = readCivilParts(date);
  // 与推干支所用历法一致：1582-10-04 后的下一日是 1582-10-15。
  return SolarDay.fromYmd(parts.year, parts.month, parts.day).subtract(
    SolarDay.fromYmd(year, month, day),
  );
}

function getSeasonHalf(date: Date): 'winter' | 'summer' {
  const parts = readCivilParts(date);
  const term = withTaiyiCalendarSupport(() =>
    SolarTime.fromYmdHms(parts.year, parts.month, parts.day, parts.hour, parts.minute, parts.second)
      .getTerm()
      .getName(),
  );
  return [
    '夏至',
    '小暑',
    '大暑',
    '立秋',
    '处暑',
    '白露',
    '秋分',
    '寒露',
    '霜降',
    '立冬',
    '小雪',
    '大雪',
  ].includes(term)
    ? 'summer'
    : 'winter';
}

function resolveYinYang(scope: TaiyiScope, termReferenceDate: Date): '阳遁' | '阴遁' {
  if (scope !== 'hour') return '阳遁';
  return getSeasonHalf(termReferenceDate) === 'winter' ? '阳遁' : '阴遁';
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
  termReferenceDate: Date;
  ganZhi: string;
} {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('太乙参数必须是对象。');
  }
  const scope = input.scope ?? 'year';
  if (!Object.hasOwn(SCOPE_LABELS, scope)) throw new Error(`太乙计式无效：${String(scope)}`);
  if (
    input.date !== undefined &&
    (!(input.date instanceof Date) || Number.isNaN(input.date.getTime()))
  ) {
    throw new Error('太乙日期无效。');
  }
  if (
    input.termReferenceDate !== undefined &&
    (!(input.termReferenceDate instanceof Date) || Number.isNaN(input.termReferenceDate.getTime()))
  ) {
    throw new Error('太乙实际占时无效。');
  }
  if (input.termReferenceDate !== undefined && input.date === undefined) {
    throw new Error('太乙实际占时必须与起局日期同时提供。');
  }
  if (scope === 'year' && input.year === undefined) {
    throw new Error('太乙年计必须提供公历年份。');
  }
  if (scope === 'year' && input.date !== undefined) {
    throw new Error('太乙年计只接受 year；月计、日计和时计使用 date。');
  }
  if (scope !== 'year' && input.date === undefined) {
    throw new Error(`太乙${SCOPE_LABELS[scope].title}需要提供有效日期和时间。`);
  }
  const dateYear = input.date ? readCivilParts(input.date).year : undefined;
  if (input.year !== undefined && dateYear !== undefined && input.year !== dateYear) {
    throw new Error('太乙 year 与 date 的公历年份不一致。');
  }
  const year = input.year ?? dateYear;
  if (typeof year !== 'number' || !Number.isSafeInteger(year) || year < 1 || year > 9999) {
    throw new Error('太乙年份必须是 1-9999 之间的整数。');
  }
  const date = input.date ?? createYearProbeDate(year);
  const termReferenceDate = input.termReferenceDate ?? date;
  const pillars = getTaiyiGanZhiFromDate(date, termReferenceDate);
  const calculatedGanZhi = pillars[scope];
  if (input.ganZhi !== undefined) {
    if (!isValidGanZhi(input.ganZhi)) throw new Error(`太乙干支无效：${input.ganZhi}`);
    if (input.ganZhi !== calculatedGanZhi) {
      throw new Error(
        `太乙${SCOPE_LABELS[scope].title}干支与日期不一致：应为 ${calculatedGanZhi}。`,
      );
    }
  }
  return { scope, year, date, termReferenceDate, ganZhi: input.ganZhi ?? calculatedGanZhi };
}

function alignToGanZhi(value: number, ganZhi: string): number {
  const ganZhiIndex = getSixtyCycle().indexOf(ganZhi);
  if (ganZhiIndex < 0) throw new Error(`太乙干支序缺失：${ganZhi}`);
  const expectedRemainder = ganZhiIndex + 1;
  const currentRemainder = positiveOneBased(value, 60);
  return value + ((expectedRemainder - currentRemainder + 60) % 60);
}

function calculateAccumulatedValue(
  scope: TaiyiScope,
  date: Date,
  termReferenceDate: Date,
  year: number,
  ganZhi: string,
): number {
  if (scope === 'year') return TAIYI_BASE_YEARS + year;
  if (scope === 'month') {
    const monthOrder = TAIYI_MONTH_BRANCHES.indexOf(ganZhi[1]) + 1;
    if (monthOrder === 0) throw new Error(`太乙月建地支无效：${ganZhi}`);
    const solarYear =
      getTaiyiGanZhiFromDate(date, termReferenceDate).year ===
      getTaiyiGanZhiFromDate(createYearProbeDate(year)).year
        ? year
        : year - 1;
    return (TAIYI_BASE_YEARS + solarYear - 1) * 12 + 2 + monthOrder;
  }

  if (scope === 'day') {
    // 本计日干支在子初 23 时换日，积日也须在同一时刻进一日。
    const dayOffset = readCivilParts(date).hour === 23 ? 1 : 0;
    const rawValue = 708011105 - 185 + daysSince(date, 1900, 6, 19) + dayOffset;
    return alignToGanZhi(rawValue, ganZhi);
  }

  const accumulatedDays = 708011105 + daysSince(date, 1900, 12, 21);
  const timeIndex = Math.floor((readCivilParts(date).hour + 1) / 2);
  return (accumulatedDays - 1) * 12 + timeIndex + 1;
}

/** 生成太乙年、月、日、时四计七十二局基础盘。 */
export function generateTaiyi(input: TaiyiInput): TaiyiResult {
  const { scope, year, date, termReferenceDate, ganZhi } = validateInput(input);
  const accumulatedValue = calculateAccumulatedValue(scope, date, termReferenceDate, year, ganZhi);
  const entryYears = positiveOneBased(accumulatedValue, 360);
  const bureau = positiveOneBased(accumulatedValue, 72);
  const index = bureau - 1;
  const yinYang = resolveYinYang(scope, termReferenceDate);
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
  const lordGeneral = generalPalaceFromCount(lordCount);
  const lordAssistant = assistantPalaceFromGeneral(lordGeneral);
  const guestGeneral = generalPalaceFromCount(guestCount);
  const guestAssistant = assistantPalaceFromGeneral(guestGeneral);
  const setGeneral = generalPalaceFromCount(setCount);
  const setAssistant = assistantPalaceFromGeneral(setGeneral);
  const yuan = Math.ceil(entryYears / 72);
  const ji = Math.ceil(entryYears / 60);
  const conditions = evaluateTaiyiConditions({
    accumulatedValue,
    taiyiPosition,
    taiyiPalace,
    wenChangPosition,
    wenChangPalace,
    shiJiPosition,
    shiJiPalace,
    lordCount,
    guestCount,
    lordGeneral,
    lordAssistant,
    guestGeneral,
    guestAssistant,
  });

  const judgments: string[] = [];
  if (shiJiPosition === taiyiPosition) judgments.push('掩：始击与太乙同宫，传统称客目掩太乙。');
  const imprisonedRoles = [
    wenChangPosition === taiyiPosition ? '文昌' : undefined,
    lordGeneral === taiyiPalace ? '主大将' : undefined,
    lordAssistant === taiyiPalace ? '主参将' : undefined,
    guestGeneral === taiyiPalace ? '客大将' : undefined,
    guestAssistant === taiyiPalace ? '客参将' : undefined,
  ].filter((item): item is string => item !== undefined);
  if (imprisonedRoles.length > 0) judgments.push(`囚：${imprisonedRoles.join('、')}与太乙同宫。`);
  const lordNature = getTaiyiCountNature(lordCount);
  const guestNature = getTaiyiCountNature(guestCount);
  const setNature = getTaiyiCountNature(setCount);
  if (lordNature) judgments.push(`主算 ${lordCount} 为${lordNature}。`);
  if (guestNature) judgments.push(`客算 ${guestCount} 为${guestNature}。`);
  if (setNature) judgments.push(`定算 ${setCount} 为${setNature}。`);
  if (lordGeneral === 5 || lordAssistant === 5) {
    judgments.push('主大将或主参将居中宫。');
  }
  if (guestGeneral === 5 || guestAssistant === 5) {
    judgments.push('客大将或客参将居中宫。');
  }
  const conditionSummary = formatTaiyiConditionSummary(conditions);
  judgments.push(conditionSummary);

  const sixteenGods = CANONICAL_TAIYI_16_GODS.map(({ branch, name }) => ({ branch, god: name }));
  const taiyiProfile = CANONICAL_TAIYI_PALACES[taiyiPalace];
  const scopeInfo = SCOPE_LABELS[scope];
  const civil = readCivilParts(date);
  const dateTime = `${civil.year}-${String(civil.month).padStart(2, '0')}-${String(civil.day).padStart(2, '0')} ${String(civil.hour).padStart(2, '0')}:${String(civil.minute).padStart(2, '0')}:${String(civil.second).padStart(2, '0')}`;
  const actualCivil = readCivilParts(termReferenceDate);
  const termReferenceDateTime = input.termReferenceDate
    ? `${actualCivil.year}-${String(actualCivil.month).padStart(2, '0')}-${String(actualCivil.day).padStart(2, '0')} ${String(actualCivil.hour).padStart(2, '0')}:${String(actualCivil.minute).padStart(2, '0')}:${String(actualCivil.second).padStart(2, '0')}`
    : undefined;
  const evidenceAnalysis = buildTaiyiEvidence({
    scope,
    dateTime,
    termReferenceDateTime,
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
    conditions,
    model: TAIYI_MODEL_INFO,
  });
  const countNatures = {
    lord: lordNature,
    guest: guestNature,
    set: setNature,
  };
  const tacticGuidance = evaluateTaiyiTacticGuidance({
    lordCount,
    guestCount,
    lordNature,
    guestNature,
    conditions,
  });
  const mainGateRoles = conditions.threeGates.roles
    .filter((role) => role.usedForThreeGate)
    .map((role) => `${role.role}${role.gate ?? '门位未定'}`)
    .join('、');
  const guestGateRole =
    conditions.threeGates.roles.find((role) => !role.usedForThreeGate)?.gate ?? '门位未定';
  const gateSummary = [
    `门将阴阳和：${conditionSummary}`,
    '主门具按太乙与文昌（主目）是否临开、休、生门判定',
    `主门位：${mainGateRoles}`,
    `始击（客目）门位单列：${guestGateRole}。`,
  ].join('；');
  const prompt = [
    `【太乙神数 · ${scopeInfo.title}】`,
    scope === 'year'
      ? `分析目标：${year}年年计。`
      : `分析目标：${dateTime}（东八区）起局的${scopeInfo.title}盘。`,
    ...(termReferenceDateTime
      ? [`节气与年月干支参照实际占时：${termReferenceDateTime}（东八区）。`]
      : []),
    `本计干支：${ganZhi}。`,
    `${yinYang}第 ${bureau} 局。`,
    `核心宫位：太乙在${taiyiPosition}（第${taiyiPalace}宫，${taiyiProfile.gua}卦，${taiyiProfile.dir}，五行${taiyiProfile.wu}）；文昌（主目）在${wenChangPosition}（第${wenChangPalace}宫）；始击（客目）在${shiJiPosition}（第${shiJiPalace}宫）；计神在${jiShenPosition}（第${jiShenPalace}宫）。`,
    `主客定算：主算 ${lordCount}${lordNature ? `（${lordNature}）` : ''}；客算 ${guestCount}${guestNature ? `（${guestNature}）` : ''}；定算 ${setCount}${setNature ? `（${setNature}）` : ''}。`,
    `大局攻守：${formatTaiyiTacticBasis({ lordCount, guestCount, lordNature, guestNature })}。`,
    gateSummary,
    `将参：主大将${formatGeneralPalace(lordGeneral)}、主参将${formatGeneralPalace(lordAssistant)}；客大将${formatGeneralPalace(guestGeneral)}、客参将${formatGeneralPalace(guestAssistant)}；定大将${formatGeneralPalace(setGeneral)}、定参将${formatGeneralPalace(setAssistant)}。`,
    `十六神：${sixteenGods.map((item) => `${item.branch}${item.god}`).join('、')}。`,
    ...(() => {
      const specialJudgments = judgments.filter(
        (item) =>
          !/^(主算|客算|定算)\s*\d+\s*为/u.test(item) &&
          item !== conditionSummary &&
          item !== '主大将或主参将居中宫。' &&
          item !== '客大将或客参将居中宫。',
      );
      return specialJudgments.length ? [`判断：${specialJudgments.join('；')}`] : [];
    })(),
  ].join('\n');

  return {
    scope,
    ganZhi,
    dateTime,
    ...(termReferenceDateTime ? { termReferenceDateTime } : {}),
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
    countNatures,
    tacticGuidance,
    lordGeneral,
    lordAssistant,
    guestGeneral,
    guestAssistant,
    setGeneral,
    setAssistant,
    sixteenGods,
    conditions,
    judgments,
    model: structuredClone(TAIYI_MODEL_INFO),
    evidenceAnalysis,
    prompt,
  };
}

export const taiyi = {
  generateTaiyi,
  evaluateTaiyiConditions,
  evaluateTaiyiTacticGuidance,
  TAIYI_16_GODS,
  TAIYI_BASE_YEARS,
  TAIYI_PALACES,
  TAIYI_MODEL_INFO,
  buildTaiyiEvidence,
};
