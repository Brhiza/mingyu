import { EARTHLY_BRANCHES, getDivinationTime, getStemYinYang } from '../calendar';

type Palace = { palace: string; signIndex: number; signBranch: string };
const years: Record<string, number> = { 相貌: 10, 福德: 11, 官禄: 15, 迁移: 8, 疾厄: 7, 妻妾: 11, 奴仆: 4.5, 男女: 4.5, 田宅: 4.5, 兄弟: 5, 财帛: 5 };
const standardMingGongYears = 15;

/** 洞微年分保留已知宫序与小限，并附洞微百岁定式（命宫 15 年起）参考；未核定实测命度交限时保持 majorLimitStatus 提示。 */
export function timeLords(input: { gender: 'male' | 'female'; birthYear: number; flowYear: number; birthTimestamp: number; flowTimestamp: number; palaces: Palace[] }) {
  if (input.palaces.length !== 12) throw new Error('行限需要完整十二宫。');
  if (input.flowTimestamp < input.birthTimestamp || input.flowYear < input.birthYear) throw new Error('行限的流曜时刻不得早于出生时刻。');
  const birthYear = getDivinationTime(new Date(input.birthTimestamp)).ganzhi.year;
  const flowYear = getDivinationTime(new Date(input.flowTimestamp)).ganzhi.year;
  const birthBranch = birthYear[1], flowBranch = flowYear[1], age = input.flowYear - input.birthYear + 1;
  const delta = (EARTHLY_BRANCHES.indexOf(flowBranch) - EARTHLY_BRANCHES.indexOf(birthBranch) + 12) % 12;
  const currentMinorLimit = { ...input.palaces[delta], nominalAge: age };
  const annualPalace = input.palaces.find((palace) => palace.signBranch === flowBranch);
  if (!annualPalace) throw new Error('流年地支无法对应本命十二宫。');
  const majorPalaceYears = Array.from({ length: 12 }, (_, step) => {
    const palace = input.palaces[(12 - step) % 12], value = step === 0 ? null : years[palace.palace];
    if (value === undefined) throw new Error('洞微年分宫名无效。');
    return { ...palace, years: value };
  });
  let cursorAge = 1;
  const standardLimits = majorPalaceYears.map((item, step) => {
    const span = step === 0 ? standardMingGongYears : item.years!;
    const startAge = cursorAge;
    const endAge = cursorAge + span;
    cursorAge = endAge;
    return { palace: item.palace, signIndex: item.signIndex, signBranch: item.signBranch, years: span, startAge, endAge };
  });
  const totalSpan = cursorAge - 1;
  const cycleAge = ((age - 1) % totalSpan) + 1;
  const activeStandardLimit = standardLimits.find((item) => cycleAge >= item.startAge && cycleAge < item.endAge) ?? standardLimits.at(-1)!;
  return { yearStem: birthYear[0], yearStemYinYang: getStemYinYang(birthYear[0]), gender: input.gender, direction: '顺行' as const, nominalAge: age,
    model: '洞微年分' as const, mingDegree: null, childLimitEndNominalAge: null, majorLimitStatus: '命度与交限待核定' as const,
    currentMajorLimit: null, majorLimits: [], majorPalaceYears,
    dongweiStandard: { mingGongYears: standardMingGongYears, totalCycleYears: totalSpan, limits: standardLimits, activeLimit: activeStandardLimit },
    currentMinorLimit, annualBranch: flowBranch, annualPalace,
    ageNote: `民用公元年${input.flowYear}减出生年${input.birthYear}加一得名义虚岁${age}；小限按节令年支定位。`,
    limitation: '命宫宿度与出童限岁数未核定，不能推断当前大限或交限时间；所附洞微定式按命宫十五年常法折算，仅供流派参考。' };
}
