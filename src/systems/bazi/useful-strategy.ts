import { SHENG_MAP } from '../ganzhi-foundation';
import type { BaziPillar, PillarName } from './pillars';
import type { buildDayMasterStrength } from './strength';
import type { summarizePattern } from './pattern';
import type { resolveClimate } from './climate-decision';
import { stemElementOf } from './natal-facts';

type Pillars = Record<PillarName, BaziPillar>;
const positions: PillarName[] = ['year', 'month', 'day', 'hour'];
const generates: Record<string, string> = SHENG_MAP;
const bridges = [
  { elements: ['水', '火'], bridge: '木' }, { elements: ['木', '金'], bridge: '水' },
  { elements: ['木', '土'], bridge: '火' }, { elements: ['土', '水'], bridge: '金' }, { elements: ['金', '火'], bridge: '土' },
] as const;

/** 司权及病药排序只调整当前有利集合；通关是关系候选，不替代实际作用核验。 */
export function buildUsefulStrategy(pillars: Pillars, strength: ReturnType<typeof buildDayMasterStrength>, pattern: ReturnType<typeof summarizePattern>, commanderStem: string, climate: ReturnType<typeof resolveClimate>) {
  const dayElement = pillars.day.stemElement, special = pattern.source !== '普通月令取格候选';
  const strong = ['极强', '身强', '偏强'].includes(strength.status), weak = ['极弱', '身弱', '偏弱'].includes(strength.status);
  const commanderElement = stemElementOf(commanderStem);
  let favorable = [...climate.favorable];
  const commanderApplied = !special && favorable.includes(commanderElement);
  if (commanderApplied) favorable = [commanderElement, ...favorable.filter((item) => item !== commanderElement)];
  const therapeuticCandidate = !special && strong && dayElement === '土' && '辰戌丑未'.includes(pillars.month.zhi) ? generates[dayElement] : null;
  const therapeuticApplied = therapeuticCandidate !== null && favorable.includes(therapeuticCandidate);
  if (therapeuticApplied) favorable = [therapeuticCandidate!, ...favorable.filter((item) => item !== therapeuticCandidate)];
  const resource = Object.keys(generates).find((element) => generates[element] === dayElement)!;
  const disease = special
    ? { status: '不适用', reason: '特殊格以顺从旺势为主线，不套用常规扶抑病药' }
    : !strong && !weak
      ? { status: '候选', direction: '中和流通', element: favorable[0] ?? generates[dayElement], reason: '中和命局以疏通流通、调候寒暖及护持格局清纯为先，岁运偏枯再转扶抑' }
      : {
          status: '候选', direction: strong ? '身强泄化' : '身弱生扶', element: strong ? generates[dayElement] : resource,
          reason: strong ? '核对食伤是否有根承泄、是否影响官杀与格局' : '核对印星根气及受财克制，并与比劫扶身比较',
        };
  const observed = positions.flatMap((position) => [
    { position, type: '天干' as const, value: pillars[position].gan, element: pillars[position].stemElement },
    { position, type: '地支本气' as const, value: pillars[position].zhi, element: pillars[position].branchElement },
  ]);
  const candidates = bridges.flatMap((rule) => {
    const [a, b] = rule.elements;
    const opposed = (favorable.includes(a) && climate.unfavorable.includes(b)) || (favorable.includes(b) && climate.unfavorable.includes(a));
    const first = observed.filter((item) => item.element === a), second = observed.filter((item) => item.element === b);
    if (!opposed || !first.length || !second.length) return [];
    return [{ elements: [...rule.elements], bridge: rule.bridge, sources: [...first, ...second],
      conditions: `核对${a}与${b}的月令、根气和位置是否形成实际相克，再核${rule.bridge}能否承接及是否符合全局取用` }];
  });
  return { commander: { stem: commanderStem, element: commanderElement, applied: commanderApplied }, therapeutic: { candidate: therapeuticCandidate, applied: therapeuticApplied },
    favorable, unfavorable: [...climate.unfavorable], conditionalFavorableStems: [...climate.conditionalFavorableStems], conditionalUnfavorableStems: [...climate.conditionalUnfavorableStems], disease, bridges: candidates,
    limitation: '病药与通关仅为所列模型的候选，五行出现不等于力量或实际作用；格局成败、病药作用及岁运尚未综合，不是最终用神。' };
}

export function formatUsefulStrategy(value: ReturnType<typeof buildUsefulStrategy>) {
  const disease = value.disease.status === '候选' ? `${value.disease.direction}，候选${value.disease.element}（${value.disease.reason}）` : `不适用（${value.disease.reason}）`;
  const bridgesText = value.bridges.length
    ? `${value.bridges.map((item) => `${item.elements.join('、')}候选${item.bridge}`).join('；')}（须核对相克两端月令、根气与位置是否实际相战，再核通关神能否承接）`
    : '未见';
  return `司权${value.commander.stem}${value.commander.element}${value.commander.applied ? '参与排序' : '未调整排序'}；土月疏泄${value.therapeutic.candidate ? `${value.therapeutic.candidate}（${value.therapeutic.applied ? '参与排序' : '未在当前有利方向中'}）` : '未命中'}。\n条件层方向：有利${value.favorable.join('、') || '随运平衡'}，不利${value.unfavorable.join('、') || '随运避偏'}；条件有利干${value.conditionalFavorableStems.join('、') || '无'}，条件不利干${value.conditionalUnfavorableStems.join('、') || '无'}。\n病药：${disease}。\n通关候选：${bridgesText}。${value.limitation}`;
}

export function summarizeUsefulStrategy(value: ReturnType<typeof buildUsefulStrategy>) {
  return `条件层有利${value.favorable.join('、') || '随运平衡'}、不利${value.unfavorable.join('、') || '随运避偏'}；病药${value.disease.status === '候选' ? `候选${value.disease.element}` : '不适用'}；通关${value.bridges.map((item) => `${item.elements.join('、')}候选${item.bridge}`).join('、') || '未见候选'}`;
}
