/**
 * @file 皇极经世元会运世周期
 * @description 提供通行公元值年卦排盘，以及可选的自定义纪元元会运世换算。
 * @传统依据 《皇极经世》与蔡元定《皇极经世指要》所传一元消长之数。
 */

import {
  calculateStandardHuangjiForecast,
  civilYearToSerial,
  formatHuangjiCivilYear,
  HUANGJI_STANDARD_EPOCH,
  serialYearToCivil,
  type HuangjiStandardForecast,
} from './standard';
import { buildPromptTask, insertPromptSectionBeforeHeading } from '../prompt/guidance';
import { buildPromptSchoolSection, type PromptSchoolId } from '../prompt/schools';
import {
  buildPromptSelectionTask,
  getPromptSelectionSection,
  requirePromptSelection,
} from '../prompt/framework';
import {
  calculateHuangjiDateTimeForecast,
  type HuangjiDateTimeForecast,
  type HuangjiSixDayDateInput,
  type HuangjiSixDayDateResult,
} from './datetime';
import { evaluateHuangjiEraTrend, type HuangjiEraTrendResult } from './trend';
import { hexagramsData } from '../divination/hexagram-data';

export * from './standard';
export * from './datetime';
export * from './trend';
export * from './references';
import { queryHuangjiReference } from './references';

export const HUANGJI_CYCLE_YEARS = Object.freeze({
  shi: 30,
  yun: 360,
  hui: 10_800,
  yuan: 129_600,
});

export const HUANGJI_CYCLE_COUNTS = Object.freeze({
  huiPerYuan: 12,
  yunPerHui: 30,
  yunPerYuan: 360,
  shiPerYun: 12,
  shiPerYuan: 4_320,
  yearsPerShi: 30,
});

export const HUANGJI_JINGSHI_SOURCES = [
  {
    title: '《皇极经世》',
    scope: '元、会、运、世的层级周期框架。',
  },
  {
    title: '蔡元定《皇极经世指要》',
    scope: '一元消长之数及元会运世换算的传统整理。',
  },
  {
    title: '先天六十四卦圆图值年卦通行排法',
    scope: '会内统卦、运卦、六十年统卦、十年卦和值年卦的层级推演。',
  },
  {
    title: '《皇极经世书绪言》卷一、卷三',
    scope: '子半时段及月日时分直卦的经纬层级思路。',
  },
] as const;

export interface HuangjiJingshiInput {
  /** 自定义纪元模式下某一元第一年的整数坐标；省略时按通行公元值年卦排法。 */
  epochYear?: number;
  /** 公元年或自定义纪元下的目标整数年坐标；通行模式不接受公元 0 年。 */
  year?: number;
  /** 自定义纪元模式下，从纪元第一年起已经过的完整年数。 */
  elapsedYears?: number;
  /** 年月日时起盘时间；提供时不得同时提供 epochYear、year 或 elapsedYears。 */
  date?: Date;
  /** 六日逐爻专用的带时区当地公历时间；提供时不得同时提供 date 或年份坐标。 */
  sixDayDate?: HuangjiSixDayDateInput;
  /** 可选问题，只用于生成完整提示词，不改变换算。 */
  question?: string;
}

export interface HuangjiCycleRange {
  startYear: number;
  endYear: number;
}

export interface HuangjiCycleProgress {
  currentYearIndex: number;
  completedYears: number;
  remainingYearsAfterCurrent: number;
  nextCycleStartYear: number;
}

export interface HuangjiJingshiCalculation {
  input: {
    mode: '通行公元年' | '年月日时' | '六日逐爻公历' | '年坐标' | '已过年数';
    calendar: '公元纪年（无公元0年）' | '整数坐标';
    epochYear: number;
    year: number;
    elapsedYears: number;
  };
  position: {
    yuan: HuangjiCycleRange & { indexFromEpoch: number };
    hui: HuangjiCycleRange & { indexInYuan: number };
    yun: HuangjiCycleRange & { indexInYuan: number; indexInHui: number };
    shi: HuangjiCycleRange & { indexInYuan: number; indexInYun: number };
    year: { coordinate: number; indexInShi: number; indexInYuan: number };
  };
  progress: {
    yuan: HuangjiCycleProgress;
    hui: HuangjiCycleProgress;
    yun: HuangjiCycleProgress;
    shi: HuangjiCycleProgress;
  };
  conversion: {
    yearsPerShi: 30;
    shiPerYun: 12;
    yearsPerYun: 360;
    yunPerHui: 30;
    yearsPerHui: 10800;
    huiPerYuan: 12;
    yearsPerYuan: 129600;
  };
  calculationChain: string[];
  sources: Array<{ title: string; scope: string }>;
  limitations: string[];
  forecast?: HuangjiStandardForecast;
  dateTimeForecast?: HuangjiDateTimeForecast;
  sixDayCycle?: HuangjiSixDayDateResult;
  eraTrend?: HuangjiEraTrendResult;
}

export interface HuangjiJingshiResult extends HuangjiJingshiCalculation {
  prompt: string;
}

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label}必须是安全范围内的整数。`);
  }
}

function assertNonNegativeSafeInteger(value: number, label: string): void {
  assertSafeInteger(value, label);
  if (value < 0) throw new Error(`${label}不能小于 0。`);
}

function checkedAdd(left: number, right: number, label: string): number {
  const result = left + right;
  assertSafeInteger(result, label);
  return result;
}

function normalizeQuestion(question?: string): string | undefined {
  if (question === undefined) return undefined;
  if (typeof question !== 'string' || !question.trim()) throw new Error('问题必须是非空字符串。');
  return question.trim();
}

type ResolvedHuangjiInput = HuangjiJingshiCalculation['input'] & {
  axisEpochYear: number;
  axisYear: number;
  standardMode: boolean;
};

function resolveInput(input: HuangjiJingshiInput): ResolvedHuangjiInput {
  if (!input || typeof input !== 'object') throw new Error('皇极经世输入不能为空。');
  const hasYear = input.year !== undefined;
  const hasElapsedYears = input.elapsedYears !== undefined;

  if (input.epochYear === undefined) {
    if (!hasYear || hasElapsedYears) {
      throw new Error('通行公元值年卦模式必须只提供 year。');
    }
    assertSafeInteger(input.year as number, 'year');
    const axisYear = civilYearToSerial(input.year as number);
    const axisEpochYear = civilYearToSerial(HUANGJI_STANDARD_EPOCH.yuanStartYear);
    const elapsedYears = axisYear - axisEpochYear;
    assertSafeInteger(elapsedYears, '纪元差值');
    if (elapsedYears < 0) {
      throw new Error(
        `year 不能早于${formatHuangjiCivilYear(HUANGJI_STANDARD_EPOCH.yuanStartYear)}。`,
      );
    }
    return {
      mode: '通行公元年',
      calendar: '公元纪年（无公元0年）',
      epochYear: HUANGJI_STANDARD_EPOCH.yuanStartYear,
      year: input.year as number,
      elapsedYears,
      axisEpochYear,
      axisYear,
      standardMode: true,
    };
  }

  assertSafeInteger(input.epochYear, 'epochYear');
  if (hasYear === hasElapsedYears) {
    throw new Error('year 与 elapsedYears 必须且只能提供一个。');
  }

  if (hasElapsedYears) {
    assertNonNegativeSafeInteger(input.elapsedYears as number, 'elapsedYears');
    const year = checkedAdd(input.epochYear, input.elapsedYears as number, '目标年坐标');
    return {
      mode: '已过年数',
      calendar: '整数坐标',
      epochYear: input.epochYear,
      year,
      elapsedYears: input.elapsedYears as number,
      axisEpochYear: input.epochYear,
      axisYear: year,
      standardMode: false,
    };
  }

  assertSafeInteger(input.year as number, 'year');
  const elapsedYears = (input.year as number) - input.epochYear;
  assertSafeInteger(elapsedYears, '纪元差值');
  if (elapsedYears < 0) throw new Error('year 不能早于 epochYear。');
  return {
    mode: '年坐标',
    calendar: '整数坐标',
    epochYear: input.epochYear,
    year: input.year as number,
    elapsedYears,
    axisEpochYear: input.epochYear,
    axisYear: input.year as number,
    standardMode: false,
  };
}

function buildRange(startYear: number, length: number, label: string): HuangjiCycleRange {
  return { startYear, endYear: checkedAdd(startYear, length - 1, `${label}结束年`) };
}

function buildProgress(
  range: HuangjiCycleRange,
  year: number,
  length: number,
  label: string,
): HuangjiCycleProgress {
  const completedYears = year - range.startYear;
  assertNonNegativeSafeInteger(completedYears, `${label}内已过年数`);
  if (completedYears >= length || year > range.endYear) {
    throw new Error(`${label}进度超出当前周期范围。`);
  }
  const currentYearIndex = completedYears + 1;
  return {
    currentYearIndex,
    completedYears,
    remainingYearsAfterCurrent: length - currentYearIndex,
    nextCycleStartYear: checkedAdd(range.endYear, 1, `下一${label}开始年`),
  };
}

function formatHuangjiLineFacts(label: string, id: number): string {
  const hexagram = hexagramsData.find((item) => item.id === id);
  if (!hexagram) throw new Error('皇极卦画资料无效。');
  const lines = hexagram.binarySymbol.slice(3) + hexagram.binarySymbol.slice(0, 3);
  const positions = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'];
  return `${label}爻象：${hexagram.name}，上卦${hexagram.upper}、下卦${hexagram.lower}；自下而上为${[...lines].map((line, index) => `${positions[index]}${line === '1' ? '阳' : '阴'}`).join('、')}。`;
}

export function buildHuangjiJingshiPrompt(
  result: HuangjiJingshiCalculation,
  question?: string,
  schools?: readonly PromptSchoolId<'huangji-jingshi'>[],
  selectionOptions?: {
    topicId?: string;
    subtopicId?: string;
    scope?: string;
  },
): string {
  const normalizedQuestion = normalizeQuestion(question);
  const { input, position } = result;

  if (result.forecast) {
    const { forecast } = result;
    const { governing, yun, sixtyYear, decade, annual } = forecast.hexagrams;
    const dateTimeForecast = result.dateTimeForecast;
    const sixDayCycle = result.sixDayCycle;
    const dayInMonthJing = dateTimeForecast
      ? ((dateTimeForecast.calendar.dayOfYear - 1) % 60) + 1
      : 0;
    const monthJingStartDay = dateTimeForecast
      ? dateTimeForecast.calendar.dayOfYear - dayInMonthJing + 1
      : 0;
    const xunStartDay = Math.floor((dayInMonthJing - 1) / 10) * 10 + 1;
    const askedQuestion =
      normalizedQuestion ||
      (dateTimeForecast
        ? `请解读${dateTimeForecast.civilTime.dateTime}这一时点的时势与主要变化。`
        : sixDayCycle
          ? `请解读${sixDayCycle.civilTime.dateTime}这一时点的六日逐爻时势与主要变化。`
          : `请解读${input.year}年的整体趋势与主要变化。`);
    const dateTimeLines = dateTimeForecast
      ? [
          `起盘时间：${dateTimeForecast.civilTime.dateTime}（${dateTimeForecast.civilTime.timezone}）`,
          `皇极历位：${formatHuangjiCivilYear(dateTimeForecast.calendar.forecastYear)}，${dateTimeForecast.calendar.monthBranch}月第${dateTimeForecast.calendar.dayOfMonth}日，${dateTimeForecast.calendar.activeSolarTerm}后第${dateTimeForecast.calendar.actualDayInSolarTerm}日`,
          `日序口径：皇极年内第${dateTimeForecast.calendar.dayOfYear}日；本节气实际第${dateTimeForecast.calendar.actualDayInSolarTerm}日映射为皇极节气第${dateTimeForecast.calendar.mappedDayInSolarTerm}日。下列统辖范围均按皇极日序定位。`,
          `月经卦：${dateTimeForecast.hexagrams.monthJing.name}（由${dateTimeForecast.hexagrams.monthJing.derivedFrom}卦第${dateTimeForecast.hexagrams.monthJing.changedLine}爻变得）`,
          `月经统辖：${dateTimeForecast.hexagrams.monthJing.name}统皇极年内第${monthJingStartDay}至${monthJingStartDay + 59}日，共60个皇极日；当前为本月经卦内第${dayInMonthJing}日。`,
          `月经卦辞：${dateTimeForecast.hexagrams.monthJing.judgment}`,
          `旬纬卦：${dateTimeForecast.hexagrams.xunWei.name}（由${dateTimeForecast.hexagrams.xunWei.derivedFrom}卦第${dateTimeForecast.hexagrams.xunWei.changedLine}爻变得）`,
          `旬纬统辖：${dateTimeForecast.hexagrams.xunWei.name}统本月经卦内第${xunStartDay}至${xunStartDay + 9}日，共10个皇极日；当前为本旬第${dayInMonthJing - xunStartDay + 1}日。`,
          `旬纬卦辞：${dateTimeForecast.hexagrams.xunWei.judgment}`,
          `日卦：${dateTimeForecast.hexagrams.daily.name}（月经卦六十卦序第${(dateTimeForecast.hexagrams.daily.sequenceOffset || 0) + 1}位）`,
          `时经卦：${dateTimeForecast.hexagrams.hourJing.name}（由${dateTimeForecast.hexagrams.hourJing.derivedFrom}卦第${dateTimeForecast.hexagrams.hourJing.changedLine}爻变得，${dateTimeForecast.calendar.hourRange}）`,
          `日卦卦辞：${dateTimeForecast.hexagrams.daily.judgment}`,
          `时经卦卦辞：${dateTimeForecast.hexagrams.hourJing.judgment}`,
        ]
      : sixDayCycle
        ? [
            `六日逐爻公历时间：${sixDayCycle.civilTime.dateTime}（UTC${sixDayCycle.civilTime.timezone >= 0 ? '+' : ''}${sixDayCycle.civilTime.timezone}${sixDayCycle.civilTime.timeZoneId ? `，${sixDayCycle.civilTime.timeZoneId}` : ''}）`,
            `冬至定位依据：节气时刻${sixDayCycle.anchor.dateTime}（UTC${sixDayCycle.anchor.timezone >= 0 ? '+' : ''}${sixDayCycle.anchor.timezone}，真实瞬时${sixDayCycle.anchor.utcDateTime}）；当地子半起点为${sixDayCycle.anchor.dayStartDateTime}（${sixDayCycle.anchor.dayGanZhi}，甲子序号${sixDayCycle.anchor.dayIndex}），对应皇极年${formatHuangjiCivilYear(sixDayCycle.anchor.forecastYear)}。`,
            `六日逐爻坐标：当地冬至子半后实际经过${sixDayCycle.calendar.actualElapsedDays}个完整公历日，按${sixDayCycle.calendar.yearLengthDays.toFixed(6)}日实岁等分为三百六十日正数，当前为第${sixDayCycle.dayOfCycle}日。`,
            `四正分区：${sixDayCycle.calendar.cardinalSeason}段第${sixDayCycle.calendar.cardinalDay}日；经卦${sixDayCycle.hexagrams.jing.name}第${sixDayCycle.dayLine}爻，日变卦${sixDayCycle.hexagrams.daily.name}，${sixDayCycle.hexagrams.hourRange}时变卦${sixDayCycle.hexagrams.hourly.name}。`,
            `时段依据：当地公历子半起，钟表${sixDayCycle.civilTime.hour}时处于${sixDayCycle.hourRange}，每四小时一爻；冬至日干支${sixDayCycle.anchor.dayGanZhi}的甲子序号为${sixDayCycle.anchor.dayIndex}。`,
          ]
        : [];
    const dateTimeBasis = sixDayCycle
      ? '具体时点以真实带时区公历时间核定冬至所在当地公历日，再以当地子半为日界；传统依据为每卦六日七分与每四小时一爻，本次明确选择的公历换算模型将该冬至子半至下一冬至子半的实测间隔等分为三百六十日正数，再依每六日一经卦、每日一爻、每四小时一爻取象。'
      : dateTimeForecast
        ? '具体时点以冬至换年，每个节气按十五个皇极日定位，超过十五日的尾段归第十五日；值年卦每六十日变一爻得月经卦，月经卦每十日变一爻得旬纬卦，日卦从月经卦依六十卦序逐日顺行，日卦自子半起每四小时变一爻得时经卦。'
        : '';
    const prompt = [
      `【传统依据】\n${forecast.model.model}以${formatHuangjiCivilYear(forecast.model.yuanStartYear)}为本元起点，以${forecast.model.annualAnchorYear}年${forecast.model.annualAnchorHexagram}卦为甲子值年锚点，值年卦按先天圆图去除乾、坤、坎、离后的六十卦顺序轮转。${dateTimeBasis}`,
      [
        '【排盘资料】',
        ...dateTimeLines,
        `目标年份：${formatHuangjiCivilYear(input.year)}（${annual.ganzhi}）`,
        `周期位置：本元第${forecast.hui.indexInYuan}会（${forecast.hui.branch}会），${formatHuangjiCivilYear(forecast.hui.startYear)}至${formatHuangjiCivilYear(forecast.hui.endYear)}`,
        `会内统卦：${governing.hexagram.name}，${formatHuangjiCivilYear(governing.startYear)}至${formatHuangjiCivilYear(governing.endYear)}`,
        `会内统卦辞：${governing.hexagram.judgment}`,
        `运卦：${yun.hexagram.name}，${formatHuangjiCivilYear(yun.startYear)}至${formatHuangjiCivilYear(yun.endYear)}；由${yun.derivedFrom}卦第${yun.changedLine}爻变得`,
        `运卦卦辞：${yun.hexagram.judgment}`,
        `六十年统卦：${sixtyYear.hexagram.name}，${formatHuangjiCivilYear(sixtyYear.startYear)}至${formatHuangjiCivilYear(sixtyYear.endYear)}；由${sixtyYear.derivedFrom}卦第${sixtyYear.changedLine}爻变得`,
        `六十年统卦辞：${sixtyYear.hexagram.judgment}`,
        `十年卦：${decade.hexagram.name}，${formatHuangjiCivilYear(decade.startYear)}至${formatHuangjiCivilYear(decade.endYear)}；由${decade.derivedFrom}卦第${decade.changedLine}爻变得`,
        `十年卦辞：${decade.hexagram.judgment}`,
        `值年卦：${annual.name}（${annual.symbol}，${annual.upper}上${annual.lower}下）`,
        `值年卦辞：${annual.judgment}`,
        `值年取序：以${formatHuangjiCivilYear(sixtyYear.startYear)}的六十年统卦${sixtyYear.hexagram.name}为起点，按六十卦圆图顺序每年顺行一位；至${formatHuangjiCivilYear(annual.year)}已过${civilYearToSerial(annual.year) - civilYearToSerial(sixtyYear.startYear)}年，顺行${civilYearToSerial(annual.year) - civilYearToSerial(sixtyYear.startYear)}位，取得${annual.name}为本年静态值年卦。`,
        `十年取卦：以六十年统卦${sixtyYear.hexagram.name}第${decade.changedLine}爻变化，得到${decade.hexagram.name}，统摄${formatHuangjiCivilYear(decade.startYear)}至${formatHuangjiCivilYear(decade.endYear)}；值年取序与十年取卦分别以上述六十年统卦为起点。`,
        '爻象与层级：各卦阴阳爻象描述该层卦体；层级推演按所列原卦、爻位与所得卦分别取象。',
        formatHuangjiLineFacts('会内统卦', governing.hexagram.id),
        formatHuangjiLineFacts('运卦', yun.hexagram.id),
        formatHuangjiLineFacts('六十年统卦', sixtyYear.hexagram.id),
        formatHuangjiLineFacts('十年卦', decade.hexagram.id),
        formatHuangjiLineFacts('值年卦', annual.id),
        ...(dateTimeForecast
          ? [
              formatHuangjiLineFacts('月经卦', dateTimeForecast.hexagrams.monthJing.id),
              formatHuangjiLineFacts('旬纬卦', dateTimeForecast.hexagrams.xunWei.id),
              formatHuangjiLineFacts('日卦', dateTimeForecast.hexagrams.daily.id),
              formatHuangjiLineFacts('时经卦', dateTimeForecast.hexagrams.hourJing.id),
            ]
          : []),
        ...(sixDayCycle
          ? [
              formatHuangjiLineFacts('六日经卦', sixDayCycle.hexagrams.jing.id),
              formatHuangjiLineFacts('六日当日卦', sixDayCycle.hexagrams.daily.id),
              formatHuangjiLineFacts('六日时变卦', sixDayCycle.hexagrams.hourly.id),
            ]
          : []),
        evaluateHuangjiEraTrend(forecast).summary,
      ].join('\n'),
      [
        '【取象资料】',
        `互卦：${forecast.relatedHexagrams.mutual.name}；卦辞：${forecast.relatedHexagrams.mutual.judgment}`,
        `错卦：${forecast.relatedHexagrams.opposite.name}；卦辞：${forecast.relatedHexagrams.opposite.judgment}`,
        `综卦：${forecast.relatedHexagrams.reversed.name}；卦辞：${forecast.relatedHexagrams.reversed.judgment}`,
      ].join('\n'),
      `【任务】\n${buildPromptTask(
        sixDayCycle
          ? '以六日逐爻经卦、当日变卦与四小时段时变卦为当前时点的主要取象，以值年卦、十年卦、六十年统卦、运卦和会内统卦交代长期背景，回答所问事项。'
          : dateTimeForecast
            ? '以时经卦与日卦为当前时点的主要取象，以旬纬卦、月经卦和值年卦说明近远层级，再结合十年卦、六十年统卦、运卦和会内统卦交代长期背景，回答所问事项。'
            : '以值年卦为主要取象，结合十年卦、六十年统卦、运卦和会内统卦的层级背景，解读所问事项；个人事项结合问题中的现实背景作条件化分析。',
        'huangji-jingshi',
      )}`,
      `【问题】\n${askedQuestion}`,
    ].join('\n\n');
    return applyHuangjiPromptSelection(
      insertPromptSectionBeforeHeading(
        prompt,
        '【问题】',
        buildPromptSchoolSection('huangji-jingshi', schools),
      ),
      selectionOptions,
    );
  }

  const sections: string[] = [
    '【传统依据】\n按一元十二会、一会三十运、一运十二世、一世三十年的元会运世层级定位。',
    [
      '【周期资料】',
      `纪元年坐标：${input.epochYear}（某一元第一年）`,
      `目标年坐标：${input.year}`,
      `距纪元已过：${input.elapsedYears} 年`,
      `元：自纪元起第 ${position.yuan.indexFromEpoch} 元，${position.yuan.startYear} 至 ${position.yuan.endYear}`,
      `会：本元第 ${position.hui.indexInYuan} 会，${position.hui.startYear} 至 ${position.hui.endYear}`,
      `运：本元第 ${position.yun.indexInYuan} 运、本会第 ${position.yun.indexInHui} 运，${position.yun.startYear} 至 ${position.yun.endYear}`,
      `世：本元第 ${position.shi.indexInYuan} 世、本运第 ${position.shi.indexInYun} 世，${position.shi.startYear} 至 ${position.shi.endYear}`,
      `年：本世第 ${position.year.indexInShi} 年、本元第 ${position.year.indexInYuan} 年`,
      `周期边界：本世当前为第 ${result.progress.shi.currentYearIndex} 年，尚余 ${result.progress.shi.remainingYearsAfterCurrent} 个完整年；下一世始于 ${result.progress.shi.nextCycleStartYear}，下一运始于 ${result.progress.yun.nextCycleStartYear}`,
    ].join('\n'),
  ];
  sections.push(
    `【任务】\n${buildPromptTask(
      normalizedQuestion
        ? '请依据周期资料回答【问题】，说明目标年在元、会、运、世中的位置、当前进度与下一周期边界。'
        : '请依据周期资料说明目标年在元、会、运、世中的位置、当前进度与下一周期边界。',
      'huangji-cycle',
    )}`,
  );
  if (normalizedQuestion) sections.push(`【问题】\n${normalizedQuestion}`);
  return applyHuangjiPromptSelection(
    insertPromptSectionBeforeHeading(
      sections.join('\n\n'),
      '【问题】',
      buildPromptSchoolSection('huangji-jingshi', schools),
    ),
    selectionOptions,
  );
}

function applyHuangjiPromptSelection(
  prompt: string,
  options?: { topicId?: string; subtopicId?: string; scope?: string },
) {
  if (
    options?.topicId === undefined &&
    options?.subtopicId === undefined &&
    options?.scope === undefined
  ) {
    return prompt;
  }
  const selection = requirePromptSelection({
    methodId: 'huangji-jingshi',
    topicId: options.topicId,
    subtopicId: options.subtopicId,
    scope: options.scope,
  });
  const taskMatch = /【任务】\n([\s\S]*?)(?=\n\n【问题】|$)/u.exec(prompt);
  if (!taskMatch) {
    return `${prompt}\n\n【解读选择】\n${getPromptSelectionSection(selection)}`;
  }
  const taskText = taskMatch[1]?.trim() ?? '';
  const replacement = `【解读选择】\n${getPromptSelectionSection(selection)}\n\n【任务】\n${buildPromptSelectionTask(taskText, selection)}`;
  return prompt.replace(taskMatch[0], replacement);
}

export function calculateHuangjiJingshi(input: HuangjiJingshiInput): HuangjiJingshiResult {
  if (!input || typeof input !== 'object') throw new Error('皇极经世输入不能为空。');
  const hasDate = input.date !== undefined;
  const hasSixDayDate = input.sixDayDate !== undefined;
  if (
    (hasDate || hasSixDayDate) &&
    (input.epochYear !== undefined || input.year !== undefined || input.elapsedYears !== undefined)
  ) {
    throw new Error('公历起盘不得同时提供 epochYear、year 或 elapsedYears。');
  }
  if (hasDate && hasSixDayDate) {
    throw new Error('customDate 与六日逐爻公历时间只能选择一项。');
  }
  const dateTimeForecast = hasDate
    ? calculateHuangjiDateTimeForecast(input.date as Date)
    : undefined;
  const sixDayCycle = hasSixDayDate
    ? calculateHuangjiSixDayCycleFromDate(input.sixDayDate as HuangjiSixDayDateInput)
    : undefined;
  const normalized = resolveInput(
    dateTimeForecast
      ? { year: dateTimeForecast.calendar.forecastYear, question: input.question }
      : sixDayCycle
        ? { year: sixDayCycle.anchor.forecastYear, question: input.question }
        : input,
  );
  const elapsed = normalized.elapsedYears;
  const yuanOffset = Math.floor(elapsed / HUANGJI_CYCLE_YEARS.yuan);
  const offsetInYuan = elapsed % HUANGJI_CYCLE_YEARS.yuan;
  const huiIndex = Math.floor(offsetInYuan / HUANGJI_CYCLE_YEARS.hui) + 1;
  const yunIndexInYuan = Math.floor(offsetInYuan / HUANGJI_CYCLE_YEARS.yun) + 1;
  const yunIndexInHui =
    Math.floor((offsetInYuan % HUANGJI_CYCLE_YEARS.hui) / HUANGJI_CYCLE_YEARS.yun) + 1;
  const shiIndexInYuan = Math.floor(offsetInYuan / HUANGJI_CYCLE_YEARS.shi) + 1;
  const shiIndexInYun =
    Math.floor((offsetInYuan % HUANGJI_CYCLE_YEARS.yun) / HUANGJI_CYCLE_YEARS.shi) + 1;
  const yearIndexInShi = (offsetInYuan % HUANGJI_CYCLE_YEARS.shi) + 1;

  const yuanStart = checkedAdd(
    normalized.axisEpochYear,
    yuanOffset * HUANGJI_CYCLE_YEARS.yuan,
    '元开始年',
  );
  const huiStart = checkedAdd(yuanStart, (huiIndex - 1) * HUANGJI_CYCLE_YEARS.hui, '会开始年');
  const yunStart = checkedAdd(
    yuanStart,
    (yunIndexInYuan - 1) * HUANGJI_CYCLE_YEARS.yun,
    '运开始年',
  );
  const shiStart = checkedAdd(
    yuanStart,
    (shiIndexInYuan - 1) * HUANGJI_CYCLE_YEARS.shi,
    '世开始年',
  );
  const yuanRange = buildRange(yuanStart, HUANGJI_CYCLE_YEARS.yuan, '元');
  const huiRange = buildRange(huiStart, HUANGJI_CYCLE_YEARS.hui, '会');
  const yunRange = buildRange(yunStart, HUANGJI_CYCLE_YEARS.yun, '运');
  const shiRange = buildRange(shiStart, HUANGJI_CYCLE_YEARS.shi, '世');
  const displayYear = (year: number) => (normalized.standardMode ? serialYearToCivil(year) : year);
  const displayRange = (range: HuangjiCycleRange): HuangjiCycleRange => ({
    startYear: displayYear(range.startYear),
    endYear: displayYear(range.endYear),
  });
  const displayProgress = (progress: HuangjiCycleProgress): HuangjiCycleProgress => ({
    ...progress,
    nextCycleStartYear: displayYear(progress.nextCycleStartYear),
  });
  const forecast = normalized.standardMode
    ? calculateStandardHuangjiForecast(normalized.year)
    : undefined;
  const publicInput: HuangjiJingshiCalculation['input'] = {
    mode: sixDayCycle ? '六日逐爻公历' : dateTimeForecast ? '年月日时' : normalized.mode,
    calendar: normalized.calendar,
    epochYear: normalized.epochYear,
    year: normalized.year,
    elapsedYears: normalized.elapsedYears,
  };

  const calculation: HuangjiJingshiCalculation = {
    input: publicInput,
    position: {
      yuan: {
        indexFromEpoch: yuanOffset + 1,
        ...displayRange(yuanRange),
      },
      hui: {
        indexInYuan: huiIndex,
        ...displayRange(huiRange),
      },
      yun: {
        indexInYuan: yunIndexInYuan,
        indexInHui: yunIndexInHui,
        ...displayRange(yunRange),
      },
      shi: {
        indexInYuan: shiIndexInYuan,
        indexInYun: shiIndexInYun,
        ...displayRange(shiRange),
      },
      year: {
        coordinate: normalized.year,
        indexInShi: yearIndexInShi,
        indexInYuan: offsetInYuan + 1,
      },
    },
    progress: {
      yuan: displayProgress(
        buildProgress(yuanRange, normalized.axisYear, HUANGJI_CYCLE_YEARS.yuan, '元'),
      ),
      hui: displayProgress(
        buildProgress(huiRange, normalized.axisYear, HUANGJI_CYCLE_YEARS.hui, '会'),
      ),
      yun: displayProgress(
        buildProgress(yunRange, normalized.axisYear, HUANGJI_CYCLE_YEARS.yun, '运'),
      ),
      shi: displayProgress(
        buildProgress(shiRange, normalized.axisYear, HUANGJI_CYCLE_YEARS.shi, '世'),
      ),
    },
    conversion: {
      yearsPerShi: 30,
      shiPerYun: 12,
      yearsPerYun: 360,
      yunPerHui: 30,
      yearsPerHui: 10800,
      huiPerYuan: 12,
      yearsPerYuan: 129600,
    },
    calculationChain: forecast
      ? [
          `${formatHuangjiCivilYear(normalized.year)}距本元起点已过${elapsed}年，位于第${huiIndex}会（${forecast.hui.branch}会）`,
          `${forecast.hexagrams.governing.hexagram.shortName}统卦第${forecast.hexagrams.yun.changedLine}爻变为${forecast.hexagrams.yun.hexagram.shortName}运卦`,
          `${forecast.hexagrams.yun.hexagram.shortName}运卦第${forecast.hexagrams.sixtyYear.changedLine}爻变为${forecast.hexagrams.sixtyYear.hexagram.shortName}六十年统卦`,
          `${forecast.hexagrams.sixtyYear.hexagram.shortName}六十年统卦第${forecast.hexagrams.decade.changedLine}爻变为${forecast.hexagrams.decade.hexagram.shortName}十年卦；本年轮值${forecast.hexagrams.annual.shortName}卦`,
          ...(dateTimeForecast ? dateTimeForecast.calculationChain : []),
          ...(sixDayCycle ? sixDayCycle.calculationChain : []),
        ]
      : [
          `${normalized.year} - ${normalized.epochYear} = ${elapsed}（距纪元已过年数）`,
          `${elapsed} ÷ 129600 定位第 ${yuanOffset + 1} 元，本元内偏移 ${offsetInYuan} 年`,
          `本元第 ${huiIndex} 会、第 ${yunIndexInYuan} 运、第 ${shiIndexInYuan} 世`,
          `本运第 ${shiIndexInYun} 世，本世第 ${yearIndexInShi} 年`,
        ],
    sources: HUANGJI_JINGSHI_SOURCES.map((source) => ({ ...source })),
    limitations: forecast
      ? [
          '值年卦描述年度公共时势取象，个人事项需结合现实背景分析。',
          '公元纪年按无公元0年的连续年序换算，跨公元前后边界时已作校正。',
          ...(dateTimeForecast ? dateTimeForecast.limitations : []),
          ...(sixDayCycle ? sixDayCycle.limitations : []),
        ]
      : [
          '结果使用整数年坐标，不自动解释为公元、民国或其他历史纪年。',
          '纪元由调用方明确提供；更换纪元会改变全部元会运世位置。',
          '自定义纪元模式只计算元会运世位置，不附通行值年卦。',
        ],
    ...(forecast ? { forecast, eraTrend: evaluateHuangjiEraTrend(forecast) } : {}),
    ...(dateTimeForecast ? { dateTimeForecast } : {}),
    ...(sixDayCycle ? { sixDayCycle } : {}),
  };

  return { ...calculation, prompt: buildHuangjiJingshiPrompt(calculation, input.question) };
}

export const huangjiJingshi = {
  HUANGJI_CYCLE_YEARS,
  HUANGJI_CYCLE_COUNTS,
  HUANGJI_JINGSHI_SOURCES,
  HUANGJI_STANDARD_EPOCH,
  calculateHuangjiJingshi,
  calculateStandardHuangjiForecast,
  calculateHuangjiDateTimeForecast,
  calculateHuangjiSixDayCycleFromDate,
  parseHuangjiSixDayDateTime,
  buildHuangjiJingshiPrompt,
  queryHuangjiReference,
};
