/**
 * @file Bazi Types
 * @description Contains all shared type definitions and interfaces for the Bazi calculation engine.
 */

export const WUXING = ['木', '火', '土', '金', '水'] as const
export type Wuxing = typeof WUXING[number];

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

export interface DayMasterStrengthAnalysis {
  score: number;
  status: string;
  details: {
    timely: boolean;
    rootStrength: number;
    supportStrength: number;
  };
}

export interface PatternAnalysis {
  pattern: string;
  isSpecial: boolean;
}

export interface UsefulGodAnalysis {
  favorable: string[];
  unfavorable: string[];
  useful: string;
  avoid: string;
  favorableWuxing?: string[];
  unfavorableWuxing?: string[];
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

import { SolarTime } from 'tyme4ts'
type SolarTimeInstance = ReturnType<typeof SolarTime.fromYmdHms>

interface NamedValue {
  getName(): string;
}

interface EightCharPillarLike extends NamedValue {
  getHeavenStem(): NamedValue;
  getEarthBranch(): NamedValue;
}

export interface InternalEightChar {
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
  gender: string;
  solarDate: { year: number; month: number; day: number };
  lunarDate: { year: number; month: number; day: number; monthName: string; dayName: string };
  timeInfo: TimeInfo;
  pillars: Pillars;
  dayMaster: DayMaster;
  zodiac: string;
  constellation: string;
  tenGods: Record<string, string>;
  hiddenStems: HiddenStems;
  hiddenTenGods: Record<string, string[]>;
  wuxingStrength: WuxingStrengthDetails;
  luckInfo: LuckInfo;
  mingGong: string;
  shenGong: string;
  taiYuan: string;
  taiXi: string;
  lifeStages: Record<string, string>;
  pillarLifeStages: PillarLifeStages;
  nayin: Nayin;
  shensha: ShenShaResult;
  shenShaAnalysis: ShenShaResult;
  ziZuo: ZiZuoResult;
  kongWang: KongWangResult;
  wuxingSeasonStatus: Record<string, string>;
  monthCommander: string;
  seasonInfo: SeasonInfo;
  analysis: BaziAnalysisResult;
  timing?: TimingInfo;
  age?: number;
  liunian?: LiunianInfo[];
}
