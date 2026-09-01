/**
 * TempoSoul·命律 — 住宅风水综合证据链构建器
 *
 * 为 generateResidentialFengshui 结果附加 v3.0 四字段证据契约：
 *   计算链(computationChain) / 出处(source) / 边界(boundary) / 反证(counterEvidence)
 * + 置信度(confidence) + 深度(depth ≤4)
 *
 * 覆盖住宅风水四大环节：综合评估基础 → 八宅分析 → 玄空分析 → 宅命配合
 */
import {
  buildEvidenceTrail,
  type EvidenceItem,
  type EvidenceTrail,
} from '../shared/evidence';
import type { ResidentialFengshuiResult } from './index';

export function buildResidentialFengshuiEvidenceTrail(
  result: ResidentialFengshuiResult,
): EvidenceTrail {
  const items: EvidenceItem[] = [];

  // 1. 综合评估基础（depth 0 主证）
  items.push({
    title: '住宅风水综合评估基础',
    system: 'residential-fengshui',
    computationChain: [
      {
        name: '输入条件',
        reference: 'inputSummary',
        output: {
          hasPerson: result.inputSummary.hasPerson,
          hasHouseOrientation: result.inputSummary.hasHouseOrientation,
          houseYear: result.inputSummary.houseYear,
          orientationText: result.inputSummary.orientationText,
          xuankongStatus: result.inputSummary.xuankongStatus,
        },
      },
    ],
    source: { type: 'classical', name: '八宅 + 玄空飞星综合评估' },
    boundary: {
      applicableWhen: ['提供居住人出生年/性别或住宅山向'],
      cautionWhen: ['至少需提供山向或居住人信息'],
    },
    counterEvidence: [
      { description: '风水评估缺乏实证验证', severity: 'alternative' },
    ],
    confidence: 'low',
    depth: 0,
  });

  // 2. 八宅分析（depth 1 辅证）
  if (result.bazhai) {
    items.push({
      title: '八宅分析',
      system: 'residential-fengshui',
      computationChain: [
        {
          name: '命卦',
          reference: 'bazhai.mingGua',
          output: result.bazhai.mingGua,
        },
        {
          name: '宅卦',
          reference: 'bazhai.houseGua',
          output: result.bazhai.houseGua ?? null,
        },
        {
          name: '命宅配合',
          reference: 'bazhai.match',
          output: result.bazhai.match,
        },
      ],
      source: { type: 'classical', name: '八宅法（命卦与宅卦）' },
      boundary: {
        applicableWhen: ['八宅可排时'],
        cautionWhen: ['命卦推算依出生年'],
      },
      counterEvidence: [
        { description: '八宅流派对命卦起例有差异', severity: 'alternative' },
      ],
      confidence: 'medium',
      depth: 1,
    });
  }

  // 3. 玄空分析（depth 1 辅证）
  if (result.xuankong) {
    items.push({
      title: '玄空分析',
      system: 'residential-fengshui',
      computationChain: [
        {
          name: '当运',
          reference: 'xuankong.period.yun',
          output: `${result.xuankong.period.yun}运`,
        },
        {
          name: '坐向',
          reference: 'xuankong.sitMountain/facingMountain',
          output: `${result.xuankong.sitMountain}坐${result.xuankong.facingMountain}向`,
        },
      ],
      source: { type: 'classical', name: '玄空飞星宅运盘' },
      boundary: {
        applicableWhen: ['有山向且知建造年'],
        cautionWhen: ['玄空排盘需建造年'],
      },
      counterEvidence: [
        { description: '玄空派别盘法有差异', severity: 'alternative' },
      ],
      confidence: 'medium',
      depth: 1,
    });
  }

  // 4. 宅命配合（depth 1 辅证）
  if (result.agreements.length > 0 || result.advice.length > 0) {
    items.push({
      title: '宅命配合建议',
      system: 'residential-fengshui',
      computationChain: [
        {
          name: '八宅玄空一致点',
          reference: 'agreements',
          output: result.agreements.map((a) => `${a.title}:${a.detail}`).slice(0, 10),
        },
        {
          name: '风水建议',
          reference: 'advice',
          output: result.advice.slice(0, 10),
        },
      ],
      source: { type: 'classical', name: '八宅与玄空合参建议' },
      boundary: {
        applicableWhen: ['综合两法结论'],
        cautionWhen: ['建议为风水参考，非科学结论'],
      },
      counterEvidence: [
        { description: '宅命配合建议主观性强', severity: 'alternative' },
      ],
      confidence: 'low',
      depth: 1,
    });
  }

  return buildEvidenceTrail(
    items,
    `住宅风水综合证据链（${result.inputSummary.orientationText || '未提供山向'}）`,
  );
}
