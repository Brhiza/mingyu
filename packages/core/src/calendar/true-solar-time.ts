import { LunarHour, SolarTime } from 'tyme4ts';
import { daysInSolarMonth, getBirthDateValidationMessage } from './date-validation';
import { getShichenFromClock } from './dateUtils';
import { checkChinaDst, type ChinaDstCheckResult } from './china-dst';
import {
  DEFAULT_CHINA_TIMEZONE_HOURS,
  resolveCivilTime,
  type CivilDateTimeParts,
} from './civil-time';
import type { HistoricalTimezoneEvidence } from './historical-timezone';

export interface SolarDateTimeParts extends CivilDateTimeParts {}

export interface TrueSolarTimeResult {
  correctedTime: SolarDateTimeParts;
  longitudeCorrectionMinutes: number;
  equationOfTimeMinutes: number;
  totalCorrectionMinutes: number;
}

export interface TrueSolarTimeCalculationStep {
  key: string;
  stage:
    | '历法输入换算'
    | '输入口径核验'
    | '历史时区解析'
    | '历史夏令时还原'
    | '经度时差计算'
    | '均时差计算'
    | '总校正与跨日'
    | '时辰映射';
  status: '已核验' | '已换算' | '已解析' | '已计算' | '已应用' | '未请求' | '未命中';
  dependsOnStepKeys: string[];
  inputs: Record<string, string | number | boolean>;
  result: Record<string, string | number | boolean>;
  promptText: string;
  sources: string[];
  limitation: '真太阳时步骤只证明当地钟表时间如何经历法换算、历史夏令时还原、经度时差、均时差与时辰映射形成当前唯一结果；不得据此生成候选时辰、出生时间敏感性、预测概率或观测级精度声明';
}

export interface TrueSolarTimeCorrectionFact {
  key: string;
  type:
    | '历法输入'
    | '历史时区'
    | '历史夏令时'
    | '经度时差'
    | '均时差'
    | '总校正'
    | '跨日结果'
    | '时辰结果';
  status: '已核验' | '已换算' | '已解析' | '已应用' | '未请求' | '未命中' | '已计算' | '已确定';
  correctionMinutes?: number;
  ownerFactKeys: string[];
  ownerStepKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '校正事实只记录历法、夏令时、经度、均时差、跨日与时辰映射的计算结果；不证明原始出生记录必然正确，也不生成候选时柱或现实事件结论';
}

export interface TrueSolarTimeLimitationFact {
  key: string;
  type: '均时差近似' | '经度与时区口径' | '历史时区口径' | '历史夏令时口径' | '原始记录边界';
  status: '适用';
  ownerFactKeys: string[];
  ownerStepKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '限制事实用于约束真太阳时校正可支持的时间口径和精度声明；不得被反向当作原始出生记录真实性、候选时辰、现实事件或预测有效性证据';
}

export interface TrueSolarTimeSummaryFact {
  key: 'true-solar-time:evidence-summary';
  status: '证据链完整' | '历史时区歧义已消解' | '含夏令时重复时段' | '含夏令时不存在时段';
  factKeys: string[];
  calculationStepCount: number;
  correctionFactCount: number;
  limitationFactCount: number;
  promptText: string;
  sources: string[];
  limitation: '真太阳时证据汇总只统计历法输入、钟表时间、历史夏令时、经度时差、均时差、跨日、时辰映射与限制覆盖；不得按校正量或边界状态生成可信度百分比、候选时辰、敏感性结果或必然结论';
}

export interface TrueSolarTimeEvidenceFields {
  key: string;
  status: '已计算' | '存在时间记录边界';
  calculationSteps: TrueSolarTimeCalculationStep[];
  calculationChain: string[];
  correctionFacts: TrueSolarTimeCorrectionFact[];
  summaryFact: TrueSolarTimeSummaryFact;
  limitations: string[];
  limitationFacts: TrueSolarTimeLimitationFact[];
  timezoneEvidence?: HistoricalTimezoneEvidence;
  source: string;
  promptText: string;
}

export interface TrueSolarTimeConversionInput {
  /** 不带时区偏移的当地钟表时间，如 1990-05-15T10:30:00。 */
  localDateTime: string;
  /** 出生地或观测地经度，东经为正、西经为负。 */
  longitude: number;
  /** 当地标准时区，默认 UTC+8；支持小数时区。 */
  timezone?: number;
  /** IANA 历史时区，如 America/New_York；用于按当地日期解析历史 UTC 偏移。 */
  timeZoneId?: string;
  /** 是否按中国 1986-1991 历史规则自动还原夏令时，默认 false。 */
  applyChinaDst?: boolean;
}

export interface TrueSolarTimeConversionResult
  extends TrueSolarTimeResult, TrueSolarTimeEvidenceFields {
  clockTime: SolarDateTimeParts;
  clockDateTime: string;
  standardTime: SolarDateTimeParts;
  standardDateTime: string;
  correctedDateTime: string;
  longitude: number;
  timezone: number;
  timeZoneId?: string;
  standardMeridian: number;
  crossesDate: boolean;
  chinaDst: ChinaDstCheckResult & {
    requested: boolean;
    applied: boolean;
  };
  shichen: {
    index: number;
    branch: string;
    name: string;
  };
}

export interface BirthCalendarClockTimeInput {
  dateType: 'solar' | 'lunar';
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second?: number;
  isLeapMonth?: boolean;
}

export interface TrueSolarBirthTimeInput extends BirthCalendarClockTimeInput {
  longitude: number;
  timezone?: number;
  timeZoneId?: string;
  applyChinaDst?: boolean;
}

export interface TrueSolarBirthTimeResult extends TrueSolarTimeConversionResult {
  inputDateType: 'solar' | 'lunar';
  isLeapMonth: boolean;
  /** 农历输入先转换为公历；公历输入保持原值。 */
  solarClockTime: SolarDateTimeParts;
  solarClockDateTime: string;
  /** 与项目早子、晚子拆分口径一致的 0-12 时辰索引。 */
  timeIndex: number;
}

const LOCAL_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;
const TRUE_SOLAR_STEP_LIMITATION =
  '真太阳时步骤只证明当地钟表时间如何经历法换算、历史夏令时还原、经度时差、均时差与时辰映射形成当前唯一结果；不得据此生成候选时辰、出生时间敏感性、预测概率或观测级精度声明' as const;
const TRUE_SOLAR_CORRECTION_LIMITATION =
  '校正事实只记录历法、夏令时、经度、均时差、跨日与时辰映射的计算结果；不证明原始出生记录必然正确，也不生成候选时柱或现实事件结论' as const;
const TRUE_SOLAR_LIMITATION_FACT_LIMITATION =
  '限制事实用于约束真太阳时校正可支持的时间口径和精度声明；不得被反向当作原始出生记录真实性、候选时辰、现实事件或预测有效性证据' as const;
const TRUE_SOLAR_SUMMARY_LIMITATION =
  '真太阳时证据汇总只统计历法输入、钟表时间、历史夏令时、经度时差、均时差、跨日、时辰映射与限制覆盖；不得按校正量或边界状态生成可信度百分比、候选时辰、敏感性结果或必然结论' as const;

interface TrueSolarTimeEvidenceInput {
  key: string;
  clockDateTime: string;
  standardDateTime: string;
  correctedDateTime: string;
  longitude: number;
  timezone: number;
  timeZoneId?: string;
  timezoneEvidence?: HistoricalTimezoneEvidence;
  standardMeridian: number;
  longitudeCorrectionMinutes: number;
  equationOfTimeMinutes: number;
  totalCorrectionMinutes: number;
  crossesDate: boolean;
  chinaDst: TrueSolarTimeConversionResult['chinaDst'];
  shichen: TrueSolarTimeConversionResult['shichen'];
  calendarStep?: TrueSolarTimeCalculationStep;
  calendarFact?: TrueSolarTimeCorrectionFact;
}

function buildTrueSolarTimeEvidence(
  input: TrueSolarTimeEvidenceInput,
): TrueSolarTimeEvidenceFields {
  const inputStepKey = 'true-solar-time:calculation:input';
  const timezoneStepKey = 'true-solar-time:calculation:historical-timezone';
  const dstStepKey = 'true-solar-time:calculation:china-dst';
  const longitudeStepKey = 'true-solar-time:calculation:longitude';
  const equationStepKey = 'true-solar-time:calculation:equation-of-time';
  const totalStepKey = 'true-solar-time:calculation:total-correction';
  const shichenStepKey = 'true-solar-time:calculation:shichen';
  const calculationSteps: TrueSolarTimeCalculationStep[] = [
    ...(input.calendarStep ? [input.calendarStep] : []),
    ...(input.timezoneEvidence
      ? [
          {
            key: timezoneStepKey,
            stage: '历史时区解析' as const,
            status: '已解析' as const,
            dependsOnStepKeys: input.calendarStep ? [input.calendarStep.key] : [],
            inputs: {
              timeZoneId: input.timezoneEvidence.timeZoneId,
              clockDateTime: input.clockDateTime,
            },
            result: {
              timezone: input.timezone,
              mappingStatus: input.timezoneEvidence.status,
              offsetConflict: input.timezoneEvidence.offsetConflict,
            },
            promptText: `按 IANA 时区 ${input.timezoneEvidence.timeZoneId} 的历史规则，将当地钟表时间${input.clockDateTime}解析为 UTC${input.timezone >= 0 ? '+' : ''}${input.timezone}${input.timezoneEvidence.status === 'ambiguous' ? '，并已用明确固定偏移消解回拨歧义' : ''}`,
            sources: ['IANA Time Zone Database 与 Intl.DateTimeFormat 历史时区解析'],
            limitation: TRUE_SOLAR_STEP_LIMITATION,
          },
        ]
      : []),
    {
      key: inputStepKey,
      stage: '输入口径核验',
      status: '已核验',
      dependsOnStepKeys: input.timezoneEvidence
        ? [timezoneStepKey]
        : input.calendarStep
          ? [input.calendarStep.key]
          : [],
      inputs: {
        clockDateTime: input.clockDateTime,
        longitude: input.longitude,
        timezone: input.timezone,
        ...(input.timeZoneId ? { timeZoneId: input.timeZoneId } : {}),
      },
      result: { standardMeridian: input.standardMeridian },
      promptText: `核验当地钟表时间${input.clockDateTime}、经度${input.longitude}°与法定时区 UTC${input.timezone >= 0 ? '+' : ''}${input.timezone}，对应标准经线${input.standardMeridian}°`,
      sources: ['明确当地钟表时间、经度与法定 UTC 偏移'],
      limitation: TRUE_SOLAR_STEP_LIMITATION,
    },
    {
      key: dstStepKey,
      stage: '历史夏令时还原',
      status: input.chinaDst.applied ? '已应用' : input.chinaDst.requested ? '未命中' : '未请求',
      dependsOnStepKeys: [inputStepKey],
      inputs: { requested: input.chinaDst.requested, clockDateTime: input.clockDateTime },
      result: {
        applied: input.chinaDst.applied,
        offsetMinutes: input.chinaDst.applied ? input.chinaDst.offsetMinutes : 0,
        standardDateTime: input.standardDateTime,
        ambiguous: input.chinaDst.ambiguous,
        nonexistent: input.chinaDst.nonexistent,
      },
      promptText: input.chinaDst.applied
        ? `按中国历史夏令时规则将钟表时间还原${input.chinaDst.offsetMinutes}分钟为标准时间${input.standardDateTime}`
        : input.chinaDst.requested
          ? `已核验中国历史夏令时，当前时刻未命中需还原区间，标准时间仍为${input.standardDateTime}`
          : `未请求中国历史夏令时还原，直接采用钟表时间${input.standardDateTime}`,
      sources: ['中国 1986-1991 年历史夏令时规则'],
      limitation: TRUE_SOLAR_STEP_LIMITATION,
    },
    {
      key: longitudeStepKey,
      stage: '经度时差计算',
      status: '已计算',
      dependsOnStepKeys: [dstStepKey],
      inputs: { longitude: input.longitude, standardMeridian: input.standardMeridian },
      result: { longitudeCorrectionMinutes: input.longitudeCorrectionMinutes },
      promptText: `按（经度${input.longitude}°-标准经线${input.standardMeridian}°）×4分钟计算经度时差${input.longitudeCorrectionMinutes.toFixed(3)}分钟`,
      sources: ['每经度1°对应时差4分钟的地方时换算'],
      limitation: TRUE_SOLAR_STEP_LIMITATION,
    },
    {
      key: equationStepKey,
      stage: '均时差计算',
      status: '已计算',
      dependsOnStepKeys: [dstStepKey],
      inputs: { standardDateTime: input.standardDateTime },
      result: { equationOfTimeMinutes: input.equationOfTimeMinutes },
      promptText: `按标准日期计算均时差${input.equationOfTimeMinutes.toFixed(3)}分钟`,
      sources: ['基于年内日序的均时差近似公式'],
      limitation: TRUE_SOLAR_STEP_LIMITATION,
    },
    {
      key: totalStepKey,
      stage: '总校正与跨日',
      status: '已计算',
      dependsOnStepKeys: [longitudeStepKey, equationStepKey],
      inputs: {
        standardDateTime: input.standardDateTime,
        longitudeCorrectionMinutes: input.longitudeCorrectionMinutes,
        equationOfTimeMinutes: input.equationOfTimeMinutes,
      },
      result: {
        totalCorrectionMinutes: input.totalCorrectionMinutes,
        correctedDateTime: input.correctedDateTime,
        crossesDate: input.crossesDate,
      },
      promptText: `合并经度时差与均时差得总校正${input.totalCorrectionMinutes.toFixed(3)}分钟，采用真太阳时${input.correctedDateTime}${input.crossesDate ? '，日期已跨日' : '，日期未跨日'}`,
      sources: ['经度时差与均时差合并校正'],
      limitation: TRUE_SOLAR_STEP_LIMITATION,
    },
    {
      key: shichenStepKey,
      stage: '时辰映射',
      status: '已计算',
      dependsOnStepKeys: [totalStepKey],
      inputs: { correctedDateTime: input.correctedDateTime },
      result: {
        timeIndex: input.shichen.index,
        branch: input.shichen.branch,
        shichen: input.shichen.name,
      },
      promptText: `校正后时刻${input.correctedDateTime}唯一映射为${input.shichen.name}，时辰索引${input.shichen.index}`,
      sources: ['早子、晚子拆分的公共时辰映射'],
      limitation: TRUE_SOLAR_STEP_LIMITATION,
    },
  ];
  const correctionFacts: TrueSolarTimeCorrectionFact[] = [
    ...(input.calendarFact ? [input.calendarFact] : []),
    ...(input.timezoneEvidence
      ? [
          {
            key: 'true-solar-time:fact:historical-timezone',
            type: '历史时区' as const,
            status: '已解析' as const,
            ownerFactKeys: [timezoneStepKey],
            ownerStepKeys: [timezoneStepKey],
            promptText: `IANA 时区 ${input.timezoneEvidence.timeZoneId} 的当地历史偏移解析为 UTC${input.timezone >= 0 ? '+' : ''}${input.timezone}`,
            sources: ['IANA 历史时区映射结果'],
            limitation: TRUE_SOLAR_CORRECTION_LIMITATION,
          },
        ]
      : []),
    {
      key: 'true-solar-time:fact:china-dst',
      type: '历史夏令时',
      status: input.chinaDst.applied ? '已应用' : input.chinaDst.requested ? '未命中' : '未请求',
      correctionMinutes: input.chinaDst.applied ? input.chinaDst.offsetMinutes : 0,
      ownerFactKeys: [dstStepKey],
      ownerStepKeys: [dstStepKey],
      promptText: calculationSteps.find((item) => item.key === dstStepKey)!.promptText,
      sources: ['中国历史夏令时校正结果'],
      limitation: TRUE_SOLAR_CORRECTION_LIMITATION,
    },
    {
      key: 'true-solar-time:fact:longitude',
      type: '经度时差',
      status: '已计算',
      correctionMinutes: input.longitudeCorrectionMinutes,
      ownerFactKeys: [longitudeStepKey],
      ownerStepKeys: [longitudeStepKey],
      promptText: `经度时差为${input.longitudeCorrectionMinutes.toFixed(3)}分钟`,
      sources: ['经度与标准经线差值'],
      limitation: TRUE_SOLAR_CORRECTION_LIMITATION,
    },
    {
      key: 'true-solar-time:fact:equation-of-time',
      type: '均时差',
      status: '已计算',
      correctionMinutes: input.equationOfTimeMinutes,
      ownerFactKeys: [equationStepKey],
      ownerStepKeys: [equationStepKey],
      promptText: `均时差为${input.equationOfTimeMinutes.toFixed(3)}分钟`,
      sources: ['年内日序均时差近似公式'],
      limitation: TRUE_SOLAR_CORRECTION_LIMITATION,
    },
    {
      key: 'true-solar-time:fact:total-correction',
      type: '总校正',
      status: '已计算',
      correctionMinutes: input.totalCorrectionMinutes,
      ownerFactKeys: [totalStepKey],
      ownerStepKeys: [totalStepKey],
      promptText: `总校正为${input.totalCorrectionMinutes.toFixed(3)}分钟，真太阳时为${input.correctedDateTime}`,
      sources: ['经度时差与均时差合并结果'],
      limitation: TRUE_SOLAR_CORRECTION_LIMITATION,
    },
    {
      key: 'true-solar-time:fact:date-crossing',
      type: '跨日结果',
      status: '已确定',
      ownerFactKeys: [totalStepKey],
      ownerStepKeys: [totalStepKey],
      promptText: input.crossesDate
        ? `校正后日期已跨日，采用${input.correctedDateTime}`
        : '校正后日期未跨日',
      sources: ['钟表时间与校正后日期比较'],
      limitation: TRUE_SOLAR_CORRECTION_LIMITATION,
    },
    {
      key: 'true-solar-time:fact:shichen',
      type: '时辰结果',
      status: '已确定',
      ownerFactKeys: [shichenStepKey],
      ownerStepKeys: [shichenStepKey],
      promptText: `校正后唯一时辰为${input.shichen.name}（${input.shichen.branch}支，索引${input.shichen.index}）`,
      sources: ['公共时辰映射结果'],
      limitation: TRUE_SOLAR_CORRECTION_LIMITATION,
    },
  ];
  const equationLimitation =
    '均时差采用年内日序近似公式，用于民用排盘校正，不宣称达到观测级或航海级精度。';
  const longitudeTimezoneLimitation =
    '经度时差依赖已确认的出生地经度与当地法定时区；时区口径错误会直接改变校正结果。';
  const historicalTimezoneLimitation =
    'IANA 历史规则随运行环境的时区数据库版本更新；回拨重复时刻必须用明确固定偏移消歧后才能生成唯一结果。';
  const chinaDstLimitation =
    '中国历史夏令时只在明确请求时按 1986-1991 年规则还原；如原记录已折算为标准时间，不应重复校正。';
  const sourceRecordLimitation =
    '当前结果只采用用户明确提供的精准时分、经度与时区生成唯一真太阳时和唯一时辰；不生成候选时辰、敏感性结果或缺时柱命盘。';
  const limitations = [
    equationLimitation,
    longitudeTimezoneLimitation,
    ...(input.timezoneEvidence ? [historicalTimezoneLimitation] : []),
    chinaDstLimitation,
    sourceRecordLimitation,
  ];
  const limitationFacts: TrueSolarTimeLimitationFact[] = [
    {
      key: 'true-solar-time:limitation:equation-of-time',
      type: '均时差近似',
      status: '适用',
      ownerFactKeys: ['true-solar-time:fact:equation-of-time'],
      ownerStepKeys: [equationStepKey],
      promptText: equationLimitation,
      sources: ['均时差近似公式精度说明'],
      limitation: TRUE_SOLAR_LIMITATION_FACT_LIMITATION,
    },
    {
      key: 'true-solar-time:limitation:longitude-timezone',
      type: '经度与时区口径',
      status: '适用',
      ownerFactKeys: [inputStepKey, 'true-solar-time:fact:longitude'],
      ownerStepKeys: [inputStepKey, longitudeStepKey],
      promptText: longitudeTimezoneLimitation,
      sources: ['出生地经度、法定时区与标准经线口径'],
      limitation: TRUE_SOLAR_LIMITATION_FACT_LIMITATION,
    },
    ...(input.timezoneEvidence
      ? [
          {
            key: 'true-solar-time:limitation:historical-timezone',
            type: '历史时区口径' as const,
            status: '适用' as const,
            ownerFactKeys: [timezoneStepKey, 'true-solar-time:fact:historical-timezone'],
            ownerStepKeys: [timezoneStepKey],
            promptText: historicalTimezoneLimitation,
            sources: ['IANA Time Zone Database 版本与回拨消歧边界'],
            limitation: TRUE_SOLAR_LIMITATION_FACT_LIMITATION,
          },
        ]
      : []),
    {
      key: 'true-solar-time:limitation:china-dst',
      type: '历史夏令时口径',
      status: '适用',
      ownerFactKeys: ['true-solar-time:fact:china-dst'],
      ownerStepKeys: [dstStepKey],
      promptText: chinaDstLimitation,
      sources: ['中国历史夏令时还原边界'],
      limitation: TRUE_SOLAR_LIMITATION_FACT_LIMITATION,
    },
    {
      key: 'true-solar-time:limitation:source-record',
      type: '原始记录边界',
      status: '适用',
      ownerFactKeys: [inputStepKey, 'true-solar-time:fact:shichen'],
      ownerStepKeys: [inputStepKey, shichenStepKey],
      promptText: sourceRecordLimitation,
      sources: ['明确输入与唯一真太阳时、时辰结果'],
      limitation: TRUE_SOLAR_LIMITATION_FACT_LIMITATION,
    },
  ];
  const summaryStatus: TrueSolarTimeSummaryFact['status'] = input.chinaDst.nonexistent
    ? '含夏令时不存在时段'
    : input.chinaDst.ambiguous
      ? '含夏令时重复时段'
      : input.timezoneEvidence?.status === 'ambiguous'
        ? '历史时区歧义已消解'
        : '证据链完整';
  const summaryFact: TrueSolarTimeSummaryFact = {
    key: 'true-solar-time:evidence-summary',
    status: summaryStatus,
    factKeys: [
      ...calculationSteps.map((item) => item.key),
      ...correctionFacts.map((item) => item.key),
      ...limitationFacts.map((item) => item.key),
    ],
    calculationStepCount: calculationSteps.length,
    correctionFactCount: correctionFacts.length,
    limitationFactCount: limitationFacts.length,
    promptText: `真太阳时证据状态为${summaryStatus}；记录计算步骤${calculationSteps.length}项、校正事实${correctionFacts.length}项、限制${limitationFacts.length}项`,
    sources: [
      input.calendarStep
        ? '历法输入、历史夏令时、经度时差、均时差、跨日与时辰映射汇总'
        : '钟表时间、历史夏令时、经度时差、均时差、跨日与时辰映射汇总',
    ],
    limitation: TRUE_SOLAR_SUMMARY_LIMITATION,
  };
  const source = [
    input.calendarStep
      ? '公历农历换算由 tyme4ts 完成'
      : '当地钟表时间格式、日期与时空参数由公共日历入口核验',
    ...(input.timezoneEvidence ? ['IANA 历史时区由 Intl.DateTimeFormat 所带时区数据库解析'] : []),
    '中国历史夏令时按明确规则还原',
    '经度时差按4分钟/度',
    '均时差采用年内日序近似公式',
  ].join('；');
  return {
    key: input.key,
    status: input.chinaDst.ambiguous || input.chinaDst.nonexistent ? '存在时间记录边界' : '已计算',
    calculationSteps,
    calculationChain: calculationSteps.map((item) => item.promptText),
    correctionFacts,
    summaryFact,
    limitations,
    limitationFacts,
    ...(input.timezoneEvidence ? { timezoneEvidence: input.timezoneEvidence } : {}),
    source,
    promptText: `真太阳时证据：钟表时间${input.clockDateTime}${input.timezoneEvidence ? `，IANA 时区 ${input.timezoneEvidence.timeZoneId} 的历史偏移为 UTC${input.timezone >= 0 ? '+' : ''}${input.timezone}` : ''}，标准时间${input.standardDateTime}，经度时差${input.longitudeCorrectionMinutes.toFixed(3)}分钟，均时差${input.equationOfTimeMinutes.toFixed(3)}分钟，总校正${input.totalCorrectionMinutes.toFixed(3)}分钟，采用${input.correctedDateTime}与${input.shichen.name}。计算链：${calculationSteps.map((item) => item.promptText).join(' → ')}。证据汇总：${summaryFact.promptText}。来源：${source}。限制：${limitations.join('；')}`,
  };
}

function getDayOfYear(year: number, month: number, day: number): number {
  const current = new Date(Date.UTC(year, month - 1, day));
  const start = new Date(Date.UTC(year, 0, 1));
  return Math.floor((current.getTime() - start.getTime()) / 86400000) + 1;
}

function assertIntegerInRange(value: number, label: string, min: number, max: number): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label}需在 ${min}-${max} 之间。`);
  }
}

function assertNumberInRange(value: number, label: string, min: number, max: number): void {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${label}需在 ${min} 到 ${max} 之间。`);
  }
}

function validateSolarDate(year: number, month: number, day: number): void {
  assertIntegerInRange(year, '年份', 1900, 2100);
  assertIntegerInRange(month, '月份', 1, 12);
  if (!Number.isInteger(day) || day < 1) {
    throw new Error('日期不能小于 1。');
  }

  const maxDay = daysInSolarMonth(year, month);
  if (day > maxDay) {
    throw new Error(`日期需在 1-${maxDay} 之间。`);
  }
}

function validateTimePart(hour: number, minute: number, second: number): void {
  assertIntegerInRange(hour, '小时', 0, 23);
  assertIntegerInRange(minute, '分钟', 0, 59);
  assertIntegerInRange(second, '秒', 0, 59);
}

function toDateTimeParts(date: Date): SolarDateTimeParts {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
    second: date.getUTCSeconds(),
  };
}

function shiftDateTime(value: SolarDateTimeParts, offsetMinutes: number): SolarDateTimeParts {
  const date = new Date(
    Date.UTC(value.year, value.month - 1, value.day, value.hour, value.minute, value.second),
  );
  date.setUTCMinutes(date.getUTCMinutes() + offsetMinutes);
  return toDateTimeParts(date);
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatSolarDateTimeParts(value: SolarDateTimeParts): string {
  return `${value.year}-${pad(value.month)}-${pad(value.day)}T${pad(value.hour)}:${pad(value.minute)}:${pad(value.second)}`;
}

export function parseLocalDateTime(value: string): SolarDateTimeParts {
  if (typeof value !== 'string') {
    throw new Error('localDateTime 必须是字符串。');
  }
  const match = LOCAL_DATE_TIME_PATTERN.exec(value.trim());
  if (!match) {
    throw new Error(
      'localDateTime 需使用 YYYY-MM-DDTHH:mm 或 YYYY-MM-DDTHH:mm:ss 格式，且不要附带时区偏移。',
    );
  }

  const result: SolarDateTimeParts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? 0),
  };
  validateSolarDate(result.year, result.month, result.day);
  validateTimePart(result.hour, result.minute, result.second);
  return result;
}

export function calculateEquationOfTimeMinutes(year: number, month: number, day: number): number {
  validateSolarDate(year, month, day);
  const dayOfYear = getDayOfYear(year, month, day);
  const angle = (2 * Math.PI * (dayOfYear - 81)) / 364;
  return 9.87 * Math.sin(2 * angle) - 7.53 * Math.cos(angle) - 1.5 * Math.sin(angle);
}

export function calculateTrueSolarTime(
  standardTime: Pick<SolarDateTimeParts, 'year' | 'month' | 'day' | 'hour' | 'minute'> &
    Partial<Pick<SolarDateTimeParts, 'second'>>,
  longitude: number,
  standardMeridian = 120,
): TrueSolarTimeResult {
  const second = standardTime.second ?? 0;
  validateSolarDate(standardTime.year, standardTime.month, standardTime.day);
  validateTimePart(standardTime.hour, standardTime.minute, second);
  assertNumberInRange(longitude, '经度', -180, 180);
  assertNumberInRange(standardMeridian, '标准经线', -180, 210);

  const equationOfTimeMinutes = calculateEquationOfTimeMinutes(
    standardTime.year,
    standardTime.month,
    standardTime.day,
  );
  const longitudeCorrectionMinutes = (longitude - standardMeridian) * 4;
  const totalCorrectionMinutes = equationOfTimeMinutes + longitudeCorrectionMinutes;

  const correctedDate = new Date(
    Date.UTC(
      standardTime.year,
      standardTime.month - 1,
      standardTime.day,
      standardTime.hour,
      standardTime.minute,
      second,
    ),
  );
  correctedDate.setTime(correctedDate.getTime() + totalCorrectionMinutes * 60000);

  return {
    correctedTime: toDateTimeParts(correctedDate),
    longitudeCorrectionMinutes,
    equationOfTimeMinutes,
    totalCorrectionMinutes,
  };
}

/**
 * 面向 API/MCP 的便捷真太阳时换算入口。
 * localDateTime 表示当地钟表时间，不应包含 Z 或 +08:00 等时区后缀；
 * IANA 时区会自动解析历史夏令时，固定偏移口径可按需启用中国历史夏令时兼容校正。
 */
export function convertTrueSolarTime(
  input: TrueSolarTimeConversionInput,
): TrueSolarTimeConversionResult {
  const clockTime = parseLocalDateTime(input.localDateTime);
  if (input.applyChinaDst !== undefined && typeof input.applyChinaDst !== 'boolean') {
    throw new Error('applyChinaDst 必须是布尔值。');
  }
  const civilTime = resolveCivilTime(
    {
      ...clockTime,
      timezone: input.timezone,
      timeZoneId: input.timeZoneId,
    },
    { defaultTimezone: DEFAULT_CHINA_TIMEZONE_HOURS },
  );
  const { timeZoneId, timezoneEvidence, timezone } = civilTime;
  if (timeZoneId && input.applyChinaDst === true) {
    throw new Error('timeZoneId 已包含历史夏令时规则，不能同时启用 applyChinaDst。');
  }
  const requestedChinaDst = input.applyChinaDst ?? false;
  const chinaDstCheck = requestedChinaDst
    ? checkChinaDst(
        clockTime.year,
        clockTime.month,
        clockTime.day,
        clockTime.hour,
        clockTime.minute,
      )
    : { inDst: false, offsetMinutes: 0, ambiguous: false, nonexistent: false };
  if (requestedChinaDst && chinaDstCheck.nonexistent) {
    throw new Error('该中国历史钟表时间处于夏令时跳时缺口，实际并不存在。');
  }
  if (requestedChinaDst && chinaDstCheck.ambiguous) {
    throw new Error(
      '该中国历史钟表时间处于夏令时回拨重复时段，请改用 timeZoneId=Asia/Shanghai 并提供 timezone 固定偏移消歧。',
    );
  }
  const chinaDstApplied = requestedChinaDst && chinaDstCheck.inDst;
  const standardTime = chinaDstApplied
    ? shiftDateTime(clockTime, chinaDstCheck.offsetMinutes)
    : clockTime;
  const standardMeridian = timezone * 15;
  const result = calculateTrueSolarTime(standardTime, input.longitude, standardMeridian);
  const shichen = getShichenFromClock(result.correctedTime.hour, result.correctedTime.minute);
  if (!shichen) {
    throw new Error('无法根据校正后的真太阳时确定时辰。');
  }
  const clockDateTime = formatSolarDateTimeParts(clockTime);
  const standardDateTime = formatSolarDateTimeParts(standardTime);
  const correctedDateTime = formatSolarDateTimeParts(result.correctedTime);
  const crossesDate =
    clockTime.year !== result.correctedTime.year ||
    clockTime.month !== result.correctedTime.month ||
    clockTime.day !== result.correctedTime.day;
  const chinaDst = {
    ...chinaDstCheck,
    requested: requestedChinaDst,
    applied: chinaDstApplied,
  };
  const shichenResult = {
    index: shichen.index,
    branch: shichen.branch,
    name: shichen.name,
  };
  const evidence = buildTrueSolarTimeEvidence({
    key: `true-solar-time:${clockDateTime}:${input.longitude}:${timeZoneId ? `${timeZoneId}:${timezone}` : timezone}`,
    clockDateTime,
    standardDateTime,
    correctedDateTime,
    longitude: input.longitude,
    timezone,
    timeZoneId,
    timezoneEvidence,
    standardMeridian,
    longitudeCorrectionMinutes: result.longitudeCorrectionMinutes,
    equationOfTimeMinutes: result.equationOfTimeMinutes,
    totalCorrectionMinutes: result.totalCorrectionMinutes,
    crossesDate,
    chinaDst,
    shichen: shichenResult,
  });

  return {
    ...result,
    ...evidence,
    clockTime,
    clockDateTime,
    standardTime,
    standardDateTime,
    correctedDateTime,
    longitude: input.longitude,
    timezone,
    ...(timeZoneId ? { timeZoneId } : {}),
    standardMeridian,
    chinaDst,
    crossesDate,
    shichen: shichenResult,
  };
}

/**
 * 只校验出生历法输入并换算为公历钟表时间。
 * 不解析时区，也不执行夏令时、经度或均时差校正。
 */
export function resolveBirthCalendarClockTime(
  input: BirthCalendarClockTimeInput,
): SolarDateTimeParts {
  if (input.dateType !== 'solar' && input.dateType !== 'lunar') {
    throw new Error('dateType 必须是 solar 或 lunar。');
  }
  if (input.isLeapMonth !== undefined && typeof input.isLeapMonth !== 'boolean') {
    throw new Error('isLeapMonth 必须是布尔值。');
  }
  const second = input.second ?? 0;
  validateTimePart(input.hour, input.minute, second);
  const dateMessage = getBirthDateValidationMessage({
    year: input.year,
    month: input.month,
    day: input.day,
    dateType: input.dateType,
    isLeapMonth: input.isLeapMonth,
  });
  if (dateMessage) throw new Error(dateMessage);

  const solarTime =
    input.dateType === 'lunar'
      ? LunarHour.fromYmdHms(
          input.year,
          input.isLeapMonth ? -Math.abs(input.month) : input.month,
          input.day,
          input.hour,
          input.minute,
          second,
        ).getSolarTime()
      : SolarTime.fromYmdHms(input.year, input.month, input.day, input.hour, input.minute, second);
  return {
    year: solarTime.getYear(),
    month: solarTime.getMonth(),
    day: solarTime.getDay(),
    hour: solarTime.getHour(),
    minute: solarTime.getMinute(),
    second: solarTime.getSecond(),
  };
}

/**
 * 面向各类排盘的统一出生真太阳时入口。
 * 统一处理公历/农历、闰月、时区、中国历史夏令时、跨日与时辰索引。
 */
export function resolveTrueSolarBirthTime(
  input: TrueSolarBirthTimeInput,
): TrueSolarBirthTimeResult {
  const solarClockTime = resolveBirthCalendarClockTime(input);
  const converted = convertTrueSolarTime({
    localDateTime: formatSolarDateTimeParts(solarClockTime),
    longitude: input.longitude,
    timezone: input.timezone,
    timeZoneId: input.timeZoneId,
    applyChinaDst: input.applyChinaDst,
  });
  const solarClockDateTime = formatSolarDateTimeParts(solarClockTime);
  const calendarStep: TrueSolarTimeCalculationStep = {
    key: 'true-solar-time:calculation:calendar-input',
    stage: '历法输入换算',
    status: input.dateType === 'lunar' ? '已换算' : '已核验',
    dependsOnStepKeys: [],
    inputs: {
      dateType: input.dateType,
      year: input.year,
      month: input.month,
      day: input.day,
      hour: input.hour,
      minute: input.minute,
      isLeapMonth: input.isLeapMonth ?? false,
    },
    result: { solarClockDateTime },
    promptText:
      input.dateType === 'lunar'
        ? `农历${input.year}年${input.isLeapMonth ? '闰' : ''}${input.month}月${input.day}日换算为公历钟表时间${solarClockDateTime}`
        : `已核验公历出生钟表时间${solarClockDateTime}`,
    sources: ['tyme4ts 公历农历换算与出生日期合法性核验'],
    limitation: TRUE_SOLAR_STEP_LIMITATION,
  };
  const calendarFact: TrueSolarTimeCorrectionFact = {
    key: 'true-solar-time:fact:calendar-input',
    type: '历法输入',
    status: input.dateType === 'lunar' ? '已换算' : '已核验',
    ownerFactKeys: [calendarStep.key],
    ownerStepKeys: [calendarStep.key],
    promptText: calendarStep.promptText,
    sources: [...calendarStep.sources],
    limitation: TRUE_SOLAR_CORRECTION_LIMITATION,
  };
  const birthEvidence = buildTrueSolarTimeEvidence({
    key: `true-solar-birth-time:${input.dateType}:${input.year}-${input.month}-${input.day}:${input.hour}:${input.minute}:${input.longitude}:${converted.timezone}`,
    clockDateTime: converted.clockDateTime,
    standardDateTime: converted.standardDateTime,
    correctedDateTime: converted.correctedDateTime,
    longitude: converted.longitude,
    timezone: converted.timezone,
    timeZoneId: converted.timeZoneId,
    timezoneEvidence: converted.timezoneEvidence,
    standardMeridian: converted.standardMeridian,
    longitudeCorrectionMinutes: converted.longitudeCorrectionMinutes,
    equationOfTimeMinutes: converted.equationOfTimeMinutes,
    totalCorrectionMinutes: converted.totalCorrectionMinutes,
    crossesDate: converted.crossesDate,
    chinaDst: converted.chinaDst,
    shichen: converted.shichen,
    calendarStep,
    calendarFact,
  });
  return {
    ...converted,
    ...birthEvidence,
    inputDateType: input.dateType,
    isLeapMonth: input.isLeapMonth ?? false,
    solarClockTime,
    solarClockDateTime,
    timeIndex: converted.shichen.index,
  };
}
