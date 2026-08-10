/**
 * @file Bazi Types
 * @description Contains all shared type definitions and interfaces for the Bazi calculation engine.
 */

import type { ShenShaVariantConfig } from './baziShenSha/variants';
import type { ShenShaScope } from './baziShenSha/scope';
import type { MingGuaProfile } from '../types/analysis';
import type { SolarTermEvidence } from '../calendar/solar-term-evidence';
import type { TrueSolarTimeEvidenceFields } from '../calendar/true-solar-time';
import { WUXING } from '../wuxing';
import type { Wuxing } from '../wuxing';

export { WUXING };
export type { Wuxing };

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
  /** 当地标准时区，例如中国为 UTC+8；真太阳时模式默认 UTC+8。 */
  timezone?: number;
  /** IANA 历史时区；提供后按出生日期解析当时的法定 UTC 偏移。 */
  timeZoneId?: string;
  age?: number;
  shenShaVariants?: Partial<ShenShaVariantConfig>;
  /** 神煞输出范围；默认 common，all 返回全部已计算项目。 */
  shenShaScope?: ShenShaScope;
  /**
   * 是否自动校正中国夏令时（1986-1991，钟表时间快 1 小时）。
   * 默认 false；仅为没有 IANA 时区资料的旧调用方保留。真太阳时模式下执行 -60 分钟校正，
   * 仅时辰精度时只输出提示不做校正。
   */
  applyChinaDst?: boolean;
}

export interface TimeInfo {
  index: number;
  name: string;
  range: string;
  hour: number;
  minute: number;
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
  missing: string[];
  present: string[];
  dominantByRule: string[];
  ruleBasis: string[];
  commanderElement?: string;
}

export interface BaziWarningFact {
  key: string;
  type: '节气交接边界' | '时辰边界' | '换日流派边界' | '历史夏令时边界' | '输入时间边界';
  status: '已确定当前口径' | '已校正' | '需核验原始记录';
  referenceKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '边界说明只记录当前输入下已经采用的时间口径与唯一定盘结果；不另起第二套盘面，也不改写已确定的四柱';
}

export interface BaziWarningSummaryFact {
  key: 'bazi:warning-summary';
  status: '无预警' | '存在边界提示' | '存在需核验事项';
  factKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '预警汇总只说明当前盘面是否贴近交界时刻，不改变已经按输入确定的时柱';
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

/** 采用运行环境本地时区解释的半开时间区间：[start, end)。 */
export interface LocalTimeRange {
  start: SolarDateTimeInfo;
  end: SolarDateTimeInfo;
  startTimestamp: number;
  endTimestamp: number;
  endExclusive: true;
}

export interface TimingInfo {
  enabled: boolean;
  standardTime: SolarDateTimeInfo;
  correctedTime: SolarDateTimeInfo;
  birthPlace?: string;
  birthLongitude?: number;
  timezone: number;
  timeZoneId?: string;
  standardMeridian: number;
  longitudeCorrectionMinutes: number;
  equationOfTimeMinutes: number;
  totalCorrectionMinutes: number;
  evidence: TrueSolarTimeEvidenceFields;
  /** 中国夏令时校正（命中 1986-1991 夏令时时为 -60，未命中时省略） */
  dstCorrectionMinutes?: number;
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
  daysSincePrev: number | undefined;
  daysToNext: number | undefined;
  currentSeason: string;
  jieqiList: { name: string; date: string }[];
  previousTermEvidence?: SolarTermEvidence;
  nextTermEvidence?: SolarTermEvidence;
}

export interface RootAnalysis {
  roots: {
    position: string;
    branch: string;
    /** @deprecated 仅为兼容旧调用方保留，不参与正式旺衰、格局或用神裁定。 */
    strength: number;
  }[];
  /** @deprecated 仅为兼容旧调用方保留，不参与正式旺衰、格局或用神裁定。 */
  totalStrength: number;
  hasRoot: boolean;
  strongRoot: boolean;
}

export interface SupportAnalysis {
  supporters: {
    position: string;
    stem: string;
    /** @deprecated 仅为兼容旧调用方保留，不参与正式旺衰、格局或用神裁定。 */
    strength: number;
  }[];
  /** @deprecated 仅为兼容旧调用方保留，不参与正式旺衰、格局或用神裁定。 */
  totalStrength: number;
  hasSupport: boolean;
}

export interface ConstraintAnalysis {
  constraints: {
    position: string;
    stem: string;
    /** @deprecated 仅为兼容旧调用方保留，不参与正式旺衰、格局或用神裁定。 */
    strength: number;
  }[];
  /** @deprecated 仅为兼容旧调用方保留，不参与正式旺衰、格局或用神裁定。 */
  totalStrength: number;
  hasConstraint: boolean;
}

export interface DayMasterStrengthAnalysis {
  status: string;
  details: {
    timely: boolean;
    seasonalEffect: '支持' | '中性' | '削弱';
    commanderEffect: '助身' | '生身' | '泄身' | '耗身' | '克身' | '中性';
    formationEffect: '支持' | '中性' | '削弱';
    hasRoot: boolean;
    hasStrongRoot: boolean;
    hasSupport: boolean;
    hasConstraint: boolean;
    ruleBasis: string[];
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
  /** 四柱之间可直接复核的伏吟、反吟、合冲刑害破、三合三会关系 */
  pillarRelations: import('./baziPromptEnhancement').BaziPillarRelations;
  /** 日主（出生日的天干，代表命主自身） */
  dayMaster: DayMaster;
  /** 生肖 */
  zodiac: string;
  /** 星座（公历月日对应的西方星座） */
  constellation: string;
  /** 命卦（八宅，按立春年界计算） */
  mingGua: MingGuaProfile;
  /** 十神映射（各天干对应的十神） */
  tenGods: Record<string, string>;
  /** 藏干（地支中暗藏的天干） */
  hiddenStems: HiddenStems;
  /** 藏干的十神 */
  hiddenTenGods: Record<string, string[]>;
  /** 五行结构出现情况；字段名为旧版兼容名称，不表示百分比力量。 */
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
  /**
   * 排盘预警：出生时刻贴近节气交接/时辰边界/23:00 换日线，
   * 或落于中国夏令时期间等可能翻柱的情形。无预警时为空数组。
   */
  warnings: string[];
  warningFacts: BaziWarningFact[];
  warningSummaryFact: BaziWarningSummaryFact;
  /** 八字本命四柱、旺衰、格局、取用、关系、反证与限制的统一证据链。 */
  evidenceAnalysis?: import('./natalEvidence').BaziNatalEvidenceAnalysis;
}
