/**
 * @file Bazi Types
 * @description Contains all shared type definitions and interfaces for the Bazi calculation engine.
 */

import type { ShenShaVariantConfig } from './baziShenSha/variants';

export const WUXING = ['木', '火', '土', '金', '水'] as const;
export type Wuxing = (typeof WUXING)[number];

export type CommanderEntry = [string, number];

export interface Person {
  year: number;
  month: number;
  day: number;
  timeIndex: number;
  gender: 'male' | 'female' | '';
  isLunar?: boolean;
  isLeapMonth?: boolean;
  useTrueSolarTime?: boolean;
  birthHour?: number;
  birthMinute?: number;
  birthPlace?: string;
  birthLongitude?: number;
  age?: number;
  shenShaVariants?: Partial<ShenShaVariantConfig>;
}

export interface TimeInfo {
  index: number;
  name: string;
  range: string;
  hour: number;
}

export interface Pillar {
  gan: string;
  zhi: string;
  ganZhi: string;
}

export interface Pillars {
  year: Pillar;
  month: Pillar;
  day: Pillar;
  hour: Pillar;
}

export interface DayMaster {
  gan: string;
  element: string;
  yinYang: string;
}

export interface HiddenStems {
  year: string[];
  month: string[];
  day: string[];
  hour: string[];
}

export interface WuxingStrengthDetails {
  scores: Record<string, number>;
  percentages: Record<string, number>;
  missing: string[];
}

export interface LiunianInfo {
  year: number;
  age: number;
  ganZhi: string;
  tenGod: string;
  tenGodZhi: string;
  xiaoyun?: XiaoyunInfo;
}

export interface XiaoyunInfo {
  ganZhi: string;
  tenGod: string;
  tenGodZhi: string;
}

export interface SolarDateTimeInfo {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export interface TimingInfo {
  enabled: boolean;
  standardTime: SolarDateTimeInfo;
  correctedTime: SolarDateTimeInfo;
  birthPlace?: string;
  birthLongitude?: number;
  longitudeCorrectionMinutes: number;
  equationOfTimeMinutes: number;
  totalCorrectionMinutes: number;
}

export interface LuckCycle {
  age: number;
  year: number;
  ganZhi: string;
  isXiaoyun: boolean;
  type: string;
  startSolarTime?: SolarDateTimeInfo;
  endSolarTime?: SolarDateTimeInfo;
  years: LiunianInfo[];
  resolvedYears?: LiunianInfo[];
}

export interface LuckInfo {
  startInfo: string;
  handoverInfo: string;
  cycles: LuckCycle[];
}

export interface PillarLifeStages {
  year: string;
  month: string;
  day: string;
  hour: string;
}

export interface Nayin {
  year: string;
  month: string;
  day: string;
  hour: string;
}

export interface ShenShaResult {
  year: string[];
  month: string[];
  day: string[];
  hour: string[];
  global?: string[];
}

export interface ZiZuoResult {
  year: string;
  month: string;
  day: string;
  hour: string;
}

export interface KongWangResult {
  year: string[];
  month: string[];
  day: string[];
  hour: string[];
}

export interface SeasonInfo {
  currentJieqi: string;
  nextJieqi: string;
  daysSincePrev: number;
  daysToNext: number;
  currentSeason: string;
  jieqiList: { name: string; date: string }[];
}

export interface RootAnalysis {
  roots: { position: string; branch: string; strength: number }[];
  totalStrength: number;
  hasRoot: boolean;
  strongRoot: boolean;
}

export interface SupportAnalysis {
  supporters: { position: string; stem: string; strength: number }[];
  totalStrength: number;
  hasSupport: boolean;
}

export interface ConstraintAnalysis {
  constraints: { position: string; stem: string; strength: number }[];
  totalStrength: number;
  hasConstraint: boolean;
}

export interface DayMasterStrengthAnalysis {
  score: number;
  status: string;
  details: {
    seasonalScore: number;
    timely: boolean;
    formationStrength: number;
    rootStrength: number;
    supportStrength: number;
    constraintStrength: number;
  };
}

export interface PatternAnalysis {
  pattern: string;
  isSpecial: boolean;
  basis?: string;
  /** 魁罡日（日柱庚辰/壬辰/戊戌/庚戌为外格，《三命通会》） */
  isKuiGang?: boolean;
}

export interface UsefulGodAnalysis {
  favorable: string[];
  unfavorable: string[];
  useful: string;
  avoid: string;
  primaryFavorable?: string[];
  secondaryFavorable?: string[];
  primaryUnfavorable?: string[];
  secondaryUnfavorable?: string[];
  favorableWuxing?: string[];
  unfavorableWuxing?: string[];
  primaryFavorableWuxing?: string;
  secondaryFavorableWuxing?: string[];
  primaryUnfavorableWuxing?: string;
  secondaryUnfavorableWuxing?: string[];
  primaryUseful?: string;
  primaryAvoid?: string;
  strategyTrace?: string[];
  primaryReason?: string;
  matchedRules?: {
    id: string;
    label: string;
    description: string;
  }[];
}

export interface BaziAnalysisResult {
  dayMasterStrength: DayMasterStrengthAnalysis; // 升级为完整对象
  mingGe: PatternAnalysis; // 升级为完整对象
  usefulGod: UsefulGodAnalysis; // 升级为完整对象
}

import { SolarTime } from 'tyme4ts';
type SolarTimeInstance = ReturnType<typeof SolarTime.fromYmdHms>;

interface NamedValue {
  getName(): string;
}

interface EightCharPillarLike extends NamedValue {
  getHeavenStem(): NamedValue;
  getEarthBranch(): NamedValue;
}

interface InternalEightChar {
  getYear(): EightCharPillarLike;
  getMonth(): EightCharPillarLike;
  getDay(): EightCharPillarLike;
  getHour(): EightCharPillarLike;
  getOwnSign(): NamedValue;
  getBodySign(): NamedValue;
  getFetalOrigin(): NamedValue;
  getFetalBreath(): NamedValue;
}

// 内部计算使用的类型，包含了临时数据
export interface InternalBaziChartResult extends BaziChartResult {
  solarTime?: SolarTimeInstance;
  eightChar?: InternalEightChar;
}

export interface BaziChartResult {
  /** 性别：male / female */
  gender: string;
  /** 公历出生日期 */
  solarDate: { year: number; month: number; day: number };
  /** 农历出生日期（含月名和日名） */
  lunarDate: { year: number; month: number; day: number; monthName: string; dayName: string };
  /** 出生时间完整信息（干支、节气、生肖等） */
  timeInfo: TimeInfo;
  /** 四柱（年柱/月柱/日柱/时柱） */
  pillars: Pillars;
  /** 日主（出生日的天干，代表命主自身） */
  dayMaster: DayMaster;
  /** 生肖 */
  zodiac: string;
  /** 星座（公历月日对应的西方星座） */
  constellation: string;
  /** 十神映射（各天干对应的十神） */
  tenGods: Record<string, string>;
  /** 藏干（地支中暗藏的天干） */
  hiddenStems: HiddenStems;
  /** 藏干的十神 */
  hiddenTenGods: Record<string, string[]>;
  /** 五行强度详细分析 */
  wuxingStrength: WuxingStrengthDetails;
  /** 大运信息（起运时间、各步大运干支） */
  luckInfo: LuckInfo;
  /** 命宫 */
  mingGong: string;
  /** 身宫 */
  shenGong: string;
  /** 胎元 */
  taiYuan: string;
  /** 胎息 */
  taiXi: string;
  /** 各柱十二长生 */
  lifeStages: Record<string, string>;
  /** 各柱的十二长生详情 */
  pillarLifeStages: PillarLifeStages;
  /** 纳音五行 */
  nayin: Nayin;
  /** 神煞（旧版，保留兼容） */
  shensha: ShenShaResult;
  /** 神煞详细分析 */
  shenShaAnalysis: ShenShaResult;
  /** 自坐信息 */
  ziZuo: ZiZuoResult;
  /** 空亡结果 */
  kongWang: KongWangResult;
  /** 各天干的四时旺相休囚死 */
  wuxingSeasonStatus: Record<string, string>;
  /** 月令司权天干 */
  monthCommander: string;
  /** 季节信息（当前节气、月令等） */
  seasonInfo: SeasonInfo;
  /** 八字综合分析（格局、用神、旺衰、十神结构等） */
  analysis: BaziAnalysisResult;
  /** 择日：当前时间信息 */
  timing?: TimingInfo;
  /** 当前年龄 */
  age?: number;
  /** 流年列表 */
  liunian?: LiunianInfo[];
}
