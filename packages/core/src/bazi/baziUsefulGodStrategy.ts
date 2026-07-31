import { WUXING, type PatternAnalysis, type UsefulGodAnalysis, type Wuxing } from './baziTypes';
import type { HiddenStemSource, VisibleStemSource } from './baziRuleMatcher';
import { assertEarthlyBranch, assertHeavenlyStem } from './baziUtils';

interface UsefulGodClimateContext {
  externalPatternEligible?: boolean;
  yearStem?: string;
  hourBranch?: string;
  currentJieqi?: string;
  visibleStems?: string[];
  visibleStemSources?: VisibleStemSource[];
  hiddenStems?: string[];
  hiddenStemSources?: HiddenStemSource[];
  formationWuxings?: string[];
  wuxingCounts?: Record<string, number>;
}

const USEFUL_GOD_AUDIT_LIMITATION =
  '自动用神规则尚未完成逐条来源、版本与适用边界校勘，底层保留待定' as const;

function assertWuxing(value: string, label: string): asserts value is Wuxing {
  if (!(WUXING as readonly string[]).includes(value)) {
    throw new Error(`${label}五行无效：${value}`);
  }
}

function assertUsefulGodClimateContext(context?: UsefulGodClimateContext): void {
  if (!context) return;

  if (
    context.externalPatternEligible !== undefined &&
    typeof context.externalPatternEligible !== 'boolean'
  ) {
    throw new Error('外格资格标记无效');
  }

  if (context.yearStem) assertHeavenlyStem(context.yearStem, '年干');
  if (context.hourBranch) assertEarthlyBranch(context.hourBranch, '时支');
  context.visibleStems?.forEach((stem) => assertHeavenlyStem(stem, '明透天干'));
  context.visibleStemSources?.forEach((source) =>
    assertHeavenlyStem(source.stem, `${source.pillar}柱明透天干`),
  );
  context.hiddenStems?.forEach((stem) => assertHeavenlyStem(stem, '藏干'));
  context.hiddenStemSources?.forEach((source) => {
    assertEarthlyBranch(source.branch, `${source.pillar}柱地支`);
    source.stems.forEach((stem) => assertHeavenlyStem(stem, `${source.pillar}柱藏干`));
  });
  context.formationWuxings?.forEach((wuxing) => assertWuxing(wuxing, '成局'));
  Object.entries(context.wuxingCounts || {}).forEach(([wuxing, count]) => {
    assertWuxing(wuxing, '五行统计');
    if (!Number.isFinite(count) || count < 0) {
      throw new Error(`五行统计数值无效：${wuxing}=${count}`);
    }
  });
}

/**
 * 用神、喜忌与调候涉及流派、原文版本及多层成立条件。
 * 旧规则没有逐条可复核来源，正式入口在完成校勘前失败关闭，只保留稳定返回结构。
 */
export function determineUsefulGod(
  _strengthStatus: string,
  _pattern: PatternAnalysis,
  dmWuxing: string,
  monthBranch?: string,
  monthCommander?: string,
  dayMasterStem?: string,
  climateContext?: UsefulGodClimateContext,
): UsefulGodAnalysis & {
  favorableWuxing: string[];
  unfavorableWuxing: string[];
  strategyTrace: string[];
  primaryReason: string;
} {
  assertWuxing(dmWuxing, '日主');
  if (monthBranch) assertEarthlyBranch(monthBranch, '月支');
  if (monthCommander) assertHeavenlyStem(monthCommander, '月令司权天干');
  if (dayMasterStem) assertHeavenlyStem(dayMasterStem, '日主天干');
  assertUsefulGodClimateContext(climateContext);

  return {
    favorable: [],
    unfavorable: [],
    primaryFavorable: [],
    secondaryFavorable: [],
    primaryUnfavorable: [],
    secondaryUnfavorable: [],
    useful: '',
    avoid: '',
    favorableWuxing: [],
    unfavorableWuxing: [],
    primaryFavorableWuxing: '',
    secondaryFavorableWuxing: [],
    primaryUnfavorableWuxing: '',
    secondaryUnfavorableWuxing: [],
    primaryUseful: '',
    primaryAvoid: '',
    strategyTrace: [USEFUL_GOD_AUDIT_LIMITATION],
    primaryReason: '取用待定',
    matchedRules: [],
  };
}
