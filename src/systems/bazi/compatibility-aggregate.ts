import { buildBaziCompatibility } from './compatibility';
import type { BaziPillar, PillarName } from './pillars';

type Candidate = { index: number | null; pillars: Record<PillarName, BaziPillar> };
type Compatibility = ReturnType<typeof buildBaziCompatibility>;
type Fact =
  | { kind: '日主关系'; value: Compatibility['dayMasterRelation'] }
  | { kind: '跨柱关系'; person1Pillar: PillarName; person2Pillar: PillarName; name: string; values: string[]; subtype?: string }
  | { kind: '跨盘组合'; value: Compatibility['combinations'][number] }
  | { kind: '双向十神'; value: Compatibility['tenGodMappings'][number] };

/** 事实标识含完整柱位、取值和成员来源；组合数不是出生概率。 */
export function aggregateBaziCompatibility(first: Candidate[], second: Candidate[], page?: { offset?: number; limit?: number }) {
  const total = first.length * second.length;
  if (!total || total > 2048) throw new Error('双盘候选组合须在 1 至 2048 组之间。');
  const facts = new Map<string, { fact: Fact; count: number; example: { person1Index: number | null; person2Index: number | null } }>();
  for (const a of first) for (const b of second) {
    const evidence = buildBaziCompatibility(a.pillars, b.pillars);
    const entries: Fact[] = [
      { kind: '日主关系', value: evidence.dayMasterRelation },
      ...evidence.comparisons.flatMap((pair) => pair.relations.map((item) => ({ kind: '跨柱关系' as const, person1Pillar: pair.person1Pillar, person2Pillar: pair.person2Pillar, ...item }))),
      ...evidence.combinations.map((value) => ({ kind: '跨盘组合' as const, value })),
      ...evidence.tenGodMappings.map((value) => ({ kind: '双向十神' as const, value })),
    ];
    const seen = new Set<string>();
    for (const fact of entries) {
      const key = JSON.stringify(fact);
      if (seen.has(key)) continue;
      seen.add(key);
      const existing = facts.get(key);
      if (existing) existing.count++;
      else facts.set(key, { fact, count: 1, example: { person1Index: a.index, person2Index: b.index } });
    }
  }
  const all = [...facts.values()], variable = all.filter((item) => item.count < total), offset = page?.offset ?? 0, limit = page?.limit ?? 100;
  if (offset > 0 && offset >= variable.length) throw new Error('候选变化事实分页偏移超出范围。');
  return { person1Candidates: first.length, person2Candidates: second.length, total,
    common: all.filter((item) => item.count === total), variable: variable.slice(offset, offset + limit), variableTotal: variable.length,
    page: { offset, limit, nextOffset: offset + limit < variable.length ? offset + limit : null },
    limitation: '按候选时段组合计数，不按时段长度或出生概率加权；共同出现只表示所列结构在每组候选中存在，不证明现实结果。' };
}
