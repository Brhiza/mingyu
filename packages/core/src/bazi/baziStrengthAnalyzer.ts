import type {
  ConstraintAnalysis,
  DayMasterStrengthAnalysis,
  HiddenStems,
  Pillars,
  RootAnalysis,
  SupportAnalysis,
  Wuxing,
} from './baziTypes';
import {
  analyzeRoot as analyzeInternalRoot,
  analyzeSupport as analyzeInternalSupport,
  analyzeConstraint as analyzeInternalConstraint,
  analyzeDayMasterStrength as analyzeInternalDayMasterStrength,
  type StrengthEvidenceSource,
} from './baziStrengthInternal';
export { analyzeFormation, analyzeSeasonalStatus } from './baziStrengthInternal';

export type { FormationAnalysis, SeasonalStatusAnalysis } from './baziStrengthInternal';
import type { FormationAnalysis, SeasonalStatusAnalysis } from './baziStrengthInternal';

// 公开低层输入保留历史标签协议；正式分析管道直接传递私有 typed 来源。
function legacySource(value: string): StrengthEvidenceSource {
  if (value.includes('(')) return 'hidden-qi';
  return /^[甲乙丙丁戊己庚辛壬癸]$/u.test(value) ? 'visible-stem' : 'branch-main-qi';
}

export function analyzeRoot(
  dayMaster: string,
  pillars: Pillars,
  hiddenStems: HiddenStems,
  getWuxing: (value: string) => Wuxing,
): RootAnalysis {
  const result = analyzeInternalRoot(dayMaster, pillars, hiddenStems, getWuxing);
  return {
    ...result,
    roots: result.roots.map(
      ({ source: _source, hiddenIndex: _index, hiddenRole: _role, ...root }) => root,
    ),
  };
}

export function analyzeSupport(
  dayMaster: string,
  pillars: Pillars,
  hiddenStems: HiddenStems,
  getWuxing: (value: string) => Wuxing,
): SupportAnalysis {
  const result = analyzeInternalSupport(dayMaster, pillars, hiddenStems, getWuxing);
  return {
    ...result,
    supporters: result.supporters.map(({ source: _source, ...supporter }) => supporter),
  };
}

export function analyzeConstraint(
  dayMaster: string,
  pillars: Pillars,
  hiddenStems: HiddenStems,
  getWuxing: (value: string) => Wuxing,
): ConstraintAnalysis {
  const result = analyzeInternalConstraint(dayMaster, pillars, hiddenStems, getWuxing);
  return {
    ...result,
    constraints: result.constraints.map(({ source: _source, ...constraint }) => constraint),
  };
}

export function analyzeDayMasterStrength(
  seasonalStatus: SeasonalStatusAnalysis,
  formationAnalysis: FormationAnalysis,
  rootAnalysis: RootAnalysis,
  supportAnalysis: SupportAnalysis,
  constraintAnalysis: ConstraintAnalysis,
): DayMasterStrengthAnalysis {
  return analyzeInternalDayMasterStrength(
    seasonalStatus,
    formationAnalysis,
    {
      ...rootAnalysis,
      roots: rootAnalysis.roots.map((root) => ({ ...root, source: legacySource(root.branch) })),
    },
    {
      ...supportAnalysis,
      supporters: supportAnalysis.supporters.map((item) => ({
        ...item,
        source: legacySource(item.stem),
      })),
    },
    {
      ...constraintAnalysis,
      constraints: constraintAnalysis.constraints.map((item) => ({
        ...item,
        source: legacySource(item.stem),
      })),
    },
  );
}
