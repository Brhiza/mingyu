import type { BaziChartResult } from 'mingyu-core/bazi';

const GANZHI_STEM_CHARS = '甲乙丙丁戊己庚辛壬癸';
const PILLAR_LABELS: Record<string, string> = {
  year: '年柱',
  month: '月柱',
  day: '日柱',
  hour: '时柱',
};

function formatStrengthBasisForDisplay(basis: string): string {
  return basis
    .replace(new RegExp(`\\b(year|month|day|hour)(?=[${GANZHI_STEM_CHARS}])`, 'g'), (_, key) => {
      return PILLAR_LABELS[key] ?? key;
    })
    .replace(/小数总分/g, '机械分数')
    .replace(/within-balance/g, '平衡规则')
    .replace(/wei-month-jia/g, '未月甲木调候')
    .replace(/ruleId/g, '规则');
}

/** 盘面与分享文本使用同一组本命判断依据。 */
export function formatBaziDecisionDetails(result: BaziChartResult): string[] {
  const { dayMasterStrength, mingGe, usefulGod } = result.analysis;
  const strength = dayMasterStrength.details;
  const fulfillment = mingGe.fulfillment;
  const decision = usefulGod.decisionEvidence;
  const transformation = mingGe.transformation;
  const strengthBasis = strength.ruleBasis.filter(Boolean).map(formatStrengthBasisForDisplay);
  return [
    ...(strengthBasis.length
      ? strengthBasis.map((basis) => `旺衰依据：${basis}`)
      : ['旺衰依据：月令、司令、通根、帮扶与克泄耗合看']),
    `扶抑条件：月令${strength.seasonalEffect}，司令${strength.commanderEffect}；${strength.hasStrongRoot ? '有未受冲本气根' : strength.hasRoot ? '见根但非稳定本气根' : '无根'}；${strength.hasSupport ? '有印比扶助' : '未见印比扶助'}；${strength.hasConstraint ? '有克泄耗' : '未见克泄耗'}；成局${strength.formationEffect}`,
    mingGe.basis ? `取格依据：${mingGe.basis}` : '',
    fulfillment ? `格局成败：${fulfillment.status}；${fulfillment.summary}` : '',
    ...(fulfillment?.conditionFacts ?? []).map(
      (condition) => `成格条件（${condition.status}）：${condition.detail}`,
    ),
    ...(fulfillment?.pathEvaluations ?? []).map(
      (path) => `制化路径（${path.status}）：${path.label}（${path.position}）；${path.detail}`,
    ),
    ...(fulfillment?.remedies ?? []).map((remedy) => `候选取用：${remedy.effect}`),
    fulfillment?.contradiction ? `格局反证：${fulfillment.contradiction}` : '',
    ...(transformation
      ? [
          `化气判定：${transformation.status}；化神${transformation.element}；${transformation.basis}`,
          ...transformation.evidence.map((item) => `化气证据：${item}`),
          ...transformation.conditions.map((item) => `化气条件：${item}`),
          ...(transformation.status === '成化'
            ? [
                `化神取用主体：化神${transformation.element}；原日主${result.dayMaster.gan}旺衰与十神作为本命事实，取用按化神及其条件核验。`,
              ]
            : []),
        ]
      : []),
    decision
      ? `取用基线：${transformation?.status === '成化' ? `化神${transformation.element}顺势` : mingGe.isSpecial ? '特殊格局顺势' : dayMasterStrength.status + '扶抑'}，喜${decision.base.favorable.join('、') || '待定'}，忌${decision.base.unfavorable.join('、') || '待定'}`
      : '',
    decision?.appliedLayers.length ? `取用层次：${decision.appliedLayers.join(' → ')}` : '',
    decision?.balanceAdjustment ? `取用配合：${decision.balanceAdjustment.reason}` : '',
    decision?.climateReferenceOrder?.length
      ? `调候参考次序：${decision.climateReferenceOrder.join('、')}；综合取用见五行取用，具体天干的作用见条件取用`
      : '',
  ].filter(Boolean);
}
