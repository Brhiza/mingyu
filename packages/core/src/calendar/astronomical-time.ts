/**
 * @file 天文时间尺度证据
 * @description 将当地钟表时间统一换算为 UTC、儒略日和近似 TT，明确记录 ΔT 模型与限制。
 */

import { daysInGregorianMonth } from './date-validation';
import { resolveCivilTime } from './civil-time';
import type { HistoricalTimezoneEvidence } from './historical-timezone';

export interface AstronomicalTimeInput {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  second?: number;
  timezone?: number;
  timeZoneId?: string;
}

export interface AstronomicalTimeCalculationStep {
  key: string;
  stage: '时区解析' | 'UTC换算' | 'UTC儒略日' | 'UT1近似' | 'ΔT与TT';
  status: '已计算' | '近似';
  dependsOnStepKeys: string[];
  inputs: Record<string, string | number>;
  result: Record<string, string | number>;
  promptText: string;
  sources: string[];
  limitation: '时间尺度步骤只证明当地钟表时间如何换算为 UTC、JD(UTC)、近似 UT1 与近似 TT；不得把数值位数解释为观测精度或底层星历精度';
}

export interface AstronomicalTimeAssumptionFact {
  key: string;
  status: '适用';
  ownerFactKeys: string[];
  ownerStepKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '假设事实只说明时区与 UT1 近似的计算前提；不得当作地点历史时区、实时 DUT1 或观测精度已经被独立证明';
}

export interface AstronomicalTimeCounterEvidenceFact {
  key: string;
  type: 'UT1近似' | 'ΔT模型等级';
  status: '近似' | '历史拟合' | '近现代估算' | '长期外推';
  ownerFactKeys: string[];
  ownerStepKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '反证事实只记录 UT1≈UTC 与 ΔT 分段模型的近似或外推状态；不得据模型等级生成可信度百分比或宣称达到观测精度';
}

export interface AstronomicalTimeCounterSummaryFact {
  key: 'astronomical-time:counter-summary';
  status: '存在时间尺度近似';
  factKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '反证汇总只提醒时间尺度中存在近似或外推，不否定民用历法用途，也不证明观测级精度';
}

export interface AstronomicalTimeLimitationFact {
  key: string;
  type: 'ΔT估算边界' | '底层星历边界';
  status: '适用';
  ownerFactKeys: string[];
  ownerStepKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '限制事实用于约束 UTC、UT1、ΔT 与 TT 数值可以支持的精度声明，不得被反向当作天文事件或现实结果证据';
}

export interface AstronomicalTimeSummaryFact {
  key: 'astronomical-time:evidence-summary';
  status:
    | '民用时间链完整'
    | '含长期外推'
    | '历史时区歧义已消解'
    | '含历史时区歧义'
    | '含固定偏移冲突'
    | '含历史时区歧义与偏移冲突';
  factKeys: string[];
  calculationStepCount: number;
  assumptionFactCount: number;
  counterEvidenceCount: number;
  limitationFactCount: number;
  promptText: string;
  sources: string[];
  limitation: '天文时间证据汇总只统计时区、UTC、儒略日、UT1近似、ΔT模型、反证与限制覆盖；不得按状态生成可信度百分比、观测精度声明或现实结论';
}

export interface AstronomicalTimeEvidence {
  key: string;
  status: '已计算';
  localDateTime: string;
  timezone: number;
  timeZoneId?: string;
  timezoneEvidence?: HistoricalTimezoneEvidence;
  utcDateTime: string;
  unixMilliseconds: number;
  julianDayUtc: number;
  julianDayUtApprox: number;
  deltaTSeconds: number;
  julianDayTtApprox: number;
  decimalYear: number;
  deltaTModel: string;
  precisionLevel: '历史拟合' | '近现代估算' | '长期外推';
  assumptions: string[];
  assumptionFacts: AstronomicalTimeAssumptionFact[];
  calculationSteps: AstronomicalTimeCalculationStep[];
  calculationChain: string[];
  counterEvidence: string[];
  counterEvidenceFacts: AstronomicalTimeCounterEvidenceFact[];
  counterSummaryFact: AstronomicalTimeCounterSummaryFact;
  limitations: string[];
  limitationFacts: AstronomicalTimeLimitationFact[];
  summaryFact: AstronomicalTimeSummaryFact;
  source: string;
  promptText: string;
}

const CALCULATION_STEP_LIMITATION =
  '时间尺度步骤只证明当地钟表时间如何换算为 UTC、JD(UTC)、近似 UT1 与近似 TT；不得把数值位数解释为观测精度或底层星历精度' as const;
const ASSUMPTION_FACT_LIMITATION =
  '假设事实只说明时区与 UT1 近似的计算前提；不得当作地点历史时区、实时 DUT1 或观测精度已经被独立证明' as const;
const COUNTER_FACT_LIMITATION =
  '反证事实只记录 UT1≈UTC 与 ΔT 分段模型的近似或外推状态；不得据模型等级生成可信度百分比或宣称达到观测精度' as const;
const COUNTER_SUMMARY_LIMITATION =
  '反证汇总只提醒时间尺度中存在近似或外推，不否定民用历法用途，也不证明观测级精度' as const;
const LIMITATION_FACT_LIMITATION =
  '限制事实用于约束 UTC、UT1、ΔT 与 TT 数值可以支持的精度声明，不得被反向当作天文事件或现实结果证据' as const;
const SUMMARY_FACT_LIMITATION =
  '天文时间证据汇总只统计时区、UTC、儒略日、UT1近似、ΔT模型、反证与限制覆盖；不得按状态生成可信度百分比、观测精度声明或现实结论' as const;

function assertIntegerInRange(value: number, min: number, max: number, label: string) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label}需为 ${min}-${max} 之间的整数。`);
  }
}

function formatDateTime(
  value: Required<
    Pick<AstronomicalTimeInput, 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second'>
  >,
) {
  return `${String(value.year).padStart(4, '0')}-${String(value.month).padStart(2, '0')}-${String(value.day).padStart(2, '0')} ${String(value.hour).padStart(2, '0')}:${String(value.minute).padStart(2, '0')}:${String(value.second).padStart(2, '0')}`;
}

function decimalYearFromUtc(date: Date) {
  const year = date.getUTCFullYear();
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);
  return year + (date.getTime() - start) / (end - start);
}

/**
 * NASA/Espenak-Meeus 公布的分段多项式，限定项目当前支持的 1900-2200 年。
 * 返回 TT-UT1 的估计秒数，不应解释为观测 DUT1。
 */
export function estimateDeltaTSeconds(decimalYear: number) {
  if (!Number.isFinite(decimalYear) || decimalYear < 1900 || decimalYear >= 2201) {
    throw new Error('ΔT 估算年份需在 1900-2200 之间。');
  }
  let value: number;
  if (decimalYear < 1920) {
    const t = decimalYear - 1900;
    value = -2.79 + 1.494119 * t - 0.0598939 * t ** 2 + 0.0061966 * t ** 3 - 0.000197 * t ** 4;
  } else if (decimalYear < 1941) {
    const t = decimalYear - 1920;
    value = 21.2 + 0.84493 * t - 0.0761 * t ** 2 + 0.0020936 * t ** 3;
  } else if (decimalYear < 1961) {
    const t = decimalYear - 1950;
    value = 29.07 + 0.407 * t - t ** 2 / 233 + t ** 3 / 2547;
  } else if (decimalYear < 1986) {
    const t = decimalYear - 1975;
    value = 45.45 + 1.067 * t - t ** 2 / 260 - t ** 3 / 718;
  } else if (decimalYear < 2005) {
    const t = decimalYear - 2000;
    value =
      63.86 +
      0.3345 * t -
      0.060374 * t ** 2 +
      0.0017275 * t ** 3 +
      0.000651814 * t ** 4 +
      0.00002373599 * t ** 5;
  } else if (decimalYear < 2050) {
    const t = decimalYear - 2000;
    value = 62.92 + 0.32217 * t + 0.005589 * t ** 2;
  } else if (decimalYear < 2150) {
    value = -20 + 32 * ((decimalYear - 1820) / 100) ** 2 - 0.5628 * (2150 - decimalYear);
  } else {
    const u = (decimalYear - 1820) / 100;
    value = -20 + 32 * u ** 2;
  }
  return Number(value.toFixed(3));
}

export function buildAstronomicalTimeEvidence(
  input: AstronomicalTimeInput,
): AstronomicalTimeEvidence {
  const maxDay = daysInGregorianMonth(input.year, input.month);
  if (!Number.isInteger(input.day) || input.day < 1 || input.day > maxDay) {
    throw new Error(`${input.year}年${input.month}月不存在第${input.day}日。`);
  }
  if (input.year < 1900 || input.year > 2200) {
    throw new Error('天文时间尺度证据当前支持 1900-2200 年。');
  }
  const hour = input.hour ?? 0;
  const minute = input.minute ?? 0;
  const second = input.second ?? 0;
  assertIntegerInRange(hour, 0, 23, '小时');
  assertIntegerInRange(minute, 0, 59, '分钟');
  assertIntegerInRange(second, 0, 59, '秒');
  const civilTime = resolveCivilTime({
    year: input.year,
    month: input.month,
    day: input.day,
    hour,
    minute,
    second,
    timezone: input.timezone,
    timeZoneId: input.timeZoneId,
  });
  const { timezone, timezoneEvidence, utcTimestamp } = civilTime;
  const timeZoneId = civilTime.timeZoneId;
  const utcDate = new Date(utcTimestamp);
  const decimalYear = decimalYearFromUtc(utcDate);
  const deltaTSeconds = estimateDeltaTSeconds(decimalYear);
  const julianDayUtc = utcTimestamp / 86400000 + 2440587.5;
  // 未提供实时 DUT1 时只能以 UTC 近似 UT1；两者通常相差不超过 0.9 秒。
  const julianDayUtApprox = julianDayUtc;
  const julianDayTtApprox = julianDayUtApprox + deltaTSeconds / 86400;
  const precisionLevel =
    decimalYear < 2005 ? '历史拟合' : decimalYear < 2050 ? '近现代估算' : '长期外推';
  const utcParts = {
    year: utcDate.getUTCFullYear(),
    month: utcDate.getUTCMonth() + 1,
    day: utcDate.getUTCDate(),
    hour: utcDate.getUTCHours(),
    minute: utcDate.getUTCMinutes(),
    second: utcDate.getUTCSeconds(),
  };
  const localDateTime = civilTime.localDateTime.replace('T', ' ');
  const utcDateTime = `${formatDateTime(utcParts)}Z`;
  const assumptions = [
    timezoneEvidence
      ? `IANA 时区 ${timezoneEvidence.timeZoneId} 解析出历史偏移 UTC${timezone >= 0 ? '+' : ''}${timezone}。`
      : '输入 timezone 视为该时刻已经确认的法定 UTC 偏移，不自动推断地点历史时区。',
    '缺少实时 DUT1 数据时使用 UT1≈UTC，误差上限通常小于 0.9 秒。',
  ];
  const limitations = [
    'ΔT 是分段多项式估计值，不是逐日观测值；未来年份的不确定性会逐渐增大。',
    'TT 儒略日用于说明天文计算时间尺度，不代表底层依赖库一定采用同一星历或同一时间模型。',
  ];
  const source = 'UTC 儒略日采用 Unix 纪元换算；ΔT 采用 NASA/Espenak-Meeus 1900-2200 分段多项式';
  const calculationSteps: AstronomicalTimeCalculationStep[] = [
    {
      key: 'astronomical-time:calculation:timezone',
      stage: '时区解析',
      status: '已计算',
      dependsOnStepKeys: [],
      inputs: {
        localDateTime,
        ...(timeZoneId ? { timeZoneId } : { fixedOffsetHours: timezone }),
      },
      result: { timezone },
      promptText: timezoneEvidence
        ? `按 IANA 时区 ${timezoneEvidence.timeZoneId} 解析该时刻历史偏移 UTC${timezone >= 0 ? '+' : ''}${timezone}`
        : `采用明确给定的法定偏移 UTC${timezone >= 0 ? '+' : ''}${timezone}`,
      sources: timezoneEvidence
        ? ['IANA 时区历史规则', '历史偏移解析结果']
        : ['明确给定的法定 UTC 偏移'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'astronomical-time:calculation:utc',
      stage: 'UTC换算',
      status: '已计算',
      dependsOnStepKeys: ['astronomical-time:calculation:timezone'],
      inputs: { localDateTime, timezone },
      result: { utcDateTime, unixMilliseconds: utcTimestamp },
      promptText: `当地钟表时间${localDateTime}按 UTC${timezone >= 0 ? '+' : ''}${timezone}换算为${utcDateTime}`,
      sources: ['民用时间与 UTC 偏移换算'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'astronomical-time:calculation:jd-utc',
      stage: 'UTC儒略日',
      status: '已计算',
      dependsOnStepKeys: ['astronomical-time:calculation:utc'],
      inputs: { unixMilliseconds: utcTimestamp },
      result: { julianDayUtc: Number(julianDayUtc.toFixed(9)) },
      promptText: `UTC 时间按 Unix 纪元换算 JD(UTC)=${julianDayUtc.toFixed(9)}`,
      sources: ['Unix 纪元与儒略日换算关系'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'astronomical-time:calculation:ut1',
      stage: 'UT1近似',
      status: '近似',
      dependsOnStepKeys: ['astronomical-time:calculation:jd-utc'],
      inputs: { julianDayUtc: Number(julianDayUtc.toFixed(9)) },
      result: { julianDayUtApprox: Number(julianDayUtApprox.toFixed(9)) },
      promptText: `缺少实时 DUT1 时采用 UT1≈UTC，JD(UT)≈${julianDayUtApprox.toFixed(9)}`,
      sources: ['UT1 与 UTC 差值受闰秒体系约束，通常小于0.9秒'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'astronomical-time:calculation:tt',
      stage: 'ΔT与TT',
      status: precisionLevel === '长期外推' ? '近似' : '已计算',
      dependsOnStepKeys: ['astronomical-time:calculation:ut1'],
      inputs: { decimalYear: Number(decimalYear.toFixed(6)) },
      result: {
        deltaTSeconds,
        julianDayTtApprox: Number(julianDayTtApprox.toFixed(9)),
        precisionLevel,
      },
      promptText: `按 Espenak-Meeus 分段模型估算 ΔT≈${deltaTSeconds.toFixed(3)}秒，得 JD(TT)≈${julianDayTtApprox.toFixed(9)}，模型等级${precisionLevel}`,
      sources: ['NASA/Espenak-Meeus 1900-2200 分段多项式'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
  ];
  const assumptionFacts: AstronomicalTimeAssumptionFact[] = assumptions.map((text, index) => ({
    key: `astronomical-time:assumption:${index + 1}`,
    status: '适用',
    ownerStepKeys:
      index === 0
        ? ['astronomical-time:calculation:timezone']
        : ['astronomical-time:calculation:ut1'],
    ownerFactKeys:
      index === 0
        ? ['astronomical-time:calculation:timezone']
        : ['astronomical-time:calculation:ut1'],
    promptText: text,
    sources: [index === 0 ? '时区输入与历史偏移资料' : 'UT1 与 UTC 近似条件'],
    limitation: ASSUMPTION_FACT_LIMITATION,
  }));
  const counterEvidenceFacts: AstronomicalTimeCounterEvidenceFact[] = [
    {
      key: 'astronomical-time:counter:ut1-approximation',
      type: 'UT1近似',
      status: '近似',
      ownerFactKeys: ['astronomical-time:calculation:ut1'],
      ownerStepKeys: ['astronomical-time:calculation:ut1'],
      promptText: '未提供实时 DUT1，UT1 以 UTC 近似',
      sources: ['实时 DUT1 未作为输入提供'],
      limitation: COUNTER_FACT_LIMITATION,
    },
    {
      key: 'astronomical-time:counter:delta-t-model',
      type: 'ΔT模型等级',
      status: precisionLevel,
      ownerFactKeys: ['astronomical-time:calculation:tt'],
      ownerStepKeys: ['astronomical-time:calculation:tt'],
      promptText: `ΔT 使用${precisionLevel}分段模型，不是逐日观测值`,
      sources: ['Espenak-Meeus 分段多项式适用年代'],
      limitation: COUNTER_FACT_LIMITATION,
    },
  ];
  const counterSummaryFact: AstronomicalTimeCounterSummaryFact = {
    key: 'astronomical-time:counter-summary',
    status: '存在时间尺度近似',
    factKeys: counterEvidenceFacts.map((item) => item.key),
    promptText: `时间尺度含 UT1≈UTC 与 ΔT ${precisionLevel}模型；数值可用于当前民用历法计算，但不得宣称观测级精度`,
    sources: ['UT1 近似与 ΔT 模型等级汇总'],
    limitation: COUNTER_SUMMARY_LIMITATION,
  };
  const counterEvidence = counterEvidenceFacts.map((item) => item.promptText);
  const limitationFacts: AstronomicalTimeLimitationFact[] = [
    {
      key: 'astronomical-time:limitation:delta-t',
      type: 'ΔT估算边界',
      status: '适用',
      ownerFactKeys: ['astronomical-time:calculation:tt'],
      ownerStepKeys: ['astronomical-time:calculation:tt'],
      promptText: limitations[0],
      sources: ['Espenak-Meeus 分段多项式模型说明'],
      limitation: LIMITATION_FACT_LIMITATION,
    },
    {
      key: 'astronomical-time:limitation:ephemeris',
      type: '底层星历边界',
      status: '适用',
      ownerFactKeys: ['astronomical-time:calculation:jd-utc', 'astronomical-time:calculation:tt'],
      ownerStepKeys: ['astronomical-time:calculation:jd-utc', 'astronomical-time:calculation:tt'],
      promptText: limitations[1],
      sources: ['时间尺度与具体星历实现分离原则'],
      limitation: LIMITATION_FACT_LIMITATION,
    },
  ];
  const summaryStatus: AstronomicalTimeSummaryFact['status'] =
    timezoneEvidence?.status === 'ambiguous'
      ? timezoneEvidence.ambiguityResolvedByFixedOffset
        ? '历史时区歧义已消解'
        : timezoneEvidence.offsetConflict
          ? '含历史时区歧义与偏移冲突'
          : '含历史时区歧义'
      : timezoneEvidence?.offsetConflict
        ? '含固定偏移冲突'
        : precisionLevel === '长期外推'
          ? '含长期外推'
          : '民用时间链完整';
  const summaryFact: AstronomicalTimeSummaryFact = {
    key: 'astronomical-time:evidence-summary',
    status: summaryStatus,
    factKeys: [
      ...calculationSteps.map((item) => item.key),
      ...assumptionFacts.map((item) => item.key),
      ...counterEvidenceFacts.map((item) => item.key),
      counterSummaryFact.key,
      ...limitationFacts.map((item) => item.key),
      ...(timezoneEvidence
        ? [timezoneEvidence.diagnosticSummaryFact.key, timezoneEvidence.summaryFact.key]
        : []),
    ],
    calculationStepCount: calculationSteps.length,
    assumptionFactCount: assumptionFacts.length,
    counterEvidenceCount: counterEvidenceFacts.length,
    limitationFactCount: limitationFacts.length,
    promptText: `天文时间证据状态为${summaryStatus}；记录计算步骤${calculationSteps.length}项、计算假设${assumptionFacts.length}项、反证${counterEvidenceFacts.length}项、限制${limitationFacts.length}项`,
    sources: ['天文时间计算链、历史时区诊断、反证与限制事实汇总'],
    limitation: SUMMARY_FACT_LIMITATION,
  };

  return {
    key: `astronomical-time:${localDateTime}:${timeZoneId ?? timezone}`,
    status: '已计算',
    localDateTime,
    timezone,
    timeZoneId,
    timezoneEvidence,
    utcDateTime,
    unixMilliseconds: utcTimestamp,
    julianDayUtc: Number(julianDayUtc.toFixed(9)),
    julianDayUtApprox: Number(julianDayUtApprox.toFixed(9)),
    deltaTSeconds,
    julianDayTtApprox: Number(julianDayTtApprox.toFixed(9)),
    decimalYear: Number(decimalYear.toFixed(6)),
    deltaTModel: 'Espenak-Meeus 分段多项式（1900-2200）',
    precisionLevel,
    assumptions,
    assumptionFacts,
    calculationSteps,
    calculationChain: calculationSteps.map((item) => item.promptText),
    counterEvidence,
    counterEvidenceFacts,
    counterSummaryFact,
    limitations,
    limitationFacts,
    summaryFact,
    source,
    promptText: `天文时间尺度：当地钟表时间${localDateTime}（${timeZoneId ? `${timeZoneId}，` : ''}UTC${timezone >= 0 ? '+' : ''}${timezone}）→ UTC ${utcDateTime}；JD(UTC)=${julianDayUtc.toFixed(6)}，在 UT1≈UTC 假设下 JD(UT)≈${julianDayUtApprox.toFixed(6)}；ΔT≈${deltaTSeconds.toFixed(3)}秒，JD(TT)≈${julianDayTtApprox.toFixed(6)}。模型等级：${precisionLevel}。计算链：${calculationSteps.map((item) => item.promptText).join(' → ')}。反证汇总：${counterSummaryFact.promptText}。证据汇总：${summaryFact.promptText}。${timezoneEvidence ? `历史时区诊断：${timezoneEvidence.diagnostics.join('；')}。` : ''}来源：${source}。限制：${[...assumptions, ...limitations].join('；')}`,
  };
}
