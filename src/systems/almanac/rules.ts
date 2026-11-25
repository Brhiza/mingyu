import { SolarTerm, type SolarDay } from 'tyme4ts';
import {
  EARTHLY_BRANCHES,
  ZODIACS,
  getBranchIndex,
  getSixtyCycleIndex,
  getStemIndex,
  getTwentyEightStarSevenStar,
} from '../ganzhi-foundation';
import { almanacStarAnimal } from './tradition';
import rulesData from './rules-data.json' with { type: 'json' };

const DUTY_NAMES = ['建', '除', '满', '平', '定', '执', '破', '危', '成', '收', '开', '闭'] as const;
const TWELVE_STAR_NAMES = [
  '青龙', '明堂', '天刑', '朱雀', '金匮', '天德',
  '白虎', '玉堂', '天牢', '玄武', '司命', '勾陈',
] as const;
const DIRECTION_NAMES = ['北', '西南', '东', '东南', '中', '西北', '西', '东北', '南'] as const;
const ZONE_NAMES = ['东', '北', '西', '南'] as const;
const TWENTY_EIGHT_LUCK = [
  0, 1, 1, 0, 1, 0, 0, 0, 1, 1, 1, 1, 0, 0,
  1, 0, 0, 1, 0, 1, 0, 0, 1, 1, 1, 0, 1, 0,
] as const;
const TWENTY_EIGHT_NAMES = [
  '角', '亢', '氐', '房', '心', '尾', '箕',
  '斗', '牛', '女', '虚', '危', '室', '壁',
  '奎', '娄', '胃', '昴', '毕', '觜', '参',
  '井', '鬼', '柳', '星', '张', '翼', '轸',
] as const;
const WEEKDAY_TWENTY_EIGHT_BASE = [10, 18, 26, 6, 14, 22, 2] as const;

const OMINOUS_DIRECTIONS = ['南', '东', '北', '西'] as const;
const JOY_DIRECTIONS = [7, 5, 1, 8, 3] as const;
const WEALTH_DIRECTIONS = [7, 1, 0, 2, 8] as const;
const MASCOT_DIRECTIONS = [3, 3, 2, 2, 0, 8, 1, 1, 5, 6] as const;
const YANG_GUI_DIRECTIONS = [1, 1, 6, 5, 7, 0, 8, 7, 2, 3] as const;
const YIN_GUI_DIRECTIONS = [7, 0, 5, 6, 1, 1, 7, 8, 3, 2] as const;

const FETUS_STEMS = ['门', '碓磨', '厨灶', '仓库', '房床'] as const;
const FETUS_BRANCHES = ['碓', '厕', '炉', '门', '栖', '床'] as const;
const FETUS_DIRECTION_INDICES = [
  3, 3, 8, 8, 8, 8, 8, 1, 1, 1,
  1, 1, 1, 6, 6, 6, 6, 6, 5, 5,
  5, 5, 5, 5, 0, 0, 0, 0, 0, -9,
  -9, -9, -9, -9, -5, -5, -1, -1, -1, -3,
  -7, -7, -7, -7, -5, 7, 7, 7, 7, 7,
  7, 2, 2, 2, 2, 2, 3, 3, 3, 3,
] as const;

const NINE_STAR_META = [
  { name: '一', color: '白', wuxing: '水', dipper: '天枢', direction: '北' },
  { name: '二', color: '黑', wuxing: '土', dipper: '天璇', direction: '西南' },
  { name: '三', color: '碧', wuxing: '木', dipper: '天玑', direction: '东' },
  { name: '四', color: '绿', wuxing: '木', dipper: '天权', direction: '东南' },
  { name: '五', color: '黄', wuxing: '土', dipper: '玉衡', direction: '中' },
  { name: '六', color: '白', wuxing: '金', dipper: '开阳', direction: '西北' },
  { name: '七', color: '赤', wuxing: '金', dipper: '摇光', direction: '西' },
  { name: '八', color: '白', wuxing: '土', dipper: '洞明', direction: '东北' },
  { name: '九', color: '紫', wuxing: '火', dipper: '隐元', direction: '南' },
] as const;

interface AlmanacRulesDataset {
  godNames: readonly string[];
  godLucks: readonly ('吉' | '凶')[];
  godDayTable: readonly string[];
  tabooNames: readonly string[];
  dayTabooTable: readonly string[];
  hourTabooTable: readonly string[];
}

const DATA = rulesData as AlmanacRulesDataset;
const GOD_LUCK_MAP = new Map<string, '吉' | '凶'>(
  DATA.godNames.map((name, index) => [name, DATA.godLucks[index]]),
);
const DAY_TABOO_ROWS = DATA.dayTabooTable.map((row) => row.split(';'));
const HOUR_TABOO_ROWS = DATA.hourTabooTable.map((row) => row.split(';'));

function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function decodeHexIndices(hexPairs: string, names: readonly string[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < hexPairs.length; i += 2) {
    const idx = parseInt(hexPairs.slice(i, i + 2), 16);
    const name = names[idx];
    if (name) result.push(name);
  }
  return result;
}

function branchIndexStrict(branch: string): number {
  const index = getBranchIndex(branch);
  if (index < 0) throw new Error(`地支无效：${branch}`);
  return index;
}

function stemIndexStrict(stem: string): number {
  const index = getStemIndex(stem);
  if (index < 0) throw new Error(`天干无效：${stem}`);
  return index;
}

/** 建除十二神（建除满平定执破危成收开闭）。 */
export function getDayDuty(monthBranch: string, dayBranch: string): string {
  const offset = mod(branchIndexStrict(dayBranch) - branchIndexStrict(monthBranch), 12);
  return DUTY_NAMES[offset];
}

/** 日十二值神（青龙、明堂、天刑……）。 */
export function getDayTwelveStar(monthBranch: string, dayBranch: string): string {
  const index = mod(branchIndexStrict(dayBranch) + (8 - (branchIndexStrict(monthBranch) % 6)) * 2, 12);
  return TWELVE_STAR_NAMES[index];
}

/** 时十二值神（青龙、明堂、天刑……）。 */
export function getHourTwelveStar(dayBranch: string, hourBranch: string): string {
  const index = mod(branchIndexStrict(hourBranch) + (8 - (branchIndexStrict(dayBranch) % 6)) * 2, 12);
  return TWELVE_STAR_NAMES[index];
}

/** 值日二十八宿及所属七曜、动物、四象方位、传统吉凶。 */
export function getDayTwentyEightStar(weekdayIndex: number, dayBranch: string) {
  const base = WEEKDAY_TWENTY_EIGHT_BASE[mod(weekdayIndex, 7)];
  const index = mod(base - 7 * branchIndexStrict(dayBranch), 28);
  const name = TWENTY_EIGHT_NAMES[index];
  return {
    name,
    element: getTwentyEightStarSevenStar(name),
    animal: almanacStarAnimal(name),
    direction: ZONE_NAMES[Math.floor(index / 7)],
    luck: TWENTY_EIGHT_LUCK[index] === 0 ? '吉' : '凶',
  };
}

/** 计算距甲子最近日偏移（-29..+30），用于日家九星冬夏至折算。 */
export function stepsCloseToJiazi(sixtyCycleIndex: number): number {
  const idx = mod(sixtyCycleIndex, 60);
  const forward = mod(60 - idx, 60);
  const backward = -idx;
  return forward <= Math.abs(backward) ? forward : backward;
}

/** 按索引（0-8）获取九星资料。 */
export function getNineStarByIndex(index: number) {
  const meta = NINE_STAR_META[mod(index, 9)];
  return {
    name: meta.name,
    fullName: `${meta.name}${meta.color}${meta.wuxing}`,
    color: meta.color,
    wuxing: meta.wuxing,
    dipper: meta.dipper,
    direction: meta.direction,
  };
}

function getSolarDayNineStarAnchors(solarDay: SolarDay) {
  const year = solarDay.getYear();
  const anchorFor = (termYear: number, index: number) => {
    const termDay = SolarTerm.fromIndex(termYear, index).getSolarDay();
    return termDay.next(stepsCloseToJiazi(termDay.getLunarDay().getSixtyCycle().getIndex()));
  };
  return {
    winter: anchorFor(year, 0),
    summer: anchorFor(year, 12),
    nextWinter: anchorFor(year + 1, 0),
  };
}

/** 值日九星是否处于阳遁顺行期（冬至前后最近甲子日起顺行，夏至前后最近甲子日起逆行）。 */
export function isSolarDayNineStarYangDun(solarDay: SolarDay): boolean {
  const { winter, summer, nextWinter } = getSolarDayNineStarAnchors(solarDay);
  if (solarDay.isBefore(winter)) return false;
  if (solarDay.isBefore(summer)) return true;
  return !solarDay.isBefore(nextWinter);
}

/** 值日九星（冬至后顺行、夏至后逆行）。 */
export function getSolarDayNineStar(solarDay: SolarDay) {
  const { winter, summer, nextWinter } = getSolarDayNineStarAnchors(solarDay);
  if (solarDay.isBefore(winter)) return getNineStarByIndex(winter.subtract(solarDay) - 1);
  if (solarDay.isBefore(summer)) return getNineStarByIndex(solarDay.subtract(winter));
  return getNineStarByIndex(solarDay.isBefore(nextWinter) ? nextWinter.subtract(solarDay) - 1 : solarDay.subtract(nextWinter));
}

/** 每日胎神占方。 */
export function getFetusDayName(dayGanZhi: string): string {
  const index = getSixtyCycleIndex(dayGanZhi);
  let place = `${FETUS_STEMS[(index % 10) % 5]}${FETUS_BRANCHES[(index % 12) % 6]}`;
  if (place === '门门') place = '占大门';
  else if (place === '碓磨碓') place = '占碓磨';
  else if (place === '房床床') place = '占房床';
  else if (place.startsWith('门')) place = `占${place}`;

  const rawDir = FETUS_DIRECTION_INDICES[index];
  const isInside = rawDir < 0;
  const dirName = DIRECTION_NAMES[mod(rawDir, 9)];
  const prefix = isInside ? '房内' : '外';
  const zheng = !isInside && '北南西东'.includes(dirName) ? '正' : '';
  return `${place} ${prefix}${zheng}${dirName}`;
}

/** 日干吉神方位（喜神、财神、福神、阳贵、阴贵）。 */
export function getDailyDirections(dayStem: string) {
  const index = stemIndexStrict(dayStem);
  return {
    joy: DIRECTION_NAMES[JOY_DIRECTIONS[index % 5]],
    wealth: DIRECTION_NAMES[WEALTH_DIRECTIONS[Math.floor(index / 2)]],
    mascot: DIRECTION_NAMES[MASCOT_DIRECTIONS[index]],
    yangGui: DIRECTION_NAMES[YANG_GUI_DIRECTIONS[index]],
    yinGui: DIRECTION_NAMES[YIN_GUI_DIRECTIONS[index]],
  };
}

/** 日支生肖、相冲地支、三煞方位。 */
export function getDayBranchRelations(dayBranch: string) {
  const index = branchIndexStrict(dayBranch);
  const oppositeIndex = (index + 6) % 12;
  return {
    zodiac: ZODIACS[index],
    oppositeBranch: EARTHLY_BRANCHES[oppositeIndex],
    oppositeZodiac: ZODIACS[oppositeIndex],
    ominous: OMINOUS_DIRECTIONS[index % 4],
  };
}

export function getGodLuck(name: string): '吉' | '凶' {
  return GOD_LUCK_MAP.get(name) ?? '凶';
}

/** 读取基础日神煞表（按建寅月序 0-11 与日干支）。 */
export function getBaseDayGods(monthIndex: number, dayGanZhi: string): Array<{ name: string; luck: '吉' | '凶' }> {
  const hexIndex = getSixtyCycleIndex(dayGanZhi).toString(16).toUpperCase().padStart(2, '0');
  const row = DATA.godDayTable[mod(monthIndex, 12)] ?? '';
  const match = new RegExp(`;${hexIndex}(.[^;]*)`).exec(row);
  if (!match) return [];
  return decodeHexIndices(match[1], DATA.godNames).map((name) => ({
    name,
    luck: getGodLuck(name),
  }));
}

/** 每日宜忌（按月支与日干支查自研规则表）。 */
export function getDayTaboos(monthBranch: string, dayGanZhi: string) {
  const monthIdx = branchIndexStrict(monthBranch);
  const dayIdx = getSixtyCycleIndex(dayGanZhi);
  const cell = DAY_TABOO_ROWS[monthIdx]?.[dayIdx] ?? ',';
  const [recHex = '', avoidHex = ''] = cell.split(',');
  return {
    recommends: decodeHexIndices(recHex, DATA.tabooNames),
    avoids: decodeHexIndices(avoidHex, DATA.tabooNames),
  };
}

/** 逐时宜忌（按日干支与时支查自研规则表）。 */
export function getHourTaboos(dayGanZhi: string, hourBranch: string) {
  const hourIdx = branchIndexStrict(hourBranch);
  const dayIdx = getSixtyCycleIndex(dayGanZhi);
  const cell = HOUR_TABOO_ROWS[hourIdx]?.[dayIdx] ?? ',';
  const [recHex = '', avoidHex = ''] = cell.split(',');
  return {
    recommends: decodeHexIndices(recHex, DATA.tabooNames),
    avoids: decodeHexIndices(avoidHex, DATA.tabooNames),
  };
}
