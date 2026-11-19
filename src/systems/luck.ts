import { SolarTime } from 'tyme4ts';
import { getSolarYmdHmsPillars } from './calendar';
import { getSixtyCycleIndex, stepSixtyCycle } from './ganzhi-foundation';
import { createUtcTimestamp, getCivilDateTimeAtFixedOffset, type CivilDateTimeParts } from './huangji/civil-time';

export function chinaParts(timestamp: number) { return getCivilDateTimeAtFixedOffset(new Date(timestamp), 8); }
export function chinaTimestamp(value: CivilDateTimeParts) { return createUtcTimestamp(value.year, value.month - 1, value.day, value.hour - 8, value.minute, value.second); }

function daysInSolarMonth(year: number, month: number) {
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return month === 2 ? (leap ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function shiftCivilYears(value: CivilDateTimeParts, years: number) {
  const year = value.year + years;
  if (!Number.isInteger(years) || year < 1 || year > 9999) throw new RangeError('大运日期超出支持的公历年份。');
  return { ...value, year, day: Math.min(value.day, daysInSolarMonth(year, value.month)) };
}

function fromSolar(value: ReturnType<typeof SolarTime.fromYmdHms>): CivilDateTimeParts {
  return { year: value.getYear(), month: value.getMonth(), day: value.getDay(), hour: value.getHour(), minute: value.getMinute(), second: value.getSecond() };
}

/** 按三天折一年、一天折四个月、一时辰折十天、一小时折五天、十二分钟折一天的传统起运算法推算交运时刻。 */
function addChildLimitDuration(
  birth: CivilDateTimeParts,
  addYear: number,
  addMonth: number,
  addDay: number,
  addHour: number,
  addMinute: number,
): CivilDateTimeParts {
  let minute = birth.minute + addMinute;
  let hour = birth.hour + addHour + Math.floor(minute / 60);
  minute %= 60;
  let day = birth.day + addDay + Math.floor(hour / 24);
  hour %= 24;
  const totalMonths = (birth.year + addYear) * 12 + (birth.month - 1) + addMonth;
  let year = Math.floor(totalMonths / 12);
  let month = (totalMonths % 12) + 1;
  let monthDays = daysInSolarMonth(year, month);
  while (day > monthDays) {
    day -= monthDays;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    monthDays = daysInSolarMonth(year, month);
  }
  return { year, month, day, hour, minute, second: birth.second };
}

/** 以真实出生瞬时的东八区历表，按三日折一年确定起运和十二步大运。 */
export function calculateDecadalTimeline(
  birthTimestamp: number,
  gender: 'male' | 'female',
  overrides?: { yearStem?: string; monthPillar?: string },
) {
  if (!Number.isSafeInteger(birthTimestamp) || birthTimestamp % 1000 !== 0 || !Number.isFinite(new Date(birthTimestamp).getTime())) throw new Error('十年大运须提供整秒的有效出生瞬时。');
  if (gender !== 'male' && gender !== 'female') throw new Error('十年干支大运需要提供性别，以确定顺逆行。');
  const birth = chinaParts(birthTimestamp);
  const solar = SolarTime.fromYmdHms(birth.year, birth.month, birth.day, birth.hour, birth.minute, birth.second);
  const pillars = getSolarYmdHmsPillars(birth.year, birth.month, birth.day, birth.hour, birth.minute, birth.second);
  const yearStem = overrides?.yearStem ?? pillars.year[0];
  const monthPillar = overrides?.monthPillar ?? pillars.month;
  getSixtyCycleIndex(monthPillar);
  const yang = ['甲', '丙', '戊', '庚', '壬'].includes(yearStem);
  const forward = gender === 'male' ? yang : !yang;
  let term = solar.getTerm();
  if (!term.isJie()) term = term.next(-1);
  if (forward) term = term.next(2);
  const termTime = fromSolar(term.getJulianDay().getSolarTime());
  const termTs = chinaTimestamp(termTime);
  let seconds = Math.abs(termTs - birthTimestamp) / 1000;
  const years = Math.trunc(seconds / 259_200);
  seconds %= 259_200;
  const months = Math.trunc(seconds / 21_600);
  seconds %= 21_600;
  const days = Math.trunc(seconds / 720);
  seconds %= 720;
  const hours = Math.trunc(seconds / 30);
  seconds %= 30;
  const minutes = seconds * 2;
  const startAge = { years, months, days, hours, minutes };
  const first = addChildLimitDuration(birth, years, months, days, hours, minutes);
  const cycles = Array.from({ length: 12 }, (_, index) => ({
    index,
    ganZhi: stepSixtyCycle(monthPillar, forward ? index + 1 : -index - 1),
    startTimestamp: chinaTimestamp(shiftCivilYears(first, index * 10)),
    endTimestamp: chinaTimestamp(shiftCivilYears(first, (index + 1) * 10)),
    endExclusive: true as const,
  }));
  return {
    birth,
    direction: forward ? 'forward' as const : 'backward' as const,
    monthPillar,
    startAge,
    term: { name: term.getName(), timestamp: termTs },
    firstTimestamp: chinaTimestamp(first),
    cycles,
  };
}
