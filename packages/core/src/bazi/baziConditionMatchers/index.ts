import type { BaziChartResult } from '../baziTypes';
import { sanHeMatcher, sanHuiMatcher, siKuMatcher } from './formationMatchers';
import { shiZhuMatcher, shiZhiMatcher, riZhiMatcher, riZhuMatcher } from './pillarMatchers';
import { chongMatcher, jianZhiMatcher, noJianZhiMatcher, diZhiDuoMatcher } from './branchMatchers';
import { touGanMatcher, tianGanDuoMatcher, wuHeMatcher, noTouGanMatcher } from './stemMatchers';
import type { CheckContext, Matcher } from './types';

export { branchesContain } from './helpers';
export type { CheckContext, Matcher } from './types';

const MATCHERS: Matcher[] = [
  sanHeMatcher,
  sanHuiMatcher,
  siKuMatcher,
  chongMatcher,
  shiZhuMatcher,
  shiZhiMatcher,
  riZhiMatcher,
  riZhuMatcher,
  jianZhiMatcher,
  noJianZhiMatcher,
  touGanMatcher,
  tianGanDuoMatcher,
  noTouGanMatcher,
  diZhiDuoMatcher,
  wuHeMatcher,
];

export function checkCondition(
  condition: string,
  dayStem: string,
  pillars: BaziChartResult['pillars'],
  hiddenStems: BaziChartResult['hiddenStems'],
): boolean {
  const allBranches = [pillars.year.zhi, pillars.month.zhi, pillars.day.zhi, pillars.hour.zhi];
  const allStems = [pillars.year.gan, pillars.month.gan, pillars.day.gan, pillars.hour.gan];
  const ctx: CheckContext = {
    condition,
    dayStem,
    pillars,
    hiddenStems,
    allBranches,
    allStems,
  };

  for (const matcher of MATCHERS) {
    const result = matcher(ctx);
    if (result !== null) {
      return result;
    }
  }

  return false;
}
