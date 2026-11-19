/**
 * @file 干支与五行公共地基
 * @description 统一提供六十甲子、纳音、空亡、十二长生、天干合冲、地支刑冲合害破、藏干及带权五行统计。
 */

export const HEAVENLY_STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;
export type HeavenlyStem = (typeof HEAVENLY_STEMS)[number];

export const EARTHLY_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;
export type EarthlyBranch = (typeof EARTHLY_BRANCHES)[number];

export const WUXING = ['木', '火', '土', '金', '水'] as const;
export type Wuxing = (typeof WUXING)[number];

export const ZODIACS = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'] as const;
export type Zodiac = (typeof ZODIACS)[number];

export const SIXTY_CYCLE: readonly string[] = Array.from(
  { length: 60 },
  (_, index) => `${HEAVENLY_STEMS[index % 10]}${EARTHLY_BRANCHES[index % 12]}`,
);

export const TEN_STAR_NAMES = [
  '比肩', '劫财', '食神', '伤官', '偏财', '正财', '七杀', '正官', '偏印', '正印',
] as const;
export type TenStarName = (typeof TEN_STAR_NAMES)[number];

export const TWENTY_EIGHT_STARS = [
  '角', '亢', '氐', '房', '心', '尾', '箕',
  '斗', '牛', '女', '虚', '危', '室', '壁',
  '奎', '娄', '胃', '昴', '毕', '觜', '参',
  '井', '鬼', '柳', '星', '张', '翼', '轸',
] as const;
export type TwentyEightStarName = (typeof TWENTY_EIGHT_STARS)[number];

export const SEVEN_STARS = ['日', '月', '火', '水', '木', '金', '土'] as const;
export type SevenStarName = (typeof SEVEN_STARS)[number];

export const SIX_XUN_HEADS = ['甲子', '甲戌', '甲申', '甲午', '甲辰', '甲寅'] as const;

export const STEM_WUXING: Record<HeavenlyStem, Wuxing> = {
  甲: '木', 乙: '木',
  丙: '火', 丁: '火',
  戊: '土', 己: '土',
  庚: '金', 辛: '金',
  壬: '水', 癸: '水',
};

export const BRANCH_WUXING: Record<EarthlyBranch, Wuxing> = {
  子: '水', 丑: '土', 寅: '木', 卯: '木',
  辰: '土', 巳: '火', 午: '火', 未: '土',
  申: '金', 酉: '金', 戌: '土', 亥: '水',
};

export const STEM_YINYANG: Record<HeavenlyStem, '阳' | '阴'> = {
  甲: '阳', 乙: '阴', 丙: '阳', 丁: '阴', 戊: '阳',
  己: '阴', 庚: '阳', 辛: '阴', 壬: '阳', 癸: '阴',
};

export const BRANCH_YINYANG: Record<EarthlyBranch, '阳' | '阴'> = {
  子: '阳', 丑: '阴', 寅: '阳', 卯: '阴', 辰: '阳', 巳: '阴',
  午: '阳', 未: '阴', 申: '阳', 酉: '阴', 戌: '阳', 亥: '阴',
};

export const NAYIN_MAP: Record<string, string> = {
  甲子: '海中金', 乙丑: '海中金', 丙寅: '炉中火', 丁卯: '炉中火', 戊辰: '大林木', 己巳: '大林木',
  庚午: '路旁土', 辛未: '路旁土', 壬申: '剑锋金', 癸酉: '剑锋金', 甲戌: '山头火', 乙亥: '山头火',
  丙子: '涧下水', 丁丑: '涧下水', 戊寅: '城头土', 己卯: '城头土', 庚辰: '白蜡金', 辛巳: '白蜡金',
  壬午: '杨柳木', 癸未: '杨柳木', 甲申: '泉中水', 乙酉: '泉中水', 丙戌: '屋上土', 丁亥: '屋上土',
  戊子: '霹雳火', 己丑: '霹雳火', 庚寅: '松柏木', 辛卯: '松柏木', 壬辰: '长流水', 癸巳: '长流水',
  甲午: '沙中金', 乙未: '沙中金', 丙申: '山下火', 丁酉: '山下火', 戊戌: '平地木', 己亥: '平地木',
  庚子: '壁上土', 辛丑: '壁上土', 壬寅: '金箔金', 癸卯: '金箔金', 甲辰: '覆灯火', 乙巳: '覆灯火',
  丙午: '天河水', 丁未: '天河水', 戊申: '大驿土', 己酉: '大驿土', 庚戌: '钗钏金', 辛亥: '钗钏金',
  壬子: '桑柘木', 癸丑: '桑柘木', 甲寅: '大溪水', 乙卯: '大溪水', 丙辰: '沙中土', 丁巳: '沙中土',
  戊午: '天上火', 己未: '天上火', 庚申: '石榴木', 辛酉: '石榴木', 壬戌: '大海水', 癸亥: '大海水',
};

export const XUN_KONG_MAP: Record<string, readonly [EarthlyBranch, EarthlyBranch]> = {
  甲子: ['戌', '亥'],
  甲戌: ['申', '酉'],
  甲申: ['午', '未'],
  甲午: ['辰', '巳'],
  甲辰: ['寅', '卯'],
  甲寅: ['子', '丑'],
};

export const CHANGSHENG_ORDER = [
  '长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养',
] as const;
export type ChangShengState = (typeof CHANGSHENG_ORDER)[number];

/** 阳顺阴逆长生起支表（默认火土同宫：戊随丙起寅，己随丁起酉） */
const STEM_CHANGSHENG_START_FIRE: Record<HeavenlyStem, { start: EarthlyBranch; dir: 1 | -1 }> = {
  甲: { start: '亥', dir: 1 },
  乙: { start: '午', dir: -1 },
  丙: { start: '寅', dir: 1 },
  丁: { start: '酉', dir: -1 },
  戊: { start: '寅', dir: 1 },
  己: { start: '酉', dir: -1 },
  庚: { start: '巳', dir: 1 },
  辛: { start: '子', dir: -1 },
  壬: { start: '申', dir: 1 },
  癸: { start: '卯', dir: -1 },
};

/** 水土同宫长生起支表（戊随壬起申，己随癸起卯） */
const STEM_CHANGSHENG_START_WATER: Record<HeavenlyStem, { start: EarthlyBranch; dir: 1 | -1 }> = {
  ...STEM_CHANGSHENG_START_FIRE,
  戊: { start: '申', dir: 1 },
  己: { start: '卯', dir: -1 },
};

/** 五行长生起支（不分阴阳均顺行，火土同宫） */
export const WUXING_CHANGSHENG_START: Record<Wuxing, EarthlyBranch> = {
  木: '亥',
  火: '寅',
  土: '寅',
  金: '巳',
  水: '申',
};

export const TIAN_GAN_HE: Record<HeavenlyStem, { partner: HeavenlyStem; wuxing: Wuxing }> = {
  甲: { partner: '己', wuxing: '土' },
  己: { partner: '甲', wuxing: '土' },
  乙: { partner: '庚', wuxing: '金' },
  庚: { partner: '乙', wuxing: '金' },
  丙: { partner: '辛', wuxing: '水' },
  辛: { partner: '丙', wuxing: '水' },
  丁: { partner: '壬', wuxing: '木' },
  壬: { partner: '丁', wuxing: '木' },
  戊: { partner: '癸', wuxing: '火' },
  癸: { partner: '戊', wuxing: '火' },
};

export const TIAN_GAN_CHONG: Partial<Record<HeavenlyStem, HeavenlyStem>> = {
  甲: '庚', 庚: '甲',
  乙: '辛', 辛: '乙',
  丙: '壬', 壬: '丙',
  丁: '癸', 癸: '丁',
};

export const LIUHE_MAP: Record<EarthlyBranch, EarthlyBranch> = {
  子: '丑', 丑: '子',
  寅: '亥', 亥: '寅',
  卯: '戌', 戌: '卯',
  辰: '酉', 酉: '辰',
  巳: '申', 申: '巳',
  午: '未', 未: '午',
};

export const LIUHE_WUXING: Record<EarthlyBranch, Wuxing> = {
  子: '土', 丑: '土',
  寅: '木', 亥: '木',
  卯: '火', 戌: '火',
  辰: '金', 酉: '金',
  巳: '水', 申: '水',
  午: '土', 未: '土',
};

export const SANHE_GROUPS: Record<string, readonly EarthlyBranch[]> = {
  水局: ['申', '子', '辰'],
  木局: ['亥', '卯', '未'],
  火局: ['寅', '午', '戌'],
  金局: ['巳', '酉', '丑'],
};

export const SANHE_WUXING: Record<string, Wuxing> = {
  水局: '水',
  木局: '木',
  火局: '火',
  金局: '金',
};

export const SANHUI_GROUPS: Record<string, readonly EarthlyBranch[]> = {
  东方木: ['寅', '卯', '辰'],
  南方火: ['巳', '午', '未'],
  西方金: ['申', '酉', '戌'],
  北方水: ['亥', '子', '丑'],
};

export const LIUCHONG_MAP: Record<EarthlyBranch, EarthlyBranch> = {
  子: '午', 午: '子',
  丑: '未', 未: '丑',
  寅: '申', 申: '寅',
  卯: '酉', 酉: '卯',
  辰: '戌', 戌: '辰',
  巳: '亥', 亥: '巳',
};

export const LIUHAI_MAP: Record<EarthlyBranch, EarthlyBranch> = {
  子: '未', 未: '子',
  丑: '午', 午: '丑',
  寅: '巳', 巳: '寅',
  卯: '辰', 辰: '卯',
  申: '亥', 亥: '申',
  酉: '戌', 戌: '酉',
};

export const LIUPO_MAP: Record<EarthlyBranch, EarthlyBranch> = {
  子: '酉', 酉: '子',
  丑: '辰', 辰: '丑',
  寅: '亥', 亥: '寅',
  卯: '午', 午: '卯',
  巳: '申', 申: '巳',
  未: '戌', 戌: '未',
};

/** 三刑递刑映射（子卯互刑，寅巳申三刑，丑戌未三刑，辰午酉亥自刑） */
export const SANXING_MAP: Record<EarthlyBranch, EarthlyBranch> = {
  子: '卯', 卯: '子',
  寅: '巳', 巳: '申', 申: '寅',
  丑: '戌', 戌: '未', 未: '丑',
  辰: '辰', 午: '午', 酉: '酉', 亥: '亥',
};

export const BRANCH_SANXING: Record<EarthlyBranch, readonly EarthlyBranch[]> = {
  子: ['卯'], 卯: ['子'],
  寅: ['巳', '申'], 巳: ['申', '寅'], 申: ['寅', '巳'],
  丑: ['戌', '未'], 戌: ['未', '丑'], 未: ['丑', '戌'],
  辰: ['辰'], 午: ['午'], 酉: ['酉'], 亥: ['亥'],
};

export type SanxingType = '无礼之刑' | '无恩之刑' | '恃势之刑' | '自刑';

/** 地支藏干（首项为本气，次为中气，末为余气） */
export const BRANCH_HIDDEN_STEMS: Record<EarthlyBranch, readonly HeavenlyStem[]> = {
  子: ['癸'],
  丑: ['己', '癸', '辛'],
  寅: ['甲', '丙', '戊'],
  卯: ['乙'],
  辰: ['戊', '乙', '癸'],
  巳: ['丙', '庚', '戊'],
  午: ['丁', '己'],
  未: ['己', '丁', '乙'],
  申: ['庚', '壬', '戊'],
  酉: ['辛'],
  戌: ['戊', '辛', '丁'],
  亥: ['壬', '甲'],
};

export const SHENG_MAP: Record<Wuxing, Wuxing> = {
  木: '火', 火: '土', 土: '金', 金: '水', 水: '木',
};

export const KE_MAP: Record<Wuxing, Wuxing> = {
  木: '土', 土: '水', 水: '火', 火: '金', 金: '木',
};

function assertStem(stem: string): HeavenlyStem {
  if (!Object.hasOwn(STEM_WUXING, stem)) throw new Error(`天干无效：${stem}`);
  return stem as HeavenlyStem;
}

function assertBranch(branch: string): EarthlyBranch {
  if (!Object.hasOwn(BRANCH_WUXING, branch)) throw new Error(`地支无效：${branch}`);
  return branch as EarthlyBranch;
}

function assertSixtyCycle(ganzhi: string): number {
  const index = SIXTY_CYCLE.indexOf(ganzhi);
  if (index < 0) throw new Error(`干支无效：${ganzhi}`);
  return index;
}

export function getBranchIndex(branch: string): number {
  return (EARTHLY_BRANCHES as readonly string[]).indexOf(branch);
}

/** 获取南半球气候对宫参考月支（六冲寒暖对调，仅作地域气候对照参考）。 */
export function getOppositeSeasonBranch(branch: string): EarthlyBranch {
  return EARTHLY_BRANCHES[(EARTHLY_BRANCHES.indexOf(assertBranch(branch)) + 6) % 12];
}

export function getStemIndex(stem: string): number {
  return (HEAVENLY_STEMS as readonly string[]).indexOf(stem);
}

export function getSixtyCycleIndex(ganzhi: string): number {
  return assertSixtyCycle(ganzhi);
}

export function getSixtyCycleName(index: number): string {
  if (!Number.isInteger(index)) throw new Error('干支索引须为整数。');
  return SIXTY_CYCLE[((index % 60) + 60) % 60];
}

export function stepSixtyCycle(ganzhi: string, steps: number): string {
  if (!Number.isInteger(steps)) throw new Error('干支步进须为整数。');
  return getSixtyCycleName(assertSixtyCycle(ganzhi) + steps);
}

export function getYearSixtyCycle(year: number): string {
  if (!Number.isInteger(year)) throw new Error('年份须为整数。');
  return getSixtyCycleName(year - 4);
}

/** 按五虎遁计算指定公历干支年的第 monthIndex（0=寅月..11=丑月）月柱干支。 */
export function getYearMonthGanZhi(year: number, monthIndex: number): string {
  if (!Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    throw new Error('月序须在 0 至 11 之间。');
  }
  const yearStemIdx = getSixtyCycleIndex(getYearSixtyCycle(year)) % 10;
  const janStemIdx = ((yearStemIdx % 5) * 2 + 2) % 10;
  return `${HEAVENLY_STEMS[(janStemIdx + monthIndex) % 10]}${EARTHLY_BRANCHES[(2 + monthIndex) % 12]}`;
}

/** 二十四节气中十二节气（月令建寅起）对应的月序（0=寅月..11=丑月）。 */
export const JIE_TERM_MONTH_INDEX: Readonly<Record<string, number>> = {
  立春: 0, 惊蛰: 1, 清明: 2, 立夏: 3, 芒种: 4, 小暑: 5,
  立秋: 6, 白露: 7, 寒露: 8, 立冬: 9, 大雪: 10, 小寒: 11,
};

/** 依据历表节气的年份与 0..23 索引换算所属立春节气年（小寒及之前归上一年）。 */
export function getSolarTermYearFromJie(jieYear: number, jieIndex: number): number {
  return jieIndex <= 1 ? jieYear - 1 : jieYear;
}

/** 按五鼠遁从日干支与小时（0-23）计算时辰干支（23 点起归子时）。 */
export function getHourSixtyCycle(dayGanZhi: string, hour: number): string {
  const dayStemIdx = getSixtyCycleIndex(dayGanZhi) % 10;
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new Error(`小时须在 0 至 23 之间：${hour}`);
  }
  const hourBranchIdx = hour === 23 ? 0 : Math.floor((hour + 1) / 2);
  const startStemIdx = (dayStemIdx % 5) * 2;
  return `${HEAVENLY_STEMS[(startStemIdx + hourBranchIdx) % 10]}${EARTHLY_BRANCHES[hourBranchIdx]}`;
}

/** 返回指定干支年从寅月到丑月的十二流月干支。 */
export function getYearMonthList(year: number): string[] {
  return Array.from({ length: 12 }, (_, idx) => getYearMonthGanZhi(year, idx));
}

export function getTenStar(dayStem: string, targetStem: string): TenStarName {
  const dayIndex = HEAVENLY_STEMS.indexOf(assertStem(dayStem));
  const targetIndex = HEAVENLY_STEMS.indexOf(assertStem(targetStem));
  let offset = targetIndex - dayIndex;
  if (dayIndex % 2 !== 0 && targetIndex % 2 === 0) offset += 2;
  return TEN_STAR_NAMES[((offset % 10) + 10) % 10];
}

export function getTwentyEightStarSevenStar(starName: string): SevenStarName {
  const index = (TWENTY_EIGHT_STARS as readonly string[]).indexOf(starName);
  if (index < 0) throw new Error(`二十八宿无效：${starName}`);
  return SEVEN_STARS[(index % 7 + 4) % 7];
}

/** 按三元甲子（1864 上元甲子起一白逐年逆飞）计算流年入中紫白九星（1-9）。 */
export function getYearNineStar(year: number): number {
  if (!Number.isInteger(year)) throw new Error('年份须为整数。');
  return (((-(year - 1864)) % 9) + 9) % 9 + 1;
}

/** 按流年地支三合与节气月支计算流月入中紫白九星（1-9）。 */
export function getMonthNineStar(yearBranch: string, monthBranch: string): number {
  const yb = EARTHLY_BRANCHES.indexOf(assertBranch(yearBranch));
  const mb = EARTHLY_BRANCHES.indexOf(assertBranch(monthBranch));
  const adjustedMonth = mb < 2 ? mb + 12 : mb;
  return (((27 - (yb % 3) * 3 - adjustedMonth) % 9) + 9) % 9 + 1;
}

export function getStemWuxing(stem: string): Wuxing {
  return STEM_WUXING[assertStem(stem)];
}

export function getBranchWuxing(branch: string): Wuxing {
  return BRANCH_WUXING[assertBranch(branch)];
}

export function getStemYinYang(stem: string): '阳' | '阴' {
  if (!Object.hasOwn(STEM_YINYANG, stem)) throw new Error('天干无效。');
  return STEM_YINYANG[stem as HeavenlyStem];
}

export function getBranchYinYang(branch: string): '阳' | '阴' {
  return BRANCH_YINYANG[assertBranch(branch)];
}

export function getNayin(ganzhi: string): string {
  assertSixtyCycle(ganzhi);
  return NAYIN_MAP[ganzhi];
}

export function getNayinWuxing(ganzhi: string): Wuxing {
  const nayin = getNayin(ganzhi);
  return nayin[nayin.length - 1] as Wuxing;
}

export function getXunHead(ganzhi: string): string {
  const index = assertSixtyCycle(ganzhi);
  return SIX_XUN_HEADS[Math.floor(index / 10)];
}

export function getVoidBranches(ganzhi: string): [EarthlyBranch, EarthlyBranch] {
  const head = getXunHead(ganzhi);
  const pair = XUN_KONG_MAP[head];
  return [pair[0], pair[1]];
}

export type EarthRule = 'follow-fire' | 'follow-water' | 'independent';

/** 计算天干在地支上的十二长生状态；支持火土同宫（默认）、水土同宫及五行顺行口径。 */
export function getLifeStage(
  stem: string,
  branch: string,
  options: { earthRule?: EarthRule } = {},
): ChangShengState {
  const s = assertStem(stem);
  const b = assertBranch(branch);
  const targetIdx = EARTHLY_BRANCHES.indexOf(b);
  const rule = options.earthRule ?? 'follow-fire';

  if (rule === 'independent') {
    const startIdx = EARTHLY_BRANCHES.indexOf(WUXING_CHANGSHENG_START[STEM_WUXING[s]]);
    return CHANGSHENG_ORDER[(targetIdx - startIdx + 12) % 12];
  }

  const table = rule === 'follow-water' ? STEM_CHANGSHENG_START_WATER : STEM_CHANGSHENG_START_FIRE;
  const { start, dir } = table[s];
  const startIdx = EARTHLY_BRANCHES.indexOf(start);
  const offset = dir === 1 ? (targetIdx - startIdx + 12) % 12 : (startIdx - targetIdx + 12) % 12;
  return CHANGSHENG_ORDER[offset];
}

export function isStemHe(a: string, b: string): boolean {
  return TIAN_GAN_HE[assertStem(a)].partner === assertStem(b);
}

export function getStemHeElement(a: string, b: string): Wuxing | null {
  const sa = assertStem(a);
  const sb = assertStem(b);
  return TIAN_GAN_HE[sa].partner === sb ? TIAN_GAN_HE[sa].wuxing : null;
}

export function isStemChong(a: string, b: string): boolean {
  return TIAN_GAN_CHONG[assertStem(a)] === assertStem(b);
}

export function isLiuhe(a: string, b: string): boolean {
  return LIUHE_MAP[assertBranch(a)] === assertBranch(b);
}

export function isLiuchong(a: string, b: string): boolean {
  return LIUCHONG_MAP[assertBranch(a)] === assertBranch(b);
}

export function isLiuhai(a: string, b: string): boolean {
  return LIUHAI_MAP[assertBranch(a)] === assertBranch(b);
}

export function isLiupo(a: string, b: string): boolean {
  return LIUPO_MAP[assertBranch(a)] === assertBranch(b);
}

export function getSanxingType(branch: string): SanxingType {
  const b = assertBranch(branch);
  if (b === '子' || b === '卯') return '无礼之刑';
  if (b === '寅' || b === '巳' || b === '申') return '无恩之刑';
  if (b === '丑' || b === '戌' || b === '未') return '恃势之刑';
  return '自刑';
}

export function isSanxing(a: string, b: string): boolean {
  const ba = assertBranch(a);
  const bb = assertBranch(b);
  return BRANCH_SANXING[ba].includes(bb);
}

function matchBranchGroup(branches: readonly string[], groups: Record<string, readonly EarthlyBranch[]>): string | null {
  const unique = new Set(branches.map(assertBranch));
  for (const [name, members] of Object.entries(groups)) {
    if (members.every((m) => unique.has(m))) return name;
  }
  return null;
}

export function isSanhe(branches: readonly string[]): string | null {
  return matchBranchGroup(branches, SANHE_GROUPS);
}

export function isHalfSanhe(branches: readonly string[]): string | null {
  const unique = [...new Set(branches.map(assertBranch))];
  for (const [name, members] of Object.entries(SANHE_GROUPS)) {
    const count = members.filter((m) => unique.includes(m)).length;
    if (count === 2) return name;
  }
  return null;
}

export function isSanhui(branches: readonly string[]): string | null {
  return matchBranchGroup(branches, SANHUI_GROUPS);
}

export function getHiddenStems(branch: string): HeavenlyStem[] {
  return [...BRANCH_HIDDEN_STEMS[assertBranch(branch)]];
}

export function getHiddenMainStem(branch: string): HeavenlyStem {
  return BRANCH_HIDDEN_STEMS[assertBranch(branch)][0];
}

export function getHiddenMediumStem(branch: string): HeavenlyStem | undefined {
  return BRANCH_HIDDEN_STEMS[assertBranch(branch)][1];
}

export function getHiddenResidualStem(branch: string): HeavenlyStem | undefined {
  return BRANCH_HIDDEN_STEMS[assertBranch(branch)][2];
}

export function isSheng(source: string, target: string): boolean {
  return Object.hasOwn(SHENG_MAP, source) && SHENG_MAP[source as Wuxing] === target;
}

export function isKe(source: string, target: string): boolean {
  return Object.hasOwn(KE_MAP, source) && KE_MAP[source as Wuxing] === target;
}

/** 按月令地支本气定五行旺相休囚死（旺=同令，相=令生我，休=我生令，囚=我克令，死=令克我）。 */
export function getSeasonState(element: string, month: string): '旺' | '相' | '休' | '囚' | '死' {
  const monthElement = getBranchWuxing(month);
  if (monthElement === element) return '旺';
  if (isSheng(monthElement, element)) return '相';
  if (isSheng(element, monthElement)) return '休';
  if (isKe(element, monthElement)) return '囚';
  if (isKe(monthElement, element)) return '死';
  throw new Error(`月令旺衰关系无法判断：${month}/${element}`);
}

/**
 * 统计一组干支的五行分布（支持单字天干/地支或双字干支）。
 * @param options.weightHidden 为 true 时，地支按藏干权重计入（本气 1、中气 0.5、余气 0.3）；否则按地支本气五行计 1。
 */
export function tallyWuxing(
  items: readonly string[],
  options: { weightHidden?: boolean } = {},
): Record<Wuxing, number> {
  // 以十分之一为单位整数累加，避免浮点精度误差
  const tenths: Record<Wuxing, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  const weights = [10, 5, 3];

  const addToken = (token: string) => {
    if (Object.hasOwn(STEM_WUXING, token)) {
      tenths[STEM_WUXING[token as HeavenlyStem]] += 10;
      return;
    }
    if (Object.hasOwn(BRANCH_WUXING, token)) {
      const branch = token as EarthlyBranch;
      if (options.weightHidden) {
        BRANCH_HIDDEN_STEMS[branch].forEach((stem, i) => {
          tenths[STEM_WUXING[stem]] += weights[i] ?? 3;
        });
      } else {
        tenths[BRANCH_WUXING[branch]] += 10;
      }
    }
  };

  for (const item of items) {
    if (item.length === 2 && Object.hasOwn(NAYIN_MAP, item)) {
      addToken(item[0]);
      addToken(item[1]);
    } else {
      addToken(item);
    }
  }

  return {
    木: tenths.木 / 10,
    火: tenths.火 / 10,
    土: tenths.土 / 10,
    金: tenths.金 / 10,
    水: tenths.水 / 10,
  };
}

export interface WuxingStrengthProfile {
  counts: Record<Wuxing, number>;
  dominant: Wuxing;
  dominantElements: Wuxing[];
  weakest: Wuxing;
  weakestElements: Wuxing[];
  lacking: Wuxing[];
}

export function getWuxingStrengthProfile(
  items: readonly string[],
  options: { weightHidden?: boolean } = { weightHidden: true },
): WuxingStrengthProfile {
  const counts = tallyWuxing(items, options);
  let max = -Infinity;
  let min = Infinity;
  for (const w of WUXING) {
    if (counts[w] > max) max = counts[w];
    if (counts[w] < min) min = counts[w];
  }
  const dominantElements = WUXING.filter((w) => counts[w] === max);
  const weakestElements = WUXING.filter((w) => counts[w] === min);
  const lacking = WUXING.filter((w) => counts[w] === 0);
  return {
    counts,
    dominant: dominantElements[0],
    dominantElements,
    weakest: weakestElements[0],
    weakestElements,
    lacking,
  };
}
