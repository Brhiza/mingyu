import type { BaziChartResult } from 'mingyu-core/bazi';

/** 盘面与分享文本使用同一组本命判断依据。 */
export function formatBaziDecisionDetails(result: BaziChartResult): string[] {
  const { dayMasterStrength, mingGe, usefulGod } = result.analysis;
  const strength = dayMasterStrength.details;
  const fulfillment = mingGe.fulfillment;
  const decision = usefulGod.decisionEvidence;
  return [
    `旺衰依据：${strength.ruleBasis[0]}`,
    `扶抑条件：月令${strength.seasonalEffect}，司令${strength.commanderEffect}；${strength.hasStrongRoot ? '有未受冲本气根' : strength.hasRoot ? '见根但非稳定本气根' : '无根'}；${strength.hasSupport ? '有印比扶助' : '未见印比扶助'}；${strength.hasConstraint ? '有克泄耗' : '未见克泄耗'}；成局${strength.formationEffect}`,
    mingGe.basis ? `取格依据：${mingGe.basis}` : '',
    fulfillment ? `格局成败：${fulfillment.status}；${fulfillment.summary}` : '',
    ...(fulfillment?.conditionFacts ?? []).map(
      (condition) => `成格条件（${condition.status}）：${condition.detail}`,
    ),
    fulfillment?.contradiction ? `格局反证：${fulfillment.contradiction}` : '',
    decision
      ? `取用基线：${mingGe.isSpecial ? '特殊格局顺势' : dayMasterStrength.status + '扶抑'}，喜${decision.base.favorable.join('、') || '待定'}，忌${decision.base.unfavorable.join('、') || '待定'}`
      : '',
    decision?.appliedLayers.length ? `取用层次：${decision.appliedLayers.join(' → ')}` : '',
    decision?.climateReferenceOrder?.length
      ? `调候参考次序：${decision.climateReferenceOrder.join('、')}；综合取用见五行取用，具体天干的作用见条件取用`
      : '',
  ].filter(Boolean);
}
