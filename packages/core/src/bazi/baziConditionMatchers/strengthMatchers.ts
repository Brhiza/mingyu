import { HIDDEN_STEMS } from '../baziMappingsData';
import { getWuxing } from '../baziUtils';
import type { Matcher } from './types';

/** 月支所在季节的当令五行（寅卯辰木旺、巳午未火旺、申酉戌金旺、亥子丑水旺、四库土旺） */
const MONTH_SEASON_WUXING: Record<string, string> = {
  寅: '木',
  卯: '木',
  辰: '土',
  巳: '火',
  午: '火',
  未: '土',
  申: '金',
  酉: '金',
  戌: '土',
  亥: '水',
  子: '水',
  丑: '土',
};

/** 阳刃支位：甲卯、丙午、戊午、庚酉、壬子；阴干不论阳刃 */
const YANG_REN_BRANCH: Record<string, string> = {
  甲: '卯',
  丙: '午',
  戊: '午',
  庚: '酉',
  壬: '子',
};

function branchPrincipalWuxing(branch: string): string {
  const principal = (HIDDEN_STEMS[branch] ?? [])[0];
  return principal ? String(getWuxing(principal)) : '未知';
}

/**
 * 强弱类条件按盘面证据判定，不再把“当令”“旺盛”等关键词直接放行：
 * - 阳刃透出＝刃支见于四支；阳刃当令＝月支即刃支；
 * - 日干与月支同气／月令司权＝月支本气五行与日主相同；
 * - 当令＝日主五行即月支季节旺气；
 * - “X势旺盛”＝该五行在天干与地支本气中不少于三处（成势口径，未附古籍定量依据）。
 */
export const strengthMatcher: Matcher = ({
  condition,
  dayStem,
  pillars,
  allStems,
  allBranches,
}) => {
  if (condition.includes('羊刃') || condition.includes('阳刃')) {
    const renBranch = YANG_REN_BRANCH[dayStem];
    if (!renBranch) return false;
    if (condition.includes('当令')) return pillars.month.zhi === renBranch;
    return allBranches.includes(renBranch);
  }
  if (condition.includes('日干与月支同气') || condition.includes('月令司权')) {
    return branchPrincipalWuxing(pillars.month.zhi) === getWuxing(dayStem);
  }
  const elementMatch = condition.match(/([木火土金水])势旺/);
  if (elementMatch) {
    const element = elementMatch[1];
    let count = 0;
    for (const stem of allStems) {
      if (getWuxing(stem) === element) count += 1;
    }
    for (const branch of allBranches) {
      if (branchPrincipalWuxing(branch) === element) count += 1;
    }
    return count >= 3;
  }
  if (condition.includes('当令')) {
    return MONTH_SEASON_WUXING[pillars.month.zhi] === getWuxing(dayStem);
  }
  return null;
};
