import { SI_KU } from '../baziDefinitions';
import { branchesContain } from './helpers';
import type { Matcher } from './types';
import { getBaziRelationMappings } from '../baziMappingsData';

const BAZI_RELATION_MAPPINGS = getBaziRelationMappings();

const SAN_HE_KEYWORD_MAP: Record<string, string> = {
  三合金: '巳酉丑',
  三合水: '申子辰',
  三合木: '亥卯未',
  三合火: '寅午戌',
};

const SAN_HUI_KEYWORD_MAP: Record<string, string> = {
  三会水: '亥子丑',
  三会木: '寅卯辰',
  三会火: '巳午未',
  三会金: '申酉戌',
};

export const sanHeMatcher: Matcher = ({ condition, pillars }) => {
  if (!condition.includes('三合')) return null;

  for (const [name, branches] of Object.entries(BAZI_RELATION_MAPPINGS.SAN_HE_MAP)) {
    if (condition.includes(name)) return branchesContain(pillars, branches);
  }
  for (const [keyword, key] of Object.entries(SAN_HE_KEYWORD_MAP)) {
    if (condition.includes(keyword)) {
      return branchesContain(pillars, BAZI_RELATION_MAPPINGS.SAN_HE_MAP[key]);
    }
  }
  for (const branches of Object.values(BAZI_RELATION_MAPPINGS.SAN_HE_MAP)) {
    if (branchesContain(pillars, branches)) return true;
  }
  return false;
};

export const sanHuiMatcher: Matcher = ({ condition, pillars }) => {
  if (!condition.includes('三会')) return null;

  for (const [name, branches] of Object.entries(BAZI_RELATION_MAPPINGS.SAN_HUI_MAP)) {
    if (condition.includes(name)) return branchesContain(pillars, branches);
  }
  for (const [keyword, key] of Object.entries(SAN_HUI_KEYWORD_MAP)) {
    if (condition.includes(keyword)) {
      return branchesContain(pillars, BAZI_RELATION_MAPPINGS.SAN_HUI_MAP[key]);
    }
  }
  for (const branches of Object.values(BAZI_RELATION_MAPPINGS.SAN_HUI_MAP)) {
    if (branchesContain(pillars, branches)) return true;
  }
  return false;
};

export const siKuMatcher: Matcher = ({ condition, pillars }) => {
  if (!condition.includes('辰戌丑未') && !condition.includes('四库')) {
    return null;
  }
  return branchesContain(pillars, SI_KU);
};
