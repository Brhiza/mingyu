/**
 * TempoSoul·命律 — 生肖流年证据链构建器
 *
 * 为 calculateZodiacYearFortune 结果附加 v3.0 四字段证据契约：
 *   计算链(computationChain) / 出处(source) / 边界(boundary) / 反证(counterEvidence)
 * + 置信度(confidence) + 深度(depth ≤4)
 *
 * 覆盖生肖流年四大环节：生肖流年基础 → 干支关系 → 犯太岁冲刑 → 吉凶信号
 */
import {
  buildEvidenceTrail,
  type EvidenceItem,
  type EvidenceTrail,
} from '../shared/evidence';
import type { ZodiacYearFortune } from './index';

export function buildZodiacEvidenceTrail(result: ZodiacYearFortune): EvidenceTrail {
  const items: EvidenceItem[] = [];

  // 1. 生肖流年基础（depth 0 主证）
  items.push({
    title: '生肖流年基础',
    system: 'zodiac',
    computationChain: [
      {
        name: '生肖',
        reference: 'zodiac',
        output: `${result.zodiac}（${result.zodiacBranch}）`,
      },
      {
        name: '流年',
        reference: 'yearGanZhi',
        output: result.yearGanZhi,
      },
    ],
    source: { type: 'classical', name: '十二生肖与流年干支' },
    boundary: {
      applicableWhen: ['提供生肖与流年'],
      cautionWhen: ['仅限生肖与流年关系', '不构成现实预测'],
    },
    counterEvidence: [
      { description: '生肖流年吉凶缺乏实证验证', severity: 'alternative' },
    ],
    confidence: 'low',
    depth: 0,
  });

  // 2. 干支关系（depth 1 辅证）
  items.push({
    title: '干支关系',
    system: 'zodiac',
    computationChain: [
      {
        name: '年干生肖关系',
        reference: 'relation',
        output: result.relation,
      },
      {
        name: '五行关系',
        reference: 'elementRelation',
        output: result.elementRelation ?? null,
      },
    ],
    source: { type: 'classical', name: '天干五行与生肖地支关系' },
    boundary: {
      applicableWhen: ['按五行生克判断'],
      cautionWhen: ['关系为传统五行归类'],
    },
    counterEvidence: [
      { description: '五行关系归类存在版本差异', severity: 'alternative' },
    ],
    confidence: 'medium',
    depth: 1,
  });

  // 3. 犯太岁冲刑（depth 1 辅证）
  items.push({
    title: '犯太岁冲刑',
    system: 'zodiac',
    computationChain: [
      {
        name: '犯太岁明细',
        reference: 'conflicts',
        output: result.conflicts.map((c) => `${c.type}:${c.desc}`),
      },
      {
        name: '太岁神',
        reference: '太岁星',
        output: result.yearBranch,
      },
    ],
    source: { type: 'classical', name: '太岁与地支冲刑害破（值/冲/刑/害/破）' },
    boundary: {
      applicableWhen: ['按流年地支判断'],
      cautionWhen: ['犯太岁仅为传统说法'],
    },
    counterEvidence: [
      { description: '犯太岁说法不同版本口径不同', severity: 'alternative' },
    ],
    confidence: 'low',
    depth: 1,
  });

  // 4. 吉凶信号（depth 1 辅证）
  items.push({
    title: '吉凶信号',
    system: 'zodiac',
    computationChain: [
      {
        name: '有利关系',
        reference: 'favorableRelations',
        output: result.favorableRelations,
      },
      {
        name: '风险关系',
        reference: 'riskRelations',
        output: result.riskRelations,
      },
      {
        name: '行动信号',
        reference: 'actionSignals',
        output: result.actionSignals,
      },
    ],
    source: { type: 'classical', name: '三合/六合贵人与会局关系' },
    boundary: {
      applicableWhen: ['综合三合六合'],
      cautionWhen: ['贵人/三会仅为关系记录'],
    },
    counterEvidence: [
      { description: '吉凶信号断法主观性强', severity: 'alternative' },
    ],
    confidence: 'low',
    depth: 1,
  });

  return buildEvidenceTrail(
    items,
    `生肖流年证据链（${result.zodiac}遇${result.yearGanZhi}年）`,
  );
}
