import type { StaticDatasetLoader } from '../../static-data';
import { loadStaticDataset } from '../static-data-loader';
import { assessClimateRule, type ClimateContext, type ClimateRule } from './climate-match';
import type { BaziPillar, PillarName } from './pillars';
import type { buildDayMasterStrength } from './strength';
import type { summarizePattern } from './pattern';

type Pillars = Record<PillarName, BaziPillar>;
const positions: PillarName[] = ['year', 'month', 'day', 'hour'];
let loadedClimateRules: readonly ClimateRule[] | null = null;
const validatedRuleArrays = new WeakSet<readonly ClimateRule[]>();

function validateClimateRules(rules: readonly ClimateRule[]) {
  if (validatedRuleArrays.has(rules)) return;
  // 按需加载后检查全部规则的条件名，避免预筛选让不受支持的条件被静默跳过。
  for (const rule of rules) assessClimateRule(rule, {});
  validatedRuleArrays.add(rules);
}

/** 按需加载并校验《穷通宝鉴》调候规则集，避免将该 JSON 直接打入 Worker/主包。 */
export async function ensureClimateRulesLoaded(load?: StaticDatasetLoader): Promise<readonly ClimateRule[]> {
  const rules = await loadStaticDataset<ClimateRule[]>('bazi-climate-rules', load);
  validateClimateRules(rules);
  if (!load || (typeof __MINGYU_WORKER_ASSETS__ !== 'undefined' && __MINGYU_WORKER_ASSETS__)) {
    loadedClimateRules = rules;
  }
  return rules;
}

function matchesKnown(values: string[] | undefined, value: string | undefined) {
  return !values?.length || value === undefined || values.includes(value);
}
/** 条件候选与参考用途分开记录，协调结果另见调候条件层。 */
export function buildClimateCandidates(pillars: Pillars, strength: ReturnType<typeof buildDayMasterStrength>, pattern: ReturnType<typeof summarizePattern>, currentJieqi?: string, rulesOverride?: readonly ClimateRule[]) {
  if (pattern.source !== '普通月令取格候选') return { applicability: '特殊格暂不套用普通调候' as const, currentJieqi: currentJieqi ?? null, candidates: [], limitation: '特殊格以顺从旺势为先，不直接套用普通扶抑调候；寒暖需求在不逆破格势前提下配合，见用神权衡层。' };
  const climateRules = rulesOverride ?? loadedClimateRules;
  if (!climateRules) throw new Error('八字调候规则尚未加载。');
  validateClimateRules(climateRules);
  const visibleStemSources = positions.map((pillar) => ({ pillar, stem: pillars[pillar].gan }));
  const hiddenStemSources = positions.map((pillar) => ({ pillar, branch: pillars[pillar].zhi, stems: pillars[pillar].hiddenStems.map((item) => item.stem) }));
  const wuxingCounts: Record<string, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  for (const position of positions) { wuxingCounts[pillars[position].stemElement]++; wuxingCounts[pillars[position].branchElement]++; }
  const context: ClimateContext = { strengthStatus: strength.status, yearStem: pillars.year.gan, monthBranch: pillars.month.zhi, hourBranch: pillars.hour.zhi, dayMaster: pillars.day.stemElement, dayStem: pillars.day.gan,
    ...(currentJieqi ? { currentJieqi } : {}), visibleStems: visibleStemSources.map((item) => item.stem), visibleStemSources,
    hiddenStems: hiddenStemSources.flatMap((item) => item.stems), hiddenStemSources,
    formationWuxings: [...new Set(strength.formations.filter((item) => item.established).map((item) => item.element))], wuxingCounts };
  const candidates = climateRules.filter((rule) => matchesKnown(rule.months, context.monthBranch)
    && matchesKnown(rule.dayStems, context.dayStem) && matchesKnown(rule.dayMasters, context.dayMaster))
    .map((rule) => ({ rule, assessment: assessClimateRule(rule, context) }))
    .filter(({ assessment }) => assessment.status !== '不满足')
    .sort((a, b) => (b.rule.priority || 0) - (a.rule.priority || 0))
    .map(({ rule, assessment }) => ({ id: rule.id, label: rule.label as string, priority: (rule.priority ?? 0) as number, status: assessment.status, missingInputs: assessment.missingInputs,
      mode: (rule.policy?.mode ?? 'reference') as string, usefulElement: rule.usefulWuxing as string, favorableOrder: (rule.favorableOrder ?? []) as string[],
      recommendationStems: (rule.recommendationStems ?? []) as string[], hint: rule.hint as string,
      ...(rule.policy ? { source: structuredClone(rule.policy.source), effects: structuredClone(rule.policy.effects) } : {}) }));
  return { applicability: '普通格调候候选' as const, currentJieqi: currentJieqi ?? null, candidates,
    limitation: '候选仅记录规则条件与资料缺口；优先级与冲突另见调候条件层，格局作用、病药及岁运尚未综合，不可直接作为最终用神。' };
}

export function summarizeClimate(value: ReturnType<typeof buildClimateCandidates>) {
  return `${value.applicability}；节气${value.currentJieqi ?? '按月令当季论'}；${value.candidates.map((item) => `${item.label}（${item.status}）`).join('、') || '未列候选'}；最终用神见用神裁定层`;
}
