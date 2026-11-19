import { SolarDay } from 'tyme4ts';
import { getSixtyCycleIndex, getSixtyCycleName } from '../ganzhi-foundation';
import type { CivilDateTimeParts } from '../huangji/civil-time';

const anchor = SolarDay.fromYmd(2000, 1, 7); // 甲子日

/** 民用或真太阳时钟表下的日、时干支；23 时按本项目口径换日。 */
export function civilDayHour(wall: Pick<CivilDateTimeParts, 'year' | 'month' | 'day' | 'hour'>) {
  const index = SolarDay.fromYmd(wall.year, wall.month, wall.day).subtract(anchor) + (wall.hour === 23 ? 1 : 0);
  const day = getSixtyCycleName(index);
  const dayStemIndex = getSixtyCycleIndex(day) % 10;
  const branch = Math.floor((wall.hour + 1) / 2) % 12;
  const hour = getSixtyCycleName(dayStemIndex * 12 + branch);
  return { day, hour };
}
