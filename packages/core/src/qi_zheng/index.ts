/**
 * @file 七政四余（Qizheng Siyu / 果老星宗）
 * @description 中国占星：日、月、五星为七政；罗睺、计都、月孛、紫炁为四余。
 * 依《果老星宗》《御定五星精义》立命身、定十二宫、安命主、排庙旺、起神煞：
 *   - 安命宫：「以生时，加太阳宫，即从生时顺数见卯所临之宫，即为命宫。」（逢卯安命）
 *   - 安身宫：「以生时加太阴宫，即从生时逆数见酉所临之宫，即为身宫。」
 *   - 安十二宫：自命宫逆数（命、财帛、兄弟、田宅、男女、奴仆、妻妾、疾厄、迁移、官禄、福德、相貌）。
 *   - 安命主：寅亥木、卯戌火、辰酉金、巳申水、子丑土、午日、未月。
 *   - 宿度：采用古距度（角宿起），七政经度由回归黄道换算恒星黄道（减岁差），再入二十八宿。
 *   - 庙旺：七政于十二宫之庙、旺、乐、陷。
 *   - 神煞：天乙贵人（日干）、驿马/劫煞/咸池/华盖/孤辰/寡宿（年支）。
 *
 * 紫炁采用单一《七政算内篇》古法均速模型：周积 10227.1792 日，日行三分五十七秒一四二九，
 * 历元按 PlanetCalendar 对《七政算内篇》至元十八年立元数据的现代复原值换算。
 * 罗计孛取月交点与真莉莉丝（celestine）。
 *
 * 古籍依据：《果老星宗》《御定五星精义》《星学大成》《七政算内篇》《古今律历考》《革象新书》《高丽史》。
 */
import { calculateChart } from 'celestine';
import { SevenStar, TwentyEightStar } from 'tyme4ts';
import { daysInGregorianMonth } from '../calendar/date-validation';
import { getShichenFromClock } from '../calendar/dateUtils';
import { getGanZhiFromDate } from '../ganzhi';

/** 二十八宿古距度（角宿起黄经 0；用于古距度宿度换算） */
const XIU_DISTANCES = [
  12, 9, 16, 5, 6, 18, 9.5, 26, 8, 12, 10, 17, 16, 9, 16, 12, 15, 11, 16, 2, 9, 33, 4, 15, 7, 18,
  18, 17,
];
const XIU_TOTAL = XIU_DISTANCES.reduce((sum, distance) => sum + distance, 0);
const XIU: { name: string; du: number }[] = TwentyEightStar.NAMES.map(
  (name: string, index: number) => ({
    name: TwentyEightStar.fromName(name).getName(),
    du: XIU_DISTANCES[index],
  }),
);

/** 黄道十二宫（七政四余职名，子丑寅卯…自命宫逆布十二职） */
export const TWELVE_PALACES = [
  '命宫',
  '财帛',
  '兄弟',
  '田宅',
  '男女',
  '奴仆',
  '妻妾',
  '疾厄',
  '迁移',
  '官禄',
  '福德',
  '相貌',
];

/** 命主：十二宫序（子0…亥11）→ 主星 */
const MING_ZHU: Record<number, string> = {
  0: '土',
  1: '土',
  2: '木',
  3: '火',
  4: '金',
  5: '水',
  6: '日',
  7: '月',
  8: '水',
  9: '金',
  10: '火',
  11: '木',
};

/** 七政庙旺乐陷（按十二宫序，子0…亥11） */
const DIGNITY: Record<string, { miao: number[]; wang: number[]; le: number[]; xian: number[] }> = {
  日: { miao: [6], wang: [8], le: [1, 7], xian: [0] },
  月: { miao: [7], wang: [9], le: [2], xian: [5] },
  木: { miao: [2], wang: [11], le: [3], xian: [8] },
  火: { miao: [3], wang: [2], le: [5], xian: [11] },
  土: { miao: [0], wang: [1], le: [4], xian: [6] },
  金: { miao: [9], wang: [4], le: [1], xian: [3] },
  水: { miao: [0], wang: [8], le: [11], xian: [5] },
};

export interface QizhengStar {
  name: string;
  kind: '七政' | '四余';
  tropicalLongitude: number; // 回归黄经 0-360
  longitude: number; // 恒星黄经 0-360
  xiu: string;
  sevenStar: string;
  xiuDegree: number;
  signIndex: number; // 十二宫序号 0-11
  palace: string;
  retrograde: boolean;
  dignity?: string; // 庙/旺/乐/陷/平（七政）；四余为 —
}

export interface QizhengInput {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute?: number;
  latitude?: number;
  longitude?: number;
  timezone?: number;
}

export interface QizhengResult {
  stars: QizhengStar[];
  mingGong: number;
  shenGong: number;
  mingZhu: string;
  twelvePalaces: { palace: string; signIndex: number }[];
  shensha: { name: string; value: string }[];
  ziqiModel: ZiqiModelInfo;
  ziqi: ZiqiPosition;
  prompt: string;
}

export interface ZiqiSource {
  title: string;
  url: string;
  category: '古籍原文' | '古籍校勘' | '开源复原' | '开源对照';
  usage: '采用' | '校勘说明' | '未采用';
  evidence: string;
}

export interface ZiqiModelInfo {
  id: string;
  name: string;
  direction: '顺行';
  cycleYears: number;
  periodDays: number;
  dailyMotionDegrees: number;
  classicalDegreeRate: string;
  classicalDailyMotion: string;
  classicalEpoch: string;
  classicalWinterSolsticeOffsetDays: number;
  modernEpochUtc: string;
  modernEpochTropicalLongitude: number;
  formula: string;
  coordinate: string;
  precision: string;
  sources: ZiqiSource[];
}

export interface ZiqiPosition {
  tropicalLongitude: number;
  siderealLongitude: number;
  direction: '顺行';
  dailyMotionDegrees: number;
  cycleProgress: number;
  daysSinceZeroLongitude: number;
  daysUntilZeroLongitude: number;
}

const ZIQI_PERIOD_DAYS = 10227.1792;
const ZIQI_DAILY_MOTION = 360 / ZIQI_PERIOD_DAYS;
const ZIQI_MODERN_EPOCH_UTC_MS = Date.UTC(1995, 11, 31, 0, 0, 0);
const ZIQI_MODERN_EPOCH_LONGITUDE = 237.038993;

/**
 * 紫炁唯一采用的古法模型。
 *
 * 《七政算内篇》载「顺行二十八年一周天」、周积 10227.1792 日、至后策 1256.5224 日；
 * PlanetCalendar 将该立元数据复原为 1995-12-31 09:00 韩国标准时（即 00:00 UTC）
 * 回归黄经 237.038993°，日行 0.0352003219030327°。
 */
export const ZIQI_MODEL_INFO: ZiqiModelInfo = {
  id: 'qizhengsuan-naepyeon-mean-motion',
  name: '《七政算内篇》紫炁古法均速',
  direction: '顺行',
  cycleYears: 28,
  periodDays: ZIQI_PERIOD_DAYS,
  dailyMotionDegrees: ZIQI_DAILY_MOTION,
  classicalDegreeRate: '二十八日一度',
  classicalDailyMotion: '三分五十七秒一四二九',
  classicalEpoch: '大元至元十八年立元前天正冬至（1280年冬至）',
  classicalWinterSolsticeOffsetDays: 1256.5224,
  modernEpochUtc: '1995-12-31T00:00:00.000Z',
  modernEpochTropicalLongitude: ZIQI_MODERN_EPOCH_LONGITUDE,
  formula: '回归黄经 = 归一化(237.038993° + 距1995-12-31T00:00:00Z日数 × 360° / 10227.1792日)',
  coordinate: '先算回归黄经均速值，再按项目统一岁差换算为恒星黄经与二十八宿宿度',
  precision:
    '可按输入分钟稳定复现古法均速值；误差边界来自古法均速假设、历元现代复原和宿度坐标，不宣称现代天体测量的角秒精度',
  sources: [
    {
      title: '《七政算内篇》四余星第七·紫气',
      url: 'https://zh.wikisource.org/wiki/朝鮮王朝實錄/世宗實錄/七政算內外篇',
      category: '古籍原文',
      usage: '采用',
      evidence: '顺行二十八年一周天；至后策1256.5224日；周积10227.1792日；二十八日一度',
    },
    {
      title: '《古今律历考》卷五十八',
      url: 'https://zh.wikisource.org/wiki/古今律厯考_(四庫全書本)/卷58',
      category: '古籍校勘',
      usage: '校勘说明',
      evidence:
        '复载周积10227.1792日，并指出末位收舍会造成约0.0308日的周积差；本模型为保持《七政算内篇》同源立成，仍采用原载周积',
    },
    {
      title: '《革象新书》卷三',
      url: 'https://zh.wikisource.org/wiki/革象新書_(四庫全書本)/卷3',
      category: '古籍原文',
      usage: '采用',
      evidence: '紫气每日所行均平、起于闰法、约二十八年周天，并明确与月孛分列推算',
    },
    {
      title: '《高丽史》卷五十二',
      url: 'https://zh.wikisource.org/wiki/高麗史/卷五十二',
      category: '古籍原文',
      usage: '采用',
      evidence: '紫气每日顺行三分五十七秒，约二十八日一度',
    },
    {
      title: 'PlanetCalendar',
      url: 'https://github.com/fftkrr/PlanetCalendar/blob/3a9f317c0e6c16294c9feb0da4f233d12dd7a29e/cal_calculation.c',
      category: '开源复原',
      usage: '采用',
      evidence: 'MIT开源实现，依据《七政算内篇》复原现代历元237.038993°与日行度',
    },
    {
      title: 'MOIRA Chinese Astrology',
      url: 'https://github.com/BahnAstro/MOIRA_chinese_astrology/blob/6507fae6aa3c7297d55f7a549f703b3dd9d5706d/moira_extra_files/moira_s.prop',
      category: '开源对照',
      usage: '未采用',
      evidence:
        '同用10227.1792日周期，但1975年历元与《七政算内篇》现代复原相差约99.11°，且未给出古籍推导，因此不并入计算',
    },
    {
      title: 'FINASTRO',
      url: 'https://github.com/BahnAstro/FINASTRO/blob/842d27a2bb814870c00068d99fd7da6fc4e2f0db/alldata31.py',
      category: '开源对照',
      usage: '未采用',
      evidence: '沿用MOIRA的1975年历元，仅作为同周期实现的交叉检索记录，不作为本项目参数来源',
    },
  ],
};

function normalizeLongitude(value: number): number {
  return ((value % 360) + 360) % 360;
}

function assertIntegerRange(value: number, label: string, min: number, max: number): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label}需在 ${min}-${max} 之间。`);
  }
}

function assertNumberRange(value: number, label: string, min: number, max: number): void {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${label}需在 ${min} 到 ${max} 之间。`);
  }
}

function validateQizhengInput(input: QizhengInput, includeLocation: boolean): void {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('七政四余参数必须是对象。');
  }
  assertIntegerRange(input.year, '年份', 1900, 2200);
  assertIntegerRange(input.month, '月份', 1, 12);
  const maxDay = daysInGregorianMonth(input.year, input.month);
  if (!Number.isInteger(input.day) || input.day < 1 || input.day > maxDay) {
    throw new Error(`日期需在 1-${maxDay} 之间。`);
  }
  assertIntegerRange(input.hour, '小时', 0, 23);
  assertIntegerRange(input.minute ?? 0, '分钟', 0, 59);
  assertNumberRange(input.timezone ?? 8, '时区', -12, 14);
  if (includeLocation) {
    assertNumberRange(input.latitude ?? 39.9, '纬度', -90, 90);
    assertNumberRange(input.longitude ?? 116.4, '经度', -180, 180);
  }
}

function getTargetUtcMs(input: QizhengInput): number {
  validateQizhengInput(input, false);
  const localAsUtcMs = Date.UTC(
    input.year,
    input.month - 1,
    input.day,
    input.hour,
    input.minute ?? 0,
    0,
  );
  return localAsUtcMs - (input.timezone ?? 8) * 60 * 60 * 1000;
}

function getDecimalYear(utcMs: number): number {
  const date = new Date(utcMs);
  const year = date.getUTCFullYear();
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);
  return year + (utcMs - start) / (end - start);
}

/** 依《七政算内篇》单一古法模型计算紫炁回归黄经。 */
export function calculateZiqiTropicalLongitude(input: QizhengInput): number {
  const targetUtcMs = getTargetUtcMs(input);
  const elapsedDays = (targetUtcMs - ZIQI_MODERN_EPOCH_UTC_MS) / 86_400_000;
  return normalizeLongitude(ZIQI_MODERN_EPOCH_LONGITUDE + elapsedDays * ZIQI_DAILY_MOTION);
}

/**
 * J2000.0 至目标年份的黄经岁差（IAU 2006 近似，单位：度）。
 * 23.44° 是黄赤交角，不能作为岁差基数；2024 年累计岁差约 0.34°。
 */
export function getPrecessionOffset(year: number): number {
  if (!Number.isFinite(year)) throw new Error('岁差年份必须是有效数字。');
  const t = (year - 2000) / 100;
  const arcSeconds =
    5028.796195 * t + 1.1054348 * t ** 2 + 0.00007964 * t ** 3 - 0.000023857 * t ** 4;
  return arcSeconds / 3600;
}

/** 回归黄经 → 恒星黄经（减岁差） */
function toSidereal(tropical: number, year: number): number {
  return normalizeLongitude(tropical - getPrecessionOffset(year));
}

/** 返回紫炁的完整可审计位置数据；项目中不存在第二套紫炁计算模型。 */
export function calculateZiqiPosition(input: QizhengInput): ZiqiPosition {
  const targetUtcMs = getTargetUtcMs(input);
  const tropicalLongitude = calculateZiqiTropicalLongitude(input);
  const siderealLongitude = toSidereal(tropicalLongitude, getDecimalYear(targetUtcMs));
  const daysSinceZeroLongitude = tropicalLongitude / ZIQI_DAILY_MOTION;
  return {
    tropicalLongitude,
    siderealLongitude,
    direction: ZIQI_MODEL_INFO.direction,
    dailyMotionDegrees: ZIQI_DAILY_MOTION,
    cycleProgress: tropicalLongitude / 360,
    daysSinceZeroLongitude,
    daysUntilZeroLongitude: (ZIQI_PERIOD_DAYS - daysSinceZeroLongitude) % ZIQI_PERIOD_DAYS,
  };
}

function longitudeToXiu(L: number): { xiu: string; xiuDegree: number } {
  // 先按本表总古度把现代 360° 黄经等比例换算，再逐宿扣减距度。
  let rem = (((L % 360) + 360) % 360) * (XIU_TOTAL / 360);
  for (const x of XIU) {
    if (rem < x.du) return { xiu: x.name, xiuDegree: rem };
    rem -= x.du;
  }
  return { xiu: XIU[0].name, xiuDegree: rem };
}

/** 天乙贵人（日干） */
function tianYiGuiRen(dayGan: string): string {
  const map: Record<string, string> = {
    甲: '丑未',
    戊: '丑未',
    庚: '丑未',
    乙: '子申',
    己: '子申',
    丙: '亥酉',
    丁: '亥酉',
    壬: '卯巳',
    癸: '卯巳',
    辛: '寅午',
  };
  return map[dayGan] ?? '—';
}

/** 年支三合局 → 各项神煞地支 */
function yearBranchShensha(yearBranch: string): {
  yi: string;
  jie: string;
  chi: string;
  hua: string;
  gu: string;
  gua: string;
} {
  const groups: Record<
    string,
    { yi: string; jie: string; chi: string; hua: string; gu: string; gua: string }
  > = {
    申: { yi: '寅', jie: '巳', chi: '酉', hua: '辰', gu: '巳', gua: '丑' },
    子: { yi: '寅', jie: '巳', chi: '酉', hua: '辰', gu: '巳', gua: '丑' },
    辰: { yi: '寅', jie: '巳', chi: '酉', hua: '辰', gu: '巳', gua: '丑' },
    寅: { yi: '申', jie: '亥', chi: '卯', hua: '戌', gu: '申', gua: '戌' },
    午: { yi: '申', jie: '亥', chi: '卯', hua: '戌', gu: '申', gua: '戌' },
    戌: { yi: '申', jie: '亥', chi: '卯', hua: '戌', gu: '申', gua: '戌' },
    巳: { yi: '亥', jie: '寅', chi: '午', hua: '丑', gu: '亥', gua: '未' },
    酉: { yi: '亥', jie: '寅', chi: '午', hua: '丑', gu: '亥', gua: '未' },
    丑: { yi: '亥', jie: '寅', chi: '午', hua: '丑', gu: '亥', gua: '未' },
    亥: { yi: '巳', jie: '申', chi: '子', hua: '未', gu: '寅', gua: '辰' },
    卯: { yi: '巳', jie: '申', chi: '子', hua: '未', gu: '寅', gua: '辰' },
    未: { yi: '巳', jie: '申', chi: '子', hua: '未', gu: '寅', gua: '辰' },
  };
  const sanhui: Record<string, { gu: string; gua: string }> = {
    亥: { gu: '寅', gua: '戌' },
    子: { gu: '寅', gua: '戌' },
    丑: { gu: '寅', gua: '戌' },
    寅: { gu: '巳', gua: '丑' },
    卯: { gu: '巳', gua: '丑' },
    辰: { gu: '巳', gua: '丑' },
    巳: { gu: '申', gua: '辰' },
    午: { gu: '申', gua: '辰' },
    未: { gu: '申', gua: '辰' },
    申: { gu: '亥', gua: '未' },
    酉: { gu: '亥', gua: '未' },
    戌: { gu: '亥', gua: '未' },
  };
  const base = groups[yearBranch];
  const guChen = sanhui[yearBranch];
  return base && guChen
    ? { ...base, ...guChen }
    : { yi: '—', jie: '—', chi: '—', hua: '—', gu: '—', gua: '—' };
}

const PLANET_NAMES: Record<string, { label: string; key: string }> = {
  Sun: { label: '太阳', key: SevenStar.fromName('日').getName() },
  Moon: { label: '太阴', key: SevenStar.fromName('月').getName() },
  Mercury: { label: '辰星(水)', key: SevenStar.fromName('水').getName() },
  Venus: { label: '太白(金)', key: SevenStar.fromName('金').getName() },
  Mars: { label: '荧惑(火)', key: SevenStar.fromName('火').getName() },
  Jupiter: { label: '岁星(木)', key: SevenStar.fromName('木').getName() },
  Saturn: { label: '镇星(土)', key: SevenStar.fromName('土').getName() },
};

/** 七政庙旺乐陷判定 */
function dignityOf(key: string, signIndex: number): string {
  const d = DIGNITY[key];
  if (!d) return '—';
  if (d.miao.includes(signIndex)) return '庙';
  if (d.wang.includes(signIndex)) return '旺';
  if (d.le.includes(signIndex)) return '乐';
  if (d.xian.includes(signIndex)) return '陷';
  return '平';
}

/** 生成七政四余盘 */
export function generateQizheng(input: QizhengInput): QizhengResult {
  validateQizhengInput(input, true);
  const lat = input.latitude ?? 39.9;
  const lon = input.longitude ?? 116.4;
  const tz = input.timezone ?? 8;
  const chart = calculateChart(
    {
      year: input.year,
      month: input.month,
      day: input.day,
      hour: input.hour,
      minute: input.minute ?? 0,
      second: 0,
      timezone: tz,
      latitude: lat,
      longitude: lon,
    },
    {
      houseSystem: 'placidus',
      includeNodes: 'true' as const,
      includeLilith: 'true' as const,
      includeChiron: false,
      includeAsteroids: false,
      includeLots: false,
      aspectTypes: [],
      minimumAspectStrength: 0,
    },
  );

  const stars: QizhengStar[] = [];
  const targetDecimalYear = getDecimalYear(getTargetUtcMs(input));
  const pushStar = (
    name: string,
    kind: '七政' | '四余',
    tropical: number,
    key?: string,
    retrograde = false,
  ): void => {
    const L = toSidereal(tropical, targetDecimalYear);
    const { xiu, xiuDegree } = longitudeToXiu(L);
    const sevenStar = TwentyEightStar.fromName(xiu).getSevenStar().getName();
    const signIndex = Math.floor(L / 30);
    const dignity = key ? dignityOf(key, signIndex) : '—';
    stars.push({
      name,
      kind,
      tropicalLongitude: normalizeLongitude(tropical),
      longitude: L,
      xiu,
      sevenStar,
      xiuDegree,
      signIndex,
      palace: '',
      retrograde,
      dignity,
    });
  };

  for (const p of chart.planets) {
    const m = PLANET_NAMES[p.name];
    if (!m) continue;
    pushStar(m.label, '七政', p.longitude, m.key, p.isRetrograde ?? false);
  }

  // 四余：罗睺=北交，计都=南交，月孛=真莉莉丝；紫炁依《七政算内篇》古法均速独立推算。
  const nodeMap = new Map(chart.nodes.map((n) => [n.name, n]));
  const lilith = chart.lilith?.[0];
  const north = nodeMap.get('North Node');
  const south = nodeMap.get('South Node');
  if (!north || !south || !lilith) {
    throw new Error('七政四余星体数据不完整：缺少罗睺、计都或月孛。');
  }
  pushStar('罗睺(火余)', '四余', north.longitude);
  pushStar('计都(土余)', '四余', south.longitude);
  pushStar('月孛(水余)', '四余', lilith.longitude);
  const ziqi = calculateZiqiPosition(input);
  pushStar('紫炁(木余)', '四余', ziqi.tropicalLongitude);

  const sun = stars.find((s) => s.name === '太阳');
  const moon = stars.find((s) => s.name === '太阴');
  if (!sun || !moon || stars.filter((star) => star.kind === '七政').length !== 7) {
    throw new Error('七政星体数据不完整：必须包含日、月与五星。');
  }
  const sunSign = sun.signIndex;
  const moonSign = moon.signIndex;

  // 生时地支序（子0…亥11）：复用公共十二时辰；晚子时索引 12 归并为子支序 0。
  const shichen = getShichenFromClock(input.hour, input.minute ?? 0);
  if (!shichen) throw new Error('七政四余无法根据输入时间确定时辰。');
  const hourIdx = shichen.index % 12;
  const MAO = 3,
    YOU = 9; // 卯、酉

  // 安命宫：「生时加太阳宫，顺数见卯」→ 命宫 = 太阳宫 + (卯 - 生时) mod 12
  const mingGong = (((sunSign + (MAO - hourIdx) + 12) % 12) + 12) % 12;
  // 安身宫：「生时加太阴宫，逆数见酉」→ 身宫 = 太阴宫 + (生时 - 酉) mod 12
  const shenGong = (((moonSign + (hourIdx - YOU) + 12) % 12) + 12) % 12;

  const twelvePalaces = TWELVE_PALACES.map((palace, i) => ({
    palace,
    signIndex: (mingGong - i + 12) % 12, // 自命宫逆布
  }));
  const palaceBySign = new Map(twelvePalaces.map((t) => [t.signIndex, t.palace]));
  for (const s of stars) s.palace = palaceBySign.get(s.signIndex) ?? '—';

  const mingZhu = MING_ZHU[mingGong] ?? '—';

  // 神煞（年支 + 日干）
  const dateGanZhi = getGanZhiFromDate(
    new Date(input.year, input.month - 1, input.day, input.hour, input.minute ?? 0),
  );
  const yearBranch = dateGanZhi.year[1];
  const dayGan = dateGanZhi.day[0];
  const ys = yearBranchShensha(yearBranch);
  const shensha = [
    { name: '天乙贵人', value: tianYiGuiRen(dayGan) },
    { name: '驿马', value: ys.yi },
    { name: '劫煞', value: ys.jie },
    { name: '咸池', value: ys.chi },
    { name: '华盖', value: ys.hua },
    { name: '孤辰', value: ys.gu },
    { name: '寡宿', value: ys.gua },
  ];

  const prompt = [
    `【七政四余 · 果老星宗】`,
    `出生时空：${input.year}年${input.month}月${input.day}日 ${String(input.hour).padStart(2, '0')}:${String(input.minute ?? 0).padStart(2, '0')}，纬度${lat}°，经度${lon}°，UTC${tz >= 0 ? '+' : ''}${tz}。`,
    `七政：太阳、太阴、水、金、火、木、土；四余：罗睺、计都、月孛、紫炁。`,
    `紫炁推算口径：${ZIQI_MODEL_INFO.name}；周期${ZIQI_MODEL_INFO.periodDays}日，日行${ZIQI_MODEL_INFO.dailyMotionDegrees.toFixed(12)}°；${ZIQI_MODEL_INFO.precision}。`,
    `紫炁位置：顺行，回归黄经${ziqi.tropicalLongitude.toFixed(6)}°，恒星黄经${ziqi.siderealLongitude.toFixed(6)}°，本周天进度${(ziqi.cycleProgress * 100).toFixed(4)}%。`,
    ...stars.map(
      (s) =>
        `${s.kind} ${s.name}：恒星黄经${s.longitude.toFixed(1)}°，在${s.xiu}宿${s.xiuDegree.toFixed(
          1,
        )}度，落${s.palace}${s.dignity ? '（' + s.dignity + '）' : ''}${s.retrograde ? '（逆）' : ''}`,
    ),
    `命宫在${TWELVE_PALACES[0]}（黄道第 ${mingGong + 1} 宫），命主${mingZhu}；身宫在第 ${shenGong + 1} 宫。`,
    `十二宫映射：${twelvePalaces.map((item) => `${item.palace}=黄道第${item.signIndex + 1}宫`).join('；')}。`,
    `神煞：天乙贵人${shensha[0].value}、驿马${shensha[1].value}、劫煞${shensha[2].value}、咸池${shensha[3].value}、华盖${shensha[4].value}、孤辰${shensha[5].value}、寡宿${shensha[6].value}。`,
    '取证层级：七政四余的宿度、落宫、庙旺和命身宫为主证；神煞只能作为辅证；出现相互矛盾时须说明各证据适用范围，不得以单一星曜或神煞定案。',
    `坐标与精度边界：星体同时保留回归黄经和岁差换算后的恒星黄经；宿度按上方二十八宿古度口径换算。${ZIQI_MODEL_INFO.precision}。本次只解读本命结构与长期倾向，不判断具体应期。`,
    '',
    '请依《果老星宗》星学，论命主强弱、七政庙旺、四余吊照、十二宫所主与神煞吉凶；结论需列出主证、辅证、反证与精度限制。紫炁仅使用上列《七政算内篇》模型，不得替换成月孛对冲或月球近地点。',
  ].join('\n');

  return {
    stars,
    mingGong,
    shenGong,
    mingZhu,
    twelvePalaces,
    shensha,
    ziqiModel: ZIQI_MODEL_INFO,
    ziqi,
    prompt,
  };
}

export const qizheng = {
  generateQizheng,
  getPrecessionOffset,
  calculateZiqiTropicalLongitude,
  calculateZiqiPosition,
  ZIQI_MODEL_INFO,
};
