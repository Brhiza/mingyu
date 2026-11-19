import { getCivilDateTimeAtFixedOffset, getHistoricalTimezoneOffsetAt, resolveCivilTime, type CivilDateTimeParts } from '../../huangji/civil-time';
import { correctBirthClock, resolveBirthClock } from '../../birth-time';
import { generateQimen } from '../chart';
import { buildTopicCandidates, extractPersonalMarkers, lifetimeTopics, type LifetimeTopic } from './markers';
import { buildLifetimeStages, type StagePolicy } from './stages';
import { buildDecadalLifetimeStages } from './decadal';
import { scanLifetimeDynamic, type DynamicRange } from './dynamic';

export interface LifetimeBirth extends CivilDateTimeParts {
  calendar?: 'solar' | 'lunar';
  leapMonth?: boolean;
  timezone?: number;
  timeZoneId?: string;
  timeStandard?: 'civil' | 'true-solar';
  longitude?: number;
}
export interface LifetimeInput {
  birth: LifetimeBirth;
  birthRange?: { start: string; end: string; index?: number };
  name?: string;
  gender?: 'male' | 'female';
  method?: 'zhuanpan' | 'feipan';
  juMethod?: 'chaibu' | 'zhirun';
  topics?: readonly LifetimeTopic[];
  periodRange?: DynamicRange;
  stagePolicy?: StagePolicy | { model: 'decadalGanzhi'; ageSystem?: 'fullYears' | 'nominalAge' };
}

/** 统一出生历法与当地时区，构建本命盘、个人标记、主题宫和阶段卡。 */
export async function calculateLifetime(input: LifetimeInput) {
  let birth = input.birth;
  if (input.method && !['zhuanpan', 'feipan'].includes(input.method)) throw new Error('未知奇门排盘方式。');
  if (input.juMethod && !['chaibu', 'zhirun'].includes(input.juMethod)) throw new Error('未知奇门定局方式。');
  if (input.gender && !['male', 'female'].includes(input.gender)) throw new Error('未知性别取法。');
  if (input.topics?.some((topic) => !lifetimeTopics.includes(topic))) throw new Error('未知终身局人生主题。');
  let resolved = resolveBirthClock(birth);
  let birthRange: { startTimestamp: number; endTimestamp: number; endExclusive: true; index: number; timestamp: number; totalSamples: number; nextIndex: number | null } | undefined;
  if (input.birthRange) {
    const start = Date.parse(input.birthRange.start), end = Date.parse(input.birthRange.end), index = input.birthRange.index ?? 0;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start % 1000 || end % 1000 || end <= start || end - start > 7_200_000) throw new Error('出生范围须为整秒、起点在前且最长两小时的半开区间。');
    if (resolved.utcTimestamp !== start) throw new Error('出生资料必须对应出生范围的起点。');
    const totalSamples = (end - start) / 1000;
    if (!Number.isSafeInteger(index) || index < 0 || index >= totalSamples) throw new Error('出生范围索引超出可用整秒范围。');
    const timestamp = start + index * 1000;
    const timezone = birth.timeZoneId ? getHistoricalTimezoneOffsetAt(new Date(timestamp), birth.timeZoneId) : resolved.timezone;
    if (!Number.isInteger(timezone * 60)) throw new Error('当前奇门排盘仅支持整分钟 UTC 偏移。');
    const civil = getCivilDateTimeAtFixedOffset(new Date(timestamp), timezone);
    birth = { ...birth, ...civil, calendar: 'solar', leapMonth: undefined, timezone };
    resolved = resolveCivilTime({ ...civil, timezone, timeZoneId: birth.timeZoneId });
    if (resolved.utcTimestamp !== timestamp) throw new Error('出生范围候选时刻与当地时区不一致。');
    birthRange = { startTimestamp: start, endTimestamp: end, endExclusive: true, index, timestamp, totalSamples, nextIndex: index + 1 < totalSamples ? index + 1 : null };
  }
  const offsetMinutes = resolved.timezone * 60;
  if (!Number.isInteger(offsetMinutes)) throw new Error('当前奇门排盘仅支持整分钟 UTC 偏移。');
  const instant = new Date(resolved.utcTimestamp);
  const { timestamp: chartTimestamp, correction } = await correctBirthClock(birth, resolved);
  const baseChart = generateQimen(new Date(chartTimestamp), input.method, 'hour', input.juMethod, correction ? instant : undefined, offsetMinutes, birth.timeZoneId);
  if (correction) baseChart.timeContext = { standard: 'true-solar', ...correction, referenceTimestamp: resolved.utcTimestamp };
  const markers = extractPersonalMarkers(baseChart), topics = buildTopicCandidates(baseChart, input.gender, input.topics);
  const policy = input.stagePolicy ?? { model: 'pillarFourLimits' as const };
  let stages, decadalBasis;
  if (policy.model === 'decadalGanzhi') {
    if ('anchorRule' in policy || 'yearsPerStage' in policy) throw new Error('十年干支大运不接受其他阶段锚点或年数。');
    const result = buildDecadalLifetimeStages(baseChart, { birthTimestamp: resolved.utcTimestamp, gender: input.gender!, timezone: resolved.timezone, timeZoneId: birth.timeZoneId, ageSystem: policy.ageSystem });
    stages = result.stages; decadalBasis = result.basis;
  } else {
    const birthCivilDate = getCivilDateTimeAtFixedOffset(new Date(chartTimestamp), resolved.timezone);
    stages = buildLifetimeStages(baseChart, { birthCivilDate, clockStandard: correction ? 'true-solar' : 'civil', timezone: resolved.timezone, timeZoneId: birth.timeZoneId, gender: input.gender, policy });
  }
  const dynamicFacts = input.periodRange ? scanLifetimeDynamic(baseChart, stages, input.periodRange, { timezone: resolved.timezone, timeZoneId: birth.timeZoneId }) : undefined;
  return { input, ...(birthRange ? { birthRange } : {}), basis: { birthTimestamp: resolved.utcTimestamp, localDateTime: resolved.localDateTime, timezone: resolved.timezone, ...(birth.timeZoneId ? { timeZoneId: birth.timeZoneId } : {}), calendar: input.birth.calendar ?? 'solar', timeStandard: birth.timeStandard ?? 'civil', ...(correction ? { longitude: correction.longitude, totalCorrectionMinutes: correction.totalCorrectionMinutes } : {}), stagePolicy: policy, ...(decadalBasis ? { decadalLuck: decadalBasis } : {}) }, baseChart, personalMarkers: markers, topicCandidates: topics, stages, ...(dynamicFacts ? { dynamicFacts } : {}) };
}
