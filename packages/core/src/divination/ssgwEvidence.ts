/**
 * TempoSoul·命律 — 灵签抽签证据链构建器
 *
 * 为 drawRandomSign / resolveSignByNumber 结果附加 v3.0 四字段证据契约：
 *   计算链(computationChain) / 出处(source) / 边界(boundary) / 反证(counterEvidence)
 * + 置信度(confidence) + 深度(depth ≤4)
 *
 * 覆盖灵签抽签四大环节：抽签基础 → 求签时间 → 签文呈现 → 抽取方式
 */
import {
  buildEvidenceTrail,
  type EvidenceItem,
  type EvidenceTrail,
} from '../shared/evidence';
import type { SsgwData } from '../types/divination';

export function buildSsgwEvidenceTrail(result: SsgwData): EvidenceTrail {
  const items: EvidenceItem[] = [];

  // 1. 抽签基础（depth 0 主证）
  items.push({
    title: '灵签抽签基础',
    system: 'ssgw',
    computationChain: [
      {
        name: '签数',
        reference: 'draw.poolSize',
        output: result.draw?.poolSize ?? null,
      },
      {
        name: '抽得签号',
        reference: 'number',
        output: result.number,
      },
    ],
    source: { type: 'classical', name: '观音灵签（第一百签）体系' },
    boundary: {
      applicableWhen: ['在签池中随机抽取'],
      cautionWhen: ['签文寓意随求问事由而变化', '不同灵签版本签文有差异'],
    },
    counterEvidence: [
      { description: '不同灵签体系（观音/关帝/吕祖）签文不同', severity: 'alternative' },
    ],
    confidence: 'medium',
    depth: 0,
  });

  // 2. 求签时间（depth 1 辅证）
  items.push({
    title: '求签时间',
    system: 'ssgw',
    computationChain: [
      {
        name: '干支纪时',
        reference: 'ganzhi',
        output: `${result.ganzhi.year}年${result.ganzhi.month}月${result.ganzhi.day}日`,
      },
    ],
    source: { type: 'classical', name: '干支纪时（求签时间）' },
    boundary: {
      applicableWhen: ['记录求签时刻'],
      cautionWhen: ['跨日/跨年转换以当地时间为准'],
    },
    counterEvidence: [
      { description: '干支纪时与公历换算口径存在细微差异', severity: 'minor' },
    ],
    confidence: 'medium',
    depth: 1,
  });

  // 3. 签文呈现（depth 1 辅证）
  items.push({
    title: '签文呈现',
    system: 'ssgw',
    computationChain: [
      {
        name: '签题',
        reference: 'title',
        output: result.title,
      },
      {
        name: '签诗',
        reference: 'poem',
        output: result.poem,
      },
      {
        name: '注解',
        reference: 'details',
        output: result.details ?? null,
      },
    ],
    source: { type: 'classical', name: '观音灵签签文与注解' },
    boundary: {
      applicableWhen: ['按签号呈现签文'],
      cautionWhen: ['签意解读存在多解'],
    },
    counterEvidence: [
      { description: '同一签文不同解签者解读不同', severity: 'alternative' },
    ],
    confidence: 'low',
    depth: 1,
  });

  // 4. 抽取方式（depth 1 辅证）
  items.push({
    title: '抽取方式',
    system: 'ssgw',
    computationChain: [
      {
        name: '抽取方法',
        reference: 'draw.method',
        output: result.draw?.method ?? null,
      },
      {
        name: '选中编号',
        reference: 'draw.selectedNumber',
        output: result.draw?.selectedNumber ?? null,
      },
    ],
    source: { type: 'algorithm', name: '随机抽样（签池等概率）' },
    boundary: {
      applicableWhen: ['随机抽签'],
      cautionWhen: ['manual 方式为用户手工录入签号'],
    },
    counterEvidence: [
      { description: '抽签随机性不影响签文内容本身', severity: 'minor' },
    ],
    confidence: 'medium',
    depth: 1,
  });

  return buildEvidenceTrail(
    items,
    `灵签抽签证据链（第${result.number}签·${result.title}）`,
  );
}
