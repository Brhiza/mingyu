import { calculateKongWangBranches } from './kongWang';
import type { KongWangProfile } from '../types/analysis';

export function analyzeKongWangProfile(
  pillars: Array<{ gan: string; zhi: string }>,
  dayMasterStem: string,
): KongWangProfile {
  const pillarNames = ['year', 'month', 'day', 'hour'];
  const dayGan = pillars[2].gan;
  const dayZhi = pillars[2].zhi;
  const emptyBranches = calculateKongWangBranches(dayGan, dayZhi);

  const cnItems = pillarNames.map((pn, idx) => {
    const isEmpty = emptyBranches.includes(pillars[idx].zhi);
    return { pillar: pn, emptyBranches, isEmpty, fillableItems: [] };
  });

  return { items: cnItems, summary: '旬空：' + emptyBranches.join('、') };
}
