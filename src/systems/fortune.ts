import { SolarDay, SolarTime } from 'tyme4ts';
import type { z } from 'zod';
import { sameJsonValue } from '../json-value';
import type { RuntimeContext } from '../runtime-context';
import type { fortuneInput } from '../schemas/birth';
import { classifyAlmanacGodSource, collectFolkTabooGods, getAlmanacSolarDayGods } from './almanac/gods';
import {
  getDailyDirections,
  getDayBranchRelations,
  getDayDuty,
  getDayTaboos,
  getDayTwelveStar,
  getDayTwentyEightStar,
  getSolarDayNineStar,
} from './almanac/rules';
import { getSolarYmdHmsPillars } from './calendar';
import { getNayin, getTenStar, isLiuchong, isLiuhe, isLiuhai, isSanxing } from './ganzhi-foundation';
import { chinaParts, chinaTimestamp } from './luck';
import { buildFortuneOverview } from './fortune/scoring';
import { buildDailyHoursTimeline, buildMonthlyTimeline, buildYearlyMonthsTimeline } from './fortune/timeline';
import type {
  DailyHourSlice,
  FortuneCalendarContext,
  FortuneScope,
  FortuneTopic,
  MonthlyDaySlice,
  PersonalAstrolabeSummary,
  PersonalBaziSummary,
  PersonalZiweiSummary,
  YearlyMonthSlice,
} from './fortune/types';

type Input = z.infer<typeof fortuneInput>;
export type FortuneSource = Omit<Input, 'question' | 'prompt'>;

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
const SCOPE_LABELS: Record<FortuneScope, string> = {
  daily: '日运',
  monthly: '月运',
  yearly: '年运',
};
const TOPIC_LABELS: Record<FortuneTopic, string> = {
  general: '综合运势',
  career: '事业工作',
  wealth: '财富资源',
  relationship: '感情人际',
  academic: '学业考证',
  health: '身心健康',
  decision: '决策出行',
};
const LAYER_LABELS: Record<string, string> = {
  dayun: '大运',
  year: '流年',
  month: '流月',
  day: '流日',
  hour: '流时',
  'natal-year': '年柱',
  'natal-month': '月柱',
  'natal-day': '日柱',
  'natal-hour': '时柱',
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function daysInSolarMonth(year: number, month: number): number {
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return month === 2 ? (leap ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function resolveTargetDate(
  scope: FortuneScope,
  target: Input['target'],
  currentTimeIso: string,
): { year: number; month: number; day: number; anchorIso: string; targetLabel: string } {
  const parsedNow = Date.parse(currentTimeIso);
  const baseTs = Number.isFinite(parsedNow) ? parsedNow : Date.now();
  const nowParts = chinaParts(baseTs);

  const year = target?.year ?? nowParts.year;
  const month = scope === 'yearly' ? (target?.month ?? 6) : (target?.month ?? nowParts.month);
  const rawDay = scope === 'daily' ? (target?.day ?? nowParts.day) : 15;

  const maxDay = daysInSolarMonth(year, month);
  if (rawDay < 1 || rawDay > maxDay) {
    throw new Error(`${year}年${month}月没有第 ${rawDay} 日，请检查目标日期。`);
  }

  const day = rawDay;
  const anchorIso = `${year}-${pad2(month)}-${pad2(day)}T12:00:00+08:00`;
  const targetLabel =
    scope === 'daily'
      ? `${year}年${month}月${day}日`
      : scope === 'monthly'
        ? `${year}年${month}月`
        : `${year}年`;
  return { year, month, day, anchorIso, targetLabel };
}

function buildCalendarContext(year: number, month: number, day: number): FortuneCalendarContext {
  const solarDay = SolarDay.fromYmd(year, month, day);
  const lunar = solarDay.getLunarDay();
  const noon = SolarTime.fromYmdHms(year, month, day, 12, 0, 0);
  const noonPillars = getSolarYmdHmsPillars(year, month, day, 12, 0, 0);
  const utcDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();

  const yearGz = noonPillars.year;
  const monthGz = noonPillars.month;
  const dayGz = noonPillars.day;
  const monthBranch = monthGz[1];
  const dayStem = dayGz[0];
  const dayBranch = dayGz[1];
  const { recommends, avoids } = getDayTaboos(monthBranch, dayGz);
  const branchRel = getDayBranchRelations(dayBranch);

  return {
    targetDate: `${year}-${pad2(month)}-${pad2(day)}`,
    year,
    month,
    day,
    weekday: WEEKDAYS[utcDay],
    lunarDate: lunar.toString(),
    solarTerm: solarDay.getTerm().getName(),
    ganzhi: { year: yearGz, month: monthGz, day: dayGz },
    nayin: { year: getNayin(yearGz), month: getNayin(monthGz), day: getNayin(dayGz) },
    dayOfficer: getDayDuty(monthBranch, dayBranch),
    twelveStar: getDayTwelveStar(monthBranch, dayBranch),
    twentyEightStar: getDayTwentyEightStar(utcDay, dayBranch).name,
    nineStar: getSolarDayNineStar(solarDay).fullName,
    clash: `冲${branchRel.oppositeBranch}，煞${branchRel.ominous}`,
    recommends,
    avoids,
    dailyDirections: getDailyDirections(dayStem),
    gods: [
      ...getAlmanacSolarDayGods(solarDay, noon),
      ...collectFolkTabooGods(lunar.getMonth(), lunar.getDay(), dayGz),
    ].map((g) => ({
      name: g.name,
      luck: g.luck,
      source: g.source ?? classifyAlmanacGodSource(g.name),
    })),
  };
}

function summarizeBranchRelation(
  targetLabel: string,
  targetGz: string,
  natalLabel: string,
  natalGz: string,
): string[] {
  const b1 = targetGz[1] ?? '';
  const b2 = natalGz[1] ?? '';
  const hits: string[] = [];
  if (isLiuchong(b1, b2)) hits.push(`${targetLabel}${targetGz}与${natalLabel}${natalGz}六冲`);
  if (isLiuhe(b1, b2)) hits.push(`${targetLabel}${targetGz}与${natalLabel}${natalGz}六合`);
  if (isLiuhai(b1, b2)) hits.push(`${targetLabel}${targetGz}与${natalLabel}${natalGz}相害`);
  if (b1 !== b2 && isSanxing(b1, b2)) hits.push(`${targetLabel}${targetGz}与${natalLabel}${natalGz}相刑`);
  return hits;
}

async function computeFortune(
  source: FortuneSource,
  question: string,
  effectiveTimeIso: string,
  context?: RuntimeContext,
) {
  const scope: FortuneScope = source.scope ?? 'daily';
  const target = resolveTargetDate(scope, source.target, effectiveTimeIso);
  const calendar = buildCalendarContext(target.year, target.month, target.day);
  let wuyunAnnualRelationKind: string | null = null;
  let wuyunSummary: string | null = null;
  let wuyunFacts: string | null = null;
  if (scope === 'yearly') {
    const { calculateWuyunLiuqi, formatWuyunLiuqiFacts } = await import('./wuyun/index');
    const wuyunResult = calculateWuyunLiuqi({ year: target.year });
    wuyunAnnualRelationKind = wuyunResult.annualRelation.kind ?? null;
    wuyunSummary = `${wuyunResult.input.yearGanZhi}年岁运「${wuyunResult.annualMovement.element}${wuyunResult.annualMovement.strength}」，司天「${wuyunResult.sitian.name}」，在泉「${wuyunResult.zaiquan.name}」`;
    wuyunFacts = formatWuyunLiuqiFacts(wuyunResult);
  }

  const hasCase = Boolean(source.birth || source.birthRange);
  const omitted: Array<{ system: string; reason: string }> = [];

  let baziSummary: PersonalBaziSummary | null = null;
  let ziweiSummary: PersonalZiweiSummary | null = null;
  let ziweiMonthlyTimeline:
    | Array<{
        lunarMonth: number;
        heavenlyStem: string;
        earthlyBranch: string;
        natalPalaceName: string;
        mutagen: string[];
        mutagenPlacements?: Array<{ mutagen: string; star: string; natalPalace?: string; targetPalace?: string; targetName?: string }>;
      }>
    | undefined;
  let ziweiMajorStars: string[] = [];
  let astrolabeSummary: PersonalAstrolabeSummary | null = null;

  if (hasCase) {
    // 检查精确出生时是否早于目标运势日
    const anchorTs = Date.parse(target.anchorIso);
    const canAttachExactRef =
      source.birth?.clock.kind === 'exact' && source.gender !== undefined;
    let useReferenceTime = canAttachExactRef;
    if (canAttachExactRef && source.birth) {
      const approxBirthTs = chinaTimestamp({
        year: source.birth.year,
        month: source.birth.month,
        day: source.birth.day,
        hour: source.birth.clock.kind === 'exact' ? source.birth.clock.hour : 12,
        minute: source.birth.clock.kind === 'exact' ? source.birth.clock.minute : 0,
        second: 0,
      });
      if (anchorTs < approxBirthTs) {
        useReferenceTime = false;
        omitted.push({ system: '流运大运对比', reason: '所选运势时期早于出生时间，已跳过岁运交接对照，仅保留本命结构参考。' });
      }
    }

    const baziTask = (async () => {
      const { baziIndependent } = await import('./bazi');
      const baziRes = await baziIndependent({
        question,
        ...(source.birth ? { birth: source.birth } : {}),
        ...(source.birthRange ? { birthRange: source.birthRange } : {}),
        ...(source.gender ? { gender: source.gender } : {}),
        ...(useReferenceTime ? { referenceTime: target.anchorIso } : {}),
        ...(useReferenceTime && scope === 'yearly' && target.year >= 1900 && target.year <= 2199
          ? { timelineYear: target.year }
          : {}),
      }, context);
      const baziData = baziRes.data;

      if (baziData.chart && baziData.located) {
        const chart = baziData.chart;
        const loc = baziData.located;
        const interactions: string[] = [];
        for (const pair of loc.evidence.comparisons) {
          if (!pair.relations.length) continue;
          const src = `${LAYER_LABELS[pair.source] ?? pair.source}${pair.sourceGanZhi}`;
          const dst = `${LAYER_LABELS[pair.target] ?? pair.target}${pair.targetGanZhi}`;
          interactions.push(`${src}与${dst}：${pair.relations.map((r) => r.name).join('、')}`);
        }
        for (const f of loc.evidence.formations) {
          interactions.push(`构成${f.branches.join('')}${f.name}${f.element}`);
        }
        const shenshaHits: string[] = [
          ...new Set(
            loc.shensha.layers.flatMap((layer) =>
              layer.entries.map((entry) => entry.name),
            ),
          ),
        ];
        return {
          dayMaster: chart.pillars.day.gan,
          dayMasterElement: chart.pillars.day.stemElement,
          strengthStatus: chart.strength.status,
          pattern: chart.patternOverview.pattern,
          useful: chart.usefulGod.useful,
          favorableWuxing: [...chart.usefulGod.favorableWuxing],
          unfavorableWuxing: [...chart.usefulGod.unfavorableWuxing],
          natalPillars: {
            year: chart.pillars.year.ganZhi,
            month: chart.pillars.month.ganZhi,
            day: chart.pillars.day.ganZhi,
            hour: chart.pillars.hour.ganZhi,
          },
          dayunGanZhi: loc.cycle?.ganZhi ?? null,
          flowYearGanZhi: loc.year.ganZhi,
          flowMonthGanZhi: loc.month.ganZhi,
          flowDayGanZhi: loc.day.ganZhi,
          flowTenGods: {
            ...(loc.cycle ? { dayun: loc.cycle.pillar.tenGod } : {}),
            year: loc.year.tenGod,
            month: loc.month.tenGod,
            day: loc.day.tenGod,
          },
          interactions,
          shenshaHits,
        } satisfies PersonalBaziSummary;
      }
      if (baziData.chart) {
        const chart = baziData.chart;
        const interactions = [
          ...summarizeBranchRelation('流年', calendar.ganzhi.year, '日柱', chart.pillars.day.ganZhi),
          ...summarizeBranchRelation('流月', calendar.ganzhi.month, '日柱', chart.pillars.day.ganZhi),
          ...summarizeBranchRelation('流日', calendar.ganzhi.day, '日柱', chart.pillars.day.ganZhi),
        ];
        return {
          dayMaster: chart.pillars.day.gan,
          dayMasterElement: chart.pillars.day.stemElement,
          strengthStatus: chart.strength.status,
          pattern: chart.patternOverview.pattern,
          useful: chart.usefulGod.useful,
          favorableWuxing: [...chart.usefulGod.favorableWuxing],
          unfavorableWuxing: [...chart.usefulGod.unfavorableWuxing],
          natalPillars: {
            year: chart.pillars.year.ganZhi,
            month: chart.pillars.month.ganZhi,
            day: chart.pillars.day.ganZhi,
            hour: chart.pillars.hour.ganZhi,
          },
          dayunGanZhi: null,
          flowYearGanZhi: calendar.ganzhi.year,
          flowMonthGanZhi: calendar.ganzhi.month,
          flowDayGanZhi: calendar.ganzhi.day,
          flowTenGods: {
            year: getTenStar(chart.pillars.day.gan, calendar.ganzhi.year[0] ?? '甲'),
            month: getTenStar(chart.pillars.day.gan, calendar.ganzhi.month[0] ?? '甲'),
            day: getTenStar(chart.pillars.day.gan, calendar.ganzhi.day[0] ?? '甲'),
          },
          interactions,
          shenshaHits: [],
          precisionNote: '未提供性别或参考时刻早于出生，未计算精确大运与岁运神煞。',
        } satisfies PersonalBaziSummary;
      }
      if (baziData.unknown) {
        const seg = baziData.unknown.segments[0];
        const commonYear = baziData.unknown.common.year ?? seg?.pillars.year.ganZhi ?? '';
        const commonMonth = baziData.unknown.common.month ?? seg?.pillars.month.ganZhi ?? '';
        const commonDay = baziData.unknown.common.day ?? seg?.pillars.day.ganZhi ?? '';
        const dayGan = commonDay[0] ?? seg?.pillars.day.gan ?? '甲';
        const commonFav = baziData.unknown.segments.length
          ? seg.usefulGod.favorableWuxing.filter((wx) =>
              baziData.unknown!.segments.every((item) => item.usefulGod.favorableWuxing.includes(wx)),
            )
          : [];
        const commonUnfav = baziData.unknown.segments.length
          ? seg.usefulGod.unfavorableWuxing.filter((wx) =>
              baziData.unknown!.segments.every((item) => item.usefulGod.unfavorableWuxing.includes(wx)),
            )
          : [];
        const interactions = [
          ...(commonDay ? summarizeBranchRelation('流日', calendar.ganzhi.day, '日柱', commonDay) : []),
          ...(commonYear ? summarizeBranchRelation('流日', calendar.ganzhi.day, '年柱', commonYear) : []),
          ...(commonDay ? summarizeBranchRelation('流月', calendar.ganzhi.month, '日柱', commonDay) : []),
          ...(commonDay ? summarizeBranchRelation('流年', calendar.ganzhi.year, '日柱', commonDay) : []),
        ];
        return {
          dayMaster: dayGan,
          dayMasterElement: seg?.pillars.day.stemElement ?? '',
          strengthStatus: baziData.unknown.commonStrength ?? '时辰未定（按多候选参考）',
          pattern: baziData.unknown.commonOrdinaryPattern ?? '时辰未定',
          useful: commonFav.length ? `各候选共同喜${commonFav.join('、')}` : '因出生时辰未定，喜用随候选时段变化',
          favorableWuxing: commonFav,
          unfavorableWuxing: commonUnfav,
          natalPillars: {
            year: commonYear || '多候选交界',
            month: commonMonth || '多候选交界',
            day: commonDay || '多候选交界',
            hour: baziData.unknown.common.hour ?? '未知时辰',
          },
          dayunGanZhi: null,
          flowYearGanZhi: calendar.ganzhi.year,
          flowMonthGanZhi: calendar.ganzhi.month,
          flowDayGanZhi: calendar.ganzhi.day,
          flowTenGods: {
            year: getTenStar(dayGan, calendar.ganzhi.year[0] ?? '甲'),
            month: getTenStar(dayGan, calendar.ganzhi.month[0] ?? '甲'),
            day: getTenStar(dayGan, calendar.ganzhi.day[0] ?? '甲'),
          },
          interactions,
          shenshaHits: [],
          precisionNote: `当前档案共有 ${baziData.unknown.segments.length} 个可能时辰分段，已提取年/月/日柱稳定事实与共同喜用推演；补充精确时辰可解锁大运与紫微星盘精准定位。`,
        } satisfies PersonalBaziSummary;
      }
      return null;
    })();

    const ziweiTask = (async (): Promise<{
      summary: PersonalZiweiSummary | null;
      majorStars: string[];
      monthlyTimeline?: typeof ziweiMonthlyTimeline;
      omittedReason?: string;
    }> => {
      if (!source.birth) {
        return { summary: null, majorStars: [], omittedReason: '仅提供出生范围时未组装紫微流运盘。' };
      }
      if (!source.gender) {
        return { summary: null, majorStars: [], omittedReason: '未提供性别，无法排定紫微大限与流运。' };
      }
      if (!useReferenceTime && source.birth.clock.kind === 'exact') {
        return { summary: null, majorStars: [], omittedReason: '目标运势日期早于出生日期。' };
      }
      try {
        const { collectZiweiMajorStars, ziweiIndependent } = await import('./ziwei');
        const zwRes = await ziweiIndependent({
          question,
          birth: source.birth,
          gender: source.gender,
          ...(source.birth.clock.kind === 'exact'
            ? { referenceTime: target.anchorIso, includeTimeline: scope === 'yearly' }
            : {}),
        });
        const zwData = zwRes.data;
        if (!('unknown' in zwData) && zwData.reference) {
          const majorStars = collectZiweiMajorStars(zwData.natal.palaces);
          const layers = zwData.reference.layers;
          const mapMutagens = (items: ReadonlyArray<{ mutagen: string; star: string; natalPalace: string }>) =>
            items.map((x) => ({ mutagen: x.mutagen, star: x.star, targetPalace: x.natalPalace }));
          return {
            summary: {
              natalMingPalace: zwData.natal.soulBranch,
              yearlyPalace: zwData.natal.palaces[layers.yearly.index]?.name,
              yearlyMutagens: mapMutagens(layers.yearly.mutagenPlacements),
              monthlyPalace: zwData.natal.palaces[layers.monthly.index]?.name,
              monthlyMutagens: mapMutagens(layers.monthly.mutagenPlacements),
              dailyPalace: zwData.natal.palaces[layers.daily.index]?.name,
              dailyMutagens: mapMutagens(layers.daily.mutagenPlacements),
            },
            majorStars,
            monthlyTimeline: zwData.reference.monthlyTimeline,
          };
        }
        return { summary: null, majorStars: [], omittedReason: '出生时辰未精确到时分秒，紫微流年/流月/流日宫位需先定盘时辰。' };
      } catch (err) {
        return { summary: null, majorStars: [], omittedReason: err instanceof Error ? err.message : '紫微流运暂不可用。' };
      }
    })();

    const astroTask = (async (): Promise<{
      summary: PersonalAstrolabeSummary | null;
      omittedReason?: string;
    }> => {
      if (!source.birth || source.birth.clock.kind !== 'exact') {
        return { summary: null, omittedReason: '需要精确出生时分秒才可计算流年/流日行运相位。' };
      }
      if (source.birth.calendar === 'lunar') {
        return { summary: null, omittedReason: '当前仅支持公历出生直接计算西洋星盘行运。' };
      }
      if (!source.location) {
        return { summary: null, omittedReason: '未提供出生地经纬度，无法定位行运落宫与四轴相位。' };
      }
      if (source.birth.timezone === undefined && !source.birth.timeZoneId) {
        return { summary: null, omittedReason: '缺少时区配置，无法定位西洋星盘行运。' };
      }
      try {
        const { astrolabeIndependent } = await import('./astrolabe');
        const flowRef =
          scope === 'daily'
            ? ({ kind: 'day', year: target.year, month: target.month, day: target.day } as const)
            : scope === 'monthly'
              ? ({ kind: 'month', year: target.year, month: target.month } as const)
              : ({ kind: 'year', year: target.year } as const);
        const astroRes = await astrolabeIndependent(
          {
            question,
            birth: {
              year: source.birth.year,
              month: source.birth.month,
              day: source.birth.day,
              hour: source.birth.clock.hour,
              minute: source.birth.clock.minute,
              second: source.birth.clock.second,
              latitude: source.location.latitude,
              longitude: source.location.longitude,
              ...(source.birth.timezone !== undefined ? { timezone: source.birth.timezone } : {}),
              ...(source.birth.timeZoneId ? { timeZoneId: source.birth.timeZoneId } : {}),
              ...(source.location.locationName ? { locationName: source.location.locationName } : {}),
              ...(source.birth.timeStandard === 'true-solar' ? { useTrueSolarTime: true } : {}),
            },
            flow: {
              reference: flowRef,
              techniques: scope === 'yearly' ? ['transit', 'solar-return'] : ['transit'],
            },
          },
          context,
        );
        const aData = astroRes.data;
        const sunSign = aData.points.find((p) => p.id === 'sun')?.sign ?? '';
        const moonSign = aData.points.find((p) => p.id === 'moon')?.sign ?? '';
        const ascSign = aData.angles.find((a) => a.id === 'asc')?.sign ?? '';
        const aspects = aData.flow?.transit?.aspects ?? [];
        return {
          summary: {
            sunSign,
            moonSign,
            ascSign,
            topAspects: aspects.slice(0, 6).map((a) => ({
              movingName: a.movingName,
              aspectLabel: a.label,
              natalName: a.natalName,
              strength: Math.round(a.strength),
              phase: a.phase,
            })),
            ...(aData.flow?.solarReturn && aData.flow.solarReturn.status === 'calculated' && aData.flow.solarReturn.charts[0]
              ? {
                  solarReturnHighlights: aData.flow.solarReturn.charts[0].natalAspects
                    .slice(0, 4)
                    .map((x) => `返照${x.movingName}${x.label}本命${x.natalName}`),
                }
              : {}),
          },
        };
      } catch (err) {
        return { summary: null, omittedReason: err instanceof Error ? err.message : '西洋行运暂不可用。' };
      }
    })();

    const [baziOutcome, ziweiOutcome, astroOutcome] = await Promise.all([baziTask, ziweiTask, astroTask]);
    baziSummary = baziOutcome;
    ziweiSummary = ziweiOutcome.summary;
    ziweiMajorStars = ziweiOutcome.majorStars;
    ziweiMonthlyTimeline = ziweiOutcome.monthlyTimeline;
    if (ziweiOutcome.omittedReason) {
      omitted.push({ system: '紫微流运', reason: ziweiOutcome.omittedReason });
    }
    astrolabeSummary = astroOutcome.summary;
    if (astroOutcome.omittedReason) {
      omitted.push({ system: '西洋星盘行运', reason: astroOutcome.omittedReason });
    }
  }

  // 构建时间轴（日运13时辰 / 月运全月日历 / 年运12流月）
  let dailyHours: DailyHourSlice[] | undefined;
  let monthlyTimeline: { solarTerms: Array<{ name: string; date: string; time: string }>; days: MonthlyDaySlice[] } | undefined;
  let yearlyMonths: YearlyMonthSlice[] | undefined;

  if (scope === 'daily') {
    dailyHours = buildDailyHoursTimeline(target.year, target.month, target.day, baziSummary);
  } else if (scope === 'monthly') {
    monthlyTimeline = buildMonthlyTimeline(target.year, target.month, baziSummary);
  } else {
    yearlyMonths = buildYearlyMonthsTimeline(target.year, baziSummary, ziweiMonthlyTimeline);
  }

  const overview = buildFortuneOverview({
    scope,
    calendar,
    bazi: baziSummary,
    ziwei: ziweiSummary,
    astrolabe: astrolabeSummary,
    wuyunSummary,
    wuyunRelation: wuyunAnnualRelationKind,
    hours: dailyHours,
    monthlyDays: monthlyTimeline?.days,
    yearlyMonths,
  });

  return {
    input: {
      ...source,
      scope,
      target: { year: target.year, month: target.month, day: target.day },
    },
    scope,
    scopeLabel: SCOPE_LABELS[scope],
    targetLabel: target.targetLabel,
    mode: hasCase ? ('personalized' as const) : ('general' as const),
    caseName: source.caseName ?? null,
    calendar,
    wuyunSummary,
    wuyunFacts,
    baziSummary,
    ziweiSummary,
    ziweiMajorStars,
    astrolabeSummary,
    omitted,
    overview,
    timeline: {
      ...(dailyHours ? { hours: dailyHours } : {}),
      ...(monthlyTimeline ? { solarTerms: monthlyTimeline.solarTerms, days: monthlyTimeline.days } : {}),
      ...(yearlyMonths ? { months: yearlyMonths } : {}),
    },
  };
}

type ComputedFortune = Awaited<ReturnType<typeof computeFortune>>;

function buildFortuneSections(
  computed: ComputedFortune,
  detailMode: 'compact' | 'full' = 'compact',
) {
  const { overview, calendar, baziSummary, ziweiSummary, astrolabeSummary } = computed;
  const scopeTitle = `${computed.targetLabel}${computed.scopeLabel}`;
  const subjectLabel = computed.mode === 'personalized'
    ? `定制案例「${computed.caseName || '当前命主'}」`
    : '通用大众流时运势';

  const calendarLine =
    computed.scope === 'daily'
      ? `${calendar.targetDate}（${calendar.lunarDate} · ${calendar.weekday} · ${calendar.solarTerm}）｜干支 ${calendar.ganzhi.year}年 ${calendar.ganzhi.month}月 ${calendar.ganzhi.day}日`
      : computed.scope === 'monthly'
        ? `${computed.targetLabel}（${calendar.ganzhi.year}年 · 节气月参考 ${calendar.ganzhi.month}月）${computed.timeline.solarTerms?.length ? `｜交节：${computed.timeline.solarTerms.map((s) => `${s.name} ${s.date}`).join('、')}` : ''}`
        : `${computed.targetLabel}（流年干支 ${calendar.ganzhi.year} · 纳音 ${calendar.nayin.year}）${computed.wuyunSummary ? `｜${computed.wuyunSummary}` : ''}`;

  const overviewMd = [
    `**${overview.headline}**`,
    '',
    `- 综合趋势：**${overview.overallTier}（${overview.overallScore} / 100）**`,
    `- 关键词：${overview.keywords.join(' · ')}`,
    `- 历法基准：${calendarLine}`,
    '',
    '### 五维本地评估',
    ...overview.dimensions.map((d) => `- **${d.label}**（${d.trend} · ${d.score}分）：${d.summary}`),
  ].join('\n');

  const factorsMd = overview.scoreFactors.length
    ? overview.scoreFactors
        .map((f) => `- **${f.label}**（${f.impact > 0 ? `+${f.impact}` : f.impact}）：${f.detail}`)
        .join('\n')
    : '- 当前以历法与五行节律基础评估为主。';

  const flowLayerParts = [
    ...(baziSummary?.dayunGanZhi ? [`大运 ${baziSummary.dayunGanZhi}（${baziSummary.flowTenGods.dayun}）`] : []),
    ...(baziSummary ? [`流年 ${baziSummary.flowYearGanZhi}（${baziSummary.flowTenGods.year}）`] : []),
    ...(baziSummary && computed.scope !== 'yearly' ? [`流月 ${baziSummary.flowMonthGanZhi}（${baziSummary.flowTenGods.month}）`] : []),
    ...(baziSummary && computed.scope === 'daily' ? [`流日 ${baziSummary.flowDayGanZhi}（${baziSummary.flowTenGods.day}）`] : []),
  ];

  const ziweiLayerParts = ziweiSummary
    ? [
        ...(ziweiSummary.yearlyPalace
          ? [`流年入${ziweiSummary.yearlyPalace}（${ziweiSummary.yearlyMutagens.map((m) => `${m.star}化${m.mutagen}→${m.targetPalace}`).join('、')}）`]
          : []),
        ...(computed.scope !== 'yearly' && ziweiSummary.monthlyPalace
          ? [`流月入${ziweiSummary.monthlyPalace}（${ziweiSummary.monthlyMutagens.map((m) => `${m.star}化${m.mutagen}→${m.targetPalace}`).join('、')}）`]
          : []),
        ...(computed.scope === 'daily' && ziweiSummary.dailyPalace
          ? [`流日入${ziweiSummary.dailyPalace}（${ziweiSummary.dailyMutagens.map((m) => `${m.star}化${m.mutagen}→${m.targetPalace}`).join('、')}）`]
          : []),
      ]
    : [];

  const personalMd = baziSummary
    ? [
        `- **八字主干**：四柱 ${baziSummary.natalPillars.year} / ${baziSummary.natalPillars.month} / ${baziSummary.natalPillars.day} / ${baziSummary.natalPillars.hour}；日主 ${baziSummary.dayMaster}${baziSummary.dayMasterElement}（${baziSummary.strengthStatus}，${baziSummary.pattern}）`,
        `- **喜忌方向**：${baziSummary.useful}；喜用五行 ${baziSummary.favorableWuxing.join('、') || '中和随运调衡'}；忌神五行 ${baziSummary.unfavorableWuxing.join('、') || '随岁运偏颇防忌'}`,
        `- **流运层**：${flowLayerParts.join(' · ')}`,
        ...(baziSummary.interactions.length ? [`- **干支互动**：${baziSummary.interactions.slice(0, detailMode === 'full' ? 12 : 5).join('；')}`] : []),
        ...(baziSummary.shenshaHits.length ? [`- **岁运神煞**：${baziSummary.shenshaHits.join('、')}`] : []),
        ...(ziweiLayerParts.length ? [`- **紫微流运**：${ziweiLayerParts.join('；')}`] : []),
        ...(astrolabeSummary
          ? [
              `- **西洋行运**：本命太阳${astrolabeSummary.sunSign} / 月亮${astrolabeSummary.moonSign} / 上升${astrolabeSummary.ascSign}；核心行运相位：${astrolabeSummary.topAspects.map((a) => `${a.movingName}${a.aspectLabel}${a.natalName}(${a.strength}%)`).join('、') || '无明显紧相位'}`,
            ]
          : []),
        ...(baziSummary.precisionNote ? [`- **精度提示**：${baziSummary.precisionNote}`] : []),
      ].join('\n')
    : computed.scope === 'daily'
      ? [
          `- **建除与值神**：${calendar.dayOfficer}日 · ${calendar.twelveStar} · ${calendar.twentyEightStar}宿 · ${calendar.nineStar}`,
          `- **吉神方位**：喜神${calendar.dailyDirections.joy} · 财神${calendar.dailyDirections.wealth} · 福神${calendar.dailyDirections.mascot} · ${calendar.clash}`,
          `- **黄历宜忌**：宜「${calendar.recommends.slice(0, 6).join('、') || '常规事务'}」｜忌「${calendar.avoids.slice(0, 6).join('、') || '过度折腾'}」`,
          ...(computed.wuyunSummary ? [`- **五运六气**：${computed.wuyunSummary}`] : []),
        ].join('\n')
      : computed.scope === 'monthly'
        ? [
            `- **流月基准**：${calendar.ganzhi.year}年 · ${calendar.ganzhi.month}月（纳音 ${calendar.nayin.month}） · ${calendar.nineStar}`,
            `- **月度节气**：${computed.timeline.solarTerms?.map((s) => `${s.name}（${s.date} ${s.time}）`).join('、') || calendar.solarTerm}`,
            `- **全月节奏**：优选 ${computed.timeline.days?.filter((d) => d.rating === '优选').length ?? 0} 天、平稳 ${computed.timeline.days?.filter((d) => d.rating === '平稳').length ?? 0} 天、慎用 ${computed.timeline.days?.filter((d) => d.rating === '慎用').length ?? 0} 天`,
            ...(computed.wuyunSummary ? [`- **岁运底色**：${computed.wuyunSummary}`] : []),
          ].join('\n')
        : [
            `- **流年基准**：${calendar.ganzhi.year}年（纳音 ${calendar.nayin.year}） · ${calendar.nineStar}`,
            ...(computed.wuyunSummary ? [`- **五运六气**：${computed.wuyunSummary}`] : []),
            `- **全年流月**：旺月 ${computed.timeline.months?.filter((m) => m.trend === '旺').length ?? 0} 个、平稳 ${computed.timeline.months?.filter((m) => m.trend === '平').length ?? 0} 个、谨慎 ${computed.timeline.months?.filter((m) => m.trend === '谨').length ?? 0} 个`,
          ].join('\n');

  let timelineMd = '';
  if (computed.timeline.hours) {
    timelineMd = computed.timeline.hours
      .map((h) => `- **${h.name}（${h.range} · ${h.ganzhi}）**：【${h.rating}】${h.note}`)
      .join('\n');
  } else if (computed.timeline.days) {
    const goodDays = computed.timeline.days.filter((d) => d.rating === '优选').slice(0, 8);
    const cautionDays = computed.timeline.days.filter((d) => d.rating === '慎用').slice(0, 6);
    timelineMd = [
      ...(computed.timeline.solarTerms?.length
        ? [`- **本月节气**：${computed.timeline.solarTerms.map((s) => `${s.name}（${s.date} ${s.time}）`).join('、')}`]
        : []),
      `- **优选日参考**：${goodDays.map((d) => `${d.day}日(${d.dayGanZhi}/${d.tag})`).join('、') || '整体均衡'}`,
      `- **慎用留意日**：${cautionDays.map((d) => `${d.day}日(${d.dayGanZhi}/${d.tag})`).join('、') || '无显著高危日'}`,
    ].join('\n');
  } else if (computed.timeline.months) {
    timelineMd = computed.timeline.months
      .map((m) => `- **第${m.monthIndex}流月 ${m.monthGanZhi}（${m.jieName} ${m.startDate}~${m.endDate}）**：【${m.trend} · ${m.score}分】${m.note}`)
      .join('\n');
  }

  const sections = [
    { id: 'overview', title: `一、${scopeTitle}总览（${subjectLabel}）`, markdown: overviewMd },
    { id: 'basis', title: computed.mode === 'personalized' ? '二、个人命局与流运触发依据' : '二、流时干支与历法气场', markdown: personalMd },
    { id: 'factors', title: '三、本地算法关键因子明细', markdown: factorsMd },
    { id: 'timeline', title: computed.scope === 'daily' ? '四、当日时辰节律' : computed.scope === 'monthly' ? '四、本月优选与留意日期' : '四、全年十二流月走势', markdown: timelineMd },
  ];

  return {
    scopeTitle,
    subjectLabel,
    factorsMd,
    personalMd,
    timelineMd,
    data: {
      ...computed,
      sections,
      markdown: sections.map((s) => `## ${s.title}\n\n${s.markdown}`).join('\n\n'),
    },
  };
}

async function buildSectionsAndPrompt(
  computed: ComputedFortune,
  question: string,
  options?: Input['prompt'],
) {
  const topic: FortuneTopic = options?.topic ?? 'general';
  const detailMode = options?.detailMode ?? 'compact';
  const { overview, calendar, baziSummary } = computed;
  const rendered = buildFortuneSections(computed, detailMode);
  const { scopeTitle, subjectLabel, factorsMd, personalMd, timelineMd, data } = rendered;

  const [classicsText, { buildMethodSituationDigest }] = await Promise.all([
    options?.includeClassics
      ? (async () => {
          const {
            dedupeExcerpts,
            formatClassicExcerpts,
            selectAlmanacClassics,
            selectBaziClassics,
            selectWuyunClassics,
            selectZiweiClassics,
          } = await import('./classics');
          const excerpts = [
            ...(computed.scope === 'daily' ? selectAlmanacClassics([calendar.dayOfficer]) : []),
            ...(baziSummary ? selectBaziClassics(baziSummary.dayMaster, baziSummary.pattern) : []),
            ...(computed.ziweiMajorStars.length ? selectZiweiClassics(computed.ziweiMajorStars) : []),
            ...(computed.scope === 'yearly' && computed.wuyunSummary ? selectWuyunClassics([]) : []),
          ];
          return excerpts.length ? formatClassicExcerpts(dedupeExcerpts(excerpts), '典籍依据参考') : '';
        })()
      : Promise.resolve(''),
    import('./situation-digest'),
  ]);

  const promptCalendarBlock =
    computed.scope === 'daily'
      ? `【基准时间与历法数据】\n目标日期：${computed.targetLabel}（日运）\n公历/农历：${calendar.targetDate}（${calendar.lunarDate}，${calendar.weekday}，节气：${calendar.solarTerm}）\n流时干支：年柱 ${calendar.ganzhi.year}（${calendar.nayin.year}）、月柱 ${calendar.ganzhi.month}（${calendar.nayin.month}）、日柱 ${calendar.ganzhi.day}（${calendar.nayin.day}）\n黄历值神：${calendar.dayOfficer}日｜${calendar.twelveStar}｜${calendar.twentyEightStar}宿｜${calendar.nineStar}｜${calendar.clash}`
      : computed.scope === 'monthly'
        ? `【基准月份与节气历法】\n目标月份：${computed.targetLabel}（月运）\n流年/流月：${calendar.ganzhi.year}年 · ${calendar.ganzhi.month}月（${calendar.nayin.month}）\n本月节气：${computed.timeline.solarTerms?.map((s) => `${s.name}（${s.date} ${s.time}）`).join('、') || calendar.solarTerm}\n全月统计：优选 ${computed.timeline.days?.filter((d) => d.rating === '优选').length ?? 0} 天 · 平稳 ${computed.timeline.days?.filter((d) => d.rating === '平稳').length ?? 0} 天 · 慎用 ${computed.timeline.days?.filter((d) => d.rating === '慎用').length ?? 0} 天`
        : `【基准年份与岁运历法】\n目标年份：${computed.targetLabel}（年运）\n流年干支：${calendar.ganzhi.year}年（${calendar.nayin.year}）${computed.wuyunSummary ? `\n五运六气：${computed.wuyunSummary}` : ''}\n全年流月分布：旺月 ${computed.timeline.months?.filter((m) => m.trend === '旺').length ?? 0} 个 · 平稳 ${computed.timeline.months?.filter((m) => m.trend === '平').length ?? 0} 个 · 谨慎 ${computed.timeline.months?.filter((m) => m.trend === '谨').length ?? 0} 个`;

  const digestLines = buildMethodSituationDigest('fortune', computed, question);
  const promptBlocks = [
    `【运势定制任务 · ${scopeTitle}】\n分析主体：${subjectLabel}\n关注主题：${TOPIC_LABELS[topic]}\n详略要求：${detailMode === 'full' ? '深度详尽版' : '精炼实用版'}`,
    digestLines.length ? `【局势要点】\n${digestLines.join('\n')}` : '',
    promptCalendarBlock,
    computed.mode === 'personalized'
      ? `【个人定制盘面事实】\n${personalMd}`
      : `【通用气场与宜忌】\n${personalMd}`,
    computed.wuyunFacts && detailMode === 'full' ? `【五运六气背景】\n${computed.wuyunFacts}` : '',
    `【多维综合评分与关键因子】\n${overview.headline}\n五维趋势：${overview.dimensions.map((d) => `${d.label}${d.score}分(${d.trend})`).join('；')}\n关键命中因子：\n${factorsMd}`,
    `【时间轴切片】\n${timelineMd}`,
    `【开运与避坑参考】\n宜：${overview.actionGuide.suitable.join('、')}\n忌：${overview.actionGuide.caution.join('、')}\n参考元素：五行${overview.actionGuide.luckyElements.wuxing.join('、')}｜色系${overview.actionGuide.luckyElements.colors.join('、')}｜方位${overview.actionGuide.luckyElements.directions.join('、')}`,
    computed.omitted.length
      ? `【资料边界提醒】\n${computed.omitted.map((o) => `- ${o.system}：${o.reason}`).join('\n')}`
      : '',
    classicsText,
    `【AI 报告输出规范】\n按以下 4 节输出「${scopeTitle}定制运势报告」：\n1. 核心定调：一句话点明${computed.scope === 'daily' ? '今日' : computed.scope === 'monthly' ? '本月' : '全年'}主旋律。\n2. ${TOPIC_LABELS[topic]}重点拆解（兼顾事业、财运、感情、身心）：结合喜用/十神/四化/相位/建除说明依据。\n3. 关键时间节点：点出${computed.scope === 'daily' ? '优选吉时与避开时段' : computed.scope === 'monthly' ? '节气转折、优选日与慎用日' : '旺月与转折月'}。\n4. 行动清单：3 条落地建议 + 2 条避坑提醒 + 日常开运提示。`,
    `【用户具体问题】\n${question}`,
  ];

  return {
    data,
    prompt: { text: promptBlocks.filter(Boolean).join('\n\n') },
  };
}

/** 仅供前端首页与运势卡片轻量直算结构化盘面数据，跳过全量 Zod Schema 与大型 AI 摘要构建。 */
export async function fortuneDataOnly(
  source: FortuneSource,
  question: string,
  currentTime?: string,
  context?: RuntimeContext,
) {
  const effectiveTime = currentTime ?? new Date().toISOString();
  const computed = await computeFortune(source, question, effectiveTime, context);
  return buildFortuneSections(computed, 'compact').data;
}

export async function fortune(input: Input, context?: RuntimeContext) {
  const { question, currentTime, prompt: options, ...source } = input;
  const effectiveTime = currentTime ?? new Date().toISOString();
  const computed = await computeFortune(source, question, effectiveTime, context);
  const rendered = await buildSectionsAndPrompt(computed, question, options);
  const tags = [
    computed.scopeLabel,
    computed.mode === 'personalized' ? `案例：${computed.caseName || '已选档案'}` : '通用运势',
    `${computed.overview.overallTier} ${computed.overview.overallScore}分`,
  ];
  return {
    data: rendered.data,
    summary: {
      title: `${computed.targetLabel}${computed.scopeLabel}`,
      tags,
      lines: [
        computed.overview.headline,
        ...computed.overview.dimensions.map((d) => `${d.label}：${d.trend}（${d.score}分）— ${d.summary}`),
      ],
    },
    prompt: rendered.prompt,
  };
}

export async function promptForSavedFortune(
  data: unknown,
  source: FortuneSource,
  question: string,
  options?: Input['prompt'],
  currentTime?: string,
  context?: RuntimeContext,
) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('运势结果格式无效。');
  }
  const saved = data as Record<string, unknown>;
  const savedInput = (saved.input && typeof saved.input === 'object' ? saved.input : source) as FortuneSource;
  const effectiveTime = currentTime ?? new Date().toISOString();
  const computed = await computeFortune(savedInput, question, effectiveTime, context);
  const expected = await buildSectionsAndPrompt(computed, question, options);
  if (
    !sameJsonValue(saved.scope, expected.data.scope) ||
    !sameJsonValue(saved.targetLabel, expected.data.targetLabel) ||
    !sameJsonValue(saved.calendar, expected.data.calendar) ||
    !sameJsonValue(saved.overview, expected.data.overview)
  ) {
    throw new Error('运势结果与保存的输入资料不一致。');
  }
  return expected.prompt;
}
