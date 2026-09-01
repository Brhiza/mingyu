/**
 * TempoSoul·命律 — 大六壬起课排盘证据链构建器
 *
 * 为 generateLiuren 结果附加 v3.0 方案要求的四字段证据契约：
 *   计算链(computationChain) / 出处(source) / 边界(boundary) / 反证(counterEvidence)
 * + 置信度(confidence) + 深度(depth ≤4)
 *
 * 覆盖大六壬起课五大环节：起课基础 → 月将加时 → 四课三传 → 课体格局 → 空亡旺衰
 */
import {
  buildEvidenceTrail,
  type EvidenceItem,
  type EvidenceTrail,
} from '../shared/evidence';
import type { LiurenData } from '../types/divination';

export function buildLiurenEvidenceTrail(result: LiurenData): EvidenceTrail {
  const items: EvidenceItem[] = [];

  // 1. 起课基础（depth 0 主证）
  items.push({
    title: '六壬起课基础',
    system: 'liuren',
    computationChain: [
      {
        name: '占卜时间',
        reference: 'getDivinationTime',
        output: result.ganzhi,
      },
      {
        name: '昼夜占',
        reference: 'dayNight',
        output: result.dayNight ?? null,
      },
    ],
    source: { type: 'classical', name: '《大六壬指南》《壬归》' },
    boundary: {
      applicableWhen: ['提供占卜时刻'],
      cautionWhen: ['昼夜占决定贵人顺逆', '时辰交接时刻敏感'],
      precision: '时辰精度（2 小时）',
    },
    counterEvidence: [
      { description: '昼占夜占判定口径不同会改变贵人顺逆', severity: 'alternative' },
    ],
    confidence: 'high',
    depth: 0,
  });

  // 2. 月将加时（depth 1 辅证）
  items.push({
    title: '月将加占时',
    system: 'liuren',
    computationChain: [
      {
        name: '月将',
        reference: '太阳过宫',
        output: result.monthLeader,
      },
      {
        name: '占时',
        reference: '占时地支',
        output: result.divinationBranch,
      },
      {
        name: '贵人',
        reference: '日干贵人顺逆',
        output: {
          nobleman: result.noblemanBranch ?? null,
          ground: result.noblemanGroundBranch ?? null,
        },
      },
    ],
    source: { type: 'classical', name: '《六壬大全》月将贵人法' },
    boundary: {
      applicableWhen: ['月将加占时布天盘'],
      cautionWhen: ['月将随节气换将', '贵人顺逆依昼夜占'],
    },
    counterEvidence: [
      { description: '月将过宫时间（中气/节）口径有差异', severity: 'alternative' },
    ],
    confidence: 'medium',
    depth: 1,
  });

  // 3. 四课三传（depth 0 主证）
  items.push({
    title: '四课三传',
    system: 'liuren',
    computationChain: [
      {
        name: '四课',
        reference: '以日干寄宫与日支立四课',
        output: {
          lessonCount: result.fourLessons.length,
          summary: result.lessonSummary ?? null,
        },
      },
      {
        name: '三传',
        reference: '九宗门发用',
        output: {
          transmissionCount: result.threeTransmissions.length,
          rule: result.transmissionRule ?? null,
          pattern: result.transmissionPattern ?? null,
          detail: result.transmissionDetail ?? null,
        },
      },
    ],
    source: { type: 'classical', name: '九宗门发用（《六壬粹言》）' },
    boundary: {
      applicableWhen: ['四课立、三传发用'],
      cautionWhen: ['涉害/遥克/昴星等九宗门取用不同', '伏吟反吟回环递传特殊模式'],
    },
    counterEvidence: [
      { description: '九宗门取传顺序存在流派差异', severity: 'alternative' },
    ],
    confidence: 'high',
    depth: 0,
  });

  // 4. 课体格局（depth 1 辅证）
  if ((result.patternTags?.length ?? 0) > 0 || (result.classicalRules?.length ?? 0) > 0) {
    items.push({
      title: '课体格局',
      system: 'liuren',
      computationChain: [
        {
          name: '课体标签',
          reference: '三传课体',
          output: result.patternTags ?? [],
        },
        {
          name: '经典课体',
          reference: 'classicalRules',
          output: result.classicalRules?.map((r) => r.rule).slice(0, 10) ?? [],
        },
      ],
      source: { type: 'classical', name: '《大六壬大全》课体章' },
      boundary: {
        applicableWhen: ['依三传干支关系定课体'],
        cautionWhen: ['课体吉凶需结合类神与旺衰', '不构成必然应期'],
      },
      counterEvidence: [
        { description: '课体判读存在流派差异', severity: 'alternative' },
      ],
      confidence: 'medium',
      depth: 1,
    });
  }

  // 5. 空亡旺衰（depth 1 辅证）
  if ((result.xunKong?.length ?? 0) > 0) {
    items.push({
      title: '旬空旺衰',
      system: 'liuren',
      computationChain: [
        {
          name: '旬空',
          reference: '日柱旬空',
          output: result.xunKong,
        },
      ],
      source: { type: 'classical', name: '《六壬》旬空论' },
      boundary: {
        applicableWhen: ['以日柱定旬空'],
        cautionWhen: ['空亡逢冲可出空'],
      },
      counterEvidence: [
        { description: '空亡填实出空时机不同流派不同', severity: 'minor' },
      ],
      confidence: 'medium',
      depth: 1,
    });
  }

  return buildEvidenceTrail(
    items,
    `大六壬起课证据链（${result.ganzhi.day}日，${result.divinationBranch}时占）`,
  );
}
