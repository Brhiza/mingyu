/**
 * @file Bazi Fortune Action Evidence
 * @description 把本命已经裁决的 UsefulGodAnalysis / decisionEvidence
 * 投影到大运、流年、流月、流日各层级岁运参与干上，形成结构化 action facts。
 *
 * 核心设计边界：
 * 1. 具体干条件保持具体干语义，不扩大成同五行；
 * 2. 藏干只标记本气/中气/余气，不能当岁运明透；
 * 3. 父层事实不可被子层覆盖；
 * 4. 本命分析不可被回写；
 * 5. 关系事实只有合冲时，currentActionStatus 不得升级为满足或不满足；
 * 6. 生成逻辑只使用结构化字段，不解析中文 detail。
 */

import type { BaziChartResult } from './baziTypes';
import { getTenGod } from './baziUtils';
import { getRootTraditionalKind, type RootTraditionalKind } from './baziRootFacts';
import { BRANCH_HIDDEN_STEMS } from '../ganzhi/relations';
import { STEM_WUXING } from '../ganzhi/data';
import type { FortuneTriggerEvidenceResult } from './fortuneTriggerEvidence';

export type FortuneActionLevel = 'dayun' | 'year' | 'month' | 'day';
export type FortuneActionLevelChinese = '大运' | '流年' | '流月' | '流日';
export type FortuneActionPlacement = '岁运透干' | '岁运藏干';
export type FortuneActionHiddenCategory = '本气' | '中气' | '余气';
export type FortuneActionConditionStatus =
  '引用已裁决喜用条件' | '引用已裁决所忌条件' | '双向条件引用' | '未引用';
export type FortuneActionCurrentStatus = '满足' | '不满足' | '资料不足';
export type FortuneActionHitSourceType =
  | 'conditionalFavorableStems'
  | 'conditionalUnfavorableStems'
  | '基础五行喜忌'
  | 'patternBreakerRestrictions'
  | '制化来源';

export interface FortuneActionLayerInput {
  id: string;
  type: FortuneActionLevel;
  label: string;
  ganZhi: string;
  timeRange?: string;
  key?: string;
}

export interface FortuneRootEvidenceItem {
  branch: string;
  stem: string;
  hiddenCategory: FortuneActionHiddenCategory;
  traditionalKind: RootTraditionalKind;
  isSameStem: boolean;
}

export interface FortuneRootEvidence {
  hasClearRoot: boolean;
  isSelfRooted: boolean;
  natalRoots: Array<FortuneRootEvidenceItem & { position: string }>;
  fortuneRoots: Array<FortuneRootEvidenceItem & { layerKey: string; level: FortuneActionLevel }>;
}

export interface FortuneActionFact {
  key: string;
  layerKey: string;
  level: FortuneActionLevel;
  parentLayerKey?: string;
  stem: string;
  element: string;
  tenGod: string;
  placement: FortuneActionPlacement;
  hiddenCategory?: FortuneActionHiddenCategory;
  hitSources: FortuneActionHitSourceType[];
  conditionStatus: FortuneActionConditionStatus;
  currentActionStatus: FortuneActionCurrentStatus;
  rootEvidence?: FortuneRootEvidence;
  targetObjects: string[];
  applicableTimeRange?: string;
  supportingFactKeys: string[];
  opposingFactKeys: string[];

  // 别名字段：保证按中文属性名直接读取亦完全兼容
  层级: FortuneActionLevelChinese;
  干: string;
  五行: string;
  十神: string;
  藏干位置?: FortuneActionHiddenCategory;
  命中来源: FortuneActionHitSourceType[];
  作用对象: string[];
  根气证据?: FortuneRootEvidence;
  适用时间范围?: string;
  支持事实key: string[];
  反证key: string[];
}

export interface FortuneActionEvidenceResult {
  key: 'bazi:fortune-action:evidence';
  status: '已计算' | '资料不足';
  facts: FortuneActionFact[];
  byLayer: Record<string, FortuneActionFact[]>;
  summaryLines: string[];
  promptText: string;
}

const LEVEL_LABELS: Record<FortuneActionLevel, FortuneActionLevelChinese> = {
  dayun: '大运',
  year: '流年',
  month: '流月',
  day: '流日',
};

function getLayerKey(layer: FortuneActionLayerInput): string {
  return layer.key?.trim() || `bazi:fortune-trigger:layer:${layer.type}:${layer.id}`;
}

/**
 * 仅把同干且属于本气、生禄或正库的藏根作为清晰根气证据。
 * 余气和弱藏仍保留在明细中，不能单独把岁运透干升级为已满足。
 */
function isClearRoot(root: FortuneRootEvidenceItem): boolean {
  return (
    root.isSameStem &&
    (root.traditionalKind === '本气' ||
      root.traditionalKind === '生禄' ||
      root.traditionalKind === '正库')
  );
}

function getHiddenCategory(hiddenIndex: number): FortuneActionHiddenCategory {
  return hiddenIndex === 0 ? '本气' : hiddenIndex === 1 ? '中气' : '余气';
}

function getTraditionalRootKind(
  branch: string,
  stem: string,
  hiddenIndex: number,
): RootTraditionalKind {
  return getRootTraditionalKind({
    branch,
    stem,
    hiddenIndex,
    hiddenRole: getHiddenCategory(hiddenIndex),
  });
}

export function formatFortuneActionFactLine(fact: FortuneActionFact): string {
  const placementText =
    fact.placement === '岁运透干' ? '岁运透干' : `岁运藏干·${fact.hiddenCategory ?? '藏气'}`;
  const targetText = fact.targetObjects.length
    ? `｜作用对象：${fact.targetObjects.join('、')}`
    : '';
  const timeRangeText = fact.applicableTimeRange ? `｜适用范围：${fact.applicableTimeRange}` : '';
  const sourcesText = fact.hitSources.length ? `｜命中：${fact.hitSources.join('、')}` : '';
  let rootText = '';
  if (fact.rootEvidence) {
    if (fact.rootEvidence.hasClearRoot) {
      const isNatal = fact.rootEvidence.natalRoots.some(isClearRoot);
      const isFortune = fact.rootEvidence.fortuneRoots.some(isClearRoot);
      const rootSource =
        isNatal && isFortune
          ? '原局及岁运均见同干根气'
          : isNatal
            ? '见原局同干根气'
            : '见岁运同干根气';
      rootText = `｜根气：${rootSource}`;
    } else {
      rootText = '｜根气：无明确同干根气';
    }
  }
  return `${fact.层级}${fact.干}（${fact.五行}，${fact.十神}，${placementText}）：${fact.conditionStatus}｜状态：${fact.currentActionStatus}${sourcesText}${rootText}${targetText}${timeRangeText}`;
}

export function formatFortuneActionEvidenceForPrompt(
  evidence: FortuneActionEvidenceResult | undefined,
): string[] {
  if (!evidence || !evidence.facts.length) return [];
  return [
    '【八字岁运作用事实】',
    ...evidence.facts.map((fact) => formatFortuneActionFactLine(fact)),
  ];
}

export function analyzeFortuneActionEvidence(params: {
  result: BaziChartResult;
  layers: FortuneActionLayerInput[];
  triggerEvidence?: FortuneTriggerEvidenceResult;
}): FortuneActionEvidenceResult {
  const { result, layers, triggerEvidence } = params;
  const usefulGod = result.analysis?.usefulGod;
  const dayMasterGan = result.dayMaster?.gan;

  if (!usefulGod || !layers.length) {
    return {
      key: 'bazi:fortune-action:evidence',
      status: '资料不足',
      facts: [],
      byLayer: {},
      summaryLines: ['岁运作用事实：本命用神分析或岁运层级资料不足，暂未生成作用事实。'],
      promptText: '【八字岁运作用事实】\n资料不足，无法建立作用事实。',
    };
  }

  // 从结构化字段提取已裁决喜忌条件，不解析中文 detail
  const condFavStems = new Set<string>([
    ...(usefulGod.conditionalFavorableStems ?? []),
    ...(usefulGod.decisionEvidence?.conditionalFavorableStems ?? []),
  ]);
  const condUnfavStems = new Set<string>([
    ...(usefulGod.conditionalUnfavorableStems ?? []),
    ...(usefulGod.decisionEvidence?.conditionalUnfavorableStems ?? []),
  ]);
  const breakers = usefulGod.decisionEvidence?.patternBreakerRestrictions ?? [];
  const controlFunctions = usefulGod.decisionEvidence?.controlFunctions ?? [];
  const climateCandidates = usefulGod.decisionEvidence?.climateCandidates ?? [];

  const baseFavWuxing = new Set<string>([
    ...(usefulGod.favorableWuxing ?? []),
    ...(usefulGod.decisionEvidence?.base?.favorable ?? []),
    ...(usefulGod.conditionalFavorableWuxing ?? []),
  ]);
  const baseUnfavWuxing = new Set<string>([
    ...(usefulGod.unfavorableWuxing ?? []),
    ...(usefulGod.decisionEvidence?.base?.unfavorable ?? []),
  ]);

  const allFacts: FortuneActionFact[] = [];
  const byLayer: Record<string, FortuneActionFact[]> = {};

  layers.forEach((layer, layerIndex) => {
    const layerKey = getLayerKey(layer);
    const parentLayerKey = layerIndex > 0 ? getLayerKey(layers[layerIndex - 1]) : undefined;
    const level = layer.type;
    const levelLabel = LEVEL_LABELS[level] ?? '大运';
    const gan = layer.ganZhi[0];
    const zhi = layer.ganZhi[1];
    const hiddenStems = BRANCH_HIDDEN_STEMS[zhi] ?? [];

    const layerItems: Array<{
      stem: string;
      placement: FortuneActionPlacement;
      hiddenCategory?: FortuneActionHiddenCategory;
    }> = [
      { stem: gan, placement: '岁运透干' },
      ...hiddenStems.map((stem, idx) => ({
        stem,
        placement: '岁运藏干' as const,
        hiddenCategory: getHiddenCategory(idx),
      })),
    ];

    const layerFacts: FortuneActionFact[] = [];

    layerItems.forEach((item) => {
      const { stem, placement, hiddenCategory } = item;
      const element = (STEM_WUXING[stem] ?? '') as string;
      const tenGod = dayMasterGan ? getTenGod(stem, dayMasterGan) : '未知';

      const factKey = `bazi:fortune-action:${level}:${stem}:${placement === '岁运透干' ? 'stem' : `hidden:${hiddenCategory}`}:${layerKey}`;

      // 1. 命中来源判断
      const hitSources: FortuneActionHitSourceType[] = [];
      if (condFavStems.has(stem)) hitSources.push('conditionalFavorableStems');
      if (condUnfavStems.has(stem)) hitSources.push('conditionalUnfavorableStems');

      const matchingBreakers = breakers.filter((b) => b.stems.some((s) => s.stem === stem));
      if (matchingBreakers.length > 0) {
        hitSources.push('patternBreakerRestrictions');
      }

      const matchingControls = controlFunctions.filter(
        (c) => c.sourceStems.includes(stem) || c.targetStems.includes(stem),
      );
      const matchingClimateEffects = climateCandidates
        .flatMap((c) => c.effects ?? [])
        .filter((e) => e.stem === stem || e.targetStems?.includes(stem));
      if (matchingControls.length > 0 || matchingClimateEffects.length > 0) {
        hitSources.push('制化来源');
      }

      const isBaseFav = baseFavWuxing.has(element);
      const isBaseUnfav = baseUnfavWuxing.has(element);
      if (isBaseFav || isBaseUnfav) {
        hitSources.push('基础五行喜忌');
      }

      // 2. 作用对象收集（仅从结构化制化/调候字段取）
      const targetSet = new Set<string>();
      for (const ctrl of matchingControls) {
        if (ctrl.sourceStems.includes(stem)) {
          ctrl.targetStems.forEach((t) => targetSet.add(t));
        }
      }
      for (const effect of matchingClimateEffects) {
        if (effect.stem === stem && effect.targetStems) {
          effect.targetStems.forEach((t) => targetSet.add(t));
        }
      }
      const targetObjects = [...targetSet];

      // 3. 喜忌条件引用状态判定
      // 优先保留具体干级条件；同五行基础喜忌仅做独立基线
      const isSpecificFav = condFavStems.has(stem);
      const isSpecificUnfav = condUnfavStems.has(stem) || matchingBreakers.length > 0;

      const favorableHit = isSpecificFav || isBaseFav;
      const unfavorableHit = isSpecificUnfav || isBaseUnfav;

      let conditionStatus: FortuneActionConditionStatus = '未引用';
      if (favorableHit && unfavorableHit) {
        conditionStatus = '双向条件引用';
      } else if (favorableHit) {
        conditionStatus = '引用已裁决喜用条件';
      } else if (unfavorableHit) {
        conditionStatus = '引用已裁决所忌条件';
      } else {
        conditionStatus = '未引用';
      }

      // 4. 支持事实 key 与反证 key
      const supportingFactKeys: string[] = [];
      const opposingFactKeys: string[] = [];

      if (condFavStems.has(stem)) {
        supportingFactKeys.push(`bazi:useful-god:conditional-favorable:${stem}`);
      }
      if (matchingControls.length > 0) {
        matchingControls.forEach((c) =>
          supportingFactKeys.push(`bazi:useful-god:control:${c.key}`),
        );
      }
      if (isBaseFav) {
        supportingFactKeys.push(`bazi:useful-god:base:favorable:${element}`);
      }

      if (condUnfavStems.has(stem)) {
        const unfavKey = `bazi:useful-god:conditional-unfavorable:${stem}`;
        if (conditionStatus === '双向条件引用') {
          opposingFactKeys.push(unfavKey);
        } else {
          supportingFactKeys.push(unfavKey);
        }
      }
      if (matchingBreakers.length > 0) {
        matchingBreakers.forEach((b) => {
          const breakerKey = `bazi:useful-god:breaker:${b.label}`;
          if (conditionStatus === '双向条件引用') {
            opposingFactKeys.push(breakerKey);
          } else {
            supportingFactKeys.push(breakerKey);
          }
        });
      }
      if (isBaseUnfav) {
        const unfavBaseKey = `bazi:useful-god:base:unfavorable:${element}`;
        if (conditionStatus === '双向条件引用') {
          opposingFactKeys.push(unfavBaseKey);
        } else {
          supportingFactKeys.push(unfavBaseKey);
        }
      }

      // 岁运藏干不冒充透干的反证标记
      if (placement === '岁运藏干') {
        opposingFactKeys.push(
          `bazi:fortune-action:counter:hidden-not-transparent:${layerKey}:${stem}:${hiddenCategory}`,
        );
      }

      // 5. currentActionStatus（满足 / 不满足 / 资料不足）
      // 规则：关系事实只有合冲时，不得升级为满足或不满足；
      // 藏干只标记本气/中气/余气，不能当岁运明透。
      const hasRelationFact = Boolean(
        triggerEvidence?.relations.some((r) => {
          const isTargetNatal = r.target.type === 'natal';
          const isSourceNatal = r.source.type === 'natal';
          const isRelevant =
            (r.sourceLayerKey === layerKey && isTargetNatal) ||
            (r.targetLayerKey === layerKey && isSourceNatal);
          if (!isRelevant) return false;
          if (placement === '岁运透干') {
            return (
              r.stemRelation === 'clash' ||
              r.stemRelation === 'combine' ||
              r.stemRelation === 'same'
            );
          }
          return (
            r.branchRelation === 'clash' ||
            r.branchRelation === 'combine' ||
            r.branchRelation === 'same' ||
            r.branchRelation === 'punishment' ||
            r.branchRelation === 'harm' ||
            r.branchRelation === 'break'
          );
        }),
      );

      const hasDirectStemCondition = isSpecificFav || isSpecificUnfav;

      let currentActionStatus: FortuneActionCurrentStatus;
      let rootEvidence: FortuneRootEvidence | undefined;

      if (placement === '岁运藏干') {
        // 藏干不冒充透干，不满足透干条件；
        // 若只有合冲关系，保持资料不足
        if (hasRelationFact && !hasDirectStemCondition) {
          currentActionStatus = '资料不足';
        } else {
          currentActionStatus = '不满足';
        }
      } else {
        // 岁运透干
        const natalRoots: Array<FortuneRootEvidenceItem & { position: string }> = [];
        const fortuneRoots: Array<
          FortuneRootEvidenceItem & { layerKey: string; level: FortuneActionLevel }
        > = [];
        let isSelfRooted = false;

        if (result.pillars) {
          const positions = ['year', 'month', 'day', 'hour'] as const;
          positions.forEach((pos) => {
            const pillarZhi = result.pillars![pos]?.zhi;
            if (!pillarZhi) return;
            const hStems = BRANCH_HIDDEN_STEMS[pillarZhi] || [];
            hStems.forEach((hs, idx) => {
              if (STEM_WUXING[hs] === element) {
                natalRoots.push({
                  position: pos,
                  branch: pillarZhi,
                  stem: hs,
                  hiddenCategory: getHiddenCategory(idx),
                  traditionalKind: getTraditionalRootKind(pillarZhi, hs, idx),
                  isSameStem: hs === stem,
                });
              }
            });
          });
        }

        // 只纳入当前层及其父层，避免子层根气反向改变父层事实。
        layers.slice(0, layerIndex + 1).forEach((lyr) => {
          const lyrZhi = lyr.ganZhi[1];
          const hStems = BRANCH_HIDDEN_STEMS[lyrZhi] || [];
          hStems.forEach((hs, idx) => {
            if (STEM_WUXING[hs] === element) {
              const isSameStem = hs === stem;
              const rootItem: FortuneRootEvidenceItem & {
                layerKey: string;
                level: FortuneActionLevel;
              } = {
                layerKey: getLayerKey(lyr),
                level: lyr.type,
                branch: lyrZhi,
                stem: hs,
                hiddenCategory: getHiddenCategory(idx),
                traditionalKind: getTraditionalRootKind(lyrZhi, hs, idx),
                isSameStem,
              };
              fortuneRoots.push(rootItem);
              if (rootItem.layerKey === layerKey && isClearRoot(rootItem)) {
                isSelfRooted = true;
              }
            }
          });
        });

        const hasClearRoot = natalRoots.some(isClearRoot) || fortuneRoots.some(isClearRoot);
        rootEvidence = {
          hasClearRoot,
          isSelfRooted,
          natalRoots,
          fortuneRoots,
        };

        const hasUnimplementedRestrictions =
          hitSources.includes('制化来源') || hitSources.includes('patternBreakerRestrictions');

        if (hasDirectStemCondition) {
          if (hasClearRoot && !hasUnimplementedRestrictions && !hasRelationFact) {
            currentActionStatus = '满足';
          } else {
            currentActionStatus = '资料不足';
          }
        } else if (hasRelationFact || conditionStatus !== '未引用') {
          currentActionStatus = '资料不足';
        } else {
          currentActionStatus = '不满足';
        }
      }

      const fact: FortuneActionFact = {
        key: factKey,
        layerKey,
        level,
        parentLayerKey,
        stem,
        element,
        tenGod,
        placement,
        hiddenCategory,
        hitSources,
        conditionStatus,
        currentActionStatus,
        rootEvidence,
        targetObjects,
        applicableTimeRange: layer.timeRange,
        supportingFactKeys,
        opposingFactKeys,

        // 别名字段
        层级: levelLabel,
        干: stem,
        五行: element,
        十神: tenGod,
        藏干位置: hiddenCategory,
        命中来源: hitSources,
        作用对象: targetObjects,
        根气证据: rootEvidence,
        适用时间范围: layer.timeRange,
        支持事实key: supportingFactKeys,
        反证key: opposingFactKeys,
      };

      layerFacts.push(fact);
      allFacts.push(fact);
    });

    byLayer[layerKey] = layerFacts;
  });

  const summaryLines = allFacts.map(formatFortuneActionFactLine);

  return {
    key: 'bazi:fortune-action:evidence',
    status: '已计算',
    facts: allFacts,
    byLayer,
    summaryLines,
    promptText: ['【八字岁运作用事实】', ...summaryLines].join('\n'),
  };
}
