/**
 * 星盘周期内动态点关键星象：精准行运相位、天象互相位、停逆、换座、换宫、朔望与交食。
 */
import {
  findLunarEclipses,
  findSolarEclipses,
  getApparentPosition,
  julianDateToUnix,
  unixToJulianDate,
} from '../astrology/engine';
import { daysInGregorianMonth } from '../calendar/date-validation';
import { resolveCivilTime, type CivilTimeZoneInput } from '../calendar/civil-time';
import type { AstrolabeData, AstrolabePoint } from '../types/divination';

export type AstrolabePeriodScopeMode = 'yearly' | 'monthly' | 'daily';

export const ASTROLABE_PERIOD_CONTEXT_POINT_NAMES = [
  'Sun',
  'Moon',
  'Mercury',
  'Venus',
  'Mars',
  'Jupiter',
  'Saturn',
  'Uranus',
  'Neptune',
  'Pluto',
  'North Node',
  'South Node',
  'Ascendant',
  'Midheaven',
] as const;

export type AstrolabePeriodContextPointName = (typeof ASTROLABE_PERIOD_CONTEXT_POINT_NAMES)[number];

export type AstrolabePeriodContext = {
  timezone: number;
  timeZoneId?: string;
  points: Array<{
    name: AstrolabePeriodContextPointName;
    longitude: number;
  }>;
  houseCusps: [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
};

export type AstrolabePeriodDate = {
  year: number;
  month: number;
  day: number;
};

export type AstrolabePeriodBatchInput = {
  start: AstrolabePeriodDate;
  endExclusive: AstrolabePeriodDate;
};

export type AstrolabePeriodBatchRange = {
  startDate: string;
  endDate: string;
  endExclusive: true;
};

export type AstrolabePeriodBatch = {
  scopeStartDate: string;
  scopeEndDate: string;
  range: AstrolabePeriodBatchRange;
  nextRange: AstrolabePeriodBatchRange | null;
};

export type AstrolabePeriodBatchResult = {
  kind: 'astrolabe-period-batch';
  scope: AstrolabePeriodScopeMode;
  target: string;
  parentRange: AstrolabePeriodBatchRange;
  range: AstrolabePeriodBatchRange;
  nextRange: AstrolabePeriodBatchRange | null;
  timezone: number;
  timeZoneId?: string;
  sampleStepDays: number;
  events: AstrolabePeriodEvent[];
};

export type AstrolabePeriodEventKind =
  '行运相位' | '天象相位' | '停逆' | '换座' | '换宫' | '朔望' | '交食';

export interface AstrolabePeriodEvent {
  key: string;
  kind: AstrolabePeriodEventKind;
  julianDate: number;
  dateTime: string;
  promptText: string;
  movingPoint: string;
  targetPoint?: string;
  aspectName?: string;
  signName?: string;
  house?: number;
  stationDirection?: '逆行' | '顺行';
  lunationName?: '朔' | '望' | '上弦' | '下弦';
  /** 朔望触碰本命点的结构化事实；旧手工事件可省略，核心生成结果始终提供。 */
  lunationTouches?: AstrolabeLunationNatalTouch[];
  eclipseName?: string;
}

export type AstrolabeLunationAspectName = '合相' | '刑相' | '冲相';

export type AstrolabeLunationNatalTouch = {
  pointName: string;
  pointLabel: string;
  aspectName: AstrolabeLunationAspectName;
  aspectSymbol: string;
  exactAngle: number;
  actualAngle: number;
  deviation: number;
  allowedOrb: number;
};

export interface AstrolabePeriodTransitGroup {
  key: string;
  movingPoint: string;
  targetPoint: string;
  aspectName: string;
  events: AstrolabePeriodEvent[];
  promptText: string;
}

export interface AstrolabePeriodWindow {
  startDateTime: string;
  endDateTime: string;
  eventKeys: string[];
  promptText: string;
}

export interface AstrolabePeriodAxisItem {
  key: string;
  promptText: string;
  /** 归组主轴展开后的事件成员；单事件主轴包含自身 key。 */
  eventKeys?: string[];
}

export interface AstrolabePeriodEventCollection {
  startDateTime: string;
  endDateTime: string;
  timezoneLabel: string;
  events: AstrolabePeriodEvent[];
  groups: AstrolabePeriodTransitGroup[];
  windows: AstrolabePeriodWindow[];
  axis: AstrolabePeriodAxisItem[];
  promptText: string;
  batch?: AstrolabePeriodBatch;
}

const BODY_LABELS: Record<string, string> = {
  Sun: '太阳',
  Moon: '月亮',
  Mercury: '水星',
  Venus: '金星',
  Mars: '火星',
  Jupiter: '木星',
  Saturn: '土星',
  Uranus: '天王星',
  Neptune: '海王星',
  Pluto: '冥王星',
  'North Node': '北交点',
  'South Node': '南交点',
  Ascendant: '上升',
  Midheaven: '天顶',
};

const BODY_IDS: Record<string, string> = {
  Sun: 'sun',
  Moon: 'moon',
  Mercury: 'mercury',
  Venus: 'venus',
  Mars: 'mars',
  Jupiter: 'jupiter',
  Saturn: 'saturn',
  Uranus: 'uranus',
  Neptune: 'neptune',
  Pluto: 'pluto',
  'North Node': 'true_node',
};

const SIGN_LABELS = [
  '白羊座',
  '金牛座',
  '双子座',
  '巨蟹座',
  '狮子座',
  '处女座',
  '天秤座',
  '天蝎座',
  '射手座',
  '摩羯座',
  '水瓶座',
  '双鱼座',
] as const;

const MAJOR_ASPECTS = [
  { name: '合相', angle: 0, symbol: '合' },
  { name: '六合', angle: 60, symbol: '六合' },
  { name: '刑相', angle: 90, symbol: '刑' },
  { name: '拱相', angle: 120, symbol: '拱' },
  { name: '冲相', angle: 180, symbol: '冲' },
] as const;

const LUNATION_ASPECTS = [
  { name: '合相', angle: 0, symbol: '合' },
  { name: '刑相', angle: 90, symbol: '刑' },
  { name: '冲相', angle: 180, symbol: '冲' },
] as const satisfies ReadonlyArray<{
  name: AstrolabeLunationAspectName;
  angle: number;
  symbol: string;
}>;

const LUNATION_ORB = 3;
const MINUTE_IN_DAYS = 1 / 1440;
const YEARLY_BODIES = ['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'North Node'] as const;
const MONTHLY_EXTRA_BODIES = ['Mars', 'Venus', 'Mercury', 'Sun'] as const;
const DAILY_EXTRA_BODIES = ['Moon'] as const;
const NATAL_POINT_NAMES = [
  'Sun',
  'Moon',
  'Mercury',
  'Venus',
  'Mars',
  'Jupiter',
  'Saturn',
  'Uranus',
  'Neptune',
  'Pluto',
  'North Node',
  'South Node',
  'Ascendant',
  'Midheaven',
] as const;
const LUNATION_NATAL_NAMES = new Set([
  'Sun',
  'Moon',
  'Ascendant',
  'Midheaven',
  'North Node',
  'South Node',
]);

type MovingBodyName =
  (typeof YEARLY_BODIES)[number] | (typeof MONTHLY_EXTRA_BODIES)[number] | 'Moon';

type Sample = {
  jd: number;
  longitude: number;
  speed: number;
};

type BodyPosition = {
  longitude: number;
  speed: number;
};

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function normalizeLongitude(value: number) {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function wrap180(value: number) {
  const normalized = normalizeLongitude(value);
  return normalized > 180 ? normalized - 360 : normalized;
}

function labelOf(name: string) {
  return BODY_LABELS[name] ?? name;
}

function aspectTargets(angle: number) {
  if (angle === 0 || angle === 180) return [angle];
  return [angle, 360 - angle];
}

function bodyIdOf(name: MovingBodyName) {
  return BODY_IDS[name];
}

function positionOf(name: MovingBodyName, jd: number) {
  const position = getApparentPosition(bodyIdOf(name), jd);
  return { longitude: normalizeLongitude(position.longitude), speed: position.speed };
}

function movingBodiesForScope(scope: AstrolabePeriodScopeMode): MovingBodyName[] {
  if (scope === 'yearly') return [...YEARLY_BODIES];
  if (scope === 'monthly') return [...YEARLY_BODIES, ...MONTHLY_EXTRA_BODIES];
  return [...YEARLY_BODIES, ...MONTHLY_EXTRA_BODIES, ...DAILY_EXTRA_BODIES];
}

function sampleStepDays(scope: AstrolabePeriodScopeMode) {
  if (scope === 'daily') return 1 / 24;
  if (scope === 'monthly') return 0.25;
  return 1;
}

function houseForLongitude(cusps: number[], longitude: number) {
  for (let index = 0; index < cusps.length; index += 1) {
    const current = cusps[index];
    const next = cusps[(index + 1) % cusps.length];
    const span = normalizeLongitude(next - current) || 360;
    if (normalizeLongitude(longitude - current) < span) return index + 1;
  }
  return 0;
}

type AstrolabePeriodSource = AstrolabeData | AstrolabePeriodContext;

function isAstrolabePeriodContext(source: AstrolabePeriodSource): source is AstrolabePeriodContext {
  return 'points' in source && 'houseCusps' in source;
}

function getTimeZoneId(source: AstrolabePeriodSource) {
  return isAstrolabePeriodContext(source) ? source.timeZoneId : source.birth.timeZoneId;
}

function getTimezone(source: AstrolabePeriodSource) {
  return isAstrolabePeriodContext(source) ? source.timezone : source.birth.timezone;
}

function getTimeZoneInput(source: AstrolabePeriodSource): CivilTimeZoneInput {
  const timeZoneId = getTimeZoneId(source);
  if (timeZoneId) return { timeZoneId };
  const timezone = getTimezone(source);
  if (!Number.isFinite(timezone)) {
    throw new Error('星盘缺少有效时区，无法计算周期星象。');
  }
  return { timezone };
}

function addCalendarMonths(year: number, month: number, count: number) {
  const index = year * 12 + (month - 1) + count;
  return { year: Math.floor(index / 12), month: (index % 12) + 1, day: 1 };
}

function nextDate(year: number, month: number, day: number) {
  const lastDay = daysInGregorianMonth(year, month);
  if (day < lastDay) return { year, month, day: day + 1 };
  if (month < 12) return { year, month: month + 1, day: 1 };
  return { year: year + 1, month: 1, day: 1 };
}

function addCalendarDays(date: AstrolabePeriodDate, days: number): AstrolabePeriodDate {
  const value = new Date(Date.UTC(date.year, date.month - 1, date.day));
  value.setUTCDate(value.getUTCDate() + days);
  return {
    year: value.getUTCFullYear(),
    month: value.getUTCMonth() + 1,
    day: value.getUTCDate(),
  };
}

function compareCalendarDates(first: AstrolabePeriodDate, second: AstrolabePeriodDate) {
  return (
    Date.UTC(first.year, first.month - 1, first.day) -
    Date.UTC(second.year, second.month - 1, second.day)
  );
}

function calendarDaySpan(start: AstrolabePeriodDate, endExclusive: AstrolabePeriodDate) {
  return Math.round(compareCalendarDates(endExclusive, start) / 86400000);
}

function formatCivilDate(value: { year: number; month: number; day: number }) {
  return `${value.year}-${pad(value.month)}-${pad(value.day)}`;
}

function dateParts(value: { year: number; month: number; day: number }): AstrolabePeriodDate {
  return { year: value.year, month: value.month, day: value.day };
}

function buildNextBatchRange(
  start: AstrolabePeriodDate,
  endExclusive: AstrolabePeriodDate,
  scopeEndExclusive: AstrolabePeriodDate,
): AstrolabePeriodBatchRange | null {
  const span = calendarDaySpan(start, endExclusive);
  if (span <= 0 || compareCalendarDates(endExclusive, scopeEndExclusive) >= 0) return null;
  const nextEnd =
    compareCalendarDates(addCalendarDays(endExclusive, span), scopeEndExclusive) >= 0
      ? scopeEndExclusive
      : addCalendarDays(endExclusive, span);
  return {
    startDate: formatCivilDate(endExclusive),
    endDate: formatCivilDate(nextEnd),
    endExclusive: true,
  };
}

function resolveLocalInstant(
  source: AstrolabePeriodSource,
  date: { year: number; month: number; day: number },
  hour = 0,
  minute = 0,
  second = 0,
) {
  return resolveCivilTime({
    ...date,
    hour,
    minute,
    second,
    ...getTimeZoneInput(source),
  });
}

function formatCivilStamp(value: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}) {
  return `${value.year}-${pad(value.month)}-${pad(value.day)} ${pad(value.hour)}:${pad(value.minute)}`;
}

function formatEventDateTime(jd: number, timeZoneId: string | undefined, timezone: number) {
  const utc = new Date(julianDateToUnix(jd));
  if (timeZoneId) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timeZoneId,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(utc);
    const read = (type: string) => parts.find((item) => item.type === type)?.value ?? '00';
    return `${read('year')}-${read('month')}-${read('day')} ${read('hour')}:${read('minute')}`;
  }
  const local = new Date(utc.getTime() + timezone * 3_600_000);
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())} ${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
}

export function resolveAstrolabePeriodWindow(
  source: AstrolabePeriodSource,
  scope: AstrolabePeriodScopeMode,
  target: { year: number; month: number; day: number },
  batch?: AstrolabePeriodBatchInput,
) {
  const scopeStartDate =
    scope === 'yearly'
      ? { year: target.year, month: 1, day: 1 }
      : scope === 'monthly'
        ? { year: target.year, month: target.month, day: 1 }
        : { year: target.year, month: target.month, day: target.day };
  const scopeEndDate =
    scope === 'yearly'
      ? { year: target.year + 1, month: 1, day: 1 }
      : scope === 'monthly'
        ? addCalendarMonths(target.year, target.month, 1)
        : nextDate(target.year, target.month, target.day);
  const scopeStart = resolveLocalInstant(source, scopeStartDate);
  const scopeEnd = resolveLocalInstant(source, scopeEndDate);
  const startDate = batch?.start ?? scopeStartDate;
  const endDate = batch?.endExclusive ?? scopeEndDate;
  const start = batch ? resolveLocalInstant(source, startDate) : scopeStart;
  const end = batch ? resolveLocalInstant(source, endDate) : scopeEnd;
  if (batch) {
    if (calendarDaySpan(startDate, endDate) <= 0) {
      throw new Error('星盘周期批次的 endDate 必须晚于 startDate。');
    }
    if (start.utcTimestamp < scopeStart.utcTimestamp || end.utcTimestamp > scopeEnd.utcTimestamp) {
      throw new Error('星盘周期批次必须完整落在所选分析范围内。');
    }
  }
  const timeZoneId = getTimeZoneId(source);
  const timezoneLabel = timeZoneId
    ? `${timeZoneId}（UTC${start.timezone >= 0 ? '+' : ''}${start.timezone}）`
    : `UTC${start.timezone >= 0 ? '+' : ''}${start.timezone}`;
  return {
    start,
    end,
    scopeStart,
    scopeEnd,
    startJd: unixToJulianDate(start.utcTimestamp),
    endJd: unixToJulianDate(end.utcTimestamp),
    scopeStartJd: unixToJulianDate(scopeStart.utcTimestamp),
    scopeEndJd: unixToJulianDate(scopeEnd.utcTimestamp),
    timezoneLabel,
    startDateTime: formatCivilStamp(start.localTime),
    endDateTime: formatCivilStamp(end.localTime),
    batch: batch
      ? {
          scopeStartDate: formatCivilDate(scopeStart.localTime),
          scopeEndDate: formatCivilDate(scopeEnd.localTime),
          range: {
            startDate: formatCivilDate(start.localTime),
            endDate: formatCivilDate(end.localTime),
            endExclusive: true as const,
          },
          nextRange: buildNextBatchRange(
            dateParts(start.localTime),
            dateParts(end.localTime),
            dateParts(scopeEnd.localTime),
          ),
        }
      : undefined,
  };
}

function bisectZero(fn: (jd: number) => number, left: number, right: number, leftValue: number) {
  let low = left;
  let high = right;
  let lowValue = leftValue;
  for (let index = 0; index < 40 && high - low > MINUTE_IN_DAYS; index += 1) {
    const middle = (low + high) / 2;
    const middleValue = fn(middle);
    if (lowValue * middleValue <= 0) {
      high = middle;
    } else {
      low = middle;
      lowValue = middleValue;
    }
  }
  return (low + high) / 2;
}

function crossingsFromSamples(
  samples: Sample[],
  residualAt: (sample: Sample, index: number) => number,
  exactAt: (jd: number) => number,
) {
  const hits: number[] = [];
  for (let index = 1; index < samples.length; index += 1) {
    const previous = residualAt(samples[index - 1], index - 1);
    const current = residualAt(samples[index], index);
    if (previous === 0) {
      hits.push(samples[index - 1].jd);
      continue;
    }
    if (previous * current <= 0 && Math.abs(current - previous) < 180) {
      hits.push(bisectZero(exactAt, samples[index - 1].jd, samples[index].jd, previous));
    }
  }
  return hits;
}

function sampleBody(
  name: MovingBodyName,
  startJd: number,
  endJd: number,
  step: number,
  positionAt: (name: MovingBodyName, jd: number) => BodyPosition = positionOf,
) {
  const samples: Sample[] = [];
  const last = endJd + step * 0.5;
  for (let jd = startJd; jd <= last; jd += step) {
    const clamped = Math.min(jd, endJd);
    const position = positionAt(name, clamped);
    samples.push({ jd: clamped, longitude: position.longitude, speed: position.speed });
    if (clamped === endJd) break;
  }
  if (samples.length === 0 || samples[samples.length - 1].jd < endJd) {
    const position = positionAt(name, endJd);
    samples.push({ jd: endJd, longitude: position.longitude, speed: position.speed });
  }
  return samples;
}

function isFiniteLongitude(point: Partial<AstrolabePoint>) {
  return typeof point.longitude === 'number' && Number.isFinite(point.longitude);
}

function natalPointsOf(source: AstrolabePeriodSource) {
  if (isAstrolabePeriodContext(source)) {
    return source.points.map((point) => ({
      name: point.name,
      longitude: normalizeLongitude(point.longitude),
    }));
  }
  const byName = new Map<string, number>();
  for (const point of [...source.planets, ...source.angles]) {
    if (!NATAL_POINT_NAMES.includes(point.name as (typeof NATAL_POINT_NAMES)[number])) continue;
    if (!isFiniteLongitude(point)) continue;
    byName.set(point.name, normalizeLongitude(point.longitude));
  }
  return [...byName.entries()].map(([name, longitude]) => ({ name, longitude }));
}

function natalCuspsOf(source: AstrolabePeriodSource) {
  if (isAstrolabePeriodContext(source)) {
    return source.houseCusps.length === 12 &&
      source.houseCusps.every((item) => Number.isFinite(item))
      ? source.houseCusps.map(normalizeLongitude)
      : null;
  }
  const cusps = source.houses
    .slice()
    .sort((first, second) => first.house - second.house)
    .map((item) => item.longitude);
  return cusps.length === 12 && cusps.every((item) => Number.isFinite(item))
    ? cusps.map(normalizeLongitude)
    : null;
}

export function buildAstrolabePeriodContext(data: AstrolabeData): AstrolabePeriodContext {
  const points = natalPointsOf(data).filter(
    (
      point,
    ): point is {
      name: AstrolabePeriodContextPointName;
      longitude: number;
    } =>
      ASTROLABE_PERIOD_CONTEXT_POINT_NAMES.includes(point.name as AstrolabePeriodContextPointName),
  );
  const cusps = natalCuspsOf(data) ?? [];
  if (cusps.length !== 12) {
    throw new Error('星盘缺少完整十二宫宫头，无法生成周期上下文。');
  }
  return {
    timezone: Number.isFinite(data.birth.timezone) ? data.birth.timezone : 0,
    ...(data.birth.timeZoneId ? { timeZoneId: data.birth.timeZoneId } : {}),
    points,
    houseCusps: cusps as AstrolabePeriodContext['houseCusps'],
  };
}

export function validateAstrolabePeriodContext(value: unknown): AstrolabePeriodContext {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('astrolabePeriodContext 必须是对象。');
  }
  const input = value as {
    timezone?: unknown;
    timeZoneId?: unknown;
    points?: unknown;
    houseCusps?: unknown;
  };
  if (typeof input.timezone !== 'number' || !Number.isFinite(input.timezone)) {
    throw new Error('astrolabePeriodContext.timezone 必须是有限数字。');
  }
  if (input.timezone < -14 || input.timezone > 14) {
    throw new Error('astrolabePeriodContext.timezone 超出有效范围。');
  }
  const timeZoneId = input.timeZoneId === undefined ? undefined : input.timeZoneId;
  if (timeZoneId !== undefined && (typeof timeZoneId !== 'string' || !timeZoneId.trim())) {
    throw new Error('astrolabePeriodContext.timeZoneId 必须是非空字符串。');
  }
  if (!Array.isArray(input.points) || input.points.length < 3) {
    throw new Error('astrolabePeriodContext.points 至少需要三个点位。');
  }
  const points: AstrolabePeriodContext['points'] = [];
  const names = new Set<string>();
  for (const item of input.points) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error('astrolabePeriodContext.points 含有无效点位。');
    }
    const point = item as { name?: unknown; longitude?: unknown };
    if (
      typeof point.name !== 'string' ||
      !ASTROLABE_PERIOD_CONTEXT_POINT_NAMES.includes(point.name as AstrolabePeriodContextPointName)
    ) {
      throw new Error('astrolabePeriodContext.points 含有不支持的点位名称。');
    }
    if (names.has(point.name)) {
      throw new Error(`astrolabePeriodContext.points 点位重复：${point.name}。`);
    }
    if (typeof point.longitude !== 'number' || !Number.isFinite(point.longitude)) {
      throw new Error(`astrolabePeriodContext.points.${point.name} 经度必须是有限数字。`);
    }
    names.add(point.name);
    points.push({
      name: point.name as AstrolabePeriodContextPointName,
      longitude: normalizeLongitude(point.longitude),
    });
  }
  if (!Array.isArray(input.houseCusps) || input.houseCusps.length !== 12) {
    throw new Error('astrolabePeriodContext.houseCusps 必须正好包含十二个宫头经度。');
  }
  if (!input.houseCusps.every((item) => typeof item === 'number' && Number.isFinite(item))) {
    throw new Error('astrolabePeriodContext.houseCusps 必须全部是有限数字。');
  }
  return {
    timezone: input.timezone,
    ...(typeof timeZoneId === 'string' ? { timeZoneId: timeZoneId.trim() } : {}),
    points,
    houseCusps: input.houseCusps.map((item) =>
      normalizeLongitude(item as number),
    ) as AstrolabePeriodContext['houseCusps'],
  };
}

function eventKey(kind: AstrolabePeriodEventKind, movingPoint: string, jd: number, extra = '') {
  return `${kind}:${movingPoint}:${extra}:${Math.round(jd * 1440)}`;
}

function solarEclipseName(type: SolarEclipseType) {
  if (type === 'total') return '日全食';
  if (type === 'annular') return '日环食';
  if (type === 'hybrid') return '日全环食';
  return '日偏食';
}

function lunarEclipseName(type: LunarEclipseType) {
  if (type === 'total') return '月全食';
  if (type === 'partial') return '月偏食';
  return '月半影食';
}

type SolarEclipseType = ReturnType<typeof findSolarEclipses>[number]['type'];
type LunarEclipseType = ReturnType<typeof findLunarEclipses>[number]['type'];

function lunationHitsNatal(
  lunationLongitude: number,
  natalPoints: Array<{ name: string; longitude: number }>,
): AstrolabeLunationNatalTouch[] {
  return natalPoints
    .filter((point) => LUNATION_NATAL_NAMES.has(point.name))
    .flatMap((point) =>
      LUNATION_ASPECTS.map((aspect) => ({
        point,
        aspect,
        deviation: Math.abs(wrap180(lunationLongitude - point.longitude - aspect.angle)),
      })),
    )
    .filter((item) => item.deviation <= LUNATION_ORB)
    .sort((first, second) => first.deviation - second.deviation)
    .slice(0, 2)
    .map((item) => ({
      pointName: item.point.name,
      pointLabel: labelOf(item.point.name),
      aspectName: item.aspect.name,
      aspectSymbol: item.aspect.symbol,
      exactAngle: item.aspect.angle,
      actualAngle: Math.abs(wrap180(lunationLongitude - item.point.longitude)),
      deviation: item.deviation,
      allowedOrb: LUNATION_ORB,
    }));
}

function formatLunationTouch(touch: AstrolabeLunationNatalTouch) {
  return `${touch.aspectSymbol}本命${touch.pointLabel}`;
}

function inWindow(jd: number, startJd: number, endJd: number) {
  return jd >= startJd && jd < endJd;
}

export function mergeAstrolabePeriodEvents(groups: AstrolabePeriodEvent[][]) {
  const seen = new Set<string>();
  return groups
    .flat()
    .filter((event) => {
      if (seen.has(event.key)) return false;
      seen.add(event.key);
      return true;
    })
    .sort(
      (first, second) =>
        first.julianDate - second.julianDate || first.key.localeCompare(second.key),
    );
}

const CORE_POINT_LABELS = new Set([
  '太阳',
  '月亮',
  '上升',
  '天顶',
  '本命太阳',
  '本命月亮',
  '本命上升',
  '本命天顶',
]);
const SLOW_POINT_LABELS = new Set(['木星', '土星', '天王星', '海王星', '冥王星', '北交点']);
const HARD_ASPECTS = new Set(['合相', '刑相', '冲相']);

function isCorePoint(value: string | undefined) {
  if (!value) return false;
  return (
    CORE_POINT_LABELS.has(value) || [...CORE_POINT_LABELS].some((item) => value.includes(item))
  );
}

function isSlowPoint(value: string | undefined) {
  return Boolean(value && SLOW_POINT_LABELS.has(value));
}

export function scoreAstrolabePeriodEvent(event: AstrolabePeriodEvent) {
  let score = 10;
  if (event.kind === '交食') score += 100;
  if (event.kind === '停逆' && isSlowPoint(event.movingPoint)) score += 80;
  if (event.kind === '行运相位') {
    score += isSlowPoint(event.movingPoint) ? 55 : 25;
    if (isCorePoint(event.targetPoint)) score += 25;
    if (event.aspectName && HARD_ASPECTS.has(event.aspectName)) score += 12;
  }
  if (event.kind === '换座' && isSlowPoint(event.movingPoint)) score += 45;
  if (
    event.kind === '换宫' &&
    isSlowPoint(event.movingPoint) &&
    (event.house === 1 || event.house === 10)
  ) {
    score += 35;
  }
  if (event.kind === '朔望') score += event.promptText.includes('本命') ? 50 : 15;
  if (
    event.kind === '天象相位' &&
    isSlowPoint(event.movingPoint) &&
    isSlowPoint(event.targetPoint)
  ) {
    score += 40;
  }
  return score;
}

function transitGroupKey(event: AstrolabePeriodEvent) {
  if (event.kind !== '行运相位' || !event.targetPoint || !event.aspectName) return null;
  return `${event.movingPoint}|${event.aspectName}|${event.targetPoint}`;
}

function formatDateRange(startDateTime: string, endDateTime: string) {
  const startDay = startDateTime.slice(0, 10);
  const endDay = endDateTime.slice(0, 10);
  return startDay === endDay ? startDay : `${startDateTime}至${endDateTime}`;
}

function buildTransitGroups(events: AstrolabePeriodEvent[]): AstrolabePeriodTransitGroup[] {
  const grouped = new Map<string, AstrolabePeriodEvent[]>();
  for (const event of events) {
    const key = transitGroupKey(event);
    if (!key) continue;
    const list = grouped.get(key) ?? [];
    list.push(event);
    grouped.set(key, list);
  }
  return [...grouped.entries()]
    .map(([key, list]) => {
      const sorted = [...list].sort((first, second) => first.julianDate - second.julianDate);
      const sample = sorted[0];
      const range = formatDateRange(sorted[0].dateTime, sorted.at(-1)!.dateTime);
      const countLabel = sorted.length >= 3 ? `${sorted.length}次过境` : `${sorted.length}次触发`;
      return {
        key,
        movingPoint: sample.movingPoint,
        targetPoint: sample.targetPoint ?? '',
        aspectName: sample.aspectName ?? '',
        events: sorted,
        promptText: `${sample.movingPoint}${sample.aspectName === '合相' ? '合' : sample.aspectName === '刑相' ? '刑' : sample.aspectName === '冲相' ? '冲' : sample.aspectName === '拱相' ? '拱' : sample.aspectName === '六合' ? '六合' : ''}${sample.targetPoint} ${countLabel}（${range}；具体时刻见完整明细）`,
      };
    })
    .filter((item) => item.events.length >= 2)
    .sort(
      (first, second) =>
        second.events.length - first.events.length || first.key.localeCompare(second.key),
    );
}

function windowGapDays(scope: AstrolabePeriodScopeMode) {
  if (scope === 'daily') return 0.25;
  if (scope === 'monthly') return 3;
  return 14;
}

function buildKeyWindows(
  events: AstrolabePeriodEvent[],
  scope: AstrolabePeriodScopeMode,
): AstrolabePeriodWindow[] {
  if (events.length === 0) return [];
  const gap = windowGapDays(scope);
  const clusters: AstrolabePeriodEvent[][] = [];
  let current: AstrolabePeriodEvent[] = [events[0]];
  for (let index = 1; index < events.length; index += 1) {
    const event = events[index];
    const previous = current[current.length - 1];
    if (event.julianDate - previous.julianDate <= gap) {
      current.push(event);
    } else {
      clusters.push(current);
      current = [event];
    }
  }
  clusters.push(current);
  return clusters
    .filter((cluster) => {
      const scores = cluster.map(scoreAstrolabePeriodEvent);
      return (
        scores.some((score) => score >= 70) ||
        (cluster.length >= 3 && scores.some((score) => score >= 50))
      );
    })
    .map((cluster) => {
      const startDateTime = cluster[0].dateTime;
      const endDateTime = cluster[cluster.length - 1].dateTime;
      return {
        startDateTime,
        endDateTime,
        eventKeys: cluster.map((item) => item.key),
        promptText: `${formatDateRange(startDateTime, endDateTime)}（共${cluster.length}项；具体星象见完整明细）`,
      };
    });
}

function buildAxis(
  events: AstrolabePeriodEvent[],
  groups: AstrolabePeriodTransitGroup[],
): AstrolabePeriodAxisItem[] {
  const groupedKeys = new Set(groups.flatMap((item) => item.events.map((event) => event.key)));
  const groupItems = groups.map((group) => ({
    key: group.key,
    promptText: group.promptText,
    score: Math.max(...group.events.map(scoreAstrolabePeriodEvent)) + group.events.length * 8,
    eventKeys: group.events.map((event) => event.key),
  }));
  const singles = events
    .filter((event) => !groupedKeys.has(event.key) && scoreAstrolabePeriodEvent(event) >= 70)
    .map((event) => ({
      key: event.key,
      promptText: `${event.dateTime} ${event.promptText}`,
      score: scoreAstrolabePeriodEvent(event),
      eventKeys: [event.key],
    }));
  return [...groupItems, ...singles]
    .sort((first, second) => second.score - first.score || first.key.localeCompare(second.key))
    .slice(0, 8)
    .map(({ key, promptText, eventKeys }) => ({ key, promptText, eventKeys }));
}

export function buildAstrolabePeriodEventLayers(
  events: AstrolabePeriodEvent[],
  startDateTime: string,
  endDateTime: string,
  scope: AstrolabePeriodScopeMode,
) {
  const groups = buildTransitGroups(events);
  const windows = buildKeyWindows(events, scope);
  const axis = buildAxis(events, groups);
  const groupKeys = new Set(groups.map((item) => item.key));
  const axisWithoutGroups = axis.filter((item) => !groupKeys.has(item.key));
  const lines = [
    events.length
      ? `周期关键星象（${startDateTime}至${endDateTime}，共${events.length}项）。`
      : `周期关键星象（${startDateTime}至${endDateTime}）：所选周期内未见当前筛选范围内的精准相位、停逆、换座、换宫、朔望或交食。`,
  ];
  if (axisWithoutGroups.length) {
    lines.push(`周期主轴：${axisWithoutGroups.map((item) => item.promptText).join('；')}。`);
  } else if (axis.length) {
    lines.push(`周期主轴：重复过境主线见过境归组，其他重点星象见完整明细。`);
  }
  if (windows.length)
    lines.push(`关键窗口：${windows.map((item) => item.promptText).join('；')}。`);
  if (groups.length) lines.push(`过境归组：${groups.map((item) => item.promptText).join('；')}。`);
  if (events.length) {
    lines.push(
      `完整明细：${events.map((item) => `${item.dateTime} ${item.promptText}`).join('；')}。`,
    );
  }
  return {
    groups,
    windows,
    axis,
    promptText: lines.join('\n'),
  };
}

export function mergeAstrolabePeriodCollections(
  collections: AstrolabePeriodEventCollection[],
  scope: AstrolabePeriodScopeMode = 'yearly',
): AstrolabePeriodEventCollection | undefined {
  const available = collections.filter(Boolean);
  if (available.length === 0) return undefined;
  const events = mergeAstrolabePeriodEvents(available.map((item) => item.events));
  const startDateTime = available.map((item) => item.startDateTime).sort()[0];
  const endDateTime = available
    .map((item) => item.endDateTime)
    .sort()
    .at(-1)!;
  const layers = buildAstrolabePeriodEventLayers(events, startDateTime, endDateTime, scope);
  return {
    startDateTime,
    endDateTime,
    timezoneLabel: available[0].timezoneLabel,
    events,
    ...layers,
  };
}

function formatCollectionPrompt(
  startDateTime: string,
  endDateTime: string,
  events: AstrolabePeriodEvent[],
  scope: AstrolabePeriodScopeMode,
) {
  return buildAstrolabePeriodEventLayers(events, startDateTime, endDateTime, scope);
}

function alignBatchSampleStart(scopeStartJd: number, batchStartJd: number, step: number) {
  const offset = Math.max(0, Math.floor((batchStartJd - scopeStartJd) / step + 1e-9) - 1);
  return scopeStartJd + offset * step;
}

function alignBatchSampleEnd(
  scopeStartJd: number,
  batchEndJd: number,
  scopeEndJd: number,
  step: number,
) {
  const offset = Math.max(0, Math.ceil((batchEndJd - scopeStartJd) / step - 1e-9));
  return Math.min(scopeStartJd + offset * step, scopeEndJd);
}

function buildAstrolabePeriodEventsInternal(
  source: AstrolabePeriodSource,
  scope: AstrolabePeriodScopeMode,
  target: { year: number; month: number; day: number },
  options: { batch?: AstrolabePeriodBatchInput } = {},
): AstrolabePeriodEventCollection {
  const window = resolveAstrolabePeriodWindow(source, scope, target, options.batch);
  const bodies = movingBodiesForScope(scope);
  const step = sampleStepDays(scope);
  const natalPoints = natalPointsOf(source);
  const cusps = natalCuspsOf(source);
  const positionCache = new Map<string, BodyPosition>();
  const cachedPositionOf = (name: MovingBodyName, jd: number) => {
    const key = `${name}:${jd}`;
    const cached = positionCache.get(key);
    if (cached) return cached;
    const position = positionOf(name, jd);
    positionCache.set(key, position);
    return position;
  };
  const cachedLongitudeOf = (name: MovingBodyName, jd: number) =>
    cachedPositionOf(name, jd).longitude;
  const sampleStartJd = options.batch
    ? alignBatchSampleStart(window.scopeStartJd, window.startJd, step)
    : window.startJd;
  const sampleEndJd = options.batch
    ? alignBatchSampleEnd(window.scopeStartJd, window.endJd, window.scopeEndJd, step)
    : window.endJd;
  const samples = new Map<MovingBodyName, Sample[]>();
  for (const body of bodies) {
    samples.set(body, sampleBody(body, sampleStartJd, sampleEndJd, step, cachedPositionOf));
  }

  const events: AstrolabePeriodEvent[] = [];
  const pushEvent = (event: Omit<AstrolabePeriodEvent, 'dateTime' | 'key'> & { key?: string }) => {
    if (!inWindow(event.julianDate, window.startJd, window.endJd)) return;
    const dateTime = formatEventDateTime(
      event.julianDate,
      getTimeZoneId(source),
      window.start.timezone,
    );
    events.push({
      ...event,
      key:
        event.key ??
        eventKey(
          event.kind,
          event.movingPoint,
          event.julianDate,
          event.targetPoint ?? event.aspectName ?? '',
        ),
      dateTime,
    });
  };

  for (const body of bodies) {
    const bodySamples = samples.get(body);
    if (!bodySamples) continue;
    const movingLabel = labelOf(body);

    for (const natal of natalPoints) {
      for (const aspect of MAJOR_ASPECTS) {
        for (const offset of aspectTargets(aspect.angle)) {
          const residualAt = (sample: Sample) =>
            wrap180(sample.longitude - natal.longitude - offset);
          const exactAt = (jd: number) =>
            wrap180(cachedLongitudeOf(body, jd) - natal.longitude - offset);
          for (const jd of crossingsFromSamples(bodySamples, residualAt, exactAt)) {
            pushEvent({
              kind: '行运相位',
              julianDate: jd,
              promptText: `${movingLabel}${aspect.symbol}本命${labelOf(natal.name)}`,
              movingPoint: movingLabel,
              targetPoint: `本命${labelOf(natal.name)}`,
              aspectName: aspect.name,
              key: eventKey('行运相位', body, jd, `${natal.name}:${aspect.name}:${offset}`),
            });
          }
        }
      }
    }

    if (body !== 'Sun' && body !== 'Moon' && body !== 'North Node') {
      const residualAt = (sample: Sample) => sample.speed;
      const exactAt = (jd: number) => cachedPositionOf(body, jd).speed;
      for (const jd of crossingsFromSamples(bodySamples, residualAt, exactAt)) {
        const speedAfter = cachedPositionOf(body, jd + MINUTE_IN_DAYS).speed;
        const direction: '逆行' | '顺行' = speedAfter < 0 ? '逆行' : '顺行';
        pushEvent({
          kind: '停逆',
          julianDate: jd,
          promptText: `${movingLabel}${direction}`,
          movingPoint: movingLabel,
          stationDirection: direction,
          key: eventKey('停逆', body, jd, direction),
        });
      }
    }

    for (let sign = 0; sign < 12; sign += 1) {
      const targetLongitude = sign * 30;
      const residualAt = (sample: Sample) => wrap180(sample.longitude - targetLongitude);
      const exactAt = (jd: number) => wrap180(cachedLongitudeOf(body, jd) - targetLongitude);
      for (const jd of crossingsFromSamples(bodySamples, residualAt, exactAt)) {
        const speed = cachedPositionOf(body, jd).speed;
        const entered = SIGN_LABELS[speed < 0 ? (sign + 11) % 12 : sign];
        const verb = speed < 0 ? '退入' : '进入';
        pushEvent({
          kind: '换座',
          julianDate: jd,
          promptText: `${movingLabel}${verb}${entered}`,
          movingPoint: movingLabel,
          signName: entered,
          key: eventKey('换座', body, jd, entered),
        });
      }
    }

    if (cusps) {
      for (let house = 1; house <= 12; house += 1) {
        const cusp = cusps[house - 1];
        const residualAt = (sample: Sample) => wrap180(sample.longitude - cusp);
        const exactAt = (jd: number) => wrap180(cachedLongitudeOf(body, jd) - cusp);
        for (const jd of crossingsFromSamples(bodySamples, residualAt, exactAt)) {
          const speed = cachedPositionOf(body, jd).speed;
          const arrivedHouse =
            speed < 0 ? houseForLongitude(cusps, normalizeLongitude(cusp - 0.01)) : house;
          const verb = speed < 0 ? '退入' : '进入';
          pushEvent({
            kind: '换宫',
            julianDate: jd,
            promptText: `${movingLabel}${verb}本命第${arrivedHouse}宫`,
            movingPoint: movingLabel,
            house: arrivedHouse,
            key: eventKey('换宫', body, jd, String(arrivedHouse)),
          });
        }
      }
    }
  }

  for (let firstIndex = 0; firstIndex < bodies.length; firstIndex += 1) {
    const first = bodies[firstIndex];
    const firstSamples = samples.get(first);
    if (!firstSamples) continue;
    for (let secondIndex = firstIndex + 1; secondIndex < bodies.length; secondIndex += 1) {
      const second = bodies[secondIndex];
      const secondSamples = samples.get(second);
      if (!secondSamples || secondSamples.length !== firstSamples.length) continue;
      if ((first === 'Sun' && second === 'Moon') || (first === 'Moon' && second === 'Sun')) {
        continue;
      }
      for (const aspect of MAJOR_ASPECTS) {
        for (const offset of aspectTargets(aspect.angle)) {
          const residualAt = (sample: Sample, index: number) =>
            wrap180(sample.longitude - secondSamples[index].longitude - offset);
          const exactAt = (jd: number) =>
            wrap180(cachedLongitudeOf(first, jd) - cachedLongitudeOf(second, jd) - offset);
          for (const jd of crossingsFromSamples(firstSamples, residualAt, exactAt)) {
            pushEvent({
              kind: '天象相位',
              julianDate: jd,
              promptText: `${labelOf(first)}${aspect.symbol}${labelOf(second)}`,
              movingPoint: labelOf(first),
              targetPoint: labelOf(second),
              aspectName: aspect.name,
              key: eventKey('天象相位', first, jd, `${second}:${aspect.name}:${offset}`),
            });
          }
        }
      }
    }
  }

  const eclipsePaddingDays = options.batch ? 0.75 : 0;
  const eclipseStartJd = window.startJd - eclipsePaddingDays;
  const eclipseEndJd = window.endJd + eclipsePaddingDays;
  const eclipseTimes: number[] = [];
  for (const eclipse of findSolarEclipses(eclipseStartJd, eclipseEndJd)) {
    const name = solarEclipseName(eclipse.type);
    eclipseTimes.push(eclipse.julianDate);
    pushEvent({
      kind: '交食',
      julianDate: eclipse.julianDate,
      promptText: name,
      movingPoint: '太阳',
      targetPoint: '月亮',
      eclipseName: name,
      key: eventKey('交食', 'Sun', eclipse.julianDate, eclipse.type),
    });
  }
  for (const eclipse of findLunarEclipses(eclipseStartJd, eclipseEndJd)) {
    const name = lunarEclipseName(eclipse.type);
    eclipseTimes.push(eclipse.julianDate);
    pushEvent({
      kind: '交食',
      julianDate: eclipse.julianDate,
      promptText: name,
      movingPoint: '月亮',
      targetPoint: '太阳',
      eclipseName: name,
      key: eventKey('交食', 'Moon', eclipse.julianDate, eclipse.type),
    });
  }

  const includeQuarters = scope !== 'yearly';
  const lunationAngles = includeQuarters
    ? [
        { name: '朔' as const, angle: 0 },
        { name: '上弦' as const, angle: 90 },
        { name: '望' as const, angle: 180 },
        { name: '下弦' as const, angle: 270 },
      ]
    : [
        { name: '朔' as const, angle: 0 },
        { name: '望' as const, angle: 180 },
      ];
  const moonStep = 0.25;
  const moonSampleStartJd = options.batch
    ? alignBatchSampleStart(window.scopeStartJd, window.startJd, moonStep)
    : window.startJd;
  const moonSampleEndJd = options.batch
    ? alignBatchSampleEnd(window.scopeStartJd, window.endJd, window.scopeEndJd, moonStep)
    : window.endJd;
  const moonSamples =
    samples.get('Moon') ??
    sampleBody('Moon', moonSampleStartJd, moonSampleEndJd, moonStep, cachedPositionOf);
  for (const lunation of lunationAngles) {
    const residualAt = (sample: Sample) =>
      wrap180(sample.longitude - cachedLongitudeOf('Sun', sample.jd) - lunation.angle);
    const exactAt = (jd: number) =>
      wrap180(cachedLongitudeOf('Moon', jd) - cachedLongitudeOf('Sun', jd) - lunation.angle);
    for (const jd of crossingsFromSamples(moonSamples, residualAt, exactAt)) {
      if (eclipseTimes.some((item) => Math.abs(item - jd) < 0.75)) continue;
      const moonLongitude = cachedLongitudeOf('Moon', jd);
      const touches = lunationHitsNatal(moonLongitude, natalPoints);
      const suffix = touches.length ? touches.map(formatLunationTouch).join('，') : '';
      pushEvent({
        kind: '朔望',
        julianDate: jd,
        promptText: suffix ? `${lunation.name}${suffix}` : lunation.name,
        movingPoint: '月亮',
        targetPoint: '太阳',
        lunationName: lunation.name,
        lunationTouches: touches,
        key: eventKey('朔望', 'Moon', jd, lunation.name),
      });
    }
  }

  const unique = mergeAstrolabePeriodEvents([events]);
  const layers = formatCollectionPrompt(window.startDateTime, window.endDateTime, unique, scope);
  return {
    startDateTime: window.startDateTime,
    endDateTime: window.endDateTime,
    timezoneLabel: window.timezoneLabel,
    events: unique,
    ...layers,
    ...(window.batch ? { batch: window.batch } : {}),
  };
}

export function buildAstrolabePeriodEvents(
  data: AstrolabeData,
  scope: AstrolabePeriodScopeMode,
  target: { year: number; month: number; day: number },
  options: { batch?: AstrolabePeriodBatchInput } = {},
) {
  return buildAstrolabePeriodEventsInternal(data, scope, target, options);
}

export function buildAstrolabePeriodEventsFromContext(
  context: AstrolabePeriodContext,
  scope: AstrolabePeriodScopeMode,
  target: { year: number; month: number; day: number },
  options: { batch: AstrolabePeriodBatchInput },
) {
  return buildAstrolabePeriodEventsInternal(context, scope, target, options);
}

export function buildAstrolabePeriodBatchResult(
  context: AstrolabePeriodContext,
  scope: AstrolabePeriodScopeMode,
  target: { year: number; month: number; day: number },
  targetText: string,
  batch: AstrolabePeriodBatchInput,
): AstrolabePeriodBatchResult {
  const collection = buildAstrolabePeriodEventsFromContext(context, scope, target, { batch });
  if (!collection.batch) {
    throw new Error('星盘周期批次未生成范围身份。');
  }
  const window = resolveAstrolabePeriodWindow(context, scope, target, batch);
  return {
    kind: 'astrolabe-period-batch',
    scope,
    target: targetText,
    parentRange: {
      startDate: collection.batch.scopeStartDate,
      endDate: collection.batch.scopeEndDate,
      endExclusive: true,
    },
    range: collection.batch.range,
    nextRange: collection.batch.nextRange,
    timezone: window.scopeStart.timezone,
    ...(context.timeZoneId ? { timeZoneId: context.timeZoneId } : {}),
    sampleStepDays: sampleStepDays(scope),
    events: collection.events,
  };
}
