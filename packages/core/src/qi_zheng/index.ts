/**
 * @file 七政四余（Qizheng Siyu / 果老星宗）
 * @description 中国占星：日、月、五星为七政；罗睺、计都、月孛、紫炁为四余。
 * 当前可用盘面采用可复算的现代天文位置与目标日期距星边界：
 *   - 宫支映射：戌白羊、酉金牛、申双子、未巨蟹、午狮子、巳双女、辰天秤、卯天蝎、
 *     寅人马、丑磨羯、子宝瓶、亥双鱼；热带黄道序号与子起十二支序号分开保存。
 *   - 安命宫：「以生时，加太阳宫，即从生时顺数见卯所临之宫，即为命宫。」（逢卯安命）
 *   - 安身宫：采用《五行精纪》《灵台经》明确起例，以太阴所在宫为身宫。
 *   - 安十二宫：自命宫逆数（命、财帛、兄弟、田宅、男女、奴仆、妻妾、疾厄、迁移、官禄、福德、相貌）。
 *   - 安命主：寅亥木、卯戌火、辰酉金、巳申水、子丑土、午日、未月。
 *   - 二十八宿按明清修订距星目录，以 J2000/ICRS 坐标、自行和目标日期真黄道变换求边界。
 *   - 庙旺：原典条件未闭合，当前只登记未采用边界。
 *   - 吊照：固定容许度缺少可靠统一依据，当前完整提供星对几何而不自动判定。
 *   - 传统神煞起例：只在农历年干支与立春年柱一致时，按生年干列天乙、玉堂，按生年支列驿马、
 *     华盖、劫煞、咸池、孤辰、寡宿的目标支；不把目标支冒充盘面命中或吉凶结论。
 *
 * 紫炁采用单一《七政算内篇》古法均速模型：周积 10227.1792 日，日行三分五十七秒一四二九，
 * 历元按 PlanetCalendar 对《七政算内篇》至元十八年立元数据的现代复原值换算。
 * 罗计孛取月交点与真莉莉丝（celestine）。
 *
 * 七政、罗计孛与紫炁保留来源和精度分层；可复算不代表占星解释有效。
 */
import { calculateChart } from 'celestine';
import { SolarTime, TwentyEightStar } from 'tyme4ts';
import { daysInGregorianMonth } from '../calendar/date-validation';
import { getShichenFromClock } from '../calendar/dateUtils';
import { calculateTrueSolarTime } from '../calendar/true-solar-time';
import {
  buildAstronomicalTimeEvidence,
  type AstronomicalTimeEvidence,
} from '../calendar/astronomical-time';
import {
  calculateMoonPhaseEvidence,
  type MoonPhaseEvidence,
} from '../calendar/moon-phase-evidence';
import {
  calculateSolarIlluminationEvidence,
  type SolarIlluminationEvidence,
} from '../calendar/solar-illumination-evidence';
import { getBranchIndex, getStemIndex } from '../ganzhi';
import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';
import {
  calculateQizhengMansionBoundaries,
  longitudeToQizhengMansion,
  QIZHENG_MANSION_MODEL,
  QIZHENG_MANSION_STARS,
  type QizhengMansionBoundary,
} from './mansion-boundaries';

export {
  calculateQizhengMansionBoundaries,
  longitudeToQizhengMansion,
  QIZHENG_MANSION_MODEL,
  QIZHENG_MANSION_STARS,
} from './mansion-boundaries';
export type { QizhengMansionBoundary, QizhengMansionStar } from './mansion-boundaries';

/** 十二职宫，自命宫起依十二支逆布。 */
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
] as const;

/** 十二支宫序；所有 branchIndex、mingGong、shenGong 均采用子0至亥11。 */
export const QIZHENG_EARTHLY_BRANCHES = [
  '子',
  '丑',
  '寅',
  '卯',
  '辰',
  '巳',
  '午',
  '未',
  '申',
  '酉',
  '戌',
  '亥',
] as const;

/** 热带黄道十二星座序；0°白羊起，每30°一宫。 */
export const QIZHENG_TROPICAL_ZODIAC_SIGNS = [
  '白羊',
  '金牛',
  '双子',
  '巨蟹',
  '狮子',
  '双女',
  '天秤',
  '天蝎',
  '人马',
  '磨羯',
  '宝瓶',
  '双鱼',
] as const;

/** 《张果星宗·宫分所属》的热带黄道星座到十二支宫映射。 */
export const QIZHENG_TROPICAL_ZODIAC_BRANCHES = [
  '戌',
  '酉',
  '申',
  '未',
  '午',
  '巳',
  '辰',
  '卯',
  '寅',
  '丑',
  '子',
  '亥',
] as const;

/** 命主：十二宫序（子0…亥11）→ 主星 */
export const QIZHENG_MING_ZHU_BY_BRANCH: Readonly<Record<number, string>> = {
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

export interface QizhengStar {
  name: string;
  kind: '七政' | '四余';
  tropicalLongitude: number; // 回归黄经 0-360
  longitude: number; // 目标日期真黄经 0-360，用于距星宿界与星对几何
  xiu: string;
  sevenStar: string;
  xiuDegree: number;
  tropicalZodiacIndex: number; // 热带黄道序号：白羊0至双鱼11
  tropicalZodiac: (typeof QIZHENG_TROPICAL_ZODIAC_SIGNS)[number];
  branchIndex: number; // 十二支宫序：子0至亥11
  branch: (typeof QIZHENG_EARTHLY_BRANCHES)[number];
  /** @deprecated 请使用 branchIndex；兼容字段同为子0至亥11。 */
  signIndex: number;
  palace: string;
  retrograde: boolean;
  /** @deprecated 庙旺原典按具体宿度等条件立表，当前不自动判定。 */
  dignity?: never;
  sourceId: QizhengPositionSourceId;
  sourceLabel: string;
  precisionClass: '现代天文计算' | '传统均速模型';
}

/** @deprecated 固定容许度吊照模型已停用；请使用 QizhengPairGeometry。 */
export type QizhengAspect = never;

export interface QizhengPairGeometry {
  star1: string;
  star2: string;
  actualAngle: number;
  precisionClass: '同层现代天文' | '混合模型';
  source: string;
}

export interface QizhengGeometryCalculation {
  starCount: 11;
  starOrder: string[];
  expectedPairCount: 55;
  actualPairCount: number;
  enumeration: '全部无序星对';
  angleFormula: 'min(abs(longitude1-longitude2), 360-abs(longitude1-longitude2))';
  complete: boolean;
}

export interface QizhengTraditionalRuleAuditItem {
  status: '未采用' | '已校勘' | '已校勘起例';
  reason: string;
  retainedFacts: string[];
  sources: string[];
}

export interface QizhengTraditionalRuleAudit {
  chart: QizhengTraditionalRuleAuditItem;
  dignity: QizhengTraditionalRuleAuditItem;
  aspects: QizhengTraditionalRuleAuditItem;
  shensha: QizhengTraditionalRuleAuditItem;
}

export type QizhengTraditionalChartRuleId =
  'zodiac-branch-mapping' | 'ming-gong' | 'shen-gong' | 'twelve-palaces' | 'ming-zhu';

export interface QizhengTraditionalSourceExcerpt {
  title: string;
  url: string;
  section: string;
  quote: string;
}

export interface QizhengTraditionalChartRule {
  id: QizhengTraditionalChartRuleId;
  name: string;
  status: '已校勘';
  rule: string;
  sources: readonly QizhengTraditionalSourceExcerpt[];
  usage: string;
  limitation: string;
}

export interface QizhengTraditionalChartFact {
  key: string;
  id: QizhengTraditionalChartRuleId;
  name: string;
  status: '已计算';
  inputs: Record<string, string | number>;
  result: Record<string, string | number>;
  promptText: string;
  sources: string[];
  limitation: string;
}

export type QizhengShenshaRuleId =
  | 'tianyi-day-noble'
  | 'yutang-night-noble'
  | 'yima'
  | 'huagai'
  | 'jiesha'
  | 'xianchi'
  | 'guchen'
  | 'guasu';

export interface QizhengShenshaRule {
  id: QizhengShenshaRuleId;
  name: string;
  basis: '年干' | '年支';
  targetByBasis: Readonly<Record<string, string>>;
  sourceTitle: '《张果星宗》卷二·诸星起例';
  sourceUrl: string;
  sourceSection: string;
  sourceQuote: string;
  usage: string;
  limitation: string;
}

export interface QizhengTraditionalYearBasis {
  status: '年干支口径一致' | '年界口径分歧';
  traditionalDateTime: string;
  timeMode: '民用时间' | '真太阳时';
  lunarYearGanZhi: string;
  liChunYearGanZhi: string;
  adoptedYearGanZhi?: string;
  promptText: string;
  sources: string[];
  limitation: string;
}

export interface QizhengShenshaFact {
  key: string;
  id: QizhengShenshaRuleId;
  name: string;
  status: '已校勘起例';
  basis: '年干' | '年支';
  basisGanZhi: string;
  basisValue: string;
  targetBranch: string;
  sourceSection: string;
  sourceQuote: string;
  promptText: string;
  sources: string[];
  limitation: string;
}

export type QizhengPositionSourceId =
  'celestine-planets' | 'celestine-true-node' | 'celestine-true-lilith' | 'qizhengsuan-ziqi';

export interface QizhengPositionSource {
  id: QizhengPositionSourceId;
  objects: string[];
  provider: string;
  calculation: string;
  coordinate: string;
  precisionClass: '现代天文计算' | '传统均速模型';
  limitations: string[];
}

export interface QizhengCalculationContext {
  /** 传统宫位时间口径 */
  palaceTimeMode?: '民用时间' | '真太阳时混合口径';
  palaceTimeNote?: string;
  localDateTime: string;
  utcDateTime: string;
  timezone: number;
  latitude: number;
  longitude: number;
  locationSource: '用户提供' | '默认北京坐标' | '部分坐标使用默认值';
  timezoneSource: 'IANA历史时区' | '用户提供' | '默认东八区';
  standardMeridian?: number;
  standardMeridianSource?: '用户提供' | '固定时区换算';
  astronomicalTime: AstronomicalTimeEvidence;
  moonPhase: MoonPhaseEvidence;
  solarIllumination: SolarIlluminationEvidence;
  coordinatePipeline: string[];
}

export interface QizhengEvidenceAnalysis {
  key: 'qizheng:evidence';
  status: '已计算';
  calculationFact: QizhengCalculationFact;
  calculationSteps: QizhengCalculationStep[];
  calculationChain: string[];
  positionSourceFacts: QizhengPositionSourceFact[];
  starFacts: QizhengStarFact[];
  pairGeometryFacts: QizhengPairGeometryFact[];
  traditionalChartFacts: QizhengTraditionalChartFact[];
  traditionalYearBasis: QizhengTraditionalYearBasis;
  shenshaFacts: QizhengShenshaFact[];
  primaryFacts: string[];
  supportingFacts: string[];
  counterEvidence: string[];
  counterEvidenceFacts: QizhengCounterEvidenceFact[];
  counterSummaryFact: QizhengCounterSummaryFact;
  limitations: string[];
  limitationFacts: QizhengLimitationFact[];
  summaryFact: QizhengSummaryFact;
  evidence: PromptEvidenceBundle;
  promptText: string;
  methodology: string[];
}

export interface QizhengCalculationStep {
  key: string;
  stage:
    | '民用时间转UTC'
    | '天文时间尺度'
    | '现代位置计算'
    | '紫炁古法计算'
    | '距星宿界换算'
    | '宿度与落宫'
    | '传统命身宫与十二职宫'
    | '星对几何穷举'
    | '传统年界核验';
  status: '已计算';
  inputs: Record<string, string | number | boolean>;
  result: Record<string, string | number | boolean>;
  dependsOnStepKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '七政四余计算步骤只记录民用时间、天文时间尺度、位置模型、距星宿界、宿度宫支、传统命身十二职宫、星对几何穷举与传统年界核验的形成过程；不得把步骤完整度解释为观测级精度、占星有效性、现实吉凶或事件概率';
}

export interface QizhengCalculationFact {
  key: 'calculation:qizheng:chart';
  status: '输入明确' | '含默认值';
  defaults: string[];
  context: {
    localDateTime: string;
    utcDateTime: string;
    timezone: number;
    latitude: number;
    longitude: number;
    locationSource: QizhengCalculationContext['locationSource'];
    timezoneSource: QizhengCalculationContext['timezoneSource'];
  };
  steps: QizhengCalculationStep[];
  promptText: string;
  sources: string[];
  limitation: '计算链只证明民用时间、时区、地点、天文时间尺度、位置模型和坐标换算如何形成当前七政四余盘；默认地点、近似时间尺度与传统均速模型不得提升为真实出生地或观测级精度，也不证明现实事件或吉凶结果';
}

export interface QizhengPositionSourceFact {
  key: string;
  sourceId: QizhengPositionSourceId;
  status: '已采用';
  objects: string[];
  provider: string;
  calculation: string;
  coordinate: string;
  precisionClass: QizhengPositionSource['precisionClass'];
  adoptedSources: string[];
  limitations: string[];
  promptLimitations: string[];
  promptText: string;
  limitation: '位置来源事实只说明各星体采用的提供方、模型、坐标和精度层级；来源可追溯不等于结果达到观测级精度，也不证明占星解释、现实事件或吉凶结论';
}

export interface QizhengStarFact {
  key: string;
  name: string;
  kind: QizhengStar['kind'];
  tropicalLongitude: number;
  siderealLongitude: number;
  xiu: string;
  sevenStar: string;
  xiuDegree: number;
  tropicalZodiacIndex: number;
  tropicalZodiac: QizhengStar['tropicalZodiac'];
  branchIndex: number;
  branch: QizhengStar['branch'];
  signIndex: number;
  palace: string;
  retrograde: boolean;
  sourceId: QizhengPositionSourceId;
  sourceLabel: string;
  precisionClass: QizhengStar['precisionClass'];
  promptText: string;
  sources: string[];
  limitation: '逐星位置是目标日期黄经、距星宿度与落宫的计算事实；现代天文计算和传统均速模型必须分层使用，不单独证明人格、现实事件、吉凶或应期';
}

export interface QizhengPairGeometryFact {
  key: string;
  star1: string;
  star2: string;
  actualAngle: number;
  precisionClass: QizhengPairGeometry['precisionClass'];
  promptText: string;
  sources: string[];
  limitation: '星对几何只描述两星目标日期黄经的最小夹角；混合模型不得提升为现代天文同精度证据，夹角本身不等于传统吊照命中，也不代表吉凶、事件概率或必然结果';
}

export interface QizhengCounterEvidenceFact {
  key: string;
  type: '输入完整性' | '位置精度分层' | '星对几何覆盖' | '传统年界口径';
  status:
    | '输入明确'
    | '含默认值'
    | '同层现代天文'
    | '混合模型'
    | '完整穷举'
    | '有缺口'
    | '年干支口径一致'
    | '年界口径分歧';
  ownerFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '反证事实只记录七政四余输入默认值、位置精度分层、55组星对覆盖与传统年界口径是否一致；默认值、混合模型、年界分歧或资料缺口不直接等于现实不利，有资料也不证明吉凶结果';
}

export interface QizhengCounterSummaryFact {
  key: 'qizheng:counter-summary';
  status: '存在需保留反证' | '未见额外反证';
  factKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '反证汇总只用于防止忽略默认输入、混合精度、星对几何缺口和传统年界分歧；不得据反证数量生成吉凶总分、可信度、事件概率或精度评分';
}

export interface QizhengLimitationFact {
  key: string;
  type:
    | '输入默认边界'
    | '时间尺度边界'
    | '位置来源边界'
    | '混合精度边界'
    | '传统规则边界'
    | '月相光照边界'
    | '高风险输出边界';
  status: '适用';
  ownerFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '限制事实用于约束七政四余输入、时间尺度、位置来源、混合模型、传统规则、月相和光照资料可以支持的解释范围，不得被反向当作现实事件、吉凶或精度证据';
}

export interface QizhengSummaryFact {
  key: 'qizheng:evidence-summary';
  status: '可用事实链完整' | '可用事实链有缺口';
  factKeys: string[];
  positionSourceFactCount: number;
  starFactCount: number;
  pairGeometryFactCount: number;
  traditionalChartFactCount: number;
  shenshaFactCount: number;
  counterEvidenceCount: number;
  limitationFactCount: number;
  promptText: string;
  sources: string[];
  limitation: '七政四余证据汇总只统计输入、时间尺度、位置来源、逐星、星对几何、传统命身十二职宫、传统年界与神煞起例、月相光照、反证及限制覆盖；不得按数量生成吉凶等级、可信度、事件概率、观测精度或固定应期';
}

const STAR_FACT_LIMITATION =
  '逐星位置是目标日期黄经、距星宿度与落宫的计算事实；现代天文计算和传统均速模型必须分层使用，不单独证明人格、现实事件、吉凶或应期' as const;

const PAIR_GEOMETRY_FACT_LIMITATION =
  '星对几何只描述两星目标日期黄经的最小夹角；混合模型不得提升为现代天文同精度证据，夹角本身不等于传统吊照命中，也不代表吉凶、事件概率或必然结果' as const;
const CALCULATION_FACT_LIMITATION =
  '计算链只证明民用时间、时区、地点、天文时间尺度、位置模型和坐标换算如何形成当前七政四余盘；默认地点、近似时间尺度与传统均速模型不得提升为真实出生地或观测级精度，也不证明现实事件或吉凶结果' as const;
const POSITION_SOURCE_FACT_LIMITATION =
  '位置来源事实只说明各星体采用的提供方、模型、坐标和精度层级；来源可追溯不等于结果达到观测级精度，也不证明占星解释、现实事件或吉凶结论' as const;
const QIZHENG_CALCULATION_STEP_LIMITATION =
  '七政四余计算步骤只记录民用时间、天文时间尺度、位置模型、距星宿界、宿度宫支、传统命身十二职宫、星对几何穷举与传统年界核验的形成过程；不得把步骤完整度解释为观测级精度、占星有效性、现实吉凶或事件概率' as const;
const QIZHENG_COUNTER_FACT_LIMITATION =
  '反证事实只记录七政四余输入默认值、位置精度分层、55组星对覆盖与传统年界口径是否一致；默认值、混合模型、年界分歧或资料缺口不直接等于现实不利，有资料也不证明吉凶结果' as const;
const QIZHENG_COUNTER_SUMMARY_LIMITATION =
  '反证汇总只用于防止忽略默认输入、混合精度、星对几何缺口和传统年界分歧；不得据反证数量生成吉凶总分、可信度、事件概率或精度评分' as const;
const QIZHENG_LIMITATION_FACT_LIMITATION =
  '限制事实用于约束七政四余输入、时间尺度、位置来源、混合模型、传统规则、月相和光照资料可以支持的解释范围，不得被反向当作现实事件、吉凶或精度证据' as const;
const QIZHENG_SUMMARY_FACT_LIMITATION =
  '七政四余证据汇总只统计输入、时间尺度、位置来源、逐星、星对几何、传统命身十二职宫、传统年界与神煞起例、月相光照、反证及限制覆盖；不得按数量生成吉凶等级、可信度、事件概率、观测精度或固定应期' as const;

function conditionQizhengPortableText(text: string): string {
  return text
    .replace(/项目恒星黄经/g, '目标日期黄经')
    .replace(/项目岁差/g, '当前岁差')
    .replace(/本项目统一/g, '统一')
    .replace(/项目统一/g, '统一')
    .replace(/本项目调用依赖库结果/g, '位置计算调用依赖库结果')
    .replace(/本项目/g, '当前计算')
    .replace(/这是项目明确采用/g, '这是当前计算明确采用');
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
  timeZoneId?: string;
  /**
   * 真太阳时使用的当地标准经线（东经为正，西经为负）。
   * 使用 IANA 历史时区时必须明确提供，禁止把法定钟表偏移直接猜成标准经线。
   */
  standardMeridian?: number;
  /**
   * 可选：启用后用真太阳时校正传统命宫所用生时与可能跨日的传统年界；
   * 身宫直接取目标时刻太阴所在宫，不另受时辰分支影响；
   * 七政四余天体位置仍按现代星历与天文时间尺度计算。
   */
  useTrueSolarTime?: boolean;
}

export const QIZHENG_TRADITIONAL_CHART_DISABLED_MESSAGE =
  '七政四余传统盘已恢复；此常量仅为旧调用方兼容保留。';

export interface QizhengResult {
  stars: QizhengStar[];
  pairwiseAngles: QizhengPairGeometry[];
  geometryCalculation: QizhengGeometryCalculation;
  traditionalRuleAudit: QizhengTraditionalRuleAudit;
  /** @deprecated 固定容许度吊照缺少可靠统一依据，兼容字段恒为空。 */
  aspects: QizhengAspect[];
  mingGong: number;
  mingGongBranch: QizhengStar['branch'];
  shenGong: number;
  shenGongBranch: QizhengStar['branch'];
  mingZhu: string;
  twelvePalaces: {
    palace: (typeof TWELVE_PALACES)[number];
    branchIndex: number;
    branch: QizhengStar['branch'];
    /** @deprecated 请使用 branchIndex；兼容字段同为子0至亥11。 */
    signIndex: number;
  }[];
  traditionalChartRuleCatalog: readonly QizhengTraditionalChartRule[];
  traditionalChartFacts: QizhengTraditionalChartFact[];
  traditionalYearBasis: QizhengTraditionalYearBasis;
  shenshaRuleCatalog: readonly QizhengShenshaRule[];
  shenshaFacts: QizhengShenshaFact[];
  /** @deprecated 请使用 shenshaFacts；兼容字段只保留已校勘起例的名称与目标支。 */
  shensha: { name: string; value: string }[];
  ziqiModel: ZiqiModelInfo;
  ziqi: ZiqiPosition;
  calculationContext: QizhengCalculationContext;
  positionSources: QizhengPositionSource[];
  mansionBoundaries: QizhengMansionBoundary[];
  mansionModel: typeof QIZHENG_MANSION_MODEL;
  evidenceAnalysis: QizhengEvidenceAnalysis;
  prompt: string;
}

function buildQizhengPairwiseAngles(stars: QizhengStar[]): QizhengPairGeometry[] {
  const pairs: QizhengPairGeometry[] = [];
  for (let first = 0; first < stars.length - 1; first += 1) {
    for (let second = first + 1; second < stars.length; second += 1) {
      const raw = Math.abs(stars[first].longitude - stars[second].longitude);
      const actualAngle = raw > 180 ? 360 - raw : raw;
      pairs.push({
        star1: stars[first].name,
        star2: stars[second].name,
        actualAngle: Number(actualAngle.toFixed(4)),
        precisionClass:
          stars[first].precisionClass === '现代天文计算' &&
          stars[second].precisionClass === '现代天文计算'
            ? '同层现代天文'
            : '混合模型',
        source: `${stars[first].name}与${stars[second].name}目标日期黄经最小夹角`,
      });
    }
  }
  return pairs;
}

export const QIZHENG_TRADITIONAL_RULE_AUDIT: QizhengTraditionalRuleAudit = {
  chart: {
    status: '已校勘',
    reason:
      '黄道宫支、安命宫、安身宫、十二职宫逆布与命主均按可核对旧籍原文分别建档；热带黄道序号与子起十二支宫序分开计算，身宫采用旧籍明确的太阴所在宫起例',
    retainedFacts: [
      '十二星座对应十二支宫',
      '生时加太阳宫顺数遇卯安命',
      '太阴所在宫安身',
      '十二职宫自命宫逆布',
      '命宫支对应命主星',
    ],
    sources: [
      '《张果星宗》宫分所属、安命度法、十二宫与宫主条文',
      '《五行精纪》起身宫例',
      '《灵台经》身宫条文',
    ],
  },
  dignity: {
    status: '未采用',
    reason:
      '《张果星宗》所见星辰入垣、升殿、庙旺与喜乐资料含具体宿度区间，不能据缺少逐项原典对应的十二宫简表自动判定庙、旺、乐、陷或把其余位置统一判为平',
    retainedFacts: ['十一星目标日期黄经', '二十八宿与宿度', '十二宫落点'],
    sources: ['《张果星宗》星辰入垣图、升殿图、庙旺图、喜乐图目录及宿度条文'],
  },
  aspects: {
    status: '未采用',
    reason:
      '传统文献可见同宫、三方、正照、对照等结构，但未找到支持统一使用0/60/90/120/180度及8/4/6/6/8度容许度的可靠原典，因此不自动判定吊照命中',
    retainedFacts: ['十一星目标日期黄经', '全部55组无序星对的实际最小夹角', '逐星位置精度层级'],
    sources: ['《张果星宗》同宫、合弔相关条文', '《星学大成》三方对照相关条文'],
  },
  shensha: {
    status: '已校勘起例',
    reason:
      '《张果星宗》卷二明确“诸星起例皆从年干为主”，天乙与玉堂分别为昼贵、夜贵；马前诸杀及地支吉凶星例按生年支列驿马、华盖、劫煞、咸池、孤辰、寡宿。当前只采用原典目标支，不自动声称盘面命中或吉凶成立',
    retainedFacts: [
      '天乙昼贵与玉堂夜贵的生年干目标支',
      '驿马、华盖、劫煞、咸池、孤辰、寡宿的生年支目标支',
      '农历年干支与立春年柱的年界口径核验',
    ],
    sources: [
      '《张果星宗》卷二·诸星起例、天乙、玉堂、马前诸杀例、地支吉凶星例三',
      '维基文库《钦定古今图书集成·艺术典》第568卷所收《张果星宗》正文',
    ],
  },
};

const QIZHENG_CHART_SOURCE_URL =
  'https://zh.wikisource.org/wiki/欽定古今圖書集成/博物彙編/藝術典/第567卷';
const QIZHENG_WUXING_JINGJI_SOURCE_URL = 'https://zh.wikisource.org/wiki/五行精紀';
const QIZHENG_LINGTAI_JING_SOURCE_URL = 'https://zh.wikisource.org/wiki/靈臺經';
const QIZHENG_TRADITIONAL_CHART_LIMITATION =
  '这里只计算旧籍条文能够唯一复算的宫支、命宫、身宫、十二职宫和命主位置；这些排盘事实不自动生成庙旺、强弱、性格、现实事件、吉凶或应期结论';

export const QIZHENG_TRADITIONAL_CHART_RULE_CATALOG = [
  {
    id: 'zodiac-branch-mapping',
    name: '黄道星座对应十二支宫',
    status: '已校勘',
    rule: '白羊戌、金牛酉、双子申、巨蟹未、狮子午、双女巳、天秤辰、天蝎卯、人马寅、磨羯丑、宝瓶子、双鱼亥。',
    sources: [
      {
        title: '《张果星宗》',
        url: QIZHENG_CHART_SOURCE_URL,
        section: '宫分所属',
        quote:
          '子土宝瓶，丑土磨羯，寅木人马，卯火天蝎，辰金天秤，巳水双女，午日狮子，未月巨蟹，申水双子，酉金金牛，戌火白羊，亥木双鱼。',
      },
    ],
    usage:
      '先按回归黄经每30度确定热带黄道星座，再查询对应十二支宫；不得把白羊序号0直接当成子支序0。',
    limitation: QIZHENG_TRADITIONAL_CHART_LIMITATION,
  },
  {
    id: 'ming-gong',
    name: '安命宫',
    status: '已校勘',
    rule: '以生时加太阳所在十二支宫，顺数遇卯所临之宫为命宫。',
    sources: [
      {
        title: '《张果星宗》',
        url: QIZHENG_CHART_SOURCE_URL,
        section: '安命度法',
        quote:
          '以生时加太阳宫，顺数遇卯，即是命宫也。如太阳在子宫，酉时生人，以酉时加在子宫，顺数到午遇卯，即是命宫也。',
      },
    ],
    usage: '命宫支序＝太阳宫支序＋卯支序－生时支序，按十二支取模。',
    limitation: QIZHENG_TRADITIONAL_CHART_LIMITATION,
  },
  {
    id: 'shen-gong',
    name: '安身宫',
    status: '已校勘',
    rule: '太阴所在十二支宫即为身宫，不另以生时加减。',
    sources: [
      {
        title: '《五行精纪》',
        url: QIZHENG_WUXING_JINGJI_SOURCE_URL,
        section: '起身宫例',
        quote: '凡起身宫，看当生太阴在何宫，太阴坐宫处，即身宫也。',
      },
      {
        title: '《灵台经》',
        url: QIZHENG_LINGTAI_JING_SOURCE_URL,
        section: '身宫',
        quote: '但以历等，先定太阴所在之宫，便为身宫。',
      },
    ],
    usage: '以目标时刻太阴黄经换算出的十二支宫作为身宫；生时只参与命宫计算。',
    limitation:
      '后世可见其他安身宫法，但旧加时公式未找到足以覆盖上述旧籍明文的固定版本依据，当前不采用；身宫位置本身仍不得扩张为吉凶或事件结论。',
  },
  {
    id: 'twelve-palaces',
    name: '十二职宫逆布',
    status: '已校勘',
    rule: '命宫、财帛、兄弟、田宅、男女、奴仆、妻妾、疾厄、迁移、官禄、福德、相貌，自命宫起沿十二支逆数轮转。',
    sources: [
      {
        title: '《张果星宗》',
        url: QIZHENG_CHART_SOURCE_URL,
        section: '定十二宫',
        quote:
          '凡定十二宫者，逆数轮转。如命宫在寅，财帛在丑，兄弟在子，田宅在亥，男女在戌，奴仆在酉，妻妾在申，疾厄在未，余同此。',
      },
    ],
    usage: '第i个职宫的宫支序＝命宫支序－i，按十二支取模。',
    limitation: QIZHENG_TRADITIONAL_CHART_LIMITATION,
  },
  {
    id: 'ming-zhu',
    name: '安命主',
    status: '已校勘',
    rule: '子丑宫土、寅亥宫木、卯戌宫火、辰酉宫金、巳申宫水、午宫日、未宫月。',
    sources: [
      {
        title: '《张果星宗》',
        url: QIZHENG_CHART_SOURCE_URL,
        section: '宫主',
        quote: '宫主者，谓子丑宫土，寅亥宫木，卯戌宫火，辰酉宫金，巳申宫水，午宫日，未宫月。',
      },
    ],
    usage: '按命宫所在十二支查询命主星。',
    limitation: QIZHENG_TRADITIONAL_CHART_LIMITATION,
  },
] as const satisfies readonly QizhengTraditionalChartRule[];

const QIZHENG_SHENSHA_SOURCE_URL =
  'https://zh.wikisource.org/wiki/欽定古今圖書集成/博物彙編/藝術典/第568卷';
const QIZHENG_SHENSHA_LIMITATION =
  '这里只列《张果星宗》按生年干或生年支得到的起例目标支；目标支不等于已经落入命身、夫妻等宫位，也不等于某颗星曜已经命中，不得据此直接生成吉凶、事件、疾病、婚姻或应期结论';

export const QIZHENG_SHENSHA_RULE_CATALOG = [
  {
    id: 'tianyi-day-noble',
    name: '天乙（昼贵）',
    basis: '年干',
    targetByBasis: {
      甲: '未',
      乙: '申',
      丙: '酉',
      丁: '亥',
      戊: '丑',
      己: '子',
      庚: '丑',
      辛: '寅',
      壬: '卯',
      癸: '巳',
    },
    sourceTitle: '《张果星宗》卷二·诸星起例',
    sourceUrl: QIZHENG_SHENSHA_SOURCE_URL,
    sourceSection: '天乙、天干吉凶星例',
    sourceQuote:
      '天乙贵人甲见未，戊庚在丑乙申位；己子丙酉辛居寅，丁亥壬兔巳逢癸。天乙贵人者，即昼贵人也。',
    usage: '按生年干查询天乙昼贵目标支；不与玉堂夜贵合并。',
    limitation: QIZHENG_SHENSHA_LIMITATION,
  },
  {
    id: 'yutang-night-noble',
    name: '玉堂（夜贵）',
    basis: '年干',
    targetByBasis: {
      甲: '丑',
      乙: '子',
      丙: '亥',
      丁: '酉',
      戊: '未',
      己: '申',
      庚: '未',
      辛: '午',
      壬: '巳',
      癸: '卯',
    },
    sourceTitle: '《张果星宗》卷二·诸星起例',
    sourceUrl: QIZHENG_SHENSHA_SOURCE_URL,
    sourceSection: '玉堂、天干吉凶星例',
    sourceQuote:
      '玉堂贵人甲见丑，戊庚在未，丁居酉；丙亥乙子己逢申，壬巳癸卯辛午守。玉堂贵人者，即夜贵人也。',
    usage: '按生年干查询玉堂夜贵目标支；不与天乙昼贵合并。',
    limitation: QIZHENG_SHENSHA_LIMITATION,
  },
  {
    id: 'yima',
    name: '驿马',
    basis: '年支',
    targetByBasis: {
      子: '寅',
      丑: '亥',
      寅: '申',
      卯: '巳',
      辰: '寅',
      巳: '亥',
      午: '申',
      未: '巳',
      申: '寅',
      酉: '亥',
      戌: '申',
      亥: '巳',
    },
    sourceTitle: '《张果星宗》卷二·诸星起例',
    sourceUrl: QIZHENG_SHENSHA_SOURCE_URL,
    sourceSection: '马前诸杀例',
    sourceQuote:
      '马前诸杀例，以年支起驿马取；申子辰人马居寅，寅午戌人马居申，巳酉丑人马在亥，亥卯未人马在巳。',
    usage: '按生年支三合组查询马前驿马目标支；不是“天马地驿”星曜变换算法。',
    limitation: QIZHENG_SHENSHA_LIMITATION,
  },
  {
    id: 'huagai',
    name: '华盖',
    basis: '年支',
    targetByBasis: {
      子: '辰',
      丑: '丑',
      寅: '戌',
      卯: '未',
      辰: '辰',
      巳: '丑',
      午: '戌',
      未: '未',
      申: '辰',
      酉: '丑',
      戌: '戌',
      亥: '未',
    },
    sourceTitle: '《张果星宗》卷二·诸星起例',
    sourceUrl: QIZHENG_SHENSHA_SOURCE_URL,
    sourceSection: '马前诸杀例',
    sourceQuote:
      '马前诸杀例以年支起驿马横列，华盖为驿马后第二位：申子辰见辰、寅午戌见戌、巳酉丑见丑、亥卯未见未。',
    usage: '按生年支查询马前诸杀表中的华盖目标支。',
    limitation: QIZHENG_SHENSHA_LIMITATION,
  },
  {
    id: 'jiesha',
    name: '劫煞',
    basis: '年支',
    targetByBasis: {
      子: '巳',
      丑: '寅',
      寅: '亥',
      卯: '申',
      辰: '巳',
      巳: '寅',
      午: '亥',
      未: '申',
      申: '巳',
      酉: '寅',
      戌: '亥',
      亥: '申',
    },
    sourceTitle: '《张果星宗》卷二·诸星起例',
    sourceUrl: QIZHENG_SHENSHA_SOURCE_URL,
    sourceSection: '劫杀、地支吉凶星例三',
    sourceQuote: '申子辰巳上化为尘，寅午戌亥上不须说，巳酉丑寅上休开口，亥卯未申上勿遭值。',
    usage: '按生年支查询劫杀目标支。',
    limitation: QIZHENG_SHENSHA_LIMITATION,
  },
  {
    id: 'xianchi',
    name: '咸池',
    basis: '年支',
    targetByBasis: {
      子: '酉',
      丑: '午',
      寅: '卯',
      卯: '子',
      辰: '酉',
      巳: '午',
      午: '卯',
      未: '子',
      申: '酉',
      酉: '午',
      戌: '卯',
      亥: '子',
    },
    sourceTitle: '《张果星宗》卷二·诸星起例',
    sourceUrl: QIZHENG_SHENSHA_SOURCE_URL,
    sourceSection: '咸池、地支吉凶星例三',
    sourceQuote: '申子辰鸡叫乱人伦，寅午戌兔从茅里出；巳酉丑跃马南方走，亥卯未鼠子当头忌。',
    usage: '按生年支查询咸池目标支。',
    limitation: QIZHENG_SHENSHA_LIMITATION,
  },
  {
    id: 'guchen',
    name: '孤辰',
    basis: '年支',
    targetByBasis: {
      子: '寅',
      丑: '寅',
      寅: '巳',
      卯: '巳',
      辰: '巳',
      巳: '申',
      午: '申',
      未: '申',
      申: '亥',
      酉: '亥',
      戌: '亥',
      亥: '寅',
    },
    sourceTitle: '《张果星宗》卷二·诸星起例',
    sourceUrl: QIZHENG_SHENSHA_SOURCE_URL,
    sourceSection: '孤辰、地支吉凶星例三',
    sourceQuote: '寅卯辰人怕巳丑，巳午未人畏申辰，申酉戌人嫌亥未，亥子丑人寅戌嗔。',
    usage: '每组三会年支中，歌诀前一支为孤辰目标支。',
    limitation: QIZHENG_SHENSHA_LIMITATION,
  },
  {
    id: 'guasu',
    name: '寡宿',
    basis: '年支',
    targetByBasis: {
      子: '戌',
      丑: '戌',
      寅: '丑',
      卯: '丑',
      辰: '丑',
      巳: '辰',
      午: '辰',
      未: '辰',
      申: '未',
      酉: '未',
      戌: '未',
      亥: '戌',
    },
    sourceTitle: '《张果星宗》卷二·诸星起例',
    sourceUrl: QIZHENG_SHENSHA_SOURCE_URL,
    sourceSection: '寡宿、地支吉凶星例三',
    sourceQuote: '寅卯辰人怕巳丑，巳午未人畏申辰，申酉戌人嫌亥未，亥子丑人寅戌嗔。',
    usage: '每组三会年支中，歌诀后一支为寡宿目标支。',
    limitation: QIZHENG_SHENSHA_LIMITATION,
  },
] as const satisfies readonly QizhengShenshaRule[];

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
  coordinate: '先算传统均速回归黄经，再与同日二十八宿距星真黄经边界比较得到宿度',
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
      evidence: '沿用MOIRA的1975年历元，仅作为同周期实现的交叉检索记录，不作为当前模型参数来源',
    },
  ],
};

export const QIZHENG_POSITION_SOURCES: QizhengPositionSource[] = [
  {
    id: 'celestine-planets',
    objects: ['太阳', '太阴', '辰星(水)', '太白(金)', '荧惑(火)', '岁星(木)', '镇星(土)'],
    provider: 'celestine.calculateChart',
    calculation: '按输入民用时间、时区和地点计算七政回归黄经及逆行状态',
    coordinate: '目标日期回归黄经；与同日二十八宿距星真黄经边界比较得到宿度',
    precisionClass: '现代天文计算',
    limitations: [
      '位置取自上述计算来源，未另用第二套底层星历独立复算',
      '不得仅凭页面显示小数位宣称达到观测级或JPL星历精度',
    ],
  },
  {
    id: 'celestine-true-node',
    objects: ['罗睺(火余)', '计都(土余)'],
    provider: 'celestine.calculateChart includeNodes=true',
    calculation: '罗睺取真北交点，计都取真南交点',
    coordinate: '目标日期回归黄经；与同日二十八宿距星真黄经边界比较得到宿度',
    precisionClass: '现代天文计算',
    limitations: ['这是当前计算明确采用的真交点口径，不与平均交点混用'],
  },
  {
    id: 'celestine-true-lilith',
    objects: ['月孛(水余)'],
    provider: 'celestine.calculateChart includeLilith=true',
    calculation: '月孛取真黑月莉莉丝位置',
    coordinate: '目标日期回归黄经；与同日二十八宿距星真黄经边界比较得到宿度',
    precisionClass: '现代天文计算',
    limitations: ['月孛存在平均远地点、真远地点等不同口径；当前计算只采用真莉莉丝口径'],
  },
  {
    id: 'qizhengsuan-ziqi',
    objects: ['紫炁(木余)'],
    provider: ZIQI_MODEL_INFO.name,
    calculation: ZIQI_MODEL_INFO.formula,
    coordinate: ZIQI_MODEL_INFO.coordinate,
    precisionClass: '传统均速模型',
    limitations: [ZIQI_MODEL_INFO.precision, '不可与现代行星星历位置视为同一精度等级'],
  },
];

function normalizeLongitude(value: number): number {
  return ((value % 360) + 360) % 360;
}

export interface QizhengZodiacBranchPosition {
  normalizedLongitude: number;
  tropicalZodiacIndex: number;
  tropicalZodiac: QizhengStar['tropicalZodiac'];
  branchIndex: number;
  branch: QizhengStar['branch'];
}

function assertQizhengBranchIndex(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value >= QIZHENG_EARTHLY_BRANCHES.length) {
    throw new Error(`${label}必须是子0至亥11的十二支宫序。`);
  }
}

/** 将回归黄经换算为热带黄道星座及《张果星宗》十二支宫。 */
export function longitudeToQizhengBranch(longitude: number): QizhengZodiacBranchPosition {
  if (!Number.isFinite(longitude)) {
    throw new Error('七政四余宫支换算需要有限黄经。');
  }
  const normalizedLongitude = normalizeLongitude(longitude);
  const tropicalZodiacIndex = Math.floor(normalizedLongitude / 30) % 12;
  const tropicalZodiac = QIZHENG_TROPICAL_ZODIAC_SIGNS[tropicalZodiacIndex];
  const branch = QIZHENG_TROPICAL_ZODIAC_BRANCHES[tropicalZodiacIndex];
  const branchIndex = QIZHENG_EARTHLY_BRANCHES.indexOf(branch);
  if (branchIndex < 0) {
    throw new Error(`七政四余宫支目录缺失：${tropicalZodiac}。`);
  }
  return { normalizedLongitude, tropicalZodiacIndex, tropicalZodiac, branchIndex, branch };
}

/** 「以生时加太阳宫，顺数遇卯」的十二支宫序公式。 */
export function calculateQizhengMingGong(sunBranchIndex: number, hourBranchIndex: number): number {
  assertQizhengBranchIndex(sunBranchIndex, '太阳宫支序');
  assertQizhengBranchIndex(hourBranchIndex, '生时支序');
  const maoBranchIndex = QIZHENG_EARTHLY_BRANCHES.indexOf('卯');
  return (sunBranchIndex + maoBranchIndex - hourBranchIndex + 12) % 12;
}

/** 《五行精纪》《灵台经》起例：太阴所在十二支宫即为身宫。 */
export function calculateQizhengShenGong(moonBranchIndex: number): number {
  assertQizhengBranchIndex(moonBranchIndex, '太阴宫支序');
  return moonBranchIndex;
}

/** 自命宫起沿十二支逆数安十二职宫。 */
export function buildQizhengTwelvePalaces(mingGong: number): QizhengResult['twelvePalaces'] {
  assertQizhengBranchIndex(mingGong, '命宫支序');
  return TWELVE_PALACES.map((palace, index) => {
    const branchIndex = (mingGong - index + 12) % 12;
    return {
      palace,
      branchIndex,
      branch: QIZHENG_EARTHLY_BRANCHES[branchIndex],
      signIndex: branchIndex,
    };
  });
}

/** 按命宫支取《张果星宗》宫主。 */
export function getQizhengMingZhu(mingGong: number): string {
  assertQizhengBranchIndex(mingGong, '命宫支序');
  const mingZhu = QIZHENG_MING_ZHU_BY_BRANCH[mingGong];
  if (!mingZhu) throw new Error(`七政四余命主资料缺失：命宫序号 ${mingGong}。`);
  return mingZhu;
}

function buildQizhengTraditionalChartFacts(args: {
  stars: QizhengStar[];
  sun: QizhengStar;
  moon: QizhengStar;
  hourBranchIndex: number;
  mingGong: number;
  shenGong: number;
  mingZhu: string;
  twelvePalaces: QizhengResult['twelvePalaces'];
}): QizhengTraditionalChartFact[] {
  const ruleById = new Map(QIZHENG_TRADITIONAL_CHART_RULE_CATALOG.map((rule) => [rule.id, rule]));
  const makeFact = (
    id: QizhengTraditionalChartRuleId,
    inputs: Record<string, string | number>,
    result: Record<string, string | number>,
    promptText: string,
  ): QizhengTraditionalChartFact => {
    const rule = ruleById.get(id);
    if (!rule) throw new Error(`七政四余传统盘规则目录缺失：${id}。`);
    return {
      key: `qizheng:traditional-chart:${id}`,
      id,
      name: rule.name,
      status: '已计算',
      inputs,
      result,
      promptText,
      sources: rule.sources.map((source) => `${source.title}${source.section}：${source.url}`),
      limitation: rule.limitation,
    };
  };
  const hourBranch = QIZHENG_EARTHLY_BRANCHES[args.hourBranchIndex];
  const mingGongBranch = QIZHENG_EARTHLY_BRANCHES[args.mingGong];
  const shenGongBranch = QIZHENG_EARTHLY_BRANCHES[args.shenGong];
  return [
    makeFact(
      'zodiac-branch-mapping',
      { starCount: args.stars.length },
      {
        mappedStarCount: args.stars.length,
        mapping: QIZHENG_TROPICAL_ZODIAC_SIGNS.map(
          (sign, index) => `${sign}${QIZHENG_TROPICAL_ZODIAC_BRANCHES[index]}`,
        ).join('、'),
      },
      `十一星均先按热带黄道星座换算十二支宫；太阳${args.sun.tropicalZodiac}对应${args.sun.branch}宫，太阴${args.moon.tropicalZodiac}对应${args.moon.branch}宫`,
    ),
    makeFact(
      'ming-gong',
      {
        sunBranchIndex: args.sun.branchIndex,
        sunBranch: args.sun.branch,
        hourBranchIndex: args.hourBranchIndex,
        hourBranch,
      },
      { mingGong: args.mingGong, mingGongBranch },
      `太阳在${args.sun.branch}宫，以${hourBranch}时加太阳宫顺数遇卯，命宫为${mingGongBranch}宫`,
    ),
    makeFact(
      'shen-gong',
      { moonBranchIndex: args.moon.branchIndex, moonBranch: args.moon.branch },
      { shenGong: args.shenGong, shenGongBranch },
      `太阴在${args.moon.branch}宫，按太阴所在宫起身，身宫为${shenGongBranch}宫`,
    ),
    makeFact(
      'twelve-palaces',
      { mingGong: args.mingGong, mingGongBranch },
      {
        palaceCount: args.twelvePalaces.length,
        arrangement: args.twelvePalaces.map((item) => `${item.palace}${item.branch}宫`).join('、'),
      },
      `十二职宫自${mingGongBranch}宫起逆布：${args.twelvePalaces.map((item) => `${item.palace}=${item.branch}宫`).join('；')}`,
    ),
    makeFact(
      'ming-zhu',
      { mingGong: args.mingGong, mingGongBranch },
      { mingZhu: args.mingZhu },
      `命宫在${mingGongBranch}宫，按宫主表取命主${args.mingZhu}`,
    ),
  ];
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
  if (input.timezone !== undefined) assertNumberRange(input.timezone, '时区', -12, 14);
  if (input.standardMeridian !== undefined) {
    assertNumberRange(input.standardMeridian, '标准经线', -180, 180);
  }
  if (input.timeZoneId !== undefined && !input.timeZoneId.trim()) {
    throw new Error('IANA 时区名不能为空。');
  }
  if (includeLocation) {
    assertNumberRange(input.latitude ?? 39.9, '纬度', -90, 90);
    assertNumberRange(input.longitude ?? 116.4, '经度', -180, 180);
  }
}

function getTargetUtcMs(input: QizhengInput): number {
  validateQizhengInput(input, false);
  return buildQizhengAstronomicalTime(input).unixMilliseconds;
}

function buildQizhengAstronomicalTime(input: QizhengInput): AstronomicalTimeEvidence {
  return buildAstronomicalTimeEvidence({
    year: input.year,
    month: input.month,
    day: input.day,
    hour: input.hour,
    minute: input.minute ?? 0,
    second: 0,
    timezone: input.timezone ?? (input.timeZoneId ? undefined : 8),
    timeZoneId: input.timeZoneId,
  });
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

function formatTraditionalDateTime(parts: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second?: number;
}): string {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}T${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}:${String(parts.second ?? 0).padStart(2, '0')}`;
}

function buildQizhengTraditionalYearBasis(
  parts: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second?: number;
  },
  timeMode: QizhengTraditionalYearBasis['timeMode'],
): QizhengTraditionalYearBasis {
  const traditionalDateTime = formatTraditionalDateTime(parts);
  const lunarHour = SolarTime.fromYmdHms(
    parts.year,
    parts.month,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second ?? 0,
  ).getLunarHour();
  const lunarYearGanZhi = lunarHour
    .getLunarDay()
    .getLunarMonth()
    .getLunarYear()
    .getSixtyCycle()
    .getName();
  const liChunYearGanZhi = lunarHour.getEightChar().getYear().getName();
  const status = lunarYearGanZhi === liChunYearGanZhi ? '年干支口径一致' : '年界口径分歧';
  const adoptedYearGanZhi = status === '年干支口径一致' ? lunarYearGanZhi : undefined;
  return {
    status,
    traditionalDateTime,
    timeMode,
    lunarYearGanZhi,
    liChunYearGanZhi,
    ...(adoptedYearGanZhi ? { adoptedYearGanZhi } : {}),
    promptText: adoptedYearGanZhi
      ? `${timeMode}${traditionalDateTime}的农历年干支与八字立春年柱均为${adoptedYearGanZhi}，可据共同年干支查询传统神煞起例目标支`
      : `${timeMode}${traditionalDateTime}的农历年干支为${lunarYearGanZhi}、八字立春年柱为${liChunYearGanZhi}；《张果星宗》本组条文未在起例处明确春节或立春年界，当前不替用户自动选择`,
    sources: [
      'tyme4ts 农历年干支',
      'tyme4ts 八字立春年柱',
      '《张果星宗》卷二“诸星起例皆从年干为主”及地支吉凶星例的生年支表',
    ],
    limitation:
      '年界核验只比较农历年干支与立春年柱；二者不一致时不自动选择传统生年口径，也不生成个人神煞目标支，避免把未闭合的岁首约定伪装成确定规则',
  };
}

function buildQizhengShenshaFacts(yearBasis: QizhengTraditionalYearBasis): QizhengShenshaFact[] {
  const adoptedYearGanZhi = yearBasis.adoptedYearGanZhi;
  if (!adoptedYearGanZhi) return [];
  const yearStem = adoptedYearGanZhi[0];
  const yearBranch = adoptedYearGanZhi[1];
  getStemIndex(yearStem);
  getBranchIndex(yearBranch);
  return QIZHENG_SHENSHA_RULE_CATALOG.map((rule) => {
    const basisValue = rule.basis === '年干' ? yearStem : yearBranch;
    const targetByBasis: Readonly<Record<string, string>> = rule.targetByBasis;
    const targetBranch = targetByBasis[basisValue];
    if (!targetBranch) {
      throw new Error(`七政四余${rule.name}${rule.basis}${basisValue}起例资料缺失。`);
    }
    return {
      key: `qizheng:shensha:${rule.id}:${adoptedYearGanZhi}`,
      id: rule.id,
      name: rule.name,
      status: '已校勘起例',
      basis: rule.basis,
      basisGanZhi: adoptedYearGanZhi,
      basisValue,
      targetBranch,
      sourceSection: rule.sourceSection,
      sourceQuote: rule.sourceQuote,
      promptText: `${rule.name}按生${rule.basis}${basisValue}起例，目标支为${targetBranch}；${rule.usage}`,
      sources: [rule.sourceTitle, rule.sourceSection, rule.sourceUrl],
      limitation: rule.limitation,
    };
  });
}

const PLANET_NAMES: Record<string, { label: string }> = {
  Sun: { label: '太阳' },
  Moon: { label: '太阴' },
  Mercury: { label: '辰星(水)' },
  Venus: { label: '太白(金)' },
  Mars: { label: '荧惑(火)' },
  Jupiter: { label: '岁星(木)' },
  Saturn: { label: '镇星(土)' },
};

function buildCalculationContext(
  input: QizhengInput,
  latitude: number,
  longitude: number,
  astronomicalTime: AstronomicalTimeEvidence,
): QizhengCalculationContext {
  const hasLatitude = input.latitude !== undefined;
  const hasLongitude = input.longitude !== undefined;
  const moonPhase = calculateMoonPhaseEvidence(astronomicalTime.unixMilliseconds);
  const solarIllumination = calculateSolarIlluminationEvidence({
    year: input.year,
    month: input.month,
    day: input.day,
    hour: input.hour,
    minute: input.minute ?? 0,
    second: 0,
    latitude,
    longitude,
    timezone: astronomicalTime.timezone,
    timeZoneId: input.timeZoneId,
  });
  return {
    localDateTime: `${input.year}-${String(input.month).padStart(2, '0')}-${String(input.day).padStart(2, '0')}T${String(input.hour).padStart(2, '0')}:${String(input.minute ?? 0).padStart(2, '0')}:00`,
    utcDateTime: new Date(astronomicalTime.unixMilliseconds).toISOString(),
    timezone: astronomicalTime.timezone,
    latitude,
    longitude,
    locationSource:
      hasLatitude && hasLongitude
        ? '用户提供'
        : !hasLatitude && !hasLongitude
          ? '默认北京坐标'
          : '部分坐标使用默认值',
    timezoneSource: input.timeZoneId
      ? 'IANA历史时区'
      : input.timezone === undefined
        ? '默认东八区'
        : '用户提供',
    astronomicalTime,
    moonPhase,
    solarIllumination,
    coordinatePipeline: [
      '民用时间结合时区换算UTC时刻',
      '统一记录JD(UTC)、UT1≈UTC假设、ΔT估算与近似JD(TT)',
      'celestine计算七政、真交点和真莉莉丝的回归黄经',
      '紫炁按《七政算内篇》独立古法均速模型计算回归黄经',
      '二十八宿距星J2000坐标与自行由成熟天文库转换为目标日期真黄经',
      '各星目标日期黄经按相邻距星实际弧段换算宿度',
      '各星回归黄经先定热带黄道星座，再按《张果星宗》映射十二支宫',
      '命宫按生时加太阳宫顺数遇卯，身宫取太阴所在宫，十二职宫自命宫逆布',
      '十一星按稳定星序完整穷举55组无序星对并计算实际最小夹角',
      '庙旺与吊照规则因原典条件未闭合而登记为未采用，不自动生成结论',
    ],
  };
}

function buildQizhengCounterEvidenceFacts(args: {
  calculationFact: QizhengCalculationFact;
  positionSourceFacts: QizhengPositionSourceFact[];
  pairGeometryFacts: QizhengPairGeometryFact[];
  traditionalYearBasis: QizhengTraditionalYearBasis;
}): QizhengCounterEvidenceFact[] {
  const hasMixedPrecision =
    args.positionSourceFacts.some((item) => item.precisionClass === '传统均速模型') ||
    args.pairGeometryFacts.some((item) => item.precisionClass === '混合模型');
  const geometryComplete = args.pairGeometryFacts.length === 55;
  return [
    {
      key: 'qizheng:counter:input',
      type: '输入完整性',
      status: args.calculationFact.status,
      ownerFactKeys: [
        args.calculationFact.key,
        ...args.calculationFact.steps.map((item) => item.key),
      ],
      promptText:
        args.calculationFact.status === '输入明确'
          ? '出生时间、地点和时区输入明确，未使用默认地点或默认时区'
          : `本次使用${args.calculationFact.defaults.join('、')}，宫位和光照资料不得宣称已按真实出生地完整校准`,
      sources: ['七政四余输入完整性与默认值逐项核验'],
      limitation: QIZHENG_COUNTER_FACT_LIMITATION,
    },
    {
      key: 'qizheng:counter:precision',
      type: '位置精度分层',
      status: hasMixedPrecision ? '混合模型' : '同层现代天文',
      ownerFactKeys: args.positionSourceFacts.map((item) => item.key),
      promptText: hasMixedPrecision
        ? '七政、罗计、月孛与紫炁采用不同精度层级，混合星对几何必须保留模型分层'
        : '当前参与关系的位置来源均属同层现代天文计算',
      sources: ['逐对象位置来源、坐标口径与精度层级核验'],
      limitation: QIZHENG_COUNTER_FACT_LIMITATION,
    },
    {
      key: 'qizheng:counter:pair-geometry',
      type: '星对几何覆盖',
      status: geometryComplete ? '完整穷举' : '有缺口',
      ownerFactKeys: args.pairGeometryFacts.length
        ? args.pairGeometryFacts.map((item) => item.key)
        : ['qizheng:calculation:pair-geometry'],
      promptText: geometryComplete
        ? '十一星的55组无序星对已全部列出实际最小夹角'
        : `十一星应有55组无序星对，当前仅有${args.pairGeometryFacts.length}组`,
      sources: ['十一星目标日期黄经最小夹角完整穷举'],
      limitation: QIZHENG_COUNTER_FACT_LIMITATION,
    },
    {
      key: 'qizheng:counter:traditional-year-boundary',
      type: '传统年界口径',
      status: args.traditionalYearBasis.status,
      ownerFactKeys: ['qizheng:calculation:traditional-year-boundary'],
      promptText: args.traditionalYearBasis.promptText,
      sources: args.traditionalYearBasis.sources,
      limitation: QIZHENG_COUNTER_FACT_LIMITATION,
    },
  ];
}

function isQizhengCounterIssue(item: QizhengCounterEvidenceFact) {
  return !['输入明确', '同层现代天文', '完整穷举', '年干支口径一致'].includes(item.status);
}

function buildQizhengCounterSummaryFact(
  counterEvidenceFacts: QizhengCounterEvidenceFact[],
): QizhengCounterSummaryFact {
  const issueFacts = counterEvidenceFacts.filter(isQizhengCounterIssue);
  return {
    key: 'qizheng:counter-summary',
    status: issueFacts.length ? '存在需保留反证' : '未见额外反证',
    factKeys: issueFacts.map((item) => item.key),
    promptText: issueFacts.length
      ? `需保留${issueFacts.map((item) => `${item.type}${item.status}`).join('、')}；不得静默补齐或提升精度`
      : '输入完整性、位置精度分层与星对几何覆盖未见额外缺口',
    sources: ['输入默认值、位置来源精度与星对几何覆盖逐项汇总'],
    limitation: QIZHENG_COUNTER_SUMMARY_LIMITATION,
  };
}

function buildQizhengLimitationFacts(args: {
  calculationFact: QizhengCalculationFact;
  positionSourceFacts: QizhengPositionSourceFact[];
  starFacts: QizhengStarFact[];
  pairGeometryFacts: QizhengPairGeometryFact[];
  traditionalChartFacts: QizhengTraditionalChartFact[];
  context: QizhengCalculationContext;
  traditionalYearBasis: QizhengTraditionalYearBasis;
  shenshaFacts: QizhengShenshaFact[];
  locationSourceText: string;
  timezoneSourceText: string;
}): QizhengLimitationFact[] {
  const pairGeometryOwnerKeys = args.pairGeometryFacts.length
    ? args.pairGeometryFacts.map((item) => item.key)
    : ['qizheng:calculation:pair-geometry'];
  const definitions: Array<
    Pick<QizhengLimitationFact, 'key' | 'type' | 'ownerFactKeys' | 'promptText' | 'sources'>
  > = [
    {
      key: 'qizheng:limitation:input-defaults',
      type: '输入默认边界',
      ownerFactKeys: [args.calculationFact.key, 'qizheng:calculation:utc'],
      promptText: `${args.locationSourceText}；${args.timezoneSourceText}，地点或时区并非明确输入时，不得宣称宫位结果已按真实出生地校准`,
      sources: ['地点、时区输入与默认值记录'],
    },
    {
      key: 'qizheng:limitation:time-scales',
      type: '时间尺度边界',
      ownerFactKeys: [args.context.astronomicalTime.key, 'qizheng:calculation:time-scales'],
      promptText: args.context.astronomicalTime.limitations.join('；'),
      sources: ['UTC、UT1近似、ΔT与TT时间尺度证据'],
    },
    {
      key: 'qizheng:limitation:position-sources',
      type: '位置来源边界',
      ownerFactKeys: args.positionSourceFacts.map((item) => item.key),
      promptText:
        '七政、罗计、月孛和紫炁必须保留各自提供方、模型、坐标和精度层级，不得把来源可追溯等同于观测级精度',
      sources: ['逐对象位置来源与坐标口径'],
    },
    {
      key: 'qizheng:limitation:mixed-precision',
      type: '混合精度边界',
      ownerFactKeys: [
        ...args.positionSourceFacts
          .filter((item) => item.precisionClass === '传统均速模型')
          .map((item) => item.key),
        ...args.starFacts
          .filter((item) => item.precisionClass === '传统均速模型')
          .map((item) => item.key),
        ...args.pairGeometryFacts
          .filter((item) => item.precisionClass === '混合模型')
          .map((item) => item.key),
      ],
      promptText:
        '七政、罗计与月孛来自现代天文计算，紫炁来自传统均速模型；含紫炁的星对几何不得提升为现代天文同精度证据',
      sources: ['现代天文位置与《七政算内篇》紫炁均速模型分层'],
    },
    {
      key: 'qizheng:limitation:traditional-rules',
      type: '传统规则边界',
      ownerFactKeys: [
        ...args.traditionalChartFacts.map((fact) => fact.key),
        ...pairGeometryOwnerKeys,
      ],
      promptText: `${QIZHENG_TRADITIONAL_RULE_AUDIT.chart.reason}；${QIZHENG_TRADITIONAL_RULE_AUDIT.dignity.reason}；${QIZHENG_TRADITIONAL_RULE_AUDIT.aspects.reason}；${QIZHENG_TRADITIONAL_RULE_AUDIT.shensha.reason}；${args.traditionalYearBasis.limitation}`,
      sources: [
        ...QIZHENG_TRADITIONAL_RULE_AUDIT.chart.sources,
        ...QIZHENG_TRADITIONAL_RULE_AUDIT.dignity.sources,
        ...QIZHENG_TRADITIONAL_RULE_AUDIT.aspects.sources,
        ...QIZHENG_TRADITIONAL_RULE_AUDIT.shensha.sources,
        ...args.traditionalYearBasis.sources,
      ],
    },
    {
      key: 'qizheng:limitation:moon-illumination',
      type: '月相光照边界',
      ownerFactKeys: [args.context.moonPhase.key, args.context.solarIllumination.key],
      promptText: [
        ...args.context.moonPhase.limitations,
        ...args.context.solarIllumination.limitations,
      ].join('；'),
      sources: ['月相黄经差与出生地点太阳光照证据'],
    },
    {
      key: 'qizheng:limitation:high-risk-output',
      type: '高风险输出边界',
      ownerFactKeys: [
        args.calculationFact.key,
        ...args.starFacts.map((item) => item.key),
        ...args.traditionalChartFacts.map((item) => item.key),
        ...pairGeometryOwnerKeys,
        ...args.shenshaFacts.map((item) => item.key),
      ],
      promptText:
        '不得输出吉凶总分、成功率、疾病诊断、投资回报、人物意图、保证有效的化解方案或唯一应期；未校勘的庙旺与吊照不得补算，神煞目标支不得冒充盘面命中或吉凶结论',
      sources: ['盘面位置、星对几何、传统规则审计、神煞与现实结果分离原则'],
    },
  ];
  return definitions.map((definition) => ({
    ...definition,
    ownerFactKeys: Array.from(
      new Set(
        definition.ownerFactKeys.length ? definition.ownerFactKeys : [args.calculationFact.key],
      ),
    ),
    status: '适用',
    limitation: QIZHENG_LIMITATION_FACT_LIMITATION,
  }));
}

function buildQizhengSummaryFact(args: {
  calculationFact: QizhengCalculationFact;
  positionSourceFacts: QizhengPositionSourceFact[];
  starFacts: QizhengStarFact[];
  pairGeometryFacts: QizhengPairGeometryFact[];
  traditionalChartFacts: QizhengTraditionalChartFact[];
  traditionalYearBasis: QizhengTraditionalYearBasis;
  shenshaFacts: QizhengShenshaFact[];
  counterEvidenceFacts: QizhengCounterEvidenceFact[];
  counterSummaryFact: QizhengCounterSummaryFact;
  limitationFacts: QizhengLimitationFact[];
  context: QizhengCalculationContext;
}): QizhengSummaryFact {
  const status =
    args.calculationFact.status === '输入明确' &&
    args.calculationFact.steps.length === 9 &&
    args.positionSourceFacts.length === 4 &&
    args.starFacts.length === 11 &&
    args.pairGeometryFacts.length === 55 &&
    args.traditionalChartFacts.length === QIZHENG_TRADITIONAL_CHART_RULE_CATALOG.length &&
    args.traditionalYearBasis.status === '年干支口径一致' &&
    args.shenshaFacts.length === QIZHENG_SHENSHA_RULE_CATALOG.length
      ? '可用事实链完整'
      : '可用事实链有缺口';
  return {
    key: 'qizheng:evidence-summary',
    status,
    factKeys: Array.from(
      new Set([
        args.calculationFact.key,
        ...args.calculationFact.steps.map((item) => item.key),
        ...args.positionSourceFacts.map((item) => item.key),
        ...args.starFacts.map((item) => item.key),
        ...args.pairGeometryFacts.map((item) => item.key),
        ...args.traditionalChartFacts.map((item) => item.key),
        'qizheng:calculation:traditional-year-boundary',
        ...args.shenshaFacts.map((item) => item.key),
        args.context.astronomicalTime.key,
        args.context.moonPhase.key,
        args.context.solarIllumination.key,
        ...args.counterEvidenceFacts.map((item) => item.key),
        args.counterSummaryFact.key,
        ...args.limitationFacts.map((item) => item.key),
      ]),
    ),
    positionSourceFactCount: args.positionSourceFacts.length,
    starFactCount: args.starFacts.length,
    pairGeometryFactCount: args.pairGeometryFacts.length,
    traditionalChartFactCount: args.traditionalChartFacts.length,
    shenshaFactCount: args.shenshaFacts.length,
    counterEvidenceCount: args.counterEvidenceFacts.length,
    limitationFactCount: args.limitationFacts.length,
    promptText: `证据链状态：${status}；位置来源${args.positionSourceFacts.length}项、逐星${args.starFacts.length}项、星对几何${args.pairGeometryFacts.length}项、传统命身宫规则${args.traditionalChartFacts.length}项、传统神煞起例${args.shenshaFacts.length}项、反证${args.counterEvidenceFacts.length}项、限制${args.limitationFacts.length}项`,
    sources: [
      '七政四余输入、时间尺度、位置来源、逐星、星对几何、传统命身十二职宫、传统年界、神煞起例、月相光照、反证与限制事实逐项汇总',
    ],
    limitation: QIZHENG_SUMMARY_FACT_LIMITATION,
  };
}

function buildQizhengEvidence(
  stars: QizhengStar[],
  pairwiseAngles: QizhengPairGeometry[],
  context: QizhengCalculationContext,
  structure: {
    mingGong: number;
    shenGong: number;
    mingZhu: string;
    twelvePalaces: QizhengResult['twelvePalaces'];
    traditionalChartFacts: QizhengTraditionalChartFact[];
    traditionalYearBasis: QizhengTraditionalYearBasis;
    shenshaFacts: QizhengShenshaFact[];
    ziqi: ZiqiPosition;
    ziqiModel: ZiqiModelInfo;
  },
): QizhengEvidenceAnalysis {
  const locationSourceText =
    context.locationSource === '用户提供' ? '地点输入明确' : context.locationSource;
  const timezoneSourceText =
    context.timezoneSource === '用户提供'
      ? '时区输入明确'
      : context.timezoneSource === 'IANA历史时区'
        ? 'IANA历史时区已解析'
        : context.timezoneSource;
  const defaults = [
    context.locationSource === '用户提供' ? '' : `地点来源${context.locationSource}`,
    context.timezoneSource === '用户提供' || context.timezoneSource === 'IANA历史时区'
      ? ''
      : `时区来源${context.timezoneSource}`,
  ].filter(Boolean);
  const calculationSteps: QizhengCalculationStep[] = [
    {
      key: 'qizheng:calculation:utc',
      stage: '民用时间转UTC',
      status: '已计算',
      inputs: {
        localDateTime: context.localDateTime,
        timezone: context.timezone,
        timezoneSource: context.timezoneSource,
      },
      result: { utcDateTime: context.utcDateTime },
      dependsOnStepKeys: [],
      promptText: `当地民用时间${context.localDateTime}按UTC${context.timezone >= 0 ? '+' : ''}${context.timezone}换算为${context.utcDateTime}`,
      sources: ['历史时区或固定UTC偏移解析', '当前民用时间输入'],
      limitation: QIZHENG_CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'qizheng:calculation:time-scales',
      stage: '天文时间尺度',
      status: '已计算',
      inputs: { utcDateTime: context.utcDateTime },
      result: {
        julianDayUtc: context.astronomicalTime.julianDayUtc,
        deltaTSeconds: context.astronomicalTime.deltaTSeconds,
        julianDayTtApprox: context.astronomicalTime.julianDayTtApprox,
        precisionLevel: context.astronomicalTime.precisionLevel,
      },
      dependsOnStepKeys: ['qizheng:calculation:utc'],
      promptText: `UTC时刻换算JD(UTC)${context.astronomicalTime.julianDayUtc.toFixed(6)}，采用ΔT${context.astronomicalTime.deltaTSeconds.toFixed(3)}秒得到近似JD(TT)${context.astronomicalTime.julianDayTtApprox.toFixed(6)}`,
      sources: [context.astronomicalTime.source, context.astronomicalTime.deltaTModel],
      limitation: QIZHENG_CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'qizheng:calculation:modern-positions',
      stage: '现代位置计算',
      status: '已计算',
      inputs: {
        utcDateTime: context.utcDateTime,
        latitude: context.latitude,
        longitude: context.longitude,
      },
      result: {
        modernObjectCount: stars.filter((item) => item.precisionClass === '现代天文计算').length,
      },
      dependsOnStepKeys: ['qizheng:calculation:time-scales'],
      promptText: '由celestine计算七政、真交点和真莉莉丝的回归黄经及逆行状态',
      sources: ['celestine.calculateChart', '真交点与真莉莉丝扩展计算'],
      limitation: QIZHENG_CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'qizheng:calculation:ziqi',
      stage: '紫炁古法计算',
      status: '已计算',
      inputs: {
        utcDateTime: context.utcDateTime,
        modelId: structure.ziqiModel.id,
      },
      result: {
        tropicalLongitude: structure.ziqi.tropicalLongitude,
        dailyMotionDegrees: structure.ziqi.dailyMotionDegrees,
      },
      dependsOnStepKeys: ['qizheng:calculation:time-scales'],
      promptText: `紫炁按${structure.ziqiModel.name}得到回归黄经${structure.ziqi.tropicalLongitude.toFixed(6)}°`,
      sources: structure.ziqiModel.sources
        .filter((item) => item.usage === '采用')
        .map((item) => item.title),
      limitation: QIZHENG_CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'qizheng:calculation:mansion-boundaries',
      stage: '距星宿界换算',
      status: '已计算',
      inputs: { objectCount: stars.length },
      result: { mansionStarCount: QIZHENG_MANSION_STARS.length },
      dependsOnStepKeys: ['qizheng:calculation:modern-positions', 'qizheng:calculation:ziqi'],
      promptText: '二十八宿距星按J2000坐标、自行和目标时刻转换为同日真黄经宿界',
      sources: [
        QIZHENG_MANSION_MODEL.mappingSource,
        QIZHENG_MANSION_MODEL.astrometrySource,
        QIZHENG_MANSION_MODEL.transformSource,
      ],
      limitation: QIZHENG_CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'qizheng:calculation:xiu-palace',
      stage: '宿度与落宫',
      status: '已计算',
      inputs: { mansionStarCount: QIZHENG_MANSION_STARS.length },
      result: { starFactCount: stars.length, palaceCount: 12 },
      dependsOnStepKeys: ['qizheng:calculation:mansion-boundaries'],
      promptText:
        '各星目标日期黄经按相邻距星实际弧段换算宿度，并按《张果星宗》黄道星座对应关系换算十二支宫',
      sources: ['二十八宿距星目标日期真黄经边界', '《张果星宗》宫分所属黄道星座与十二支宫映射'],
      limitation: QIZHENG_CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'qizheng:calculation:traditional-chart',
      stage: '传统命身宫与十二职宫',
      status: '已计算',
      inputs: {
        sunBranch:
          QIZHENG_EARTHLY_BRANCHES[stars.find((star) => star.name === '太阳')!.branchIndex],
        moonBranch:
          QIZHENG_EARTHLY_BRANCHES[stars.find((star) => star.name === '太阴')!.branchIndex],
        chartRuleCount: QIZHENG_TRADITIONAL_CHART_RULE_CATALOG.length,
      },
      result: {
        mingGongBranch: QIZHENG_EARTHLY_BRANCHES[structure.mingGong],
        shenGongBranch: QIZHENG_EARTHLY_BRANCHES[structure.shenGong],
        mingZhu: structure.mingZhu,
        palaceCount: structure.twelvePalaces.length,
      },
      dependsOnStepKeys: ['qizheng:calculation:xiu-palace'],
      promptText: structure.traditionalChartFacts.map((fact) => fact.promptText).join('；'),
      sources: Array.from(new Set(structure.traditionalChartFacts.flatMap((fact) => fact.sources))),
      limitation: QIZHENG_CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'qizheng:calculation:pair-geometry',
      stage: '星对几何穷举',
      status: '已计算',
      inputs: { starCount: stars.length },
      result: { expectedPairCount: 55, actualPairCount: pairwiseAngles.length },
      dependsOnStepKeys: ['qizheng:calculation:traditional-chart'],
      promptText: `十一星共55组无序星对，已按稳定星序完整计算${pairwiseAngles.length}组实际最小夹角`,
      sources: ['十一星目标日期黄经', '无序星对组合穷举与最小夹角计算'],
      limitation: QIZHENG_CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'qizheng:calculation:traditional-year-boundary',
      stage: '传统年界核验',
      status: '已计算',
      inputs: {
        traditionalDateTime: structure.traditionalYearBasis.traditionalDateTime,
        timeMode: structure.traditionalYearBasis.timeMode,
      },
      result: {
        lunarYearGanZhi: structure.traditionalYearBasis.lunarYearGanZhi,
        liChunYearGanZhi: structure.traditionalYearBasis.liChunYearGanZhi,
        status: structure.traditionalYearBasis.status,
        shenshaFactCount: structure.shenshaFacts.length,
      },
      dependsOnStepKeys: [],
      promptText: structure.traditionalYearBasis.promptText,
      sources: structure.traditionalYearBasis.sources,
      limitation: QIZHENG_CALCULATION_STEP_LIMITATION,
    },
  ];
  const calculationFact: QizhengCalculationFact = {
    key: 'calculation:qizheng:chart',
    status: defaults.length ? '含默认值' : '输入明确',
    defaults,
    context: {
      localDateTime: context.localDateTime,
      utcDateTime: context.utcDateTime,
      timezone: context.timezone,
      latitude: context.latitude,
      longitude: context.longitude,
      locationSource: context.locationSource,
      timezoneSource: context.timezoneSource,
    },
    steps: calculationSteps,
    promptText: calculationSteps.map((item) => item.promptText).join(' → '),
    sources: [
      'UTC、JD与近似TT时间尺度换算',
      'celestine现代位置计算',
      structure.ziqiModel.name,
      '距星自行、目标日期真黄道、二十八宿与十二支宫换算',
      '《张果星宗》《五行精纪》《灵台经》传统命身宫与十二职宫规则',
      '《张果星宗》传统神煞起例与年界双口径核验',
    ],
    limitation: CALCULATION_FACT_LIMITATION,
  };
  const positionSourceFacts: QizhengPositionSourceFact[] = QIZHENG_POSITION_SOURCES.map(
    (source) => {
      const promptLimitations = source.limitations.map(conditionQizhengPortableText);
      return {
        key: `qizheng:position-source:${source.id}`,
        sourceId: source.id,
        status: '已采用',
        objects: [...source.objects],
        provider: source.provider,
        calculation: source.calculation,
        coordinate: source.coordinate,
        precisionClass: source.precisionClass,
        adoptedSources:
          source.id === 'qizhengsuan-ziqi'
            ? structure.ziqiModel.sources
                .filter((item) => item.usage === '采用')
                .map((item) => item.title)
            : [source.provider],
        limitations: [...source.limitations],
        promptLimitations,
        promptText: `${source.objects.join('、')}采用${source.provider}（${source.precisionClass}）：${conditionQizhengPortableText(source.calculation)}；坐标口径${conditionQizhengPortableText(source.coordinate)}`,
        limitation: POSITION_SOURCE_FACT_LIMITATION,
      };
    },
  );
  const starFacts: QizhengStarFact[] = stars.map((star) => ({
    key: `逐星:${star.name}`,
    name: star.name,
    kind: star.kind,
    tropicalLongitude: star.tropicalLongitude,
    siderealLongitude: star.longitude,
    xiu: star.xiu,
    sevenStar: star.sevenStar,
    xiuDegree: star.xiuDegree,
    tropicalZodiacIndex: star.tropicalZodiacIndex,
    tropicalZodiac: star.tropicalZodiac,
    branchIndex: star.branchIndex,
    branch: star.branch,
    signIndex: star.signIndex,
    palace: star.palace,
    retrograde: star.retrograde,
    sourceId: star.sourceId,
    sourceLabel: star.sourceLabel,
    precisionClass: star.precisionClass,
    promptText: `${star.name}（${star.kind}，${star.precisionClass}）：目标日期黄经${star.longitude.toFixed(3)}°，热带黄道${star.tropicalZodiac}、对应${star.branch}宫，${star.xiu}宿${star.xiuDegree.toFixed(2)}度，落${star.palace}${star.retrograde ? '，逆行' : ''}`,
    sources: [
      star.sourceLabel,
      `位置源标识${star.sourceId}`,
      QIZHENG_MANSION_MODEL.astrometrySource,
      QIZHENG_MANSION_MODEL.transformSource,
    ],
    limitation: STAR_FACT_LIMITATION,
  }));
  const pairGeometryFacts: QizhengPairGeometryFact[] = pairwiseAngles.map((pair) => ({
    key: `星对几何:${pair.star1}:${pair.star2}`,
    star1: pair.star1,
    star2: pair.star2,
    actualAngle: pair.actualAngle,
    precisionClass: pair.precisionClass,
    promptText: `${pair.star1}与${pair.star2}：目标日期黄经实际最小夹角${pair.actualAngle.toFixed(2)}°，${pair.precisionClass}${pair.precisionClass === '混合模型' ? '；不得提升为现代天文同精度证据' : ''}`,
    sources: [pair.source, '十一星全部无序星对完整穷举'],
    limitation: PAIR_GEOMETRY_FACT_LIMITATION,
  }));
  const primaryFacts = starFacts.map(
    (fact) =>
      `${fact.name}据${fact.sourceLabel}得${fact.precisionClass}位置，在${fact.branch}宫，落${fact.palace}、${fact.xiu}宿`,
  );
  primaryFacts.push(
    `${structure.traditionalChartFacts.map((fact) => fact.promptText).join('；')}；命宫在${QIZHENG_EARTHLY_BRANCHES[structure.mingGong]}宫，身宫在${QIZHENG_EARTHLY_BRANCHES[structure.shenGong]}宫，命主${structure.mingZhu}`,
  );
  const supportingFacts = pairGeometryFacts.map((pair) => pair.promptText);
  supportingFacts.push(
    `紫炁顺行回归黄经${structure.ziqi.tropicalLongitude.toFixed(3)}°，采用${structure.ziqiModel.name}并与现代天文位置分层`,
  );
  supportingFacts.push(
    structure.shenshaFacts.length
      ? `传统神煞起例目标支：${structure.shenshaFacts.map((item) => `${item.name}${item.targetBranch}`).join('、')}`
      : `传统神煞起例未自动生成：${structure.traditionalYearBasis.promptText}`,
  );
  const counterEvidenceFacts = buildQizhengCounterEvidenceFacts({
    calculationFact,
    positionSourceFacts,
    pairGeometryFacts,
    traditionalYearBasis: structure.traditionalYearBasis,
  });
  const counterSummaryFact = buildQizhengCounterSummaryFact(counterEvidenceFacts);
  const counterEvidence = counterEvidenceFacts
    .filter(isQizhengCounterIssue)
    .map((item) => item.promptText);
  const limitationFacts = buildQizhengLimitationFacts({
    calculationFact,
    positionSourceFacts,
    starFacts,
    pairGeometryFacts,
    traditionalChartFacts: structure.traditionalChartFacts,
    context,
    traditionalYearBasis: structure.traditionalYearBasis,
    shenshaFacts: structure.shenshaFacts,
    locationSourceText,
    timezoneSourceText,
  });
  const limitations = limitationFacts.map((item) => item.promptText);
  const summaryFact = buildQizhengSummaryFact({
    calculationFact,
    positionSourceFacts,
    starFacts,
    pairGeometryFacts,
    traditionalChartFacts: structure.traditionalChartFacts,
    traditionalYearBasis: structure.traditionalYearBasis,
    shenshaFacts: structure.shenshaFacts,
    counterEvidenceFacts,
    counterSummaryFact,
    limitationFacts,
    context,
  });
  const calculationChain = calculationSteps.map((item) => item.promptText);
  const traditionalChartEvidenceItems: PromptEvidenceItem[] = structure.traditionalChartFacts.map(
    (fact) => {
      const rule = QIZHENG_TRADITIONAL_CHART_RULE_CATALOG.find((item) => item.id === fact.id);
      if (!rule) throw new Error(`七政四余传统盘规则目录缺失：${fact.id}。`);
      return {
        level: '主证',
        title: `${fact.name}事实`,
        detail: `${fact.promptText}；规则：${rule.rule}；原文：${rule.sources.map((source) => `${source.title}${source.section}“${source.quote}”`).join('；')}；边界：${fact.limitation}`,
        source: fact.sources.join('；'),
        tags: ['传统命身宫', fact.id, fact.status],
      };
    },
  );
  const items: PromptEvidenceItem[] = [
    {
      level: calculationFact.status === '输入明确' ? '辅证' : '反证',
      title: '七政四余输入与坐标计算链',
      detail: `${calculationFact.promptText}；${calculationFact.defaults.length ? `默认项：${calculationFact.defaults.join('、')}；` : ''}边界：${calculationFact.limitation}`,
      source: calculationFact.sources.join('、'),
      tags: ['计算链', calculationFact.status],
    },
    ...positionSourceFacts.map((source): PromptEvidenceItem => ({
      level: source.precisionClass === '现代天文计算' ? '辅证' : '限制',
      title: `${source.objects.join('、')}位置来源`,
      detail: `${source.promptText}；来源依据${source.adoptedSources.join('、')}；局限${source.promptLimitations.join('；')}；统一边界：${source.limitation}`,
      source: `${source.key}；${source.adoptedSources.join('、')}`,
      tags: [source.precisionClass, source.sourceId],
    })),
    ...starFacts.map((star): PromptEvidenceItem => ({
      level: star.kind === '七政' ? '主证' : '辅证',
      title: `${star.name}位置与落宫`,
      detail: `${star.promptText}；边界：${star.limitation}`,
      source: star.sources.join('；'),
      tags: [star.kind, star.precisionClass, star.xiu, star.palace],
    })),
    ...traditionalChartEvidenceItems,
    ...pairGeometryFacts.map((pair): PromptEvidenceItem => ({
      level: '辅证',
      title: `${pair.star1}与${pair.star2}实际夹角`,
      detail: `${pair.promptText}；边界：${pair.limitation}`,
      source: pair.sources.join('；'),
      tags: ['星对几何', pair.precisionClass],
    })),
    {
      level: '限制',
      title: '庙旺与吊照规则未采用',
      detail: `庙旺：${QIZHENG_TRADITIONAL_RULE_AUDIT.dignity.reason}；吊照：${QIZHENG_TRADITIONAL_RULE_AUDIT.aspects.reason}`,
      source: [
        ...QIZHENG_TRADITIONAL_RULE_AUDIT.dignity.sources,
        ...QIZHENG_TRADITIONAL_RULE_AUDIT.aspects.sources,
      ].join('；'),
      tags: ['传统规则审计', '未采用'],
    },
    {
      level: '主证',
      title: '命宫、身宫与命主定位',
      detail: primaryFacts.at(-1) ?? '未生成命身宫定位',
      source: '生时地支与太阳、太阴宫位安命安身规则',
      tags: ['命宫', '身宫', '命主'],
    },
    {
      level: '辅证',
      title: '紫炁传统均速位置',
      detail: supportingFacts.at(-2) ?? '未生成紫炁位置',
      source: structure.ziqiModel.name,
      tags: ['紫炁', '传统均速模型'],
    },
    {
      level: structure.traditionalYearBasis.status === '年干支口径一致' ? '辅证' : '反证',
      title: `传统神煞年界核验：${structure.traditionalYearBasis.status}`,
      detail: `${structure.traditionalYearBasis.promptText}；边界：${structure.traditionalYearBasis.limitation}`,
      source: structure.traditionalYearBasis.sources.join('；'),
      tags: ['传统神煞', '年界核验', structure.traditionalYearBasis.status],
    },
    ...structure.shenshaFacts.map((fact): PromptEvidenceItem => ({
      level: '辅证',
      title: `${fact.name}起例目标支`,
      detail: `${fact.promptText}；原文：${fact.sourceQuote}；边界：${fact.limitation}`,
      source: fact.sources.join('；'),
      tags: ['传统神煞', fact.basis, fact.basisValue, fact.targetBranch],
    })),
    ...counterEvidenceFacts.filter(isQizhengCounterIssue).map((item): PromptEvidenceItem => ({
      level: '反证',
      title: `七政四余${item.type}${item.status}`,
      detail: `${item.promptText}；边界：${item.limitation}`,
      source: item.sources.join('、'),
      tags: ['反证', item.type, item.status],
    })),
    {
      level: '反证',
      title: `七政四余反证汇总：${counterSummaryFact.status}`,
      detail: `${counterSummaryFact.promptText}；边界：${counterSummaryFact.limitation}`,
      source: counterSummaryFact.sources.join('、'),
      tags: ['反证汇总', counterSummaryFact.status],
    },
    {
      level: summaryFact.status === '可用事实链完整' ? '辅证' : '反证',
      title: `七政四余证据汇总：${summaryFact.status}`,
      detail: `${summaryFact.promptText}；边界：${summaryFact.limitation}`,
      source: summaryFact.sources.join('、'),
      tags: ['证据汇总', summaryFact.status],
    },
    {
      level: '限制',
      title: '坐标、模型与解释边界',
      detail: `${limitations.join('；')}；边界：${QIZHENG_LIMITATION_FACT_LIMITATION}`,
      source: Array.from(new Set(limitationFacts.flatMap((item) => item.sources))).join('、'),
    },
  ];
  const evidence: PromptEvidenceBundle = { title: '七政四余计算来源与证据分层', items };
  const promptText = [
    '【七政四余计算来源与证据分层】',
    ...formatPromptEvidenceBundle(evidence),
    `计算链：${calculationChain.join(' → ')}。`,
    `反证汇总：${counterSummaryFact.promptText}。`,
    `证据汇总：${summaryFact.promptText}。`,
    `解释限制：${limitations.join('；')}。`,
  ].join('\n');
  return {
    key: 'qizheng:evidence',
    status: '已计算',
    calculationFact,
    calculationSteps,
    calculationChain,
    positionSourceFacts,
    starFacts,
    pairGeometryFacts,
    traditionalChartFacts: structure.traditionalChartFacts,
    traditionalYearBasis: structure.traditionalYearBasis,
    shenshaFacts: structure.shenshaFacts,
    primaryFacts,
    supportingFacts,
    counterEvidence,
    counterEvidenceFacts,
    counterSummaryFact,
    limitations,
    limitationFacts,
    summaryFact,
    evidence,
    promptText,
    methodology: [
      '先固定民用时间、时区、地点和UTC计算时刻。',
      '逐星保留计算来源，区分现代天文位置与传统紫炁均速模型。',
      '再按目标日期二十八宿距星真黄经边界换算宿度，并按《张果星宗》把热带黄道星座换成十二支宫。',
      '命宫以生时加太阳宫顺数遇卯，身宫据《五行精纪》《灵台经》取太阴所在宫，十二职宫自命宫逆布；这些位置不扩张为吉凶。',
      '庙旺原典条件未闭合，当前不自动判定。',
      '完整穷举十一星的55组无序星对并保留实际最小夹角；固定容许度吊照缺少可靠统一依据，当前不自动判定。',
      '按《张果星宗》逐项保留传统神煞起例目标支；先比较农历年干支与立春年柱，年界口径不一致时不自动选边。',
      '月相只保留日月黄经差、照明近似和前后朔弦望时刻，不把月相直接解释为吉凶。',
      '太阳高度与日出日落只作为地点相关的天文光照背景，不直接生成庙旺或吉凶结论。',
      '最终把输入缺省、模型差异和坐标近似作为强制限制证据。',
    ],
  };
}

/** 生成七政四余盘 */
export function generateQizheng(input: QizhengInput): QizhengResult {
  validateQizhengInput(input, true);
  if (input.useTrueSolarTime !== undefined && typeof input.useTrueSolarTime !== 'boolean') {
    throw new Error('useTrueSolarTime 必须是布尔值。');
  }
  const lat = input.latitude ?? 39.9;
  const lon = input.longitude ?? 116.4;
  const astronomicalTime = buildQizhengAstronomicalTime(input);
  const tz = astronomicalTime.timezone;
  const calculationContext = buildCalculationContext(input, lat, lon, astronomicalTime);
  const useTrueSolarTime = input.useTrueSolarTime === true;
  calculationContext.palaceTimeMode = useTrueSolarTime ? '真太阳时混合口径' : '民用时间';
  let palaceHour = input.hour;
  let palaceMinute = input.minute ?? 0;
  let traditionalDateParts = {
    year: input.year,
    month: input.month,
    day: input.day,
    hour: input.hour,
    minute: input.minute ?? 0,
    second: 0,
  };
  let trueSolarNote = '传统命宫所用生时与年界按输入民用时间记录；身宫直接取太阴所在宫';
  if (useTrueSolarTime) {
    if (input.longitude === undefined) {
      throw new Error('启用真太阳时时必须提供出生地经度。');
    }
    let standardMeridian = input.standardMeridian;
    let standardMeridianSource: QizhengCalculationContext['standardMeridianSource'] = '用户提供';
    if (standardMeridian === undefined) {
      if (input.timeZoneId) {
        throw new Error(
          `IANA 时区 ${input.timeZoneId} 只能确定历史法定钟表偏移，不能可靠推定真太阳时标准经线；请明确提供 standardMeridian。`,
        );
      }
      standardMeridianSource = '固定时区换算';
      standardMeridian = tz * 15;
    }
    const trueSolar = calculateTrueSolarTime(
      {
        year: input.year,
        month: input.month,
        day: input.day,
        hour: input.hour,
        minute: input.minute ?? 0,
      },
      lon,
      standardMeridian,
    );
    palaceHour = trueSolar.correctedTime.hour;
    palaceMinute = trueSolar.correctedTime.minute;
    traditionalDateParts = trueSolar.correctedTime;
    calculationContext.standardMeridian = standardMeridian;
    calculationContext.standardMeridianSource = standardMeridianSource;
    trueSolarNote = `传统命宫所用生时与可能跨日的年界已按真太阳时校正（标准经线${standardMeridian}°，来源${standardMeridianSource}；经度修正 ${trueSolar.longitudeCorrectionMinutes.toFixed(2)} 分，均时差 ${trueSolar.equationOfTimeMinutes.toFixed(2)} 分）；身宫直接取太阴所在宫，七政四余位置仍用现代星历`;
    calculationContext.palaceTimeNote = trueSolarNote;
  } else {
    calculationContext.palaceTimeNote = trueSolarNote;
  }
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
  const mansionBoundaries = calculateQizhengMansionBoundaries(
    new Date(astronomicalTime.unixMilliseconds),
  );
  const pushStar = (
    name: string,
    kind: '七政' | '四余',
    tropical: number,
    retrograde = false,
    sourceId: QizhengPositionSourceId = 'celestine-planets',
  ): void => {
    if (!Number.isFinite(tropical)) {
      throw new Error(`七政四余星体黄经无效：${name}=${String(tropical)}。`);
    }
    const longitude = normalizeLongitude(tropical);
    const { xiu, xiuDegree } = longitudeToQizhengMansion(longitude, mansionBoundaries);
    const sevenStar = TwentyEightStar.fromName(xiu).getSevenStar().getName();
    const zodiacBranch = longitudeToQizhengBranch(longitude);
    const source = QIZHENG_POSITION_SOURCES.find((item) => item.id === sourceId);
    if (!source) throw new Error(`七政四余位置来源缺失：${sourceId}。`);
    stars.push({
      name,
      kind,
      tropicalLongitude: longitude,
      longitude,
      xiu,
      sevenStar,
      xiuDegree,
      tropicalZodiacIndex: zodiacBranch.tropicalZodiacIndex,
      tropicalZodiac: zodiacBranch.tropicalZodiac,
      branchIndex: zodiacBranch.branchIndex,
      branch: zodiacBranch.branch,
      signIndex: zodiacBranch.branchIndex,
      palace: '',
      retrograde,
      sourceId,
      sourceLabel: source.provider,
      precisionClass: source.precisionClass,
    });
  };

  for (const p of chart.planets) {
    const m = PLANET_NAMES[p.name];
    if (!m) continue;
    pushStar(m.label, '七政', p.longitude, p.isRetrograde ?? false);
  }

  // 四余：罗睺=北交，计都=南交，月孛=真莉莉丝；紫炁依《七政算内篇》古法均速独立推算。
  const nodeMap = new Map(chart.nodes.map((n) => [n.name, n]));
  const lilith = chart.lilith?.[0];
  const north = nodeMap.get('North Node');
  const south = nodeMap.get('South Node');
  if (!north || !south || !lilith) {
    throw new Error('七政四余星体数据不完整：缺少罗睺、计都或月孛。');
  }
  pushStar('罗睺(火余)', '四余', north.longitude, false, 'celestine-true-node');
  pushStar('计都(土余)', '四余', south.longitude, false, 'celestine-true-node');
  pushStar('月孛(水余)', '四余', lilith.longitude, false, 'celestine-true-lilith');
  const ziqi = calculateZiqiPosition(input);
  pushStar('紫炁(木余)', '四余', ziqi.tropicalLongitude, false, 'qizhengsuan-ziqi');

  const sun = stars.find((s) => s.name === '太阳');
  const moon = stars.find((s) => s.name === '太阴');
  if (!sun || !moon || stars.filter((star) => star.kind === '七政').length !== 7) {
    throw new Error('七政星体数据不完整：必须包含日、月与五星。');
  }
  // 生时地支序（子0…亥11）：复用公共十二时辰；晚子时索引 12 归并为子支序 0。
  const shichen = getShichenFromClock(palaceHour, palaceMinute);
  if (!shichen) throw new Error('七政四余无法根据输入时间确定时辰。');
  const hourIdx = shichen.index % 12;

  const mingGong = calculateQizhengMingGong(sun.branchIndex, hourIdx);
  const shenGong = calculateQizhengShenGong(moon.branchIndex);
  const twelvePalaces = buildQizhengTwelvePalaces(mingGong);
  const palaceByBranch = new Map(twelvePalaces.map((item) => [item.branchIndex, item.palace]));
  for (const s of stars) {
    const palace = palaceByBranch.get(s.branchIndex);
    if (!palace) throw new Error(`七政四余星体宫位映射缺失：${s.name}。`);
    s.palace = palace;
  }

  const mingZhu = getQizhengMingZhu(mingGong);
  const traditionalChartFacts = buildQizhengTraditionalChartFacts({
    stars,
    sun,
    moon,
    hourBranchIndex: hourIdx,
    mingGong,
    shenGong,
    mingZhu,
    twelvePalaces,
  });
  const pairwiseAngles = buildQizhengPairwiseAngles(stars);
  const geometryCalculation: QizhengGeometryCalculation = {
    starCount: 11,
    starOrder: stars.map((star) => star.name),
    expectedPairCount: 55,
    actualPairCount: pairwiseAngles.length,
    enumeration: '全部无序星对',
    angleFormula: 'min(abs(longitude1-longitude2), 360-abs(longitude1-longitude2))',
    complete: pairwiseAngles.length === 55,
  };
  if (!geometryCalculation.complete) {
    throw new Error(`七政四余星对几何不完整：应有55组，实际${pairwiseAngles.length}组。`);
  }

  const traditionalYearBasis = buildQizhengTraditionalYearBasis(
    traditionalDateParts,
    useTrueSolarTime ? '真太阳时' : '民用时间',
  );
  const shenshaFacts = buildQizhengShenshaFacts(traditionalYearBasis);
  const shensha = shenshaFacts.map((fact) => ({
    name: fact.name,
    value: fact.targetBranch,
  }));
  const evidenceAnalysis = buildQizhengEvidence(stars, pairwiseAngles, calculationContext, {
    mingGong,
    shenGong,
    mingZhu,
    twelvePalaces,
    traditionalChartFacts,
    traditionalYearBasis,
    shenshaFacts,
    ziqi,
    ziqiModel: ZIQI_MODEL_INFO,
  });

  const prompt = [
    `【七政四余 · 果老星宗】`,
    `出生时空：${input.year}年${input.month}月${input.day}日 ${String(input.hour).padStart(2, '0')}:${String(input.minute ?? 0).padStart(2, '0')}，纬度${lat}°，经度${lon}°，UTC${tz >= 0 ? '+' : ''}${tz}。`,
    `七政：太阳、太阴、水、金、火、木、土；四余：罗睺、计都、月孛、紫炁。`,
    `紫炁推算口径：${ZIQI_MODEL_INFO.name}；周期${ZIQI_MODEL_INFO.periodDays}日，日行${ZIQI_MODEL_INFO.dailyMotionDegrees.toFixed(12)}°；${ZIQI_MODEL_INFO.precision}。`,
    `计算上下文：当地民用时间${calculationContext.localDateTime}，对应UTC ${calculationContext.utcDateTime}；地点来源${calculationContext.locationSource === '用户提供' ? '输入明确' : calculationContext.locationSource}，时区来源${calculationContext.timezoneSource === '用户提供' ? '输入明确' : calculationContext.timezoneSource}。`,
    `月相：${calculationContext.moonPhase.eightPhaseName}（${calculationContext.moonPhase.waxing ? '盈' : '亏'}），日月黄经差约${calculationContext.moonPhase.phaseAngleDegrees.toFixed(2)}°，照明约${calculationContext.moonPhase.illuminationPercent.toFixed(1)}%。`,
    `出生时刻光照：太阳高度${calculationContext.solarIllumination.solarAltitudeDegrees.toFixed(2)}°，方位角${calculationContext.solarIllumination.solarAzimuthDegrees.toFixed(2)}°，视太阳正午${calculationContext.solarIllumination.apparentSolarNoonLocalDateTime}。`,
    `位置来源：${QIZHENG_POSITION_SOURCES.map((source) => `${source.objects.join('、')}取自${source.provider}（${source.precisionClass}）`).join('；')}。`,
    `宿界模型：${QIZHENG_MANSION_MODEL.id}；28颗距星按目标日期真黄经形成实际弧段。`,
    `紫炁位置：顺行，传统均速模型回归黄经${ziqi.tropicalLongitude.toFixed(3)}°。`,
    ...stars.map(
      (s) =>
        `${s.kind} ${s.name}：目标日期黄经${s.longitude.toFixed(3)}°，热带黄道${s.tropicalZodiac}对应${s.branch}宫，在${s.xiu}宿${s.xiuDegree.toFixed(2)}度，落${s.palace}${s.retrograde ? '（逆）' : ''}；来源${s.sourceLabel}（${s.precisionClass}）`,
    ),
    `十一星星对几何：共55组无序星对，完整列出如下：${pairwiseAngles.map((pair) => `${pair.star1}与${pair.star2}实际最小夹角${pair.actualAngle.toFixed(2)}°（${pair.precisionClass}）`).join('；')}。`,
    `传统盘规则审计：${QIZHENG_TRADITIONAL_RULE_AUDIT.chart.reason}。`,
    `传统盘计算事实：${traditionalChartFacts.map((fact) => fact.promptText).join('；')}。`,
    `传统盘原典依据：${QIZHENG_TRADITIONAL_CHART_RULE_CATALOG.map((rule) => `${rule.name}规则为“${rule.rule}”，据${rule.sources.map((source) => `${source.title}${source.section}“${source.quote}”（${source.url}）`).join('、')}`).join('；')}。`,
    `传统盘使用边界：${QIZHENG_TRADITIONAL_CHART_RULE_CATALOG.map((rule) => rule.limitation)
      .filter((value, index, values) => values.indexOf(value) === index)
      .join('；')}`,
    `传统规则审计：庙旺未采用，${QIZHENG_TRADITIONAL_RULE_AUDIT.dignity.reason}；吊照未采用，${QIZHENG_TRADITIONAL_RULE_AUDIT.aspects.reason}。`,
    `命宫在${QIZHENG_EARTHLY_BRANCHES[mingGong]}宫，命主${mingZhu}；身宫按太阴所在宫取${QIZHENG_EARTHLY_BRANCHES[shenGong]}宫。`,
    trueSolarNote,
    `十二职宫逆布：${twelvePalaces.map((item) => `${item.palace}=${item.branch}宫`).join('；')}。`,
    `传统年界核验：${traditionalYearBasis.promptText}。`,
    shenshaFacts.length
      ? `传统神煞起例目标支：${shenshaFacts.map((fact) => `${fact.name}（生${fact.basis}${fact.basisValue}）→${fact.targetBranch}`).join('；')}。这些只是原典起例目标支，不代表已经落入具体宫位或与星曜相遇。`
      : '传统神煞起例目标支：农历年干支与立春年柱存在分歧，原典起例处未闭合岁首口径，本次不自动生成个人目标支；完整规则表已随结果保留，供后续在明确生年口径后查询。',
    `传统神煞起例来源：${QIZHENG_TRADITIONAL_RULE_AUDIT.shensha.sources.join('；')}；原典入口：${QIZHENG_SHENSHA_SOURCE_URL}。使用边界：${QIZHENG_SHENSHA_LIMITATION}。`,
  ].join('\n');

  return {
    stars,
    pairwiseAngles,
    geometryCalculation,
    traditionalRuleAudit: QIZHENG_TRADITIONAL_RULE_AUDIT,
    aspects: [],
    mingGong,
    mingGongBranch: QIZHENG_EARTHLY_BRANCHES[mingGong],
    shenGong,
    shenGongBranch: QIZHENG_EARTHLY_BRANCHES[shenGong],
    mingZhu,
    twelvePalaces,
    traditionalChartRuleCatalog: QIZHENG_TRADITIONAL_CHART_RULE_CATALOG,
    traditionalChartFacts,
    traditionalYearBasis,
    shenshaRuleCatalog: QIZHENG_SHENSHA_RULE_CATALOG,
    shenshaFacts,
    shensha,
    ziqiModel: ZIQI_MODEL_INFO,
    ziqi,
    calculationContext,
    positionSources: QIZHENG_POSITION_SOURCES,
    mansionBoundaries,
    mansionModel: QIZHENG_MANSION_MODEL,
    evidenceAnalysis,
    prompt,
  };
}

export const qizheng = {
  generateQizheng,
  getPrecessionOffset,
  calculateZiqiTropicalLongitude,
  calculateZiqiPosition,
  ZIQI_MODEL_INFO,
  QIZHENG_POSITION_SOURCES,
  QIZHENG_EARTHLY_BRANCHES,
  QIZHENG_TROPICAL_ZODIAC_SIGNS,
  QIZHENG_TROPICAL_ZODIAC_BRANCHES,
  QIZHENG_MING_ZHU_BY_BRANCH,
  QIZHENG_TRADITIONAL_CHART_RULE_CATALOG,
  QIZHENG_MANSION_STARS,
  QIZHENG_MANSION_MODEL,
  calculateQizhengMansionBoundaries,
  longitudeToQizhengMansion,
  longitudeToQizhengBranch,
  calculateQizhengMingGong,
  calculateQizhengShenGong,
  buildQizhengTwelvePalaces,
  getQizhengMingZhu,
};
