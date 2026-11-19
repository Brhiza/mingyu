import { stemElementOf } from './natal-facts';
import type { PillarName } from './pillars';

type Position = PillarName;
type Source = { pillar: Position; stem: string };
type HiddenSource = { pillar: Position; branch: string; stems: string[] };
export interface ClimateContext {
  strengthStatus?: string; yearStem?: string; monthBranch?: string; hourBranch?: string; dayMaster?: string; dayStem?: string; currentJieqi?: string;
  visibleStems?: string[]; hiddenStems?: string[]; visibleStemSources?: Source[]; hiddenStemSources?: HiddenSource[];
  formationWuxings?: string[]; wuxingCounts?: Record<string, number>;
}
export type ClimateRule = Record<string, any> & { id: string };
const order: Position[] = ['year', 'month', 'day', 'hour'];
const produces: Record<string, string> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const controls: Record<string, string> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
const metadata = new Set(['id', 'label', 'description', 'priority', 'usefulWuxing', 'favorableOrder', 'hint', 'policy', 'recommendationStems', 'traceHints']);
const elementsCategory = (day: string, element: string) => {
  const own = stemElementOf(day);
  return own === element ? '比劫' : produces[own] === element ? '食伤' : controls[own] === element ? '财星' : controls[element] === own ? '官杀' : produces[element] === own ? '印星' : '';
};
const enabled = (value: any) => value !== undefined && (typeof value !== 'object' || value === null || Object.keys(value).length > 0);
const allowPillar = (pillars: Position[] | undefined, p: Position) => !pillars?.length || pillars.includes(p);

/** 未提供输入与已检查为空严格区分；未知条件直接报错，避免静默扩大规则。 */
export function assessClimateRule(rule: ClimateRule, context: ClimateContext) {
  const missing = new Set<keyof ClimateContext>(); let passes = true;
  const check = (dependencies: (keyof ClimateContext)[], predicate: () => boolean) => {
    const absent = dependencies.filter((key) => context[key] === undefined);
    if (absent.length) absent.forEach((key) => missing.add(key)); else if (!predicate()) passes = false;
  };
  for (const [key, raw] of Object.entries(rule)) {
    if (metadata.has(key) || !enabled(raw)) continue;
    const value: any = raw;
    const scalars: Record<string, keyof ClimateContext> = { strengths: 'strengthStatus', yearStems: 'yearStem', months: 'monthBranch', hourBranches: 'hourBranch', dayMasters: 'dayMaster', dayStems: 'dayStem', currentJieqi: 'currentJieqi' };
    if (key in scalars) { const field = scalars[key]; check([field], () => value.includes(context[field])); continue; }
    const simple: Record<string, [keyof ClimateContext, 'all' | 'any' | 'none']> = {
      requiredVisibleStems: ['visibleStems', 'all'], optionalVisibleStems: ['visibleStems', 'any'], forbiddenVisibleStems: ['visibleStems', 'none'],
      requiredHiddenStems: ['hiddenStems', 'all'], optionalHiddenStems: ['hiddenStems', 'any'], forbiddenHiddenStems: ['hiddenStems', 'none'],
      requiredFormationWuxings: ['formationWuxings', 'all'], forbiddenFormationWuxings: ['formationWuxings', 'none'],
    };
    if (key in simple) { const [field, mode] = simple[key]; check([field], () => { const actual = context[field] as string[]; return mode === 'all' ? value.every((v: string) => actual.includes(v)) : mode === 'any' ? value.some((v: string) => actual.includes(v)) : value.every((v: string) => !actual.includes(v)); }); continue; }
    if (/^(required|optional|forbidden)FormationTenGodCategories$/.test(key)) {
      check(['dayStem', 'formationWuxings'], () => { const cats: string[] = context.formationWuxings!.map((v) => elementsCategory(context.dayStem!, v)); return key.startsWith('required') ? value.every((v: string) => cats.includes(v)) : key.startsWith('optional') ? value.some((v: string) => cats.includes(v)) : value.every((v: string) => !cats.includes(v)); }); continue;
    }
    if (/^(required|optional|forbidden)(VisibleStemPillarPairs|VisibleStemBranchPairs|VisibleStemDistancePairs|BranchPillarPairs|HiddenStemBranchPairs)$/.test(key)) {
      const visible = key.includes('VisibleStem'), branchPair = key.includes('BranchPairs');
      const deps: (keyof ClimateContext)[] = visible ? ['visibleStemSources'] : ['hiddenStemSources'];
      if (visible && branchPair) deps.push('hiddenStemSources');
      check(deps, () => {
        const has = (spec: any) => {
          if (key.includes('VisibleStemDistancePairs')) return context.visibleStemSources!.some((a, i) => a.stem === spec.stems[0] && allowPillar(spec.leftPillars, a.pillar) && context.visibleStemSources!.some((b, j) => {
            const d = Math.abs(order.indexOf(a.pillar) - order.indexOf(b.pillar)); return i !== j && b.stem === spec.stems[1] && allowPillar(spec.rightPillars, b.pillar) && (spec.minDistance === undefined || d >= spec.minDistance) && (spec.maxDistance === undefined || d <= spec.maxDistance);
          }));
          if (key.includes('VisibleStemBranchPairs')) return context.visibleStemSources!.some((a) => a.stem === spec.stem && allowPillar(spec.pillars, a.pillar) && context.hiddenStemSources!.some((b) => b.pillar === a.pillar && b.branch === spec.branch));
          if (visible) return context.visibleStemSources!.some((a) => a.stem === spec.stem && allowPillar(spec.pillars, a.pillar));
          return context.hiddenStemSources!.some((a) => a.branch === spec.branch && allowPillar(spec.pillars, a.pillar) && (!key.includes('HiddenStemBranchPairs') || a.stems.includes(spec.stem)));
        };
        return key.startsWith('required') ? value.every(has) : key.startsWith('optional') ? value.some(has) : value.every((v: any) => !has(v));
      }); continue;
    }
    if (key === 'distinctStemGroupCounts') {
      for (const group of value) { const deps: (keyof ClimateContext)[] = group.scope === 'visible' ? ['visibleStems'] : group.scope === 'hidden' ? ['hiddenStems'] : ['visibleStems', 'hiddenStems'];
        check(deps, () => { const stems = deps.flatMap((p) => context[p] as string[]); const count = new Set(stems.filter((s) => group.stems.includes(s))).size; return (group.minDistinctCount === undefined || count >= group.minDistinctCount) && (group.maxDistinctCount === undefined || count <= group.maxDistinctCount); }); }
      continue;
    }
    if (key === 'minCompanionVisibleCount' || key === 'maxCompanionVisibleCount') {
      check(['dayStem', 'visibleStems'], () => { const day = context.dayStem!, stems = context.visibleStems!, count = Math.max(stems.filter((s) => stemElementOf(s) === stemElementOf(day)).length - (stems.includes(day) ? 1 : 0), 0); return key.startsWith('min') ? count >= value : count <= value; }); continue;
    }
    const countMatch = /^(min|max)(VisibleStem|HiddenStem|StemTotal|Wuxing|TenGodCategoryVisibleDistinct|TenGodCategoryTotalDistinct|TenGodCategoryVisible|TenGodCategoryHidden|TenGodCategoryTotal)Counts$/.exec(key);
    if (countMatch) {
      const [, bound, kind] = countMatch, deps: (keyof ClimateContext)[] = kind === 'Wuxing' ? ['wuxingCounts'] : kind === 'VisibleStem' ? ['visibleStems'] : kind === 'HiddenStem' ? ['hiddenStems'] : kind === 'StemTotal' ? ['visibleStems', 'hiddenStems'] : kind.includes('Visible') ? ['dayStem', 'visibleStems'] : kind.includes('Hidden') ? ['dayStem', 'hiddenStems'] : ['dayStem', 'visibleStems', 'hiddenStems'];
      check(deps, () => {
        let counts: Record<string, number> = {};
        if (kind === 'Wuxing') counts = context.wuxingCounts!;
        else if (kind.startsWith('TenGodCategory')) {
          const day = context.dayStem!, visible = kind.includes('Hidden') ? [] : [...context.visibleStems!], hidden = kind.includes('Visible') ? [] : [...context.hiddenStems!];
          const distinct = kind.includes('Distinct');
          if (distinct) { const stems = [...visible.filter((s) => s !== day), ...hidden]; for (const stem of new Set(stems)) { const cat = elementsCategory(day, stemElementOf(stem)); counts[cat] = (counts[cat] || 0) + 1; } }
          else { const index = visible.indexOf(day); if (index >= 0) visible.splice(index, 1); for (const stem of [...visible, ...hidden]) { const cat = elementsCategory(day, stemElementOf(stem)); counts[cat] = (counts[cat] || 0) + 1; } }
        } else { const stems = kind === 'VisibleStem' ? context.visibleStems! : kind === 'HiddenStem' ? context.hiddenStems! : [...context.visibleStems!, ...context.hiddenStems!]; for (const stem of stems) counts[stem] = (counts[stem] || 0) + 1; }
        return Object.entries(value as Record<string, number>).every(([name, threshold]) => bound === 'min' ? (counts[name] || 0) >= threshold : (counts[name] || 0) <= threshold);
      }); continue;
    }
    throw new Error(`未知调候规则条件：${key}`);
  }
  return { status: passes ? (missing.size ? '资料不足' as const : '满足' as const) : '不满足' as const, missingInputs: [...missing] };
}
