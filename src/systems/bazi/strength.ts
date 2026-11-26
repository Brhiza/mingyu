import { getLifeStage, KE_MAP, SHENG_MAP } from '../ganzhi-foundation';
import type { BaziPillar, PillarName } from './pillars';
import { branchFormationGroups, branchesClash, seasonalState, stemElementOf } from './natal-facts';

const positions: PillarName[] = ['year', 'month', 'day', 'hour'];
const elements = ['木', '火', '土', '金', '水'] as const;
const generates: Record<string, string> = SHENG_MAP;
const controls: Record<string, string> = KE_MAP;
type Pillars = Record<PillarName, BaziPillar>;
type Effect = '助身' | '生身' | '泄身' | '耗身' | '克身';
type Tendency = '扶身' | '制身' | '相持';
type Source = 'visible-stem' | 'branch-main-qi' | 'hidden-qi';

function effectOf(element: string, day: string): Effect {
  if (element === day) return '助身';
  if (generates[element] === day) return '生身';
  if (generates[day] === element) return '泄身';
  if (controls[day] === element) return '耗身';
  if (controls[element] === day) return '克身';
  throw new Error(`无效五行关系：${element}/${day}`);
}
const supporting = (effect: Effect) => effect === '助身' || effect === '生身';
const compare = (a: number, b: number): Tendency => a > b ? '扶身' : a < b ? '制身' : '相持';

function clashesFor(pillars: Pillars, position: PillarName) {
  return positions.filter((other) => other !== position && branchesClash(pillars[position].zhi, pillars[other].zhi))
    .map((other) => ({ position: other, branch: pillars[other].zhi }));
}

const seasonRank: Record<string, number> = { 旺: 4, 相: 3, 休: 2, 囚: 1, 死: 0 };

/** 共享根与受冲裁定；稳定性与当前模型可参与性分别记录。 */
export function collectAdjudicatedRoots(pillars: Pillars, element: string) {
  const month = pillars.month.branchElement;
  return positions.flatMap((position) => {
    const pillar = pillars[position], clashSources = clashesFor(pillars, position);
    return pillar.hiddenStems.flatMap(({ stem }, hiddenIndex) => {
      if (stemElementOf(stem) !== element) return [];
      const stable = clashSources.length === 0;
      const principal = hiddenIndex === 0 && pillar.branchElement === element;
      const storageStem = '辰戌'.includes(pillar.zhi) ? '戊' : '丑未'.includes(pillar.zhi) ? '己' : undefined;
      const storageClash = !stable && element === '土' && principal && stem === storageStem && clashSources.every((source) => pillars[source.position].branchElement === '土');
      const weakClash = !stable && principal && ['旺', '相'].includes(seasonalState(month, element)) && clashSources.every((source) => {
        const opponent = pillars[source.position].branchElement;
        return opponent !== element && ['囚', '死'].includes(seasonalState(month, opponent));
      });
      let clashStatus: string;
      if (stable) clashStatus = '未受冲';
      else if (storageClash) clashStatus = '库土本气同类冲动';
      else if (weakClash) clashStatus = '得令本气受失令异类冲';
      else {
        const selfRank = seasonRank[seasonalState(month, element)] ?? 2;
        const maxOppRank = Math.max(...clashSources.map((source) => seasonRank[seasonalState(month, pillars[source.position].branchElement)] ?? 2));
        clashStatus = selfRank > maxOppRank
          ? '受冲减力（旺冲衰，余气犹存）'
          : selfRank < maxOppRank
            ? '受冲减力（衰逢旺冲，根气大损）'
            : '受冲减力（势均互损）';
      }
      return [{ position, branch: pillar.zhi, stem, hiddenIndex, hiddenRole: (['本气', '中气', '余气'] as const)[hiddenIndex],
        source: (principal ? 'branch-main-qi' : 'hidden-qi') as Source, stable, actionable: stable || storageClash || weakClash, clashStatus, clashSources }];
    });
  });
}

const storage: Record<string, string> = { 辰: '癸', 戌: '丁', 丑: '辛', 未: '乙' };
const residual: Record<string, string> = { 辰: '乙', 戌: '辛', 丑: '癸', 未: '丁' };
const strongStages = new Set(['长生', '临官', '帝旺']);
/** 保留藏干层次和传统根类；二者不是同一个概念。 */
export function collectTraditionalRoots(pillars: Pillars, element: string) {
  return collectAdjudicatedRoots(pillars, element).map((root) => {
    const stage = getLifeStage(root.stem, root.branch);
    const kind = root.hiddenIndex === 0 ? '本气' : storage[root.branch] === root.stem ? '正库' : residual[root.branch] === root.stem ? '余气' : strongStages.has(stage) ? '生禄' : '弱藏';
    return { ...root, stage, kind, strongStage: strongStages.has(stage) };
  });
}

/** 明确列出月令、冲根、成势及扶抑条件；这是一个条件模型，不裁定特殊格或用神。 */
export function buildDayMasterStrength(pillars: Pillars, commanderStem: string) {
  const day = pillars.day.stemElement, month = pillars.month.branchElement;
  const rootsByElement = Object.fromEntries(elements.map((element) => [element, collectAdjudicatedRoots(pillars, element)]));
  const roots = rootsByElement[day];
  const support: Array<{ position: PillarName; value: string; element: string; effect: Effect; source: Source; stable: boolean; actionable: boolean }> = [];
  const constraint: typeof support = [];
  for (const position of positions) {
    const pillar = pillars[position], branchStable = clashesFor(pillars, position).length === 0;
    const add = (value: string, element: string, source: Source, stable: boolean, actionable: boolean) => {
      const effect = effectOf(element, day);
      (supporting(effect) ? support : constraint).push({ position, value, element, effect, source, stable, actionable });
    };
    if (position !== 'day') {
      const relatedRoots = rootsByElement[pillar.stemElement];
      add(pillar.gan, pillar.stemElement, 'visible-stem', relatedRoots.some((root) => root.stable), relatedRoots.some((root) => root.actionable));
    }
    const branchEffect = effectOf(pillar.branchElement, day);
    if (branchEffect !== '助身') {
      const branchRoots = rootsByElement[pillar.branchElement];
      add(pillar.zhi, pillar.branchElement, 'branch-main-qi', branchStable, branchRoots.some((root) => root.position === position && root.hiddenIndex === 0 && root.actionable));
    }
    pillar.hiddenStems.forEach(({ stem }, index) => {
      const element = stemElementOf(stem), effect = effectOf(element, day);
      if (effect === '助身' || (index === 0 && element === pillar.branchElement && branchEffect !== '助身')) return;
      add(`${pillar.zhi}(${stem})`, element, 'hidden-qi', branchStable, branchStable);
    });
  }
  const formations = branchFormationGroups.flatMap((group) => {
    if (![...group.members].every((branch) => positions.some((position) => pillars[position].zhi === branch))) return [];
    const monthState = seasonalState(month, group.element);
    const externalClashes = positions.filter((position) => !group.members.includes(pillars[position].zhi) && [...group.members].some((branch) => branchesClash(branch, pillars[position].zhi)))
      .map((position) => ({ position, branch: pillars[position].zhi }));
    return [{ ...group, monthState, externalClashes, established: ['旺', '相'].includes(monthState) && externalClashes.length === 0, effect: effectOf(group.element, day) }];
  });
  const season = seasonalState(month, day), commanderEffect = effectOf(stemElementOf(commanderStem), day);
  const seasonTendency: Tendency = ['旺', '相'].includes(season) ? '扶身' : ['囚', '死'].includes(season) ? '制身' : '相持';
  const commanderTendency: Tendency = supporting(commanderEffect) ? '扶身' : '制身';
  const monthTendency: Tendency = seasonTendency === '相持' ? commanderTendency : seasonTendency === commanderTendency ? seasonTendency : '相持';
  const hasRoot = roots.length > 0, strongRoot = roots.some((root) => root.source === 'branch-main-qi' && root.stable);
  const rootTendency: Tendency = strongRoot ? '扶身' : hasRoot ? '相持' : '制身';
  const activeRoots = roots.filter((root) => root.actionable), activeSupport = support.filter((item) => item.actionable), activeConstraint = constraint.filter((item) => item.actionable);
  const established = formations.filter((item) => item.established);
  const supportingFormations = established.filter((item) => supporting(item.effect)).length;
  const constrainingFormations = established.length - supportingFormations;
  const direct = (item: { source: Source }) => item.source !== 'hidden-qi';
  const directSupport = activeRoots.filter(direct).length + activeSupport.filter(direct).length;
  const directConstraint = activeConstraint.filter(direct).length;
  const primary = compare(supportingFormations + directSupport, constrainingFormations + directConstraint);
  const structureTendency = primary !== '相持' ? primary : compare(activeRoots.length + activeSupport.length - directSupport, activeConstraint.length - directConstraint);
  const tendencies = [monthTendency, rootTendency, structureTendency];
  const up = tendencies.filter((item) => item === '扶身').length, down = tendencies.filter((item) => item === '制身').length;
  let status = '中和';
  if (monthTendency === '扶身' && strongRoot && structureTendency === '扶身' && directConstraint === 0 && !constraint.some((item) => item.source === 'visible-stem') && !constrainingFormations) status = '极强';
  else if (!hasRoot && monthTendency !== '扶身' && directSupport === 0 && !support.some((item) => item.source === 'visible-stem') && !supportingFormations) status = '极弱';
  else if (!hasRoot && monthTendency !== '扶身') status = '身弱';
  else if (up >= 2 && down === 0 && (strongRoot || activeSupport.length >= 2)) status = '身强';
  else if (up > down) status = '偏强';
  else if (down >= 2 && up === 0) status = '身弱';
  else if (down > up) status = '偏弱';
  return { status, dayMaster: pillars.day.gan, element: day, month: { branch: pillars.month.zhi, season, commanderStem, commanderEffect },
    tendencies: { month: monthTendency, root: rootTendency, structure: structureTendency }, hasRoot, strongRoot, roots, support, constraint, formations,
    limitation: '此为所列条件下的旺衰模型；受冲按旺衰对比判为减力或激旺，成势支局仍须结合合化、格局与用神层综合裁定。' };
}
