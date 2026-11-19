import { Astronomy } from './engine';

/** 真实 UTC 瞬时及经度换算为北京时间口径的真太阳时钟表。 */
export function trueSolarTime(date: Date, longitude: number) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) throw new Error('起局时间无效。');
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new Error('经度必须在 -180 至 180 度之间。');
  const geocentric = Astronomy.GeoVector(Astronomy.Body.Sun, date, true);
  const equator = Astronomy.EquatorFromVector(Astronomy.RotateVector(Astronomy.Rotation_EQJ_EQD(date), geocentric));
  const utcMinutes = (date.getTime() / 60_000) % 1440;
  const difference = (Astronomy.SiderealTime(date) - equator.ra) * 60 + 720 - utcMinutes;
  const equationOfTimeMinutes = ((((difference + 720) % 1440) + 1440) % 1440) - 720;
  const longitudeCorrectionMinutes = (longitude - 120) * 4;
  const totalCorrectionMinutes = equationOfTimeMinutes + longitudeCorrectionMinutes;
  const effectiveTimestamp = Math.floor((date.getTime() + totalCorrectionMinutes * 60_000) / 1000) * 1000;
  return { longitude, longitudeCorrectionMinutes, equationOfTimeMinutes, totalCorrectionMinutes, effectiveTimestamp };
}
