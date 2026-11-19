import type { BaziPillar, PillarName } from './pillars';
import { branchesClash, seasonalState, stemElementOf } from './natal-facts';
import { collectTraditionalRoots, type buildDayMasterStrength } from './strength';

type Pillars = Record<PillarName, BaziPillar>;
type Strength = ReturnType<typeof buildDayMasterStrength>;
const positions: PillarName[] = ['year', 'month', 'day', 'hour'];
const labels: Record<PillarName, string> = { year: '年柱', month: '月柱', day: '日柱', hour: '时柱' };
const generates: Record<string, string> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const controls: Record<string, string> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
const pair: Record<string, string> = { 甲: '己', 己: '甲', 乙: '庚', 庚: '乙', 丙: '辛', 辛: '丙', 丁: '壬', 壬: '丁', 戊: '癸', 癸: '戊' };
const stemClash: Record<string, string> = { 甲: '庚', 庚: '甲', 乙: '辛', 辛: '乙', 丙: '壬', 壬: '丙', 丁: '癸', 癸: '丁' };
const resource = (god: string) => god === '正印' || god === '偏印';
const companion = (god: string) => god === '比肩' || god === '劫财';
const output = (god: string) => god === '食神' || god === '伤官';
const wealth = (god: string) => god === '正财' || god === '偏财';
const officer = (god: string) => god === '正官' || god === '七杀';
const adjacent = (a: PillarName, b: PillarName) => Math.abs(positions.indexOf(a) - positions.indexOf(b)) === 1;

/** 顺局从儿与两种优先从财路径，明列根气和实际制化条件。 */
export function buildCongEr(pillars: Pillars, strength: Strength, commanderStem: string) {
  const dayElement = pillars.day.stemElement, outputElement = generates[dayElement], wealthElement = generates[outputElement];
  const rootsCache = new Map<string, ReturnType<typeof collectTraditionalRoots>>();
  const structuralRoots = (element: string) => {
    if (!rootsCache.has(element)) rootsCache.set(element, collectTraditionalRoots(pillars, element).filter((root) => root.kind !== '弱藏'));
    return rootsCache.get(element)!;
  };
  const roots = (element: string) => structuralRoots(element).filter((root) => root.actionable);
  const visible = positions.filter((position) => position !== 'day').map((position) => ({ position, stem: pillars[position].gan, tenGod: pillars[position].tenGod, element: pillars[position].stemElement }));
  const rooted = (item: typeof visible[number]) => roots(item.element).length > 0;
  const visibleOutput = visible.filter((item) => output(item.tenGod)), rootedOutput = visibleOutput.filter(rooted);
  const visibleWealth = visible.filter((item) => wealth(item.tenGod));
  const visibleCompanions = visible.filter((item) => companion(item.tenGod));
  const established = strength.formations.filter((item) => item.established);
  const outputFormation = established.find((item) => item.element === outputElement);
  const wealthFormation = established.find((item) => item.element === wealthElement);
  const samePartyFormation = established.find((item) => item.element === dayElement || generates[item.element] === dayElement);
  const principal = Object.fromEntries(positions.map((position) => [position, pillars[position].hiddenStems[0]])) as Record<PillarName, BaziPillar['hiddenStems'][number]>;
  const dayRoots = roots(dayElement), strongDayRoots = dayRoots.filter((root) => root.kind === '本气' || root.kind === '生禄');
  const activeResourcesForWealth = visible.filter((item) => resource(item.tenGod) && rooted(item) && seasonalState(pillars.month.branchElement, item.element) !== '死');
  const allWealth = positions.every((position) => wealth(principal[position].tenGod));
  const allWealthBlocked = (visibleCompanions.length > 0 && dayRoots.length > 0) || activeResourcesForWealth.length > 0 || strongDayRoots.length > 0 || Boolean(samePartyFormation);
  const wealthAllPrincipal = allWealth && visibleOutput.length > 0 && ['囚', '死'].includes(seasonalState(pillars.month.branchElement, dayElement)) && !allWealthBlocked;
  const wealthConditions = { allPrincipalWealth: allWealth, daySeason: seasonalState(pillars.month.branchElement, dayElement), visibleOutput, visibleCompanions, activeResources: activeResourcesForWealth, dayRoots, strongDayRoots, samePartyFormation: samePartyFormation ?? null };
  const route = outputFormation ? (outputFormation.name === '三合局' ? '三合食伤成气' : '三会食伤成气')
    : output(principal.month.tenGod) ? '月建食伤当权'
      : output(principal.day.tenGod) && rootedOutput.length >= 2 ? '食伤并透坐支同气' : null;
  if (!route) return wealthAllPrincipal ? { route: null, status: '未命中从儿结构', outputElement, wealthElement, competingWealth: '四支本气皆财', wealthConditions, blockers: [], limitation: '按所列顺局和从财条件模型；其他格局及取用须另核。' } : null;
  const outputRoots = roots(outputElement), wealthRoots = structuralRoots(wealthElement), actionableWealthRoots = roots(wealthElement);
  const wealthFlow = visibleWealth.length > 0 || Boolean(wealthFormation) || actionableWealthRoots.length > 0;
  const resolutions: string[] = [];
  const isRescued = (position: PillarName, stem: string) => {
    if (!actionableWealthRoots.length || controls[wealthElement] !== stemElementOf(stem)) return false;
    for (const fact of visibleWealth) {
      if (fact.position !== position && !adjacent(position, fact.position)) continue;
      if (pillars[position].gan === stem && pair[fact.stem] === stem) {
        const participants = new Set([position, fact.position]);
        const broken = positions.some((p) => !participants.has(p) && (pillars[p].gan === stemClash[stem] || pillars[p].gan === stemClash[fact.stem]));
        if (!broken) continue;
      }
      const note = `${labels[fact.position]}${fact.stem}财星有根，制${labels[position]}${stem}印星`;
      if (!resolutions.includes(note)) resolutions.push(note);
      return true;
    }
    return false;
  };
  const resolvedStems = new Set<string>();
  for (let i = 0; i < positions.length - 1; i++) {
    const left = positions[i], right = positions[i + 1], a = pillars[left].gan, b = pillars[right].gan;
    if (outputElement !== '木' || !((a === '丁' && b === '壬') || (a === '壬' && b === '丁'))) continue;
    if (positions.some((p) => p !== left && p !== right && (pillars[p].gan === a || pillars[p].gan === b))) continue;
    if (!outputFormation && pillars.month.branchElement !== outputElement) continue;
    resolvedStems.add(`${left}:${a}`); resolvedStems.add(`${right}:${b}`);
    resolutions.push(`${labels[left]}${a}与${labels[right]}${b}紧贴合木，木气得月建或成局支持，按从儿原例记为食伤同向`);
  }
  const formationPositions = outputFormation ? positions.filter((position) => outputFormation.members.includes(pillars[position].zhi)) : [];
  const principalOutputPositions = positions.filter((position) => output(principal[position].tenGod));
  const rootedResources = visible.filter((item) => resource(item.tenGod) && rooted(item));
  const activeResources = rootedResources.filter((item) => {
    if (resolvedStems.has(`${item.position}:${item.stem}`)) return false;
    const acts = rootedOutput.some((other) => adjacent(item.position, other.position)) || route === '月建食伤当权' || formationPositions.some((p) => p === item.position || adjacent(item.position, p));
    return acts && !isRescued(item.position, item.stem);
  });
  const activeOfficers = visible.filter((item) => officer(item.tenGod) && rooted(item) && !resolvedStems.has(`${item.position}:${item.stem}`));
  const hiddenResourceClashes = positions.flatMap((position) => {
    const hidden = principal[position];
    if (!resource(hidden.tenGod)) return [];
    const target = principalOutputPositions.find((other) => other !== position && branchesClash(pillars[position].zhi, pillars[other].zhi));
    if (!target || isRescued(position, hidden.stem)) return [];
    return [{ position, branch: pillars[position].zhi, stem: hidden.stem, tenGod: hidden.tenGod, target, targetBranch: pillars[target].zhi }];
  });
  const monthResource = resource(principal.month.tenGod), monthOfficer = officer(principal.month.tenGod);
  const monthResourceResolved = monthResource && isRescued('month', principal.month.stem);
  const structuralBlockers = [
    ...(!wealthFlow ? [wealthRoots.length ? '结构藏财根气受冲待核，未见可用财气承接食伤' : '未见财星明透、财局或结构藏财承接食伤'] : []),
    ...activeResources.map((item) => `${labels[item.position]}${item.stem}${item.tenGod}明透有根，对食伤形成制约`),
    ...(monthResource && !monthResourceResolved ? [`月支本气${principal.month.stem}${principal.month.tenGod}当权，生身制食伤`] : []),
    ...hiddenResourceClashes.map((item) => `${labels[item.position]}${item.branch}藏${item.stem}${item.tenGod}直接冲${labels[item.target]}${item.targetBranch}食伤`),
    ...activeOfficers.map((item) => `${labels[item.position]}${item.stem}${item.tenGod}明透有根，财气转官杀并与食伤交战`),
    ...(monthOfficer ? [`月支本气${principal.month.stem}${principal.month.tenGod}当权，财气转向官杀`] : []),
  ];
  const wealthEndpoint = structuralBlockers.length === 0 && route === '月建食伤当权' && wealth(principal.day.tenGod) && wealth(principal.hour.tenGod) && visibleWealth.length > 0 && actionableWealthRoots.length > 0 && dayRoots.length === 0 && visibleCompanions.length === 0;
  const competingWealth = wealthAllPrincipal ? '四支本气皆财' : wealthEndpoint ? '食伤当令而财归日时' : null;
  const blockers = [...new Set([...structuralBlockers, ...(wealthEndpoint ? ['财星明透有根并归日时，按从财优先'] : [])])];
  return { route, status: blockers.length ? '存在反证' : '条件成立', outputElement, wealthElement, commanderStem, competingWealth, wealthConditions, visibleOutput, rootedOutput, visibleWealth, outputFormation: outputFormation ?? null, wealthFormation: wealthFormation ?? null,
    outputRoots, wealthRoots, wealthFlow, activeResources, activeOfficers, hiddenResourceClashes, monthResource, monthResourceResolved, monthOfficer, resolutions, blockers,
    limitation: '按所列从儿、财星承接及从财优先条件判断；局部合化与财制印只按列明的限定规则处理，其他格局、调候和用神须另核。' };
}

const posText = (items: Array<{ position: PillarName; stem: string }>) => items.map((item) => `${labels[item.position]}${item.stem}`).join('、') || '未见';
export function formatCongEr(value: ReturnType<typeof buildCongEr>) {
  if (!value) return '未命中所列从儿结构或从财优先条件。';
  const rootsText = (items: NonNullable<typeof value>['wealthConditions']['dayRoots']) => items.map((item) => `${labels[item.position]}${item.branch}藏${item.stem}（${item.kind}、${item.clashStatus}）`).join('、') || '未见';
  const wealthFacts = `四支本气皆财：${value.wealthConditions.allPrincipalWealth ? '是' : '否'}；日主月令${value.wealthConditions.daySeason}；同党根：${rootsText(value.wealthConditions.dayRoots)}；可用印星：${posText(value.wealthConditions.activeResources)}。`;
  if (!value.route) return `从财优先路线：${value.competingWealth}。${wealthFacts}${value.limitation}`;
  return `从儿路线${value.route}：${value.status}；食伤${value.outputElement}，财${value.wealthElement}；财气承接${value.wealthFlow ? '满足' : '未满足'}；从财优先${value.competingWealth ?? '未命中'}。\n食伤明透：${posText(value.visibleOutput)}；有根食伤：${posText(value.rootedOutput)}；财星明透：${posText(value.visibleWealth)}；可作用印星：${posText(value.activeResources)}；可作用官杀：${posText(value.activeOfficers)}。\n食伤根：${rootsText(value.outputRoots)}；财根：${rootsText(value.wealthRoots)}。\n制化：${value.resolutions.join('；') || '未见'}；反证：${value.blockers.join('；') || '未见'}。\n${wealthFacts}${value.limitation}`;
}
