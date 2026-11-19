import { Astronomy } from './engine';
import { createTimezoneOffsetReader, formatCivilDateTime, getCivilDateTimeAtFixedOffset, resolveCivilDayWindow } from '../huangji/civil-time';
type Input = { timestamp: number; year: number; month: number; day: number; latitude: number; longitude: number; timezone: number; timeZoneId?: string };
type Direction = '上行' | '下行';

/** 本地民用日的太阳高度阈值交点；支持极昼极夜及重历日期的多组交点。 */
function prepareDay(input: Input) {
  const zone = input.timeZoneId ? { timeZoneId: input.timeZoneId } : { timezone: input.timezone };
  const window = resolveCivilDayWindow({ year: input.year, month: input.month, day: input.day, ...zone });
  if (input.timestamp < window.startUtcMs || input.timestamp >= window.endUtcMs) throw new Error('出生时刻不在指定当地民用日内。');
  const observer = new Astronomy.Observer(input.latitude, input.longitude, 0), offsetAt = input.timeZoneId ? createTimezoneOffsetReader(input.timeZoneId) : () => input.timezone;
  const toLocal = (timestamp: number) => { const timezone = offsetAt(timestamp); return { timezone, localDateTime: formatCivilDateTime(getCivilDateTimeAtFixedOffset(new Date(timestamp), timezone)) }; };
  const horizontal = (timestamp: number) => {
    const date = new Date(timestamp), equator = Astronomy.Equator(Astronomy.Body.Sun, date, observer, true, true);
    const horizon = Astronomy.Horizon(date, observer, equator.ra, equator.dec, '');
    return { altitude: horizon.altitude, azimuth: horizon.azimuth, declination: equator.dec, distance: equator.dist };
  };
  const crossingsFor = (name: string, threshold: number) => {
    const crossings: Array<{ direction: Direction; utcTimestamp: number; localDateTime: string; timezone: number }> = [];
    for (const [direction, label] of [[1, '上行'], [-1, '下行']] as const) {
      let current = window.startUtcMs;
      while (current < window.endUtcMs) {
        const days = (window.endUtcMs - current) / 86_400_000 + 1;
        const found = threshold === -0.833 ? Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, direction, new Date(current), days)
          : Astronomy.SearchAltitude(Astronomy.Body.Sun, observer, direction, new Date(current), days, threshold);
        if (!found) break;
        const utcTimestamp = found.date.getTime();
        if (utcTimestamp >= window.endUtcMs) break;
        if (utcTimestamp < current) throw new Error('太阳高度交点未按时间递增。');
        crossings.push({ direction: label, utcTimestamp, ...toLocal(utcTimestamp) });
        current = utcTimestamp + 1000;
        if (crossings.length > 16) throw new Error('太阳高度交点数量异常。');
      }
    }
    crossings.sort((a, b) => a.utcTimestamp - b.utcTimestamp);
    let status: '正常交点' | '全天高于阈值' | '全天低于阈值' = '正常交点';
    if (!crossings.length) {
      const midpoint = horizontal((window.startUtcMs + window.endUtcMs) / 2);
      const comparison = threshold === -0.833 ? midpoint.altitude + Math.asin(695_700 / Astronomy.KM_PER_AU / midpoint.distance) * 180 / Math.PI : midpoint.altitude;
      status = comparison < (threshold === -0.833 ? -34 / 60 : threshold) ? '全天低于阈值' : '全天高于阈值';
    }
    return { name, threshold, status, crossings };
  };
  const sunriseSunset = crossingsFor('日出日落', -0.833), civilTwilight = crossingsFor('民用曙暮光', -6), nauticalTwilight = crossingsFor('航海曙暮光', -12), astronomicalTwilight = crossingsFor('天文曙暮光', -18);
  return { facts: { window, sunriseSunset, civilTwilight, nauticalTwilight, astronomicalTwilight }, horizontal };
}

function validate(input: Input) {
  if (!Number.isFinite(input.timestamp) || !Number.isFinite(input.latitude) || Math.abs(input.latitude) > 90 || !Number.isFinite(input.longitude) || Math.abs(input.longitude) > 180) throw new Error('太阳光照需要有效时刻及经纬度。');
}

function atTime(input: Input, day: ReturnType<typeof prepareDay>, copy: boolean) {
  const { window, sunriseSunset } = day.facts;
  if (input.timestamp < window.startUtcMs || input.timestamp >= window.endUtcMs) throw new Error('出生时刻不在指定当地民用日内。');
  const events = sunriseSunset.crossings;
  let daylight: boolean;
  if (sunriseSunset.status !== '正常交点') daylight = sunriseSunset.status === '全天高于阈值';
  else {
    const last = events.filter((event) => event.utcTimestamp <= input.timestamp).at(-1);
    daylight = (last?.direction ?? (events[0].direction === '上行' ? '下行' : '上行')) === '上行';
  }
  const sun = day.horizontal(input.timestamp);
  return { ...(copy ? structuredClone(day.facts) : day.facts), daylight,
    sun: { geometricAltitudeDegrees: sun.altitude, azimuthDegrees: sun.azimuth, declinationDegrees: sun.declination },
    limitation: '日出日落按太阳上缘及标准近地平折射（太阳中心名义高度约 -0.833°）；其余交点按无折射太阳中心高度。结果不计天气、地形和遮挡。' };
}

export function solarIllumination(input: Input) {
  validate(input);
  return atTime(input, prepareDay(input), false);
}

/** 每个范围请求单独创建；只复用同地点、同民用日的交点，不共享可变结果。 */
export function createSolarIlluminationCalculator() {
  const days = new Map<string, ReturnType<typeof prepareDay>>();
  return (input: Input) => {
    validate(input);
    const key = JSON.stringify([input.year, input.month, input.day, input.latitude, input.longitude, input.timeZoneId ?? null, input.timeZoneId ? null : input.timezone]);
    let day = days.get(key);
    if (!day) { day = prepareDay(input); days.set(key, day); }
    return atTime(input, day, true);
  };
}
