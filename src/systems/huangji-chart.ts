import type { z } from 'zod';
import type { huangjiInput } from '../schema';
import { sameJsonValue } from '../json-value';
import { formatSchoolGuidance, resolvePromptSelection } from '../prompt-selection';
import { formatClassicExcerpts, selectHuangjiClassics } from './classics';
import { calculateCycle } from './huangji/cycle';
import { calculateHuangjiDateTimeForecast } from './huangji/datetime';
import { calculateHuangjiSixDayCycleFromDate, parseHuangjiSixDayDateTime } from './huangji/six-day';
import { civilYearToSerial, formatHuangjiCivilYear } from './huangji/standard';
import hexagrams from './huangji-hexagrams.json';
import reference from './huangji-reference.json';
import { assertRangePillars, parseDivinationRange, partitionDivinationRange } from './divination-range';
import { getDivinationTime } from './calendar';

type Input = z.infer<typeof huangjiInput>;
type Settings = Exclude<Input['huangji'], { mode: 'reference' }>;
type ChartInput = Input & { huangji: Settings };
const schools = {
  yuanhui: { label: '元会运世法', task: '以元、会、运、世的时间层级定位当前阶段，再结合已提供的值年卦观察长期与年度主题。', basis: '《皇极经世》的元会运世时间体系资料。' },
  guaqi: { label: '值年卦气法', task: '以实际提供的值年卦、互卦、错卦、综卦及所列变爻为主线，结合卦气与时间位置分析。', basis: '《皇极经世》值年卦与传统卦气资料。' },
};

async function calculate(settings: Settings) {
  if (settings.mode === 'year') return calculateCycle({ year: settings.year });
  if (settings.mode === 'coordinate') return calculateCycle({ epochYear: settings.epochYear, year: settings.year, elapsedYears: settings.elapsedYears });
  if (settings.mode === 'six-day') {
    const sixDayDate = parseHuangjiSixDayDateTime(settings.dateTime, settings.timezone, settings.timeZoneId, settings.calendarModel, settings.epochDateTime);
    const sixDayCycle = calculateHuangjiSixDayCycleFromDate(sixDayDate);
    const cycle = calculateCycle({ year: sixDayCycle.calendar.targetYear });
    return {
      ...cycle,
      input: { ...cycle.input, mode: '六日逐爻公历' as const },
      calculationChain: [...cycle.calculationChain, ...sixDayCycle.calculationChain],
      limitations: [...cycle.limitations, ...sixDayCycle.limitations],
      sixDayCycle,
    };
  }
  if (!settings.date) throw new Error('皇极经世年月日时模式缺少起盘时刻。');
  const actual = new Date(settings.date);
  const correction = settings.timeStandard === 'true-solar' ? (await import('./astronomy/true-solar')).trueSolarTime(actual, settings.longitude!) : undefined;
  const dateTimeForecast = calculateHuangjiDateTimeForecast(correction ? new Date(correction.effectiveTimestamp) : actual, correction ? actual : undefined);
  const cycle = calculateCycle({ year: dateTimeForecast.calendar.forecastYear });
  return {
    ...cycle,
    input: { ...cycle.input, mode: '年月日时' as const },
    calculationChain: [...cycle.calculationChain, ...dateTimeForecast.calculationChain],
    limitations: [...cycle.limitations, ...dateTimeForecast.limitations],
    dateTimeForecast,
    ...(correction ? { timeContext: { standard: 'true-solar' as const, longitude: correction.longitude, referenceTimestamp: actual.getTime(), longitudeCorrectionMinutes: correction.longitudeCorrectionMinutes, equationOfTimeMinutes: correction.equationOfTimeMinutes, totalCorrectionMinutes: correction.totalCorrectionMinutes } } : {}),
  };
}
type Chart = Awaited<ReturnType<typeof calculate>>;

function lines(id: number) {
  const hexagram = hexagrams.find((item) => item.id === id);
  if (!hexagram) throw new Error('皇极卦画资料无效。');
  const positions = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'];
  const bottomUp = hexagram.binarySymbol.slice(3) + hexagram.binarySymbol.slice(0, 3);
  return `${hexagram.name}：${[...bottomUp].map((line, index) => `${positions[index]}${line === '1' ? '阳' : '阴'}`).join('、')}`;
}

function buildPrompt(chart: Chart, question: string, options: Input['prompt'], now: string) {
  const { input, position, progress, forecast } = chart;
  const dateTime = 'dateTimeForecast' in chart ? chart.dateTimeForecast : undefined;
  const sixDay = 'sixDayCycle' in chart ? chart.sixDayCycle : undefined;
  const year = (value: number) => input.calendar === '公元纪年（无公元0年）' ? formatHuangjiCivilYear(value) : String(value);
  const selection = resolvePromptSelection('huangji-jingshi', options);
  const selectedSchools = formatSchoolGuidance(options?.schools, schools);
  const cycle = [
    `模式：${input.mode}；纪年口径：${input.calendar}；纪元：${year(input.epochYear)}；目标年：${year(input.year)}；已过${input.elapsedYears}年。`,
    `元：第${position.yuan.indexFromEpoch}元，${year(position.yuan.startYear)}至${year(position.yuan.endYear)}；会：第${position.hui.indexInYuan}会，${year(position.hui.startYear)}至${year(position.hui.endYear)}。`,
    `运：本元第${position.yun.indexInYuan}运、本会第${position.yun.indexInHui}运，${year(position.yun.startYear)}至${year(position.yun.endYear)}。`,
    `世：本元第${position.shi.indexInYuan}世、本运第${position.shi.indexInYun}世，${year(position.shi.startYear)}至${year(position.shi.endYear)}。`,
    `年：本世第${position.year.indexInShi}年、本元第${position.year.indexInYuan}年；本世尚余${progress.shi.remainingYearsAfterCurrent}个完整年，下一世始于${year(progress.shi.nextCycleStartYear)}，下一运始于${year(progress.yun.nextCycleStartYear)}。`,
  ].join('\n');
  const annual = forecast && (() => {
    const h = forecast.hexagrams;
    const periods = [['会内统卦', h.governing], ['运卦', h.yun], ['六十年统卦', h.sixtyYear], ['十年卦', h.decade]] as const;
    return [
      `先天圆图以${forecast.model.annualAnchorYear}年${forecast.model.annualAnchorHexagram}卦为锚点；${forecast.hui.branch}会。`,
      ...periods.map(([label, period]) => `${label}：${period.hexagram.name}（${year(period.startYear)}至${year(period.endYear)}）；卦辞：${period.hexagram.judgment}${period.changedLine ? `；由${period.derivedFrom}第${period.changedLine}爻变得${period.normalizedFrom ? `，先得${period.normalizedFrom}卦，再依六十卦序调整` : ''}${period.changedLineText ? `；变爻原文：${period.changedLineText}` : ''}` : ''}。`),
      `值年卦：${h.annual.name}（${h.annual.ganzhi}，${h.annual.symbol}，${h.annual.upper}上${h.annual.lower}下）；卦辞：${h.annual.judgment}。`,
      `值年取序：从${year(h.sixtyYear.startYear)}的六十年统卦${h.sixtyYear.hexagram.name}按六十卦圆图顺行${civilYearToSerial(h.annual.year) - civilYearToSerial(h.sixtyYear.startYear)}位取得本年卦；十年取卦另以六十年统卦为起点。`,
      `值年卦爻象：${lines(h.annual.id)}。`,
      Object.entries(forecast.relatedHexagrams).map(([key, hexagram]) => `${({ mutual: '互卦', opposite: '错卦', reversed: '综卦' } as Record<string, string>)[key]}：${hexagram.name}（卦辞：${hexagram.judgment}）`).join('；') + '。',
      chart.eraTrend?.summary ?? '',
    ].filter(Boolean).join('\n');
  })();
  const timeDetails = dateTime && (() => {
    const { civilTime: time, calendar, hexagrams: h } = dateTime;
    const dayInJing = ((calendar.dayOfYear - 1) % 60) + 1;
    const jingStart = calendar.dayOfYear - dayInJing + 1;
    const xunStart = Math.floor((dayInJing - 1) / 10) * 10 + 1;
    const derived = [['月经卦', h.monthJing], ['旬纬卦', h.xunWei], ['日卦', h.daily], ['时经卦', h.hourJing]] as const;
    return [
      'timeContext' in chart && chart.timeContext
        ? `真太阳时钟表：${time.dateTime}（按北京时间钟表口径）；实际占时：${time.termReferenceDateTime}（${time.timezone}）；经度${chart.timeContext.longitude}°，经度修正${chart.timeContext.longitudeCorrectionMinutes.toFixed(3)}分钟，均时差${chart.timeContext.equationOfTimeMinutes.toFixed(3)}分钟。节气、皇极年及日序依据实际占时，时段依据真太阳时钟表。`
        : `起盘时间：${time.dateTime}（${time.timezone}）。`,
      `皇极历位：${year(calendar.forecastYear)}，${calendar.monthBranch}月第${calendar.dayOfMonth}日，${calendar.activeSolarTerm}后实际第${calendar.actualDayInSolarTerm}日；映射为本节气第${calendar.mappedDayInSolarTerm}日、皇极年内第${calendar.dayOfYear}日。`,
      `月经卦统皇极年内第${jingStart}至${jingStart + 59}日，当前为本月经第${dayInJing}日；旬纬卦统本月经第${xunStart}至${xunStart + 9}日，当前为本旬第${dayInJing - xunStart + 1}日。`,
      `日卦从月经卦${h.monthJing.shortName}${h.daily.sequenceStart !== h.monthJing.shortName ? `接续${h.daily.sequenceStart}入` : '入'}六十卦序，顺行${h.daily.sequenceOffset}位；时经卦对应${calendar.hourRange}。`,
      ...derived.map(([label, hexagram]) => `${label}：${hexagram.name}${hexagram.changedLine ? `（由${hexagram.derivedFrom}第${hexagram.changedLine}爻变得）` : ''}；卦辞：${hexagram.judgment}；爻象：${lines(hexagram.id)}。`),
    ].join('\n');
  })();
  const sixDayDetails = sixDay && (() => {
    const { civilTime: time, calendar, anchor, hexagrams: h } = sixDay;
    const mapping = sixDay.model === '书绪言六日逐爻·显式历元'
      ? [
          `显式历元：${sixDay.anchor.dateTime}（真实瞬时${sixDay.anchor.utcDateTime}）为经校定的当地子半起点。`,
          `从历元到目标当地日期经过${sixDay.calendar.actualElapsedDays}个完整公历日；实际 UTC 瞬时相隔${sixDay.calendar.actualElapsedSeconds}秒，直接定位三百六十日中的第${sixDay.dayOfCycle}日。`,
        ]
      : [
          `现代冬至岁周换算模型：以${sixDay.anchor.dateTime}的冬至真实瞬时确定${sixDay.calendar.targetYear}岁周，该瞬时在目标地点为${sixDay.anchor.localDateTime}。`,
          `${sixDay.anchor.dayBoundary}锚点：${sixDay.anchor.dayStartDateTime}（真实瞬时${sixDay.anchor.dayStartUtcDateTime}）；至下一冬至当地日首点实际跨度为${sixDay.calendar.yearLengthMilliseconds}毫秒，按三百六十逻辑日比例映射。`,
          `实际经过${sixDay.calendar.actualElapsedSeconds}秒；逻辑位置${sixDay.calendar.logicalPosition.toFixed(9)}日，即第${sixDay.calendar.logicalElapsedDays + 1}个逻辑日的${sixDay.calendar.logicalDayFraction.toFixed(9)}。`,
          ...(sixDay.calendar.endpointClamped ? ['下一冬至当地日首点已到、冬至真实瞬时尚未到，当前仍属上一岁周，逻辑位置封顶于上一岁周末端。'] : []),
          `冬至所在当地公历日干支：${sixDay.anchor.dayGanZhi}。`,
        ];
    return [
      `六日逐爻公历时间：${time.dateTime}（真实瞬时${time.utcDateTime}${time.timeZoneId ? `，${time.timeZoneId}` : ''}）。`,
      ...mapping,
      `值年背景按目标真实瞬时的北京时间冬至换年，取${year(calendar.targetYear)}；周期第${sixDay.dayOfCycle}日，经卦第${sixDay.dayLine}爻当日，${sixDay.hourRange}对应第${sixDay.hourLine}爻。`,
      ...([['经卦', h.jing], ['当日变卦', h.daily], ['时变卦', h.hourly]] as const).map(([label, hexagram]) => `${label}：${hexagram.name}；卦辞：${hexagram.judgment}；爻象：${lines(hexagram.id)}。`),
      `时段依据：当地钟表自子半起每四小时一爻；${time.hour}时属于${sixDay.hourRange}。`,
      `资料来源：${sixDay.sources.map((item) => `${item.title}：${item.scope}`).join('；')}`,
    ].join('\n');
  })();
  const user = [
    '【传统依据】\n按一元十二会、一会三十运、一运十二世、一世三十年的周期定位；通行公元年另依先天圆图推值年卦。',
    `【时间】\n提示词时间：${now}。`,
    `【周期资料】\n${cycle}`,
    annual ? `【值年卦及层级】\n${annual}` : '【资料限制】\n自定义纪元只计算周期坐标，没有通行值年卦，不得虚构卦象。',
    timeDetails ? `【年月日时卦】\n${timeDetails}` : '',
    sixDayDetails ? `【六日逐爻】\n${sixDayDetails}` : '',
    `【适用边界】\n${chart.limitations.join('\n')}`,
    selection ? `【解读选择】\n${selection.section}` : '',
    selectedSchools,
    options?.includeClassics ? `【经典依据】\n${reference.classics.map((item) => `《${item.book}》·${item.chapter}：${item.summary}\n适用条件：${item.application}`).join('\n')}` : '',
    options?.includeClassics ? formatClassicExcerpts(selectHuangjiClassics(), '典籍片段') : '',
    `【任务】\n${sixDay ? '以六日逐爻经卦、当日变卦与四小时段时变卦为当前时点的主要取象，以值年卦、十年卦、六十年统卦、运卦和会内统卦交代长期背景。' : dateTime ? '以时经卦与日卦为当前时点的主要取象，以旬纬、月经和值年卦说明近远层级，再结合十年卦、六十年统卦、运卦和会内统卦交代长期背景。' : forecast ? '以值年卦为主，结合十年卦、六十年统卦、运卦和会内统卦逐层解释问题；个人事项结合现实背景作条件化分析。' : '依据周期坐标说明层级、当前进度与下一周期边界；纪元由调用方指定。'}${selection ? `\n${selection.task}` : ''}`,
    `【问题】\n${question}`,
  ].filter(Boolean).join('\n\n');
  return { text: user };
}

type Range = NonNullable<Input['range']>;
type DateTimeSettings = Extract<Settings, { mode: 'datetime' }>;
type HuangjiRange = { kind: 'range'; input: { range: Range; huangji: DateTimeSettings }; source: { startTimestamp: number; endTimestamp: number; endExclusive: true; timezone: 'UTC+08:00' }; status: 'stable' | 'conditional'; branches: Array<{ startTimestamp: number; endTimestamp: number; endExclusive: true; chart: Chart }> };

function chartFacts(chart: Chart) {
  if (!('dateTimeForecast' in chart) || !chart.dateTimeForecast) throw new Error('皇极范围缺少年月日时盘面。');
  const { calculationChain: _chain, dateTimeForecast, timeContext: _context, ...facts } = chart;
  const { civilTime: _clock, calculationChain: _timeChain, ...forecast } = dateTimeForecast;
  return JSON.stringify({ ...facts, dateTimeForecast: forecast });
}

export async function generateHuangjiRange(range: Range, settings: DateTimeSettings): Promise<HuangjiRange> {
  const { start, end } = parseDivinationRange(range, '皇极经世');
  if (settings.date) throw new Error('皇极经世范围起盘不能同时提供单一时刻。');
  const make = async (timestamp: number) => {
    const actual = new Date(timestamp), chart = await calculate({ ...settings, date: actual.toISOString() });
    if (range.pillars) {
      const corrected = 'timeContext' in chart && chart.timeContext ? (await import('./astronomy/true-solar')).trueSolarTime(actual, chart.timeContext.longitude).effectiveTimestamp : timestamp;
      const clock = getDivinationTime(new Date(corrected)).ganzhi, term = getDivinationTime(actual).ganzhi;
      assertRangePillars(range.pillars, { ...clock, year: term.year, month: term.month }, '皇极经世');
    }
    return chart;
  };
  const segments = await partitionDivinationRange({ start, end }, settings, { label: '皇极经世', calculate: make, fingerprint: chartFacts,
    termOffsetsDays: Array.from({ length: 17 }, (_, index) => index), clockHours: [0, 1, 3, 4, 5, 7, 8, 9, 11, 12, 13, 15, 16, 17, 19, 20, 21, 23] });
  const branches = segments.map(({ startTimestamp, endTimestamp, endExclusive, first }) => ({ startTimestamp, endTimestamp, endExclusive, chart: first }));
  return { kind: 'range', input: { range, huangji: settings }, source: { startTimestamp: start, endTimestamp: end, endExclusive: true, timezone: 'UTC+08:00' }, status: branches.length === 1 ? 'stable' : 'conditional', branches };
}

function rangePrompt(range: HuangjiRange, question: string, options: Input['prompt'], now: string) {
  const format = (timestamp: number) => `${new Date(timestamp + 8 * 3_600_000).toISOString().slice(0, 19).replace('T', ' ')}（北京时间）`;
  const sections = range.branches.map((branch, index) => `【分支 ${index + 1}】\n${format(branch.startTimestamp)} 至 ${format(branch.endTimestamp)}（起点含、终点不含）；以下盘面时间为该分支起点的代表时刻。\n${buildPrompt(branch.chart, question, options, now).text}`);
  const standard = range.input.huangji.timeStandard === 'true-solar' ? `真太阳时（经度 ${range.input.huangji.longitude}°）` : '北京时间';
  const text = [`【时间范围】\n${format(range.source.startTimestamp)} 至 ${format(range.source.endTimestamp)}（起点含、终点不含）；按${standard}确定时段，节气和皇极日序依据实际起盘时刻。`, ...sections,
    '【范围任务】\n分别比较各分支的共同点和差异，结论须标明适用时间段；不能把某一分支起点当作确定起盘时刻。'].join('\n\n');
  return { text };
}

export async function promptForHuangjiRange(data: unknown, input: ChartInput, now: string) {
  if (!data || typeof data !== 'object' || !input.range || input.huangji.mode !== 'datetime') throw new Error('皇极经世范围结果缺少有效区间。');
  const saved = data as HuangjiRange;
  if (saved.kind !== 'range' || !saved.input || !Array.isArray(saved.branches)) throw new Error('皇极经世范围结果缺少原始输入或分支。');
  const expected = await generateHuangjiRange(input.range, input.huangji);
  if (!sameJsonValue(saved, expected)) throw new Error('皇极经世范围结果与原始输入不一致。');
  return rangePrompt(expected, input.question, input.prompt, now);
}

export async function huangjiChart(input: ChartInput, now: string) {
  if (input.range) {
    if (input.huangji.mode !== 'datetime') throw new Error('皇极范围仅支持年月日时模式。');
    const data = await generateHuangjiRange(input.range, input.huangji);
    return { data, summary: { title: '皇极经世范围起盘', tags: [data.status === 'stable' ? '盘面稳定' : '条件分支', `${data.branches.length} 段`],
      lines: data.branches.map((branch, index) => `分支 ${index + 1}：${new Date(branch.startTimestamp).toISOString()} 至 ${new Date(branch.endTimestamp).toISOString()}（终点不含）`) },
      prompt: rangePrompt(data, input.question, input.prompt, now) };
  }
  const chart = await calculate(input.huangji);
  return {
    data: { input: input.huangji, chart },
    summary: {
      title: '皇极经世',
      tags: [`模式：${chart.input.mode}`, `目标年：${chart.input.year}`, ...(chart.forecast ? [`值年卦：${chart.forecast.hexagrams.annual.name}`] : [])],
      lines: [`元：${chart.position.yuan.indexFromEpoch}；会：${chart.position.hui.indexInYuan}；运：${chart.position.yun.indexInHui}；世：${chart.position.shi.indexInYun}`],
    },
    prompt: buildPrompt(chart, input.question, input.prompt, now),
  };
}

export async function promptForHuangjiChart(data: Record<string, unknown>, input: ChartInput, now: string) {
  const chart = await calculate(input.huangji);
  if (!sameJsonValue(data.chart, chart)) throw new Error('皇极经世盘面与起盘资料不一致。');
  return buildPrompt(chart, input.question, input.prompt, now);
}
