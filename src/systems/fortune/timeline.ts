import { SolarDay, SolarTerm, SolarTime } from 'tyme4ts';
import { collectFolkTabooGods, getAlmanacSolarDayGods } from '../almanac/gods';
import { getDayDuty, getDayTwelveStar, getHourTwelveStar } from '../almanac/rules';
import { getDivinationTime } from '../calendar';
import {
  getBranchWuxing,
  getStemWuxing,
  getTenStar,
  isLiuchong,
  isLiuhe,
  stepSixtyCycle,
} from '../ganzhi-foundation';
import { chinaParts, chinaTimestamp } from '../luck';
import type {
  DailyHourSlice,
  FortuneTrend,
  MonthlyDaySlice,
  PersonalBaziSummary,
  YearlyMonthSlice,
} from './types';

const HOUR_RANGES = [
  '00:00-01:00',
  '01:00-03:00',
  '03:00-05:00',
  '05:00-07:00',
  '07:00-09:00',
  '09:00-11:00',
  '11:00-13:00',
  '13:00-15:00',
  '15:00-17:00',
  '17:00-19:00',
  '19:00-21:00',
  '21:00-23:00',
  '23:00-24:00',
];

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const HUANGDAO_TWELVE = new Set(['青龙', '明堂', '金匮', '天德', '玉堂', '司命']);
const AUSPICIOUS_OFFICERS = new Set(['建', '除', '满', '定', '成', '开']);
const CAUTION_OFFICERS = new Set(['破', '危', '闭']);

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatDateYmd(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function daysInGregorianMonth(year: number, month: number): number {
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return month === 2 ? (leap ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function evaluatePillarMatch(
  ganzhi: string,
  bazi?: PersonalBaziSummary | null,
): { scoreDelta: number; tenGod?: string; clashNotes: string[]; harmonyNotes: string[]; favHit: boolean } {
  if (!bazi) {
    return { scoreDelta: 0, clashNotes: [], harmonyNotes: [], favHit: false };
  }
  const stem = ganzhi[0] ?? '甲';
  const branch = ganzhi[1] ?? '子';
  const tenGod = getTenStar(bazi.dayMaster, stem);
  const stemEl = getStemWuxing(stem);
  const branchEl = getBranchWuxing(branch);

  let delta = 0;
  let favHit = false;
  if (bazi.favorableWuxing.includes(stemEl)) {
    delta += 5;
    favHit = true;
  } else if (bazi.unfavorableWuxing.includes(stemEl)) {
    delta -= 4;
  }
  if (bazi.favorableWuxing.includes(branchEl)) {
    delta += 6;
    favHit = true;
  } else if (bazi.unfavorableWuxing.includes(branchEl)) {
    delta -= 5;
  }

  const clashNotes: string[] = [];
  const harmonyNotes: string[] = [];
  if (isLiuchong(branch, bazi.natalPillars.day[1] ?? '')) {
    delta -= 8;
    clashNotes.push('冲日支');
  } else if (isLiuhe(branch, bazi.natalPillars.day[1] ?? '')) {
    delta += 4;
    harmonyNotes.push('合日支');
  }
  if (isLiuchong(branch, bazi.natalPillars.year[1] ?? '')) {
    delta -= 4;
    clashNotes.push('冲年支');
  }
  if (isLiuchong(branch, bazi.natalPillars.month[1] ?? '')) {
    delta -= 4;
    clashNotes.push('冲月支');
  }

  return { scoreDelta: delta, tenGod, clashNotes, harmonyNotes, favHit };
}

export function buildDailyHoursTimeline(
  year: number,
  month: number,
  day: number,
  bazi?: PersonalBaziSummary | null,
): DailyHourSlice[] {
  const lunar = SolarDay.fromYmd(year, month, day).getLunarDay();
  const dayGanZhi = lunar.getSixtyCycle().getName();
  const hours = lunar.getHours();
  return hours.map((hour, index) => {
    const ganzhi = hour.getSixtyCycle().getName();
    const branch = ganzhi[1] ?? '子';
    const effectiveDayBranch = index === 12 ? stepSixtyCycle(dayGanZhi, 1)[1] : dayGanZhi[1];
    const twelveStar = getHourTwelveStar(effectiveDayBranch, branch);
    const isHuangdao = HUANGDAO_TWELVE.has(twelveStar);
    const match = evaluatePillarMatch(ganzhi, bazi);

    let score = 65 + (isHuangdao ? 8 : -3) + match.scoreDelta;
    if (bazi && isLiuchong(branch, bazi.flowDayGanZhi[1] ?? '')) {
      score -= 4;
    }

    const rating: DailyHourSlice['rating'] = score >= 74 ? '吉' : score >= 58 ? '平' : '慎';
    const noteParts: string[] = [];
    noteParts.push(isHuangdao ? `${twelveStar}黄道` : twelveStar);
    if (match.tenGod) noteParts.push(match.tenGod);
    if (match.clashNotes.length) noteParts.push(match.clashNotes.join('、'));
    else if (match.harmonyNotes.length) noteParts.push(match.harmonyNotes.join('、'));
    else if (match.favHit) noteParts.push('喜用助力');

    return {
      name: index === 0 ? '早子时' : index === 12 ? '晚子时' : `${branch}时`,
      range: HOUR_RANGES[index] ?? '',
      ganzhi,
      twelveStar,
      ...(match.tenGod ? { tenGod: match.tenGod } : {}),
      rating,
      note: noteParts.join(' · '),
    };
  });
}

export function buildMonthlyTimeline(
  year: number,
  month: number,
  bazi?: PersonalBaziSummary | null,
): {
  solarTerms: Array<{ name: string; date: string; time: string }>;
  days: MonthlyDaySlice[];
} {
  const totalDays = daysInGregorianMonth(year, month);
  const solarTerms: Array<{ name: string; date: string; time: string }> = [];
  const seenTerms = new Set<string>();

  const days: MonthlyDaySlice[] = Array.from({ length: totalDays }, (_, idx) => {
    const day = idx + 1;
    const solarDay = SolarDay.fromYmd(year, month, day);
    const lunar = solarDay.getLunarDay();
    const noon = SolarTime.fromYmdHms(year, month, day, 12, 0, 0);
    const cycleDay = noon.getSixtyCycleHour().getSixtyCycleDay();
    const monthBranch = cycleDay.getMonth().getEarthBranch().getName();
    const dayGanZhi = cycleDay.getSixtyCycle().getName();
    const dayBranch = dayGanZhi[1];
    const dayOfficer = getDayDuty(monthBranch, dayBranch);
    const twelveStar = getDayTwelveStar(monthBranch, dayBranch);

    const term = solarDay.getTerm();
    const termTime = term.getJulianDay().getSolarTime();
    if (termTime.getYear() === year && termTime.getMonth() === month && termTime.getDay() === day && !seenTerms.has(term.getName())) {
      seenTerms.add(term.getName());
      solarTerms.push({
        name: term.getName(),
        date: formatDateYmd(year, month, day),
        time: `${pad2(termTime.getHour())}:${pad2(termTime.getMinute())}`,
      });
    }

    const officerClean = dayOfficer.replace(/[日值神]/g, '').slice(0, 1);
    let score = 68;
    if (AUSPICIOUS_OFFICERS.has(officerClean)) score += 6;
    else if (CAUTION_OFFICERS.has(officerClean)) score -= 6;
    if (HUANGDAO_TWELVE.has(twelveStar)) score += 5;
    else score -= 3;

    const match = evaluatePillarMatch(dayGanZhi, bazi);
    score += match.scoreDelta;

    const gods = [
      ...getAlmanacSolarDayGods(solarDay, noon),
      ...collectFolkTabooGods(lunar.getMonth(), lunar.getDay(), dayGanZhi),
    ];
    const tabooNames = gods
      .filter((g) => g.luck === '凶' && ['十恶大败', '杨公忌', '三娘煞', '四离', '四绝', '岁破', '月破'].includes(g.name))
      .map((g) => g.name);
    if (tabooNames.length > 0) {
      score -= Math.min(8, tabooNames.length * 4);
    }

    const clamped = Math.max(35, Math.min(95, Math.round(score)));

    const rating: MonthlyDaySlice['rating'] = clamped >= 75 ? '优选' : clamped >= 60 ? '平稳' : '慎用';
    const tag = match.clashNotes.length
      ? match.clashNotes[0]
      : tabooNames.length
        ? tabooNames[0]
        : match.harmonyNotes.length
          ? match.harmonyNotes[0]
          : match.favHit
            ? '喜用日'
            : HUANGDAO_TWELVE.has(twelveStar)
              ? twelveStar
              : `${dayOfficer}日`;

    const utcDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    return {
      date: formatDateYmd(year, month, day),
      day,
      weekday: WEEKDAYS[utcDay],
      weekdayIndex: utcDay,
      lunarDate: lunar.toString(),
      dayGanZhi,
      dayOfficer,
      twelveStar,
      ...(match.tenGod ? { tenGod: match.tenGod } : {}),
      score: clamped,
      rating,
      tag,
    };
  });

  return { solarTerms, days };
}

export function buildYearlyMonthsTimeline(
  year: number,
  bazi?: PersonalBaziSummary | null,
  ziweiMonthly?: ReadonlyArray<{
    lunarMonth: number;
    heavenlyStem: string;
    earthlyBranch: string;
    natalPalaceName: string;
    mutagen: string[];
    mutagenPlacements?: ReadonlyArray<{ mutagen: string; star: string; natalPalace?: string; targetPalace?: string; targetName?: string }>;
  }>,
): YearlyMonthSlice[] {
  const first = SolarTerm.fromIndex(year, 3); // 立春
  const terms = Array.from({ length: 13 }, (_, index) => {
    const term = first.next(index * 2);
    const t = term.getJulianDay().getSolarTime();
    const ts = chinaTimestamp({
      year: t.getYear(),
      month: t.getMonth(),
      day: t.getDay(),
      hour: t.getHour(),
      minute: t.getMinute(),
      second: t.getSecond(),
    });
    return { name: term.getName(), timestamp: ts };
  });

  return Array.from({ length: 12 }, (_, idx) => {
    const startTs = terms[idx].timestamp;
    const endTs = terms[idx + 1].timestamp;
    const midTs = Math.floor((startTs + endTs) / 2);
    const startParts = chinaParts(startTs);
    const endParts = chinaParts(endTs);
    const gz = getDivinationTime(new Date(midTs)).ganzhi;
    const monthGanZhi = gz.month;

    const match = evaluatePillarMatch(monthGanZhi, bazi);
    let score = 68 + match.scoreDelta;

    const zw = ziweiMonthly?.[idx];
    const ziweiMutagens = zw?.mutagenPlacements?.map(
      (p) => `${p.star}化${p.mutagen}→${p.natalPalace ?? p.targetPalace ?? p.targetName ?? ''}`,
    );
    if (zw?.mutagenPlacements) {
      for (const p of zw.mutagenPlacements) {
        if (p.mutagen === '禄' || p.mutagen === '权') score += 3;
        if (p.mutagen === '忌') score -= 4;
      }
    }

    const clamped = Math.max(35, Math.min(95, Math.round(score)));
    const trend: FortuneTrend = clamped >= 75 ? '旺' : clamped >= 60 ? '平' : '谨';

    const noteParts: string[] = [];
    if (match.tenGod) noteParts.push(`${match.tenGod}月`);
    if (match.favHit) noteParts.push('喜用临月');
    if (match.clashNotes.length) noteParts.push(match.clashNotes.join('、'));
    else if (match.harmonyNotes.length) noteParts.push(match.harmonyNotes.join('、'));
    if (zw?.natalPalaceName) noteParts.push(`流月叠${zw.natalPalaceName}`);
    if (!noteParts.length) noteParts.push(`${terms[idx].name}节令，流月${monthGanZhi}`);

    return {
      monthIndex: idx + 1,
      jieName: terms[idx].name,
      startDate: formatDateYmd(startParts.year, startParts.month, startParts.day),
      endDate: formatDateYmd(endParts.year, endParts.month, endParts.day),
      monthGanZhi,
      ...(match.tenGod ? { tenGod: match.tenGod } : {}),
      ...(zw?.natalPalaceName ? { ziweiPalace: zw.natalPalaceName } : {}),
      ...(ziweiMutagens?.length ? { ziweiMutagens } : {}),
      score: clamped,
      trend,
      note: noteParts.join(' · '),
    };
  });
}
