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
import { insertPromptSectionBeforeHeading } from '../prompt/guidance';
import { buildPromptSchoolSection, type PromptSchoolId } from '../prompt/schools';

export * from './standard';

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
] as const;

export interface HuangjiJingshiInput {
  /** 自定义纪元模式下某一元第一年的整数坐标；省略时按通行公元值年卦排法。 */
  epochYear?: number;
  /** 公元年或自定义纪元下的目标整数年坐标；通行模式不接受公元 0 年。 */
  year?: number;
  /** 自定义纪元模式下，从纪元第一年起已经过的完整年数。 */
  elapsedYears?: number;
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
    mode: '通行公元年' | '年坐标' | '已过年数';
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

export function buildHuangjiJingshiPrompt(
  result: HuangjiJingshiCalculation,
  question?: string,
  schools?: readonly PromptSchoolId<'huangji-jingshi'>[],
): string {
  const normalizedQuestion = normalizeQuestion(question);
  const { input, position } = result;

  if (result.forecast) {
    const { forecast } = result;
    const { governing, yun, sixtyYear, decade, annual } = forecast.hexagrams;
    const askedQuestion = normalizedQuestion || `请解读${input.year}年的整体趋势与主要变化。`;
    const prompt = [
      '【任务】',
      '以值年卦为主要取象，结合十年卦、六十年统卦、运卦和会内统卦的层级背景，解读所问事项。先给出清晰结论，再说明年度主线、当前阶段、变化过程与可观察的现实信号；个人事项结合问题中的现实背景作条件化分析。',
      '',
      '【问题】',
      askedQuestion,
      '',
      '【排盘资料】',
      `目标年份：${formatHuangjiCivilYear(input.year)}（${annual.ganzhi}）`,
      `周期位置：本元第${forecast.hui.indexInYuan}会（${forecast.hui.branch}会），${formatHuangjiCivilYear(forecast.hui.startYear)}至${formatHuangjiCivilYear(forecast.hui.endYear)}`,
      `会内统卦：${governing.hexagram.name}，${formatHuangjiCivilYear(governing.startYear)}至${formatHuangjiCivilYear(governing.endYear)}`,
      `运卦：${yun.hexagram.name}，${formatHuangjiCivilYear(yun.startYear)}至${formatHuangjiCivilYear(yun.endYear)}；由${yun.derivedFrom}卦第${yun.changedLine}爻变得`,
      `六十年统卦：${sixtyYear.hexagram.name}，${formatHuangjiCivilYear(sixtyYear.startYear)}至${formatHuangjiCivilYear(sixtyYear.endYear)}；由${sixtyYear.derivedFrom}卦第${sixtyYear.changedLine}爻变得`,
      `十年卦：${decade.hexagram.name}，${formatHuangjiCivilYear(decade.startYear)}至${formatHuangjiCivilYear(decade.endYear)}；由${decade.derivedFrom}卦第${decade.changedLine}爻变得`,
      `值年卦：${annual.name}（${annual.symbol}，${annual.upper}上${annual.lower}下）`,
      `值年卦辞：${annual.judgment}`,
      '',
      '【取象资料】',
      `互卦：${forecast.relatedHexagrams.mutual.name}`,
      `错卦：${forecast.relatedHexagrams.opposite.name}`,
      `综卦：${forecast.relatedHexagrams.reversed.name}`,
      '',
      '【传统依据】',
      `${forecast.model.model}以${formatHuangjiCivilYear(forecast.model.yuanStartYear)}为本元起点，以${forecast.model.annualAnchorYear}年${forecast.model.annualAnchorHexagram}卦为甲子值年锚点，值年卦按先天圆图去除乾、坤、坎、离后的六十卦顺序轮转。`,
    ].join('\n');
    return insertPromptSectionBeforeHeading(
      prompt,
      '【问题】',
      buildPromptSchoolSection('huangji-jingshi', schools),
    );
  }

  const lines = [
    '【任务】',
    normalizedQuestion ? '请结合周期资料回答【问题】。' : '请解读目标年所处的周期位置。',
  ];
  if (normalizedQuestion) lines.push('', '【问题】', normalizedQuestion);
  lines.push(
    '',
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
    '',
    '【传统依据】',
    '按一元十二会、一会三十运、一运十二世、一世三十年的元会运世层级定位。',
  );
  return insertPromptSectionBeforeHeading(
    lines.join('\n'),
    '【问题】',
    buildPromptSchoolSection('huangji-jingshi', schools),
  );
}

export function calculateHuangjiJingshi(input: HuangjiJingshiInput): HuangjiJingshiResult {
  const normalized = resolveInput(input);
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
    mode: normalized.mode,
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
        ]
      : [
          '结果使用整数年坐标，不自动解释为公元、民国或其他历史纪年。',
          '纪元由调用方明确提供；更换纪元会改变全部元会运世位置。',
          '自定义纪元模式只计算元会运世位置，不附通行值年卦。',
        ],
    ...(forecast ? { forecast } : {}),
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
  buildHuangjiJingshiPrompt,
};
