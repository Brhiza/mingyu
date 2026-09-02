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
  eclipseName?: string;
}

export interface AstrolabePeriodEventCollection {
  startDateTime: string;
  endDateTime: string;
  timezoneLabel: string;
  events: AstrolabePeriodEvent[];
  promptText: string;
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
] as const;

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

function longitudeOf(name: MovingBodyName, jd: number) {
  return normalizeLongitude(getApparentPosition(bodyIdOf(name), jd).longitude);
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

function getTimeZoneInput(data: AstrolabeData): CivilTimeZoneInput {
  if (data.birth.timeZoneId) return { timeZoneId: data.birth.timeZoneId };
  if (!Number.isFinite(data.birth.timezone)) {
    throw new Error('星盘缺少有效时区，无法计算周期星象。');
  }
  return { timezone: data.birth.timezone };
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

function resolveLocalInstant(
  data: AstrolabeData,
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
    ...getTimeZoneInput(data),
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
  data: AstrolabeData,
  scope: AstrolabePeriodScopeMode,
  target: { year: number; month: number; day: number },
) {
  const startDate =
    scope === 'yearly'
      ? { year: target.year, month: 1, day: 1 }
      : scope === 'monthly'
        ? { year: target.year, month: target.month, day: 1 }
        : { year: target.year, month: target.month, day: target.day };
  const endDate =
    scope === 'yearly'
      ? { year: target.year + 1, month: 1, day: 1 }
      : scope === 'monthly'
        ? addCalendarMonths(target.year, target.month, 1)
        : nextDate(target.year, target.month, target.day);
  const start = resolveLocalInstant(data, startDate);
  const end = resolveLocalInstant(data, endDate);
  const timezoneLabel = data.birth.timeZoneId
    ? `${data.birth.timeZoneId}（UTC${start.timezone >= 0 ? '+' : ''}${start.timezone}）`
    : `UTC${start.timezone >= 0 ? '+' : ''}${start.timezone}`;
  return {
    start,
    end,
    startJd: unixToJulianDate(start.utcTimestamp),
    endJd: unixToJulianDate(end.utcTimestamp),
    timezoneLabel,
    startDateTime: formatCivilStamp(start.localTime),
    endDateTime: formatCivilStamp(end.localTime),
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

function sampleBody(name: MovingBodyName, startJd: number, endJd: number, step: number) {
  const samples: Sample[] = [];
  const last = endJd + step * 0.5;
  for (let jd = startJd; jd <= last; jd += step) {
    const clamped = Math.min(jd, endJd);
    const position = positionOf(name, clamped);
    samples.push({ jd: clamped, longitude: position.longitude, speed: position.speed });
    if (clamped === endJd) break;
  }
  if (samples.length === 0 || samples[samples.length - 1].jd < endJd) {
    const position = positionOf(name, endJd);
    samples.push({ jd: endJd, longitude: position.longitude, speed: position.speed });
  }
  return samples;
}

function isFiniteLongitude(point: Partial<AstrolabePoint>) {
  return typeof point.longitude === 'number' && Number.isFinite(point.longitude);
}

function natalPointsOf(data: AstrolabeData) {
  const byName = new Map<string, number>();
  for (const point of [...data.planets, ...data.angles]) {
    if (!NATAL_POINT_NAMES.includes(point.name as (typeof NATAL_POINT_NAMES)[number])) continue;
    if (!isFiniteLongitude(point)) continue;
    byName.set(point.name, normalizeLongitude(point.longitude));
  }
  return [...byName.entries()].map(([name, longitude]) => ({ name, longitude }));
}

function natalCuspsOf(data: AstrolabeData) {
  const cusps = data.houses
    .slice()
    .sort((first, second) => first.house - second.house)
    .map((item) => item.longitude);
  return cusps.length === 12 && cusps.every((item) => Number.isFinite(item))
    ? cusps.map(normalizeLongitude)
    : null;
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
) {
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
    .map((item) => `${item.aspect.symbol}本命${labelOf(item.point.name)}`);
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

function formatCollectionPrompt(
  startDateTime: string,
  endDateTime: string,
  events: AstrolabePeriodEvent[],
) {
  if (events.length === 0) {
    return `周期关键星象（${startDateTime}至${endDateTime}）：所选周期内未见当前筛选范围内的精准相位、停逆、换座、换宫、朔望或交食。`;
  }
  return `周期关键星象（${startDateTime}至${endDateTime}，共${events.length}项）：${events
    .map((item) => `${item.dateTime} ${item.promptText}`)
    .join('；')}。`;
}

export function buildAstrolabePeriodEvents(
  data: AstrolabeData,
  scope: AstrolabePeriodScopeMode,
  target: { year: number; month: number; day: number },
): AstrolabePeriodEventCollection {
  const window = resolveAstrolabePeriodWindow(data, scope, target);
  const bodies = movingBodiesForScope(scope);
  const step = sampleStepDays(scope);
  const natalPoints = natalPointsOf(data);
  const cusps = natalCuspsOf(data);
  const samples = new Map<MovingBodyName, Sample[]>();
  for (const body of bodies) {
    samples.set(body, sampleBody(body, window.startJd, window.endJd, step));
  }

  const events: AstrolabePeriodEvent[] = [];
  const pushEvent = (event: Omit<AstrolabePeriodEvent, 'dateTime' | 'key'> & { key?: string }) => {
    if (!inWindow(event.julianDate, window.startJd, window.endJd)) return;
    const dateTime = formatEventDateTime(
      event.julianDate,
      data.birth.timeZoneId,
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
          const exactAt = (jd: number) => wrap180(longitudeOf(body, jd) - natal.longitude - offset);
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
      const exactAt = (jd: number) => positionOf(body, jd).speed;
      for (const jd of crossingsFromSamples(bodySamples, residualAt, exactAt)) {
        const speedAfter = positionOf(body, jd + MINUTE_IN_DAYS).speed;
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
      const exactAt = (jd: number) => wrap180(longitudeOf(body, jd) - targetLongitude);
      for (const jd of crossingsFromSamples(bodySamples, residualAt, exactAt)) {
        const speed = positionOf(body, jd).speed;
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
        const exactAt = (jd: number) => wrap180(longitudeOf(body, jd) - cusp);
        for (const jd of crossingsFromSamples(bodySamples, residualAt, exactAt)) {
          const speed = positionOf(body, jd).speed;
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
            wrap180(longitudeOf(first, jd) - longitudeOf(second, jd) - offset);
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

  const eclipseTimes: number[] = [];
  for (const eclipse of findSolarEclipses(window.startJd, window.endJd)) {
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
  for (const eclipse of findLunarEclipses(window.startJd, window.endJd)) {
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
  const moonSamples = samples.get('Moon') ?? sampleBody('Moon', window.startJd, window.endJd, 0.25);
  for (const lunation of lunationAngles) {
    const residualAt = (sample: Sample) =>
      wrap180(sample.longitude - longitudeOf('Sun', sample.jd) - lunation.angle);
    const exactAt = (jd: number) =>
      wrap180(longitudeOf('Moon', jd) - longitudeOf('Sun', jd) - lunation.angle);
    for (const jd of crossingsFromSamples(moonSamples, residualAt, exactAt)) {
      if (eclipseTimes.some((item) => Math.abs(item - jd) < 0.75)) continue;
      const moonLongitude = longitudeOf('Moon', jd);
      const touches = lunationHitsNatal(moonLongitude, natalPoints);
      const suffix = touches.length ? touches.join('，') : '';
      pushEvent({
        kind: '朔望',
        julianDate: jd,
        promptText: suffix ? `${lunation.name}${suffix}` : lunation.name,
        movingPoint: '月亮',
        targetPoint: '太阳',
        lunationName: lunation.name,
        key: eventKey('朔望', 'Moon', jd, lunation.name),
      });
    }
  }

  const unique = mergeAstrolabePeriodEvents([events]);
  return {
    startDateTime: window.startDateTime,
    endDateTime: window.endDateTime,
    timezoneLabel: window.timezoneLabel,
    events: unique,
    promptText: formatCollectionPrompt(window.startDateTime, window.endDateTime, unique),
  };
}
