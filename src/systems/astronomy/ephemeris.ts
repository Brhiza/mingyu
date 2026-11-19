import { Astronomy } from './engine';

export const DAY_MS = 86_400_000;
export const UNIX_EPOCH_JD = 2_440_587.5;
export const J2000_JD = 2_451_545;

/** 将角度归一化到 [0, 360) 区间。 */
export function normalizeDegrees(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

/** 计算两个黄经角的最小有符号差值，结果落在 [-180, 180) 区间。 */
export function signedDegreesDifference(value: number, target: number): number {
  return ((value - target + 540) % 360) - 180;
}

export function timestampToJulianDay(utcTimestamp: number): number {
  return utcTimestamp / DAY_MS + UNIX_EPOCH_JD;
}

export function julianDayToTimestamp(julianDay: number): number {
  return (julianDay - UNIX_EPOCH_JD) * DAY_MS;
}

/** 通过主天文星历（Astronomy Engine）获取指定天体或日月地心视黄经。 */
export function sunEclipticLongitudeAt(utcTimestamp: number): number {
  const time = Astronomy.MakeTime(new Date(utcTimestamp));
  return normalizeDegrees(Astronomy.Ecliptic(Astronomy.GeoVector(Astronomy.Body.Sun, time, true)).elon);
}

export function moonEclipticLongitudeAt(utcTimestamp: number): number {
  const time = Astronomy.MakeTime(new Date(utcTimestamp));
  return normalizeDegrees(Astronomy.EclipticGeoMoon(time).lon);
}

/** Meeus/NOAA 太阳视黄经低阶公式；用于节气独立核验与交叉巡检，不取代主星历。 */
export function apparentSunLongitudeMeeus(utcTimestamp: number): number {
  const julianDay = timestampToJulianDay(utcTimestamp);
  const t = (julianDay - J2000_JD) / 36525;
  const geometricMeanLongitude = normalizeDegrees(
    280.46646 + 36000.76983 * t + 0.0003032 * t ** 2,
  );
  const meanAnomaly = normalizeDegrees(
    357.52911 + 35999.05029 * t - 0.0001537 * t ** 2 + t ** 3 / 24490000,
  );
  const anomalyRadians = (meanAnomaly * Math.PI) / 180;
  const equationOfCenter =
    (1.914602 - 0.004817 * t - 0.000014 * t ** 2) * Math.sin(anomalyRadians) +
    (0.019993 - 0.000101 * t) * Math.sin(2 * anomalyRadians) +
    0.000289 * Math.sin(3 * anomalyRadians);
  const trueLongitude = geometricMeanLongitude + equationOfCenter;
  const omega = ((125.04 - 1934.136 * t) * Math.PI) / 180;
  return normalizeDegrees(trueLongitude - 0.00569 - 0.00478 * Math.sin(omega));
}
