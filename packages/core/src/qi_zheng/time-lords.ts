/**
 * @file 七政四余行限
 * @description 洞微年分：命、相貌、福德、官禄等依次行限；小限以生年支加命宫逆数太岁。
 * @传统依据 《张果星宗》安命度法、定限度法、年分诀、定小限例。
 * 原典命度须由太阳宿度对到命宫宿度，再按星盘行数定出童限；
 * 现有回归宫度与现代宿界尚不能复原该映射，故仅列宫序与非命宫年数。
 */
import type { QizhengSignBranch } from './index';
import { getBranchIndex } from '../ganzhi';

export type QizhengLimitDirection = '顺行' | '逆行';

export interface QizhengLimitStep {
  palace: string;
  signIndex: number;
  signBranch: QizhengSignBranch;
  startNominalAge: number;
  endNominalAge: number;
}

export interface QizhengPalaceYears {
  palace: string;
  signIndex: number;
  signBranch: QizhengSignBranch;
  years: number | null;
}

export interface QizhengTimeLordResult {
  yearStem: string;
  yearStemYinYang: '阳' | '阴';
  gender: 'male' | 'female';
  direction: QizhengLimitDirection;
  nominalAge: number;
  ageNote: string;
  majorLimitStatus: '命度与交限待核定';
  majorPalaceYears: QizhengPalaceYears[];
  majorLimits: QizhengLimitStep[];
  currentMajorLimit: null;
  model: '洞微年分';
  mingDegree: null;
  childLimitEndNominalAge: null;
  coverageNote: string;
  currentMinorLimit: {
    palace: string;
    signIndex: number;
    signBranch: QizhengSignBranch;
    nominalAge: number;
  };
  annualBranch: string;
  annualPalace: {
    palace: string;
    signIndex: number;
    signBranch: QizhengSignBranch;
  };
}

export function resolveQizhengLimitDirection(
  _gender: 'male' | 'female',
  _yearStemYinYang: '阳' | '阴',
): QizhengLimitDirection {
  // 大限由命宫向相貌、福德行，地支顺行；不借用子平大运的性别年干顺逆。
  return '顺行';
}

export function palaceIndexByLimitStep(step: number, direction: QizhengLimitDirection): number {
  const offset = ((step % 12) + 12) % 12;
  return direction === '顺行' ? (12 - offset) % 12 : offset;
}

/** 年分诀各宫所管年数；命宫年数须依命度确定。 */
const PALACE_YEARS: Record<string, number> = {
  相貌: 10,
  福德: 11,
  官禄: 15,
  迁移: 8,
  疾厄: 7,
  妻妾: 11,
  奴仆: 4.5,
  男女: 4.5,
  田宅: 4.5,
  兄弟: 5,
  财帛: 5,
};

export function resolveQizhengNominalAge(birthYear: number, flowYear: number): number {
  if (!Number.isInteger(birthYear) || !Number.isInteger(flowYear)) {
    throw new Error('行限年份必须是整数。');
  }
  if (flowYear < birthYear) {
    throw new Error('流年不得早于出生年。');
  }
  return flowYear - birthYear + 1;
}

export function buildQizhengTimeLords(params: {
  gender: 'male' | 'female';
  yearStem: string;
  yearStemYinYang: '阳' | '阴';
  birthYear: number;
  flowYear: number;
  flowYearBranch: string;
  birthYearBranch: string;
  twelvePalaces: ReadonlyArray<{
    palace: string;
    signIndex: number;
    signBranch: QizhengSignBranch;
  }>;
}): QizhengTimeLordResult {
  if (params.twelvePalaces.length !== 12) {
    throw new Error('行限需要完整十二宫。');
  }
  const direction = resolveQizhengLimitDirection(params.gender, params.yearStemYinYang);
  const nominalAge = resolveQizhengNominalAge(params.birthYear, params.flowYear);
  const majorPalaceYears = Array.from({ length: 12 }, (_, step) => {
    const palace = params.twelvePalaces[palaceIndexByLimitStep(step, direction)];
    const years = step === 0 ? null : PALACE_YEARS[palace.palace];
    if (years === undefined) throw new Error(`行限宫名无效：${palace.palace}。`);
    return {
      palace: palace.palace,
      signIndex: palace.signIndex,
      signBranch: palace.signBranch,
      years,
    };
  });
  const yearBranchStep =
    (getBranchIndex(params.flowYearBranch) - getBranchIndex(params.birthYearBranch) + 12) % 12;
  const minorPalace = params.twelvePalaces[palaceIndexByLimitStep(yearBranchStep, '逆行')];
  const annualPalace = params.twelvePalaces.find(
    (item) => item.signBranch === params.flowYearBranch,
  );
  if (!annualPalace) {
    throw new Error(`流年地支 ${params.flowYearBranch} 无法对应本命十二宫。`);
  }
  return {
    yearStem: params.yearStem,
    yearStemYinYang: params.yearStemYinYang,
    gender: params.gender,
    direction,
    nominalAge,
    model: '洞微年分',
    mingDegree: null,
    childLimitEndNominalAge: null,
    majorLimitStatus: '命度与交限待核定',
    coverageNote: '洞微大限宫序与非命宫年数已列；命宫宿度、出童限岁数和当前大限宫位未定',
    ageNote: `按民用公元年${params.flowYear}减出生年${params.birthYear}加一，得名义虚岁${nominalAge}；小限按节令年支定位`,
    majorPalaceYears,
    majorLimits: [],
    currentMajorLimit: null,
    currentMinorLimit: {
      palace: minorPalace.palace,
      signIndex: minorPalace.signIndex,
      signBranch: minorPalace.signBranch,
      nominalAge,
    },
    annualBranch: params.flowYearBranch,
    annualPalace: {
      palace: annualPalace.palace,
      signIndex: annualPalace.signIndex,
      signBranch: annualPalace.signBranch,
    },
  };
}

export function formatQizhengTimeLordPrompt(result: QizhengTimeLordResult): string[] {
  const genderLabel = result.gender === 'male' ? '男' : '女';
  return [
    '【行限】',
    `年干${result.yearStem}${result.yearStemYinYang}，${genderLabel}命；洞微大限沿地支${result.direction}，由命宫经相貌、福德递行；${result.ageNote}。`,
    '大限：命宫宿度、出童限岁数和当前大限宫位未定。',
    `当前小限：落${result.currentMinorLimit.signBranch}宫${result.currentMinorLimit.palace}。`,
    `流年太岁${result.annualBranch}入${result.annualPalace.signBranch}宫${result.annualPalace.palace}。`,
    `洞微宫序与各宫年数：${result.majorPalaceYears
      .map(
        (item) =>
          `${item.signBranch}宫${item.palace}${item.years === null ? '依命度定年数' : `${item.years}年`}`,
      )
      .join('；')}。`,
  ];
}
