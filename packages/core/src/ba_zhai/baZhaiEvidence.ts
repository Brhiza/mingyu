/**
 * TempoSoul·命律 — 八宅风水证据链构建器
 *
 * 为 analyzeBaZhai 结果附加 v3.0 四字段证据契约：
 *   计算链(computationChain) / 出处(source) / 边界(boundary) / 反证(counterEvidence)
 * + 置信度(confidence) + 深度(depth ≤4)
 *
 * 覆盖八宅四大环节：命卦推算 → 命宫游年 → 宅卦配合 → 吉凶方位
 */
import {
  buildEvidenceTrail,
  type EvidenceItem,
  type EvidenceTrail,
} from '../shared/evidence';
import type { BaZhaiResult } from './index';

export function buildBaZhaiEvidenceTrail(result: Omit<BaZhaiResult, 'prompt'>): EvidenceTrail {
  const items: EvidenceItem[] = [];

  // 1. 命卦推算（depth 0 主证）
  items.push({
    title: '八宅命卦推算',
    system: 'ba-zhai',
    computationChain: [
      {
        name: '命卦来源',
        reference: 'calculationInput.mingGuaSource',
        output: result.calculationInput.mingGuaSource,
      },
      {
        name: '命卦',
        reference: 'mingGua',
        output: result.mingGua,
      },
      {
        name: '命宫分组',
        reference: 'mingGroup',
        output: result.mingGroup,
      },
    ],
    source: { type: 'classical', name: '《八宅明镜》命卦推算（男上元/女中元起例）' },
    boundary: {
      applicableWhen: ['提供出生年与性别'],
      cautionWhen: ['立春为年界，跨年出生需注意出生年分界'],
    },
    counterEvidence: [
      { description: '不同八宅流派对命卦起例有差异（上中下元分界）', severity: 'alternative' },
    ],
    confidence: 'medium',
    depth: 0,
  });

  // 2. 命宫游年（depth 1 辅证）
  if (result.mingPalace.length > 0) {
    items.push({
      title: '命宫大游年',
      system: 'ba-zhai',
      computationChain: [
        {
          name: '大游年宫位',
          reference: 'mingPalace',
          output: result.mingPalace.map((p) => `${p.direction}:${p.label}（${p.luck}）`).slice(0, 8),
        },
      ],
      source: { type: 'classical', name: '大游年九星（生气/天医/延年/伏位/绝命/五鬼/六煞/祸害）' },
      boundary: {
        applicableWhen: ['按命卦起大游年盘'],
        cautionWhen: ['大游年排布依坐向旋转'],
      },
      counterEvidence: [
        { description: '游年星名与吉凶排序不同流派略有差异', severity: 'alternative' },
      ],
      confidence: 'medium',
      depth: 1,
    });
  }

  // 3. 宅卦配合（depth 1 辅证）
  if (result.houseGua) {
    items.push({
      title: '宅卦配合',
      system: 'ba-zhai',
      computationChain: [
        {
          name: '宅卦',
          reference: 'houseGua',
          output: result.houseGua,
        },
        {
          name: '宅宫分组',
          reference: 'houseGroup',
          output: result.houseGroup ?? null,
        },
        {
          name: '命宅配合',
          reference: 'match',
          output: result.match,
        },
      ],
      source: { type: 'classical', name: '《八宅明镜》命宅配合' },
      boundary: {
        applicableWhen: ['提供住宅坐向'],
        cautionWhen: ['坐向以罗盘度数为准'],
      },
      counterEvidence: [
        { description: '命宅配合判断存在流派差异', severity: 'alternative' },
      ],
      confidence: 'medium',
      depth: 1,
    });
  }

  // 4. 吉凶方位（depth 1 辅证）
  items.push({
    title: '吉凶方位',
    system: 'ba-zhai',
    computationChain: [
      {
        name: '吉利方位',
        reference: 'luckyDirections',
        output: result.luckyDirections.map((p) => p.direction).slice(0, 4),
      },
      {
        name: '不利方位',
        reference: 'unluckyDirections',
        output: result.unluckyDirections.map((p) => p.direction).slice(0, 4),
      },
    ],
    source: { type: 'classical', name: '八宅八方吉凶' },
    boundary: {
      applicableWhen: ['按命卦判断方位吉凶'],
      cautionWhen: ['方位吉凶依命卦而异', '仅为风水参考'],
    },
    counterEvidence: [
      { description: '风水方位吉凶缺乏实证验证', severity: 'alternative' },
    ],
    confidence: 'low',
    depth: 1,
  });

  return buildEvidenceTrail(
    items,
    `八宅风水证据链（命卦${result.mingGua}·${result.mingGroup}）`,
  );
}
