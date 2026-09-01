/**
 * TempoSoul·命律 — 西洋占星星盘证据链构建器
 *
 * 为 generateAstrolabe 结果附加 v3.0 方案要求的四字段证据契约：
 *   计算链(computationChain) / 出处(source) / 边界(boundary) / 反证(counterEvidence)
 * + 置信度(confidence) + 深度(depth ≤4)
 *
 * 覆盖西洋占星五大环节：星盘基础 → 真太阳时 → 星体相位 → 宫位四轴 → 星盘摘要
 */
import {
  buildEvidenceTrail,
  type EvidenceItem,
  type EvidenceTrail,
} from '../shared/evidence';
import type { AstrolabeData } from '../types/divination';

export function buildAstrolabeEvidenceTrail(result: AstrolabeData): EvidenceTrail {
  const items: EvidenceItem[] = [];

  // 1. 星盘基础（depth 0 主证）
  items.push({
    title: '西洋占星排盘基础',
    system: 'astrolabe',
    computationChain: [
      {
        name: '出生信息',
        reference: 'birth',
        inputs: {
          name: result.birth.name,
          dateTime: result.birth.dateTime,
          location: result.birth.location,
          latitude: result.birth.latitude ?? null,
          longitude: result.birth.longitude ?? null,
          timezone: result.birth.timezone,
        },
      },
    ],
    source: { type: 'modern', name: '西方占星学（Houses/Planets 体系）' },
    boundary: {
      applicableWhen: ['提供准确出生时间地点'],
      cautionWhen: ['出生时刻不精确时上升点敏感', '时区/夏令时需要确认'],
      precision: '出生时间精度（分钟级）',
    },
    counterEvidence: [
      { description: '宫位制（Placidus/Whole Sign 等）不同导致宫位分布不同', severity: 'alternative' },
    ],
    confidence: 'high',
    depth: 0,
  });

  // 2. 真太阳时（depth 1 辅证）
  if (result.birth.trueSolarEvidence) {
    items.push({
      title: '真太阳时校正',
      system: 'true-solar-time',
      computationChain: [
        {
          name: '经度时差',
          formula: '(出生经度 - 时区基准) × 4 分钟/°',
          reference: 'trueSolarEvidence',
        },
        { name: '均时差', formula: '真太阳时 - 平太阳时', reference: 'Meeus Equation of Time' },
      ],
      source: { type: 'algorithm', name: 'Meeus Astronomical Algorithms', location: 'Ch.27-28' },
      boundary: {
        precision: '±1 分钟',
        applicableWhen: ['提供出生经度'],
        cautionWhen: ['历史夏令时期间'],
      },
      counterEvidence: [
        { description: '跨时区出生需按实际时区重新校正', severity: 'alternative' },
      ],
      confidence: 'medium',
      depth: 1,
    });
  }

  // 3. 星体相位（depth 1 辅证）
  if (result.planets.length > 0 || result.aspects.length > 0) {
    items.push({
      title: '星体相位',
      system: 'astrolabe',
      computationChain: [
        {
          name: '星体位置',
          reference: 'planets',
          output: result.planets.map((p) => `${p.name}:${p.longitude?.toFixed(1)}°`).slice(0, 12),
        },
        {
          name: '相位',
          reference: 'aspects',
          output: result.aspects.map((a) => `${a.body1}-${a.body2}`).slice(0, 20),
        },
      ],
      source: { type: 'modern', name: '星历表（Ephemeris）与相位计算' },
      boundary: {
        applicableWhen: ['按黄道经度计算相位'],
        cautionWhen: ['容许度（orb）设置不同影响相位判定'],
      },
      counterEvidence: [
        { description: '相位容许度不同流派设置不同', severity: 'alternative' },
      ],
      confidence: 'high',
      depth: 1,
    });
  }

  // 4. 宫位四轴（depth 1 辅证）
  if (result.houses.length > 0 || result.angles.length > 0) {
    items.push({
      title: '宫位四轴',
      system: 'astrolabe',
      computationChain: [
        {
          name: '十二宫',
          reference: 'houses',
          output: result.houses.map((h) => `${h.name}:${h.longitude?.toFixed(1)}°`).slice(0, 12),
        },
        {
          name: '四轴',
          reference: 'angles',
          output: result.angles.map((a) => a.name).slice(0, 4),
        },
      ],
      source: { type: 'modern', name: '宫位计算（Placidus 等制式）' },
      boundary: {
        applicableWhen: ['按出生地经纬度排宫位'],
        cautionWhen: ['宫位制选择影响宫位边界'],
      },
      counterEvidence: [
        { description: '不同宫位制对上升与宫头位置有影响', severity: 'alternative' },
      ],
      confidence: 'high',
      depth: 1,
    });
  }

  // 5. 星盘摘要（depth 1 辅证）
  if (result.summary) {
    items.push({
      title: '星盘摘要',
      system: 'astrolabe',
      computationChain: [
        {
          name: '元素分布',
          reference: 'summary.elements',
          output: result.summary.elements,
        },
        {
          name: '模式分布',
          reference: 'summary.modalities',
          output: result.summary.modalities,
        },
        {
          name: '逆行星',
          reference: 'summary.retrograde',
          output: result.summary.retrograde,
        },
      ],
      source: { type: 'modern', name: '星盘综合解读' },
      boundary: {
        applicableWhen: ['综合星体分布'],
        cautionWhen: ['摘要为统计结构，不构成现实预测'],
      },
      counterEvidence: [
        { description: '星盘解读主观性强，不同流派结论不同', severity: 'alternative' },
      ],
      confidence: 'low',
      depth: 1,
    });
  }

  return buildEvidenceTrail(
    items,
    `西洋占星排盘证据链（${result.birth.name}，${result.birth.dateTime}）`,
  );
}
