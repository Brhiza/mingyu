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
    conditional = [`化神偏旺时以所泄${generates[element]}疏通、所克${controls[element]}分势；化神偏弱则专取生扶`, `克化神的${previous(controls, element)}在顺势基线列忌，仅在化神过亢无泄时作权变制化参考`];
  } else if (pattern.source !== '普通月令取格候选') {
    switch (pattern.pattern) {
      case '曲直格': rule = '曲直顺势'; favorable = [resource, companion, output]; unfavorable = [officer]; basis = '印比顺势、食伤泄秀；土财见火通关可用，无火克印则忌'; break;
      case '专旺格': rule = '专旺顺势'; favorable = [resource, companion]; unfavorable = [wealth, officer]; basis = '印比顺势'; conditional = ['原局印轻时食伤可泄秀为喜，印重则食伤与印相碍不取']; break;
      case '从儿格': rule = '从儿顺局'; favorable = [wealth, output]; unfavorable = [resource, officer]; basis = '食伤生财顺局，忌印星制食与官杀逆局'; conditional = ['比劫在财旺时可生食伤助顺局，财轻时则争财转忌']; break;
      case '从财格': rule = '从财顺势'; favorable = [wealth, output]; unfavorable = [resource, companion]; basis = '财星顺势、食伤生财'; break;
      case '从杀格': rule = '从杀顺势'; favorable = [officer, wealth]; unfavorable = [output, resource, companion]; basis = '官杀顺势、财星生杀'; break;
      case '从势格': rule = '从势'; favorable = [output, wealth, officer]; unfavorable = [resource, companion]; basis = '异党顺势，按原局最旺异党为主导'; break;
      default: throw new Error(`未知特殊格局：${pattern.pattern}`);
    }
  } else if (['极强', '身强', '偏强'].includes(strength.status)) {
    rule = '扶抑身强'; favorable = [output, wealth, officer]; unfavorable = [resource, companion]; basis = '身强先看泄、耗、克';
  } else if (['极弱', '身弱', '偏弱'].includes(strength.status)) {
    rule = '扶抑身弱'; favorable = [resource, companion]; unfavorable = [output, wealth, officer]; basis = '身弱先看印比扶助';
  } else {
    const isWinter = '亥子丑'.includes(pillars.month.zhi);
    const isSummer = '巳午未'.includes(pillars.month.zhi);
    const supportCount = strength.support.filter((item) => item.actionable).length + strength.roots.filter((item) => item.actionable).length;
    const constraintCount = strength.constraint.filter((item) => item.actionable).length;
    const microBias = supportCount > constraintCount ? '偏生扶' : constraintCount > supportCount ? '偏克泄' : '均衡';
    if (isWinter) {
      rule = '中和调候流通';
      favorable = [...new Set(['火', microBias === '偏克泄' ? resource : output])];
      unfavorable = [...new Set(['水', microBias === '偏克泄' ? officer : companion].filter((el) => !favorable.includes(el)))];
      basis = `中和生于冬月寒湿（微${microBias}），先取火暖局调候，辅以顺势流通`;
    } else if (isSummer) {
      rule = '中和调候流通';
      favorable = [...new Set(['水', microBias === '偏克泄' ? resource : output])];
      unfavorable = [...new Set(['火', microBias === '偏克泄' ? officer : companion].filter((el) => !favorable.includes(el)))];
      basis = `中和生于夏月炎燥（微${microBias}），先取水润局调候，辅以顺势流通`;
    } else if (microBias === '偏生扶') {
      rule = '中和流通';
      favorable = [output, wealth];
      unfavorable = [companion];
      basis = '中和微偏生扶，主选食伤泄秀流通、财星适度疏导，忌比劫骤增破衡';
    } else if (microBias === '偏克泄') {
      rule = '中和流通';
      favorable = [resource, companion];
      unfavorable = [officer];
      basis = '中和微偏克泄，主选印星通关护身、比劫适度固本，忌官杀重压破衡';
    } else {
      rule = '中和流通';
      favorable = [output, resource];
      unfavorable = [officer];
      basis = '中和生扶与克泄均衡，平运以食伤流通吐秀、印星护格为主，忌官杀骤克破衡';
    }
    conditional = ['岁运印比骤增转强时顺取泄耗，财官食伤骤增转弱时转取印比护身'];
  }
  return { rule, basedOn: { dayElement: day, strength: strength.status, pattern: pattern.pattern, patternSource: pattern.source }, favorable, unfavorable, basis, conditional,
    limitation: '仅为所列旺衰和格局模型下的基础取向，并非最终用神或喜忌；尚未综合调候、病药、格局成败、作用位置及岁运，也不能据此判定双方喜忌覆盖。' };
}

export function formatUsefulBaseline(value: ReturnType<typeof buildUsefulBaseline>) {
  return `${value.rule}：${value.basis}；基础有利方向${value.favorable.join('、') || '随运平衡'}，基础不利方向${value.unfavorable.join('、') || '随运避偏'}。${value.conditional.length ? `条件：${value.conditional.join('；')}。` : ''}${value.limitation}`;
}
