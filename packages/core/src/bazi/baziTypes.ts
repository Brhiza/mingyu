/**
 * @file Bazi Types
 * @description Contains all shared type definitions and interfaces for the Bazi calculation engine.
 */

import type { ShenShaVariantConfig } from './baziShenSha/variants';
import type { ShenShaScope } from './baziShenSha/scope';
import type { RootClashStatus } from './baziRootAdjudication';
import type { MingGuaProfile } from '../types/analysis';
import type { SolarTermEvidence } from '../calendar/solar-term-evidence';
import type { TrueSolarTimeEvidenceFields } from '../calendar/true-solar-time';
import { WUXING } from '../wuxing';
import type { Wuxing } from '../wuxing';
import type {
  PatternActiveBreaker,
  PatternConditionStatus,
  PatternFulfillmentResult,
  PatternInteractionEvidence,
  PatternPathPosition,
  PatternRemedy,
  PatternStemEvidence,
} from './baziPatternFulfillment';
import type { ClimateRuleEffect, ClimateRuleMode } from './baziTherapeuticRules/types';

export { WUXING };
export type { Wuxing };

export const DAY_MASTER_STRENGTH_STATUSES = [
  '极强',
  '身强',
  '偏强',
  '中和',
  '偏弱',
  '身弱',
  '极弱',
  '未知',
] as const;

export type DayMasterStrengthStatus = (typeof DAY_MASTER_STRENGTH_STATUSES)[number];

export function isStrongDayMasterStatus(status: string): boolean {
  return status === '极强' || status === '身强' || status === '偏强';
}

export function isWeakDayMasterStatus(status: string): boolean {
  return status === '极弱' || status === '身弱' || status === '偏弱';
}

export type CommanderEntry = [string, number];

export interface Person {
  year: number;
  month: number;
  day: number;
  timeIndex?: number;
  gender: 'male' | 'female' | '';
  isLunar?: boolean;
  isLeapMonth?: boolean;
  useTrueSolarTime?: boolean;
  isThreePillars?: boolean;
  birthHour?: number;

  birthMinute?: number;
  /** 标准北京时间的秒数；提供时表示 birthHour/birthMinute 为精确标准时刻。 */
  birthSecond?: number;
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
  limitation:
    | '预警汇总只说明当前盘面是否贴近交界时刻，不改变已经按输入确定的时柱'
    | '缺时辰说明用于标注待补资料，候选场景分别记录，完整命盘尚未确定';
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

/**
 * 中国民用墙上时间字段对应真实 UTC 瞬时点的半开区间：[start, end)。
 * `startTimestamp` 与 `endTimestamp` 始终是对应瞬时点的 UTC epoch 毫秒数。
 */
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
  /** 周期实际开始瞬时，统一表示为北京时间 UTC+8。 */
  startSolarTime?: SolarDateTimeInfo;
  /** 周期实际结束瞬时，统一表示为北京时间 UTC+8，区间不包含此时刻。 */
  endSolarTime?: SolarDateTimeInfo;
  years: LiunianInfo[];
  resolvedYears?: LiunianInfo[];
}

export interface LuckInfo {
  startInfo: string;
  handoverInfo: string;
  cycles: LuckCycle[];
}

export interface BaziFortuneBatchMetadata {
  unit: 'cycle-year';
  startIndex: number;
  endIndexExclusive: number;
  totalEntries: number;
  nextIndex: number | null;
  cycleIndex: number | null;
  year: number | null;
}

export interface BaziUnknownTimeBatchMetadata {
  unit: 'candidate';
  startIndex: number;
  endIndexExclusive: number;
  totalCandidates: number;
  candidateKey: string;
  contextKey: string;
  next: { startIndex: number; contextKey: string } | null;
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
    /** 根所承载的地支未被外支六冲时为 true；旧调用方省略时按历史兼容口径处理。 */
    stable?: boolean;
    /** 综合本气与月令冲方强弱后，是否参与结构判断；省略时沿用 stable。 */
    actionable?: boolean;
    clashStatus?: RootClashStatus;
    /** 直接六冲的实际来源柱位与地支；根事实仍保留，稳定性另列。 */
    clashSources?: string[];
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
    /** 生扶证据有未被外支六冲的同类根时为 true；浮干或冲后支气保留事实但标 false。 */
    stable?: boolean;
    /** 生扶证据是否具有可参与作用的同类根或支气。 */
    actionable?: boolean;
    /** 生扶证据涉及直接六冲时，记录实际来源柱位与地支。 */
    clashSources?: string[];
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
    /** 透干克泄耗有未被外支六冲的同类根，或所载支气未受冲时为 true；浮干与冲后支气标 false。 */
    stable?: boolean;
    /** 克泄耗证据是否具有可参与作用的同类根或支气。 */
    actionable?: boolean;
    /** 克泄耗证据涉及直接六冲时，记录实际来源柱位与地支。 */
    clashSources?: string[];
    /** @deprecated 仅为兼容旧调用方保留，不参与正式旺衰、格局或用神裁定。 */
    strength: number;
  }[];
  /** @deprecated 仅为兼容旧调用方保留，不参与正式旺衰、格局或用神裁定。 */
  totalStrength: number;
  hasConstraint: boolean;
}

export interface DayMasterStrengthAnalysis {
  status: DayMasterStrengthStatus;
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

export type PatternTransformationStatus = '成化' | '待核验' | '存在反证';

/** 五合化气主格的结构化核验结果；待核验和反证只作为候选依据，不覆盖普通格局。 */
export interface PatternTransformationEvidence {
  element: Wuxing;
  status: PatternTransformationStatus;
  basis: string;
  evidence: string[];
  conditions: string[];
}

export interface QuzhiPatternAdjudication {
  kind: '曲直格';
  status: '成立' | '不成立';
  route: '亥卯未木局' | '寅卯辰东方';
  method: string;
  satisfied: string[];
  blockers: string[];
  memberHiddenStems: string[];
  visibleOutputStems: string[];
  visibleWealthStems: string[];
}

export interface CongErPatternAdjudication {
  kind: '从儿格';
  status: '成立' | '不成立';
  route: '三合食伤成气' | '三会食伤成气' | '月建食伤当权' | '食伤并透坐支同气';
  method: string;
  satisfied: string[];
  blockers: string[];
  outputElement: Wuxing;
  wealthElement: Wuxing;
  visibleOutputStems: string[];
  visibleWealthStems: string[];
  outputRootFacts: string[];
  wealthRootFacts: string[];
  functionalResolutions: string[];
  retainedHiddenFacts: string[];
}

export type SpecialPatternAdjudication = QuzhiPatternAdjudication | CongErPatternAdjudication;

export interface PatternAnalysis {
  pattern: string;
  isSpecial: boolean;
  basis?: string;
  transformation?: PatternTransformationEvidence;
  /** 已完成条件核验的特殊格终态；四柱完整时不以“候选”代替成立或不成立。 */
  specialAdjudication?: SpecialPatternAdjudication;
  /** 魁罡日（日柱庚辰/壬辰/戊戌/庚戌为外格，《三命通会》） */
  isKuiGang?: boolean;
  /** 格局候选关系、制化路径与成败待核条件。 */
  fulfillment?: PatternFulfillmentResult;
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
  /** 只适用于明确 policy.effects 的干级候选，不代表同五行全部可用。 */
  conditionalFavorableStems?: string[];
  /** 具体天干因调候条件或普通格局破格事实列忌，不把限制扩大到整个五行。 */
  conditionalUnfavorableStems?: string[];
  conditionalFavorableWuxing?: string[];
  decisionEvidence?: UsefulGodDecisionEvidence;
  strategyTrace?: string[];
  primaryReason?: string;
  matchedRules?: {
    id: string;
    label: string;
    description: string;
  }[];
}

export type UsefulGodDecisionStatus = '满足' | '不满足' | '资料不足' | '冲突';

/** 已满足的格局制化路径；只记录结构化干、根气、位置和合绊证据，不直接改写喜忌。 */
export interface UsefulGodControlFunctionEvidence {
  key: string;
  label: string;
  status: PatternConditionStatus;
  sourceStems: string[];
  targetStems: string[];
  position: PatternPathPosition;
  positionPairs: string[];
  sourceRootEvidence: PatternStemEvidence[];
  targetRootEvidence: PatternStemEvidence[];
  remedies: PatternRemedy[];
  interactionEvidence: PatternInteractionEvidence[];
  /** 作用干/对象落在基础扶抑喜神集合中的干；仅记录交集，不宣称发生冲突。 */
  baseFavorableStems: string[];
  /** 作用干/对象落在基础扶抑忌神集合中的干；需结合路径作用判断是否可用。 */
  baseUnfavorableStems: string[];
  evidenceGaps: string[];
  detail: string;
}

export interface UsefulGodClimateCandidateEvidence {
  ruleId: string;
  mode: ClimateRuleMode;
  status: UsefulGodDecisionStatus;
  requestedOrder: string[];
  missingInputs?: string[];
  effects?: ClimateRuleEffect[];
  adopted: boolean;
}

export interface UsefulGodDecisionEvidence {
  base: {
    favorable: string[];
    unfavorable: string[];
    ruleId?: string;
  };
  climateCandidates: UsefulGodClimateCandidateEvidence[];
  climateReferenceOrder?: string[];
  balanceAdjustment?: {
    reason: string;
    favorableOrder: string[];
  };
  climateAppliedRuleId?: string;
  climateAppliedRuleIds?: string[];
  controlFunctions?: UsefulGodControlFunctionEvidence[];
  conditionalFavorableStems?: string[];
  conditionalUnfavorableStems?: string[];
  conditionalFavorableWuxing?: string[];
  /** 普通格局破格且救应明确不成立时，对具体破格干落实的取用限制。 */
  patternBreakerRestrictions?: PatternActiveBreaker[];
  controlPaths?: PatternFulfillmentResult['pathEvaluations'];
  controlRemedies?: PatternFulfillmentResult['remedies'];
  transformation?: {
    element: Wuxing;
    basis: string;
    conditions: string[];
  };
  appliedLayers: string[];
  conflicts: string[];
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
  /** 时辰未知模式：仅保留可确定的柱，其余在候选场景中分别记录。 */
  isThreePillars?: boolean;
  /** 缺时辰时仅返回已确定的柱；其余柱为空，时辰场景用于比较而非定盘。 */
  unknownTimeAnalysis?: {
    status: '待补时';
    summary: string;
    uncertainPillars: Array<'year' | 'month' | 'day'>;
    /** 远程按候选续取时标识当前页；完整本地计算不带此字段。 */
    batch?: BaziUnknownTimeBatchMetadata;
    scenarios: Array<{
      /** 稳定候选身份；同一时辰内的临界前后仍保持不同身份。 */
      scenarioKey: string;
      /** 用户输入日历日期上的具体钟表时刻。 */
      inputClockTime: string;
      source:
        | 'day-start'
        | 'shichen-representative'
        | 'day-end'
        | 'solar-term-boundary'
        | 'month-commander-boundary';
      boundary?: {
        name: string;
        side: 'before' | 'at';
      };
      timeIndex: number;
      timeName: string;
      pillars: Pillars;
      strength: DayMasterStrengthStatus;
      pattern: string;
      favorableWuxing: string[];
      unfavorableWuxing: string[];
    }>;
  };
  /** 四柱之间可直接复核的同柱伏吟、同干、同支、反吟、合冲刑害破、三合三会关系 */

  pillarRelations: import('./baziPromptEnhancement').BaziPillarRelations;
  /** 日主（出生日的天干，代表命主自身） */
  dayMaster: DayMaster;
  /** 生肖 */
  zodiac: string;
  /** 星座（公历月日对应的西方星座） */
  constellation: string;
  /** 命卦（八宅，按立春年界计算） */
  mingGua?: MingGuaProfile;
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
  /** 调候寒暖燥湿定性（依据《穷通宝鉴》《滴天髓》） */
  climate?: {
    nature: '寒局' | '燥局' | '中和' | '微偏寒' | '微偏燥';
    medicine: string;
    summary: string;
  };
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
