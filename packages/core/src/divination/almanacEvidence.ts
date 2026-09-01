/**
 * TempoSoul·命律 — 黄历择日证据链构建器
 *
 * 为 generateAlmanacSelection 结果附加 v3.0 方案要求的四字段证据契约：
 *   计算链(computationChain) / 出处(source) / 边界(boundary) / 反证(counterEvidence)
 * + 置信度(confidence) + 深度(depth ≤4)
 *
 * 覆盖黄历择日四大环节：择日基础 → 宜忌筛选 → 参与人核对 → 时辰条件
 */
import {
  buildEvidenceTrail,
  type EvidenceItem,
  type EvidenceTrail,
} from '../shared/evidence';
import type { AlmanacData } from '../types/divination';

export function buildAlmanacEvidenceTrail(result: AlmanacData): EvidenceTrail {
  const items: EvidenceItem[] = [];

  // 1. 择日基础（depth 0 主证）
  items.push({
    title: '黄历择日基础',
    system: 'almanac',
    computationChain: [
      {
        name: '事项',
        reference: 'topic',
        output: `${result.topicLabel}（${result.topic}）`,
      },
      {
        name: '日期范围',
        reference: 'startDate/endDate',
        inputs: { startDate: result.startDate, endDate: result.endDate },
      },
    ],
    source: { type: 'classical', name: '《通书》/《协纪辨方书》择日体系' },
    boundary: {
      applicableWhen: ['提供事项类型与日期范围'],
      cautionWhen: ['不同通书对宜忌口径有差异', '同一事项在不同地区习俗不同'],
    },
    counterEvidence: [
      { description: '宜忌内容在不同通书/版本间存在差异', severity: 'alternative' },
    ],
    confidence: 'medium',
    depth: 0,
  });

  // 2. 宜忌筛选（depth 1 辅证）
  if (result.days.length > 0) {
    items.push({
      title: '宜忌筛选',
      system: 'almanac',
      computationChain: [
        {
          name: '候选日期',
          reference: 'days',
          output: result.days.map((d) => `${d.date}`).slice(0, 20),
        },
        {
          name: '候选数量',
          output: result.days.length,
        },
      ],
      source: { type: 'classical', name: '通书宜忌规则（神煞/建除/黄黑道）' },
      boundary: {
        applicableWhen: ['按事项匹配宜忌'],
        cautionWhen: ['神煞与建除取用口径不同'],
      },
      counterEvidence: [
        { description: '宜忌优先级与冲煞判定存在流派差异', severity: 'alternative' },
      ],
      confidence: 'medium',
      depth: 1,
    });
  }

  // 3. 参与人核对（depth 1 辅证）
  if (result.participants.length > 0) {
    items.push({
      title: '参与人核对',
      system: 'almanac',
      computationChain: [
        {
          name: '参与人生肖',
          reference: 'participants',
          output: result.participants.map((p) => `${p.name}:${p.zodiac}`),
        },
      ],
      source: { type: 'classical', name: '生肖冲煞合参（择日民俗）' },
      boundary: {
        applicableWhen: ['提供参与人生辰'],
        cautionWhen: ['冲煞判定存在地域习俗差异'],
      },
      counterEvidence: [
        { description: '生肖冲煞规则不同版本差异较大', severity: 'alternative' },
      ],
      confidence: 'low',
      depth: 1,
    });
  }

  // 4. 时辰条件（depth 1 辅证）
  const hourCount = result.days.reduce(
    (sum, d) => sum + (d.hours ? d.hours.length : 0),
    0,
  );
  if (hourCount > 0) {
    items.push({
      title: '时辰条件',
      system: 'almanac',
      computationChain: [
        {
          name: '吉时筛选',
          reference: 'hours',
          output: { candidateHourCount: hourCount },
        },
      ],
      source: { type: 'classical', name: '通书吉时规则' },
      boundary: {
        applicableWhen: ['按吉时匹配'],
        cautionWhen: ['时辰吉凶依赖具体通书'],
      },
      counterEvidence: [
        { description: '吉时判定规则不同通书存在差异', severity: 'minor' },
      ],
      confidence: 'low',
      depth: 1,
    });
  }

  return buildEvidenceTrail(
    items,
    `黄历择日证据链（${result.topicLabel}，${result.startDate}~${result.endDate}）`,
  );
}
