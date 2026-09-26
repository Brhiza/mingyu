import type { JinkoujueData, JinkoujueFourPosition } from '../types/divination';
import { evaluateJinkoujueBihePoems } from '../divination/algorithms/jinkoujue';

export function formatJinkoujueBihe(data: JinkoujueData): string {
  const facts = evaluateJinkoujueBihePoems(data.positions);
  return facts
    ? `四位比合：${facts}；依《六壬神课金口诀古本》卷上“入式歌解”，结合神将、位次与生克制化判断同气作用。`
    : '';
}

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

/** 四位取用的起课依据、具体生扶与制约，供单时刻和时间区间共用。 */
export function formatJinkoujueJudgmentFacts(data: JinkoujueData): string[] {
  const lines = [
    `起课：${data.methodLabel}；${data.calculation.diFenNote}`,
    `月将：${data.monthLeader}加占时${data.divinationBranch}；${data.calculation.monthLeaderRule}`,
    `贵神起例：${data.calculation.noblemanRule}；${data.calculation.guiShenRule}`,
    `遁干依据：${data.calculation.yuanDunRule}`,
    `昼夜口径：${data.calculation.dayNightRule}`,
    ...Object.values(data.positions).map((position) =>
      [
        `四位依据：${position.promptText}`,
        `取象${position.role}`,
        position.support.length ? `生扶：${position.support.join('、')}` : '',
        position.constraints.length ? `制约：${position.constraints.join('、')}` : '',
      ]
        .filter(Boolean)
        .join('；'),
    ),
    `阴阳次第：${data.yinYangUse.yinCount}阴${data.yinYangUse.yangCount}阳；${data.yinYangUse.rule}`,
  ];
  for (const focus of data.focusEvidence ?? []) {
    lines.push(
      `取用依据：${focus.target}（${focus.role}），${focus.level}：${focus.evidence.join('、')}${focus.limitations.length ? `；条件：${focus.limitations.join('、')}` : ''}`,
    );
  }
  const counters = data.evidenceAnalysis?.counterEvidenceFacts ?? [];
  if (counters.length)
    lines.push(`四位反证：${counters.map((item) => item.promptText).join('；')}`);
  lines.push(
    '以阴阳次第定发用，四位的生克、旺衰、空亡与动变条件合看，结合所问事项判断主客和进退。',
  );
  return lines;
}
