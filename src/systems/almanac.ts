import { SolarDay, SolarTerm, SolarTime } from 'tyme4ts';
import type { z } from 'zod';
import type { almanacInput } from '../schema';
import { sameJsonValue } from '../json-value';
import { formatSchoolGuidance, type SchoolGuidanceEntry } from '../prompt-selection';
import { evaluateAlmanacSchoolAlgorithms, formatSchoolAlgorithmSection } from './school-algorithms';
import { formatClassicExcerpts, selectAlmanacClassics } from './classics';
import { participantProfile } from './almanac/participants';
import { classifyAlmanacGodSource, collectFolkTabooGods, getAlmanacSolarDayGods } from './almanac/gods';
import {
  getDailyDirections,
  getDayBranchRelations,
  getDayDuty,
  getDayTaboos,
  getDayTwelveStar,
  getDayTwentyEightStar,
  getFetusDayName,
  getHourTaboos,
  getHourTwelveStar,
  getSolarDayNineStar,
} from './almanac/rules';
import { getSolarYmdHmsPillars } from './calendar';
import { getNayin, getVoidBranches, stepSixtyCycle } from './ganzhi-foundation';
import { buildAlmanacRecommendations, evaluateBaziElementMatch, screenAlmanac } from './almanac/screening';
import { almanacTradition } from './almanac/tradition';
import { lunarDateDiscrepancy } from './birth-time';

type Input = z.infer<typeof almanacInput>;
type Source = Pick<Input, 'topic' | 'customKeyword' | 'startDate' | 'endDate' | 'page' | 'participants' | 'includeBaziMatch' | 'includeMoonPhase' | 'weekendPreference' | 'timePreferences' | 'prompt'>;
const schoolGuidance: Record<'xiejibianfang' | 'tongshu', SchoolGuidanceEntry> = {
  xiejibianfang: { label: '协纪辨方书', task: '依建除十二神、月令四时及正统宜忌条例核对吉凶宜忌，优先辨别四离四绝与岁破月破。', basis: '《钦定协纪辨方书》建除、神煞与正统择日例' },
  tongshu: { label: '民间通书', task: '结合通书常见宜忌条目、二十八宿、九星及民间避忌，对照实际事项与时辰可用性。', basis: '民间通书宜忌、二十八宿与彭祖百忌' },
};

const topics: Record<Input['topic'], { label: string; keywords: readonly string[] }> = {
  move: { label: '搬家入宅', keywords: ['入宅', '移徙'] }, marriage: { label: '订婚结婚', keywords: ['嫁娶', '纳采', '订盟'] },
  opening: { label: '开业启动', keywords: ['开市'] }, contract: { label: '签约合作', keywords: ['交易', '立券'] },
  travel: { label: '出行赴任', keywords: ['出行', '赴任'] }, medical: { label: '就医手术', keywords: ['求医', '治病'] },
  study: { label: '考试学习', keywords: ['入学'] }, burial: { label: '安葬修坟', keywords: ['安葬', '修坟', '启钻', '立碑', '入殓', '移柩', '成服', '除服'] },
  renovation: { label: '修造动土', keywords: ['修造', '动土', '竖柱', '上梁', '盖屋', '起基'] }, custom: { label: '自定义事项', keywords: [] },
};
const hourRanges = ['00:00-01:00', '01:00-03:00', '03:00-05:00', '05:00-07:00', '07:00-09:00', '09:00-11:00', '11:00-13:00', '13:00-15:00', '15:00-17:00', '17:00-19:00', '19:00-21:00', '21:00-23:00', '23:00-24:00'];
const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
function match(recommends: string[], avoids: string[], keywords: readonly string[]) {
  const support = recommends.filter((item) => keywords.some((keyword) => item.includes(keyword)));
  const caution = avoids.filter((item) => keywords.some((keyword) => item.includes(keyword)));
  const general = [...recommends, ...avoids];
  const restriction = general.includes('诸事不宜') ? '诸事不宜' : general.some((item) => /[余馀]事勿取/.test(item)) && support.length === 0 ? '余事勿取，事项未列明宜项' : null;
  return { support, caution, restriction };
}
async function calculateData(source: Source) {
  const input = { topic: source.topic, ...(source.customKeyword !== undefined ? { customKeyword: source.customKeyword } : {}), startDate: source.startDate, endDate: source.endDate, ...(source.page ? { page: source.page } : {}), ...(source.participants ? { participants: source.participants } : {}), ...(source.includeBaziMatch !== undefined ? { includeBaziMatch: source.includeBaziMatch } : {}), ...(source.includeMoonPhase !== undefined ? { includeMoonPhase: source.includeMoonPhase } : {}), ...(source.weekendPreference ? { weekendPreference: source.weekendPreference } : {}), ...(source.timePreferences ? { timePreferences: source.timePreferences } : {}), ...(source.prompt ? { prompt: source.prompt } : {}) };
  const start = Date.parse(`${input.startDate}T00:00:00Z`), end = Date.parse(`${input.endDate}T00:00:00Z`);
  const startYear = Number(input.startDate.slice(0, 4)), endYear = Number(input.endDate.slice(0, 4));
  if (!Number.isFinite(start) || !Number.isFinite(end) || startYear < 1900 || endYear > 2100) throw new Error('日期须在 1900 至 2100 年之间。');
  const diff = (end - start) / 86_400_000;
  if (diff < 0 || diff > 179) throw new Error('结束日期不得早于开始日期，一次最多比较 180 天。');
  const total = diff + 1, offset = input.page?.offset ?? 0, limit = input.page ? input.page.limit ?? 7 : total;
  if (offset >= total) throw new Error('黄历分页偏移超出原始日期范围。');
  const count = Math.min(limit, total - offset);
  const page = input.page ? { offset, limit, total, nextOffset: offset + count < total ? offset + count : null } : undefined;
  const participants = await Promise.all((input.participants ?? []).map((person, index) => participantProfile(person, index, { includeBaziMatch: input.includeBaziMatch })));
  const topic = topics[input.topic], keywords = input.topic === 'custom' ? [input.customKeyword!] : [...topic.keywords];
  const timePreferences = input.timePreferences ?? [], weekendPreference = input.weekendPreference ?? 'any';
  const fourTerminations = new Map<string, string>();
  for (let year = startYear; year <= endYear; year++) for (const index of [3, 9, 15, 21]) {
    const term = SolarTerm.fromIndex(year, index), time = term.getJulianDay().getSolarTime();
    const previous = new Date(Date.UTC(time.getYear(), time.getMonth() - 1, time.getDay() - 1));
    fourTerminations.set(previous.toISOString().slice(0, 10), term.getName());
  }
  const moonPhaseAt = input.includeMoonPhase ? (await import('./astronomy/moon-phase-evidence')).calculateCivilMoonPhaseEvidence : undefined;
  const days = Array.from({ length: count }, (_, index) => {
    const date = new Date(start + (offset + index) * 86_400_000), year = date.getUTCFullYear(), month = date.getUTCMonth() + 1, day = date.getUTCDate();
    const solarDay = SolarDay.fromYmd(year, month, day), lunar = solarDay.getLunarDay();
    const noon = SolarTime.fromYmdHms(year, month, day, 12, 0, 0), noonPillars = getSolarYmdHmsPillars(year, month, day, 12, 0, 0);
    const term = solarDay.getTerm(), termTime = term.getJulianDay().getSolarTime();
    let jieBoundary: null | { name: string; time: string; before: { year: string; month: string }; after: { year: string; month: string } } = null;
    if (['立春', '惊蛰', '清明', '立夏', '芒种', '小暑', '立秋', '白露', '寒露', '立冬', '大雪', '小寒'].includes(term.getName()) && termTime.getSolarDay().toString() === solarDay.toString()) {
      const before = getSolarYmdHmsPillars(year, month, day, 0, 0, 0);
      const after = getSolarYmdHmsPillars(year, month, day, 23, 59, 59);
      if (before.month !== after.month) jieBoundary = { name: term.getName(), time: [termTime.getHour(), termTime.getMinute(), termTime.getSecond()].map((part) => String(part).padStart(2, '0')).join(':'), before: { year: before.year, month: before.month }, after: { year: after.year, month: after.month } };
    }
    const monthGanZhi = noonPillars.month;
    const monthBranch = monthGanZhi[1];
    const dayGanZhi = noonPillars.day;
    const dayStem = dayGanZhi[0];
    const dayBranch = dayGanZhi[1];
    const { recommends, avoids } = getDayTaboos(monthBranch, dayGanZhi);
    const gods = getAlmanacSolarDayGods(solarDay, noon).map((g) => ({
      ...g,
      source: classifyAlmanacGodSource(g.name),
    }));
    for (const folkGod of collectFolkTabooGods(lunar.getMonth(), lunar.getDay(), dayGanZhi)) {
      if (!gods.some((g) => g.name === folkGod.name)) {
        gods.push({ name: folkGod.name, luck: '凶', source: classifyAlmanacGodSource(folkGod.name) });
      }
    }
    const sourceHours = lunar.getHours();
    if (sourceHours.length !== hourRanges.length) throw new Error('历法时辰资料数量异常。');
    const hours = sourceHours.map((hour, i) => {
      const ganzhi = hour.getSixtyCycle().getName();
      const expected = [...'子丑寅卯辰巳午未申酉戌亥子'][i];
      if (!ganzhi.endsWith(expected)) throw new Error('历法时辰地支与时段不一致。');
      const effectiveDayGanZhi = i === 12 ? stepSixtyCycle(dayGanZhi, 1) : dayGanZhi;
      const { recommends: hourRecommends, avoids: hourAvoids } = getHourTaboos(effectiveDayGanZhi, expected);
      const hourMatch = match(hourRecommends, hourAvoids, keywords);
      const withinWorkHours = !timePreferences.includes('work-hours') || '巳午未申'.includes(expected);
      const hasDaypartPreference = timePreferences.includes('morning') || timePreferences.includes('afternoon');
      const preferredTime = !hasDaypartPreference || (timePreferences.includes('morning') && '辰巳午'.includes(expected)) || (timePreferences.includes('afternoon') && '未申酉'.includes(expected));
      const hourBaziMatch = input.includeBaziMatch ? evaluateBaziElementMatch(ganzhi, participants) : undefined;
      return { name: i === 0 ? '早子时' : i === 12 ? '晚子时' : `${expected}时`, range: hourRanges[i], ganzhi, twelveStar: getHourTwelveStar(effectiveDayGanZhi[1], expected), recommends: hourRecommends, avoids: hourAvoids, match: hourMatch,
        screening: screenAlmanac(hourMatch, expected, participants, { scope: 'hour' }), ...(hourBaziMatch ? { baziMatch: hourBaziMatch } : {}), preference: { withinWorkHours, preferredTime } };
    });
    const dateKey = date.toISOString().slice(0, 10), fourTermination = fourTerminations.get(dateKey) ?? null;
    const phase = moonPhaseAt?.(Date.parse(`${dateKey}T04:00:00Z`));
    const moonPhase = phase ? { utcDateTime: phase.utcDateTime, eightPhaseName: phase.eightPhaseName, waxing: phase.waxing,
      phaseAngleDegrees: phase.phaseAngleDegrees, illuminationFraction: phase.illuminationFraction,
      previous: { name: phase.previousPrincipalPhase.name, utcDateTime: phase.previousPrincipalPhase.utcDateTime },
      ...(phase.currentPrincipalPhase ? { current: { name: phase.currentPrincipalPhase.name, utcDateTime: phase.currentPrincipalPhase.utcDateTime } } : {}),
      next: { name: phase.nextPrincipalPhase.name, utcDateTime: phase.nextPrincipalPhase.utcDateTime } } : undefined;
    const dayMatch = match(recommends, avoids, keywords), fourSeparation = gods.some((god) => god.name === '四离');
    const special = input.topic === 'custom' ? [] : [...(fourTermination ? [`四绝（${fourTermination}前一日）：当前预设事项列为传统限制`] : []), ...(fourSeparation ? ['四离：当前预设事项列为传统限制'] : [])];
    const eligibleHours = hours.filter((hour) => hour.preference.withinWorkHours);
    const noUsableHours = !eligibleHours.some((hour) => hour.screening.status !== '有明确限制');
    const screening = screenAlmanac(dayMatch, dayBranch, participants, { scope: 'day', special, noUsableHours, ...(jieBoundary ? { boundary: `${jieBoundary.name} ${jieBoundary.time}交节，需核对具体时刻` } : {}) });
    const isWeekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
    const twentyEightStar = getDayTwentyEightStar(date.getUTCDay(), dayBranch);
    const nineStar = getSolarDayNineStar(solarDay);
    const branchRel = getDayBranchRelations(dayBranch);
    const tradition = almanacTradition(noonPillars.year[1], dayGanZhi);
    const lunarDateWarning = lunarDateDiscrepancy({ year, month, day });
    const dayBaziMatch = input.includeBaziMatch ? evaluateBaziElementMatch(dayGanZhi, participants) : undefined;
    return { date: dateKey, weekday: weekdays[date.getUTCDay()], lunarDate: lunar.toString(), ...(lunarDateWarning ? { lunarDateWarning } : {}), jieBoundary, fourTermination, ...(moonPhase ? { moonPhase } : {}),
      ganzhi: { year: noonPillars.year, month: noonPillars.month, day: noonPillars.day },
      dayOfficer: getDayDuty(monthBranch, dayBranch), twelveStar: getDayTwelveStar(monthBranch, dayBranch), twentyEightStar: twentyEightStar.name, nineStar: nineStar.name,
      traditionalFacts: {
        nayin: getNayin(dayGanZhi),
        kongWang: getVoidBranches(dayGanZhi),
        fetusGod: getFetusDayName(dayGanZhi),
        dailyDirections: getDailyDirections(dayStem),
        twentyEightStar,
        nineStar, ...tradition },
      clash: `冲${branchRel.oppositeBranch}，煞${branchRel.ominous}`, recommends, avoids, match: dayMatch, gods, screening, ...(dayBaziMatch ? { baziMatch: dayBaziMatch } : {}),
      preference: { isWeekend, matchesWeekend: weekendPreference === 'any' || (weekendPreference === 'prefer' ? isWeekend : !isWeekend) }, hours };
  });
  const recommendations = buildAlmanacRecommendations(days);
  const lunarWarnings = [...new Set(days.map((day) => day.lunarDateWarning).filter((w): w is string => Boolean(w)))];
  return { input, ...(page ? { page } : {}), topicLabel: topic.label, keywords, preferences: { weekendPreference, timePreferences }, days, participants, recommendations, limitations: ['日期按北京时间正午历法取日；时辰按北京时间，早晚子时分别列出。交节日的正午日历事实不适用于全部时刻，须按交节前后核对。', '初筛与综合分级结合原始宜忌、四离四绝、岁破月破等核心神煞、建除黄黑道及参与人年支日支关系；逐时状态须与当日状态一并核对。', ...(moonPhaseAt ? ['月相仅为北京时间正午的天文背景，不参与初筛；几何照明不代表实际可见性，四正事件求根分辨率不等于观测精度。'] : []), ...lunarWarnings, '事项关键词及地支关系不代表现实结果；就医应以医嘱和病情为先。'] };
}
type Data = Awaited<ReturnType<typeof calculateData>>;
function render(data: Data, question: string, options: Input['prompt']) {
  const matchText = (fact: Data['days'][number]['match']) => `宜项命中${fact.support.join('、') || '无'}；忌项命中${fact.caution.join('、') || '无'}${fact.restriction ? `；${fact.restriction}` : ''}`;
  const requested = options?.dates;
  if (requested?.some((date) => !data.days.some((day) => day.date === date))) throw new Error(data.page ? '提示词日期须在当前结果页内。' : '提示词日期须在原始结果范围内。');
  const selected = requested ? data.days.filter((day) => requested.includes(day.date)) : data.days;
  const formatMoonPhase = (phase: Data['days'][number]['moonPhase']) => phase
    ? `\n北京时间正午月相背景：${phase.eightPhaseName}（${phase.waxing ? '盈' : '亏'}），月相角${phase.phaseAngleDegrees.toFixed(2)}°，几何照明${(phase.illuminationFraction * 100).toFixed(1)}%；前一四正${phase.previous.name} UTC ${phase.previous.utcDateTime}，${phase.current ? `当前四正${phase.current.name} UTC ${phase.current.utcDateTime}，` : ''}下一四正${phase.next.name} UTC ${phase.next.utcDateTime}。`
    : '';
  const mode = options?.detailMode ?? (selected.length > 7 ? 'compact' : 'full');
  const hourMatchText = (fact: Data['days'][number]['hours'][number]['match']) => {
    const parts = [
      fact.support.length ? `宜:${fact.support.join('、')}` : '',
      fact.caution.length ? `忌:${fact.caution.join('、')}` : '',
      fact.restriction ?? '',
    ].filter(Boolean);
    return parts.length ? parts.join('，') : '宜忌无命中';
  };
  const formatHours = (hours: Data['days'][number]['hours']) => {
    if (mode === 'full') {
      return hours.map((hour) => {
        const rangeStr = hour.name === '早子时' || hour.name === '晚子时' ? hour.range : '';
        const screenStr = hour.screening.status === '未见已列限制'
          ? '无限制'
          : `${hour.screening.status}${hour.screening.reasons.length ? `(${hour.screening.reasons.map((r) => r.text).join('、')})` : ''}`;
        return `${hour.name}${rangeStr} ${hour.ganzhi}［${hourMatchText(hour.match)}｜${screenStr}${!hour.preference.withinWorkHours ? '｜工作时间外' : ''}${!hour.preference.preferredTime ? '｜非优先' : ''}］`;
      }).join('；');
    }
    return (['未见已列限制', '需要核对', '有明确限制'] as const).flatMap((status) => {
      const items = hours.filter((hour) => hour.screening.status === status).map((hour) =>
        `${hour.name}${!hour.preference.withinWorkHours ? '〔工作时间外〕' : ''}${!hour.preference.preferredTime ? '〔非优先〕' : ''}`);
      return items.length ? [`${status}：${items.join('、')}`] : [];
    }).join('；');
  };
  const days = selected.map((day, idx) => {
    const screeningReasonText = day.screening.reasons.length ? `（${day.screening.reasons.map((reason) => reason.text).join('；')}）` : '';
    const baziDayText = day.baziMatch ? `八字喜忌：${day.baziMatch.summary}。` : '';
    const overview = `${day.date} ${day.weekday} ${day.lunarDate} ${day.ganzhi.day}日（${day.traditionalFacts.nayin}，旬空${day.traditionalFacts.kongWang.join('')}） ${day.dayOfficer}日 ${day.twelveStar} ${day.clash}：${matchText(day.match)}。初筛${day.screening.status}${screeningReasonText}；${baziDayText}${data.preferences.weekendPreference === 'any' ? '周末不限' : `${day.preference.matchesWeekend ? '符合' : '不符合'}周末偏好`}。${day.fourTermination ? `四绝：${day.fourTermination}前一日，${data.input.topic === 'custom' ? '自定义事项须逐项核对' : '当前预设事项列为传统限制'}。` : ''}${day.jieBoundary ? `${day.jieBoundary.name}于北京时间${day.jieBoundary.time}交节；前为${day.jieBoundary.before.year}年${day.jieBoundary.before.month}月，后为${day.jieBoundary.after.year}年${day.jieBoundary.after.month}月，正午事实需按具体时刻核对。` : ''}`;
    const showAnnualDirs = idx === 0 || day.ganzhi.year !== selected[idx - 1].ganzhi.year;
    const dirs = day.traditionalFacts.dailyDirections;
    const dailyDirText = `吉神方：喜神${dirs.joy}、财神${dirs.wealth}、福神${dirs.mascot}、阳贵${dirs.yangGui}、阴贵${dirs.yinGui}；胎神：${day.traditionalFacts.fetusGod}`;
    const annualDirText = showAnnualDirs ? `。年方位（${day.ganzhi.year}年）：${day.traditionalFacts.annualDirections.map((god) => `${god.name}${god.branch}${god.direction}`).join('、')}` : '';
    const tradition = mode === 'full' ? `\n值日神煞：${day.gods.map((god) => `${god.name}（${god.luck}${god.source === 'tongshu-folk' ? '·通书' : ''}）`).join('、') || '未列'}。生肖：${day.traditionalFacts.zodiac}年；二十八宿：${day.traditionalFacts.twentyEightStar.name}${day.traditionalFacts.twentyEightStar.element}${day.traditionalFacts.twentyEightStar.animal}、${day.traditionalFacts.twentyEightStar.direction}方（${day.traditionalFacts.twentyEightStar.luck}）；九星：${day.traditionalFacts.nineStar.fullName}（${day.traditionalFacts.nineStar.color}${day.traditionalFacts.nineStar.wuxing}、${day.traditionalFacts.nineStar.dipper}、${day.traditionalFacts.nineStar.direction}）。${dailyDirText}。彭祖传统避忌：${day.traditionalFacts.pengzu.stem}，${day.traditionalFacts.pengzu.branch}${annualDirText}。` : '';
    return `${overview}${tradition}${formatMoonPhase(day.moonPhase)}\n时辰${mode === 'compact' ? '初筛' : ''}：${formatHours(day.hours)}`;
  });
  const participantText = data.participants.map((participant) => {
    const variants = participant.variants.map((variant, i) => `候选${i + 1}：年支${variant.yearBranch}、日支${variant.dayBranch}${variant.intervals.length ? `；${variant.intervals.map((interval) => `${new Date(interval.startTimestamp).toISOString()}至${new Date(interval.endTimestamp).toISOString()}（不含终点）`).join('、')}` : ''}`).join('；');
    const relations = participant.relationsByBranch.map((item) => `${item.candidateBranch}支（${item.stability}）：${item.outcomes.map((outcome, i) => `候选${i + 1}${outcome.conflicts.map((conflict) => `${conflict.scope === 'year' ? '年' : '日'}支${conflict.targetBranch}${conflict.type}${'detail' in conflict ? `（${conflict.detail}）` : ''}`).join('、') || '未见直接刑冲破害'}`).join(' / ')}`).join('；');
    const baziText = participant.baziUsefulGod
      ? `\n八字喜忌（日主${participant.baziUsefulGod.dayMaster}${participant.baziUsefulGod.dayMasterElement}）：喜用${participant.baziUsefulGod.favorable.join('、') || '无'}；避忌${participant.baziUsefulGod.unfavorable.join('、') || '无'}。`
      : participant.baziUsefulGodNote
        ? `\n八字喜忌：${participant.baziUsefulGodNote}`
        : '';
    return `${participant.name}（${participant.basis.precision}${participant.basis.excludedSeconds ? `；排除${participant.basis.excludedSeconds}秒` : ''}）：${variants}。${baziText}\n${relations}。${participant.limitation}`;
  });
  const pageText = data.page ? `本页为第${data.page.offset + 1}至${data.page.offset + data.days.length}天，共${data.page.total}天；${data.page.nextOffset === null ? '已到最后一页' : `下一页 page.offset=${data.page.nextOffset}，page.limit=${data.page.limit}`}。` : '';
  const schools = formatSchoolGuidance(options?.schools, schoolGuidance);
  const classics = options?.includeClassics
    ? formatClassicExcerpts(selectAlmanacClassics(selected.map((day) => day.dayOfficer)))
    : '';
  const rec = data.recommendations;
  const recommendationText = [
    `【综合择日分级与吉时推荐】`,
    `优选日期（${rec.preferredDays.length}天）：${rec.preferredDays.slice(0, 5).map((d) => `${d.date}（${d.weekday}，${d.dayOfficer}日，${d.huangdao ? '黄道' : '黑道'}${d.keyAuspiciousGods.length ? `，吉神${d.keyAuspiciousGods.join('、')}` : ''}；推荐时辰：${d.bestHours.map((h) => `${h.name}${h.huangdao ? '〔黄道〕' : ''}`).join('、') || '无'}）`).join('；') || '无'}`,
    `次选日期（${rec.secondaryDays.length}天）：${rec.secondaryDays.slice(0, 5).map((d) => `${d.date}（${d.weekday}，${d.dayOfficer}日；可用时辰：${d.bestHours.map((h) => h.name).join('、') || '无'}）`).join('；') || '无'}`,
    `慎用日期（${rec.cautionDays.length}天）：${rec.cautionDays.slice(0, 5).map((d) => `${d.date}${d.majorTabooGods.length ? `（犯${d.majorTabooGods.join('、')}）` : ''}`).join('、') || '无'}`,
    rec.rule,
  ].join('\n');
  const text = [`【黄历择日基础资料】\n事项：${data.topicLabel}${data.input.customKeyword ? `（${data.input.customKeyword}）` : ''}；匹配关键词：${data.keywords.join('、')}。计算范围：${data.input.startDate}至${data.input.endDate}；${pageText}提示词列出${selected.length}天${requested ? `，其余${data.days.length - selected.length}天未列入` : data.page ? '（本页全部日期）' : '（全部日期）'}。周末偏好：${{ any: '不限', prefer: '优先周末', avoid: '避开周末' }[data.preferences.weekendPreference]}；时段偏好：${data.preferences.timePreferences.map((value) => ({ 'work-hours': '工作时间', morning: '上午优先', afternoon: '下午优先' })[value]).join('、') || '不限'}。`,
    recommendationText,
    ...(mode === 'compact' ? [`【简版说明】\n保留所选全部日期和每个时辰的初筛状态及偏好标记；未展开时辰宜忌、限制原因和传统历注，不能据此断定时辰适宜。须与当日初筛一并核对，不得推测未列原因。北京时间时段：${selected[0].hours.map((hour) => `${hour.name}${hour.range}`).join('、')}。可用 prompt.dates 选择日期，或以 prompt.detailMode=full 展开完整提示词；完整资料见结构化结果。`] : []),
    `【逐日及时辰】\n${days.join('\n')}`,
    `【参与人地支关系】\n${participantText.join('\n') || '未提供参与人，不作个人化关系判断。'}\n将各候选日支或时支与上表同名地支对应，保留不同时段的条件。`,
    formatSchoolAlgorithmSection(evaluateAlmanacSchoolAlgorithms(data, options?.schools)),
    schools,
    classics,
    `【限制与任务】\n${data.limitations.join('\n')}\n${data.page ? '只比较本页所列日期，其他日期需继续获取；' : ''}请逐日说明支持、限制与尚缺资料，不能将关键词未命中称为适宜，也不能忽视宜忌同时命中。`,
    `【问题】\n${question}`].filter(Boolean).join('\n\n');
  return { text };
}
export async function almanac(input: Input) {
  const data = await calculateData(input);
  const lunarWarnings = [...new Set(data.days.map((day) => day.lunarDateWarning).filter((w): w is string => Boolean(w)))];
  return { data, summary: { title: '黄历择日', lines: [`事项：${data.topicLabel}`, data.page ? `本页：${data.days.length} / ${data.page.total} 天；${data.page.nextOffset === null ? '最后一页' : `下一页偏移 ${data.page.nextOffset}`}` : `日期：${data.days.length} 天`, `参与人：${data.participants.length} 位`, ...lunarWarnings] }, prompt: render(data, input.question, input.prompt) };
}
export async function promptForSavedAlmanac(data: unknown, source: Source, question: string, options?: Input['prompt']) {
  const expected = await calculateData(source);
  if (!sameJsonValue(data, expected)) throw new Error('黄历结果与原始资料不一致。');
  return render(expected, question, options ?? source.prompt);
}
