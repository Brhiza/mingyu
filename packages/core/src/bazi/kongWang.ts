import { BASIC_MAPPINGS } from './baziDefinitions';
import type { KongWangResult, Pillars } from './baziTypes';

const HEAVENLY_STEMS = BASIC_MAPPINGS.HEAVENLY_STEMS as readonly string[];
const EARTHLY_BRANCHES = BASIC_MAPPINGS.EARTHLY_BRANCHES as readonly string[];

export function calculateKongWangBranches(gan: string, zhi: string): string[] {
  const ganIndex = HEAVENLY_STEMS.indexOf(gan);
  const zhiIndex = EARTHLY_BRANCHES.indexOf(zhi);
  if (ganIndex === -1 || zhiIndex === -1) return [];

  const emptyBranch1Index = (10 + zhiIndex - ganIndex) % 12;
  const emptyBranch2Index = (11 + zhiIndex - ganIndex) % 12;
  return [EARTHLY_BRANCHES[emptyBranch1Index], EARTHLY_BRANCHES[emptyBranch2Index]];
}

export function calculateKongWang(pillars: Pillars): KongWangResult {
  const result = {} as KongWangResult;

  (Object.keys(pillars) as Array<keyof Pillars>).forEach((key) => {
    const pillar = pillars[key];
    result[key] = calculateKongWangBranches(pillar.gan, pillar.zhi);
  });

  return result;
}
