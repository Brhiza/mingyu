import type { HiddenStems, Wuxing } from './baziTypes';
import { BASIC_MAPPINGS } from './baziDefinitions';
import {
  collectSameElementRootFacts,
  type RootPillars,
  type SameElementRootFact,
} from './baziRootFacts';
import { getSeasonStatus } from './baziUtils';

export type RootClashStatus = '未受冲' | '得令本气受失令异类冲' | '库土本气同类冲动' | '受冲待核';

export interface AdjudicatedRootFact extends SameElementRootFact {
  /** 能否参与当前结构作用；与记录直接六冲的 stable 分开。 */
  actionable: boolean;
  clashStatus: RootClashStatus;
}

/**
 * 六冲先保留实际根，再比较根气层次与月令方向。
 * 《滴天髓》地支论区分旺冲衰与衰冲旺，不能把所有受冲根统一删除；
 * 《子平真诠》又将四墓土的对冲区分为“冲动之冲，非冲克之冲”。
 * 因此库土本气同类冲可继续参与结构根证据，但不改 stable 或 strongRoot；
 * 库中非土仍按具体藏干的正库/余气身份走普通受冲待核路径。
 */
export function collectAdjudicatedRootFacts(
  pillars: RootPillars,
  hiddenStems: HiddenStems,
  targetElement: Wuxing,
  getWuxing: (value: string) => string,
): AdjudicatedRootFact[] {
  const season = getSeasonStatus(pillars.month.zhi);
  return collectSameElementRootFacts(pillars, hiddenStems, targetElement, getWuxing).map(
    (root): AdjudicatedRootFact => {
      if (root.stable) return { ...root, actionable: true, clashStatus: '未受冲' };
      const principal = root.hiddenRole === '本气' && getWuxing(root.branch) === targetElement;
      const storageEarthStem =
        root.branch === '辰' || root.branch === '戌'
          ? '戊'
          : root.branch === '丑' || root.branch === '未'
            ? '己'
            : undefined;
      // collectSameElementRootFacts 已由公共 DI_ZHI_CHONG 生成 clashSources；这里复用同一真相源。
      const storageOpposite = BASIC_MAPPINGS.DI_ZHI_CHONG[root.branch];
      const isStorageEarthPrincipalClash =
        targetElement === '土' &&
        principal &&
        storageEarthStem === root.stem &&
        storageOpposite !== undefined &&
        root.clashSources.length > 0 &&
        root.clashSources.every(
          (source) => source.branch === storageOpposite && getWuxing(source.branch) === '土',
        );
      if (isStorageEarthPrincipalClash) {
        return { ...root, actionable: true, clashStatus: '库土本气同类冲动' };
      }
      const seasonStatus = season[targetElement];
      const weakOpponents = root.clashSources.every((source) => {
        const opponent = getWuxing(source.branch);
        return opponent !== targetElement && ['囚', '死'].includes(season[opponent]);
      });
      if (principal && ['旺', '相'].includes(seasonStatus) && weakOpponents) {
        return { ...root, actionable: true, clashStatus: '得令本气受失令异类冲' };
      }
      return {
        ...root,
        actionable: false,
        clashStatus: '受冲待核',
      };
    },
  );
}
