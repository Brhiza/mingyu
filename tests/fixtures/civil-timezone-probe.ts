import {
  getBaziDayIndexByDate,
  getBaziMonthIndexByDate,
  getCalendarInfo,
  getYearMonthsGanZhi,
} from '../../packages/core/src/bazi/calendarTool';
import { calculateSeasonInfoFromDate } from '../../packages/core/src/bazi/baziCalculatorTime';
import { calculateSolarTermEvidence } from '../../packages/core/src/calendar/solar-term-evidence';
import { buildCurrentBaziFortuneSelection } from '../../packages/core/src/bazi/fortuneSelection/current';
import type { BaziChartResult, LuckCycle } from '../../packages/core/src/bazi/baziTypes';
import {
  createCivilDate,
  createLocalTimeRange,
  fromCivilDate,
  fromNativeDate,
  getLuckCycleForDate,
  toNativeDate,
} from '../../packages/core/src/bazi/luckTiming';
import { getDayHourBreakdown } from '../../packages/core/src/bazi/fortuneSelection/helpers/breakdown';

const cycle: LuckCycle = {
  age: 8,
  year: 2008,
  ganZhi: '甲子',
  isXiaoyun: false,
  type: '大运',
  startSolarTime: { year: 2008, month: 2, day: 8, hour: 12, minute: 0, second: 0 },
  endSolarTime: { year: 2018, month: 2, day: 8, hour: 12, minute: 0, second: 0 },
  years: [],
};

const chart = { luckInfo: { startInfo: '', handoverInfo: '', cycles: [cycle] } } as BaziChartResult;
const civil = createCivilDate(2011, 12, 31, 23, 59, 58);
const boundaryBefore = new Date('2024-03-05T10:21:00+08:00');
const boundaryAfter = new Date('2024-03-05T10:23:00+08:00');
const handoverBefore = new Date('2008-02-08T11:59:59+08:00');
const handoverAt = new Date('2008-02-08T12:00:00+08:00');
const calendarBefore = getCalendarInfo(new Date('2026-11-07T17:51:00+08:00'));
const calendarAfter = getCalendarInfo(new Date('2026-11-07T17:53:00+08:00'));
const roundtripInput = { year: 2026, month: 3, day: 8, hour: 2, minute: 30, second: 0 };
const instantInput = new Date('2026-03-08T02:30:00+08:00');
const instantOutput = toNativeDate(instantInput);
const historicalInput = new Date('1990-07-01T04:00:00.000Z');
const historicalCivil = fromNativeDate(historicalInput);
const historicalSeason = calculateSeasonInfoFromDate(historicalInput);
const boundaryEvidence = calculateSolarTermEvidence(2024, 3);
const boundaryBefore = calculateSeasonInfoFromDate(new Date(boundaryEvidence.utcTimestamp - 1000));
const boundaryAfter = calculateSeasonInfoFromDate(new Date(boundaryEvidence.utcTimestamp + 1000));
const range = createLocalTimeRange(
  toNativeDate({ year: 2024, month: 3, day: 5, hour: 10, minute: 22, second: 0 }),
  toNativeDate({ year: 2024, month: 3, day: 5, hour: 10, minute: 23, second: 0 }),
);
const months = getYearMonthsGanZhi(2026).map((item) => ({
  index: item.index,
  month: item.month,
  ganZhi: item.ganZhi,
  startDate: item.startDate,
  endDate: item.endDate,
  startDateTime: item.startDateTime,
  endDateTime: item.endDateTime,
  timeRange: { start: item.timeRange.start, end: item.timeRange.end },
}));
const breakdown = getDayHourBreakdown(2026, 3, 8, 'splitZi').map((item) => ({
  label: item.label,
  ganZhi: item.ganZhi,
  timeRange: item.timeRange,
  interval: { start: item.interval.start, end: item.interval.end },
}));

process.stdout.write(
  JSON.stringify({
    restored: fromCivilDate(civil),
    solar: fromNativeDate(toNativeDate(roundtripInput)),
    instant: {
      inputTimestamp: instantInput.getTime(),
      outputTimestamp: instantOutput.getTime(),
      civil: fromNativeDate(instantOutput),
    },
    historicalStandardTime: {
      inputTimestamp: historicalInput.getTime(),
      civil: historicalCivil,
      outputTimestamp: toNativeDate(historicalCivil).getTime(),
      season: {
        currentJieqi: historicalSeason.currentJieqi,
        nextJieqi: historicalSeason.nextJieqi,
        currentSeason: historicalSeason.currentSeason,
      },
    },
    solarTermBoundary: {
      evidence: {
        name: boundaryEvidence.name,
        index: boundaryEvidence.index,
        utcTimestamp: boundaryEvidence.utcTimestamp,
        utcDateTime: boundaryEvidence.utcDateTime,
      },
      before: {
        currentJieqi: boundaryBefore.currentJieqi,
        nextJieqi: boundaryBefore.nextJieqi,
        currentSeason: boundaryBefore.currentSeason,
        nextTermUtcTimestamp: boundaryBefore.nextTermEvidence?.utcTimestamp ?? null,
      },
      after: {
        currentJieqi: boundaryAfter.currentJieqi,
        nextJieqi: boundaryAfter.nextJieqi,
        currentSeason: boundaryAfter.currentSeason,
        previousTermUtcTimestamp: boundaryAfter.previousTermEvidence?.utcTimestamp ?? null,
      },
    },
    range: {
      start: range.start,
      end: range.end,
      startTimestamp: range.startTimestamp,
      endTimestamp: range.endTimestamp,
    },
    calendar: {
      before: calendarBefore,
      after: calendarAfter,
    },
    monthBoundary: {
      before: getBaziMonthIndexByDate(2024, boundaryBefore),
      after: getBaziMonthIndexByDate(2024, boundaryAfter),
      day: getBaziDayIndexByDate(2024, 1, new Date('2024-02-10T12:00:00+08:00')),
    },
    luckBoundary: {
      before: getLuckCycleForDate([cycle], handoverBefore)?.year ?? null,
      at: getLuckCycleForDate([cycle], handoverAt)?.year ?? null,
    },
    currentSelection: buildCurrentBaziFortuneSelection(chart, handoverAt),
    breakdown,
    months,
  }),
);
