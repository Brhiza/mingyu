import type { z } from 'zod';
import { JulianDay, SolarTerm } from 'tyme4ts';
import type { baziReverseInput } from '../schema';
import { sameJsonValue } from '../json-value';
import { getDivinationTime } from './calendar';
import { getSixtyCycleIndex, getSixtyCycleName, getYearMonthGanZhi, getYearSixtyCycle } from './ganzhi-foundation';
import { CHINA_DST_RANGES } from './birth-time';
import { trueSolarTime } from './astronomy/true-solar';
import { civilDayHour } from './bazi/civil-day-hour';
import { buildPillarFacts } from './bazi/pillars';
import { buildNatalFacts } from './bazi/natal-facts';
import { buildMethodSituationDigest } from './situation-digest';
import { createUtcTimestamp, formatCivilDateTime, getCivilDateTimeAtFixedOffset } from './huangji/civil-time';

type Input = z.infer<typeof baziReverseInput>;
type Source = Pick<Input, 'pillars' | 'startYear' | 'endYear' | 'longitude' | 'applyChinaDst'>;
type Pillars = Source['pillars'];
const HOUR = 3_600_000, DAY = 24 * HOUR;
const J2000_BEIJING_NOON_UTC = Date.UTC(2000, 0, 1, 4, 0, 0);
const J2000_BEIJING_MIDNIGHT_UTC = J2000_BEIJING_NOON_UTC - 12 * HOUR;
const GREGORIAN_START_TS = createUtcTimestamp(1582, 9, 15, -8);
const MODERN_START_TS = createUtcTimestamp(1900, 0, 1, -8);
const keys = ['year', 'month', 'day', 'hour'] as const;
const labels = { year: '年柱', month: '月柱', day: '日柱', hour: '时柱' } as const;

const pad2 = (value: number) => String(value).padStart(2, '0');
function jdToUtcMs(jd: number) { return Math.round((jd - 2451545) * 86_400) * 1000 + J2000_BEIJING_NOON_UTC; }
function utcMsToJd(timestamp: number) { return 2451545 + (timestamp - J2000_BEIJING_NOON_UTC) / DAY; }
function yearStartTimestamp(year: number) {
  return year >= 1583 ? createUtcTimestamp(year, 0, 1, -8) : jdToUtcMs(JulianDay.fromYmdHms(year, 1, 1, 0, 0, 0).getDay());
}
function dayIndexAt(timestamp: number) {
  const bjDay = Math.floor((timestamp - J2000_BEIJING_MIDNIGHT_UTC + HOUR) / DAY);
  return ((bjDay - 6) % 60 + 60) % 60;
}
function hourBranchAt(timestamp: number) {
  const msInDay = ((timestamp - J2000_BEIJING_MIDNIGHT_UTC) % DAY + DAY) % DAY;
  const hour = Math.floor(msInDay / HOUR);
  return Math.floor((hour + 1) / 2) % 12;
}

function validatePillars(pillars: Pillars) {
  const parsed = Object.fromEntries(keys.map((key) => {
    try { return [key, getSixtyCycleIndex(pillars[key])]; }
    catch { throw new Error(`${labels[key]}不是有效的六十甲子。`); }
  })) as Record<keyof Pillars, number>;
  const yearStem = parsed.year % 10, monthBranch = parsed.month % 12;
  const monthIndex = (monthBranch + 10) % 12;
  if ((parsed.month % 10) !== ((yearStem % 5) * 2 + 2 + monthIndex) % 10) throw new Error('年柱与月柱不符合五虎遁排月规则。');
  const dayStem = parsed.day % 10, hourBranch = parsed.hour % 12;
  if ((parsed.hour % 10) !== ((dayStem % 5) * 2 + hourBranch) % 10) throw new Error('日柱与时柱不符合五鼠遁排时规则。');
  return { yearIndex: parsed.year, dayIndex: parsed.day, monthIndex, hourBranch };
}

function beijing(timestamp: number) {
  if (timestamp >= GREGORIAN_START_TS) return `${formatCivilDateTime(getCivilDateTimeAtFixedOffset(new Date(timestamp), 8))}+08:00`;
  const st = JulianDay.fromJulianDay(utcMsToJd(timestamp)).getSolarTime();
  return `${String(st.getYear()).padStart(4, '0')}-${pad2(st.getMonth())}-${pad2(st.getDay())}T${pad2(st.getHour())}:${pad2(st.getMinute())}:${pad2(st.getSecond())}+08:00`;
}
function termTimestamp(term: ReturnType<typeof SolarTerm.fromIndex>) {
  if (term.getYear() >= 1) return jdToUtcMs(term.getJulianDay().getSolarTime().getJulianDay().getDay());
  return Math.floor((term.getJulianDay().getDay() - 2451545) * 86_400) * 1000 + J2000_BEIJING_NOON_UTC;
}
function pillarsAt(timestamp: number, longitude?: number): Pillars {
  if (timestamp >= MODERN_START_TS) {
    const actual = getDivinationTime(new Date(timestamp)).ganzhi;
    if (longitude === undefined) return actual;
    const effective = trueSolarTime(new Date(timestamp), longitude).effectiveTimestamp;
    const wall = getCivilDateTimeAtFixedOffset(new Date(effective), 8);
    const apparent = civilDayHour(wall);
    return { year: actual.year, month: actual.month, day: apparent.day, hour: apparent.hour };
  }
  const approxYear = timestamp >= GREGORIAN_START_TS
    ? getCivilDateTimeAtFixedOffset(new Date(timestamp), 8).year
    : JulianDay.fromJulianDay(utcMsToJd(timestamp)).getSolarTime().getYear();
  let lichunYear = approxYear;
  if (timestamp < termTimestamp(SolarTerm.fromIndex(approxYear, 3))) lichunYear = approxYear - 1;
  else if (timestamp >= termTimestamp(SolarTerm.fromIndex(approxYear + 1, 3))) lichunYear = approxYear + 1;
  let monthIndex = 0;
  for (let m = 11; m >= 0; m--) {
    if (timestamp >= termTimestamp(SolarTerm.fromIndex(lichunYear, 3).next(m * 2))) {
      monthIndex = m;
      break;
    }
  }
  const effective = longitude !== undefined ? trueSolarTime(new Date(timestamp), longitude).effectiveTimestamp : timestamp;
  const dayIdx = dayIndexAt(effective);
  const hourBranch = hourBranchAt(effective);
  const hourStem = ((dayIdx % 5) * 2 + hourBranch) % 10;
  const hourIdx = ((6 * hourStem - 5 * hourBranch) % 60 + 60) % 60;
  return {
    year: getYearSixtyCycle(lichunYear),
    month: getYearMonthGanZhi(lichunYear, monthIndex),
    day: getSixtyCycleName(dayIdx),
    hour: getSixtyCycleName(hourIdx),
  };
}
function matches(timestamp: number, expected: Pillars, longitude?: number) {
  const actual = pillarsAt(timestamp, longitude);
  return keys.every((key) => actual[key] === expected[key]);
}
function boundaryReason(timestamp: number, longitude?: number) {
  const before = pillarsAt(timestamp - 1000, longitude), after = pillarsAt(timestamp, longitude);
  return before.year !== after.year || before.month !== after.month ? '节气交接' : before.day !== after.day ? '子时换日' : '时辰交接';
}
function invertTrueSolarBoundary(targetEffectiveMs: number, longitude: number): number {
  // Approximate UTC timestamp from target true-solar timestamp, then binary-search exact whole-second crossing.
  const roughShift = Math.round(longitude * 240_000 - 480 * 60_000);
  let guess = Math.round((targetEffectiveMs - roughShift) / 1000) * 1000;
  for (let i = 0; i < 3; i++) {
    const corr = trueSolarTime(new Date(guess), longitude).effectiveTimestamp - guess;
    guess = Math.round((targetEffectiveMs - corr) / 1000) * 1000;
  }
  let left = guess - 120_000, right = guess + 120_000;
  while (right - left > 1000) {
    const mid = Math.floor((left + right) / 2000) * 1000;
    if (trueSolarTime(new Date(mid), longitude).effectiveTimestamp < targetEffectiveMs) left = mid;
    else right = mid;
  }
  return right;
}
function chinaDstAnnotation(startTimestamp: number, endTimestamp: number) {
  const local = getCivilDateTimeAtFixedOffset(new Date(startTimestamp), 8);
  const range = CHINA_DST_RANGES.find((item) => item.start[0] === local.year);
  if (!range) return undefined;
  // Standard UTC+8 start of China DST (02:00 standard time -> 03:00 DST) and end (01:00 standard time / 02:00 DST).
  const dstStartUtc = createUtcTimestamp(range.start[0], range.start[1] - 1, range.start[2], range.start[3] - 1 - 8);
  const dstEndUtc = createUtcTimestamp(range.end[0], range.end[1] - 1, range.end[2], range.end[3] - 1 - 8);
  const inDst = startTimestamp < dstEndUtc && endTimestamp > dstStartUtc;
  if (!inDst) return { inDst: false as const };
  return {
    inDst: true as const,
    dstWallStart: `${formatCivilDateTime(getCivilDateTimeAtFixedOffset(new Date(startTimestamp), 9))}+09:00`,
    dstWallEnd: `${formatCivilDateTime(getCivilDateTimeAtFixedOffset(new Date(endTimestamp), 9))}+09:00`,
    note: '处于 1986–1991 中国夏令时期间；当时拨快 1 小时的夏令时钟表记录对应 dstWallStart 至 dstWallEnd。',
  };
}

export function searchBaziDates(source: Source) {
  if (!Number.isInteger(source.startYear) || !Number.isInteger(source.endYear) || source.startYear < 1 || source.endYear > 2100 || source.startYear > source.endYear) throw new Error('查询年份须在 1 至 2100 之间，且起始年不晚于结束年。');
  if (source.longitude !== undefined && (!Number.isFinite(source.longitude) || source.longitude < -180 || source.longitude > 180)) throw new Error('经度须在 -180 至 180 度之间。');
  const { yearIndex, dayIndex, monthIndex, hourBranch } = validatePillars(source.pillars);
  const rangeStart = yearStartTimestamp(source.startYear), rangeEnd = yearStartTimestamp(source.endYear + 1);
  const candidates: Array<{ start: string; end: string; startTimestamp: number; endTimestamp: number; endExclusive: true;
    startBoundary: string; endBoundary: string;
    chinaDst?: ReturnType<typeof chinaDstAnnotation>;
    birthRange: { start: string; end: string; timezone: 8; timeStandard?: 'true-solar'; longitude?: number; pillars?: Pillars } }> = [];
  // 目标年柱每 60 年重复；每个目标节气月只需检查对应日柱的日期。
  const firstYear = source.startYear - 1, firstIndex = getSixtyCycleIndex(getYearSixtyCycle(firstYear));
  for (let year = firstYear + (yearIndex - firstIndex + 60) % 60; year <= source.endYear; year += 60) {
    const term = SolarTerm.fromIndex(year, 3).next(monthIndex * 2);
    const from = Math.max(termTimestamp(term), rangeStart), to = Math.min(termTimestamp(term.next(2)), rangeEnd);
    if (from >= to) continue;
    const firstDay = Math.floor((from - J2000_BEIJING_MIDNIGHT_UTC) / DAY) * DAY + J2000_BEIJING_MIDNIGHT_UTC - DAY;
    const firstIndex = dayIndexAt(firstDay + 12 * HOUR);
    for (let day = firstDay + ((dayIndex - firstIndex + 60) % 60) * DAY; day < to + DAY; day += 60 * DAY) {
      const nominalHourStart = hourBranch === 0 ? day - HOUR : day + (hourBranch * 2 - 1) * HOUR;
      const nominalHourEnd = nominalHourStart + 2 * HOUR;
      const hourStart = source.longitude !== undefined ? invertTrueSolarBoundary(nominalHourStart, source.longitude) : nominalHourStart;
      const hourEnd = source.longitude !== undefined ? invertTrueSolarBoundary(nominalHourEnd, source.longitude) : nominalHourEnd;
      const startTimestamp = Math.max(from, hourStart), endTimestamp = Math.min(to, hourEnd);
      if (startTimestamp >= endTimestamp) continue;
      if (!matches(startTimestamp, source.pillars, source.longitude) || !matches(endTimestamp - 1000, source.pillars, source.longitude)) throw new Error('反推候选的边界与正向排盘不一致。');
      const start = beijing(startTimestamp), end = beijing(endTimestamp);
      const chinaDst = source.applyChinaDst ? chinaDstAnnotation(startTimestamp, endTimestamp) : undefined;
      candidates.push({ start, end, startTimestamp, endTimestamp, endExclusive: true,
        startBoundary: startTimestamp === rangeStart ? '查询范围开始' : boundaryReason(startTimestamp, source.longitude),
        endBoundary: endTimestamp === rangeEnd ? '查询范围结束' : boundaryReason(endTimestamp, source.longitude),
        ...(chinaDst ? { chinaDst } : {}),
        birthRange: source.longitude !== undefined
          ? { start, end, timezone: 8, timeStandard: 'true-solar', longitude: source.longitude }
          : { start, end, timezone: 8, pillars: { ...source.pillars } } });
    }
  }
  candidates.sort((a, b) => a.startTimestamp - b.startTimestamp);
  const inputRecord = {
    pillars: { ...source.pillars },
    startYear: source.startYear,
    endYear: source.endYear,
    ...(source.longitude !== undefined ? { longitude: source.longitude } : {}),
    ...(source.applyChinaDst !== undefined ? { applyChinaDst: source.applyChinaDst } : {}),
  };
  const policy = {
    timezone: '标准北京时间 UTC+8',
    month: '节气月',
    dayChange: '23点换日',
    interval: '起点含、终点不含',
    ...(source.longitude !== undefined ? { timeStandard: `真太阳时（经度 ${source.longitude}°）` } : {}),
    ...(source.applyChinaDst ? { chinaDst: '已标注 1986–1991 中国历史夏令时钟表范围' } : {}),
  };
  const limitation = source.longitude !== undefined
    ? '候选已按所给经度的真太阳时换算为标准北京时间（UTC+8）范围，不代表已经确定具体出生秒。'
    : '候选只是满足四柱的时间范围，不代表已经确定实际出生时间；不使用地方历史夏令时或真太阳时。';
  return { input: inputRecord, candidates, candidateCount: candidates.length, policy, limitation };
}
type Data = ReturnType<typeof searchBaziDates>;
function render(data: Data, question: string) {
  const pillarFacts = buildPillarFacts(data.input.pillars);
  const natalFacts = buildNatalFacts(pillarFacts);
  const pillarLines = keys.map((key) => {
    const p = pillarFacts[key];
    return `${labels[key]}：${p.ganZhi}（${p.tenGod}）；藏干 ${p.hiddenStems.map((x) => `${x.stem}${x.tenGod}`).join('、')}；纳音 ${p.naYin}；旬空 ${p.voidBranches.join('、')}；十二长生 ${p.lifeStage}`;
  }).join('\n');
  const relationLine = natalFacts.relations.map((r) => `${r.positions.map((pos) => labels[pos]).join('、')}${r.values.join('')}：${r.name}${r.element ? `（${r.element}）` : ''}`).join('；') || '未见明显干支合冲刑害';
  const digestLines = buildMethodSituationDigest('bazi-reverse', data, question);
  const text = [`【四柱反推】\n年、月、日、时：${keys.map((key) => data.input.pillars[key]).join(' ')}；公历年份 ${data.input.startYear}–${data.input.endYear}（含两端）${data.input.longitude !== undefined ? `；真太阳时经度 ${data.input.longitude}°` : ''}${data.input.applyChinaDst ? '；含中国历史夏令时标注' : ''}。`,
    digestLines.length ? `【局势要点】\n${digestLines.join('\n')}` : '',
    `【四柱盘面结构】\n${pillarLines}\n原局干支关系：${relationLine}。`,
    `【候选范围】\n${data.candidates.map((item, index) => `${index + 1}. ${item.start} 至 ${item.end}（起点含、终点不含）；开始：${item.startBoundary}；结束：${item.endBoundary}。${item.chinaDst?.inDst ? `\n夏令时民用钟表：${item.chinaDst.dstWallStart} 至 ${item.chinaDst.dstWallEnd}（${item.chinaDst.note}）` : ''}\n用于八字、姓名分析或起名的出生范围：${JSON.stringify(item.birthRange)}`).join('\n') || '所查年份没有符合四柱的候选。'}`,
    `【口径】\n标准北京时间 UTC+8，节气月，23点换日${data.input.longitude !== undefined ? `，日时按经度 ${data.input.longitude}° 真太阳时反推` : ''}。${data.limitation}`, `【问题】\n${question}`].join('\n\n');
  return { text };
}
export function baziReverse(input: Input) {
  const data = searchBaziDates(input), question = input.question?.trim() || '请列出符合四柱的候选时间范围。';
  return { data, summary: { title: '四柱反推', lines: [`${data.candidateCount} 个候选范围`] }, prompt: render(data, question) };
}
export function promptForBaziReverse(data: unknown, source: Source, question: string) {
  const expected = searchBaziDates(source);
  if (!sameJsonValue(data, expected)) throw new Error('四柱反推结果与输入不一致。');
  return render(expected, question);
}
