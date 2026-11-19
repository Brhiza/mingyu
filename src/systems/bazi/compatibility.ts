import { getTenStar } from '../ganzhi-foundation';
import { isKe, isSheng } from '../calendar';
import { branchFormationGroups, comparePillars } from './natal-facts';
import type { BaziPillar, PillarName } from './pillars';

type Pillars = Record<PillarName, BaziPillar>;
const positions: PillarName[] = ['year', 'month', 'day', 'hour'];
const personIds = ['person1', 'person2'] as const;
const relation = (source: string, target: string) => source === target ? '同类' : isSheng(source, target) ? '生对方' : isSheng(target, source) ? '受对方生' : isKe(source, target) ? '克对方' : '受对方克';
const tenGod = (master: string, target: string) => getTenStar(master, target);

/** 双方四柱全部交叉比较；关系是盘面事实，不直接推导现实关系结果。 */
export function buildBaziCompatibility(person1: Pillars, person2: Pillars) {
  const charts = { person1, person2 };
  const day1 = person1.day, day2 = person2.day;
  const dayMasterRelation = { person1Stem: day1.gan, person1Element: day1.stemElement, person2Stem: day2.gan, person2Element: day2.stemElement,
    person1ToPerson2: relation(day1.stemElement, day2.stemElement), person2ToPerson1: relation(day2.stemElement, day1.stemElement),
    person2AsPerson1TenGod: tenGod(day1.gan, day2.gan), person1AsPerson2TenGod: tenGod(day2.gan, day1.gan) };
  const comparisons = positions.flatMap((left) => positions.map((right) => {
    const a = person1[left], b = person2[right], relations = comparePillars(a, b);
    // 同柱伏吟已包含同支；另列同支以保留地支单独覆盖事实。
    if (a.zhi === b.zhi && !relations.some((item) => item.name === '地支同支')) relations.push({ name: '地支同支', values: [a.zhi, b.zhi] });
    return { person1Pillar: left, person2Pillar: right, person1GanZhi: a.ganZhi, person2GanZhi: b.ganZhi, relations };
  }));
  const combinations = branchFormationGroups.flatMap((group) => {
    const members = [...group.members].map((branch) => ({ branch, sources: personIds.flatMap((person) => positions.filter((pillar) => charts[person][pillar].zhi === branch).map((pillar) => ({ person, pillar }))) }));
    if (members.some((member) => !member.sources.length) || new Set(members.flatMap((member) => member.sources.map((source) => source.person))).size < 2) return [];
    return [{ name: group.name, element: group.element, members }];
  });
  const tenGodMappings = personIds.flatMap((observer) => {
    const source = observer === 'person1' ? 'person2' as const : 'person1' as const;
    const master = charts[observer].day.gan;
    return positions.map((pillar) => {
      const p = charts[source][pillar], main = p.hiddenStems[0].stem;
      return { observer, source, pillar, stem: p.gan, stemTenGod: tenGod(master, p.gan), branch: p.zhi, mainStem: main, branchMainTenGod: tenGod(master, main) };
    });
  });
  return { dayMasterRelation, comparisons, combinations, tenGodMappings,
    usefulGodCoverage: { status: '待计算' as const, reason: '独立八字尚未完成双方喜用与忌神分析。' },
    limitation: '双方干支配对、十神映射及三支齐备仅为结构事实；不证明成化、双方感情、相处行为、合作收益或事件结果。' };
}
