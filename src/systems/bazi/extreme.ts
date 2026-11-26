import { getTenStar } from '../ganzhi-foundation';
import { branchesClash } from './natal-facts';
import type { BaziPillar, PillarName } from './pillars';
import type { buildDayMasterStrength } from './strength';
import type { buildQuzhi } from './quzhi';
import type { buildCongEr } from './conger';

type Pillars = Record<PillarName, BaziPillar>;
const positions: PillarName[] = ['year', 'month', 'day', 'hour'];
const names: Record<PillarName, string> = { year: '年柱', month: '月柱', day: '日柱', hour: '时柱' };
const sameParty = (god: string) => ['比肩', '劫财', '正印', '偏印'].includes(god);
const isSeal = (god: string) => ['正印', '偏印'].includes(god);
const category = (god: string) => ['正财', '偏财'].includes(god) ? '财' : ['正官', '七杀'].includes(god) ? '官杀' : ['食神', '伤官'].includes(god) ? '食伤' : null;

/** 仅在极强或极弱条件下检查专旺或通用从格；身弱唯一微弱印根遭日支直冲受破时标出假从候选提示。 */
export function buildExtremePattern(pillars: Pillars, strength: ReturnType<typeof buildDayMasterStrength>, commanderStem: string, quzhi: ReturnType<typeof buildQuzhi>, conger: ReturnType<typeof buildCongEr>) {
  const god = (stem: string) => getTenStar(pillars.day.gan, stem);
  const commanderGod = god(commanderStem);
  const visibleHasSame = (['year', 'month', 'hour'] as PillarName[]).some((p) => sameParty(pillars[p].tenGod));
  const sameBranches = positions.filter((p) => pillars[p].hiddenStems.some((h) => sameParty(h.tenGod)));
  const soleBranchPos = sameBranches.length === 1 ? sameBranches[0] : null;
  const brokenSealFakeFollow =
    (strength.status === '身弱' || strength.status === '极弱') &&
    !visibleHasSame &&
    soleBranchPos !== null &&
    soleBranchPos !== 'day' &&
    pillars[soleBranchPos].hiddenStems.some((h) => isSeal(h.tenGod)) &&
    branchesClash(pillars[soleBranchPos].zhi, pillars.day.zhi) &&
    strength.support.every((item) => !item.actionable) &&
    strength.roots.every((item) => !item.actionable) &&
    !sameParty(commanderGod) &&
    !conger?.route;

  if (!['极强', '极弱'].includes(strength.status) && !brokenSealFakeFollow) return null;
  const direct = positions.flatMap((position) => [
    ...(position === 'day' ? [] : [{ position, source: '天干', stem: pillars[position].gan, tenGod: pillars[position].tenGod }]),
    { position, source: '本气', stem: pillars[position].hiddenStems[0].stem, tenGod: pillars[position].hiddenStems[0].tenGod },
  ]);
  const residual = positions.flatMap((position) => pillars[position].hiddenStems.slice(1).map((hidden) => ({ position, source: '中余气', ...hidden })));
  const sameDirect = direct.filter((item) => sameParty(item.tenGod)), oppositeDirect = direct.filter((item) => !sameParty(item.tenGod));
  const sameResidual = residual.filter((item) => sameParty(item.tenGod)), oppositeResidual = residual.filter((item) => !sameParty(item.tenGod));
  const established = strength.formations.filter((item) => item.established);
  const sameFormations = established.filter((item) => item.effect === '助身' || item.effect === '生身');
  const oppositeFormations = established.filter((item) => item.effect !== '助身' && item.effect !== '生身');
  const strong = strength.status === '极强';
  const opposingDirect = strong ? oppositeDirect : sameDirect, opposingResidual = strong ? oppositeResidual : sameResidual;
  const favorableFormations = strong ? sameFormations : oppositeFormations;
  const residualPositions = [...new Set(opposingResidual.map((item) => item.position))];
  const forceSatisfied = (opposingDirect.length === 0 || (favorableFormations.length > 0 && opposingDirect.length <= 1)) && (residualPositions.length <= 1 || favorableFormations.length > 0);
  const pure = opposingDirect.length === 0 && opposingResidual.length === 0;
  const commanderSatisfied = strong ? sameParty(commanderGod) : !sameParty(commanderGod);
  const competingStructure = Boolean(conger?.route) || (strong && Boolean(quzhi));
  const eligible = ['极强', '极弱'].includes(strength.status) && commanderSatisfied && !competingStructure && (pure || forceSatisfied);
  const categoryFacts = [...direct.flatMap((item) => { const value = category(item.tenGod); return value ? [{ source: `${item.position}${item.source}${item.stem}`, category: value }] : []; }),
    ...oppositeFormations.map((item) => ({ source: `${item.members}${item.name}`, category: item.effect === '耗身' ? '财' : item.effect === '克身' ? '官杀' : '食伤' }))];
  const categories = [...new Set(categoryFacts.map((item) => item.category))];
  const cmdCategory = category(commanderGod);
  const fakeCandidate = cmdCategory === '官杀' ? '假从杀格' : cmdCategory === '财' ? '假从财格' : cmdCategory === '食伤' ? '假从儿格' : '假从势格';
  const SPECIALIZED_ZHUANWANG_NAMES: Record<string, string> = {
    木: '曲直格',
    火: '炎上格',
    土: '稼穑格',
    金: '从革格',
    水: '润下格',
  };
  const specializedName =
    strong && !(brokenSealFakeFollow && !eligible)
      ? SPECIALIZED_ZHUANWANG_NAMES[pillars.day.stemElement]
      : undefined;
  const candidate = brokenSealFakeFollow && !eligible
    ? fakeCandidate
    : strong ? '专旺格' : categories.length === 1 && categories[0] === '财' ? '从财格' : categories.length === 1 && categories[0] === '官杀' ? '从杀格' : '从势格';
  const status: '条件成立' | '存在反证' | '假从候选（印根受日支冲破）' = eligible
    ? '条件成立'
    : brokenSealFakeFollow
      ? '假从候选（印根受日支冲破）'
      : '存在反证';
  const fakeFollowHint = brokenSealFakeFollow && !eligible && soleBranchPos
    ? `原局天干无印比，唯一微弱印根（${names[soleBranchPos]}${pillars[soleBranchPos].zhi}）遭日支${pillars.day.zhi}直接六冲受破，其余三柱全为财官杀食伤成势，具${fakeCandidate}候选之象；岁运顺从旺势可论假从，见印比扶身则返正格`
    : undefined;
  return { candidate, ...(specializedName ? { specializedName } : {}), status, strengthStatus: strength.status, commanderStem, commanderGod, commanderSatisfied, competingStructure,
    direct, residual, sameFormations, oppositeFormations, opposingDirect, opposingResidual, residualPositions, forceSatisfied, pure, categoryFacts, categories,
    ...(fakeFollowHint ? { fakeFollowHint } : {}),
    limitation: '按当前极强极弱及明干、本气、中余气和成势条件模型裁定；未成立时归回普通正格，综合调候与用神见用神裁定层。' };
}

export function formatExtremePattern(value: ReturnType<typeof buildExtremePattern>) {
  if (!value) return '未进入极强或极弱条件。';
  const facts = (items: typeof value.direct) => items.map((item) => `${names[item.position]}${item.source}${item.stem}${item.tenGod}`).join('、') || '无';
  const hintLine = value.fakeFollowHint ? `\n假从提示：${value.fakeFollowHint}。` : '';
  const displayName = value.specializedName ? `${value.candidate}（${value.specializedName}）` : value.candidate;
  return `${displayName}：${value.status}；旺衰${value.strengthStatus}，司权${value.commanderStem}${value.commanderGod}（${value.commanderSatisfied ? '符合' : '不符合'}）；其他特殊结构${value.competingStructure ? '存在，不能按本路线取格' : '未命中所列冲突'}。\n明干与本气：${facts(value.direct)}；中余气：${facts(value.residual)}。\n反向明干本气：${facts(value.opposingDirect)}；反向中余气：${facts(value.opposingResidual)}；成势支局：${[...value.sameFormations, ...value.oppositeFormations].map((item) => `${item.members}${item.name}${item.element}`).join('、') || '无'}；结构条件${value.forceSatisfied ? '满足' : '不满足'}。\n异党类别：${value.categories.join('、') || '无'}。${hintLine}${value.limitation}`;
}
