/**
 * @file 七政四余（Qizheng Siyu / 果老星宗）
 * @description 中国占星：日、月、五星为七政；罗睺、计都、月孛、紫炁为四余。
 * 完整传统盘采用可复算的现代天文位置与目标日期距星边界：
 *   - 安命宫：「以生时，加太阳宫，即从生时顺数见卯所临之宫，即为命宫。」（逢卯安命）
 *   - 安身宫：「以生时加太阴宫，即从生时逆数见酉所临之宫，即为身宫。」
 *   - 安十二宫：自命宫逆数（命、财帛、兄弟、田宅、男女、奴仆、妻妾、疾厄、迁移、官禄、福德、相貌）。
 *   - 安命主：寅亥木、卯戌火、辰酉金、巳申水、子丑土、午日、未月。
 *   - 二十八宿按明清修订距星目录，以 J2000/ICRS 坐标、自行和目标日期真黄道变换求边界。
 *   - 星曜喜怒：七政于十二宫之庙、旺、喜、乐，采用《星学大成》第三章明载歌诀。
 *   - 神煞：天乙贵人（日干）、驿马/劫煞/咸池/华盖/孤辰/寡宿（年支）。
 *
 * 紫炁采用单一《七政算内篇》古法均速模型：周积 10227.1792 日，日行三分五十七秒一四二九，
 * 历元按 PlanetCalendar 对《七政算内篇》至元十八年立元数据的现代复原值换算。
 * 罗计取月球真交点，月孛取月球平均远地点的黄道投影。
 *
 * 七政、罗计孛与紫炁保留来源和精度分层；可复算不代表占星解释有效。
 */
import * as AstronomyEngine from 'astronomy-engine';
import type { Body } from 'astronomy-engine';
import { SevenStar, TwentyEightStar } from 'tyme4ts';
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

// astronomy-engine 在 Node 22 的 tsx 环境中可能以 default 暴露，浏览器和 Rollup
// 则通常直接暴露具名导出。动态读取只用于选择运行时模块形态，避免静态读取
// `default` 触发 Rollup 的 "default is not exported" 警告。
const astronomyNamespace = AstronomyEngine as unknown as Record<string, unknown>;
const Astronomy = (Reflect.get(astronomyNamespace, 'default') ??
  AstronomyEngine) as typeof AstronomyEngine;
const {
  Body: AstronomyBody,
  Ecliptic,
  EclipticGeoMoon,
  GeoMoonState,
  GeoVector,
  MakeTime,
  RotateState,
  Rotation_EQJ_ECT,
} = Astronomy;

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

/**
 * 现代回归黄经十二宫与传统宫支的固定对应。
 * astronomy-engine 的 0 宫从白羊起，而传统果老盘按戌、酉……亥排列，二者不可共用同一数字序。
 */
export const QIZHENG_SIGN_BRANCHES = [
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

export type QizhengSignBranch = (typeof QIZHENG_SIGN_BRANCHES)[number];

/** 命主：《星学大成》所载寅亥木、卯戌火、辰酉金、巳申水、子丑土、午日、未月。 */
const MING_ZHU_BY_BRANCH: Record<QizhengSignBranch, string> = {
  子: '土',
  丑: '土',
  寅: '木',
  卯: '火',
  辰: '金',
  巳: '水',
  午: '日',
  未: '月',
  申: '水',
  酉: '金',
  戌: '火',
  亥: '木',
};

type QizhengDignityBranches = {
  miao: readonly QizhengSignBranch[];
  wang: readonly QizhengSignBranch[];
  xi: readonly QizhengSignBranch[];
  le: readonly QizhengSignBranch[];
};

/** 《星学大成·第三章星曜喜怒》七政庙、旺、喜、乐表；同宫状态可以重叠。 */
const DIGNITY: Record<string, QizhengDignityBranches> = {
  日: { miao: ['戌'], wang: ['巳'], xi: ['寅'], le: ['午'] },
  月: { miao: ['戌'], wang: ['酉'], xi: ['亥'], le: ['未'] },
  水: { miao: ['午'], wang: ['子', '巳'], xi: ['辰'], le: ['巳', '申'] },
  金: { miao: ['辰'], wang: ['午', '亥'], xi: [], le: ['辰', '酉'] },
  火: { miao: ['卯'], wang: ['丑'], xi: ['申'], le: ['卯', '戌'] },
  木: { miao: ['亥'], wang: ['未', '亥'], xi: ['未'], le: ['亥', '寅'] },
  土: { miao: ['丑'], wang: ['卯', '辰'], xi: ['午'], le: ['子', '丑'] },
};

export interface QizhengStar {
  name: string;
  kind: '七政' | '四余';
  tropicalLongitude: number; // 回归黄经 0-360
  longitude: number; // 目标日期真黄经 0-360，用于距星宿界与吊照
  xiu: string;
  sevenStar: string;
  xiuDegree: number;
  signIndex: number; // 现代回归黄经宫序：白羊0…双鱼11
  signBranch: QizhengSignBranch;
  palace: string;
  retrograde?: boolean;
  dignity?: string; // 庙/旺/喜/乐可并见，否则为平；四余为 —
  sourceId: QizhengPositionSourceId;
  sourceLabel: string;
  precisionClass: '现代天文计算' | '传统均速模型';
}

export interface QizhengAspect {
  star1: string;
  star2: string;
  type: '同宫' | '六合' | '四正' | '三方' | '对照';
  exactAngle: number;
  actualAngle: number;
  orb: number;
  allowedOrb: number;
  /** 偏差占当前相位容许度的比例，0为精确相位，1为容许度边界。 */
  orbRatio: number;
  closeness: '紧密' | '中等' | '宽松';
  precisionClass: '同层现代天文' | '混合模型';
  source: string;
}

export type QizhengPositionSourceId =
  | 'astronomy-engine-planets'
  | 'astronomy-engine-true-node'
  | 'moshier-mean-lilith'
  | 'qizhengsuan-ziqi';

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
  aspectFacts: QizhengAspectFact[];
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
    | '吊照筛选';
  status: '已计算';
  inputs: Record<string, string | number | boolean>;
  result: Record<string, string | number | boolean>;
  dependsOnStepKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '七政四余计算步骤只记录民用时间、天文时间尺度、位置模型、距星宿界、宿度落宫与吊照筛选的形成过程；不得把步骤完整度解释为观测级精度、占星有效性、现实吉凶或事件概率';
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
  signBranch: QizhengSignBranch;
  palace: string;
  retrograde?: boolean;
  dignity?: string;
  sourceId: QizhengPositionSourceId;
  sourceLabel: string;
  precisionClass: QizhengStar['precisionClass'];
  promptText: string;
  sources: string[];
  limitation: '逐星位置是目标日期黄经、距星宿度与落宫的计算事实；现代天文计算和传统均速模型必须分层使用，不单独证明人格、现实事件、吉凶或应期';
}

export interface QizhengAspectFact {
  key: string;
  star1: string;
  star2: string;
  type: QizhengAspect['type'];
  exactAngle: number;
  actualAngle: number;
  orb: number;
  allowedOrb: number;
  orbRatio: number;
  closeness: QizhengAspect['closeness'];
  precisionClass: QizhengAspect['precisionClass'];
  promptText: string;
  sources: string[];
  limitation: '吊照相位只描述两星目标日期黄经在当前容许度内的几何关系；混合模型不得提升为现代天文同精度证据，也不代表吉凶比例、事件概率或必然结果';
}

export interface QizhengCounterEvidenceFact {
  key: string;
  type: '输入完整性' | '位置精度分层' | '吊照覆盖';
  status: '输入明确' | '含默认值' | '同层现代天文' | '混合模型' | '有可用证据' | '未见';
  ownerFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '反证事实只记录七政四余输入是否使用默认值、位置来源是否混合精度及当前容许度内是否有吊照；默认值、混合模型或未见吊照不直接等于现实不利，有资料也不证明吉凶结果';
}

export interface QizhengCounterSummaryFact {
  key: 'qizheng:counter-summary';
  status: '存在需保留反证' | '未见额外反证';
  factKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '反证汇总只用于防止忽略默认输入、混合精度和吊照未见项；不得据反证数量生成吉凶总分、可信度、事件概率或精度评分';
}

export interface QizhengLimitationFact {
  key: string;
  type:
    | '输入默认边界'
    | '时间尺度边界'
    | '位置来源边界'
    | '混合精度边界'
    | '吊照边界'
    | '月相光照边界'
    | '高风险输出边界';
  status: '适用';
  ownerFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '限制事实用于约束七政四余输入、时间尺度、位置来源、混合模型、吊照、月相和光照资料可以支持的解释范围，不得被反向当作现实事件、吉凶或精度证据';
}

export interface QizhengSummaryFact {
  key: 'qizheng:evidence-summary';
  status: '证据链完整' | '证据链有缺口';
  factKeys: string[];
  positionSourceFactCount: number;
  starFactCount: number;
  aspectFactCount: number;
  counterEvidenceCount: number;
  limitationFactCount: number;
  promptText: string;
  sources: string[];
  limitation: '七政四余证据汇总只统计输入、时间尺度、位置来源、逐星、吊照、月相光照、反证与限制覆盖；不得按数量生成吉凶等级、可信度、事件概率、观测精度或固定应期';
}

const STAR_FACT_LIMITATION =
  '逐星位置是目标日期黄经、距星宿度与落宫的计算事实；现代天文计算和传统均速模型必须分层使用，不单独证明人格、现实事件、吉凶或应期' as const;

const ASPECT_FACT_LIMITATION =
  '吊照相位只描述两星目标日期黄经在当前容许度内的几何关系；混合模型不得提升为现代天文同精度证据，也不代表吉凶比例、事件概率或必然结果' as const;
const CALCULATION_FACT_LIMITATION =
  '计算链只证明民用时间、时区、地点、天文时间尺度、位置模型和坐标换算如何形成当前七政四余盘；默认地点、近似时间尺度与传统均速模型不得提升为真实出生地或观测级精度，也不证明现实事件或吉凶结果' as const;
const POSITION_SOURCE_FACT_LIMITATION =
  '位置来源事实只说明各星体采用的提供方、模型、坐标和精度层级；来源可追溯不等于结果达到观测级精度，也不证明占星解释、现实事件或吉凶结论' as const;
const QIZHENG_CALCULATION_STEP_LIMITATION =
  '七政四余计算步骤只记录民用时间、天文时间尺度、位置模型、距星宿界、宿度落宫与吊照筛选的形成过程；不得把步骤完整度解释为观测级精度、占星有效性、现实吉凶或事件概率' as const;
const QIZHENG_COUNTER_FACT_LIMITATION =
  '反证事实只记录七政四余输入是否使用默认值、位置来源是否混合精度及当前容许度内是否有吊照；默认值、混合模型或未见吊照不直接等于现实不利，有资料也不证明吉凶结果' as const;
const QIZHENG_COUNTER_SUMMARY_LIMITATION =
  '反证汇总只用于防止忽略默认输入、混合精度和吊照未见项；不得据反证数量生成吉凶总分、可信度、事件概率或精度评分' as const;
const QIZHENG_LIMITATION_FACT_LIMITATION =
  '限制事实用于约束七政四余输入、时间尺度、位置来源、混合模型、吊照、月相和光照资料可以支持的解释范围，不得被反向当作现实事件、吉凶或精度证据' as const;
const QIZHENG_SUMMARY_FACT_LIMITATION =
  '七政四余证据汇总只统计输入、时间尺度、位置来源、逐星、吊照、月相光照、反证与限制覆盖；不得按数量生成吉凶等级、可信度、事件概率、观测精度或固定应期' as const;

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
  aspects: QizhengAspect[];
  mingGong: number;
  shenGong: number;
  mingZhu: string;
  twelvePalaces: { palace: string; signIndex: number; signBranch: QizhengSignBranch }[];
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

const QIZHENG_ASPECTS: ReadonlyArray<{
  type: QizhengAspect['type'];
  angle: number;
  orb: number;
}> = [
  { type: '同宫', angle: 0, orb: 8 },
  { type: '六合', angle: 60, orb: 4 },
  { type: '四正', angle: 90, orb: 6 },
  { type: '三方', angle: 120, orb: 6 },
  { type: '对照', angle: 180, orb: 8 },
];

function buildQizhengAspects(stars: QizhengStar[]): QizhengAspect[] {
  const aspects: QizhengAspect[] = [];
  for (let first = 0; first < stars.length - 1; first += 1) {
    for (let second = first + 1; second < stars.length; second += 1) {
      const raw = Math.abs(stars[first].longitude - stars[second].longitude);
      const actualAngle = raw > 180 ? 360 - raw : raw;
      const matched = QIZHENG_ASPECTS.map((aspect) => ({
        ...aspect,
        deviation: Math.abs(actualAngle - aspect.angle),
      }))
        .filter((aspect) => aspect.deviation <= aspect.orb)
        .sort((a, b) => a.deviation / a.orb - b.deviation / b.orb)[0];
      if (!matched) continue;
      const ratio = matched.deviation / matched.orb;
      aspects.push({
        star1: stars[first].name,
        star2: stars[second].name,
        type: matched.type,
        exactAngle: matched.angle,
        actualAngle: Number(actualAngle.toFixed(4)),
        orb: Number(matched.deviation.toFixed(4)),
        allowedOrb: matched.orb,
        orbRatio: Number(ratio.toFixed(4)),
        closeness: ratio <= 1 / 3 ? '紧密' : ratio <= 2 / 3 ? '中等' : '宽松',
        precisionClass:
          stars[first].precisionClass === '现代天文计算' &&
          stars[second].precisionClass === '现代天文计算'
            ? '同层现代天文'
            : '混合模型',
        source: `${stars[first].name}与${stars[second].name}目标日期黄经最小夹角及${matched.type}容许度`,
      });
    }
  }
  return aspects.sort((a, b) => a.orbRatio - b.orbRatio || a.orb - b.orb);
}

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
    id: 'astronomy-engine-planets',
    objects: ['太阳', '太阴', '辰星(水)', '太白(金)', '荧惑(火)', '岁星(木)', '镇星(土)'],
    provider: 'astronomy-engine 2.1.19',
    calculation: '按UTC时刻计算七政地心回归黄经及逆行状态',
    coordinate: '目标日期回归黄经；与同日二十八宿距星真黄经边界比较得到宿度',
    precisionClass: '现代天文计算',
    limitations: [
      '采用 Astronomy Engine 标准太阳系算法，并已用 Swiss Ephemeris/JPL DE440 独立抽样复算',
      '太阳、水金火木土、罗计孛抽样最大偏差均低于0.01°；太阴在2200年单样本约0.05°，不改变二十八宿与十二宫归属',
      '不得仅凭页面显示小数位宣称达到观测级或JPL星历精度',
    ],
  },
  {
    id: 'astronomy-engine-true-node',
    objects: ['罗睺(火余)', '计都(土余)'],
    provider: 'astronomy-engine GeoMoonState + ECT',
    calculation: '罗睺取月球真北交点，计都取真北交点加180°（真南交点）',
    coordinate: '目标日期回归黄经；与同日二十八宿距星真黄经边界比较得到宿度',
    precisionClass: '现代天文计算',
    limitations: [
      '这是当前计算明确采用的真交点口径，不与平均交点混用',
      '真交点经度已用 Swiss Ephemeris/JPL DE440 独立抽样复算；瞬时逆行状态不输出',
    ],
  },
  {
    id: 'moshier-mean-lilith',
    objects: ['月孛(水余)'],
    provider: 'Moshier 平均月球根数',
    calculation: '月孛取月球平均远地点并投影到黄道',
    coordinate: '目标日期回归黄经；与同日二十八宿距星真黄经边界比较得到宿度',
    precisionClass: '现代天文计算',
    limitations: [
      '月孛存在平均远地点、瞬时真远地点等不同口径；当前计算只采用平均远地点口径',
      '该口径已用 Swiss Ephemeris Moshier 平均根数独立抽样复算',
    ],
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

const J2000_JD = 2_451_545;
const UNIX_EPOCH_JD = 2_440_587.5;
const JULIAN_CENTURY_DAYS = 36_525;
const LUNAR_INCLINATION_DEGREES = 5.1453964;

/** Swiss Ephemeris Moshier 平均月球根数的长期项。 */
const MOSHIER_LUNAR_Z: number[] = [
  -13.12045233711, -0.00113821591258, -0.000009646018347184, 31.468347198839, 0.0476835758578,
  -0.0003421689790404, -6.84707090541, -0.005834100476561, -0.0002905334122698, -5.663161722088,
  0.005722859298199, -0.00008466472828815,
];

function modArcSeconds(value: number): number {
  return ((value % 1_296_000) + 1_296_000) % 1_296_000;
}

function moshierMeanNodeLongitude(jd: number): number {
  const t = (jd - J2000_JD) / JULIAN_CENTURY_DAYS;
  const t2 = t * t;
  const fracT = t % 1;
  const nfArc = modArcSeconds(
    1_739_232_000 * fracT + 295_263.0983 * t - 0.207941990176 * t + 335_779.55755,
  );
  const lpArc = modArcSeconds(
    1_731_456_000 * fracT + 1_108_372.83264 * t - 0.6784914260953 * t + 785_939.95571,
  );
  const nf = nfArc + ((MOSHIER_LUNAR_Z[2] * t + MOSHIER_LUNAR_Z[1]) * t + MOSHIER_LUNAR_Z[0]) * t2;
  const lp =
    lpArc + ((MOSHIER_LUNAR_Z[11] * t + MOSHIER_LUNAR_Z[10]) * t + MOSHIER_LUNAR_Z[9]) * t2;
  return normalizeLongitude(((lp - nf) / 3600 + 360) % 360);
}

function moshierMeanApogeeLongitude(jd: number): number {
  const t = (jd - J2000_JD) / JULIAN_CENTURY_DAYS;
  const t2 = t * t;
  const fracT = t % 1;
  const mpArc = modArcSeconds(
    1_717_200_000 * fracT + 715_923.4728 * t - 0.2035946368532 * t + 485_868.28096,
  );
  const lpArc = modArcSeconds(
    1_731_456_000 * fracT + 1_108_372.83264 * t - 0.6784914260953 * t + 785_939.95571,
  );
  const mp = mpArc + ((MOSHIER_LUNAR_Z[5] * t + MOSHIER_LUNAR_Z[4]) * t + MOSHIER_LUNAR_Z[3]) * t2;
  const lp =
    lpArc + ((MOSHIER_LUNAR_Z[11] * t + MOSHIER_LUNAR_Z[10]) * t + MOSHIER_LUNAR_Z[9]) * t2;
  return normalizeLongitude((modArcSeconds(lp - mp + 648_000) / 3600 + 360) % 360);
}

function trueNodeLongitude(utcMs: number): number {
  const time = MakeTime(new Date(utcMs));
  const state = RotateState(Rotation_EQJ_ECT(time), GeoMoonState(time));
  const hx = state.y * state.vz - state.z * state.vy;
  const hy = state.z * state.vx - state.x * state.vz;
  return normalizeLongitude(Math.atan2(hx, -hy) * (180 / Math.PI));
}

function moshierMeanLilithLongitude(utcMs: number): number {
  const jd = utcMs / 86_400_000 + UNIX_EPOCH_JD;
  const node = moshierMeanNodeLongitude(jd);
  const apogee = moshierMeanApogeeLongitude(jd);
  const u = ((apogee - node) * Math.PI) / 180;
  return normalizeLongitude(
    node +
      Math.atan2(Math.cos((LUNAR_INCLINATION_DEGREES * Math.PI) / 180) * Math.sin(u), Math.cos(u)) *
        (180 / Math.PI),
  );
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

const PLANET_NAMES: Record<string, { label: string; key: string }> = {
  Sun: { label: '太阳', key: SevenStar.fromName('日').getName() },
  Moon: { label: '太阴', key: SevenStar.fromName('月').getName() },
  Mercury: { label: '辰星(水)', key: SevenStar.fromName('水').getName() },
  Venus: { label: '太白(金)', key: SevenStar.fromName('金').getName() },
  Mars: { label: '荧惑(火)', key: SevenStar.fromName('火').getName() },
  Jupiter: { label: '岁星(木)', key: SevenStar.fromName('木').getName() },
  Saturn: { label: '镇星(土)', key: SevenStar.fromName('土').getName() },
};

const PLANET_BODIES: Record<string, Body> = {
  Sun: AstronomyBody.Sun,
  Moon: AstronomyBody.Moon,
  Mercury: AstronomyBody.Mercury,
  Venus: AstronomyBody.Venus,
  Mars: AstronomyBody.Mars,
  Jupiter: AstronomyBody.Jupiter,
  Saturn: AstronomyBody.Saturn,
};

function angleDifferenceDegrees(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

function astronomyEclipticLongitude(body: Body, utcMs: number): number {
  const time = MakeTime(new Date(utcMs));
  if (body === AstronomyBody.Moon) {
    return EclipticGeoMoon(time).lon;
  }
  return Ecliptic(GeoVector(body, time, true)).elon;
}

function astronomyRetrograde(body: Body, utcMs: number): boolean {
  if (body === AstronomyBody.Sun || body === AstronomyBody.Moon) return false;
  const before = astronomyEclipticLongitude(body, utcMs - 432_000);
  const after = astronomyEclipticLongitude(body, utcMs + 432_000);
  return angleDifferenceDegrees(before, after) < 0;
}

/** 将现代黄经宫序换成传统宫支。 */
export function getQizhengSignBranch(signIndex: number): QizhengSignBranch {
  if (!Number.isInteger(signIndex) || signIndex < 0 || signIndex > 11) {
    throw new Error(`七政四余黄道宫位无效：${String(signIndex)}。`);
  }
  const branch = QIZHENG_SIGN_BRANCHES[signIndex];
  if (!branch) throw new Error(`七政四余宫支映射缺失：${String(signIndex)}。`);
  return branch;
}

/** 按命宫实际宫支查命主，避免把白羊起的黄经宫序误作子支起序。 */
export function getQizhengMingZhu(signIndex: number): string {
  const branch = getQizhengSignBranch(signIndex);
  const mingZhu = MING_ZHU_BY_BRANCH[branch];
  if (!mingZhu) throw new Error(`七政四余命主资料缺失：命宫${branch}。`);
  return mingZhu;
}

/** 《星学大成》七政庙旺喜乐判定；同一宫命中多种状态时全部保留。 */
export function getQizhengDignity(key: string, signIndex: number): string {
  const branch = getQizhengSignBranch(signIndex);
  const d = DIGNITY[key];
  if (!d) throw new Error(`七政四余庙旺资料缺失：${key}。`);
  const statuses = [
    d.miao.includes(branch) ? '庙' : '',
    d.wang.includes(branch) ? '旺' : '',
    d.xi.includes(branch) ? '喜' : '',
    d.le.includes(branch) ? '乐' : '',
  ].filter(Boolean);
  return statuses.length ? statuses.join('/') : '平';
}

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
      '七政由Astronomy Engine按UTC时刻计算地心真黄经及逆行状态',
      '罗睺、计都由Astronomy Engine月球状态向量计算真交点，月孛按Moshier平均远地点计算',
      '紫炁按《七政算内篇》独立古法均速模型计算回归黄经',
      '二十八宿距星J2000坐标与自行由成熟天文库转换为目标日期真黄经',
      '各星目标日期黄经按相邻距星实际弧段换算宿度',
    ],
  };
}

function buildQizhengCounterEvidenceFacts(args: {
  calculationFact: QizhengCalculationFact;
  positionSourceFacts: QizhengPositionSourceFact[];
  aspectFacts: QizhengAspectFact[];
}): QizhengCounterEvidenceFact[] {
  const hasMixedPrecision =
    args.positionSourceFacts.some((item) => item.precisionClass === '传统均速模型') ||
    args.aspectFacts.some((item) => item.precisionClass === '混合模型');
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
        ? '七政、罗计、月孛与紫炁采用不同精度层级，混合吊照必须保留模型分层'
        : '当前参与关系的位置来源均属同层现代天文计算',
      sources: ['逐对象位置来源、坐标口径与精度层级核验'],
      limitation: QIZHENG_COUNTER_FACT_LIMITATION,
    },
    {
      key: 'qizheng:counter:aspects',
      type: '吊照覆盖',
      status: args.aspectFacts.length ? '有可用证据' : '未见',
      ownerFactKeys: args.aspectFacts.length
        ? args.aspectFacts.map((item) => item.key)
        : ['qizheng:calculation:aspects'],
      promptText: args.aspectFacts.length
        ? `当前容许度内列出${args.aspectFacts.length}组吊照关系`
        : '当前容许度内未见吊照关系，不得为了形成结论而放宽容许度或补造关系',
      sources: ['目标日期黄经最小夹角与吊照容许度筛选'],
      limitation: QIZHENG_COUNTER_FACT_LIMITATION,
    },
  ];
}

function isQizhengCounterIssue(item: QizhengCounterEvidenceFact) {
  return !['输入明确', '同层现代天文', '有可用证据'].includes(item.status);
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
      : '输入完整性、位置精度分层与吊照覆盖未见额外缺口',
    sources: ['输入默认值、位置来源精度与吊照覆盖逐项汇总'],
    limitation: QIZHENG_COUNTER_SUMMARY_LIMITATION,
  };
}

function buildQizhengLimitationFacts(args: {
  calculationFact: QizhengCalculationFact;
  positionSourceFacts: QizhengPositionSourceFact[];
  starFacts: QizhengStarFact[];
  aspectFacts: QizhengAspectFact[];
  context: QizhengCalculationContext;
  locationSourceText: string;
  timezoneSourceText: string;
}): QizhengLimitationFact[] {
  const aspectOwnerKeys = args.aspectFacts.length
    ? args.aspectFacts.map((item) => item.key)
    : ['qizheng:calculation:aspects'];
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
        ...args.aspectFacts
          .filter((item) => item.precisionClass === '混合模型')
          .map((item) => item.key),
      ],
      promptText:
        '七政、罗计与月孛来自现代天文计算，紫炁来自传统均速模型；混合模型吊照不得按相同精度比较或提升为现代天文证据',
      sources: ['现代天文位置与《七政算内篇》紫炁均速模型分层'],
    },
    {
      key: 'qizheng:limitation:aspects',
      type: '吊照边界',
      ownerFactKeys: aspectOwnerKeys,
      promptText:
        '吊照仅表示进入当前容许度，紧密等级和归一化容许度位置不代表成功率、吉凶百分比、事件概率或必然结果',
      sources: ['吊照实际夹角、精确角与允许容许度'],
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
        ...aspectOwnerKeys,
      ],
      promptText:
        '不得输出吉凶总分、成功率、疾病诊断、投资回报、人物意图、保证有效的化解方案或唯一应期；神煞只作辅证',
      sources: ['盘面位置、吊照、神煞与现实结果分离原则'],
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
  aspectFacts: QizhengAspectFact[];
  counterEvidenceFacts: QizhengCounterEvidenceFact[];
  counterSummaryFact: QizhengCounterSummaryFact;
  limitationFacts: QizhengLimitationFact[];
  context: QizhengCalculationContext;
}): QizhengSummaryFact {
  const status =
    args.calculationFact.status === '输入明确' &&
    args.calculationFact.steps.length === 7 &&
    args.positionSourceFacts.length === 4 &&
    args.starFacts.length === 11
      ? '证据链完整'
      : '证据链有缺口';
  return {
    key: 'qizheng:evidence-summary',
    status,
    factKeys: Array.from(
      new Set([
        args.calculationFact.key,
        ...args.calculationFact.steps.map((item) => item.key),
        ...args.positionSourceFacts.map((item) => item.key),
        ...args.starFacts.map((item) => item.key),
        ...args.aspectFacts.map((item) => item.key),
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
    aspectFactCount: args.aspectFacts.length,
    counterEvidenceCount: args.counterEvidenceFacts.length,
    limitationFactCount: args.limitationFacts.length,
    promptText: `证据链状态：${status}；位置来源${args.positionSourceFacts.length}项、逐星${args.starFacts.length}项、吊照${args.aspectFacts.length}项、反证${args.counterEvidenceFacts.length}项、限制${args.limitationFacts.length}项`,
    sources: ['七政四余输入、时间尺度、位置来源、逐星、吊照、月相光照、反证与限制事实逐项汇总'],
    limitation: QIZHENG_SUMMARY_FACT_LIMITATION,
  };
}

function buildQizhengEvidence(
  stars: QizhengStar[],
  aspects: QizhengAspect[],
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
      promptText:
        '七政由Astronomy Engine、罗计由月球状态向量真交点、月孛按Moshier平均远地点计算回归黄经',
      sources: [
        'astronomy-engine GeoVector/Ecliptic',
        'astronomy-engine GeoMoonState/ECT',
        'Swiss Ephemeris Moshier 平均月球根数',
      ],
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
      key: 'qizheng:calculation:aspects',
      stage: '吊照筛选',
      status: '已计算',
      inputs: { starCount: stars.length },
      result: { aspectCount: aspects.length },
      dependsOnStepKeys: ['qizheng:calculation:xiu-palace'],
      promptText: `按目标日期黄经最小夹角与吊照容许度筛出${aspects.length}组关系`,
      sources: ['七政四余吊照角度与容许度表', '目标日期黄经最小夹角计算'],
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
      'astronomy-engine现代位置计算',
      structure.ziqiModel.name,
      '距星自行、目标日期真黄道、二十八宿与十二宫换算',
    ],
    limitation: CALCULATION_FACT_LIMITATION,
  };
  const positionSourceFacts: QizhengPositionSourceFact[] = QIZHENG_POSITION_SOURCES.map(
    (source) => {
      const promptLimitations = source.limitations;
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
        promptText: `${source.objects.join('、')}采用${source.provider}（${source.precisionClass}）：${source.calculation}；坐标口径${source.coordinate}`,
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
    signBranch: star.signBranch,
    palace: star.palace,
    retrograde: star.retrograde,
    dignity: star.dignity,
    sourceId: star.sourceId,
    sourceLabel: star.sourceLabel,
    precisionClass: star.precisionClass,
    promptText: `${star.name}（${star.kind}，${star.precisionClass}）：目标日期黄经${star.longitude.toFixed(3)}°，${star.xiu}宿${star.xiuDegree.toFixed(2)}度，落${star.signBranch}宫${star.palace}${star.dignity && star.dignity !== '—' ? `，状态${star.dignity}` : ''}${star.retrograde ? '，逆行' : ''}`,
    sources: [
      star.sourceLabel,
      `位置源标识${star.sourceId}`,
      QIZHENG_MANSION_MODEL.astrometrySource,
      QIZHENG_MANSION_MODEL.transformSource,
    ],
    limitation: STAR_FACT_LIMITATION,
  }));
  const aspectFacts: QizhengAspectFact[] = aspects.map((aspect) => ({
    key: `吊照:${aspect.star1}:${aspect.type}:${aspect.star2}`,
    star1: aspect.star1,
    star2: aspect.star2,
    type: aspect.type,
    exactAngle: aspect.exactAngle,
    actualAngle: aspect.actualAngle,
    orb: aspect.orb,
    allowedOrb: aspect.allowedOrb,
    orbRatio: aspect.orbRatio,
    closeness: aspect.closeness,
    precisionClass: aspect.precisionClass,
    promptText: `${aspect.star1}与${aspect.star2}${aspect.type}：实际夹角${aspect.actualAngle.toFixed(2)}°，精确角${aspect.exactAngle.toFixed(2)}°，允许容许度${aspect.allowedOrb.toFixed(2)}°，距精确角偏差${aspect.orb.toFixed(2)}°，归一化容许度位置${aspect.orbRatio.toFixed(2)}，${aspect.closeness}等级，${aspect.precisionClass}${aspect.precisionClass === '混合模型' ? '；不得因角度接近而提升为现代天文同精度证据' : ''}`,
    sources: [aspect.source, '目标日期黄经最小夹角与当前吊照容许度表'],
    limitation: ASPECT_FACT_LIMITATION,
  }));
  const primaryFacts = starFacts.map(
    (fact) =>
      `${fact.name}据${fact.sourceLabel}得${fact.precisionClass}位置，落${fact.signBranch}宫${fact.palace}、${fact.xiu}宿${fact.dignity && fact.dignity !== '—' ? `、状态${fact.dignity}` : ''}`,
  );
  primaryFacts.push(
    `命宫落${getQizhengSignBranch(structure.mingGong)}宫，身宫落${getQizhengSignBranch(structure.shenGong)}宫，命主${structure.mingZhu}`,
  );
  const supportingFacts = aspectFacts.slice(0, 12).map((aspect) => aspect.promptText);
  supportingFacts.push(
    `紫炁顺行回归黄经${structure.ziqi.tropicalLongitude.toFixed(3)}°，采用${structure.ziqiModel.name}并与现代天文位置分层`,
  );
  supportingFacts.push(
    `神煞定位：${structure.shensha.map((item) => `${item.name}${item.value}`).join('、')}`,
  );
  const counterEvidenceFacts = buildQizhengCounterEvidenceFacts({
    calculationFact,
    positionSourceFacts,
    aspectFacts,
  });
  const counterSummaryFact = buildQizhengCounterSummaryFact(counterEvidenceFacts);
  const counterEvidence = counterEvidenceFacts
    .filter(isQizhengCounterIssue)
    .map((item) => item.promptText);
  const limitationFacts = buildQizhengLimitationFacts({
    calculationFact,
    positionSourceFacts,
    starFacts,
    aspectFacts,
    context,
    locationSourceText,
    timezoneSourceText,
  });
  const limitations = limitationFacts.map((item) => item.promptText);
  const summaryFact = buildQizhengSummaryFact({
    calculationFact,
    positionSourceFacts,
    starFacts,
    aspectFacts,
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
    ...aspectFacts.slice(0, 12).map((aspect): PromptEvidenceItem => ({
      level: '辅证',
      title: `${aspect.star1}与${aspect.star2}${aspect.type}`,
      detail: `${aspect.promptText}；边界：${aspect.limitation}`,
      source: aspect.sources.join('；'),
      tags: ['吊照', aspect.type, aspect.closeness],
    })),
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
      level: summaryFact.status === '证据链完整' ? '辅证' : '反证',
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
    aspectFacts,
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
      '再按目标日期二十八宿距星真黄经边界换算宿度、十二宫和庙旺喜乐。',
      '吊照只按实际夹角和容许度分级，不换算为吉凶百分比。',
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
  const stars: QizhengStar[] = [];
  const mansionBoundaries = calculateQizhengMansionBoundaries(
    new Date(astronomicalTime.unixMilliseconds),
  );
  const pushStar = (
    name: string,
    kind: '七政' | '四余',
    tropical: number,
    key?: string,
    retrograde?: boolean,
    sourceId: QizhengPositionSourceId = 'astronomy-engine-planets',
  ): void => {
    if (!Number.isFinite(tropical)) {
      throw new Error(`七政四余星体黄经无效：${name}=${String(tropical)}。`);
    }
    const longitude = normalizeLongitude(tropical);
    const { xiu, xiuDegree } = longitudeToQizhengMansion(longitude, mansionBoundaries);
    const sevenStar = TwentyEightStar.fromName(xiu).getSevenStar().getName();
    const signIndex = Math.floor(longitude / 30);
    const signBranch = getQizhengSignBranch(signIndex);
    const dignity = key ? getQizhengDignity(key, signIndex) : '—';
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
      signBranch,
      palace: '',
      retrograde,
      dignity,
      sourceId,
      sourceLabel: source.provider,
      precisionClass: source.precisionClass,
    });
  };

  for (const [celestialName, meta] of Object.entries(PLANET_NAMES)) {
    const body = PLANET_BODIES[celestialName];
    if (!body) throw new Error(`七政四余星体映射缺失：${celestialName}。`);
    pushStar(
      meta.label,
      '七政',
      astronomyEclipticLongitude(body, astronomicalTime.unixMilliseconds),
      meta.key,
      astronomyRetrograde(body, astronomicalTime.unixMilliseconds),
      'astronomy-engine-planets',
    );
  }

  // 四余：罗睺=真北交，计都=真南交，月孛=平均远地点；紫炁依《七政算内篇》古法均速独立推算。
  const utcMs = astronomicalTime.unixMilliseconds;
  const northLongitude = trueNodeLongitude(utcMs);
  const lilithLongitude = moshierMeanLilithLongitude(utcMs);
  const lilithBefore = moshierMeanLilithLongitude(utcMs - 86_400_000);
  const lilithAfter = moshierMeanLilithLongitude(utcMs + 86_400_000);
  const lilithRetrograde = angleDifferenceDegrees(lilithBefore, lilithAfter) < 0;
  pushStar(
    '罗睺(火余)',
    '四余',
    northLongitude,
    undefined,
    undefined,
    'astronomy-engine-true-node',
  );
  pushStar(
    '计都(土余)',
    '四余',
    normalizeLongitude(northLongitude + 180),
    undefined,
    undefined,
    'astronomy-engine-true-node',
  );
  pushStar(
    '月孛(水余)',
    '四余',
    lilithLongitude,
    undefined,
    lilithRetrograde,
    'moshier-mean-lilith',
  );
  const ziqi = calculateZiqiPosition(input);
  pushStar('紫炁(木余)', '四余', ziqi.tropicalLongitude, undefined, false, 'qizhengsuan-ziqi');

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
  })).map((item) => ({ ...item, signBranch: getQizhengSignBranch(item.signIndex) }));
  const palaceBySign = new Map(twelvePalaces.map((t) => [t.signIndex, t.palace]));
  for (const s of stars) {
    const palace = palaceBySign.get(s.signIndex);
    if (!palace) throw new Error(`七政四余星体宫位映射缺失：${s.name}。`);
    s.palace = palace;
  }

  const mingZhu = getQizhengMingZhu(mingGong);
  const aspects = buildQizhengAspects(stars);

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
  const evidenceAnalysis = buildQizhengEvidence(stars, aspects, calculationContext, {
    mingGong,
    shenGong,
    mingZhu,
    shensha,
    ziqi,
    ziqiModel: ZIQI_MODEL_INFO,
  });

  const prompt = [
    `【七政四余 · 果老星宗】`,
    `出生时间：${input.year}年${input.month}月${input.day}日 ${String(input.hour).padStart(2, '0')}:${String(input.minute ?? 0).padStart(2, '0')}。`,
    `七政：太阳、太阴、水、金、火、木、土；四余：罗睺、计都、月孛、紫炁。`,
    ...stars.map(
      (s) =>
        `${s.kind} ${s.name}：在${s.xiu}宿${s.xiuDegree.toFixed(2)}度，落${s.signBranch}宫${s.palace}${s.dignity && s.dignity !== '—' ? '（' + s.dignity + '）' : ''}${s.retrograde ? '（逆）' : ''}`,
    ),
    `七政四余吊照：${
      aspects.length
        ? aspects
            .map(
              (aspect) =>
                `${aspect.star1}与${aspect.star2}${aspect.type}（${aspect.actualAngle.toFixed(2)}°）`,
            )
            .join('；')
        : '未见容许度内的主要同宫、六合、四正、三方或对照'
    }。`,
    `命宫在${TWELVE_PALACES[0]}（${getQizhengSignBranch(mingGong)}宫），命主${mingZhu}；身宫在${getQizhengSignBranch(shenGong)}宫。`,
    `神煞：天乙贵人${shensha[0].value}、驿马${shensha[1].value}、劫煞${shensha[2].value}、咸池${shensha[3].value}、华盖${shensha[4].value}、孤辰${shensha[5].value}、寡宿${shensha[6].value}。`,
  ].join('\n');

  return {
    stars,
    aspects,
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
  QIZHENG_SIGN_BRANCHES,
  getQizhengSignBranch,
  getQizhengMingZhu,
  getQizhengDignity,
  calculateQizhengMansionBoundaries,
  longitudeToQizhengMansion,
};
