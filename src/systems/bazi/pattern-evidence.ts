import { getTenStar } from '../ganzhi-foundation';
import type { BaziPillar, PillarName } from './pillars';
import type { summarizePattern } from './pattern';
import { collectTraditionalRoots } from './strength';
import { buildPatternPaths } from './pattern-paths';
import { decideOrdinaryPattern } from './pattern-decision';

type Pillars = Record<PillarName, BaziPillar>;
const positions: PillarName[] = ['year', 'month', 'day', 'hour'];
const labels: Record<PillarName, string> = { year: '年柱', month: '月柱', day: '日柱', hour: '时柱' };
const pairs: Record<string, string> = { 甲: '己', 己: '甲', 乙: '庚', 庚: '乙', 丙: '辛', 辛: '丙', 丁: '壬', 壬: '丁', 戊: '癸', 癸: '戊' };
const clashes: Record<string, string> = { 甲: '庚', 庚: '甲', 乙: '辛', 辛: '乙', 丙: '壬', 壬: '丙', 丁: '癸', 癸: '丁' };
const controls: Record<string, string> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

/** 透干可用性只供后续格局路径核验，不独自推导成败。 */
export function buildPatternEvidence(pillars: Pillars, pattern: ReturnType<typeof summarizePattern>, commanderStem: string, strength?: string) {
  const harmonies = positions.flatMap((left, i) => positions.slice(i + 1).flatMap((right) => {
    const a = pillars[left].gan, b = pillars[right].gan;
    if (pairs[a] !== b) return [];
    const clashSources = positions.filter((position) => position !== left && position !== right && (pillars[position].gan === clashes[a] || pillars[position].gan === clashes[b]))
      .map((position) => ({ position, stem: pillars[position].gan }));
    return [{ participants: [{ position: left, stem: a }, { position: right, stem: b }], adjacent: Math.abs(positions.indexOf(left) - positions.indexOf(right)) === 1,
      clashSources, blocked: clashSources.length === 0 }];
  }));
  const roots = new Map<string, ReturnType<typeof collectTraditionalRoots>>();
  const rootsFor = (element: string) => { if (!roots.has(element)) roots.set(element, collectTraditionalRoots(pillars, element)); return roots.get(element)!; };
  const visible = positions.filter((position) => position !== 'day').map((position) => {
    const pillar = pillars[position], rootFacts = rootsFor(pillar.stemElement), effectiveRoots = rootFacts.filter((root) => root.actionable && root.kind !== '弱藏');
    const principal = pillars.month.hiddenStems[0].stem, principalElement = pillars.month.branchElement;
    const monthControlled = position === 'month' && principal !== pillar.gan && controls[principalElement] === pillar.stemElement;
    const actionable = effectiveRoots.length > 0 && (!monthControlled || effectiveRoots.some((root) => root.kind === '本气'));
    const harmony = harmonies.filter((item) => item.participants.some((participant) => participant.position === position) && item.blocked);
    return { position, stem: pillar.gan, tenGod: pillar.tenGod, element: pillar.stemElement, rooted: rootFacts.length > 0,
      rootType: rootFacts.some((root) => root.stem === pillar.gan) ? '本根' : rootFacts.length ? '同类根' : '无根',
      roots: structuredClone(rootFacts), monthControlled, ...(monthControlled ? { controller: principal } : {}), actionable, harmony, effective: actionable && harmony.length === 0 };
  });
  const normalized = pattern.pattern.replace(/^杂气/, '').replace(/^偏官/, '七杀');
  const target = ['正官', '七杀', '正财', '偏财', '正印', '偏印', '食神', '伤官'].find((god) => normalized.includes(god));
  const monthGods = pillars.month.hiddenStems.filter((item) => item.tenGod === target);
  const commanderGod = getTenStar(pillars.day.gan, commanderStem);
  const gate = pattern.source === '普通月令取格候选' && target ? { target, status: monthGods.length || commanderGod === target ? '满足' : '不满足',
    monthHiddenStems: monthGods.map((item) => item.stem), commanderStem, commanderGod, commanderMatches: commanderGod === target } : null;
  const paths = buildPatternPaths(pillars, pattern.pattern, pattern.source, visible, harmonies);
  const decision = decideOrdinaryPattern(pillars, pattern.pattern, pattern.source, commanderStem, visible, paths, strength);
  return { visible, harmonies, monthGate: gate, paths, decision,
    limitation: '仅核对所列普通格局条件；其他流派、完整破格救应和最终用神尚未裁定。' };
}

export function formatPatternEvidence(data: ReturnType<typeof buildPatternEvidence>) {
  const visible = data.visible.map((item) => `${labels[item.position]}${item.stem}${item.tenGod}（${item.rootType}${item.monthControlled ? `，受月支本气${item.controller}克` : ''}${item.harmony.length ? '，存在合绊' : ''}，${item.effective ? '可用' : item.harmony.length ? '合绊受阻' : item.monthControlled ? '受月令克制减力' : '无可用强根'}）`);
  const gate = data.monthGate ? `${data.monthGate.target}月令条件${data.monthGate.status}；月支藏干${data.monthGate.monthHiddenStems.join('、') || '无'}；司权${data.monthGate.commanderStem}${data.monthGate.commanderGod}${data.monthGate.commanderMatches ? '符合' : '不符'}。` : data.decision ? `${data.decision.target}月令条件${data.decision.monthGate}。` : '当前格局不适用普通格神月令门槛。';
  const paths = data.paths.map((path) => `${path.label}：${path.status}${path.pairs.length ? `（${path.pairs.map(({ source, via, target }) => `${labels[source.position]}${source.stem}→${via ? `${labels[via.position]}${via.stem}→` : ''}${labels[target.position]}${target.stem}`).join('、')}）` : `（${path.reason}）`}`);
  const decision = data.decision ? `普通格局条件模型：${data.decision.status}（${data.decision.reason}）；格神条件${data.decision.targetCondition}${data.decision.wealthBearing ? `；身承财条件${data.decision.wealthBearing}` : ''}。${data.decision.breakers.map((item) => `${item.label}：${item.status}，救应${item.repairStatus}`).join('；')}\n` : '';
  return `${gate}\n透干：${visible.join('；')}\n${paths.length ? `制化路径：${paths.join('；')}\n` : ''}${decision}${data.limitation}`;
}
