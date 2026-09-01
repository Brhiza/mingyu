/**
 * TempoSoul·命律 — 七政四余证据链构建器
 *
 * 为 generateQizheng 结果附加 v3.0 四字段证据契约：
 *   计算链(computationChain) / 出处(source) / 边界(boundary) / 反证(counterEvidence)
 * + 置信度(confidence) + 深度(depth ≤4)
 *
 * 覆盖七政四余四大环节：排盘基础 → 星曜位置 → 相位格局 → 宫位神煞
 */
import {
  buildEvidenceTrail,
  type EvidenceItem,
  type EvidenceTrail,
} from '../shared/evidence';
import type { QizhengResult } from './index';

export function buildQizhengEvidenceTrail(result: QizhengResult): EvidenceTrail {
  const items: EvidenceItem[] = [];

  // 1. 排盘基础（depth 0 主证）
  items.push({
    title: '七政四余排盘基础',
    system: 'qi-zheng',
    computationChain: [
      {
        name: '紫气模型',
        reference: 'ziqiModel',
        output: result.ziqiModel?.name ?? null,
      },
      {
        name: '推演上下文',
        reference: 'calculationContext',
        output: result.calculationContext ?? null,
      },
    ],
    source: { type: 'classical', name: '七政四余（日月五星+四余星曜）' },
    boundary: {
      applicableWhen: ['提供出生时间地点'],
      cautionWhen: ['紫气算法不同流派差异较大', '需要时区与真太阳时'],
    },
    counterEvidence: [
      { description: '七政四余对紫气/月孛等算法存在流派差异', severity: 'alternative' },
    ],
    confidence: 'medium',
    depth: 0,
  });

  // 2. 星曜位置（depth 1 辅证）
  if (result.stars.length > 0) {
    items.push({
      title: '星曜位置',
      system: 'qi-zheng',
      computationChain: [
        {
          name: '星曜',
          reference: 'stars',
          output: result.stars
            .map((s) => `${s.name ?? ''}:${s.longitude != null ? s.longitude.toFixed(2) : ''}`)
            .slice(0, 12),
        },
      ],
      source: { type: 'classical', name: '二十八宿与黄道宫度' },
      boundary: {
        applicableWhen: ['按星历计算黄道位置'],
        cautionWhen: ['宫度换算需明确岁差'],
      },
      counterEvidence: [
        { description: '星历来源不同导致微小差异', severity: 'minor' },
      ],
      confidence: 'high',
      depth: 1,
    });
  }

  // 3. 相位格局（depth 1 辅证）
  if (result.aspects.length > 0) {
    items.push({
      title: '相位格局',
      system: 'qi-zheng',
      computationChain: [
        {
          name: '相位',
          reference: 'aspects',
          output: result.aspects
            .map((a) => `${a.star1}-${a.star2}:${a.type}`)
            .slice(0, 12),
        },
      ],
      source: { type: 'classical', name: '星曜相位（合/拱/刑/冲等）' },
      boundary: {
        applicableWhen: ['按黄道经度计算相位'],
        cautionWhen: ['容许度设置不同'],
      },
      counterEvidence: [
        { description: '相位容许度不同流派设置不同', severity: 'alternative' },
      ],
      confidence: 'high',
      depth: 1,
    });
  }

  // 4. 宫位神煞（depth 1 辅证）
  items.push({
    title: '宫位神煞',
    system: 'qi-zheng',
    computationChain: [
      {
        name: '命宫身宫',
        reference: 'mingGong/shenGong',
        output: { mingGong: result.mingGong ?? null, shenGong: result.shenGong ?? null },
      },
      {
        name: '十二宫',
        reference: 'twelvePalaces',
        output: result.twelvePalaces
          ? result.twelvePalaces.map((p) => `${p.palace}`).slice(0, 12)
          : null,
      },
      {
        name: '神煞',
        reference: 'shensha',
        output: result.shensha
          ? result.shensha.map((s) => `${s.name ?? ''}:${s.value ?? ''}`).slice(0, 8)
          : null,
      },
    ],
    source: { type: 'classical', name: '十二宫与神煞（天乙/驿马/华盖等）' },
    boundary: {
      applicableWhen: ['按星曜分布定宫'],
      cautionWhen: ['神煞体系存在版本差异'],
    },
    counterEvidence: [
      { description: '神煞取用不同流派不同', severity: 'alternative' },
    ],
    confidence: 'low',
    depth: 1,
  });

  return buildEvidenceTrail(
    items,
    `七政四余证据链（${result.calculationContext?.localDateTime ?? ''}）`,
  );
}
