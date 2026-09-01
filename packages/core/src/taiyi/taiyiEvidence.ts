/**
 * TempoSoul·命律 — 太乙神数证据链构建器
 *
 * 为 generateTaiyi 结果附加 v3.0 四字段证据契约：
 *   计算链(computationChain) / 出处(source) / 边界(boundary) / 反证(counterEvidence)
 * + 置信度(confidence) + 深度(depth ≤4)
 *
 * 覆盖太乙四大环节：起局基础 → 积算入局 → 太乙定位 → 十六神将
 */
import {
  buildEvidenceTrail,
  type EvidenceItem,
  type EvidenceTrail,
} from '../shared/evidence';
import type { TaiyiResult } from '../types/divination';

export function buildTaiyiEvidenceTrail(result: TaiyiResult): EvidenceTrail {
  const items: EvidenceItem[] = [];

  // 1. 起局基础（depth 0 主证）
  items.push({
    title: '太乙起局基础',
    system: 'taiyi',
    computationChain: [
      {
        name: '计式',
        reference: 'scope',
        output: result.scope,
      },
      {
        name: '干支',
        reference: 'ganZhi',
        output: result.ganZhi,
      },
      {
        name: '时间',
        reference: 'dateTime',
        output: result.dateTime,
      },
    ],
    source: { type: 'classical', name: '太乙神数（年/月/日/时家计式）' },
    boundary: {
      applicableWhen: ['提供占问时间'],
      cautionWhen: ['计式选择影响结果', '历法基准存在版本差异'],
    },
    counterEvidence: [
      { description: '太乙积年基准不同流派存在差异', severity: 'alternative' },
    ],
    confidence: 'medium',
    depth: 0,
  });

  // 2. 积算入局（depth 1 辅证）
  items.push({
    title: '积算入局',
    system: 'taiyi',
    computationChain: [
      {
        name: '积算值',
        reference: 'accumulatedValue',
        output: result.accumulatedValue,
      },
      {
        name: '阴阳遁',
        reference: 'yinYang',
        output: result.yinYang,
      },
      {
        name: '局数',
        reference: 'bureau',
        output: result.bureau,
      },
    ],
    source: { type: 'classical', name: '太乙积年与遁局推算' },
    boundary: {
      applicableWhen: ['按积年入局'],
      cautionWhen: ['阴阳遁局依计式'],
    },
    counterEvidence: [
      { description: '入局口径存在流派差异', severity: 'alternative' },
    ],
    confidence: 'medium',
    depth: 1,
  });

  // 3. 太乙定位（depth 1 辅证）
  items.push({
    title: '太乙定位',
    system: 'taiyi',
    computationChain: [
      {
        name: '太乙方位',
        reference: 'taiyiPosition',
        output: result.taiyiPosition,
      },
      {
        name: '太乙宫',
        reference: 'taiyiPalace',
        output: result.taiyiPalace,
      },
      {
        name: '太乙卦',
        reference: 'taiyiGua',
        output: result.taiyiGua,
      },
      {
        name: '文昌/始击/计神',
        reference: 'wenChang/shiJi/jiShen',
        output: {
          wenChang: result.wenChangPosition,
          shiJi: result.shiJiPosition,
          jiShen: result.jiShenPosition,
        },
      },
    ],
    source: { type: 'classical', name: '太乙八将定位（太乙/文昌/始击/计神等）' },
    boundary: {
      applicableWhen: ['按积算定位神将'],
      cautionWhen: ['神将顺序依遁局'],
    },
    counterEvidence: [
      { description: '神将定位不同流派存在差异', severity: 'alternative' },
    ],
    confidence: 'medium',
    depth: 1,
  });

  // 4. 十六神将（depth 1 辅证）
  if (result.sixteenGods.length > 0) {
    items.push({
      title: '十六神将',
      system: 'taiyi',
      computationChain: [
        {
          name: '神将',
          reference: 'sixteenGods',
          output: result.sixteenGods.map((g) => `${g.god}:${g.branch}`).slice(0, 16),
        },
      ],
      source: { type: 'classical', name: '太乙十六神将' },
      boundary: {
        applicableWhen: ['按神将判断'],
        cautionWhen: ['神将吉凶为主观断法'],
      },
      counterEvidence: [
        { description: '神将吉凶断法存在流派差异', severity: 'alternative' },
      ],
      confidence: 'low',
      depth: 1,
    });
  }

  return buildEvidenceTrail(
    items,
    `太乙证据链（${result.scope}·${result.ganZhi}）`,
  );
}
