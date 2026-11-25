import type { z } from 'zod';
import type { almanacInput } from '../../schema';
import { calculateBaziPillars } from '../bazi/pillars';
import { calculateUnknownBaziTime } from '../bazi/unknown-time';
import { determineUsefulGod } from '../bazi/useful-god';
import { getStemWuxing } from '../ganzhi-foundation';
import { getSanxingType, isLiuchong, isLiuhai, isLiupo, isSanxing } from '../liuyao/relations';

type Participant = NonNullable<z.infer<typeof almanacInput>['participants']>[number];
type Interval = { startTimestamp: number; endTimestamp: number; endExclusive: true };
type Variant = { yearBranch: string; dayBranch: string; intervals: Interval[] };
const branches = [...'子丑寅卯辰巳午未申酉戌亥'];

/** 比较两支的四类关系；保留同一对地支可能同时命中的多种关系。 */
export function participantBranchConflicts(candidate: string, target: string) {
  if (!branches.includes(candidate) || !branches.includes(target)) throw new Error('参与人关系需要有效地支。');
  return [
    ...(isLiuchong(candidate, target) ? [{ type: '冲' as const }] : []),
    ...(isSanxing(candidate, target) ? [{ type: '刑' as const, detail: getSanxingType(candidate) }] : []),
    ...(isLiuhai(candidate, target) ? [{ type: '害' as const }] : []),
    ...(isLiupo(candidate, target) ? [{ type: '破' as const }] : []),
  ];
}

export async function participantProfile(person: Participant, index: number, options?: { includeBaziMatch?: boolean }) {
  const { clock, ...birth } = person.birth;
  let variants: Variant[], basis: { precision: string; excludedSeconds: number; utcTimestamp?: number };
  let baziUsefulGod: { dayMaster: string; dayMasterElement: string; incrementStatus: string; favorable: string[]; primaryUnfavorable: string[]; unfavorable: string[]; climateReferenceOrder: string[] } | undefined;
  let baziUsefulGodNote: string | undefined;
  if (clock.kind === 'exact') {
    const chart = await calculateBaziPillars({ ...birth, clock }, person.gender);
    variants = [{ yearBranch: chart.pillars.year.zhi, dayBranch: chart.pillars.day.zhi, intervals: [] }];
    basis = { precision: '精确时刻', excludedSeconds: 0, utcTimestamp: chart.basis.utcTimestamp };
    if (options?.includeBaziMatch) {
      const usefulGod = determineUsefulGod(chart);
      baziUsefulGod = {
        dayMaster: chart.pillars.day.gan,
        dayMasterElement: getStemWuxing(chart.pillars.day.gan),
        incrementStatus: usefulGod.incrementStatus,
        favorable: usefulGod.favorableWuxing,
        primaryUnfavorable: usefulGod.primaryUnfavorableWuxing ? [usefulGod.primaryUnfavorableWuxing] : [],
        unfavorable: usefulGod.unfavorableWuxing,
        climateReferenceOrder: usefulGod.decisionEvidence.climateReferenceOrder ?? [],
      };
    }
  } else {
    const result = await calculateUnknownBaziTime({ ...birth, ...(clock.kind === 'shichen' ? { shichenIndex: clock.index } : {}) }, person.gender);
    variants = [];
    for (const segment of result.segments) {
      const yearBranch = segment.pillars.year.zhi, dayBranch = segment.pillars.day.zhi;
      let variant = variants.find((item) => item.yearBranch === yearBranch && item.dayBranch === dayBranch);
      if (!variant) { variant = { yearBranch, dayBranch, intervals: [] }; variants.push(variant); }
      const previous = variant.intervals.at(-1);
      if (previous?.endTimestamp === segment.startTimestamp) previous.endTimestamp = segment.endTimestamp;
      else variant.intervals.push({ startTimestamp: segment.startTimestamp, endTimestamp: segment.endTimestamp, endExclusive: true });
    }
    if (!variants.length) throw new Error('参与人出生时段没有可用候选。');
    basis = { precision: clock.kind === 'shichen' ? '时辰范围' : '时辰未知', excludedSeconds: result.source.excludedSeconds };
    if (options?.includeBaziMatch) {
      baziUsefulGodNote = '出生时刻未精确，暂不结合八字喜用五行，仅核对年支日支关系。';
    }
  }
  const relationsByBranch = branches.map((candidateBranch) => {
    const outcomes = variants.map((variant) => ({ yearBranch: variant.yearBranch, dayBranch: variant.dayBranch, intervals: variant.intervals,
      conflicts: (['year', 'day'] as const).flatMap((scope) => {
        const targetBranch = scope === 'year' ? variant.yearBranch : variant.dayBranch;
        return participantBranchConflicts(candidateBranch, targetBranch).map((relation) => ({ scope, targetBranch, ...relation }));
      }) }));
    const signatures = new Set(outcomes.map((outcome) => JSON.stringify(outcome.conflicts)));
    return { candidateBranch, stability: signatures.size === 1 ? '稳定' as const : '有条件' as const, outcomes };
  });
  return { id: index + 1, name: person.name, basis, variants, relationsByBranch,
    ...(baziUsefulGod ? { baziUsefulGod } : {}),
    ...(baziUsefulGodNote ? { baziUsefulGodNote } : {}),
    limitation: options?.includeBaziMatch
      ? '除核对候选日支或时支与参与人年支、日支的刑冲破害外，对精确出生者结合八字喜用与避忌五行比对干支五行；出生时段不确定时须分别核对各候选，不代表概率。'
      : '只比较候选日支或时支与参与人年支、日支的刑冲破害；不计算喜忌与完整择日合参。出生时段不确定时须分别核对各候选，不代表概率。' };
}
