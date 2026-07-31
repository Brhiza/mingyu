/**
 * @file 七政四余（Qizheng Siyu / 果老星宗）
 * @description 中国占星：日、月、五星为七政；罗睺、计都、月孛、紫炁为四余。
 * 当前可用盘面采用可复算的现代天文位置与目标日期距星边界：
 *   - 安命宫：「以生时，加太阳宫，即从生时顺数见卯所临之宫，即为命宫。」（逢卯安命）
 *   - 安身宫：「以生时加太阴宫，即从生时逆数见酉所临之宫，即为身宫。」
 *   - 安十二宫：自命宫逆数（命、财帛、兄弟、田宅、男女、奴仆、妻妾、疾厄、迁移、官禄、福德、相貌）。
 *   - 安命主：寅亥木、卯戌火、辰酉金、巳申水、子丑土、午日、未月。
 *   - 二十八宿按明清修订距星目录，以 J2000/ICRS 坐标、自行和目标日期真黄道变换求边界。
 *   - 庙旺：原典条件未闭合，当前只登记未采用边界。
 *   - 吊照：固定容许度缺少可靠统一依据，当前完整提供星对几何而不自动判定。
 *   - 神煞：天乙贵人（日干）、驿马/劫煞/咸池/华盖/孤辰/寡宿（年支）。
 *
 * 紫炁采用单一《七政算内篇》古法均速模型：周积 10227.1792 日，日行三分五十七秒一四二九，
 * 历元按 PlanetCalendar 对《七政算内篇》至元十八年立元数据的现代复原值换算。
 * 罗计孛取月交点与真莉莉丝（celestine）。
 *
 * 七政、罗计孛与紫炁保留来源和精度分层；可复算不代表占星解释有效。
 */
import { calculateChart } from 'celestine';
import { TwentyEightStar } from 'tyme4ts';
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
import { getBranchIndex, getGanZhiFromDate, getStemIndex } from '../ganzhi';
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

/** 黄道十二宫（七政四余职名，子丑寅卯…自命宫逆布十二职） */
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
];

/** 命主：十二宫序（子0…亥11）→ 主星 */
const MING_ZHU: Record<number, string> = {
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
  signIndex: number; // 十二宫序号 0-11
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
  status: '未采用';
  reason: string;
  retainedFacts: string[];
  sources: string[];
}

export interface QizhengTraditionalRuleAudit {
  dignity: QizhengTraditionalRuleAuditItem;
  aspects: QizhengTraditionalRuleAuditItem;
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
    | '星对几何穷举';
  status: '已计算';
  inputs: Record<string, string | number | boolean>;
  result: Record<string, string | number | boolean>;
  dependsOnStepKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '七政四余计算步骤只记录民用时间、天文时间尺度、位置模型、距星宿界、宿度落宫与星对几何穷举的形成过程；不得把步骤完整度解释为观测级精度、占星有效性、现实吉凶或事件概率';
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
  type: '输入完整性' | '位置精度分层' | '星对几何覆盖';
  status: '输入明确' | '含默认值' | '同层现代天文' | '混合模型' | '完整穷举' | '有缺口';
  ownerFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '反证事实只记录七政四余输入是否使用默认值、位置来源是否混合精度及十一星的55组无序星对是否完整；默认值、混合模型或资料缺口不直接等于现实不利，有资料也不证明吉凶结果';
}

export interface QizhengCounterSummaryFact {
  key: 'qizheng:counter-summary';
  status: '存在需保留反证' | '未见额外反证';
  factKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '反证汇总只用于防止忽略默认输入、混合精度和星对几何缺口；不得据反证数量生成吉凶总分、可信度、事件概率或精度评分';
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
  counterEvidenceCount: number;
  limitationFactCount: number;
  promptText: string;
  sources: string[];
  limitation: '七政四余证据汇总只统计输入、时间尺度、位置来源、逐星、星对几何、月相光照、反证与限制覆盖；不得按数量生成吉凶等级、可信度、事件概率、观测精度或固定应期';
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
  '七政四余计算步骤只记录民用时间、天文时间尺度、位置模型、距星宿界、宿度落宫与星对几何穷举的形成过程；不得把步骤完整度解释为观测级精度、占星有效性、现实吉凶或事件概率' as const;
const QIZHENG_COUNTER_FACT_LIMITATION =
  '反证事实只记录七政四余输入是否使用默认值、位置来源是否混合精度及十一星的55组无序星对是否完整；默认值、混合模型或资料缺口不直接等于现实不利，有资料也不证明吉凶结果' as const;
const QIZHENG_COUNTER_SUMMARY_LIMITATION =
  '反证汇总只用于防止忽略默认输入、混合精度和星对几何缺口；不得据反证数量生成吉凶总分、可信度、事件概率或精度评分' as const;
const QIZHENG_LIMITATION_FACT_LIMITATION =
  '限制事实用于约束七政四余输入、时间尺度、位置来源、混合模型、传统规则、月相和光照资料可以支持的解释范围，不得被反向当作现实事件、吉凶或精度证据' as const;
const QIZHENG_SUMMARY_FACT_LIMITATION =
  '七政四余证据汇总只统计输入、时间尺度、位置来源、逐星、星对几何、月相光照、反证与限制覆盖；不得按数量生成吉凶等级、可信度、事件概率、观测精度或固定应期' as const;

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
   * 可选：启用后仅用真太阳时校正传统命身十二宫排布；
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
  shenGong: number;
  mingZhu: string;
  twelvePalaces: { palace: string; signIndex: number }[];
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
};

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

/** 天乙贵人（日干） */
function tianYiGuiRen(dayGan: string): string {
  const map: Record<string, string> = {
    甲: '丑未',
    戊: '丑未',
    庚: '丑未',
    乙: '子申',
    己: '子申',
    丙: '亥酉',
    丁: '亥酉',
    壬: '卯巳',
    癸: '卯巳',
    辛: '寅午',
  };
  getStemIndex(dayGan);
  const value = map[dayGan];
  if (!value) throw new Error(`七政四余天乙贵人资料缺失：${dayGan}。`);
  return value;
}

/** 年支三合局 → 各项神煞地支 */
function yearBranchShensha(yearBranch: string): {
  yi: string;
  jie: string;
  chi: string;
  hua: string;
  gu: string;
  gua: string;
} {
  getBranchIndex(yearBranch);
  const groups: Record<
    string,
    { yi: string; jie: string; chi: string; hua: string; gu: string; gua: string }
  > = {
    申: { yi: '寅', jie: '巳', chi: '酉', hua: '辰', gu: '巳', gua: '丑' },
    子: { yi: '寅', jie: '巳', chi: '酉', hua: '辰', gu: '巳', gua: '丑' },
    辰: { yi: '寅', jie: '巳', chi: '酉', hua: '辰', gu: '巳', gua: '丑' },
    寅: { yi: '申', jie: '亥', chi: '卯', hua: '戌', gu: '申', gua: '戌' },
    午: { yi: '申', jie: '亥', chi: '卯', hua: '戌', gu: '申', gua: '戌' },
    戌: { yi: '申', jie: '亥', chi: '卯', hua: '戌', gu: '申', gua: '戌' },
    巳: { yi: '亥', jie: '寅', chi: '午', hua: '丑', gu: '亥', gua: '未' },
    酉: { yi: '亥', jie: '寅', chi: '午', hua: '丑', gu: '亥', gua: '未' },
    丑: { yi: '亥', jie: '寅', chi: '午', hua: '丑', gu: '亥', gua: '未' },
    亥: { yi: '巳', jie: '申', chi: '子', hua: '未', gu: '寅', gua: '辰' },
    卯: { yi: '巳', jie: '申', chi: '子', hua: '未', gu: '寅', gua: '辰' },
    未: { yi: '巳', jie: '申', chi: '子', hua: '未', gu: '寅', gua: '辰' },
  };
  const sanhui: Record<string, { gu: string; gua: string }> = {
    亥: { gu: '寅', gua: '戌' },
    子: { gu: '寅', gua: '戌' },
    丑: { gu: '寅', gua: '戌' },
    寅: { gu: '巳', gua: '丑' },
    卯: { gu: '巳', gua: '丑' },
    辰: { gu: '巳', gua: '丑' },
    巳: { gu: '申', gua: '辰' },
    午: { gu: '申', gua: '辰' },
    未: { gu: '申', gua: '辰' },
    申: { gu: '亥', gua: '未' },
    酉: { gu: '亥', gua: '未' },
    戌: { gu: '亥', gua: '未' },
  };
  const base = groups[yearBranch];
  const guChen = sanhui[yearBranch];
  if (!base || !guChen) throw new Error(`七政四余年支神煞资料缺失：${yearBranch}。`);
  return { ...base, ...guChen };
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
      '十一星按稳定星序完整穷举55组无序星对并计算实际最小夹角',
      '庙旺与吊照规则因原典条件未闭合而登记为未采用，不自动生成结论',
    ],
  };
}

function buildQizhengCounterEvidenceFacts(args: {
  calculationFact: QizhengCalculationFact;
  positionSourceFacts: QizhengPositionSourceFact[];
  pairGeometryFacts: QizhengPairGeometryFact[];
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
  ];
}

function isQizhengCounterIssue(item: QizhengCounterEvidenceFact) {
  return !['输入明确', '同层现代天文', '完整穷举'].includes(item.status);
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
  context: QizhengCalculationContext;
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
      ownerFactKeys: pairGeometryOwnerKeys,
      promptText: `${QIZHENG_TRADITIONAL_RULE_AUDIT.dignity.reason}；${QIZHENG_TRADITIONAL_RULE_AUDIT.aspects.reason}`,
      sources: [
        ...QIZHENG_TRADITIONAL_RULE_AUDIT.dignity.sources,
        ...QIZHENG_TRADITIONAL_RULE_AUDIT.aspects.sources,
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
        ...pairGeometryOwnerKeys,
      ],
      promptText:
        '不得输出吉凶总分、成功率、疾病诊断、投资回报、人物意图、保证有效的化解方案或唯一应期；未校勘的庙旺与吊照不得补算，神煞只作辅证',
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
  counterEvidenceFacts: QizhengCounterEvidenceFact[];
  counterSummaryFact: QizhengCounterSummaryFact;
  limitationFacts: QizhengLimitationFact[];
  context: QizhengCalculationContext;
}): QizhengSummaryFact {
  const status =
    args.calculationFact.status === '输入明确' &&
    args.calculationFact.steps.length === 7 &&
    args.positionSourceFacts.length === 4 &&
    args.starFacts.length === 11 &&
    args.pairGeometryFacts.length === 55
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
    counterEvidenceCount: args.counterEvidenceFacts.length,
    limitationFactCount: args.limitationFacts.length,
    promptText: `证据链状态：${status}；位置来源${args.positionSourceFacts.length}项、逐星${args.starFacts.length}项、星对几何${args.pairGeometryFacts.length}项、反证${args.counterEvidenceFacts.length}项、限制${args.limitationFacts.length}项`,
    sources: ['七政四余输入、时间尺度、位置来源、逐星、星对几何、月相光照、反证与限制事实逐项汇总'],
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
    shensha: { name: string; value: string }[];
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
      promptText: '各星目标日期黄经按相邻距星实际弧段换算宿度，并映射十二宫、命宫与身宫',
      sources: ['二十八宿距星目标日期真黄经边界', '十二宫映射与安命安身规则'],
      limitation: QIZHENG_CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'qizheng:calculation:pair-geometry',
      stage: '星对几何穷举',
      status: '已计算',
      inputs: { starCount: stars.length },
      result: { expectedPairCount: 55, actualPairCount: pairwiseAngles.length },
      dependsOnStepKeys: ['qizheng:calculation:xiu-palace'],
      promptText: `十一星共55组无序星对，已按稳定星序完整计算${pairwiseAngles.length}组实际最小夹角`,
      sources: ['十一星目标日期黄经', '无序星对组合穷举与最小夹角计算'],
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
      '距星自行、目标日期真黄道、二十八宿与十二宫换算',
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
    signIndex: star.signIndex,
    palace: star.palace,
    retrograde: star.retrograde,
    sourceId: star.sourceId,
    sourceLabel: star.sourceLabel,
    precisionClass: star.precisionClass,
    promptText: `${star.name}（${star.kind}，${star.precisionClass}）：目标日期黄经${star.longitude.toFixed(3)}°，${star.xiu}宿${star.xiuDegree.toFixed(2)}度，落${star.palace}${star.retrograde ? '，逆行' : ''}`,
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
      `${fact.name}据${fact.sourceLabel}得${fact.precisionClass}位置，落${fact.palace}、${fact.xiu}宿`,
  );
  primaryFacts.push(
    `命宫落黄道第${structure.mingGong + 1}宫，身宫落黄道第${structure.shenGong + 1}宫，命主${structure.mingZhu}`,
  );
  const supportingFacts = pairGeometryFacts.map((pair) => pair.promptText);
  supportingFacts.push(
    `紫炁顺行回归黄经${structure.ziqi.tropicalLongitude.toFixed(3)}°，采用${structure.ziqiModel.name}并与现代天文位置分层`,
  );
  supportingFacts.push(
    `神煞定位：${structure.shensha.map((item) => `${item.name}${item.value}`).join('、')}`,
  );
  const counterEvidenceFacts = buildQizhengCounterEvidenceFacts({
    calculationFact,
    positionSourceFacts,
    pairGeometryFacts,
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
    context,
    locationSourceText,
    timezoneSourceText,
  });
  const limitations = limitationFacts.map((item) => item.promptText);
  const summaryFact = buildQizhengSummaryFact({
    calculationFact,
    positionSourceFacts,
    starFacts,
    pairGeometryFacts,
    counterEvidenceFacts,
    counterSummaryFact,
    limitationFacts,
    context,
  });
  const calculationChain = calculationSteps.map((item) => item.promptText);
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
      title: '紫炁与神煞定位',
      detail: supportingFacts.slice(-2).join('；'),
      source: '紫炁均速模型与年支、日干神煞规则',
      tags: ['紫炁', '神煞'],
    },
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
      '再按目标日期二十八宿距星真黄经边界换算宿度与十二宫；庙旺原典条件未闭合，当前不自动判定。',
      '完整穷举十一星的55组无序星对并保留实际最小夹角；固定容许度吊照缺少可靠统一依据，当前不自动判定。',
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
  let trueSolarNote = '传统命身十二宫按输入民用时间排布';
  if (useTrueSolarTime) {
    if (input.longitude === undefined) {
      throw new Error('启用真太阳时时必须提供出生地经度。');
    }
    const standardMeridian = tz * 15;
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
    trueSolarNote = `传统命身十二宫已按真太阳时校正（经度修正 ${trueSolar.longitudeCorrectionMinutes.toFixed(2)} 分，均时差 ${trueSolar.equationOfTimeMinutes.toFixed(2)} 分）；七政四余位置仍用现代星历`;
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
    const signIndex = Math.floor(longitude / 30);
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
      signIndex,
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
  const sunSign = sun.signIndex;
  const moonSign = moon.signIndex;

  // 生时地支序（子0…亥11）：复用公共十二时辰；晚子时索引 12 归并为子支序 0。
  const shichen = getShichenFromClock(palaceHour, palaceMinute);
  if (!shichen) throw new Error('七政四余无法根据输入时间确定时辰。');
  const hourIdx = shichen.index % 12;
  const MAO = 3,
    YOU = 9; // 卯、酉

  // 安命宫：「生时加太阳宫，顺数见卯」→ 命宫 = 太阳宫 + (卯 - 生时) mod 12
  const mingGong = (((sunSign + (MAO - hourIdx) + 12) % 12) + 12) % 12;
  // 安身宫：「生时加太阴宫，逆数见酉」→ 身宫 = 太阴宫 + (生时 - 酉) mod 12
  const shenGong = (((moonSign + (hourIdx - YOU) + 12) % 12) + 12) % 12;

  const twelvePalaces = TWELVE_PALACES.map((palace, i) => ({
    palace,
    signIndex: (mingGong - i + 12) % 12, // 自命宫逆布
  }));
  const palaceBySign = new Map(twelvePalaces.map((t) => [t.signIndex, t.palace]));
  for (const s of stars) {
    const palace = palaceBySign.get(s.signIndex);
    if (!palace) throw new Error(`七政四余星体宫位映射缺失：${s.name}。`);
    s.palace = palace;
  }

  const mingZhu = MING_ZHU[mingGong];
  if (!mingZhu) throw new Error(`七政四余命主资料缺失：命宫序号 ${mingGong}。`);
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

  // 神煞（年支 + 日干）
  const dateGanZhi = getGanZhiFromDate(
    new Date(input.year, input.month - 1, input.day, input.hour, input.minute ?? 0),
  );
  const yearBranch = dateGanZhi.year[1];
  const dayGan = dateGanZhi.day[0];
  const ys = yearBranchShensha(yearBranch);
  const shensha = [
    { name: '天乙贵人', value: tianYiGuiRen(dayGan) },
    { name: '驿马', value: ys.yi },
    { name: '劫煞', value: ys.jie },
    { name: '咸池', value: ys.chi },
    { name: '华盖', value: ys.hua },
    { name: '孤辰', value: ys.gu },
    { name: '寡宿', value: ys.gua },
  ];
  const evidenceAnalysis = buildQizhengEvidence(stars, pairwiseAngles, calculationContext, {
    mingGong,
    shenGong,
    mingZhu,
    shensha,
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
        `${s.kind} ${s.name}：目标日期黄经${s.longitude.toFixed(3)}°，在${s.xiu}宿${s.xiuDegree.toFixed(2)}度，落${s.palace}${s.retrograde ? '（逆）' : ''}；来源${s.sourceLabel}（${s.precisionClass}）`,
    ),
    `十一星星对几何：共55组无序星对，完整列出如下：${pairwiseAngles.map((pair) => `${pair.star1}与${pair.star2}实际最小夹角${pair.actualAngle.toFixed(2)}°（${pair.precisionClass}）`).join('；')}。`,
    `传统规则审计：庙旺未采用，${QIZHENG_TRADITIONAL_RULE_AUDIT.dignity.reason}；吊照未采用，${QIZHENG_TRADITIONAL_RULE_AUDIT.aspects.reason}。`,
    `命宫在${TWELVE_PALACES[0]}（黄道第 ${mingGong + 1} 宫），命主${mingZhu}；身宫在第 ${shenGong + 1} 宫。`,
    trueSolarNote,
    `十二宫映射：${twelvePalaces.map((item) => `${item.palace}=黄道第${item.signIndex + 1}宫`).join('；')}。`,
    `神煞：天乙贵人${shensha[0].value}、驿马${shensha[1].value}、劫煞${shensha[2].value}、咸池${shensha[3].value}、华盖${shensha[4].value}、孤辰${shensha[5].value}、寡宿${shensha[6].value}。`,
  ].join('\n');

  return {
    stars,
    pairwiseAngles,
    geometryCalculation,
    traditionalRuleAudit: QIZHENG_TRADITIONAL_RULE_AUDIT,
    aspects: [],
    mingGong,
    shenGong,
    mingZhu,
    twelvePalaces,
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
  QIZHENG_MANSION_STARS,
  QIZHENG_MANSION_MODEL,
  calculateQizhengMansionBoundaries,
  longitudeToQizhengMansion,
};
