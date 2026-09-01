/**
 * TempoSoul·命律 — 金口诀起课证据链构建器
 *
 * 为 generateJinkoujue 结果附加 v3.0 四字段证据契约：
 *   计算链(computationChain) / 出处(source) / 边界(boundary) / 反证(counterEvidence)
 * + 置信度(confidence) + 深度(depth ≤4)
 *
 * 覆盖金口诀起课四大环节：起课基础 → 月将贵神 → 四课定位 → 旬空旺衰
 */
import {
  buildEvidenceTrail,
  type EvidenceItem,
  type EvidenceTrail,
} from '../shared/evidence';
import type { JinkoujueData } from '../types/divination';

export function buildJinkoujueEvidenceTrail(result: JinkoujueData): EvidenceTrail {
  const items: EvidenceItem[] = [];

  // 1. 起课基础（depth 0 主证）
  items.push({
    title: '金口诀起课基础',
    system: 'jinkoujue',
    computationChain: [
      {
        name: '起课方法',
        reference: 'method',
        output: `${result.methodLabel}（${result.method}）`,
      },
      {
        name: '干支纪时',
        reference: 'ganzhi',
        output: `${result.ganzhi.year}年${result.ganzhi.month}月${result.ganzhi.day}日`,
      },
      {
        name: '昼夜',
        reference: 'dayNight',
        output: result.dayNight,
      },
    ],
    source: { type: 'classical', name: '《大六壬金口诀》/《孙膑兵法神课》体系' },
    boundary: {
      applicableWhen: ['提供占问时辰'],
      cautionWhen: ['昼夜判定影响贵神取用', '月将换月以节气为准'],
    },
    counterEvidence: [
      { description: '金口诀流派对贵神/月将取用存在差异', severity: 'alternative' },
    ],
    confidence: 'medium',
    depth: 0,
  });

  // 2. 月将贵神（depth 1 辅证）
  items.push({
    title: '月将贵神',
    system: 'jinkoujue',
    computationChain: [
      {
        name: '月将',
        reference: 'monthLeader',
        output: result.monthLeader,
      },
      {
        name: '贵神',
        reference: 'noblemanBranch',
        output: result.noblemanBranch,
      },
      {
        name: '用神支',
        reference: 'divinationBranch',
        output: result.divinationBranch,
      },
    ],
    source: { type: 'classical', name: '十二月将与贵神排布（昼贵/夜贵）' },
    boundary: {
      applicableWhen: ['按节气定月将'],
      cautionWhen: ['贵神昼夜取用依起课时刻'],
    },
    counterEvidence: [
      { description: '月将加时起用存在流派差异', severity: 'alternative' },
    ],
    confidence: 'medium',
    depth: 1,
  });

  // 3. 四课定位（depth 1 辅证）
  items.push({
    title: '四课定位',
    system: 'jinkoujue',
    computationChain: [
      {
        name: '四课',
        reference: 'positions',
        output: Object.entries(result.positions).map(([k, v]) => `${k}:${v.branch ?? ''}`),
      },
      {
        name: '四课关系',
        reference: 'relations',
        output: Object.entries(result.relations).map(([k, v]) => `${k}:${v}`),
      },
    ],
    source: { type: 'classical', name: '金口诀四课（地分/将神/贵神/人元）' },
    boundary: {
      applicableWhen: ['按四课五行生克断课'],
      cautionWhen: ['断课五行生克存在流派侧重'],
    },
    counterEvidence: [
      { description: '四课生克断法不同流派结论不同', severity: 'alternative' },
    ],
    confidence: 'medium',
    depth: 1,
  });

  // 4. 旬空旺衰（depth 1 辅证）
  items.push({
    title: '旬空旺衰',
    system: 'jinkoujue',
    computationChain: [
      {
        name: '旬空',
        reference: 'xunKong',
        output: result.xunKong,
      },
      {
        name: '地分',
        reference: 'diFenBranch',
        output: result.diFenBranch,
      },
    ],
    source: { type: 'classical', name: '旬空与地支旺衰（金口诀断法）' },
    boundary: {
      applicableWhen: ['按旬空判虚'],
      cautionWhen: ['旺衰判定依季节五行'],
    },
    counterEvidence: [
      { description: '旬空应期与旺衰判定存在流派差异', severity: 'minor' },
    ],
    confidence: 'low',
    depth: 1,
  });

  return buildEvidenceTrail(
    items,
    `金口诀起课证据链（${result.methodLabel}·${result.ganzhi.day}日）`,
  );
}
