import { SolarDay, SolarTerm, SolarTime } from 'tyme4ts';
import { getSolarDayNineStar } from '../almanac/rules';
import { getBranchIndex, getMonthNineStar, getYearNineStar, getYearSixtyCycle } from '../ganzhi-foundation';
import { resolveCivilTime } from '../huangji/civil-time';
import { flyStars } from './foundation';

const jieNames = ['小寒', '立春', '惊蛰', '清明', '立夏', '芒种', '小暑', '立秋', '白露', '寒露', '立冬', '大雪'] as const;
const starNames = ['一白', '二黑', '三碧', '四绿', '五黄', '六白', '七赤', '八白', '九紫'];

function annual(year: number) {
  const centerStar = getYearNineStar(year);
  return { year, centerStar, starName: starNames[centerStar - 1], plate: flyStars(centerStar, '顺飞') };
}

/** 流年按立春节气年取星，不把公历年初自动当作新流年。 */
export function yearFlyingStar(year: number) {
  if (!Number.isInteger(year) || year < 1900 || year > 2100) throw new Error('流年须在 1900 至 2100 之间。');
  return { ...annual(year), rule: '以所指定立春节气年取年紫白，顺飞九宫。' };
}

/** 日期精度的流月以北京时间正午所属节气年及节气月为准。 */
export function monthFlyingStar(year: number, month: number, day: number) {
  if (!Number.isInteger(year) || year < 1900 || year > 2100) throw new Error('流月年份须在 1900 至 2100 之间。');
  resolveCivilTime({ year, month, day, hour: 12, minute: 0, second: 0, timezone: 8 });
  const date = SolarDay.fromYmd(year, month, day), jie = SolarTerm.fromName(year, jieNames[month - 1]);
  const noon = SolarTime.fromYmdHms(year, month, day, 12, 0, 0), jieTime = jie.getJulianDay().getSolarTime();
  const onJieDay = date.subtract(jie.getSolarDay()) === 0;
  const effective = onJieDay && noon.isBefore(jieTime) ? date.next(-1) : date;
  const cycleMonth = effective.getSixtyCycleDay().getSixtyCycleMonth();
  const solarTermYear = cycleMonth.getSixtyCycleYear().getYear();
  const yearBranch = getYearSixtyCycle(solarTermYear)[1];
  const monthBranch = cycleMonth.getSixtyCycle().getEarthBranch().getName();
  const centerStar = getMonthNineStar(yearBranch, monthBranch);
  return { date: { year, month, day }, solarTermYear, monthBranch,
    centerStar, starName: starNames[centerStar - 1], plate: flyStars(centerStar, '顺飞'), yearPlate: annual(solarTermYear),
    rule: `按北京时间正午所属节气月取月紫白${onJieDay ? `；该日${jie.getName()}交节，前后可能属不同节气月` : ''}。` };
}

/** 冬至至夏至前（含跨公历年冬至后）为阳遁顺飞，夏至至冬至前为阴遁逆飞。 */
function isYangDunSolarDay(solarDay: SolarDay): boolean {
  const year = solarDay.getYear();
  const prevDongZhi = SolarTerm.fromIndex(year, 0).getSolarDay();
  const xiaZhi = SolarTerm.fromIndex(year, 12).getSolarDay();
  const nextDongZhi = SolarTerm.fromIndex(year + 1, 0).getSolarDay();
  return !solarDay.isBefore(nextDongZhi) || (!solarDay.isBefore(prevDongZhi) && solarDay.isBefore(xiaZhi));
}

/** 流日紫白九星（冬至后阳遁顺飞，夏至后阴遁逆飞）。 */
export function dayFlyingStar(year: number, month: number, day: number) {
  if (!Number.isInteger(year) || year < 1900 || year > 2100) throw new Error('流日年份须在 1900 至 2100 之间。');
  resolveCivilTime({ year, month, day, hour: 12, minute: 0, second: 0, timezone: 8 });
  const solarDay = SolarDay.fromYmd(year, month, day);
  const isYangDun = isYangDunSolarDay(solarDay);
  const nine = getSolarDayNineStar(solarDay);
  const centerStar = ['一', '二', '三', '四', '五', '六', '七', '八', '九'].indexOf(nine.name) + 1;
  const direction = isYangDun ? '顺飞' as const : '逆飞' as const;
  return {
    date: { year, month, day },
    centerStar,
    starName: starNames[centerStar - 1],
    direction,
    plate: flyStars(centerStar, direction),
    rule: `按${isYangDun ? '冬至后阳遁顺飞' : '夏至后阴遁逆飞'}起流日紫白。`,
  };
}

/** 流时紫白九星（冬至后甲己仲日一白起子顺飞、夏至后九紫起子逆飞）。 */
export function hourFlyingStar(year: number, month: number, day: number, hour: number) {
  if (!Number.isInteger(year) || year < 1900 || year > 2100) throw new Error('流时年份须在 1900 至 2100 之间。');
  resolveCivilTime({ year, month, day, hour, minute: 0, second: 0, timezone: 8 });
  const solarTime = SolarTime.fromYmdHms(year, month, day, hour, 0, 0);
  const solarDay = solarTime.getSolarDay();
  const isYangDun = isYangDunSolarDay(solarDay);
  const dayBranch = solarTime.getSixtyCycleHour().getDay().getEarthBranch().getName();
  const hourBranchIndex = Math.floor((hour + 1) / 2) % 12;
  const baseIdx = [8, 5, 2][getBranchIndex(dayBranch) % 3];
  const rawIndex = isYangDun ? 8 + hourBranchIndex - baseIdx : baseIdx - hourBranchIndex;
  const centerStar = (((rawIndex % 9) + 9) % 9) + 1;
  const direction = isYangDun ? '顺飞' as const : '逆飞' as const;
  return {
    date: { year, month, day, hour },
    dayBranch,
    centerStar,
    starName: starNames[centerStar - 1],
    direction,
    plate: flyStars(centerStar, direction),
    rule: `按${isYangDun ? '冬至后阳遁顺飞' : '夏至后阴遁逆飞'}与日支仲孟季起流时紫白。`,
  };
}
