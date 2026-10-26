import type { BaziChartResult } from 'mingyu-core/bazi';
import type { generateQimen } from 'mingyu-core/divination/qimen';
import type { ScopeType } from '../../types/analysis';
import type { buildSerializableZiweiResult } from './prompt-builders';
import { shapeCalculationResult, type ResultDetailMode } from '../result-detail';

const MAX_COMPACT_QIMEN_CLASSIC_PATTERNS = 8;
const MAX_COMPACT_QIMEN_PATTERN_COMBOS = 10;
const MAX_COMPACT_QIMEN_PALACE_INSIGHTS = 9;

export type CalculationSystem = 'bazi' | 'ziwei' | 'qimen';

/** full 不投影；compact 先执行领域投影，再应用公共裁剪契约。 */
export function projectCalculationResult(
  value: unknown,
  mode: ResultDetailMode,
  system?: CalculationSystem,
): unknown {
  if (mode === 'full') return value;
  const result =
    system === 'bazi'
      ? buildCompactBaziResult(value as BaziChartResult)
      : system === 'ziwei'
        ? buildCompactZiweiResult(value as ReturnType<typeof buildSerializableZiweiResult>)
        : system === 'qimen'
          ? buildCompactQimenResult(value as ReturnType<typeof generateQimen>)
          : value;
  const metadata =
    value !== null && typeof value === 'object'
      ? Object.fromEntries(
          Object.entries(value).filter(([key]) =>
            ['batch', 'meta', 'calculationIdentity'].includes(key),
          ),
        )
      : {};
  return shapeCalculationResult(system ? { ...(result as object), ...metadata } : result, mode);
}

export function buildCompactBaziResult(result: BaziChartResult) {
  const decision = result.analysis.usefulGod.decisionEvidence;
  return {
    ...(result.unknownTimeAnalysis
      ? {
          isThreePillars: true,
          unknownTimeAnalysis: result.unknownTimeAnalysis,
          warningFacts: result.warningFacts,
          warningSummaryFact: result.warningSummaryFact,
        }
      : {}),
    gender: result.gender,
    solarDate: result.solarDate,
    lunarDate: result.lunarDate,
    timeInfo: result.timeInfo,
    pillars: result.pillars,
    dayMaster: result.dayMaster,
    zodiac: result.zodiac,
    constellation: result.constellation,
    mingGua: result.mingGua,
    wuxingStrength: result.wuxingStrength,
    analysis: {
      ...result.analysis,
      usefulGod: {
        ...result.analysis.usefulGod,
        decisionEvidence: decision
          ? {
              base: decision.base,
              appliedLayers: decision.appliedLayers,
              conflicts: decision.conflicts,
              climateCandidates: decision.climateCandidates.filter(
                (candidate) => candidate.adopted || candidate.status === '冲突',
              ),
              controlFunctions: decision.controlFunctions?.map((path) => ({
                label: path.label,
                status: path.status,
                sourceStems: path.sourceStems,
                targetStems: path.targetStems,
                baseFavorableStems: path.baseFavorableStems,
                baseUnfavorableStems: path.baseUnfavorableStems,
                evidenceGaps: path.evidenceGaps,
              })),
              natalFunctions: decision.natalFunctions,
              patternBreakerRestrictions: decision.patternBreakerRestrictions,
              transformation: decision.transformation,
            }
          : undefined,
      },
    },
    mingGong: result.mingGong,
    shenGong: result.shenGong,
    taiYuan: result.taiYuan,
    taiXi: result.taiXi,
    kongWang: result.kongWang,
    shensha: result.shensha,
    monthCommander: result.monthCommander,
    luckInfo: {
      startInfo: result.luckInfo.startInfo,
      cycles: result.luckInfo.cycles.map((cycle) => ({
        age: cycle.age,
        year: cycle.year,
        ganZhi: cycle.ganZhi,
      })),
    },
    warnings: result.warnings,
  };
}

/** 显式八字分批摘要保留本页唯一运段与流年；普通摘要继续沿用既有紧凑结构。 */
export function buildCompactBaziBatchResult(result: BaziChartResult) {
  const compact = buildCompactBaziResult(result);
  return {
    ...compact,
    liunian: result.liunian ?? [],
    luckInfo: {
      ...compact.luckInfo,
      cycles: result.luckInfo.cycles.map((cycle) => ({
        age: cycle.age,
        year: cycle.year,
        ganZhi: cycle.ganZhi,
        isXiaoyun: cycle.isXiaoyun,
        type: cycle.type,
        startSolarTime: cycle.startSolarTime,
        endSolarTime: cycle.endSolarTime,
        years: cycle.years,
        resolvedYears: cycle.resolvedYears ?? cycle.years,
      })),
    },
  };
}

export function buildCompactZiweiResult(result: ReturnType<typeof buildSerializableZiweiResult>) {
  return {
    basicInfo: result.basicInfo,
    calculationConfig: result.calculationConfig,
    scopeNames: result.scopeNames,
    evidenceSummaryByScope: Object.fromEntries(
      Object.entries(result.payloadByScope).map(([scope, payload]) => [
        scope,
        payload.evidence_analysis
          ? {
              status: payload.evidence_analysis.status,
              summaryFact: buildCompactZiweiEvidenceSummaryFact(
                payload.evidence_analysis.summaryFact,
              ),
            }
          : undefined,
      ]),
    ),
    patternSummaryByScope: Object.fromEntries(
      Object.entries(result.payloadByScope).map(([scope, payload]) => [
        scope,
        payload.pattern_analysis
          ? {
              status: payload.pattern_analysis.status,
              summaryFact: buildCompactZiweiPatternSummaryFact(
                payload.pattern_analysis.summaryFact,
              ),
            }
          : undefined,
      ]),
    ),
    activeScopes: Object.fromEntries(
      Object.entries(result.payloadByScope).map(([scope, payload]) => [
        scope,
        {
          active_scope: payload.active_scope,
          palaces: payload.palaces.map((palace) => ({
            index: palace.index,
            name: palace.name,
            is_body_palace: palace.is_body_palace,
            major_stars: palace.major_stars.map((star) => ({
              name: star.name,
              brightness: star.brightness,
              birth_mutagen: star.birth_mutagen,
            })),
          })),
        },
      ]),
    ),
    birthMutagens: result.birthMutagens,
    fourMutagens: result.fourMutagens,
    命宫: result.命宫,
    身宫: result.身宫,
    五行局: result.五行局,
    四化: result.四化,
    ...(result.natalFacts ? { natalFacts: result.natalFacts } : {}),
    ...(result.fortuneTimeline?.batch ? { fortuneTimeline: result.fortuneTimeline } : {}),
  };
}

function buildCompactZiweiEvidenceSummaryFact(
  summaryFact: NonNullable<
    ReturnType<
      typeof buildSerializableZiweiResult
    >['payloadByScope'][ScopeType]['evidence_analysis']
  >['summaryFact'],
) {
  return {
    key: summaryFact.key,
    status: summaryFact.status,
    evidenceFactCount: summaryFact.evidenceFactCount,
    natalFactCount: summaryFact.natalFactCount,
    scopeFactCount: summaryFact.scopeFactCount,
    primaryFactCount: summaryFact.primaryFactCount,
    supportingFactCount: summaryFact.supportingFactCount,
    missingFactCount: summaryFact.missingFactCount,
    counterEvidenceCount: summaryFact.counterEvidenceCount,
    limitationFactCount: summaryFact.limitationFactCount,
  };
}

function buildCompactZiweiPatternSummaryFact(
  summaryFact: NonNullable<
    ReturnType<typeof buildSerializableZiweiResult>['payloadByScope'][ScopeType]['pattern_analysis']
  >['summaryFact'],
) {
  return {
    key: summaryFact.key,
    status: summaryFact.status,
    registeredRuleCount: summaryFact.registeredRuleCount,
    evaluatedRuleCount: summaryFact.evaluatedRuleCount,
    unevaluatedRuleCount: summaryFact.unevaluatedRuleCount,
    matchedPatternCount: summaryFact.matchedPatternCount,
    unmatchedRuleCount: summaryFact.unmatchedRuleCount,
    auspiciousPatternCount: summaryFact.auspiciousPatternCount,
    inauspiciousPatternCount: summaryFact.inauspiciousPatternCount,
    neutralPatternCount: summaryFact.neutralPatternCount,
    counterEvidenceCount: summaryFact.counterEvidenceCount,
    limitationFactCount: summaryFact.limitationFactCount,
  };
}

export function buildCompactQimenResult(result: ReturnType<typeof generateQimen>) {
  const classicPatterns = (result.classicPatterns ?? []).slice(
    0,
    MAX_COMPACT_QIMEN_CLASSIC_PATTERNS,
  );
  const patternCombos = (result.patternCombos ?? []).slice(0, MAX_COMPACT_QIMEN_PATTERN_COMBOS);

  return {
    scope: result.scope,
    method: result.method,
    juMethod: result.juMethod,
    timeInfo: result.timeInfo,
    ganzhi: result.ganzhi,
    isYangDun: result.isYangDun,
    juShu: result.juShu,
    zhiFu: result.zhiFu,
    zhiShi: result.zhiShi,
    patternTags: result.patternTags,
    patternDetails: result.patternDetails,
    palaceInsights: (result.palaceInsights ?? []).slice(0, MAX_COMPACT_QIMEN_PALACE_INSIGHTS),
    palaceInsightTotal: result.palaceInsights?.length ?? 0,
    voidBranches: result.voidBranches,
    voidPalaces: result.voidPalaces,
    horseStar: result.horseStar,
    specialConditions: result.specialConditions,
    seasonality: result.seasonality,
    jiuGongGe: result.jiuGongGe.map((palace) => ({
      gong: palace.gong,
      name: palace.name,
      direction: palace.direction,
      element: palace.element,
      tianPan: palace.tianPan,
      diPan: palace.diPan,
      renPan: palace.renPan,
      shenPan: palace.shenPan,
    })),
    classicPatternTotal: result.classicPatterns?.length ?? 0,
    classicPatterns: classicPatterns.map((pattern) => ({
      name: pattern.name,
      type: pattern.type,
      summary: pattern.summary,
      palaces: pattern.palaces,
    })),
    stemRelations: result.stemRelations,
    patternComboTotal: result.patternCombos?.length ?? 0,
    patternCombos: patternCombos.map((combo) => ({
      key: combo.key,
      name: combo.name,
      tone: combo.tone,
      summary: combo.summary,
      palace: combo.palace,
    })),
    directions: result.directions
      ? {
          goodDirections: result.directions.goodDirections.map((item) => ({
            gong: item.gong,
            name: item.name,
            direction: item.direction,
            use: item.use,
            reasons: item.reasons,
          })),
          avoidDirections: result.directions.avoidDirections.map((item) => ({
            gong: item.gong,
            name: item.name,
            direction: item.direction,
            use: item.use,
            reasons: item.reasons,
          })),
        }
      : undefined,
    yingQi: result.yingQi,
    timestamp: result.timestamp,
  };
}
