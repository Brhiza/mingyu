import { getTenStar, STEM_WUXING } from '../ganzhi-foundation';
import type { BaziPillar, PillarName } from './pillars';

const positions: PillarName[] = ['year', 'month', 'day', 'hour'];
const stemElements: Record<string, string> = STEM_WUXING;
const pairs = (values: string[]) => new Set(values.flatMap(([a, b]) => [a + b, b + a]));
const branchPairs = {
  六合: pairs(['子丑', '寅亥', '卯戌', '辰酉', '巳申', '午未']),
  六冲: pairs(['子午', '丑未', '寅申', '卯酉', '辰戌', '巳亥']),
  六害: pairs(['子未', '丑午', '寅巳', '卯辰', '申亥', '酉戌']),
  相破: pairs(['子酉', '丑辰', '寅亥', '卯午', '巳申', '未戌']),
};
const stemPairs = { 天干五合: pairs(['甲己', '乙庚', '丙辛', '丁壬', '戊癸']), 天干相冲: pairs(['甲庚', '乙辛', '丙壬', '丁癸']) };
export const branchFormationGroups = [
  { name: '三合局', element: '水', members: '申子辰' }, { name: '三合局', element: '木', members: '亥卯未' },
  { name: '三合局', element: '火', members: '寅午戌' }, { name: '三合局', element: '金', members: '巳酉丑' },
  { name: '三会局', element: '木', members: '寅卯辰' }, { name: '三会局', element: '火', members: '巳午未' },
  { name: '三会局', element: '金', members: '申酉戌' }, { name: '三会局', element: '水', members: '亥子丑' },
] as const;
const halfGroups = [
  { name: '生地半合', element: '木', members: '卯亥' }, { name: '墓地半合', element: '木', members: '卯未' },
  { name: '生地半合', element: '火', members: '寅午' }, { name: '墓地半合', element: '火', members: '午戌' },
  { name: '生地半合', element: '金', members: '巳酉' }, { name: '墓地半合', element: '金', members: '丑酉' },
  { name: '生地半合', element: '水', members: '子申' }, { name: '墓地半合', element: '水', members: '子辰' },
] as const;
const halfPairs = halfGroups.map((group) => ({ ...group, pairs: pairs([group.members]) }));
const tenGods = ['比肩', '劫财', '正印', '偏印', '食神', '伤官', '正财', '偏财', '正官', '七杀'] as const;
const familyMembers = { 比劫: ['比肩', '劫财'], 印绶: ['正印', '偏印'], 食伤: ['食神', '伤官'], 财才: ['正财', '偏财'], 官杀: ['正官', '七杀'] } as const;
const seasonStates: Record<string, Record<string, string>> = {
  木: { 木: '旺', 火: '相', 土: '死', 金: '囚', 水: '休' },
  火: { 火: '旺', 土: '相', 金: '死', 水: '囚', 木: '休' },
  土: { 土: '旺', 金: '相', 水: '死', 木: '囚', 火: '休' },
  金: { 金: '旺', 水: '相', 木: '死', 火: '囚', 土: '休' },
  水: { 水: '旺', 木: '相', 火: '死', 土: '囚', 金: '休' },
};
export function stemElementOf(stem: string) {
  const element = stemElements[stem];
  if (!element) throw new Error(`未知天干：${stem}`);
  return element;
}
export function seasonalState(monthElement: string, element: string) {
  const state = seasonStates[monthElement]?.[element];
  if (!state) throw new Error(`无法确定月令五行状态：${monthElement}/${element}`);
  return state;
}
export function branchesClash(first: string, second: string) { return branchPairs.六冲.has(first + second); }
const overcome = pairs(['木土', '土水', '水火', '火金', '金木']);

function punishment(a: string, b: string) {
  if ((a === '子' && b === '卯') || (a === '卯' && b === '子')) return '无礼之刑';
  if (a !== b && '寅巳申'.includes(a) && '寅巳申'.includes(b)) return '无恩之刑';
  if (a !== b && '丑戌未'.includes(a) && '丑戌未'.includes(b)) return '恃势之刑';
  if (a === b && '辰午酉亥'.includes(a)) return '自刑';
  return undefined;
}

type Pillars = Record<PillarName, BaziPillar>;
export interface NatalRelation {
  name: string; positions: PillarName[]; values: string[]; element?: string; subtype?: string;
}

/** 两柱之间只返回固定干支配对；同柱伏吟不重复计同干、同支。 */
export function comparePillars(a: BaziPillar, b: BaziPillar) {
  const stems = a.gan + b.gan, branches = a.zhi + b.zhi;
  const result: Array<{ name: string; values: string[]; subtype?: string }> = [];
  if (a.ganZhi === b.ganZhi) result.push({ name: '同柱伏吟', values: [a.ganZhi, b.ganZhi] });
  else {
    if (a.gan === b.gan) result.push({ name: '天干同干', values: [...stems] });
    if (a.zhi === b.zhi) result.push({ name: '地支同支', values: [...branches] });
  }
  if (overcome.has(a.stemElement + b.stemElement) && branchPairs.六冲.has(branches)) result.push({ name: '天克地冲', values: [a.ganZhi, b.ganZhi] });
  for (const [name, table] of Object.entries(stemPairs)) if (table.has(stems)) result.push({ name, values: [...stems] });
  for (const [name, table] of Object.entries(branchPairs)) if (table.has(branches)) result.push({ name, values: [...branches] });
  const subtype = punishment(a.zhi, b.zhi);
  if (subtype) result.push({ name: '相刑', values: [...branches], subtype });
  return result;
}

/** 逐柱记录固定配对及根的直接来源，不裁定合化、冲根程度、旺衰或格局。 */
export function buildNatalFacts(pillars: Pillars, commanderStem?: string) {
  const relations: NatalRelation[] = [];
  for (let i = 0; i < positions.length; i++) for (let j = i + 1; j < positions.length; j++) {
    const a = positions[i], b = positions[j], branches = pillars[a].zhi + pillars[b].zhi;
    for (const fact of comparePillars(pillars[a], pillars[b])) relations.push({ ...fact, positions: [a, b] });
    for (const half of halfPairs) if (half.pairs.has(branches)) relations.push({ name: half.name, element: half.element, positions: [a, b], values: [...branches] });
    for (let k = j + 1; k < positions.length; k++) {
      const c = positions[k], values = [pillars[a].zhi, pillars[b].zhi, pillars[c].zhi], members = new Set(values);
      for (const group of branchFormationGroups) if (members.size === 3 && [...group.members].every((value) => members.has(value))) {
        relations.push({ name: group.name, element: group.element, positions: [a, b, c], values });
      }
    }
  }
  const roots = positions.map((position) => {
    const { gan: stem, stemElement, tenGod } = pillars[position];
    const sources = positions.flatMap((rootPosition) => {
      const root = pillars[rootPosition];
      const clashSources = positions.filter((other) => other !== rootPosition && branchPairs.六冲.has(root.zhi + pillars[other].zhi))
        .map((other) => ({ position: other, branch: pillars[other].zhi }));
      return root.hiddenStems.flatMap((hidden, index) => stemElements[hidden.stem] === stemElement ? [{
        position: rootPosition, branch: root.zhi, stem: hidden.stem, hiddenIndex: index,
        hiddenRole: (['本气', '中气', '余气'] as const)[index], kind: hidden.stem === stem ? '本根' as const : '同气根' as const, clashSources,
      }] : []);
    });
    return { position, stem, tenGod: position === 'day' ? getTenStar(stem, stem) : tenGod,
      status: sources.some((source) => source.kind === '本根') ? '有本根' : sources.length ? '有同气根' : '无根', sources };
  });
  const tenGodDistribution = tenGods.map((tenGod) => ({ tenGod,
    visible: positions.filter((position) => position !== 'day' && pillars[position].tenGod === tenGod),
    hidden: positions.flatMap((position) => pillars[position].hiddenStems.flatMap((hidden, index) => hidden.tenGod === tenGod ? [{ position, stem: hidden.stem, hiddenIndex: index }] : [])),
  }));
  const tenGodFamilies = Object.entries(familyMembers).map(([family, members]) => ({ family,
    members: tenGodDistribution.filter((item) => (members as readonly string[]).includes(item.tenGod)).map((item) => item.tenGod),
    visibleCount: tenGodDistribution.filter((item) => (members as readonly string[]).includes(item.tenGod)).reduce((sum, item) => sum + item.visible.length, 0),
    hiddenCount: tenGodDistribution.filter((item) => (members as readonly string[]).includes(item.tenGod)).reduce((sum, item) => sum + item.hidden.length, 0),
  }));
  const month = pillars.month;
  const exposedStems = positions.map((position) => ({ position, stem: pillars[position].gan,
    matchesCommander: commanderStem === undefined ? null : pillars[position].gan === commanderStem,
    monthHiddenIndex: month.hiddenStems.findIndex((hidden) => hidden.stem === pillars[position].gan),
    sameElementAsMonthBranch: pillars[position].stemElement === month.branchElement,
    seasonStatus: seasonStates[month.branchElement][pillars[position].stemElement],
    rootStatus: roots.find((root) => root.position === position)!.status,
  }));
  return { relations, roots, tenGodDistribution, tenGodFamilies, exposedStems,
    limitation: '配对和透藏只反映原局结构；是否合化、冲根、作用成立或身强身弱，须另行分析。' };
}
