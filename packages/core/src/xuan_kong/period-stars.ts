/**
 * @file 玄空流年、流月飞星
 * @description 以三元紫白入中后顺飞九宫，叠到下卦运、山、向盘上。
 * @传统依据 《协纪辨方书》三元紫白；年星随三元甲子逆计入中，月星按节气月紫白；飞布沿洛书顺飞。
 * 入中星委托 tyme4ts 干支年、节气月九星；纪年两端越界时按月紫白表推算。
 */
import { SolarDay, SolarTerm, SolarTime, SixtyCycleYear } from 'tyme4ts';

import { daysInGregorianMonth } from '../calendar/date-validation';
import { getNineStarProfile } from '../direction';
import { isKe, isSheng } from '../wuxing';

export type FlyDirection = '顺飞' | '逆飞';

/**
 * 九星入中后按显式方向飞布。
 * 返回长度 9 的数组，下标 0..8 对应宫 1..9。
 */
export function flyStars(centerStar: number, direction: FlyDirection): number[] {
  if (!Number.isInteger(centerStar) || centerStar < 1 || centerStar > 9) {
    throw new Error(`飞星入中值必须是 1-9，当前为 ${centerStar}。`);
  }
  if (direction !== '顺飞' && direction !== '逆飞') {
    throw new Error(`飞星方向必须是顺飞或逆飞，当前为 ${String(direction)}。`);
  }
  const order = [5, 6, 7, 8, 9, 1, 2, 3, 4];
  const stars = Array.from({ length: 9 }, () => 0);
  for (let i = 0; i < 9; i += 1) {
    const gong = order[i];
    const offset = direction === '顺飞' ? i : -i;
    stars[gong - 1] = ((centerStar - 1 + offset + 18) % 9) + 1;
  }
  return stars;
}

const CANONICAL_FLYING_STAR_WUXING: Record<number, '水' | '土' | '木' | '金' | '火'> = {
  1: '水',
  2: '土',
  3: '木',
  4: '木',
  5: '土',
  6: '金',
  7: '金',
  8: '土',
  9: '火',
};

export const FLYING_STAR_WUXING: typeof CANONICAL_FLYING_STAR_WUXING = {
  ...CANONICAL_FLYING_STAR_WUXING,
};

export function getFlyingStarElement(star: number) {
  return CANONICAL_FLYING_STAR_WUXING[star];
}

export type FlyingStarYunState = '当运' | '生气' | '退气' | '死气' | '煞气';
export type ShanXiangRelation = '生入' | '生出' | '克入' | '克出' | '比和';

export interface XuanKongPeriodStarPlate {
  year: number;
  solarTermYear?: number;
  month?: number;
  day?: number;
  centerStar: number;
  starName: string;
  plate: number[];
  calendarNote: string;
}

export interface XuanKongFlowStars {
  yearPlate: XuanKongPeriodStarPlate;
  monthPlate?: XuanKongPeriodStarPlate;
}

function assertStar(star: number): asserts star is 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 {
  if (!Number.isInteger(star) || star < 1 || star > 9) {
    throw new Error(`飞星必须是 1-9，当前为 ${String(star)}。`);
  }
}

function starName(centerStar: number): string {
  assertStar(centerStar);
  const profile = getNineStarProfile(centerStar - 1);
  return `${profile.number}${profile.color}`;
}

function plateFromCenter(centerStar: number): number[] {
  return flyStars(centerStar, '顺飞');
}

const MONTH_JIE = [
  '小寒',
  '立春',
  '惊蛰',
  '清明',
  '立夏',
  '芒种',
  '小暑',
  '立秋',
  '白露',
  '寒露',
  '立冬',
  '大雪',
] as const;

const MONTH_BRANCHES = [
  '寅',
  '卯',
  '辰',
  '巳',
  '午',
  '未',
  '申',
  '酉',
  '戌',
  '亥',
  '子',
  '丑',
] as const;

/** 《钦定协纪辨方书·三元月九星入中宫》：子午卯酉年正月八白，辰戌丑未年五黄，寅申巳亥年二黑。 */
function firstMonthStar(solarTermYear: number): number {
  const yearBranch = SixtyCycleYear.fromYear(solarTermYear)
    .getSixtyCycle()
    .getEarthBranch()
    .getName();
  if ('子午卯酉'.includes(yearBranch)) return 8;
  if ('辰戌丑未'.includes(yearBranch)) return 5;
  return 2;
}

export function resolveYearFlyingStar(year: number): XuanKongPeriodStarPlate {
  if (!Number.isSafeInteger(year) || year < 1 || year > 9999) {
    throw new Error('流年必须是 1-9999 的整数年份。');
  }
  const centerStar = SixtyCycleYear.fromYear(year).getNineStar().getIndex() + 1;
  assertStar(centerStar);
  return {
    year,
    centerStar,
    starName: starName(centerStar),
    plate: plateFromCenter(centerStar),
    calendarNote: `按${year}年立春起的节气年取三元紫白入中，再顺飞九宫`,
  };
}

export function resolveMonthFlyingStar(
  year: number,
  month: number,
  day?: number,
): XuanKongPeriodStarPlate {
  if (!Number.isSafeInteger(year) || year < 1 || year > 9999) {
    throw new Error('流月年份必须是 1-9999 的整数。');
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('流月必须是 1-12 的公历月。');
  }
  const maxDay = daysInGregorianMonth(year, month);
  const resolvedDay = day ?? 15;
  if (!Number.isInteger(resolvedDay) || resolvedDay < 1 || resolvedDay > maxDay) {
    throw new Error(`流月日期必须是 1-${maxDay} 的整数。`);
  }
  const solarDay = SolarDay.fromYmd(year, month, resolvedDay);
  const jie = SolarTerm.fromName(year, MONTH_JIE[month - 1]);
  const jieTime = jie.getJulianDay().getSolarTime();
  const onJieDay = solarDay.subtract(jie.getSolarDay()) === 0;
  // SolarDay 在交节当天整日归新月；日期输入约定用中国标准时间正午作参照。
  const referenceTime = SolarTime.fromYmdHms(year, month, resolvedDay, 12, 0, 0);
  const effectiveDay = onJieDay && referenceTime.isBefore(jieTime) ? solarDay.next(-1) : solarDay;
  let centerStar: number;
  let solarTermYear: number;
  let monthBranch: string;
  try {
    const sixtyMonth = effectiveDay.getSixtyCycleDay().getSixtyCycleMonth();
    centerStar = sixtyMonth.getNineStar().getIndex() + 1;
    solarTermYear = sixtyMonth.getSixtyCycleYear().getYear();
    monthBranch = sixtyMonth.getSixtyCycle().getEarthBranch().getName();
  } catch (error) {
    // tyme4ts 在公元 1 年初和 9999 年末查询相邻干支年时越界。
    if (
      !((year === 1 && month === 1) || (year === 9999 && month === 12)) ||
      !(error instanceof Error) ||
      !/^illegal (solar|sixty cycle) year: (0|10000)$/.test(error.message)
    ) {
      throw error;
    }
    const beforeJie = referenceTime.isBefore(jieTime);
    const monthIndex = (month + 10 - (beforeJie ? 1 : 0) + 12) % 12;
    solarTermYear = year === 1 ? 0 : 9999;
    centerStar = ((firstMonthStar(solarTermYear) - 1 - monthIndex + 18) % 9) + 1;
    monthBranch = MONTH_BRANCHES[monthIndex];
  }
  assertStar(centerStar);
  const dateBasis =
    day === undefined
      ? `以${year}年${month}月${resolvedDay}日中国标准时间12:00代表该流月，取所属节气月`
      : `按${year}年${month}月${resolvedDay}日中国标准时间12:00所属节气月`;
  return {
    year,
    solarTermYear,
    month,
    day: resolvedDay,
    centerStar,
    starName: starName(centerStar),
    plate: plateFromCenter(centerStar),
    calendarNote: `${dateBasis}（${monthBranch}月）取月紫白入中，再顺飞九宫${onJieDay ? `；当日${jie.getName()}于${jieTime.toString()}交节，交节前后分属不同节气月` : ''}`,
  };
}

export function resolveXuanKongFlowStars(input: {
  flowYear?: number;
  flowMonth?: number;
  flowDay?: number;
}): XuanKongFlowStars | undefined {
  if (input.flowYear === undefined) {
    if (input.flowMonth !== undefined || input.flowDay !== undefined) {
      throw new Error('排流月飞星时必须同时提供 flowYear。');
    }
    return undefined;
  }
  if (input.flowDay !== undefined && input.flowMonth === undefined) {
    throw new Error('提供 flowDay 时必须同时提供 flowMonth。');
  }
  if (input.flowMonth === undefined) {
    return { yearPlate: resolveYearFlyingStar(input.flowYear) };
  }
  const monthPlate = resolveMonthFlyingStar(input.flowYear, input.flowMonth, input.flowDay);
  const effectiveYear = monthPlate.solarTermYear!;
  const centerStar = SixtyCycleYear.fromYear(effectiveYear).getNineStar().getIndex() + 1;
  const yearPlate: XuanKongPeriodStarPlate = {
    year: effectiveYear,
    centerStar,
    starName: starName(centerStar),
    plate: plateFromCenter(centerStar),
    calendarNote: `按${input.flowYear}年${monthPlate.month}月${monthPlate.day}日所属节气年${effectiveYear === 0 ? '公元前1' : effectiveYear}年取年紫白入中，再顺飞九宫`,
  };
  return {
    yearPlate,
    monthPlate,
  };
}

export function resolveFlyingStarYunState(star: number, yun: number): FlyingStarYunState {
  assertStar(star);
  if (!Number.isInteger(yun) || yun < 1 || yun > 9) {
    throw new Error(`运数必须是 1-9，当前为 ${String(yun)}。`);
  }
  // 《玄空风水学》第三章九运表的旺、生、死、煞、退五气口径。
  // 按距当运的循环星序判定，合十是另一种关系，不能用来推导死气。
  const offset = (star - yun + 9) % 9;
  if (offset === 0) return '当运';
  if (offset <= 2) return '生气';
  if (offset <= 4) return '死气';
  if (offset <= 7) return '煞气';
  return '退气';
}

export function resolveShanXiangRelation(shanStar: number, xiangStar: number): ShanXiangRelation {
  assertStar(shanStar);
  assertStar(xiangStar);
  const mountain = CANONICAL_FLYING_STAR_WUXING[shanStar];
  const facing = CANONICAL_FLYING_STAR_WUXING[xiangStar];
  if (mountain === facing) return '比和';
  if (isSheng(facing, mountain)) return '生入';
  if (isSheng(mountain, facing)) return '生出';
  if (isKe(facing, mountain)) return '克入';
  if (isKe(mountain, facing)) return '克出';
  throw new Error(`无法判定山${shanStar}向${xiangStar}的生克。`);
}
