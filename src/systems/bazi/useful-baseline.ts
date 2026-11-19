import type { BaziPillar, PillarName } from './pillars';
import type { buildDayMasterStrength } from './strength';
import type { summarizePattern } from './pattern';
import type { buildTransformation } from './transformation';

type Pillars = Record<PillarName, BaziPillar>;
const generates: Record<string, string> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const controls: Record<string, string> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
const previous = (map: Record<string, string>, element: string) => Object.keys(map).find((item) => map[item] === element)!;

/** 扶抑及已判特殊格的基础取向，不作为调候制化后的最终用神。 */
export function buildUsefulBaseline(pillars: Pillars, strength: ReturnType<typeof buildDayMasterStrength>, pattern: ReturnType<typeof summarizePattern>, transformation: ReturnType<typeof buildTransformation>) {
  const day = pillars.day.stemElement, companion = day, resource = previous(generates, day), output = generates[day], wealth = controls[day], officer = previous(controls, day);
  let rule: string, favorable: string[], unfavorable: string[], basis: string, conditional: string[] = [];
  if (pattern.source === '五合化气条件模型' && transformation?.status === '成化') {
    const element = transformation.element, resourceOfTransform = previous(generates, element);
    const coldEarth = element === '土' && '亥子丑'.includes(pillars.month.zhi);
    rule = '化神顺势'; favorable = coldEarth ? [resourceOfTransform, element] : [element, resourceOfTransform]; unfavorable = [previous(controls, element)];
    basis = `以化神${element}为取向主体${coldEarth ? '；冬月化土先取火温土' : ''}`;
    conditional = [`化神所泄的${generates[element]}及所克的${controls[element]}须另核能否承受泄耗`, `克化神的${previous(controls, element)}能否另作制化须结合全局核验`];
  } else if (pattern.source !== '普通月令取格候选') {
    switch (pattern.pattern) {
      case '曲直格': rule = '曲直顺势'; favorable = [resource, companion, output]; unfavorable = [officer]; basis = '印比顺势、食伤泄秀，财星作用另核'; break;
      case '专旺格': rule = '专旺顺势'; favorable = [resource, companion]; unfavorable = [wealth, officer]; basis = '印比顺势'; conditional = ['食伤须结合印星与实际泄秀作用另核']; break;
      case '从儿格': rule = '从儿顺局'; favorable = [wealth, output]; unfavorable = [resource, officer]; basis = '食伤生财顺局，印官作用另核'; conditional = ['比劫须按生食伤或争财的具体作用另核']; break;
      case '从财格': rule = '从财顺势'; favorable = [wealth, output]; unfavorable = [resource, companion]; basis = '财星顺势、食伤生财'; break;
      case '从杀格': rule = '从杀顺势'; favorable = [officer, wealth]; unfavorable = [output, resource, companion]; basis = '官杀顺势、财星生杀'; break;
      case '从势格': rule = '从势'; favorable = [output, wealth, officer]; unfavorable = [resource, companion]; basis = '异党顺势，具体作用分别核验'; break;
      default: throw new Error(`未知特殊格局：${pattern.pattern}`);
    }
  } else if (['极强', '身强', '偏强'].includes(strength.status)) {
    rule = '扶抑身强'; favorable = [output, wealth, officer]; unfavorable = [resource, companion]; basis = '身强先看泄、耗、克';
  } else if (['极弱', '身弱', '偏弱'].includes(strength.status)) {
    rule = '扶抑身弱'; favorable = [resource, companion]; unfavorable = [output, wealth, officer]; basis = '身弱先看印比扶助';
  } else {
    rule = '中和待判'; favorable = []; unfavorable = []; basis = '中和不预设整五行喜忌';
  }
  return { rule, basedOn: { dayElement: day, strength: strength.status, pattern: pattern.pattern, patternSource: pattern.source }, favorable, unfavorable, basis, conditional,
    limitation: '仅为所列旺衰和格局模型下的基础取向，并非最终用神或喜忌；尚未综合调候、病药、格局成败、作用位置及岁运，也不能据此判定双方喜忌覆盖。' };
}

export function formatUsefulBaseline(value: ReturnType<typeof buildUsefulBaseline>) {
  return `${value.rule}：${value.basis}；基础有利方向${value.favorable.join('、') || '待判'}，基础不利方向${value.unfavorable.join('、') || '待判'}。${value.conditional.length ? `条件：${value.conditional.join('；')}。` : ''}${value.limitation}`;
}
