/**
 * @file 干支基础模块（地基层）
 * @description 把散落在各系统中的干支/五行基础逻辑收敛为对外导出的公共能力。
 *
 * 设计取向（深度整合 tyme4ts）：
 *   - 纳音、干支五行、地支合/冲/害、天干五合、十神 —— 直接委托 tyme4ts
 *     （按《钦定协纪辨方书》等实现的权威历法库），保证与经典一致且单一真相源。
 *   - 十二长生统一「土长生在寅」流派（火土同宫，与八字/奇门所用 tyme4ts 一致）：
 *     委托 tyme4ts HeavenStem.getTerrain(branch) 取得权威长生状态；本地表仅作异常回退。
 *   - 刑、破、三合、三会、驿马、桃花、旬空 —— tyme4ts 未提供，由公共 relations 模块实现。
 *
 * 对外函数签名与返回形状保持不变，已接入 API/MCP 的模块无需改动。
 */
import { SolarTime, SixtyCycle, HeavenStem, EarthBranch } from 'tyme4ts';
import {
  BRANCH_ORDER,
  BRANCH_WUXING,
  STEM_ORDER,
  TIAN_GAN_HE,
  TIAN_GAN_CHONG,
  LIUHE_MAP,
  LIUHE_WUXING,
  LIUCHONG_MAP,
  LIUPO_MAP,
  LIUHAI_MAP,
  SANHE_GROUPS,
  SANHUI_GROUPS,
  BRANCH_SANHE,
  BRANCH_SANXING,
  ANHE_MAP,
  BRANCH_HIDDEN_STEMS,
  getHiddenMainStem,
  getHiddenMediumStem,
  getHiddenResidualStem,
  getSeasonState,
  isSheng,
  isKe,
  isLiupo,
  isSanxing,
  getSanxingType,
  isCompleteSanhe,
  isCompleteSanhui,
  getTianGanHeWuxing,
  getYiMa,
  getTaoHua,
  getWuxingChangSheng,
  SanxingType,
  SANXING_MAP,
} from './relations';
import {
  HEAVENLY_STEMS,
  EARTHLY_BRANCHES,
  ZODIACS,
  SIXTY_CYCLE,
  STEM_WUXING,
  STEM_YINYANG,
  BRANCH_YINYANG,
  NAYIN_MAP,
  CHANGSHENG_ORDER,
  WUXING_CHANGSHENG_START,
  type HeavenlyStem,
  type EarthlyBranch,
  type ChangShengState,
} from './data';

export * from './data';

export {
  BRANCH_ORDER,
  BRANCH_WUXING,
  STEM_ORDER,
  TIAN_GAN_HE,
  TIAN_GAN_CHONG,
  LIUHE_MAP,
  LIUHE_WUXING,
  LIUCHONG_MAP,
  LIUPO_MAP,
  LIUHAI_MAP,
  SANHE_GROUPS,
  SANHUI_GROUPS,
  BRANCH_SANHE,
  BRANCH_SANXING,
  ANHE_MAP,
  SANXING_MAP,
  BRANCH_HIDDEN_STEMS,
  getHiddenMainStem,
  getHiddenMediumStem,
  getHiddenResidualStem,
  getSeasonState,
  isSheng,
  isKe,
  isLiupo,
  isSanxing,
  getSanxingType,
  isCompleteSanhe,
  isCompleteSanhui,
  getTianGanHeWuxing,
  getYiMa,
  getTaoHua,
  getWuxingChangSheng,
  SanxingType,
};

export interface StemRelationProfile {
  name: string;
  index: number;
  wuxing: string;
  yinYang: '阳' | '阴';
  combine: string;
  combineWuxing: string;
  clash?: string;
}

export interface BranchRelationProfile {
  name: string;
  index: number;
  zodiac: string;
  wuxing: string;
  yinYang: '阳' | '阴';
  hiddenStems: string[];
  combine: string;
  combineWuxing: string;
  clash: string;
  harm: string;
  break: string;
  hiddenCombine?: string;
  punishment: string;
  punishments: string[];
  punishmentType?: string;
  sanhe: { group: string; partners: string[] };
  sanhui?: { group: string; members: string[] };
}

export interface GanZhiProfile {
  ganZhi: string;
  index: number;
  yinYang: '阳' | '阴';
  nayin: string;
  nayinWuxing: string;
  stem: StemRelationProfile;
  branch: BranchRelationProfile;
}

/** 返回六十甲子副本，避免调用方改写公共序列。 */
export function getSixtyCycle(): string[] {
  return [...SIXTY_CYCLE];
}

/** 天干基础属性与合冲关系。 */
export function getStemRelations(stem: string): StemRelationProfile {
  const index = getStemIndex(stem);
  const combine = TIAN_GAN_HE[stem];
  if (!combine) throw new Error(`天干五合数据缺失：${stem}`);
  return {
    name: stem,
    index,
    wuxing: getStemWuxing(stem),
    yinYang: getStemYinYang(stem),
    combine: combine.partner,
    combineWuxing: combine.wuxing,
    clash: TIAN_GAN_CHONG[stem],
  };
}

/** 地支基础属性、藏干与合冲刑害破关系。 */
export function getBranchRelations(branch: string): BranchRelationProfile {
  const index = getBranchIndex(branch);
  const sanhe = BRANCH_SANHE[branch];
  if (!sanhe) throw new Error(`地支三合数据缺失：${branch}`);
  const sanhui = Object.entries(SANHUI_GROUPS).find(([, members]) => members.includes(branch));
  return {
    name: branch,
    index,
    zodiac: getZodiac(branch),
    wuxing: getBranchWuxing(branch),
    yinYang: getBranchYinYang(branch),
    hiddenStems: [...(BRANCH_HIDDEN_STEMS[branch] ?? [])],
    combine: LIUHE_MAP[branch],
    combineWuxing: LIUHE_WUXING[branch],
    clash: LIUCHONG_MAP[branch],
    harm: LIUHAI_MAP[branch],
    break: LIUPO_MAP[branch],
    hiddenCombine: ANHE_MAP[branch],
    punishment: SANXING_MAP[branch],
    punishments: [...(BRANCH_SANXING[branch] ?? [])],
    punishmentType: getSanxingType(branch) ?? undefined,
    sanhe: { group: sanhe.group, partners: [...sanhe.partners] },
    sanhui: sanhui ? { group: sanhui[0], members: [...sanhui[1]] } : undefined,
  };
}

/** 生成单个六十甲子的完整可复用资料。 */
export function describeGanZhi(ganZhi: string): GanZhiProfile {
  assertValidGanZhi(ganZhi);
  return {
    ganZhi,
    index: getSixtyCycleIndex(ganZhi),
    yinYang: getGanZhiYinYang(ganZhi),
    nayin: getNayin(ganZhi),
    nayinWuxing: getNayinWuxing(ganZhi),
    stem: getStemRelations(ganZhi[0]),
    branch: getBranchRelations(ganZhi[1]),
  };
}

/** 干支纪时结果 */
export interface GanZhiDate {
  year: string;
  month: string;
  day: string;
  hour: string;
}

/**
 * 把公历时间统一转换为 tyme4ts 的农历时辰对象。
 *
 * 注意：`LunarHour.fromYmdHms` 接收的是农历年月日，不能直接用于公历输入；
 * 公历必须先创建 `SolarTime`，再调用 `getLunarHour()`。
 */
export function getLunarHourFromDate(date: Date) {
  if (Number.isNaN(date.getTime())) throw new Error('日期无效');
  return SolarTime.fromYmdHms(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
  ).getLunarHour();
}

/** 从公历时间获取四柱干支（委托 tyme4ts，已含节气换月、真太阳时请在上层处理） */
export function getGanZhiFromDate(date: Date): GanZhiDate {
  const eightChar = getLunarHourFromDate(date).getEightChar();
  return {
    year: eightChar.getYear().getName(),
    month: eightChar.getMonth().getName(),
    day: eightChar.getDay().getName(),
    hour: eightChar.getHour().getName(),
  };
}

/** 天干五行（委托 tyme4ts，回退到本地表） */
export function getStemWuxing(stem: string): string {
  try {
    return HeavenStem.fromName(stem).getElement().getName();
  } catch {
    const w = STEM_WUXING[stem];
    if (!w) throw new Error(`天干五行数据缺失：${stem}`);
    return w;
  }
}

/** 天干阴阳 */
export function getStemYinYang(stem: string): '阳' | '阴' {
  const y = STEM_YINYANG[stem];
  if (!y) throw new Error(`天干阴阳数据缺失：${stem}`);
  return y;
}

/** 地支阴阳 */
export function getBranchYinYang(branch: string): '阳' | '阴' {
  const y = BRANCH_YINYANG[branch];
  if (!y) throw new Error(`地支阴阳数据缺失：${branch}`);
  return y;
}

/** 干支阴阳（以天干阴阳为准） */
export function getGanZhiYinYang(ganZhi: string): '阳' | '阴' {
  assertValidGanZhi(ganZhi);
  return getStemYinYang(ganZhi[0]);
}

/** 天干序号（0-9） */
export function getStemIndex(stem: string): number {
  const idx = HEAVENLY_STEMS.indexOf(stem as HeavenlyStem);
  if (idx < 0) throw new Error(`天干无效：${stem}`);
  return idx;
}

/** 地支序号（0-11） */
export function getBranchIndex(branch: string): number {
  const idx = EARTHLY_BRANCHES.indexOf(branch as EarthlyBranch);
  if (idx < 0) throw new Error(`地支无效：${branch}`);
  return idx;
}

/** 两干支相差的序数差（用于太乙等推算） */
export function diffGanZhi(from: string, to: string): number {
  const a = getSixtyCycleIndex(from);
  const b = getSixtyCycleIndex(to);
  return (((b - a) % 60) + 60) % 60;
}

/** 六十甲子序号（0-59），甲子为 0 */
export function getSixtyCycleIndex(ganZhi: string): number {
  assertValidGanZhi(ganZhi);
  const s = getStemIndex(ganZhi[0]);
  const b = getBranchIndex(ganZhi[1]);
  return (((s * 6 - b * 5) % 60) + 60) % 60;
}

/** 是否为真实存在的六十甲子组合，而非仅由合法天干和地支随意拼接。 */
export function isValidGanZhi(ganZhi: string): boolean {
  return typeof ganZhi === 'string' && ganZhi.length === 2 && NAYIN_MAP[ganZhi] !== undefined;
}

function assertValidGanZhi(ganZhi: string): void {
  if (!isValidGanZhi(ganZhi)) {
    throw new Error(`干支组合无效：${ganZhi}`);
  }
}

/** 纳音（如「海中金」，委托 tyme4ts，与《纳音歌》一致） */
export function getNayin(ganZhi: string): string {
  try {
    return SixtyCycle.fromName(ganZhi).getSound().getName();
  } catch {
    const na = NAYIN_MAP[ganZhi];
    if (!na) throw new Error(`纳音数据缺失：${ganZhi}`);
    return na;
  }
}

/** 纳音五行（纳音名称均以五行字结尾，如海中金、炉中火） */
export function getNayinWuxing(ganZhi: string): string {
  const na = getNayin(ganZhi);
  const element = na[na.length - 1];
  if (
    element === '金' ||
    element === '木' ||
    element === '水' ||
    element === '火' ||
    element === '土'
  ) {
    return element;
  }
  throw new Error(`纳音五行无法判定：${na}`);
}

/**
 * 十二长生状态（统一「土长生在寅」流派，与八字/奇门所用 tyme4ts 一致）。
 * 实现：以该五行的阳性天干代算（木→甲、火→丙、土→戊、金→庚、水→壬），
 * 调 tyme4ts HeavenStem.getTerrain(branch) 取得权威长生状态。
 * 本地表（WUXING_CHANGSHENG_START，已同步为寅派）仅作 tyme4ts 异常时的回退。
 */
const YANG_STEM_OF_WUXING: Record<string, string> = {
  木: '甲',
  火: '丙',
  土: '戊',
  金: '庚',
  水: '壬',
};
export function getChangShengState(wuxing: string, branch: string): ChangShengState {
  const stem = YANG_STEM_OF_WUXING[wuxing];
  if (!stem) throw new Error(`五行长生状态缺失：${wuxing}`);
  try {
    const terrain = HeavenStem.fromName(stem).getTerrain(EarthBranch.fromName(branch)).getName();
    return terrain as ChangShengState;
  } catch {
    const start = WUXING_CHANGSHENG_START[wuxing];
    if (!start) throw new Error(`五行长生起点缺失：${wuxing}`);
    const startIdx = EARTHLY_BRANCHES.indexOf(start as EarthlyBranch);
    const branchIdx = EARTHLY_BRANCHES.indexOf(branch as EarthlyBranch);
    if (branchIdx < 0) throw new Error(`地支无效：${branch}`);
    const offset = (((branchIdx - startIdx) % 12) + 12) % 12;
    return CHANGSHENG_ORDER[offset];
  }
}

/** 生肖（由年支取） */
export function getZodiac(yearBranch: string): string {
  const idx = EARTHLY_BRANCHES.indexOf(yearBranch as EarthlyBranch);
  if (idx < 0) throw new Error(`年支无效：${yearBranch}`);
  return ZODIACS[idx];
}

/** 地支五行（委托 tyme4ts，回退到本地表） */
export function getBranchWuxing(branch: string): string {
  try {
    return EarthBranch.fromName(branch).getElement().getName();
  } catch {
    const w = BRANCH_WUXING[branch];
    if (!w) throw new Error(`地支五行数据缺失：${branch}`);
    return w;
  }
}

/** 地支六合（委托 tyme4ts） */
export function isLiuhe(a: string, b: string): boolean {
  return EarthBranch.fromName(a).getCombine().getName() === b;
}

/** 地支六冲（委托 tyme4ts） */
export function isLiuchong(a: string, b: string): boolean {
  return EarthBranch.fromName(a).getOpposite().getName() === b;
}

/** 地支六害（委托 tyme4ts） */
export function isLiuhai(a: string, b: string): boolean {
  return EarthBranch.fromName(a).getHarm().getName() === b;
}

/** 天干五合（委托 tyme4ts） */
export function isTianGanHe(a: string, b: string): boolean {
  return HeavenStem.fromName(a).getCombine().getName() === b;
}

/** 地支对宫（委托 tyme4ts） */
export function getOppositeBranch(branch: string): string {
  return EarthBranch.fromName(branch).getOpposite().getName();
}

/** 十神：以 dayStem 为日主，求 stem 的相对十神（委托 tyme4ts，新增能力） */
export function getTenStar(dayStem: string, stem: string): string {
  return HeavenStem.fromName(dayStem).getTenStar(HeavenStem.fromName(stem)).getName();
}

export const ganzhi = {
  HEAVENLY_STEMS,
  EARTHLY_BRANCHES,
  ZODIACS,
  SIXTY_CYCLE,
  getLunarHourFromDate,
  getGanZhiFromDate,
  getStemWuxing,
  getStemYinYang,
  getBranchYinYang,
  getGanZhiYinYang,
  getStemIndex,
  getBranchIndex,
  getSixtyCycle,
  getSixtyCycleIndex,
  diffGanZhi,
  isValidGanZhi,
  getNayin,
  getNayinWuxing,
  getChangShengState,
  getZodiac,
  getBranchWuxing,
  isLiuhe,
  isLiuchong,
  isLiuhai,
  isTianGanHe,
  getOppositeBranch,
  getTenStar,
  getStemRelations,
  getBranchRelations,
  describeGanZhi,
};
