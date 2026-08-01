import { HIDDEN_STEMS } from './baziDefinitions';
import {
  collectCompleteBranchFormations,
  getRepresentativeStemByWuxing,
} from './baziFormationUtils';
import type { Pillars, Wuxing } from './baziTypes';

type GetTenGodFn = (gan: string, dayMaster: string) => string;

const PEER_TEN_GODS = new Set(['比肩', '劫财']);
const WEALTH_TEN_GODS = new Set(['正财', '偏财']);
const OFFICER_TEN_GODS = new Set(['正官', '七杀']);

export interface ExternalPatternEligibilityOptions {
  /**
   * 《子平真诠》“论杂格”逐格明举的候选，不再把月令本气不是比劫直接当成反证；
   * 仍须服从透干、会支已有用及财官煞的共同边界。
   */
  allowNonPeerMonthPrincipal?: boolean;
  /** 当前外格自身所依赖的完整会局，不重复当作“月令另有会支之用”阻断。 */
  allowedFormationWuxing?: Wuxing[];
  /** 单一且无根的财星明透，可按“论杂格”原文继续列候选。 */
  allowSingleUnrootedWealth?: boolean;
  /** 原文逐格例型明确允许的月令藏干透出，不重复当作另取月令用神阻断。 */
  allowedExposedMonthStems?: string[];
}

/**
 * 《子平真诠》外格共同资格。默认保持“论外格用舍”的严格口径；“论杂格”逐格明举
 * 的候选可通过选项放宽月令本气，并允许单一无根财星，但官煞、两财、财有根及另有
 * 透干或会支之用仍会阻断。
 */
export function canUseExternalPattern(
  pillars: Pillars,
  getTenGod: GetTenGodFn,
  options: ExternalPatternEligibilityOptions = {},
): boolean {
  const dayMaster = pillars.day.gan;
  const monthHiddenStems = HIDDEN_STEMS[pillars.month.zhi] ?? [];
  const monthPrincipalStem = monthHiddenStems[0];

  if (!monthPrincipalStem) {
    return false;
  }
  if (
    !options.allowNonPeerMonthPrincipal &&
    !PEER_TEN_GODS.has(getTenGod(monthPrincipalStem, dayMaster))
  ) {
    return false;
  }

  const exposedStems = [pillars.year.gan, pillars.month.gan, pillars.hour.gan];
  const exposedGods = exposedStems.map((stem) => getTenGod(stem, dayMaster));
  if (exposedGods.some((tenGod) => OFFICER_TEN_GODS.has(tenGod))) {
    return false;
  }

  const exposedWealthCount = exposedGods.filter((tenGod) => WEALTH_TEN_GODS.has(tenGod)).length;
  if (exposedWealthCount > 0) {
    if (!options.allowSingleUnrootedWealth || exposedWealthCount >= 2) return false;

    const hasWealthRoot = Object.values(pillars).some((pillar) =>
      (HIDDEN_STEMS[pillar.zhi] ?? []).some((stem) =>
        WEALTH_TEN_GODS.has(getTenGod(stem, dayMaster)),
      ),
    );
    if (hasWealthRoot) return false;
  }

  const hasExposedMonthUse = monthHiddenStems.some((stem) => {
    if (options.allowedExposedMonthStems?.includes(stem)) return false;
    if (!exposedStems.includes(stem)) return false;
    const tenGod = getTenGod(stem, dayMaster);
    if (PEER_TEN_GODS.has(tenGod)) return false;
    return !(
      options.allowSingleUnrootedWealth &&
      exposedWealthCount === 1 &&
      WEALTH_TEN_GODS.has(tenGod)
    );
  });
  if (hasExposedMonthUse) return false;

  const allowedFormationWuxing = new Set(options.allowedFormationWuxing ?? []);
  return !collectCompleteBranchFormations(pillars).some((formation) => {
    if (!formation.includesMonthBranch) return false;
    if (allowedFormationWuxing.has(formation.wuxing)) return false;
    const formationStem = getRepresentativeStemByWuxing(formation.wuxing);
    return !PEER_TEN_GODS.has(getTenGod(formationStem, dayMaster));
  });
}
