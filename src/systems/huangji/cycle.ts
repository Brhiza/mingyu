// Year and explicit-coordinate calculations are self-contained in V2.
import { calculateStandardHuangjiForecast, civilYearToSerial, serialYearToCivil, formatHuangjiCivilYear, HUANGJI_STANDARD_EPOCH, type HuangjiStandardForecast } from './standard';
import { evaluateHuangjiEraTrend, type HuangjiEraTrendResult } from './trend';

type HuangjiJingshiInput = { epochYear?: number; year?: number; elapsedYears?: number };
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
  eraTrend?: HuangjiEraTrendResult;
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

export function calculateCycle(input: HuangjiJingshiInput): HuangjiJingshiCalculation {
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
          `${formatHuangjiCivilYear(normalized.year)}距本元起点已过${offsetInYuan}年，位于第${huiIndex}会（${forecast.hui.branch}会）`,
          `${forecast.hexagrams.governing.hexagram.shortName}统卦第${forecast.hexagrams.yun.changedLine}爻变为${forecast.hexagrams.yun.hexagram.shortName}运卦`,
          forecast.hexagrams.sixtyYear.normalizedFrom
            ? `${forecast.hexagrams.yun.hexagram.shortName}运卦第${forecast.hexagrams.sixtyYear.changedLine}爻变为${forecast.hexagrams.sixtyYear.normalizedFrom}卦，再依六十卦圆图顺取${forecast.hexagrams.sixtyYear.hexagram.shortName}六十年统卦`
            : `${forecast.hexagrams.yun.hexagram.shortName}运卦第${forecast.hexagrams.sixtyYear.changedLine}爻变为${forecast.hexagrams.sixtyYear.hexagram.shortName}六十年统卦`,
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
    ...(forecast ? { forecast, eraTrend: evaluateHuangjiEraTrend(forecast) } : {}),
  };

  return calculation;
}
