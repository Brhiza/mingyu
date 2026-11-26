import { SolarTime } from 'tyme4ts';
import { lunarToCivilDate } from '../birth-time';
import { getDivinationTime } from '../calendar';
import { createTimezoneOffsetReader, createUtcTimestamp, getCivilDateTimeAtFixedOffset, resolveCivilDayStart, type CivilDateTimeParts } from '../huangji/civil-time';
import { buildPillarFacts, type PillarNames } from './pillars';
import { getMonthCommanderAt, termTimestamp } from './season';
import { buildNatalFacts } from './natal-facts';
import { buildDayMasterStrength } from './strength';
import { buildOrdinaryPattern, summarizePattern } from './pattern';
import { buildTransformation } from './transformation';
import { buildQuzhi } from './quzhi';
import { buildCongEr } from './conger';
import { buildExtremePattern } from './extreme';
import { buildUsefulBaseline } from './useful-baseline';
import { buildClimateCandidates } from './climate';
import { resolveClimate } from './climate-decision';
import { buildUsefulStrategy } from './useful-strategy';
import { determineUsefulGod } from './useful-god';
import { buildPatternEvidence } from './pattern-evidence';
import { calculateBaziShensha } from './shensha';
import { resolveBaziRules } from '../defaults';
import { civilDayHour } from './civil-day-hour';

export interface UnknownBaziBirth {
  year: number; month: number; day: number;
  calendar?: 'solar' | 'lunar'; leapMonth?: boolean;
  timezone?: number; timeZoneId?: string;
  timeStandard?: 'civil' | 'true-solar'; longitude?: number;
  shichenIndex?: number;
  /** 内部使用的整秒半开窗口；有窗口时不限制在同一当地日。 */
  range?: { startTimestamp: number; endTimestamp: number };
}
const HOUR = 3_600_000, DAY = 24 * HOUR;
const keys = ['year', 'month', 'day', 'hour'] as const;
const dateKey = (p: Pick<CivilDateTimeParts, 'year' | 'month' | 'day'>) => `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;

/** 未知时辰：以实际瞬时逐段覆盖出生当地日，不以某个代表时刻伪装确定四柱。 */
export async function calculateUnknownBaziTime(birth: UnknownBaziBirth, gender?: 'male' | 'female') {
  if (!Number.isInteger(birth.year) || birth.year < 1900 || birth.year > 2100) throw new Error('出生年份须在 1900 至 2100 之间。');
  if (birth.shichenIndex !== undefined && (!Number.isInteger(birth.shichenIndex) || birth.shichenIndex < 0 || birth.shichenIndex > 12)) throw new Error('出生时辰索引须在 0 至 12 之间。');
  if (!['solar', 'lunar'].includes(birth.calendar ?? 'solar')) throw new Error('出生历法须为公历或农历。');
  if (birth.calendar !== 'lunar' && birth.leapMonth !== undefined) throw new Error('只有农历可指定闰月。');
  if (!['civil', 'true-solar'].includes(birth.timeStandard ?? 'civil')) throw new Error('未知出生时间标准。');
  if (birth.timeStandard === 'true-solar' ? birth.longitude === undefined : birth.longitude !== undefined) throw new Error('真太阳时必须提供经度；民用时间不接受经度。');
  if (birth.longitude !== undefined && (!Number.isFinite(birth.longitude) || birth.longitude < -180 || birth.longitude > 180)) throw new Error('经度须在 -180 至 180 度之间。');
  if (birth.timezone !== undefined && (!Number.isFinite(birth.timezone) || birth.timezone < -12 || birth.timezone > 14 || !Number.isInteger(birth.timezone * 60))) throw new Error('时区须为 UTC-12 至 UTC+14 的整分钟偏移。');
  if (birth.range && (birth.shichenIndex !== undefined || birth.calendar === 'lunar' || birth.leapMonth !== undefined || (birth.timeZoneId !== undefined && birth.timezone !== undefined))) throw new Error('出生范围不能同时指定农历、时辰或固定偏移与 IANA 时区。');
  if (birth.range && (!Number.isSafeInteger(birth.range.startTimestamp) || !Number.isSafeInteger(birth.range.endTimestamp) || birth.range.startTimestamp % 1000 !== 0 || birth.range.endTimestamp % 1000 !== 0 || birth.range.endTimestamp <= birth.range.startTimestamp || birth.range.endTimestamp - birth.range.startTimestamp > 7_200_000)) throw new Error('出生范围须为整秒、起点在前且不超过两小时的半开区间。');
  let date = { year: birth.year, month: birth.month, day: birth.day };
  if (birth.calendar === 'lunar') {
    if (!Number.isInteger(birth.month) || birth.month < 1 || birth.month > 12) throw new Error('农历月份须在 1 至 12 之间。');
    date = lunarToCivilDate(birth.year, birth.month, birth.day, birth.leapMonth);
  }
  const zone = birth.timeZoneId?.trim();
  if (birth.timeZoneId !== undefined && !zone) throw new Error('IANA 时区名不能为空。');
  const timezone = birth.timezone ?? 8;
  const dayStart = (d: typeof date) => resolveCivilDayStart({ ...d, ...(zone ? { timeZoneId: zone } : { timezone }) }).utcTimestamp;
  const start = birth.range?.startTimestamp ?? dayStart(date);
  let end: number | undefined = birth.range?.endTimestamp;
  if (!birth.range) {
    const wall = createUtcTimestamp(date.year, date.month - 1, date.day);
    for (let delta = 1; delta <= 3; delta++) {
      const next = new Date(wall + delta * DAY);
      try { end = dayStart({ year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() }); break; }
      catch (error) { if (!(error instanceof Error) || !error.message.includes('整日不存在')) throw error; }
    }
  }
  if (end === undefined || end <= start || end - start > 49 * HOUR) throw new Error('无法确定当地出生日期的完整时间范围。');
  const readOffset = zone ? createTimezoneOffsetReader(zone) : undefined;
  const offsetAt = (timestamp: number) => {
    if (!readOffset) return timezone;
    const offset = readOffset(timestamp);
    if (!Number.isInteger(offset * 60) || offset < -12 || offset > 14) throw new Error('当前八字排盘仅支持整分钟 UTC 偏移。');
    return offset;
  };
  const solarTime = birth.timeStandard === 'true-solar' ? (await import('../astronomy/true-solar')).trueSolarTime : undefined;
  let cachedCommander: ReturnType<typeof getMonthCommanderAt> | undefined;
  const commanderAt = (timestamp: number) => {
    if (!cachedCommander || timestamp < cachedCommander.startTimestamp || timestamp >= cachedCommander.endTimestamp) cachedCommander = getMonthCommanderAt(timestamp);
    return cachedCommander;
  };
  let cachedTerm: { name: string; start: number; end: number } | undefined;
  const termAt = (timestamp: number) => {
    if (!cachedTerm || timestamp < cachedTerm.start || timestamp >= cachedTerm.end) {
      const p = getCivilDateTimeAtFixedOffset(new Date(timestamp), 8);
      const term = SolarTime.fromYmdHms(p.year, p.month, p.day, p.hour, p.minute, p.second).getTerm();
      cachedTerm = { name: term.getName(), start: termTimestamp(term), end: termTimestamp(term.next(1)) };
    }
    return cachedTerm.name;
  };
  // 年月只在交节时变化，日时只在当地钟表整点变化；避免每分钟重复计算历表。
  const termPillars = new Map<number, Pick<PillarNames, 'year' | 'month'>>();
  const hourPillars = new Map<string, Pick<PillarNames, 'day' | 'hour'>>();
  const target = dateKey(date);
  const windowStart = birth.shichenIndex === undefined || birth.shichenIndex === 0 ? 0 : 2 * birth.shichenIndex - 1;
  const windowEnd = birth.shichenIndex === undefined || birth.shichenIndex === 12 ? 24 : birth.shichenIndex === 0 ? 1 : windowStart + 2;
  const at = (timestamp: number) => {
    const offset = offsetAt(timestamp);
    const local = getCivilDateTimeAtFixedOffset(new Date(timestamp), offset);
    if (birth.range && (local.year < 1900 || local.year > 2100)) throw new Error('出生范围的当地年份须在 1900 至 2100 之间。');
    if (!birth.range && (dateKey(local) !== target || local.hour < windowStart || local.hour >= windowEnd || (zone && birth.timezone !== undefined && offset !== birth.timezone))) return { key: 'excluded', offset, local };
    const monthCommander = commanderAt(timestamp);
    const currentJieqi = termAt(timestamp);
    const termKey = monthCommander.previousJie.timestamp;
    let actual = termPillars.get(termKey);
    if (!actual) {
      const ganzhi = getDivinationTime(new Date(timestamp)).ganzhi;
      actual = { year: ganzhi.year, month: ganzhi.month };
      termPillars.set(termKey, actual);
    }
    const corrected = solarTime ? solarTime(new Date(timestamp), birth.longitude!).effectiveTimestamp + (480 - offset * 60) * 60_000 : timestamp;
    const wall = getCivilDateTimeAtFixedOffset(new Date(corrected), offset);
    const hourKey = `${wall.year}:${wall.month}:${wall.day}:${wall.hour}`;
    let apparent = hourPillars.get(hourKey);
    if (!apparent) {
      apparent = civilDayHour(wall);
      hourPillars.set(hourKey, apparent);
    }
    const names: PillarNames = { ...apparent, ...actual };
    return { key: `${offset}:${keys.map((key) => names[key]).join(':')}:${monthCommander.stem}:${currentJieqi}`, offset, local, names, monthCommander, currentJieqi };
  };
  type Segment = { startTimestamp: number; endTimestamp: number; endExclusive: true; timezone: number; localStart: CivilDateTimeParts; pillars: ReturnType<typeof buildPillarFacts>; natalFacts: ReturnType<typeof buildNatalFacts>; shensha: ReturnType<typeof calculateBaziShensha>; strength: ReturnType<typeof buildDayMasterStrength>; ordinaryPattern: ReturnType<typeof buildOrdinaryPattern>; transformation: ReturnType<typeof buildTransformation>; quzhi: ReturnType<typeof buildQuzhi>; conger: ReturnType<typeof buildCongEr>; extreme: ReturnType<typeof buildExtremePattern>; patternOverview: ReturnType<typeof summarizePattern>; patternEvidence: ReturnType<typeof buildPatternEvidence>; usefulBaseline: ReturnType<typeof buildUsefulBaseline>; climate: ReturnType<typeof buildClimateCandidates>; climateDecision: ReturnType<typeof resolveClimate>; usefulStrategy: ReturnType<typeof buildUsefulStrategy>; usefulGod: ReturnType<typeof determineUsefulGod>; monthCommander: ReturnType<typeof getMonthCommanderAt> };
  const segments: Segment[] = [];
  let excludedSeconds = 0, segmentStart = start, state = at(start);
  const close = (boundary: number) => {
    if (state.names && state.monthCommander) {
      const pillars = buildPillarFacts(state.names);
      const strength = buildDayMasterStrength(pillars, state.monthCommander.stem);
      const ordinaryPattern = buildOrdinaryPattern(pillars, state.monthCommander.stem);
      const transformation = buildTransformation(pillars, strength), quzhi = buildQuzhi(pillars);
      const conger = buildCongEr(pillars, strength, state.monthCommander.stem);
      const extreme = buildExtremePattern(pillars, strength, state.monthCommander.stem, quzhi, conger);
      const patternOverview = summarizePattern(ordinaryPattern, transformation, quzhi, conger, extreme);
      const patternEvidence = buildPatternEvidence(pillars, patternOverview, state.monthCommander.stem, strength.status);
      const usefulBaseline = buildUsefulBaseline(pillars, strength, patternOverview, transformation);
      const climate = buildClimateCandidates(pillars, strength, patternOverview, state.currentJieqi);
      const climateDecision = resolveClimate(climate.candidates, usefulBaseline);
      const usefulStrategy = buildUsefulStrategy(pillars, strength, patternOverview, state.monthCommander.stem, climateDecision);
      const usefulGod = determineUsefulGod({ pillars, strength, patternOverview, transformation, patternEvidence, climate, climateDecision, monthCommander: state.monthCommander });
      const defaultRules = resolveBaziRules();
      segments.push({ startTimestamp: segmentStart, endTimestamp: boundary, endExclusive: true, timezone: state.offset, localStart: state.local, pillars, natalFacts: buildNatalFacts(pillars, state.monthCommander.stem), shensha: calculateBaziShensha(pillars, gender, undefined, { yangRenMode: defaultRules.yangRenMode, kongWangMode: defaultRules.kongWangMode, shenshaBaseMode: defaultRules.shenshaBaseMode, xueTangMode: defaultRules.xueTangMode, tianYiMode: defaultRules.tianYiMode, tianGuanMode: defaultRules.tianGuanMode, hongYanMode: defaultRules.hongYanMode, tongZiMode: defaultRules.tongZiMode }), strength, ordinaryPattern, transformation, quzhi, conger, extreme, patternOverview, patternEvidence, usefulBaseline, climate, climateDecision, usefulStrategy, usefulGod, monthCommander: state.monthCommander });
    }
    else excludedSeconds += (boundary - segmentStart) / 1000;
  };
  // 四柱和时区分界最多按分钟发现，再以二分法精确到首个变化秒。
  for (let probe = Math.min(start + 60_000, end - 1000); ; probe = Math.min(probe + 60_000, end - 1000)) {
    let next = at(probe);
    while (next.key !== state.key) {
      let left = segmentStart / 1000, right = probe / 1000;
      while (right - left > 1) {
        const middle = Math.floor((left + right) / 2);
        if (at(middle * 1000).key === state.key) left = middle; else right = middle;
      }
      const boundary = right * 1000;
      close(boundary); segmentStart = boundary; state = at(boundary); next = at(probe);
    }
    if (probe === end - 1000) break;
  }
  close(end);
  if (!segments.length) throw new Error('指定当地日、时辰或时区偏移没有有效候选时刻。');
  const possible = Object.fromEntries(keys.map((key) => [key, [...new Set(segments.map((segment) => segment.pillars[key].ganZhi))]])) as Record<typeof keys[number], string[]>;
  const common = Object.fromEntries(keys.map((key) => [key, possible[key].length === 1 ? possible[key][0] : null])) as Record<typeof keys[number], string | null>;
  const possibleMonthCommanders = [...new Set(segments.map((segment) => segment.monthCommander.stem))];
  const possibleStrengths = [...new Set(segments.map((segment) => segment.strength.status))];
  const possibleOrdinaryPatterns = [...new Set(segments.map((segment) => segment.ordinaryPattern.candidate))];
  return { input: birth, possibleStrengths, commonStrength: possibleStrengths.length === 1 ? possibleStrengths[0] : null, possibleOrdinaryPatterns, commonOrdinaryPattern: possibleOrdinaryPatterns.length === 1 ? possibleOrdinaryPatterns[0] : null, source: { solarDate: dateKey(date), startTimestamp: start, endTimestamp: end, endExclusive: true, ...(birth.shichenIndex !== undefined ? { shichen: { index: birth.shichenIndex, startHour: windowStart, endHour: windowEnd, clock: 'civil' as const } } : {}), ...(zone ? { timeZoneId: zone } : { timezone }), ...(zone && birth.timezone !== undefined ? { requiredTimezone: birth.timezone } : {}), excludedSeconds }, common, possible, possibleMonthCommanders, commonMonthCommander: possibleMonthCommanders.length === 1 ? possibleMonthCommanders[0] : null, segments,
    limitation: '只比较所列实际时段的四柱与基础事实；起运时刻及依赖具体出生秒的分析仍须明确候选时刻。' };
}

/** 出生整秒范围复用未知时辰分段规则，允许跨当地日与夏令时。 */
export async function calculateBaziTimeRange(input: { startTimestamp: number; endTimestamp: number; timezone?: number; timeZoneId?: string; timeStandard?: 'civil' | 'true-solar'; longitude?: number }, gender?: 'male' | 'female') {
  if (!Number.isSafeInteger(input.startTimestamp) || !Number.isSafeInteger(input.endTimestamp) || input.startTimestamp % 1000 !== 0 || input.endTimestamp % 1000 !== 0 || input.endTimestamp <= input.startTimestamp || input.endTimestamp - input.startTimestamp > 7_200_000) throw new Error('出生范围须为整秒、起点在前且不超过两小时的半开区间。');
  if (input.timeZoneId !== undefined && input.timezone !== undefined) throw new Error('出生范围只能选择固定偏移或 IANA 时区。');
  const offsetAt = input.timeZoneId ? createTimezoneOffsetReader(input.timeZoneId) : () => input.timezone ?? 8;
  const offset = offsetAt(input.startTimestamp);
  const local = getCivilDateTimeAtFixedOffset(new Date(input.startTimestamp), offset);
  const lastLocal = getCivilDateTimeAtFixedOffset(new Date(input.endTimestamp - 1000), offsetAt(input.endTimestamp - 1000));
  if (local.year < 1900 || local.year > 2100 || lastLocal.year < 1900 || lastLocal.year > 2100) throw new Error('出生范围当地年份须在 1900 至 2100 之间。');
  return calculateUnknownBaziTime({ year: local.year, month: local.month, day: local.day,
    ...(input.timeZoneId !== undefined ? { timeZoneId: input.timeZoneId } : input.timezone !== undefined ? { timezone: input.timezone } : {}),
    ...(input.timeStandard !== undefined ? { timeStandard: input.timeStandard } : {}), ...(input.longitude !== undefined ? { longitude: input.longitude } : {}),
    range: { startTimestamp: input.startTimestamp, endTimestamp: input.endTimestamp } }, gender);
}
