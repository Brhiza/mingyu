/**
 * TempoSoul·命律 — 五运六气证据链构建器
 *
 * 为 calculateWuyunLiuqi 结果附加 v3.0 四字段证据契约：
 *   计算链(computationChain) / 出处(source) / 边界(boundary) / 反证(counterEvidence)
 * + 置信度(confidence) + 深度(depth ≤4)
 *
 * 覆盖五运六气四大环节：运气基础 → 岁运主气 → 司天在泉 → 客主加临
 */
import {
  buildEvidenceTrail,
  type EvidenceItem,
  type EvidenceTrail,
} from '../shared/evidence';
import type { WuyunLiuqiCalculation } from './index';

export function buildWuyunLiuqiEvidenceTrail(result: WuyunLiuqiCalculation): EvidenceTrail {
  const items: EvidenceItem[] = [];

  // 1. 运气基础（depth 0 主证）
  items.push({
    title: '五运六气推算基础',
    system: 'wuyun-liuqi',
    computationChain: [
      {
        name: '年干支',
        reference: 'input.yearGanZhi',
        output: result.input.yearGanZhi,
      },
      {
        name: '干支来源',
        reference: 'input.yearGanZhiSource',
        output: result.input.yearGanZhiSource,
      },
      {
        name: '公历年',
        reference: 'input.year',
        output: result.input.year ?? null,
      },
    ],
    source: { type: 'classical', name: '《黄帝内经》五运六气（岁运/主气/客气）' },
    boundary: {
      applicableWhen: ['提供公历年份或年干支'],
      cautionWhen: ['以年为单位的传统节律结构', '不替代气象/健康资料'],
    },
    counterEvidence: [
      { description: '运气模型是传统理论，不构成科学预测', severity: 'alternative' },
    ],
    confidence: 'medium',
    depth: 0,
  });

  // 2. 岁运主气（depth 1 辅证）
  items.push({
    title: '岁运',
    system: 'wuyun-liuqi',
    computationChain: [
      {
        name: '年运',
        reference: 'annualMovement',
        output: result.annualMovement
          ? `${result.annualMovement.element ?? ''}${result.annualMovement.strength ?? ''}`
          : null,
      },
    ],
    source: { type: 'classical', name: '岁运太过/不及（中运）' },
    boundary: {
      applicableWhen: ['按年干定岁运'],
      cautionWhen: ['岁运强弱为传统判定'],
    },
    counterEvidence: [
      { description: '岁运判定口径存在流派差异', severity: 'alternative' },
    ],
    confidence: 'medium',
    depth: 1,
  });

  // 3. 司天在泉（depth 1 辅证）
  items.push({
    title: '司天在泉',
    system: 'wuyun-liuqi',
    computationChain: [
      {
        name: '司天',
        reference: 'sitian',
        output: result.sitian ? `${result.sitian.element ?? ''}${result.sitian.name ?? ''}` : null,
      },
      {
        name: '在泉',
        reference: 'zaiquan',
        output: result.zaiquan ? `${result.zaiquan.element ?? ''}${result.zaiquan.name ?? ''}` : null,
      },
      {
        name: '岁气关系',
        reference: 'annualRelation',
        output: result.annualRelation ?? null,
      },
    ],
    source: { type: 'classical', name: '司天在泉（客气三阴三阳）' },
    boundary: {
      applicableWhen: ['按地支定客气'],
      cautionWhen: ['客气随纪年轮转'],
    },
    counterEvidence: [
      { description: '司天在泉对应关系存在版本差异', severity: 'alternative' },
    ],
    confidence: 'medium',
    depth: 1,
  });

  // 4. 客主加临（depth 1 辅证）
  if (result.qiSteps.length > 0 || result.movementSteps.length > 0) {
    items.push({
      title: '客主加临',
      system: 'wuyun-liuqi',
      computationChain: [
        {
          name: '气运步骤',
          reference: 'qiSteps',
          output: result.qiSteps.map((s) => `${s.label}:${s.hostQi?.qi ?? ''}/${s.guestQi?.qi ?? ''}`).slice(0, 6),
        },
        {
          name: '五运步骤',
          reference: 'movementSteps',
          output: result.movementSteps.map((s) => `${s.label}:${s.hostMovement?.element ?? ''}`).slice(0, 6),
        },
      ],
      source: { type: 'classical', name: '五运六气分步（主运/客运/主气/客气）' },
      boundary: {
        applicableWhen: ['按节气分步'],
        cautionWhen: ['分步随节气轮转'],
      },
      counterEvidence: [
        { description: '分步起算存在流派差异', severity: 'minor' },
      ],
      confidence: 'low',
      depth: 1,
    });
  }

  return buildEvidenceTrail(
    items,
    `五运六气证据链（${result.input.yearGanZhi}年）`,
  );
}
