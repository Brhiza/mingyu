import type { SolarTermEvidence } from '../astronomy/solar-term-evidence';
import type { MoonPhaseEvidence } from '../astronomy/moon-phase-evidence';

interface BaseGanZhi { year: string; month: string; day: string; hour: string }

export interface QimenJiuGongGe {
  gong: number;
  name: string;
  direction: string;
  element: string;
  tianPan: {
    star: string;
    stem: string;
    /** 转盘法中天禽随天芮同宫时的随行星。 */
    companionStar?: string;
    /** 随行星所携带的中宫地盘干。 */
    companionStem?: string;
  };
  diPan: {
    stem: string;
  };
  renPan: {
    door: string;
  };
  shenPan: {
    god: string;
  };
}

export interface QimenSpecialConditions {
  isLiuJiaHour: boolean;
  isLiuGuiHour: boolean;
  isShiGanRuMu: boolean;
  isRiGanRuMu?: boolean;
  isWuBuYuShi: boolean;
  description: string;
}

export interface QimenTimeInfo {
  /** 排盘时刻实际所处的天文节气。 */
  solarTerm: string;
  /** 时家/日家拆补或置闰法采用的定局节气；置闰法下可能与 solarTerm 不同。 */
  juTerm?: string;
  epoch: string;
  [key: string]: string | undefined;
}

export interface QimenBranchPalace {
  branch: string;
  palace: number;
  name: string;
}

export interface QimenGanzhiInteraction {
  type: '六合' | '三合' | '半合' | '六冲' | '相刑' | '相害' | '天干五合' | '天干相冲';
  pillars: string[];
  values: string[];
  description: string;
}

export interface QimenSeasonalityInfo {
  currentJieQi: string;
  seasonalElement: string;
  /** 交节后按自然日分段的节气内阶段，仅用于节令背景，不作为奇门正式定局三元。 */
  jieQiPhase: {
    jieQi: string;
    phase: '上元' | '中元' | '下元';
    phaseIndex: number;
    solarTermEvidence: SolarTermEvidence;
  };
  dayStem: string;
  dayElement: string;
  seasonRelation: '得时' | '受生' | '受克' | '被耗' | '持平';
  seasonRelationDescription: string;
  lunarPhase: '新月' | '上弦' | '满月' | '下弦';
  lunarPhaseDetail: string;
  lunarDateWarning?: string;
  moonPhaseEvidence: MoonPhaseEvidence;
  lunarPhaseConsistency: boolean;
  dayOfficer: string;
  dayOfficerFortuneLabel: '吉' | '凶' | '平';
  dayOfficerAdvice: string;
  ganzhiInteractions: QimenGanzhiInteraction[];
}

export interface QimenPatternCombo {
  key: string;
  name: string;
  tone: 'super-good' | 'super-bad' | 'mixed';
  summary: string;
  palace?: number;
  sources: string[];
}

/**
 * 奇门遁甲排盘级别
 * - hour: 时家奇门（精确到时辰，默认）
 * - day:  日家奇门（一日大势）
 * - month: 月家奇门（一月运势）
 * - year:  年家奇门（一年大势）
 */
export type QimenScope = 'hour' | 'day' | 'month' | 'year';

export interface QimenData {
  /** 本次排盘实际采用的民用钟表时区偏移（分钟）；旧记录可缺省。 */
  timezoneOffsetMinutes?: number;
  /** 指定地方民用时区时保留原始配置，供追问重算。 */
  civilTime?: { timezone?: number; timeZoneId?: string };
  /** 真太阳时模式下用于节气、定局与月建的实际占时戳（毫秒）。 */
  termReferenceTimestamp?: number;
  /** 使用真太阳时时保留原始瞬时及经度，以便复核并生成追问。 */
  timeContext?: {
    standard: 'true-solar';
    longitude: number;
    referenceTimestamp: number;
    longitudeCorrectionMinutes: number;
    equationOfTimeMinutes: number;
    totalCorrectionMinutes: number;
  };
  /** 用神宫候选、宫内组合、宫间作用、反证与触发条件。 */
  evidenceAnalysis?: import('./evidence').QimenEvidenceAnalysis;
  /** 九宫排布方法：zhuanpan=转盘法，feipan=飞盘法。旧结果未记录时按转盘法兼容。 */
  method?: 'zhuanpan' | 'feipan';
  /** 飞盘细分子口径：默认 star-only（九星飞宫、八门八神环转）；all-fly 为九星、八门、九神皆按洛书九宫飞布。 */
  feipanMode?: 'star-only' | 'all-fly';
  /** 排盘级别：hour=时家, day=日家, month=月家, year=年家 */
  scope?: QimenScope;
  /** 定局方法：chaibu=拆补法（默认），zhirun=置闰法，maoshan=茅山道人法。仅时家/日家生效。 */
  juMethod?: 'chaibu' | 'zhirun' | 'maoshan';
  /** 中五宫寄宫口径：默认 kun2（一律寄坤二）；yang-gen8-yin-kun2 为阳遁寄艮八、阴遁寄坤二。 */
  centerPalace?: 'kun2' | 'yang-gen8-yin-kun2';
  /** 九宫格完整数据（1-9宫） */
  jiuGongGe: QimenJiuGongGe[];
  /** 四柱干支（年/月/日/时） */
  ganzhi: BaseGanZhi;
  /** 是否为阳遁 */
  isYangDun: boolean;
  /** 局数（1-9） */
  juShu: number;
  /** 值符星名 */
  zhiFu: string;
  /** 值使门名 */
  zhiShi: string;
  /** 基础格局标签列表（如星伏吟、门迫、三奇得等） */
  patternTags?: string[];
  /** 格局标签的详细解释 */
  patternDetails?: Array<{
    tag: string;
    summary: string;
  }>;
  /** 各宫位综合洞察评估 */
  palaceInsights?: Array<{
    gong: number;
    name: string;
    level: '有利' | '风险' | '关注';
    summary: string;
  }>;
  /** 空亡地支 */
  voidBranches?: string[];
  /** 空亡对应的宫位 */
  voidPalaces?: QimenBranchPalace[];
  /** 驿马（马星）信息 */
  horseStar?: QimenBranchPalace & {
    sourceBranch: string;
  };
  /** 排盘时间信息（节气、三元等） */
  timeInfo: QimenTimeInfo;
  /** 特殊时辰检查（六甲时、六癸时、时干入墓、五不遇时） */
  specialConditions?: QimenSpecialConditions;
  /** 节令背景（月相、建除、节气内自然日阶段、四柱互动等） */
  seasonality?: QimenSeasonalityInfo;
  /** 经典格局（九遁、三奇得使、天乙等） */
  classicPatterns?: Array<{
    name: string;
    type: 'good' | 'bad' | 'neutral';
    summary: string;
    palaces: number[];
  }>;
  /** 各宫天地盘干关系（生克/合/墓/刑） */
  stemRelations?: Array<{
    gong: number;
    heavenStem: string;
    earthStem: string;
    relation: string;
    pattern?: string;
  }>;
  /** 复合格局（同宫叠加、吉凶混杂、吉格逢空等） */
  patternCombos?: QimenPatternCombo[];
  /** 方位吉凶建议 */
  directions?: {
    goodDirections: Array<{
      gong: number;
      name: string;
      direction: string;
      use: string;
      reasons: string[];
    }>;
    avoidDirections: Array<{
      gong: number;
      name: string;
      direction: string;
      use: string;
      reasons: string[];
    }>;
  };
  /** 应期证据（相对节奏、触发条件与限制；不机械换算固定天数） */
  yingQi?: {
    minDays?: number;
    maxDays?: number;
    rhythm: '快' | '中' | '慢';
    sources: string[];
    triggerConditions: string[];
    limitations: string[];
    description: string;
  };
  /** Unix 时间戳（毫秒） */
  timestamp: number;
}

