import { stemElementOf } from './natal-facts';
import type { buildClimateCandidates } from './climate';
import type { buildUsefulBaseline } from './useful-baseline';

type Candidate = ReturnType<typeof buildClimateCandidates>['candidates'][number];
type Baseline = ReturnType<typeof buildUsefulBaseline>;
type Effect = { stem: string; wuxing: string; role: string; targetStems?: string[]; rank?: string };
const stems = [...'甲乙丙丁戊己庚辛壬癸'];
const unique = (items: string[]) => [...new Set(items.filter(Boolean))];
const textPresent = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
function validEffect(effect: Effect) {
  return stems.includes(effect.stem) && stemElementOf(effect.stem) === effect.wuxing && textPresent(effect.role) && (effect.targetStems ?? []).every((stem) => stems.includes(stem));
}
function policyIssue(candidate: Candidate) {
  if (candidate.mode !== 'conditional') return null;
  const source = candidate.source as { title?: string; section?: string; excerpt?: string; url?: string } | undefined;
  if (!source || ![source.title, source.section, source.excerpt, source.url].every(textPresent)) return '条件规则缺少完整来源';
  const effects = (candidate.effects ?? []) as Effect[];
  if (!effects.length || effects.some((effect) => !validEffect(effect))) return '条件规则作用项不完整';
  if (!effects.some((effect) => effect.rank === 'primary')) return '条件规则缺少主作用';
  return null;
}

/** 按规则权限及优先级处理冲突，输出的是调候条件层，不是最终用神。 */
export function resolveClimate(candidates: Candidate[], baseline: Baseline) {
  const order = (candidate: Candidate) => unique([...candidate.favorableOrder, candidate.usefulElement]);
  const referenceOrder = candidates.find((item) => item.status === '满足');
  const issues = candidates.flatMap((candidate) => { const reason = policyIssue(candidate); return reason ? [{ id: candidate.id, reason }] : []; });
  const eligible = candidates.filter((item) => item.status === '满足' && ['conditional', 'within-balance'].includes(item.mode) && !policyIssue(item));
  let selected: Candidate[] = [], conflicts: string[] = [];
  if (eligible.length) {
    const mode = eligible.some((item) => item.mode === 'conditional') ? 'conditional' : 'within-balance';
    const sameMode = eligible.filter((item) => item.mode === mode), topPriority = Math.max(...sameMode.map((item) => item.priority));
    const top = sameMode.filter((item) => item.priority === topPriority);
    if (mode === 'within-balance') {
      if (new Set(top.map((item) => order(item).join('>'))).size > 1) conflicts = top.map((item) => item.id);
      else selected = [top[0]];
    } else {
      const seen = new Map<string, string>(); let conflict = false;
      for (const candidate of top) for (const effect of (candidate.effects ?? []) as Effect[]) {
        if (effect.rank !== 'primary' || !validEffect(effect)) continue;
        const signature = [effect.stem, effect.wuxing, effect.role, [...(effect.targetStems ?? [])].sort().join(',')].join('|');
        if (seen.has(effect.stem) && seen.get(effect.stem) !== signature) conflict = true;
        seen.set(effect.stem, signature);
      }
      if (conflict) conflicts = top.map((item) => item.id); else selected = top;
    }
  }
  let favorable = [...baseline.favorable], unfavorable = [...baseline.unfavorable];
  let conditionalFavorableStems: string[] = [], conditionalUnfavorableStems: string[] = [], conditionalFavorableElements: string[] = [];
  let applied: string[] = [];
  if (selected[0]?.mode === 'within-balance') {
    const compatible = order(selected[0]).filter((item) => favorable.includes(item));
    if (compatible.length) { favorable = [...compatible, ...favorable.filter((item) => !compatible.includes(item))]; applied = selected.map((item) => item.id); }
  } else if (selected[0]?.mode === 'conditional') {
    const effects = selected.flatMap((item) => ((item.effects ?? []) as Effect[]).filter((effect) => effect.rank === 'primary' && validEffect(effect)));
    conditionalFavorableStems = unique(effects.map((effect) => effect.stem));
    conditionalFavorableElements = unique(effects.map((effect) => effect.wuxing));
    const whole = conditionalFavorableElements.filter((element) => stems.filter((stem) => stemElementOf(stem) === element).every((stem) => conditionalFavorableStems.includes(stem)));
    const scoped = conditionalFavorableElements.filter((element) => !whole.includes(element));
    favorable = [...whole, ...favorable.filter((element) => !whole.includes(element))];
    conditionalUnfavorableStems = unique(scoped.flatMap((element) => unfavorable.includes(element) ? stems.filter((stem) => stemElementOf(stem) === element && !conditionalFavorableStems.includes(stem)) : []));
    unfavorable = unfavorable.filter((element) => !conditionalFavorableElements.includes(element));
    applied = selected.map((item) => item.id);
  }
  return { referenceOrder: referenceOrder ? order(referenceOrder) : [], selected: selected.map((item) => item.id), applied, conflicts, issues,
    favorable, unfavorable, conditionalFavorableStems, conditionalUnfavorableStems, conditionalFavorableElements,
    limitation: '仅完成调候候选权限、冲突及基础方向的条件协调；格局成败、病药、具体作用与岁运尚未综合，不是最终用神。' };
}

export function formatClimateDecision(value: ReturnType<typeof resolveClimate>, candidates: Candidate[]) {
  const labels = (ids: string[]) => ids.map((id) => candidates.find((candidate) => candidate.id === id)?.label ?? id).join('、') || '无';
  return `参考顺序：${value.referenceOrder.join('、') || '无'}；选中规则：${labels(value.selected)}；实际采用：${labels(value.applied)}；同权限冲突：${labels(value.conflicts)}。\n条件层有利方向：${value.favorable.join('、') || '待判'}；不利方向：${value.unfavorable.join('、') || '待判'}；条件有利干：${value.conditionalFavorableStems.join('、') || '无'}；条件不利干：${value.conditionalUnfavorableStems.join('、') || '无'}。\n${value.issues.map((issue) => `${issue.id}：${issue.reason}`).join('；')}${value.issues.length ? '。' : ''}${value.limitation}`;
}

export function summarizeClimateDecision(value: ReturnType<typeof resolveClimate>) {
  return `调候条件层有利${value.favorable.join('、') || '待判'}、不利${value.unfavorable.join('、') || '待判'}；条件有利干${value.conditionalFavorableStems.join('、') || '无'}、不利干${value.conditionalUnfavorableStems.join('、') || '无'}；冲突${value.conflicts.join('、') || '无'}；非最终用神`;
}
