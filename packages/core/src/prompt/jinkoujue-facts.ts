import type { JinkoujueData, JinkoujueFourPosition } from '../types/divination';
import { evaluateJinkoujueBihePoems } from '../divination/algorithms/jinkoujue';
import { analyzeJinkoujueEvidence } from '../divination/jinkoujue-evidence';
import { getJinkoujueElementRelation } from '../divination/jinkoujue-utils';

export function formatJinkoujueBihe(data: JinkoujueData): string {
  const facts = evaluateJinkoujueBihePoems(data.positions);
  return facts
    ? `四位比合：${facts}；依《六壬神课金口诀古本》卷上“入式歌解”，结合神将、位次与生克制化判断同气作用。`
    : '';
}

export function formatJinkoujueRelations(data: JinkoujueData): string {
  const p = data.positions;
  const pairs: Array<[JinkoujueFourPosition, JinkoujueFourPosition, string]> = [
    [p.guiShen, p.jiangShen, data.relations.guiToJiang],
    [p.guiShen, p.renYuan, data.relations.guiToRen],
    [
      p.renYuan,
      p.jiangShen,
      data.relations.renToJiang ??
        getJinkoujueElementRelation(p.renYuan.element, p.jiangShen.element),
    ],
    [p.jiangShen, p.diFen, data.relations.jiangToDi],
    [p.renYuan, p.diFen, data.relations.renToDi],
    [p.guiShen, p.diFen, data.relations.guiToDi],
  ];
  const label = (position: JinkoujueFourPosition) => `${position.name}${position.element}`;
  const movementPairs = new Set(
    (data.movements ?? []).map(
      (movement) => `${movement.from}|${movement.to}|${movement.relation}`,
    ),
  );
  const relations = pairs
    .filter(([from, to, relation]) => {
      const pair =
        relation === '被生' || relation === '被克'
          ? `${to.name}|${from.name}|${relation.slice(1)}`
          : `${from.name}|${to.name}|${relation}`;
      return !movementPairs.has(pair);
    })
    .map(([from, to, relation]) => {
      if (relation === '被生') return `${label(to)}生${label(from)}`;
      if (relation === '被克') return `${label(to)}克${label(from)}`;
      if (relation === '比和') return `${label(from)}与${label(to)}比和`;
      if (relation === '生' || relation === '克') return `${label(from)}${relation}${label(to)}`;
      return `${label(from)}对${label(to)}为${relation}`;
    })
    .join('；');
  return relations ? `四位关系：${relations}` : '';
}

export function formatJinkoujuePosition(position: JinkoujueFourPosition): string {
  const stem = position.name === '地分' ? '' : position.stem || '';
  const god = position.name === '贵神' ? `乘${position.god || ''}` : '';
  return `${position.name}${stem}${position.branch}${god}（${position.yinYang}${position.element}，月令${position.seasonState}${position.isVoid ? '，空' : ''}）`;
}

/** 四位取用的起课依据、具体生扶与制约，供单时刻和时间区间共用。 */
export function formatJinkoujueJudgmentFacts(
  data: JinkoujueData,
  options: {
    compact?: boolean;
    displayedRelations?: readonly string[];
    displayedPositionFacts?: readonly string[];
  } = {},
): string[] {
  const evidence = analyzeJinkoujueEvidence(data);
  const compact = options.compact ?? false;
  const lines = [
    `起课：${data.methodLabel}；${data.calculation.diFenNote}`,
    `月将：${data.monthLeader}加占时${data.divinationBranch}；${data.calculation.monthLeaderRule}`,
    `贵神起例：${data.calculation.noblemanRule}；${data.calculation.guiShenRule}`,
    `遁干依据：${data.calculation.yuanDunRule}`,
    `昼夜口径：${data.calculation.dayNightRule}`,
  ];

  const positions = Object.values(data.positions);
  if (compact) {
    lines.push(
      `四位取象：${positions.map((position) => `${position.name}${position.role}`).join('；')}`,
      `四位五行依据：${positions.map((position) => `${position.name}按${position.elementBasis}`).join('；')}`,
    );
    const stemElements = positions
      .filter(
        (position) => position.stem && position.stemElement && position.elementBasis !== '人元干',
      )
      .map((position) => `${position.name}遁干${position.stem}属${position.stemElement}`);
    if (stemElements.length) lines.push(`遁干五行：${stemElements.join('；')}`);
  } else {
    lines.push(
      ...positions.map((position) =>
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
    );
    for (const focus of data.focusEvidence ?? []) {
      lines.push(
        `取用依据：${focus.target}（${focus.role}），${focus.level}：${focus.evidence.join('、')}${focus.limitations.length ? `；条件：${focus.limitations.join('、')}` : ''}`,
      );
    }
  }
  const weakPositions: string[] = [];
  const counters = evidence.counterEvidenceFacts.filter((item) => {
    const position = positions.find(
      (candidate) => item.ownerKey === `jinkoujue:position:${candidate.name}`,
    );
    if (position && options.displayedPositionFacts?.includes(formatJinkoujuePosition(position))) {
      if (
        item.type === '旬空' &&
        position.isVoid &&
        item.detail === `${position.name}${position.branch}落日旬空` &&
        item.promptText === item.detail
      )
        return false;
      if (
        item.type === '月令限制' &&
        item.detail === `${position.name}月令${position.seasonState}` &&
        item.promptText === `${position.name}处月令${position.seasonState}，力量条件偏弱`
      ) {
        weakPositions.push(position.name);
        return false;
      }
    }
    return (
      item.type !== '受克' ||
      !positions.some((source) =>
        positions.some(
          (target) =>
            item.detail === `${target.name}受${source.name}克` &&
            item.promptText === item.detail &&
            options.displayedRelations?.some((text) =>
              text.includes(`${source.name}${source.element}克${target.name}${target.element}`),
            ),
        ),
      )
    );
  });
  if (counters.length)
    lines.push(`四位反证：${counters.map((item) => item.promptText).join('；')}`);
  if (weakPositions.length) lines.push(`月令受限：${weakPositions.join('、')}力量条件偏弱`);
  if (!compact)
    lines.push(
      '以阴阳次第定发用，四位的生克、旺衰、空亡与动变条件合看，结合所问事项判断主客和进退。',
    );
  return lines;
}
