import type { JinkoujueData, JinkoujueFourPosition } from '../types/divination';

export function formatJinkoujueMovementRules(): string {
  return [
    '五动取法：人元克地分为妻动；贵神克人元为官动；贵神克将神为贼动；将神克贵神为财动；地分克人元为鬼动。',
    '三动取法：地分生人元为父母动；人元生地分为子孙动；人元与地分比和为兄弟动。',
  ].join('\n');
}

export function formatJinkoujueRelations(data: JinkoujueData): string {
  const p = data.positions;
  const pairs: Array<[JinkoujueFourPosition, JinkoujueFourPosition, string]> = [
    [p.guiShen, p.jiangShen, data.relations.guiToJiang],
    [p.guiShen, p.renYuan, data.relations.guiToRen],
    [p.jiangShen, p.diFen, data.relations.jiangToDi],
    [p.renYuan, p.diFen, data.relations.renToDi],
    [p.guiShen, p.diFen, data.relations.guiToDi],
  ];
  const label = (position: JinkoujueFourPosition) => `${position.name}${position.element}`;
  return `四位关系：${pairs
    .map(([from, to, relation]) => {
      if (relation === '被生') return `${label(to)}生${label(from)}`;
      if (relation === '被克') return `${label(to)}克${label(from)}`;
      if (relation === '比和') return `${label(from)}与${label(to)}比和`;
      if (relation === '生' || relation === '克') return `${label(from)}${relation}${label(to)}`;
      return `${label(from)}对${label(to)}为${relation}`;
    })
    .join('；')}`;
}
