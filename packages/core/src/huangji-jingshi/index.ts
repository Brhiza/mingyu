/**
 * @file 皇极经世元会运世周期
 * @description 提供可复核的元、会、运、世纯数学换算；纪元由调用方明确给出。
 * @传统依据 《皇极经世》与蔡元定《皇极经世指要》所传一元消长之数。
 */

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
] as const;

export interface HuangjiJingshiInput {
  /** 某一元第一年的整数坐标，必须明确提供。 */
  epochYear: number;
  /** 目标整数年坐标；与 elapsedYears 二选一。 */
  year?: number;
  /** 从纪元第一年起已经过的完整年数，0 表示纪元第一年。 */
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
    mode: '年坐标' | '已过年数';
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

function resolveInput(input: HuangjiJingshiInput): HuangjiJingshiCalculation['input'] {
  if (!input || typeof input !== 'object') throw new Error('皇极经世输入不能为空。');
  assertSafeInteger(input.epochYear, 'epochYear');
  const hasYear = input.year !== undefined;
  const hasElapsedYears = input.elapsedYears !== undefined;
  if (hasYear === hasElapsedYears) {
    throw new Error('year 与 elapsedYears 必须且只能提供一个。');
  }

  if (hasElapsedYears) {
    assertNonNegativeSafeInteger(input.elapsedYears as number, 'elapsedYears');
    const year = checkedAdd(input.epochYear, input.elapsedYears as number, '目标年坐标');
    return {
      mode: '已过年数',
      epochYear: input.epochYear,
      year,
      elapsedYears: input.elapsedYears as number,
    };
  }

  assertSafeInteger(input.year as number, 'year');
  const elapsedYears = (input.year as number) - input.epochYear;
  assertSafeInteger(elapsedYears, '纪元差值');
  if (elapsedYears < 0) throw new Error('year 不能早于 epochYear。');
  return { mode: '年坐标', epochYear: input.epochYear, year: input.year as number, elapsedYears };
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
): string {
  const normalizedQuestion = normalizeQuestion(question);
  const { input, position } = result;
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
  return lines.join('\n');
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
    normalized.epochYear,
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

  const calculation: HuangjiJingshiCalculation = {
    input: normalized,
    position: {
      yuan: {
        indexFromEpoch: yuanOffset + 1,
        ...yuanRange,
      },
      hui: {
        indexInYuan: huiIndex,
        ...huiRange,
      },
      yun: {
        indexInYuan: yunIndexInYuan,
        indexInHui: yunIndexInHui,
        ...yunRange,
      },
      shi: {
        indexInYuan: shiIndexInYuan,
        indexInYun: shiIndexInYun,
        ...shiRange,
      },
      year: {
        coordinate: normalized.year,
        indexInShi: yearIndexInShi,
        indexInYuan: offsetInYuan + 1,
      },
    },
    progress: {
      yuan: buildProgress(yuanRange, normalized.year, HUANGJI_CYCLE_YEARS.yuan, '元'),
      hui: buildProgress(huiRange, normalized.year, HUANGJI_CYCLE_YEARS.hui, '会'),
      yun: buildProgress(yunRange, normalized.year, HUANGJI_CYCLE_YEARS.yun, '运'),
      shi: buildProgress(shiRange, normalized.year, HUANGJI_CYCLE_YEARS.shi, '世'),
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
    calculationChain: [
      `${normalized.year} - ${normalized.epochYear} = ${elapsed}（距纪元已过年数）`,
      `${elapsed} ÷ 129600 定位第 ${yuanOffset + 1} 元，本元内偏移 ${offsetInYuan} 年`,
      `本元第 ${huiIndex} 会、第 ${yunIndexInYuan} 运、第 ${shiIndexInYuan} 世`,
      `本运第 ${shiIndexInYun} 世，本世第 ${yearIndexInShi} 年`,
      `当前年后距下一世、运、会、元边界分别尚余 ${HUANGJI_CYCLE_YEARS.shi - yearIndexInShi}、${HUANGJI_CYCLE_YEARS.yun - ((offsetInYuan % HUANGJI_CYCLE_YEARS.yun) + 1)}、${HUANGJI_CYCLE_YEARS.hui - ((offsetInYuan % HUANGJI_CYCLE_YEARS.hui) + 1)}、${HUANGJI_CYCLE_YEARS.yuan - (offsetInYuan + 1)} 个完整年`,
    ],
    sources: HUANGJI_JINGSHI_SOURCES.map((source) => ({ ...source })),
    limitations: [
      '结果使用整数年坐标，不自动解释为公元、民国或其他历史纪年。',
      '纪元由调用方明确提供；更换纪元会改变全部元会运世位置。',
      '当前只实现元会运世数学周期，不含值年卦、卦气或事件预测。',
    ],
  };

  return { ...calculation, prompt: buildHuangjiJingshiPrompt(calculation, input.question) };
}

export const huangjiJingshi = {
  HUANGJI_CYCLE_YEARS,
  HUANGJI_CYCLE_COUNTS,
  HUANGJI_JINGSHI_SOURCES,
  calculateHuangjiJingshi,
  buildHuangjiJingshiPrompt,
};
