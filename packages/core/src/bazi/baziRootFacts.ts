/**
 * 八字根气与直接六冲事实。
 *
 * 该模块只收集可由四柱、藏干和公共六冲表直接证明的事实：
 * - 同类藏干根来自哪一柱、哪一支、哪一层；
 * - 该根所在支是否被外柱对冲；
 * - 对冲来源的实际柱位和地支。
 *
 * 不在此处判定身强身弱、拔根程度、格局成败或合会是否成化。
 */
import { BASIC_MAPPINGS } from './baziDefinitions';
import type { HiddenStems, Wuxing } from './baziTypes';

export const ROOT_PILLAR_POSITIONS = ['year', 'month', 'day', 'hour'] as const;
export type RootPillarPosition = (typeof ROOT_PILLAR_POSITIONS)[number];
export type RootPillars = Record<RootPillarPosition, { zhi: string }>;

export type RootHiddenRole = '本气' | '中气' | '余气';

const ROOT_PILLAR_LABELS: Record<RootPillarPosition, string> = {
  year: '年柱',
  month: '月柱',
  day: '日柱',
  hour: '时柱',
};

export interface RootClashSource {
  position: RootPillarPosition;
  branch: string;
  relation: '六冲';
}

export interface SameElementRootFact {
  position: RootPillarPosition;
  branch: string;
  stem: string;
  hiddenIndex: number;
  hiddenRole: RootHiddenRole;
  /**
   * 仅表示该根没有直接六冲来源；不是“根气未失效”的最终裁决。
   */
  stable: boolean;
  clashSources: RootClashSource[];
}

function resolveHiddenRole(index: number): RootHiddenRole {
  if (index === 0) return '本气';
  if (index === 1) return '中气';
  return '余气';
}

/**
 * 返回某根支遭遇的所有直接六冲来源；同一支的重复出现按柱位分别保留。
 */
export function getDirectClashSources(
  branch: string,
  ownPosition: RootPillarPosition,
  pillars: RootPillars,
): RootClashSource[] {
  const clashBranch = BASIC_MAPPINGS.DI_ZHI_CHONG[branch];
  if (!clashBranch) return [];

  return ROOT_PILLAR_POSITIONS.filter(
    (position) => position !== ownPosition && pillars[position].zhi === clashBranch,
  ).map((position) => ({
    position,
    branch: pillars[position].zhi,
    relation: '六冲' as const,
  }));
}

/**
 * 收集指定五行在四支藏干中的全部根事实。
 *
 * 同一地支的本气、中气、余气都各自保留，调用者可按旧契约选择是否把
 * 本气单独映射为明根；这里不做权重、去重或强弱裁决。
 */
export function collectSameElementRootFacts(
  pillars: RootPillars,
  hiddenStems: HiddenStems,
  targetElement: Wuxing,
  getWuxing: (value: string) => string,
): SameElementRootFact[] {
  return ROOT_PILLAR_POSITIONS.flatMap((position) => {
    const stems = hiddenStems[position];
    if (!stems) {
      throw new Error('藏干数据缺失：' + ROOT_PILLAR_LABELS[position]);
    }

    const pillar = pillars[position];
    const clashSources = getDirectClashSources(pillar.zhi, position, pillars);
    return stems.flatMap((stem, hiddenIndex) => {
      if (getWuxing(stem) !== targetElement) return [];
      return [
        {
          position,
          branch: pillar.zhi,
          stem,
          hiddenIndex,
          hiddenRole: resolveHiddenRole(hiddenIndex),
          stable: clashSources.length === 0,
          clashSources,
        },
      ];
    });
  });
}
