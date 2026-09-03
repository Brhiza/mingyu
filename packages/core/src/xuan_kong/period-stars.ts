/**
 * @file 玄空流年、流月飞星
 * @description 以三元紫白入中后顺飞九宫，叠到下卦运、山、向盘上。
 * @传统依据 《协纪辨方书》三元紫白；年星随三元甲子逆计入中，月星按节气月紫白；飞布沿洛书顺飞。
 * 入中星委托 tyme4ts 干支年、节气月九星，与黄历紫白同源。
 */
import { SolarDay, SixtyCycleYear } from 'tyme4ts';

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

export const FLYING_STAR_WUXING: Record<number, '水' | '土' | '木' | '金' | '火'> = {
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

export type FlyingStarYunState = '当运' | '生气' | '退气' | '死气' | '平气';
export type ShanXiangRelation = '生入' | '生出' | '克入' | '克出' | '比和';

export interface XuanKongPeriodStarPlate {
  year: number;
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
    calendarNote: `按公元${year}年干支取三元紫白入中，再顺飞九宫`,
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
  const sixtyMonth = solarDay.getSixtyCycleDay().getSixtyCycleMonth();
  const centerStar = sixtyMonth.getNineStar().getIndex() + 1;
  assertStar(centerStar);
  const monthBranch = sixtyMonth.getSixtyCycle().getEarthBranch().getName();
  return {
    year,
    month,
    day: resolvedDay,
    centerStar,
    starName: starName(centerStar),
    plate: plateFromCenter(centerStar),
    calendarNote: day
      ? `按${year}年${month}月${resolvedDay}日所属节气月（${monthBranch}月）取月紫白入中，再顺飞九宫`
      : `未指定日期时按${year}年${month}月15日所属节气月（${monthBranch}月）取月紫白入中，再顺飞九宫`,
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
  const yearPlate = resolveYearFlyingStar(input.flowYear);
  if (input.flowMonth === undefined) {
    return { yearPlate };
  }
  return {
    yearPlate,
    monthPlate: resolveMonthFlyingStar(input.flowYear, input.flowMonth, input.flowDay),
  };
}

export function resolveFlyingStarYunState(star: number, yun: number): FlyingStarYunState {
  assertStar(star);
  if (!Number.isInteger(yun) || yun < 1 || yun > 9) {
    throw new Error(`运数必须是 1-9，当前为 ${String(yun)}。`);
  }
  if (star === yun) return '当运';
  if (star === (yun % 9) + 1) return '生气';
  if (star === ((yun + 7) % 9) + 1) return '退气';
  if (star === 10 - yun || (yun === 5 && star === 5)) return '死气';
  return '平气';
}

export function resolveShanXiangRelation(shanStar: number, xiangStar: number): ShanXiangRelation {
  assertStar(shanStar);
  assertStar(xiangStar);
  const mountain = FLYING_STAR_WUXING[shanStar];
  const facing = FLYING_STAR_WUXING[xiangStar];
  if (mountain === facing) return '比和';
  if (isSheng(facing, mountain)) return '生入';
  if (isSheng(mountain, facing)) return '生出';
  if (isKe(facing, mountain)) return '克入';
  if (isKe(mountain, facing)) return '克出';
  throw new Error(`无法判定山${shanStar}向${xiangStar}的生克。`);
}
