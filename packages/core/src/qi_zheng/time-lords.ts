/**
 * @file 七政四余行限
 * @description 洞微年分：命、相貌、福德、官禄等依次行限；小限以生年支加命宫逆数太岁。
 * @传统依据 《张果星宗》定限度法、年分诀、定小限例。
 * 沿用本盘回归黄道三十度宫制，宫内命度按三度一档定十一至二十虚岁出童限。
 * 年级定位按流年减出生年加一；区间含起点、不含终点，不推交限月日。
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

export interface QizhengCurrentLimit {
  palace: string;
  signIndex: number;
  signBranch: QizhengSignBranch;
  nominalAge: number;
  startNominalAge: number;
  endNominalAge: number;
}

export interface QizhengTimeLordResult {
  yearStem: string;
  yearStemYinYang: '阳' | '阴';
  gender: 'male' | 'female';
  direction: QizhengLimitDirection;
  nominalAge: number;
  ageNote: string;
  majorLimits: QizhengLimitStep[];
  currentMajorLimit: QizhengCurrentLimit | null;
  model: '洞微年分';
  mingDegree: number;
  childLimitEndNominalAge: number;
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

/** 年分诀各宫所管年数；命宫另依命度确定。 */
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

export function resolveQizhengChildLimitEnd(mingDegree: number): number {
  if (!Number.isFinite(mingDegree) || mingDegree < 0 || mingDegree >= 30) {
    throw new Error('行限命度必须在宫内0度至不足30度之间。');
  }
  return 11 + Math.floor(mingDegree / 3);
}

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
  mingDegree: number;
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
  const childLimitEndNominalAge = resolveQizhengChildLimitEnd(params.mingDegree);
  let nextStart = 1;
  const majorLimits = Array.from({ length: 12 }, (_, step) => {
    const palace = params.twelvePalaces[palaceIndexByLimitStep(step, direction)];
    const duration = step === 0 ? childLimitEndNominalAge - 1 : PALACE_YEARS[palace.palace];
    if (duration === undefined) throw new Error(`行限宫名无效：${palace.palace}。`);
    const startNominalAge = nextStart;
    nextStart += duration;
    return {
      palace: palace.palace,
      signIndex: palace.signIndex,
      signBranch: palace.signBranch,
      startNominalAge,
      endNominalAge: nextStart,
    };
  });
  const currentMajor = majorLimits.find(
    (step) => nominalAge >= step.startNominalAge && nominalAge < step.endNominalAge,
  );
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
    mingDegree: params.mingDegree,
    childLimitEndNominalAge,
    coverageNote: `按回归黄道宫内命度三度一档定出童限，采用十一至二十虚岁档；单周行限至未满${nextStart}虚岁`,
    ageNote: `虚岁按流年${params.flowYear}减出生年${params.birthYear}加一，得${nominalAge}岁；按年级定位，区间含起点、不含终点，交限月日另论`,
    majorLimits,
    currentMajorLimit: currentMajor
      ? {
          palace: currentMajor.palace,
          signIndex: currentMajor.signIndex,
          signBranch: currentMajor.signBranch,
          nominalAge,
          startNominalAge: currentMajor.startNominalAge,
          endNominalAge: currentMajor.endNominalAge,
        }
      : null,
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
    `宫内命度${result.mingDegree.toFixed(4)}°，${result.childLimitEndNominalAge}虚岁出童限；${result.coverageNote}。`,
    result.currentMajorLimit
      ? `当前大限：虚岁${result.currentMajorLimit.startNominalAge}至未满${result.currentMajorLimit.endNominalAge}，落${result.currentMajorLimit.signBranch}宫${result.currentMajorLimit.palace}。`
      : `当前虚岁已超出所列单周行限。`,
    `当前小限：虚岁${result.currentMinorLimit.nominalAge}，落${result.currentMinorLimit.signBranch}宫${result.currentMinorLimit.palace}。`,
    `流年太岁${result.annualBranch}入${result.annualPalace.signBranch}宫${result.annualPalace.palace}。`,
    `大限十二步：${result.majorLimits
      .map(
        (item) =>
          `虚岁${item.startNominalAge}至未满${item.endNominalAge}${item.signBranch}宫${item.palace}`,
      )
      .join('；')}。`,
  ];
}
