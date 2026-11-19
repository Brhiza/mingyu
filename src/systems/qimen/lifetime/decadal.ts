import { formatCivilDateTime, formatFixedTimezoneOffset, getCivilDateTimeAtFixedOffset, getHistoricalTimezoneOffsetAt } from '../../huangji/civil-time';
import { calculateDecadalTimeline, chinaParts, chinaTimestamp, shiftCivilYears } from '../../luck';
import { getDunJiaStem } from '../layout';
import { branchPalaces } from '../palace';
import type { QimenData } from '../types';
import type { LifetimeStage } from './stages';

export interface DecadalInput {
  birthTimestamp: number;
  gender: 'male' | 'female';
  timezone?: number;
  timeZoneId?: string;
  ageSystem?: 'fullYears' | 'nominalAge';
}
export interface DecadalStage extends LifetimeStage {
  startDateTime: string;
  endDateTimeExclusive: string;
  ganzhi?: string;
}

/** 实际出生瞬时按东八区交节起运；各运干支分别映射到本命盘。 */
export function buildDecadalLifetimeStages(chart: QimenData, input: DecadalInput) {
  if (!Number.isSafeInteger(input.birthTimestamp) || input.birthTimestamp % 1000 !== 0 || !Number.isFinite(new Date(input.birthTimestamp).getTime())) throw new Error('十年大运须提供整秒的有效出生瞬时。');
  if (input.gender !== 'male' && input.gender !== 'female') throw new Error('十年干支大运需要提供性别，以确定顺逆行。');
  if (input.ageSystem && !['fullYears', 'nominalAge'].includes(input.ageSystem)) throw new Error('未知年龄口径。');
  if (chart.scope !== 'hour' || (chart.timeContext?.referenceTimestamp ?? chart.timestamp) !== input.birthTimestamp) throw new Error('本命时局与出生瞬时不一致。');
  const timeline = calculateDecadalTimeline(input.birthTimestamp, input.gender);
  const { birth, firstTimestamp } = timeline;
  if (input.timeZoneId && input.timezone !== undefined && Math.abs(getHistoricalTimezoneOffsetAt(new Date(input.birthTimestamp), input.timeZoneId) - input.timezone) > 1e-6) throw new Error('出生时固定偏移与 IANA 时区不一致。');
  const offsetAt = (timestamp: number) => input.timeZoneId ? getHistoricalTimezoneOffsetAt(new Date(timestamp), input.timeZoneId) : input.timezone ?? 8;
  const format = (timestamp: number) => {
    const offset = offsetAt(timestamp);
    return formatCivilDateTime(getCivilDateTimeAtFixedOffset(new Date(timestamp), offset)) + formatFixedTimezoneOffset(offset);
  };
  const basis = {
    direction: timeline.direction,
    startDateTime: format(firstTimestamp),
    startAge: timeline.startAge,
    rule: '八字交节起运配合奇门本命宫定位：以真实出生瞬间按东八区历法计算，真太阳时修正用于本命盘日时坐标；阳男阴女顺行、阴男阳女逆行，顺取后一节、逆取前一节，三日折一年；从月柱顺逆排干支，每运十年，交运区间含起点而不含终点。',
    mapping: '大运天干分别查本命天盘干（含寄干）与地盘干，甲按本运旬首遁仪定位；地支按后天八卦地支宫定位。各层分别列证，结合问题取用。',
  };
  const ageOffset = input.ageSystem === 'nominalAge' ? 1 : 0;
  const ageAt = (timestamp: number) => {
    const year = chinaParts(timestamp).year, count = year - birth.year;
    return count - (timestamp < chinaTimestamp(shiftCivilYears(birth, count)) ? 1 : 0) + ageOffset;
  };
  const stages: DecadalStage[] = [];
  const append = (start: number, end: number, ganzhi?: string, number?: number) => {
    if (start >= end) return;
    const locations: string[] = [], palaces = new Set<number>();
    if (ganzhi) {
      const lookup = ganzhi[0] === '甲' ? getDunJiaStem(ganzhi) : ganzhi[0];
      const text = `运干${ganzhi[0]}${ganzhi[0] === '甲' ? `遁${lookup}` : ''}`;
      for (const palace of chart.jiuGongGe) {
        if (palace.tianPan.stem === lookup || palace.tianPan.companionStem === lookup) {
          locations.push(`${text}：天盘${palace.name}${palace.tianPan.companionStem === lookup ? '（寄干）' : ''}`); palaces.add(palace.gong);
        }
        if (palace.diPan.stem === lookup) { locations.push(`${text}：地盘${palace.name}`); palaces.add(palace.gong); }
      }
      const branch = branchPalaces[ganzhi[1]];
      if (!branch) throw new Error(`无法定位运支${ganzhi[1]}。`);
      palaces.add(branch);
      locations.push(`运支${ganzhi[1]}：后天卦宫${chart.jiuGongGe.find((p) => p.gong === branch)?.name ?? `${branch}宫`}`);
    }
    stages.push({ stageIndex: stages.length, title: ganzhi ? `第${number}步·${ganzhi}大运` : '童限·起运前',
      ageStart: ageAt(start), ageEnd: ageAt(end - 1), calendarStart: format(start).slice(0, 10), calendarEnd: format(end - 1).slice(0, 10),
      startDateTime: format(start), endDateTimeExclusive: format(end), ...(ganzhi ? { ganzhi } : {}),
      dominantPalaces: [...palaces].map((palace) => ({ palace, name: chart.jiuGongGe.find((p) => p.gong === palace)?.name ?? `${palace}宫` })),
      associatedMarkers: locations, stageTheme: ganzhi ? `以${ganzhi}运干支的分层定位，结合本命门、星、神、格局及流年判断本运。` : '以本命局与对应流年观察早年成长。',
      supportFacts: [], constraintFacts: [], limitations: [] });
  };
  append(input.birthTimestamp, firstTimestamp);
  for (const cycle of timeline.cycles) append(cycle.startTimestamp, cycle.endTimestamp, cycle.ganZhi, cycle.index + 1);
  return { stages, basis };
}
