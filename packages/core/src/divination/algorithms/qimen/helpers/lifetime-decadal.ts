import { SolarTime } from 'tyme4ts';
import type {
  QimenData,
  QimenLifetimeData,
  QimenLifetimeInput,
  QimenLifetimeStage,
} from '../../../../types/divination';
import { createChildLimit } from '../../../../bazi/childLimit';
import {
  fromNativeDate,
  shiftSolarDateTimeYears,
  toNativeDate,
  toSolarDateTimeInfo,
} from '../../../../bazi/luckTiming';
import {
  formatCivilDateTime,
  formatFixedTimezoneOffset,
  getCivilDateTimeAtFixedOffset,
} from '../../../../calendar/civil-time';
import { getHistoricalTimezoneOffsetAt } from '../../../../calendar/historical-timezone';
import { getQimenConstants } from './_constants';

import { getDunJiaStem } from './jushu';

const { diPanPalaces } = getQimenConstants();

/** 八字交节起运与十年干支时间轴，分别列出奇门本命盘各层定位。 */
export function buildDecadalLifetimeStages(
  baseChart: QimenData,
  referenceDate: Date,
  input: QimenLifetimeInput,
  fallbackOffsetMinutes: number,
): { stages: QimenLifetimeStage[]; basis: NonNullable<QimenLifetimeData['basis']['decadalLuck']> } {
  if (input.gender !== 'male' && input.gender !== 'female') {
    throw new Error('十年干支大运需要提供性别，以确定顺逆行。');
  }
  const birth = fromNativeDate(referenceDate);
  const childLimit = createChildLimit(
    SolarTime.fromYmdHms(
      birth.year,
      birth.month,
      birth.day,
      birth.hour,
      birth.minute,
      birth.second,
    ),
    input.gender === 'male' ? 1 : 0,
  );
  const firstStart = toSolarDateTimeInfo(childLimit.getEndTime());
  const formatInstant = (date: Date) => {
    const offset = input.timeZoneId
      ? getHistoricalTimezoneOffsetAt(date, input.timeZoneId)
      : (input.timezone ?? fallbackOffsetMinutes / 60);
    return (
      formatCivilDateTime(getCivilDateTimeAtFixedOffset(date, offset)) +
      formatFixedTimezoneOffset(offset)
    );
  };
  const basis = {
    direction: childLimit.isForward() ? ('forward' as const) : ('backward' as const),
    startDateTime: formatInstant(toNativeDate(firstStart)),
    startAge: {
      years: childLimit.getYearCount(),
      months: childLimit.getMonthCount(),
      days: childLimit.getDayCount(),
      hours: childLimit.getHourCount(),
      minutes: childLimit.getMinuteCount(),
    },
    rule: '八字交节起运配合奇门本命宫定位：以真实出生瞬间按东八区历法计算，真太阳时修正用于本命盘日时坐标；阳男阴女顺行、阴男阳女逆行，顺取后一节、逆取前一节，三日折一年；从月柱顺逆排干支，每运十年，交运区间含起点而不含终点。',
    mapping:
      '大运天干分别查本命天盘干（含寄干）与地盘干，甲按本运旬首遁仪定位；地支按后天八卦地支宫定位。各层分别列证，结合问题取用。',
  };
  const ageOffset = input.stagePolicy?.ageSystem === 'nominalAge' ? 1 : 0;
  const ageAt = (instant: Date) => {
    const parts = fromNativeDate(instant);
    const anniversary = toNativeDate(shiftSolarDateTimeYears(birth, parts.year - birth.year));
    return parts.year - birth.year - (instant < anniversary ? 1 : 0) + ageOffset;
  };
  const stages: QimenLifetimeStage[] = [];
  const appendStage = (start: Date, end: Date, ganzhi?: string, number?: number) => {
    if (start >= end) return;
    const locations: string[] = [];
    const palaceNumbers = new Set<number>();
    if (ganzhi) {
      const stem = ganzhi[0] === '甲' ? getDunJiaStem(ganzhi) : ganzhi[0];
      for (const palace of baseChart.jiuGongGe) {
        if (palace.tianPan.stem === stem || palace.tianPan.companionStem === stem) {
          locations.push(
            `运干${ganzhi[0]}${ganzhi[0] === '甲' ? `遁${stem}` : ''}：天盘${palace.name}${palace.tianPan.companionStem === stem ? '（寄干）' : ''}`,
          );
          palaceNumbers.add(palace.gong);
        }
        if (palace.diPan.stem === stem) {
          locations.push(
            `运干${ganzhi[0]}${ganzhi[0] === '甲' ? `遁${stem}` : ''}：地盘${palace.name}`,
          );
          palaceNumbers.add(palace.gong);
        }
      }
      const branchPalace = diPanPalaces[ganzhi[1]];
      if (branchPalace) {
        palaceNumbers.add(branchPalace);
        locations.push(
          `运支${ganzhi[1]}：后天卦宫${baseChart.jiuGongGe.find((p) => p.gong === branchPalace)?.name ?? `${branchPalace}宫`}`,
        );
      }
    }
    stages.push({
      stageIndex: stages.length,
      title: ganzhi ? `第${number}步·${ganzhi}大运` : '童限·起运前',
      ageStart: ageAt(start),
      ageEnd: ageAt(new Date(end.getTime() - 1)),
      calendarStart: formatInstant(start).slice(0, 10),
      calendarEnd: formatInstant(new Date(end.getTime() - 1)).slice(0, 10),
      startDateTime: formatInstant(start),
      endDateTimeExclusive: formatInstant(end),
      ...(ganzhi ? { ganzhi } : {}),
      dominantPalaces: [...palaceNumbers].map((palace) => ({
        palace,
        name: baseChart.jiuGongGe.find((p) => p.gong === palace)?.name ?? `${palace}宫`,
      })),
      associatedMarkers: locations,
      stageTheme: ganzhi
        ? `以${ganzhi}运干支的分层定位，结合本命门、星、神、格局及流年判断本运。`
        : '以本命局与对应流年观察早年成长。',
      supportFacts: [],
      constraintFacts: [],
      limitations: [],
    });
  };
  appendStage(referenceDate, toNativeDate(firstStart));
  const firstFortune = childLimit.getStartDecadeFortune();
  for (let i = 0; i < 12; i++) {
    appendStage(
      toNativeDate(shiftSolarDateTimeYears(firstStart, i * 10)),
      toNativeDate(shiftSolarDateTimeYears(firstStart, (i + 1) * 10)),
      firstFortune.next(i).getName(),
      i + 1,
    );
  }
  return { stages, basis };
}
