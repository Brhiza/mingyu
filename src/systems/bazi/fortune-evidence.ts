import type { BaziPillar, PillarName } from './pillars';
import { branchFormationGroups, comparePillars } from './natal-facts';

type ActiveName = 'dayun' | 'year' | 'month' | 'day' | 'hour';
type Layer = { id: string; ganZhi: string; pillar: BaziPillar };
type ActiveLayer = Layer & { id: ActiveName };
const positions: PillarName[] = ['year', 'month', 'day', 'hour'];

/** 对原局与指定瞬时的岁运逐层比对；没有命中的层级对也保留。 */
export function buildFortuneEvidence(pillars: Record<PillarName, BaziPillar>, active: ActiveLayer[]) {
  const natal: Layer[] = positions.map((position) => ({ id: `natal-${position}`, ganZhi: pillars[position].ganZhi, pillar: pillars[position] }));
  const comparisons = active.flatMap((source, index) => [...natal, ...active.slice(0, index)].map((target) => {
    const relations = comparePillars(source.pillar, target.pillar);
    if (((source.id === 'year' && target.id === 'dayun') || (source.id === 'dayun' && target.id === 'year')) && source.ganZhi === target.ganZhi) {
      relations.push({ name: '岁运并临', values: [source.ganZhi, target.ganZhi] });
    }
    return { source: source.id, sourceGanZhi: source.ganZhi, target: target.id, targetGanZhi: target.ganZhi, relations };
  }));
  const natalBranches = new Set(natal.map((layer) => layer.pillar.zhi));
  const all = [...natal, ...active];
  const formations = branchFormationGroups.flatMap((group) => {
    const members = [...group.members];
    if (members.every((branch) => natalBranches.has(branch)) || !members.every((branch) => all.some((layer) => layer.pillar.zhi === branch))) return [];
    const participants = all.filter((layer) => members.includes(layer.pillar.zhi)).map((layer) => ({ layer: layer.id, branch: layer.pillar.zhi }));
    const missing = members.filter((branch) => !natalBranches.has(branch));
    return [{ name: group.name, element: group.element, branches: members, participants,
      triggers: active.filter((layer) => missing.includes(layer.pillar.zhi)).map((layer) => ({ layer: layer.id, branch: layer.pillar.zhi })) }];
  });
  return { comparisons, formations,
    limitation: '只比较所列原局及岁运层级的固定干支关系；三支齐全不等于成化，关系成立也不单独决定事件、吉凶或应期。' };
}
