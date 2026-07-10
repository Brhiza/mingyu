import { EARTHLY_BRANCHES, HEAVENLY_STEMS } from '../../../ganzhi/data';

export function getBranchIndex(branch: string): number {
  return EARTHLY_BRANCHES.indexOf(branch as (typeof EARTHLY_BRANCHES)[number]);
}

export function getStemIndex(stem: string): number {
  return HEAVENLY_STEMS.indexOf(stem as (typeof HEAVENLY_STEMS)[number]);
}
