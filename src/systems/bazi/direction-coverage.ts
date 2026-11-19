import { isKe, isSheng, isXing } from '../calendar';
import { comparePillars, stemElementOf } from './natal-facts';
import type { BaziPillar, PillarName } from './pillars';
import type { buildUsefulStrategy } from './useful-strategy';
import type { determineUsefulGod } from './useful-god';

type Pillars = Record<PillarName, BaziPillar>;
type Strategy = ReturnType<typeof buildUsefulStrategy>;
type UsefulGod = ReturnType<typeof determineUsefulGod>;
const positions: PillarName[] = ['year', 'month', 'day', 'hour'];
const labels: Record<PillarName, string> = { year: '年柱', month: '月柱', day: '日柱', hour: '时柱' };
const unique = (items: string[]) => [...new Set(items)];

/** 仅对已有条件候选做符号出现核对，不推断对方对本人产生作用。 */
export function buildDirectionCoverage(beneficiary: Strategy, provider: Pillars) {
  const sources = positions.flatMap((pillar) => {
    const value = provider[pillar];
    return [
      { pillar, layer: '天干' as const, value: value.gan, element: value.stemElement },
      { pillar, layer: '地支' as const, value: value.zhi, element: value.branchElement },
      ...value.hiddenStems.map((hidden) => ({ pillar, layer: '藏干' as const, value: hidden.stem, element: stemElementOf(hidden.stem) })),
    ];
  });
  const elements = (values: string[]) => unique(values).map((element) => ({ element, sources: sources.filter((source) => source.element === element) }));
  const stems = (values: string[]) => unique(values).map((stem) => ({ stem, sources: sources.filter((source) => source.layer !== '地支' && source.value === stem) }));
  const favorable = elements(beneficiary.favorable), unfavorable = elements(beneficiary.unfavorable);
  const favorableStems = stems(beneficiary.conditionalFavorableStems), unfavorableStems = stems(beneficiary.conditionalUnfavorableStems);
  return { status: favorable.length || unfavorable.length || favorableStems.length || unfavorableStems.length ? '条件候选' as const : '待判' as const,
    favorable, unfavorable, favorableStems, unfavorableStems,
    limitation: '仅核对对方四柱天干、地支和藏干中是否出现当前取用条件候选；不等同最终喜忌，不判断作用、强弱、互补或关系结果。' };
}

export function formatDirectionCoverage(value: ReturnType<typeof buildDirectionCoverage>) {
  const shortLayer: Record<string, string> = { 天干: '干', 地支: '支', 藏干: '藏' };
  const shortPillar: Record<PillarName, string> = { year: '年', month: '月', day: '日', hour: '时' };
  const sources = (items: Array<{ pillar: PillarName; layer: string; value: string }>) => items.map((item) => `${shortPillar[item.pillar]}${shortLayer[item.layer] ?? item.layer}${item.value}`).join('、') || '未出现';
  const elements = (items: typeof value.favorable) => items.map((item) => `${item.element}（${sources(item.sources)}）`).join('；') || '待判';
  const stems = (items: typeof value.favorableStems) => items.map((item) => `${item.stem}（${sources(item.sources)}）`).join('；');
  const stemParts = [
    value.favorableStems.length ? `条件有利干：${stems(value.favorableStems)}` : '',
    value.unfavorableStems.length ? `条件不利干：${stems(value.unfavorableStems)}` : '',
  ].filter(Boolean);
  return `条件有利五行：${elements(value.favorable)}；条件不利五行：${elements(value.unfavorable)}${stemParts.length ? `；${stemParts.join('；')}` : ''}。${value.limitation}`;
}

/** 核对本人最终用神裁定（主用神、喜用五行、忌神五行及条件干）在对方四柱中的出现位置。 */
export function buildUsefulGodCoverage(beneficiary: UsefulGod, provider: Pillars) {
  const sources = positions.flatMap((pillar) => {
    const value = provider[pillar];
    return [
      { pillar, layer: '天干' as const, value: value.gan, element: value.stemElement },
      { pillar, layer: '地支' as const, value: value.zhi, element: value.branchElement },
      ...value.hiddenStems.map((hidden) => ({ pillar, layer: '藏干' as const, value: hidden.stem, element: stemElementOf(hidden.stem) })),
    ];
  });
  const elements = (values: string[]) => unique(values).map((element) => ({ element, sources: sources.filter((source) => source.element === element) }));
  const stems = (values: string[]) => unique(values).map((stem) => ({ stem, sources: sources.filter((source) => source.layer !== '地支' && source.value === stem) }));
  return {
    status: beneficiary.incrementStatus,
    primaryReason: beneficiary.primaryReason,
    useful: beneficiary.useful,
    avoid: beneficiary.avoid,
    favorable: elements(beneficiary.favorableWuxing),
    unfavorable: elements(beneficiary.unfavorableWuxing),
    favorableStems: stems(beneficiary.conditionalFavorableStems ?? []),
    unfavorableStems: stems(beneficiary.conditionalUnfavorableStems ?? []),
  };
}

export function formatUsefulGodCoverage(value: ReturnType<typeof buildUsefulGodCoverage>) {
  const elements = (items: typeof value.favorable) => items.map((item) => `${item.element}（${item.sources.length}处）`).join('、') || '待定';
  return `裁定状态：${value.status}（${value.primaryReason}，主用${value.useful}，主忌${value.avoid}）；喜用五行在对方盘中：${elements(value.favorable)}；忌神五行在对方盘中：${elements(value.unfavorable)}。`;
}

/** 评估双方日柱夫妻宫天干五合/相冲与地支六合/六冲（含天地德合、天克地冲）。 */
export function evaluateSpousePalaceDeep(person1: Pillars, person2: Pillars) {
  const d1 = person1.day, d2 = person2.day;
  const rels = comparePillars(d1, d2).map((item) => item.name);
  let stemRelation: '五合' | '天干冲' | '相生' | '相克' | '比和' = '比和';
  if (rels.includes('天干五合')) stemRelation = '五合';
  else if (rels.includes('天干相冲')) stemRelation = '天干冲';
  else if (isSheng(d1.stemElement, d2.stemElement) || isSheng(d2.stemElement, d1.stemElement)) stemRelation = '相生';
  else if (isKe(d1.stemElement, d2.stemElement) || isKe(d2.stemElement, d1.stemElement)) stemRelation = '相克';

  let branchRelation: '同支' | '六合' | '六冲' | '相刑' | '相害' | '相生' | '相克' | '无明显刑冲合害' = '无明显刑冲合害';
  if (d1.zhi === d2.zhi) branchRelation = '同支';
  else if (rels.includes('地支六合')) branchRelation = '六合';
  else if (rels.includes('地支六冲')) branchRelation = '六冲';
  else if (isXing(d1.zhi, d2.zhi)) branchRelation = '相刑';
  else if (rels.includes('地支六害')) branchRelation = '相害';
  else if (isSheng(d1.branchElement, d2.branchElement) || isSheng(d2.branchElement, d1.branchElement)) branchRelation = '相生';
  else if (isKe(d1.branchElement, d2.branchElement) || isKe(d2.branchElement, d1.branchElement)) branchRelation = '相克';

  const isTianDeHe = stemRelation === '五合' && branchRelation === '六合';
  const isTianKeDiChong = (stemRelation === '天干冲' || stemRelation === '相克') && branchRelation === '六冲';
  const judgment = isTianDeHe
    ? '日柱天干五合、地支六合，构成天地德合结构；具体合化与相处仍须结合双方原局及现实核验。'
    : isTianKeDiChong
      ? '日柱天干相冲或相克且地支六冲，构成天克地冲结构；须结合双方原局根气及现实磨合核验。'
      : `日柱天干${stemRelation}、地支${branchRelation}；作用仍须结合双方原局月令及现实互动核验。`;
  return {
    person1DayGanZhi: d1.ganZhi,
    person2DayGanZhi: d2.ganZhi,
    stemRelation,
    branchRelation,
    isTianDeHe,
    isTianKeDiChong,
    judgment,
  };
}

function countPillarMainElements(pillars: Pillars, targetElements: readonly string[]): number {
  if (!targetElements.length) return 0;
  const set = new Set(targetElements);
  let count = 0;
  for (const pos of positions) {
    if (set.has(pillars[pos].stemElement)) count++;
    if (set.has(pillars[pos].branchElement)) count++;
  }
  return count;
}

/** 评估双方喜用神与忌神在对方四柱主气中的互补覆盖等级。 */
export function evaluateUsefulGodComplementarity(
  person1Useful: UsefulGod,
  person1Pillars: Pillars,
  person2Useful: UsefulGod,
  person2Pillars: Pillars,
) {
  const p1Fav = person1Useful.favorableWuxing ?? [];
  const p2Fav = person2Useful.favorableWuxing ?? [];
  const p1Avoid = person1Useful.unfavorableWuxing ?? [];
  const p2Avoid = person2Useful.unfavorableWuxing ?? [];
  const p1Pending = person1Useful.incrementStatus === '待判' || person1Useful.incrementStatus === '部分判定';
  const p2Pending = person2Useful.incrementStatus === '待判' || person2Useful.incrementStatus === '部分判定';
  const p1CoveredByPerson2Count = countPillarMainElements(person2Pillars, p1Fav);
  const p2CoveredByPerson1Count = countPillarMainElements(person1Pillars, p2Fav);
  const person1AvoidCountInPerson2 = countPillarMainElements(person2Pillars, p1Avoid);
  const person2AvoidCountInPerson1 = countPillarMainElements(person1Pillars, p2Avoid);

  const dataStatus = p1Pending && p2Pending ? '双方待判' as const
    : p1Pending || p2Pending ? '一方待判' as const
    : !p1Fav.length && !p2Fav.length ? '双方缺失' as const
    : !p1Fav.length || !p2Fav.length ? '一方缺失' as const
    : '完整' as const;

  let level: '双向喜用覆盖' | '单向喜用覆盖' | '未见喜用覆盖' | '资料不足';
  let judgment: string;
  if (dataStatus !== '完整') {
    level = '资料不足';
    judgment = `${dataStatus}，暂不直接定性双方喜用互补等级；可参照各自已列喜用与忌神五行对照。`;
  } else {
    level = p1CoveredByPerson2Count > 0 && p2CoveredByPerson1Count > 0
      ? '双向喜用覆盖'
      : p1CoveredByPerson2Count > 0 || p2CoveredByPerson1Count > 0
        ? '单向喜用覆盖'
        : '未见喜用覆盖';
    judgment = `第一人喜用（${p1Fav.join('、')}）在第二人四柱主气出现 ${p1CoveredByPerson2Count} 处（忌神 ${p1Avoid.join('、') || '无'} 出现 ${person1AvoidCountInPerson2} 处）；第二人喜用（${p2Fav.join('、')}）在第一人四柱主气出现 ${p2CoveredByPerson1Count} 处（忌神 ${p2Avoid.join('、') || '无'} 出现 ${person2AvoidCountInPerson1} 处）。`;
  }
  return {
    person1Useful: [...p1Fav],
    person2Useful: [...p2Fav],
    person1CoveredByPerson2Count: p1CoveredByPerson2Count,
    person2CoveredByPerson1Count: p2CoveredByPerson1Count,
    person1AvoidCountInPerson2,
    person2AvoidCountInPerson1,
    dataStatus,
    level,
    judgment,
  };
}
