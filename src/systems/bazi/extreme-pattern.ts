import { getTenStar } from '../ganzhi-foundation';
import type { BaziPillar, PillarName } from './pillars';
import type { buildDayMasterStrength } from './strength';
import type { buildQuzhi } from './quzhi';
import type { buildCongEr } from './conger';

type Pillars = Record<PillarName, BaziPillar>;
type Strength = ReturnType<typeof buildDayMasterStrength>;
const positions: PillarName[] = ['year', 'month', 'day', 'hour'];
const labels: Record<PillarName, string> = { year: '年柱', month: '月柱', day: '日柱', hour: '时柱' };
const sameParty = (god: string) => ['比肩', '劫财', '正印', '偏印'].includes(god);
const category = (god: string) => ['正财', '偏财'].includes(god) ? '财' : ['正官', '七杀'].includes(god) ? '官杀' : ['食神', '伤官'].includes(god) ? '食伤' : null;

/** 专旺与通用从格只按所列极强/极弱条件模型评估；保留所有相反证据。 */
export function buildExtremePattern(pillars: Pillars, strength: Strength, commanderStem: string, quzhi: ReturnType<typeof buildQuzhi>, conger: ReturnType<typeof buildCongEr>) {
  if (strength.status !== '极强' && strength.status !== '极弱') return null;
  const kind = strength.status === '极强' ? '专旺' : '从格';
  const commanderGod = getTenStar(pillars.day.gan, commanderStem);
  const direct = positions.flatMap((position) => [
    ...(position !== 'day' ? [{ position, source: '天干' as const, stem: pillars[position].gan, tenGod: pillars[position].tenGod }] : []),
    { position, source: '地支本气' as const, stem: pillars[position].hiddenStems[0].stem, tenGod: pillars[position].hiddenStems[0].tenGod },
  ]);
  const residual = positions.flatMap((position) => pillars[position].hiddenStems.slice(1).map(({ stem, tenGod }, index) => ({ position, source: '中余气' as const, hiddenIndex: index + 1, stem, tenGod })));
  const all = [...direct, ...residual], same = direct.filter((item) => sameParty(item.tenGod)), opposite = direct.filter((item) => !sameParty(item.tenGod));
  const sameResidual = residual.filter((item) => sameParty(item.tenGod)), oppositeResidual = residual.filter((item) => !sameParty(item.tenGod));
  const samePositions = [...new Set(sameResidual.map((item) => item.position))], oppositePositions = [...new Set(oppositeResidual.map((item) => item.position))];
  const formations = strength.formations.filter((item) => item.established);
  const sameFormations = formations.filter((item) => item.effect === '助身' || item.effect === '生身');
  const oppositeFormations = formations.filter((item) => item.effect !== '助身' && item.effect !== '生身');
  const pureSame = all.length > 0 && all.every((item) => sameParty(item.tenGod));
  const pureOpposite = all.length > 0 && all.every((item) => !sameParty(item.tenGod));
  const strongForce = (opposite.length === 0 || (sameFormations.length > 0 && opposite.length <= 1)) && (oppositePositions.length <= 1 || sameFormations.length > 0);
  const weakForce = (same.length === 0 || (oppositeFormations.length > 0 && same.length <= 1)) && (samePositions.length <= 1 || oppositeFormations.length > 0);
  const blockers = [
    ...(kind === '专旺' && quzhi ? ['曲直结构命中，须先核曲直条件'] : []),
    ...(conger?.route ? ['从儿结构命中，须先核顺局条件'] : []),
    ...(sameParty(commanderGod) !== (kind === '专旺') ? [`司权${commanderStem}${commanderGod}与${kind}方向不符`] : []),
    ...(!(kind === '专旺' ? pureSame || strongForce : pureOpposite || weakForce) ? [kind === '专旺' ? '异党明透本气或多柱中余气不满足专旺条件' : '同党明透本气或多柱中余气不满足从格条件'] : []),
  ];
  const directCategories = [...new Set([
    ...direct.map((item) => category(item.tenGod)),
    ...formations.map((item) => item.effect === '耗身' ? '财' : item.effect === '克身' ? '官杀' : item.effect === '泄身' ? '食伤' : null),
  ].filter((item) => item !== null))];
  const subPattern = directCategories.length !== 1 ? '从势格' : directCategories[0] === '财' ? '从财格' : directCategories[0] === '官杀' ? '从杀格' : '从势格';
  return { kind, pattern: kind === '专旺' ? '专旺格' : subPattern, status: blockers.length ? '存在反证' : '条件成立', strength: strength.status, commanderStem, commanderGod,
    direct, residual, samePositions, oppositePositions, sameFormations, oppositeFormations, directCategories, blockers,
    limitation: '这是按指定旺衰、司权、明干本气及中余气条件得到的模型结果；未成立时归回普通正格，综合调候与用神见用神裁定层。' };
}

type Extreme = NonNullable<ReturnType<typeof buildExtremePattern>>;
export function formatExtremePattern(value: Extreme | null) {
  if (!value) return '当前旺衰模型未落入极强或极弱，不触发此条件模型。';
  const facts = (items: Array<{ position: PillarName; source: string; stem: string; tenGod: string }>) => items.map((item) => `${labels[item.position]}${item.source}${item.stem}${item.tenGod}`).join('、') || '无';
  return `${value.kind}模型：${value.status}；候选${value.pattern}；日主${value.strength}，司权${value.commanderStem}${value.commanderGod}。\n明干与本气：${facts(value.direct)}。\n中余气：${facts(value.residual)}。\n同党成势支局：${value.sameFormations.map((item) => item.members + item.name).join('、') || '无'}；异党成势支局：${value.oppositeFormations.map((item) => item.members + item.name).join('、') || '无'}；通用从格类别：${value.directCategories.join('、') || '无'}。\n反证：${value.blockers.join('；') || '未见'}。${value.limitation}`;
}
