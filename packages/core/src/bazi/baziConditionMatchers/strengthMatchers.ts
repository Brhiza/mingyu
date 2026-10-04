import { getWuxing } from '../baziUtils';
import type { Matcher } from './types';
import { getBaziRelationMappings } from '../baziMappingsData';

const BAZI_RELATION_MAPPINGS = getBaziRelationMappings();

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

function branchPrincipalWuxing(branch: string): string {
  const principal = (BAZI_RELATION_MAPPINGS.HIDDEN_STEMS[branch] ?? [])[0];
  return principal ? String(getWuxing(principal)) : '未知';
}

/**
 * 强弱类条件按盘面证据判定，不再把“当令”“旺盛”等关键词直接放行：
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
  if (condition === '当令') {
    return MONTH_SEASON_WUXING[pillars.month.zhi] === getWuxing(dayStem);
  }
  return null;
};
