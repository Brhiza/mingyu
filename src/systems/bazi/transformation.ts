import type { BaziPillar, PillarName } from './pillars';
import { seasonalState, stemElementOf } from './natal-facts';
import { collectTraditionalRoots, type buildDayMasterStrength } from './strength';

type Pillars = Record<PillarName, BaziPillar>;
type Strength = ReturnType<typeof buildDayMasterStrength>;
const positions: PillarName[] = ['year', 'month', 'day', 'hour'];
const rules = [
  { pair: ['甲', '己'], element: '土', jealous: '乙' }, { pair: ['乙', '庚'], element: '金', jealous: '甲' },
  { pair: ['丙', '辛'], element: '水', jealous: '丁' }, { pair: ['丁', '壬'], element: '木', jealous: '丙' },
  { pair: ['戊', '癸'], element: '火', jealous: '己' },
] as const;
const generates: Record<string, string> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const controls: Record<string, string> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
const stemClash: Record<string, string> = { 甲: '庚', 庚: '甲', 乙: '辛', 辛: '乙', 丙: '壬', 壬: '丙', 丁: '癸', 癸: '丁' };
const roots = collectTraditionalRoots;

/** 日干五合的化气模型，依据月令化神旺衰、透藏通根与阻隔反证，裁定成化、假化或合绊。 */
export function buildTransformation(pillars: Pillars, strength: Strength) {
  const dayStem = pillars.day.gan, rule = rules.find((item) => (item.pair as readonly string[]).includes(dayStem))!;
  const partner = rule.pair.find((stem) => stem !== dayStem)!;
  const indexes = positions.map((position, index) => pillars[position].gan === partner ? index : -1).filter((index) => index >= 0);
  if (!indexes.length) return null;
  indexes.sort((a, b) => Math.abs(a - 2) - Math.abs(b - 2) || a - b);
  const partnerIndex = indexes[0], participantIndexes = new Set([2, partnerIndex]);
  const adjacent = Math.abs(partnerIndex - 2) === 1;
  const monthSupported = pillars.month.branchElement === rule.element;
  const monthSeason = seasonalState(pillars.month.branchElement, rule.element);
  const formations = strength.formations.filter((item) => item.established && item.element === rule.element);
  const transformRoots = roots(pillars, rule.element).filter((root) => !participantIndexes.has(positions.indexOf(root.position)));
  const visibleTransform = positions.flatMap((position, index) => !participantIndexes.has(index) && pillars[position].stemElement === rule.element ? [{ position, stem: pillars[position].gan }] : []);
  const effectiveTransformRoots = transformRoots.filter((root) => root.kind !== '弱藏' && root.actionable);
  const pendingTransformRoots = transformRoots.filter((root) => root.kind !== '弱藏' && !root.actionable);
  const dayElement = pillars.day.stemElement;
  const dayRoots = roots(pillars, dayElement);
  const blockersByRoot = dayElement === rule.element ? [] : dayRoots.filter((root) => root.stem === dayStem ? ['本气', '生禄', '余气'].includes(root.kind) : root.strongStage);
  const resourceElement = Object.keys(generates).find((element) => generates[element] === dayElement)!;
  const resourceRoots = dayElement === rule.element || resourceElement === rule.element ? [] : roots(pillars, resourceElement);
  const blockingResourceRoots = resourceRoots.filter((root) => root.strongStage);
  const controller = Object.keys(controls).find((element) => controls[element] === rule.element)!;
  const controlsFound = positions.flatMap((position, index) => [
    ...(!participantIndexes.has(index) && pillars[position].stemElement === controller ? [{ position, type: '天干' as const, value: pillars[position].gan }] : []),
    ...(pillars[position].branchElement === controller ? [{ position, type: '地支本气' as const, value: pillars[position].zhi }] : []),
  ]);
  const otherStems = positions.flatMap((position, index) => participantIndexes.has(index) ? [] : [{ position, stem: pillars[position].gan }]);
  const repetition = otherStems.filter((item) => item.stem === dayStem || item.stem === partner);
  const jealous = otherStems.filter((item) => item.stem === rule.jealous);
  const clashes = otherStems.filter((item) => item.stem === stemClash[dayStem] || item.stem === stemClash[partner]);
  const transformBranchCount = positions.filter((position) => pillars[position].branchElement === rule.element).length;
  const partnerElement = stemElementOf(partner);
  const partnerRoots = roots(pillars, partnerElement);
  const partnerResourceElement = Object.keys(generates).find((element) => generates[element] === partnerElement)!;
  const partnerResourceRoots = partnerResourceElement === rule.element ? [] : roots(pillars, partnerResourceElement);
  const partnerNoRoot = !partnerRoots.some((root) => root.actionable) && !partnerResourceRoots.some((root) => root.hiddenRole === '本气');
  const dayRootsOnlyInTransformBranches =
    !dayRoots.some((root) => root.hiddenRole === '本气') &&
    blockersByRoot.every((root) => pillars[root.position].branchElement === rule.element);
  const nonTransformClashes = clashes.filter((item) => stemElementOf(item.stem) !== rule.element);
  const extremeTransformDominance =
    adjacent &&
    controlsFound.length === 0 &&
    repetition.length === 0 &&
    jealous.length === 0 &&
    nonTransformClashes.length === 0 &&
    (transformBranchCount === 4 || (transformBranchCount >= 3 && visibleTransform.length >= 2)) &&
    dayRootsOnlyInTransformBranches &&
    partnerNoRoot;
  const blockers = [
    ...(!adjacent ? ['日干与配干隔位'] : []),
    ...(!extremeTransformDominance && blockersByRoot.some((root) => root.actionable) ? ['日干有可用本根或同气强根'] : []),
    ...(blockingResourceRoots.some((root) => root.actionable) ? ['原日主有可用印根，返性未尽'] : []),
    ...(controlsFound.length ? ['明干或地支本气克制化神'] : []),
    ...(repetition.length ? ['配合天干重复或争合'] : []),
    ...(jealous.length ? [`见${rule.jealous}妒合`] : []),
    ...((extremeTransformDominance ? nonTransformClashes : clashes).length ? ['配合天干受冲破'] : []),
  ];
  const pending = [
    ...(!monthSupported && !formations.length ? [`化神${rule.element}在月令${monthSeason}，未见月令本气或成势支局支持`] : []),
    ...(!visibleTransform.length && !effectiveTransformRoots.length ? ['化神尚无明透或可用独立结构根'] : []),
    ...(!extremeTransformDominance && blockersByRoot.some((root) => !root.actionable) ? ['日干根气受冲减力，返性力度减弱'] : []),
    ...(blockingResourceRoots.some((root) => !root.actionable) ? ['原日主印根受冲减力，生身阻化有限'] : []),
    ...(pendingTransformRoots.length && !visibleTransform.length && !effectiveTransformRoots.length ? ['化神结构根受冲减力，需岁运扶助引化'] : []),
  ];
  const hasTransformTendency = monthSupported || formations.length > 0 || ['旺', '相'].includes(monthSeason)
    || visibleTransform.length > 0 || effectiveTransformRoots.length > 0 || pendingTransformRoots.length > 0;
  const status: '成化' | '假化（合而不化偏化气）' | '合绊（合而不化）' = blockers.length
    ? '合绊（合而不化）'
    : pending.length === 0
      ? '成化'
      : hasTransformTendency
        ? '假化（合而不化偏化气）'
        : '合绊（合而不化）';
  const verdictReason = status === '成化'
    ? extremeTransformDominance
      ? `满局化神极旺从化：地支${transformBranchCount}支俱属化神${rule.element}且透干引化，配干${partner}全无本气印根，纵化神支内暗藏余气亦从满局旺势真纯成化`
      : `日干与配干紧贴无争妒冲克，化神${rule.element}得月令或成势支局支持且透藏有根，化气真纯成格`
    : status === '假化（合而不化偏化气）'
      ? `日干与配干紧贴无争妒冲克，具偏化气之势（${pending.join('；')}），原局按假化偏化气论；岁运见${rule.element}旺地引化可从真，逢克化或助原身运则还原按正格论`
      : blockers.length
        ? `存在明确阻化因素（${blockers.join('；')}），合而不化按合绊论，仍从原日主正格取用`
        : `化神${rule.element}在月令${monthSeason}且无成势支局、无明透及独立根气承接，化气无源，按合绊（合而不化）论`;
  return { pattern: `${rule.pair.join('')}化${rule.element}格`, pair: [...rule.pair], dayStem, partner, partnerPosition: positions[partnerIndex], element: rule.element,
    status, verdictReason, adjacent, monthSupported, extremeTransformDominance, formations, visibleTransform, transformRoots, dayRoots, resourceElement, resourceApplicable: dayElement !== rule.element && resourceElement !== rule.element, resourceRoots, controlsFound, repetition, jealous, clashes, blockers, pending,
    limitation: '按所列化气条件模型裁定成化、假化与合绊；假化与合绊结合岁运引化条件及正格用神层综合权衡。' };
}

const labels: Record<PillarName, string> = { year: '年柱', month: '月柱', day: '日柱', hour: '时柱' };
type Transformation = NonNullable<ReturnType<typeof buildTransformation>>;
export function formatTransformation(value: Transformation | null) {
  if (!value) return '未见日干五合配干。';
  const rootText = (items: Transformation['dayRoots']) => items.map((root) => `${labels[root.position]}${root.branch}藏${root.stem}（${root.kind}、${root.stage}、${root.clashStatus}，${root.actionable ? '可参与' : '受冲减力'}）`).join('、') || '未见';
  return `${value.pattern}：${value.status}；配干${value.partner}在${labels[value.partnerPosition]}，${value.adjacent ? '紧贴' : '隔位'}；月令本气${value.monthSupported ? '支持' : '不支持'}；成势支局${value.formations.map((item) => item.members + item.name).join('、') || '无'}。\n化神明透：${value.visibleTransform.map((item) => `${labels[item.position]}${item.stem}`).join('、') || '无'}；独立根：${rootText(value.transformRoots)}。\n日干根：${rootText(value.dayRoots)}；${value.resourceElement}印根：${value.resourceApplicable ? rootText(value.resourceRoots) : '同气条件下不作返性阻化判断'}。\n克制化神：${value.controlsFound.map((item) => `${labels[item.position]}${item.type}${item.value}`).join('、') || '无'}；争合重复：${value.repetition.map((item) => `${labels[item.position]}${item.stem}`).join('、') || '无'}；妒合：${value.jealous.map((item) => `${labels[item.position]}${item.stem}`).join('、') || '无'}；冲破：${value.clashes.map((item) => `${labels[item.position]}${item.stem}`).join('、') || '无'}。\n反证：${value.blockers.join('；') || '未见'}；引化条件：${value.pending.join('；') || '条件闭合'}。\n裁定依据：${value.verdictReason}。${value.limitation}`;
}
