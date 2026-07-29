import { HIDDEN_STEMS } from './baziDefinitions';
import {
  collectCompleteBranchFormations,
  getRepresentativeStemByWuxing,
} from './baziFormationUtils';
import type { Pillars } from './baziTypes';

type GetTenGodFn = (gan: string, dayMaster: string) => string;

const PEER_TEN_GODS = new Set(['比肩', '劫财']);
const EXPOSED_PRIMARY_USE_TEN_GODS = new Set(['正财', '偏财', '正官', '七杀']);

/**
 * 《子平真诠》“论外格用舍”的共同前提：只有月令本气与日主同类、月令没有另取到
 * 透干或会支之用，且干头没有现成财官七杀时，才继续检索外格。
 */
export function canUseExternalPattern(pillars: Pillars, getTenGod: GetTenGodFn): boolean {
  const dayMaster = pillars.day.gan;
  const monthHiddenStems = HIDDEN_STEMS[pillars.month.zhi] ?? [];
  const monthPrincipalStem = monthHiddenStems[0];

  if (!monthPrincipalStem || !PEER_TEN_GODS.has(getTenGod(monthPrincipalStem, dayMaster))) {
    return false;
  }

  const exposedStems = [pillars.year.gan, pillars.month.gan, pillars.hour.gan];
  if (exposedStems.some((stem) => EXPOSED_PRIMARY_USE_TEN_GODS.has(getTenGod(stem, dayMaster)))) {
    return false;
  }

  const hasExposedMonthUse = monthHiddenStems.some(
    (stem) => exposedStems.includes(stem) && !PEER_TEN_GODS.has(getTenGod(stem, dayMaster)),
  );
  if (hasExposedMonthUse) return false;

  return !collectCompleteBranchFormations(pillars).some((formation) => {
    if (!formation.includesMonthBranch) return false;
    const formationStem = getRepresentativeStemByWuxing(formation.wuxing);
    return !PEER_TEN_GODS.has(getTenGod(formationStem, dayMaster));
  });
}
