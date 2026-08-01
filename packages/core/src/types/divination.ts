import type { RandomOptions } from '../shared/random';
import type { CoreResultMeta } from '../shared/result';
import type { SolarTermEvidence } from '../calendar/solar-term-evidence';
import type { MoonPhaseEvidence } from '../calendar/moon-phase-evidence';
import type { SolarIlluminationEvidence } from '../calendar/solar-illumination-evidence';
import type { HistoricalTimezoneEvidence } from '../calendar/historical-timezone';
import type { TrueSolarTimeEvidenceFields } from '../calendar/true-solar-time';

export type { RandomOptions, RandomSource } from '../shared/random';
export type { CoreResultMeta } from '../shared/result';

export type SixGod = '青龙' | '朱雀' | '勾陈' | '螣蛇' | '白虎' | '玄武';

export type DivinationType =
  | 'liuyao'
  | 'meihua'
  | 'xiaoliuren'
  | 'jinkoujue'
  | 'qimen'
  | 'liuren'
  | 'tarot'
  | 'tarot_single'
  | 'ssgw'
  | 'almanac'
  | 'lenormand'
  | 'astrolabe'
  | 'taiyi';

export type MeihuaDivinationMethod = 'time' | 'number' | 'random' | 'timeTrigram';

export type XiaoliurenDivinationMethod = 'time';

export interface MeihuaSettings extends RandomOptions {
  method?: MeihuaDivinationMethod;
  number?: number;
}

export interface XiaoliurenData {
  meta?: CoreResultMeta;
  method: XiaoliurenDivinationMethod;
  methodLabel: string;
  timestamp: number;
  lunarMonth: number;
  lunarDay: number;
  isLeapMonth: boolean;
  hourIndex: number;
  hourLabel: string;
  ganzhi: { year: string; month: string; day: string; hour: string };
  /** 可复核的历法输入；落宫规则在固定底本校定前不自动计算。 */
  calculation: {
    lunarMonth: number;
    lunarDay: number;
    hourNumber: number;
    dayBoundary: '东八区民用日零点换日';
    leapMonthRule: '闰月沿用同名月序';
  };
  evidenceAnalysis?: import('../divination/xiaoliuren-evidence').XiaoliurenEvidenceAnalysis;
}

export type JinkoujueDivinationMethod = 'time' | 'number' | 'random';

export type JinkoujuePositionName = '地分' | '将神' | '贵神' | '人元';

export type JinkoujueYinYang = '阳' | '阴';

export interface JinkoujueFourPosition {
  name: JinkoujuePositionName;
  role: string;
  branch: string;
  stem?: string;
  stemElement?: string;
  god?: string;
  element: string;
  elementBasis: '地分支' | '月将支' | '贵神本属' | '人元干';
  yinYang: JinkoujueYinYang;
  seasonState: string;
  isVoid: boolean;
  support: string[];
  constraints: string[];
  promptText: string;
}

export interface JinkoujueMovement {
  category: '五动' | '三动';
  name: '妻动' | '官动' | '贼动' | '财动' | '鬼动' | '父母动' | '子孙动' | '兄弟动';
  from: JinkoujuePositionName;
  to: JinkoujuePositionName;
  relation: '克' | '生' | '比和';
  trigger: string;
  source: string;
}

export interface JinkoujueData {
  meta?: CoreResultMeta;
  method: JinkoujueDivinationMethod;
  methodLabel: string;
  timestamp: number;
  ganzhi: BaseGanZhi;
  /** 数字起课时只保存用户原始输入，不自动映射地分。 */
  numberInput?: number;
  randomTrace?: import('../shared/random').RandomTrace;
  evidenceAnalysis?: import('../divination/jinkoujue-evidence').JinkoujueEvidenceAnalysis;
}

export interface BaseGanZhi {
  year: string;
  month: string;
  day: string;
  hour: string;
}

export interface BaseYaoDetail {
  position: number;
  yaoType: '阳' | '阴';
  isChanging: boolean;
}

export type LiuyaoChangeRelation =
  '回头生' | '回头克' | '回头冲' | '化扶' | '化空' | '比和' | '化泄' | '化耗';

export type LiuyaoSanhePattern =
  | '三爻齐动'
  | '两动一静'
  | '初三爻动变成局'
  | '四六爻动变成局'
  | '日辰补局'
  | '月建补局'
  | '虚一待用';

export type LiuyaoSanheStatus =
  '成立' | '成立待静爻逢值' | '待填实' | '待冲墓' | '待填实并冲墓' | '虚一待补';

export interface LiuyaoSanheParticipant {
  /** 本卦原支或本位变爻，不把同一爻的本变支冒充两个活动爻。 */
  source: '本卦' | '变爻';
  position: number;
  branch: string;
  activity: '明动' | '暗动' | '静爻';
  isVoid: boolean;
  conditions: string[];
}

export interface LiuyaoSanheFormation {
  key: string;
  group: string;
  element: string;
  members: string[];
  pattern: LiuyaoSanhePattern;
  status: LiuyaoSanheStatus;
  participants: LiuyaoSanheParticipant[];
  trigger?: { source: '日辰' | '月建'; branch: string };
  missingBranch?: string;
  issues: string[];
  description: string;
}

export type LiuyaoSanxingPattern = '三支齐备' | '子卯相刑' | '重复自刑';

export interface LiuyaoSanxingParticipant {
  position: number;
  branch: string;
  activity: '明动' | '暗动' | '静爻';
  isWorld: boolean;
  isResponse: boolean;
}

export interface LiuyaoSanxingFormation {
  key: string;
  type: string;
  branches: string[];
  pattern: LiuyaoSanxingPattern;
  status: '作用待辨';
  participants: LiuyaoSanxingParticipant[];
  activePositions: number[];
  description: string;
}

export interface LiuyaoLineStrengthAnalysis {
  /** 本爻按月令所得旺相休囚死。 */
  seasonState: '旺' | '相' | '休' | '囚' | '死';
  /** 本爻五行在月建、日辰及本位变爻地支上的长生阶段。 */
  monthStage: string;
  dayStage: string;
  changedStage?: string;
  /** 本爻自身的发动、暗动、旬空等条件。 */
  selfSupport: string[];
  selfConstraints: string[];
  /** 月建、日辰对本爻的生克比合冲及长生墓绝条件。 */
  calendarSupport: string[];
  calendarConstraints: string[];
  /** 其他明动、暗动爻及符合条件的旺相静爻对本爻的作用。 */
  lineSupport: string[];
  lineConstraints: string[];
  /** 本位变爻只对原动爻产生的回头生克、进退、空墓绝等条件。 */
  changeSupport: string[];
  changeConstraints: string[];
  /** 各分层条件按固定顺序去重汇总；不按数量换算分数或强弱结论。 */
  support: string[];
  constraints: string[];
  status: '仅见支持条件' | '仅见限制条件' | '支持与限制并见';
}

export interface LiuyaoYaoDetail extends BaseYaoDetail {
  rawValue: number;
  changeType: string;
  sixGod: string;
  sixRelative: string;
  /** 纳甲天干；旧结果可能没有此字段。 */
  najiaTiangan?: string;
  najiaDizhi: string;
  wuxing: string;
  isWorld: boolean;
  isResponse: boolean;
  isVoid: boolean;
  /** 是否与日辰地支相冲；这是原始冲关系，不等同于日破。 */
  isDayClash?: boolean;
  /** 静爻休囚受日辰冲时为日破；旺相静爻日冲另记为暗动。 */
  isDayBreak?: boolean;
  isMonthBreak?: boolean;
  /** 旺相静爻受日辰冲时为暗动。 */
  isHiddenMove?: boolean;
  seasonState?: '旺' | '相' | '休' | '囚' | '死' | '平';
  changeDirection?: '化进神' | '化退神' | null;
  /** 旧版单值字段：变爻空亡时仍优先返回“化空”，新代码应读取 changeRelations。 */
  changeRelation?: LiuyaoChangeRelation | null;
  /** 动变五行/冲关系与化空可以并见，按原关系在前、化空在后保存。 */
  changeRelations?: LiuyaoChangeRelation[];
  changedYao?: {
    tiangan?: string;
    dizhi: string;
    wuxing: string;
    liuqin: string;
    isVoid: boolean;
  } | null;
  /** 仅表示本爻与月建或日辰命中子卯固定支对或辰午酉亥重复自刑。 */
  isSanxing?: boolean;
  sanxingType?: string;
  isLiuhe?: boolean;
  liuhePartner?: string;
  isLiuhai?: boolean;
  isRuMu?: boolean;
  shiErGong?: string;
  isYueMu?: boolean;
  isRiMu?: boolean;
  /** 月日、其他爻及本位动变的综合旺衰条件；旧结果可能没有此字段。 */
  strengthAnalysis?: LiuyaoLineStrengthAnalysis;
}

export type LiuyaoFlyingHiddenRelation =
  '飞来生伏' | '飞来克伏' | '伏去生飞' | '伏克飞神' | '飞伏比和';

export interface LiuyaoHiddenSpiritConditionAnalysis {
  /** 飞神与伏神之间的固定五行生克关系。 */
  flyingRelation: LiuyaoFlyingHiddenRelation;
  hiddenSeasonState: '旺' | '相' | '休' | '囚' | '死';
  hiddenMonthStage: string;
  hiddenDayStage: string;
  hiddenFlyingStage: string;
  flyingSeasonState: '旺' | '相' | '休' | '囚' | '死';
  flyingMonthStage: string;
  flyingDayStage: string;
  /** 有利于伏神得助或飞神松动的客观条件，不等于已经出伏或现实吉利。 */
  support: string[];
  /** 伏神受制、衰空破墓绝等客观条件，不等于现实凶险或必然无用。 */
  constraints: string[];
}

export interface LiuyaoHiddenSpirit {
  sixRelative: string;
  position: number;
  /** 伏神纳甲天干；旧结果可能没有此字段。 */
  najiaTiangan?: string;
  najiaDizhi: string;
  wuxing: string;
  isVoid: boolean;
  underYao: {
    position: number;
    sixRelative: string;
    najiaTiangan?: string;
    najiaDizhi: string;
    wuxing: string;
  };
  /** 飞伏生克、月日动爻与空破墓绝条件；旧结果可能没有此字段。 */
  conditionAnalysis?: LiuyaoHiddenSpiritConditionAnalysis;
}

export type LiuyaoHexagramRelation = '六合卦' | '六冲卦';

export interface LiuyaoHexagramRelations {
  /** 主卦是否为整卦六合或六冲 */
  original: LiuyaoHexagramRelation | null;
  /** 有动爻时，变卦是否为整卦六合或六冲 */
  changed: LiuyaoHexagramRelation | null;
  /** 如“六冲变六合”“六合变六冲” */
  transition: string | null;
}

export type LiuyaoFanFuScope = '内卦' | '外卦' | '内外';
export type LiuyaoFanFuKind = '卦反吟' | '爻反吟' | '伏吟';

export interface LiuyaoFanFuRelationItem {
  /** 反吟/伏吟类型 */
  kind: LiuyaoFanFuKind;
  /** 触发在内卦、外卦或内外皆见 */
  scope: LiuyaoFanFuScope;
  /** 面向用户展示的简短标签 */
  label: string;
  /** 触发依据说明 */
  description: string;
}

export interface LiuyaoFanFuRelations {
  /** 反吟结构，可能同时存在内卦、外卦不同类型 */
  fanyin: LiuyaoFanFuRelationItem[];
  /** 伏吟结构，按动变后纳甲地支不变识别 */
  fuyin: LiuyaoFanFuRelationItem[];
  /** 便于前端与提示词直接展示的标签 */
  labels: string[];
}

export type LiuyaoPalaceStage =
  '首卦' | '一世' | '二世' | '三世' | '四世' | '五世' | '游魂' | '归魂';

export type LiuyaoActivityPatternKind = '静卦' | '独发卦' | '多爻发动' | '独静卦' | '全动卦';

/** 六爻明动数量形成的客观结构；不直接裁定吉凶、成败或应期。 */
export interface LiuyaoActivityPattern {
  kind: LiuyaoActivityPatternKind;
  movingCount: number;
  movingPositions: number[];
  stillPositions: number[];
  /** 乾坤全动时保留的《周易》经文参考，不替代纳甲用神分析。 */
  scriptureReference?: '乾卦用九' | '坤卦用六';
  guidance: string;
}

export type LiuyaoMonthGuaShenStatus = '入卦' | '不入卦';

export interface LiuyaoMonthGuaShenMatch {
  position: number;
  sixRelative: string;
  najiaTiangan?: string;
}

export interface LiuyaoMonthGuaShenAnalysis {
  /** 按世爻阴阳与爻位推得的月卦身地支；即使不入本卦也必须保留。 */
  branch: string;
  status: LiuyaoMonthGuaShenStatus;
  /** 本卦中所有同支爻位；同一月卦身可能同时临两爻。 */
  matches: LiuyaoMonthGuaShenMatch[];
  /** @deprecated 旧版单一命中兼容字段；新代码使用 matches。 */
  sixRelative?: string;
  /** @deprecated 旧版单一命中兼容字段；新代码使用 matches。 */
  position?: number;
}

export interface MeihuaYaoDetail extends BaseYaoDetail {
  tiYong: '体' | '用';
}

export interface BaseHexagramData {
  meta?: CoreResultMeta;
  originalName: string;
  changedName?: string;
  interName?: string;
  ganzhi: BaseGanZhi;
  timestamp: number;
}

export interface LiuyaoData extends BaseHexagramData {
  /** 用神候选、原神忌神仇神与逐爻支持/反证结构。 */
  evidenceAnalysis?: import('../divination/liuyao-evidence').LiuyaoEvidenceAnalysis;
  /** 起卦来源与三钱投掷轨迹。 */
  generation?: {
    method: 'time' | 'manual' | 'coins';
    /**
     * 六个爻值的实际来源；`time` 只是历史兼容方法名，实际使用时间戳固定种子模拟三钱。
     */
    source?:
      | 'time-seeded-coin-simulation'
      | 'manual-yao-values'
      | 'provided-coin-throws'
      | 'random-coin-simulation';
    coinThrows?: Array<{
      coins: [2 | 3, 2 | 3, 2 | 3];
      total: 6 | 7 | 8 | 9;
    }>;
  };
  /** 原始摇卦数字数组（6/7/8/9 分别代表老阴/少阳/少阴/老阳） */
  yaoArray: number[];
  /** 动爻详情：位置、是否变化、变化类型 */
  changingYaos: Array<{
    position: number;
    isChanging: boolean;
    type: string;
  }>;
  /** 六神排列（青龙、朱雀、勾陈…），基于起卦日干起 */
  sixGods: string[];
  /** 六亲排列（父母、兄弟、官鬼…），基于宫位五行定 */
  sixRelatives: string[];
  /** 纳甲地支：各爻对应的十二地支 */
  najiaDizhi: string[];
  /** 纳甲天干：内外经卦各三爻所纳天干；旧结果可能没有此字段。 */
  najiaTiangan?: string[];
  /** 各爻的五行属性 */
  wuxing: string[];
  /** 世应位置：[世爻位置, 应爻位置] */
  worldAndResponse: string[];
  /** 旬空地支（日柱旬空） */
  voidBranches: string[];
  /** 所属卦宫（八宫之一） */
  palace: {
    name: string;
    wuxing: string;
  };
  /** 八宫卦序位置：首卦、一世至五世、游魂、归魂 */
  palaceStage?: LiuyaoPalaceStage;
  /** 各爻的完整详情 */
  yaosDetail: LiuyaoYaoDetail[];
  /** 伏神（伏藏之爻） */
  hiddenSpirits?: LiuyaoHiddenSpirit[];
  /** 整卦六合/六冲及卦变关系 */
  hexagramRelations?: LiuyaoHexagramRelations;
  /** 六爻卦变反吟/伏吟结构 */
  fanfuRelations?: LiuyaoFanFuRelations;
  /** 从原始爻值计算的动静结构；旧结果可能没有此字段。 */
  activityPattern?: LiuyaoActivityPattern;
  /** @deprecated 仅供读取旧结果，当前生成结果不再输出；请改用 activityPattern。 */
  specialPattern?: '静卦' | '独发卦' | '独静卦' | '全动卦' | '乾卦用九' | '坤卦用六';
  /** @deprecated 仅供读取旧结果，当前生成结果不再输出；请改用 activityPattern.guidance。 */
  specialAdvice?: string;
  /** @deprecated “乱动”无跨原典一致的客观阈值，仅供读取旧结果。 */
  isChaotic?: boolean;
  /** @deprecated “乱动”无跨原典一致的客观阈值，仅供读取旧结果。 */
  chaoticReason?: string;
  /** 与日支的三合局 */
  sanheWithDay?: {
    group: string;
    members: string[];
    description: string;
    formationKey?: string;
    status?: LiuyaoSanheStatus;
    participants?: LiuyaoSanheParticipant[];
    issues?: string[];
  } | null;
  /** 与月建的三合局 */
  sanheWithMonth?: {
    group: string;
    members: string[];
    description: string;
    formationKey?: string;
    status?: LiuyaoSanheStatus;
    participants?: LiuyaoSanheParticipant[];
    issues?: string[];
  } | null;
  /** 卦内成局、日月补局及虚一待用的完整三合结构。 */
  sanheFormations?: LiuyaoSanheFormation[];
  /** 卦内已满足支组与发动条件的三刑结构；旧结果可能只有 branches/type。 */
  sanxingInYaos?: LiuyaoSanxingFormation[];
  /** 月卦身；新结果即使不入本卦也保留地支与“不入卦”状态。 */
  guaShen?: LiuyaoMonthGuaShenAnalysis | null;
}

export interface MeihuaCalculation {
  method: string;
  numbers?: number[];
  time?: string;
  number?: number;
  month?: number;
  day?: number;
  yearZhi?: string;
  yearZhiIndex?: number;
  timeZhi?: string;
  timeZhiIndex?: number;
  upperTrigramIndex?: number;
  lowerTrigramIndex?: number;
  movingYaoIndex?: number;
  methodKey?: MeihuaDivinationMethod;
  [key: string]: unknown;
}

export interface MeihuaData extends BaseHexagramData {
  /** 主互变体用、体用党、应卦制化、内外动静、坐端应兆、万物耳目外应、饮食、观物占物、物数为体、变爻取象、现场克应、趣时规则、历史用易实例与手中物规则、事项响应、占卜十应、论事十大应、卦应八卦目录与反对性情版本边界、全卦克应候选及支持/限制证据。 */
  evidenceAnalysis?: import('../divination/meihua-evidence').MeihuaEvidenceAnalysis;
  /** 体卦（代表问卦者） */
  tiGua: {
    name: string;
    element: string;
    nature: string;
  };
  /** 用卦（代表所问之事） */
  yongGua: {
    name: string;
    element: string;
    nature: string;
  };
  /** 变后的体卦（动爻变化导致） */
  changedTiGua?: {
    name: string;
    element: string;
    nature: string;
  } | null;
  /** 变后的用卦 */
  changedYongGua?: {
    name: string;
    element: string;
    nature: string;
  } | null;
  /** 互卦中与原体卦同处上/下方位的体互。 */
  interTiGua?: {
    name: string;
    element: string;
    nature: string;
  } | null;
  /** 互卦中与原用卦同处上/下方位的用互。 */
  interYongGua?: {
    name: string;
    element: string;
    nature: string;
  } | null;
  /** 动爻位置与描述 */
  movingYao: {
    position: number;
    description: string;
    yaoName: string;
  };
  /** 体用生克综合分析 */
  analysis: {
    season: '春' | '夏' | '秋' | '冬';
    /** 旺相休囚死采用的月建地支；旧结果可能缺失。 */
    monthBranch?: string;
    /** 月建本气五行；旧结果可能缺失。 */
    monthElement?: string;
    tiYongRelation: string;
    tiSeasonState: string;
    yongSeasonState: string;
    /** 体互与原体的五行关系；字段名为兼容既有结果保留。 */
    inter1Relation: string;
    /** 用互与原体的五行关系；字段名为兼容既有结果保留。 */
    inter2Relation: string;
    changedRelation: string;
    changedTiYongRelation: string;
    tiYongRaw?: string;
    yingQi?: string[];
  };
  /** 主卦信息 */
  mainHexagram: {
    name: string;
    symbol: string;
    upper: string;
    lower: string;
    description: string;
    yaoCi?: string[];
    movingYaoCi?: string;
    yongCi?: string;
  };
  /** 互卦（代表过程） */
  interHexagram?: {
    name: string;
    symbol: string;
    upper: string;
    lower: string;
    description: string;
    yaoCi?: string[];
    yongCi?: string;
  } | null;
  /** 变卦（代表结果） */
  changedHexagram?: {
    name: string;
    symbol: string;
    upper: string;
    lower: string;
    description: string;
    yaoCi?: string[];
    yongCi?: string;
  } | null;
  /** 各爻详情 */
  yaosDetail: MeihuaYaoDetail[];
  /** 起卦计算过程 */
  calculation?: MeihuaCalculation;
}

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
  isWuBuYuShi: boolean;
  description: string;
}

export interface QimenTimeInfo {
  /** 排盘时刻实际所处的天文节气。 */
  solarTerm: string;
  /** 时家定局采用的节气；置闰法下可能与 solarTerm 不同。年月家仅保留历法背景。 */
  juTerm: string;
  epoch: string;
  [key: string]: string;
}

export interface QimenBranchPalace {
  branch: string;
  palace: number;
  name: string;
}

export interface QimenGanzhiInteraction {
  type: '六合' | '三合' | '六冲' | '相刑' | '相害' | '天干五合' | '天干相冲';
  pillars: string[];
  values: string[];
  description: string;
}

export interface QimenSeasonalityInfo {
  currentJieQi: string;
  seasonalElement: string;
  solarTermEvidence: SolarTermEvidence;
  dayStem: string;
  dayElement: string;
  seasonRelation: '旺' | '相' | '休' | '囚' | '死';
  seasonRelationDescription: string;
  lunarPhaseDetail: string;
  moonPhaseEvidence: MoonPhaseEvidence;
  lunarPhaseConsistency: boolean;
  dayOfficer: string;
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
 * - day:  日家奇门兼容标识；因古法版本冲突，当前运行时失败关闭
 * - month: 月家奇门（一月运势）
 * - year:  年家奇门（一年大势）
 */
export type QimenScope = 'hour' | 'day' | 'month' | 'year';

export interface QimenData {
  /** 中性位置索引、宫内结构、九宫宫对、位置限制与推算边界。 */
  evidenceAnalysis?: import('../divination/qimen-evidence').QimenEvidenceAnalysis;
  /** 九宫排布方法：zhuanpan=转盘法，feipan=飞盘法。旧结果未记录时按转盘法兼容。 */
  method?: 'zhuanpan' | 'feipan';
  /** 排盘级别：hour=时家, month=月家, year=年家；day 仅供旧数据类型兼容，运行时拒绝。 */
  scope?: QimenScope;
  /** 定局方法：时家为 chaibu/zhirun，月家为 yuejia，年家为 nianjia。 */
  juMethod?: 'chaibu' | 'zhirun' | 'yuejia' | 'nianjia';
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
  /** 可由九宫直接复算的位置与五行标签（如伏吟、反吟、门克宫、时家击刑） */
  patternTags?: string[];
  /** 格局标签的详细解释 */
  patternDetails?: Array<{
    tag: string;
    summary: string;
  }>;
  /** 已审核旬空地支；当前只在时家保存时旬空，月家、年家为空数组。 */
  voidBranches?: string[];
  /** 已审核旬空对应的宫位；当前只在时家保存。 */
  voidPalaces?: QimenBranchPalace[];
  /** @deprecated 仅兼容旧结果输入；审核重建不采信，当前不自动计算驿马（马星）。 */
  horseStar?: QimenBranchPalace & {
    sourceBranch: string;
  };
  /** 排盘时间信息（节气、三元等） */
  timeInfo: QimenTimeInfo;
  /** 特殊时辰检查（六甲时、六癸时、时干入墓、五不遇时） */
  specialConditions?: QimenSpecialConditions;
  /** 节令背景（实际节气、月令五行、精确月相、建除名称与四柱互动等）；定局三元只见 timeInfo.epoch */
  seasonality?: QimenSeasonalityInfo;
  /** 已逐条校勘的十一项天地盘固定格，以及时家上下文、三奇升殿、三诈和三项条件一致五假位置结构；不含失败关闭的九遁与三奇得使 */
  classicPatterns?: Array<{
    name: string;
    type: 'good' | 'bad' | 'neutral';
    summary: string;
    palaces: number[];
  }>;
  /** 各宫天地盘干关系（生克/合；六仪击刑由带当前时干上下文的位置标签单独提供） */
  stemRelations?: Array<{
    gong: number;
    heavenStem: string;
    earthStem: string;
    relation: string;
    pattern?: string;
  }>;
  /** 固定文献条件已闭合的门宫、主客、方位与时机组合规则 */
  patternCombos?: QimenPatternCombo[];
  /** Unix 时间戳（毫秒） */
  timestamp: number;
}

export interface LiurenPlateItem {
  branch: string;
  under: string;
  god: string;
}

export interface LiurenLesson {
  name: '一课' | '二课' | '三课' | '四课';
  upper: string;
  lower: string;
  god: string;
  relation: string;
  note: string;
}

export type LiurenKinship = '父母' | '子孙' | '妻财' | '官鬼' | '兄弟';

export interface LiurenTransmission {
  stage: '初传' | '中传' | '末传';
  branch: string;
  god: string;
  relation: string;
  note: string;
  wuxing?: string;
  seasonState?: '旺' | '相' | '休' | '囚' | '死';
  isVoid?: boolean;
  /** 本传相对日干所得六亲。 */
  kinship?: LiurenKinship;
  /** 本传与日干的有方向五行关系。 */
  dayStemRelation?: string;
  /** 中、末传与上一传的有方向五行关系；初传不设。 */
  previousRelation?: string;
  /** 中、末传与上一传的固定地支关系；初传为空数组。 */
  previousBranchRelations?: string[];
  /** 本传与日支的有方向五行关系。 */
  dayRelation?: string;
  /** 本传与日支的固定地支关系。 */
  dayBranchRelations?: string[];
}

export interface LiurenClassicalRule {
  source: string;
  rule: string;
  category: string;
  summary: string;
}

export interface LiurenGuaTiFact {
  id: string;
  stableKey: string;
  name: string;
  category: '三传支类' | '三合成局' | '发用临地' | '岁将贵人' | '四课关系' | '贵人临地';
  branches: string[];
  matchedConditions: string[];
  sourceTitle: string;
  sourceUrl: string;
  sourceQuote: string;
}

export interface LiurenShenShaFact {
  name: string;
  target: string;
  targetType: '天干' | '地支' | '八卦方位';
  category:
    '岁神煞' | '旬神煞' | '十天干神煞' | '十二地支神煞' | '逐月神煞' | '四时神煞' | '罗网神煞';
  basis: '年干' | '年支' | '日柱' | '日干' | '日支' | '月建' | '月建与日柱';
  input: string;
  rule: string;
  sources: string[];
  limitations: string[];
}

export interface LiurenData {
  /** 起盘口径版本、四课取传、逐传日干六亲、有方向关系、旺衰及条件化旬空证据。 */
  evidenceAnalysis?: import('../divination/liuren-evidence').LiurenEvidenceAnalysis;
  /** 四柱干支（年/月/日/时） */
  ganzhi: BaseGanZhi;
  /** Unix 时间戳（毫秒） */
  timestamp: number;
  /** 昼夜占：昼占或夜占 */
  dayNight?: '昼占' | '夜占';
  /** 月将（所用太阳过宫） */
  monthLeader: string;
  /** 占时地支（起课时辰） */
  divinationBranch: string;
  /** @deprecated 旧版误设字段，无独立六壬含义；新结果不再生成。 */
  dayOfficer?: string;
  /** 贵人临支 */
  noblemanBranch?: string;
  /** 贵人所临地盘 */
  noblemanGroundBranch?: string;
  /** 旬空地支 */
  xunKong?: string[];
  /** 发用规则名称（如涉害、遥克、昴星等九宗门） */
  transmissionRule?: string;
  /** 三传特殊模式：伏吟/反吟/回环/递传 */
  transmissionPattern?: '伏吟' | '反吟' | '回环' | '递传';
  /** 三传详细说明 */
  transmissionDetail?: string;
  /** 地盘十二支 */
  earthlyPlate?: string[];
  /** 日干寄宫 */
  dayStemResidence?: string;
  /** 天盘（十二支加十二天将） */
  heavenlyPlate: LiurenPlateItem[];
  /** 四课 */
  fourLessons: LiurenLesson[];
  /** 三传（初传/中传/末传） */
  threeTransmissions: LiurenTransmission[];
  /** 课体标签 */
  patternTags?: string[];
  /** 经典课体 */
  classicalRules?: LiurenClassicalRule[];
  /** 四课概要总结 */
  lessonSummary?: string;
  /** 三传概要总结 */
  transmissionSummary?: string;
  /** 课体名称列表 */
  guaTi?: string[];
  /** 逐项登记、可复算且带固定古籍来源的课体事实 */
  guaTiFacts?: LiurenGuaTiFact[];
  /** 神煞汇总 */
  shenShaSummary?: string[];
  /** 可逐项复算的神煞定位事实 */
  shenShaFacts?: LiurenShenShaFact[];
  /** 天将属性详情 */
  tianJiangProps?: Record<
    string,
    {
      wuxing: string;
      yinYang: string;
      category: string;
      description?: string;
    }
  >;
  focusEvidence?: Array<{
    target: string;
    role: string;
    level: '主证' | '辅证';
    evidence: string[];
    limitations: string[];
  }>;
  timingEvidence?: string[];
}

export interface TarotData {
  meta?: CoreResultMeta;
  spreadType: string;
  spreadName: string;
  cards: {
    id: number;
    name: string;
    position: string;
    reversed: boolean;
    keywords: string[];
    uprightMeaning?: string;
    reversedMeaning?: string;
    element?: string;
    archetype?: string;
  }[];
  draw?: {
    deckSize: number;
    method:
      'Fisher-Yates洗牌后依牌位顺序取顶牌' | '用户按牌位手工录入' | '用户逐张触发前端随机抽取';
    orientationRule: '每张牌独立取随机数，小于0.5为逆位，否则为正位' | '正逆位由用户逐张录入';
    order: Array<{
      index: number;
      position: string;
      cardId: number;
      cardName: string;
      orientation: '正位' | '逆位';
    }>;
  };
  timestamp: number;
  evidenceAnalysis?: import('../divination/tarot-evidence').TarotEvidenceAnalysis;
}

export type TarotSpreadType =
  | 'single'
  | 'three'
  | 'love'
  | 'career'
  | 'decision'
  | 'celtic'
  | 'chakra'
  | 'year'
  | 'mindBodySpirit'
  | 'horseshoe';

export type LiuyaoTemplateType = 'general' | 'ganqing' | 'shiye' | 'caifu' | 'guaishen';

export type LiurenTemplateType = 'general' | 'ganqing' | 'shiye' | 'caifu';

export type AlmanacTopic =
  | 'marriage'
  | 'move'
  | 'opening'
  | 'contract'
  | 'travel'
  | 'medical'
  | 'study'
  | 'burial'
  | 'renovation'
  | 'custom';

export type AlmanacParticipantGender = '男' | '女' | '';

export interface AlmanacParticipantInput {
  id: string;
  name: string;
  gender: AlmanacParticipantGender;
  year: string;
  month: string;
  day: string;
  timeIndex: string;
  dateType: 'solar' | 'lunar';
  isLeapMonth?: boolean;
}

export interface AlmanacParticipantProfile {
  id: string;
  name: string;
  gender: AlmanacParticipantGender;
  solarDate: string;
  lunarDate: string;
  zodiac: string;
  constellation: string;
  dayMaster: string;
  dayMasterElement: string;
  pillars: BaseGanZhi;
  usefulGods: string[];
  avoidGods: string[];
}

export interface AlmanacGenerationSource {
  topic: AlmanacTopic;
  startDate: string;
  endDate: string;
  participants: AlmanacParticipantInput[];
  timestamp: number;
}

export interface AlmanacDataView {
  /** 在完整、已重新计算并完成候选分组排序的日期列表中的起始位置。 */
  offset: number;
  /** 当前视图最多保留的日期数量，用于公开 API 的可复算分页。 */
  limit: number;
}

export interface AlmanacAnnualDirectionGod {
  branch: string;
  direction: string;
  god: string;
}

export type AlmanacRuleFactStatus = '支持' | '限制' | '中性' | '未采用';

export interface AlmanacTopicMatchFact {
  key: string;
  scope: '候选日' | '时辰';
  topic: AlmanacTopic;
  topicLabel: string;
  sourceType: '原始宜项' | '原始忌项' | '建除值日' | '十二神';
  status: AlmanacRuleFactStatus;
  inputItems: string[];
  keywords: string[];
  matchedItems: string[];
  promptText: string;
  sources: string[];
  limitation: string;
}

export interface AlmanacGodFact {
  key: string;
  name: string;
  classification: '吉神' | '凶神' | '未分级';
  status: '已读取';
  promptText: string;
  sources: string[];
  limitation: string;
}

export interface AlmanacParticipantRelationFact {
  key: string;
  participantId: string;
  participantName: string;
  scope: '候选日' | '时辰';
  basis: '年支' | '日支' | '喜用五行' | '忌神五行' | '整体';
  candidateValue: string;
  participantValues: string[];
  relation: '冲' | '刑' | '害' | '破' | '命中' | '未命中' | '未见直接冲突' | '未采用';
  status: AlmanacRuleFactStatus;
  detail?: string;
  promptText: string;
  sources: string[];
  limitation: string;
}

export interface AlmanacDayCandidate {
  date: string;
  /** 以该民用日期中国标准时间12:00为统一参照的月相事实，不参与传统宜忌评分。 */
  moonPhaseEvidence?: MoonPhaseEvidence;
  weekday: string;
  lunarDate: string;
  ganzhi: {
    year: string;
    month: string;
    day: string;
  };
  zodiac: string;
  dayOfficer: string;
  twelveStar: string;
  twentyEightStar: string;
  twentyEightStarDetail?: {
    fullName: string;
    sevenStar: string;
    animal: string;
    zone: string;
    fortune: string;
    source: string;
  } | null;
  nineStar: string;
  nineStarDetail?: {
    fullName: string;
    color: string;
    wuxing: string;
    dipper: string;
    direction: string;
    source: string;
  } | null;
  gods: string[];
  recommends: string[];
  avoids: string[];
  pengZu: string;
  pengZuGan?: string;
  pengZuZhi?: string;
  clash: string;
  annualDirectionGods?: AlmanacAnnualDirectionGod[];
  highlights: string[];
  cautions: string[];
  participantNotes: string[];
  topicMatchFacts?: AlmanacTopicMatchFact[];
  godFacts?: AlmanacGodFact[];
  participantRelationFacts?: AlmanacParticipantRelationFact[];
  hours?: AlmanacHourCandidate[];
  /**
   * 兼容字段：按“可用候选、条件候选”分组并保持组内自然时序的无强冲突时辰全集；
   * 不表示唯一最佳，也不按支持项数量截取名次。慎用时辰仍保留在 hours。
   */
  bestHours?: AlmanacHourCandidate[];
}

export interface AlmanacHourCandidate {
  name: string;
  range: string;
  ganzhi: string;
  branch: string;
  twelveStar: string;
  /** tyme4ts TwelveStar.getEcliptic() 原生黄黑道属性。 */
  ecliptic?: '黄道' | '黑道';
  /** tyme4ts Ecliptic.getLuck() 原生吉凶属性。 */
  eclipticLuck?: '吉' | '凶';
  recommends: string[];
  avoids: string[];
  highlights: string[];
  cautions: string[];
  participantNotes: string[];
  topicMatchFacts?: AlmanacTopicMatchFact[];
  participantRelationFacts?: AlmanacParticipantRelationFact[];
}

export interface AlmanacData {
  /** 审核重建只信任这里保存的原始择日输入与生成时间。 */
  generation: AlmanacGenerationSource;
  /** 可选的可复算分页视图；日期内容仍从 generation 全量重建后截取。 */
  view?: AlmanacDataView;
  /** 日期约束、传统宜忌、参与人关系参考、时辰条件与现实限制。 */
  evidenceAnalysis?: import('../divination/almanac-evidence').AlmanacEvidenceAnalysis;
  topic: AlmanacTopic;
  topicLabel: string;
  startDate: string;
  endDate: string;
  days: AlmanacDayCandidate[];
  participants: AlmanacParticipantProfile[];
  timestamp: number;
}

export type LenormandSpreadType =
  'single' | 'three' | 'five' | 'relationship' | 'decision' | 'nine' | 'element' | 'grandTableau';

export type LenormandCombinationRelation = '牌序相邻' | '横向相邻' | '纵向相邻' | '对角相邻';

export interface LenormandData {
  meta?: CoreResultMeta;
  spreadType: LenormandSpreadType;
  spreadName: string;
  draw?: {
    deckSize: number;
    method:
      'Fisher-Yates洗牌后依牌位顺序取顶牌' | '用户按牌位手工录入' | '用户逐张触发前端随机抽取';
    order: Array<{
      index: number;
      position: string;
      cardId: number;
      cardName: string;
      house?: string;
      row?: number;
      column?: number;
    }>;
  };
  cards: {
    id: number;
    name: string;
    position: string;
    keywords: string[];
    meaning: string;
    house?: string;
    row?: number;
    column?: number;
  }[];
  combinations?: Array<{
    card1: string;
    card2: string;
    position1?: string;
    position2?: string;
    relation?: LenormandCombinationRelation;
    rowDistance?: number;
    columnDistance?: number;
    meaning: string;
    source?: '固定组合' | '相邻牌义合读';
  }>;
  layoutEvidence?: string[];
  timestamp: number;
  evidenceAnalysis?: import('../divination/lenormand-evidence').LenormandEvidenceAnalysis;
}

export interface AstrolabeBirthInput {
  name: string;
  gender: AlmanacParticipantGender;
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  latitude: string;
  longitude: string;
  timezone?: string;
  timeZoneId?: string;
  locationName?: string;
  useTrueSolarTime?: boolean;
}

export interface AstrolabeGenerationSource {
  /** 经过类型、范围与空白规范化的原始出生输入；全部派生盘面必须由此重算。 */
  input: AstrolabeBirthInput;
  /** 生成结果的非负毫秒时间戳。 */
  timestamp: number;
}

export interface AstrolabePoint {
  name: string;
  label: string;
  longitude: number;
  sign: string;
  degree: number;
  minute: number;
  house: number;
  formatted: string;
  retrograde?: boolean;
}

export interface AstrolabeAspect {
  body1: string;
  body2: string;
  type: string;
  symbol: string;
  /** 相位类型的标准精确角。旧结果可能缺少。 */
  exactAngle?: number;
  /** 两计算点黄经的实际最小夹角。旧结果可能缺少。 */
  actualAngle?: number;
  orb: number;
  /** 本次相位筛选采用的容许度。旧结果可能缺少。 */
  allowedOrb?: number;
  /** 是否为跨星座相位。旧结果可能缺少。 */
  isOutOfSign?: boolean;
  source?: string;
  applying: boolean | null;
}

export interface AstrolabeAspectCalculation {
  selectedPointNames: string[];
  aspectDefinitions: Array<{
    type: string;
    symbol: string;
    exactAngle: number;
    allowedOrb: number;
  }>;
  evaluatedPairCount: number;
  matchedAspectCount: number;
  enumeration: '完整穷举';
}

export interface AstrolabeData {
  /** 星盘可信来源；公开分析、提示词和辅助入口只允许从这里重建。 */
  generation: AstrolabeGenerationSource;
  /** 星体、四轴、相位、反证、计算链与解释限制。 */
  evidenceAnalysis?: import('../divination/astrolabe-evidence').AstrolabeEvidenceAnalysis;
  birth: {
    name: string;
    gender: AlmanacParticipantGender;
    dateTime: string;
    location: string;
    timezone: number;
    timeZoneId?: string;
    timezoneStatus?: 'unique' | 'ambiguous';
    timezoneDiagnostics?: string[];
    timezoneEvidence?: HistoricalTimezoneEvidence;
    standardDateTime?: string;
    trueSolarDateTime?: string;
    trueSolarEvidence?: TrueSolarTimeEvidenceFields;
    isTrueSolarTime?: boolean;
  };
  planets: AstrolabePoint[];
  angles: AstrolabePoint[];
  houses: AstrolabePoint[];
  aspects: AstrolabeAspect[];
  /** 当前本命相位所用点位、相位定义与完整穷举数量。旧结果可能缺少。 */
  aspectCalculation?: AstrolabeAspectCalculation;
  solarIllumination?: SolarIlluminationEvidence;
  summary: {
    elements: Record<string, string[]>;
    modalities: Record<string, string[]>;
    retrograde: string[];
    patterns: string[];
  };
  timestamp: number;
}

export type AstrolabeSynastryAspectType = '合相' | '六合' | '刑相' | '拱相' | '冲相';

export interface AstrolabeSynastryResolvedOptions {
  /** 实际参与双盘穷举的内部点位名，顺序固定并随来源保存。 */
  pointNames: string[];
  /** 五种主要相位实际采用的完整容许度。 */
  aspectOrbs: Record<AstrolabeSynastryAspectType, number>;
  includeHouseOverlays: boolean;
}

export interface AstrolabeSynastryGenerationSource {
  chart1: AstrolabeGenerationSource;
  chart2: AstrolabeGenerationSource;
  options: AstrolabeSynastryResolvedOptions;
  timestamp: number;
}

export interface AstrolabeSynastryAspect {
  key: string;
  status: '已命中';
  person1: string;
  person2: string;
  point1Name: string;
  point2Name: string;
  point1: string;
  point2: string;
  type: AstrolabeSynastryAspectType;
  symbol: string;
  exactAngle: number;
  actualAngle: number;
  orb: number;
  allowedOrb: number;
  source: string;
  sourcePointKey: string;
  targetPointKey: string;
  calculationStepKey: 'astrolabe:synastry:calculation:aspect-filter';
  promptText: string;
  sources: string[];
  limitation: '跨盘相位只证明双方计算点黄经最小夹角进入所设相位角与容许度范围；不等于现实关系好坏、匹配程度、事件结果或发生概率';
}

export interface AstrolabeHouseOverlay {
  key: string;
  status: '已定位';
  ownerPerson: 'person1' | 'person2';
  visitorPerson: 'person1' | 'person2';
  owner: string;
  visitor: string;
  pointName: string;
  point: string;
  house: number;
  longitude: number;
  houseStart: number;
  houseEnd: number;
  ownerChartKey: string;
  visitorPointKey: string;
  calculationStepKey: 'astrolabe:synastry:calculation:house-overlays';
  promptText: string;
  sources: string[];
  limitation: '跨盘落宫只证明访客计算点黄经位于宫主本命盘某一宫头区间；不证明现实事件、关系角色、他人意图、匹配程度或固定应期';
}

export interface AstrolabeSynastryCalculationStep {
  key: string;
  stage:
    | '双盘输入校验'
    | '计算点筛选'
    | '跨盘角距计算'
    | '相位容许度筛选'
    | '宫头区间校验'
    | '跨盘落宫定位'
    | '证据汇总';
  status: '已计算';
  inputs: Record<string, string | number | boolean | string[]>;
  result: Record<string, string | number | boolean | string[]>;
  dependsOnStepKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '计算步骤只证明双方本命计算点、黄经、容许度与宫头区间经过固定几何规则形成当前相位和落宫事实，不证明现实关系、匹配程度、事件概率或固定应期';
}

export interface AstrolabeSynastryCounterEvidenceFact {
  key: string;
  type: '主要相位覆盖' | '跨盘落宫覆盖' | '静态应期边界';
  status: '有可用证据' | '未命中' | '已关闭' | '资料不足' | '固有限制';
  ownerFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '反证事实只记录主要相位、跨盘落宫与静态应期的覆盖情况；未命中不等于关系有利或不利，命中也不证明现实结果';
}

export interface AstrolabeSynastrySummaryFact {
  key: 'astrolabe:synastry:evidence-summary';
  status: '相位与落宫均有证据' | '仅见相位证据' | '仅见落宫证据' | '未见已列交叉事实';
  factKeys: string[];
  selectedPointCount1: number;
  selectedPointCount2: number;
  evaluatedPairCount: number;
  matchedAspectCount: number;
  returnedAspectCount: number;
  houseOverlayCount: number;
  aspectTypeCounts: Partial<Record<AstrolabeSynastryAspectType, number>>;
  promptText: string;
  sources: string[];
  limitation: '双盘证据汇总只统计几何相位、容许度筛选与落宫定位事实，不得按数量生成匹配分、成功率、关系概率、吉凶结论或唯一应期';
}

export interface AstrolabeSynastryLimitationFact {
  key: string;
  type: '相位几何边界' | '容许度口径边界' | '落宫资料边界' | '静态应期边界' | '高风险输出边界';
  status: '适用';
  ownerFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '限制事实用于约束跨盘相位与落宫能够支持的解释范围，不得被反向当作现实关系结果、他人意图、吉凶概率或保证有效建议的证据';
}

export interface AstrolabeSynastryData {
  /** 双方原始出生来源、完整计算参数与生成时间；全部跨盘事实必须由此重算。 */
  generation: AstrolabeSynastryGenerationSource;
  key: 'astrolabe:synastry:evidence';
  status: '已计算';
  people: [string, string];
  calculationSteps: AstrolabeSynastryCalculationStep[];
  calculationChain: string[];
  aspects: AstrolabeSynastryAspect[];
  houseOverlays: AstrolabeHouseOverlay[];
  summary: {
    totalAspects: number;
    houseOverlayCount: number;
  };
  counterEvidence: string[];
  counterEvidenceFacts: AstrolabeSynastryCounterEvidenceFact[];
  summaryFact: AstrolabeSynastrySummaryFact;
  limitations: string[];
  limitationFacts: AstrolabeSynastryLimitationFact[];
  evidence: import('../prompt-evidence/types').PromptEvidenceBundle;
  promptText: string;
  methodology: {
    aspectAngles: Record<AstrolabeSynastryAspectType, number>;
    defaultOrbs: Record<AstrolabeSynastryAspectType, number>;
    notes: string[];
  };
  timestamp: number;
}

export type TaiyiScope = 'year' | 'month' | 'day' | 'hour';

export interface TaiyiModelInfo {
  id: string;
  name: string;
  supportedScopes: TaiyiScope[];
  precision: string;
  sources: { title: string; url: string; evidence: string }[];
}

export interface TaiyiResult {
  scope: TaiyiScope;
  /** 可信重建所需的原始公历年份；其余盘面字段不得用于反推年份。 */
  year: number;
  ganZhi: string;
  dateTime: string;
  accumulatedValue: number;
  accumulatedLabel: '积年' | '积月' | '积日' | '积时';
  /** @deprecated 年家兼容字段；其他计式与 accumulatedValue 相同。 */
  accumulatedYears: number;
  entryYears: number;
  /** @deprecated 360 周期内的 72 数段序号，不等同于已经统一版本口径的“元”。 */
  yuan: number;
  /** @deprecated 360 周期内的 60 数段序号，不等同于已经统一版本口径的“纪”。 */
  ji: number;
  yinYang: '阳遁' | '阴遁';
  bureau: number;
  taiyiPosition: string;
  taiyiPalace: number;
  taiyiGua: string;
  taiyiDir: string;
  wenChangPosition: string;
  wenChangPalace: number;
  shiJiPosition: string;
  shiJiPalace: number;
  jiShenPosition: string;
  jiShenPalace: number;
  lordCount: number;
  guestCount: number;
  setCount: number;
  lordGeneral: number;
  lordAssistant: number;
  guestGeneral: number;
  guestAssistant: number;
  setGeneral: number;
  setAssistant: number;
  sixteenGods: { branch: string; god: string }[];
  judgments: string[];
  model: TaiyiModelInfo;
  evidenceAnalysis: import('../taiyi/evidence').TaiyiEvidenceAnalysis;
  prompt: string;
}

export interface SsgwRitualThrow {
  result: '圣杯' | '笑杯' | '阴杯';
  firstFace?: '阳面' | '阴面';
  secondFace?: '阳面' | '阴面';
}

export interface SsgwRitual {
  throws: SsgwRitualThrow[];
  confirmed?: boolean;
  rejected?: boolean;
  reason?: string;
}

export interface SsgwData {
  meta?: CoreResultMeta;
  number: number;
  title: string;
  poem: string;
  story?: string;
  details?: { [key: string]: string };
  timestamp: number;
  ganzhi: BaseGanZhi;
  draw?: {
    method?: 'random' | 'manual';
    poolSize: number;
    selectedIndex: number | null;
    selectedNumber: number;
  };
  ritual?: SsgwRitual;
  evidenceAnalysis?: import('../divination/ssgw-evidence').SsgwEvidenceAnalysis;
}

export type DivinationData =
  | LiuyaoData
  | MeihuaData
  | XiaoliurenData
  | JinkoujueData
  | QimenData
  | LiurenData
  | TarotData
  | SsgwData
  | AlmanacData
  | LenormandData
  | AstrolabeData
  | TaiyiResult;

export interface SupplementaryInfo {
  gender?: '男' | '女';
  birthYear?: number;
  userSupplement?: string;
  currentSituation?: string;
  currentState?: string;
  knownFacts?: string;
  desiredOutcome?: string;
  constraints?: string;
  interpretationStyle?: '入门' | '专业';
  outputLength?: '精简' | '详细' | '超详细';
  dayPillar?: {
    heavenlyStem: string;
    earthlyBranch: string;
  };
  meihuaSettings?: MeihuaSettings;
}
