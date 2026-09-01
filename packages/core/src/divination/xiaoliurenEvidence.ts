/**
 * TempoSoul·命律 — 小六壬占卜排盘证据链构建器
 *
 * 为 generateXiaoliuren 结果附加 v3.0 方案要求的四字段证据契约：
 *   计算链(computationChain) / 出处(source) / 边界(boundary) / 反证(counterEvidence)
 * + 置信度(confidence) + 深度(depth ≤4)
 *
 * 覆盖小六壬占卜四大环节：占卜基础 → 推算过程 → 三宫定位 → 主卦定局
 */
import {
  buildEvidenceTrail,
  type EvidenceItem,
  type EvidenceTrail,
} from '../shared/evidence';
import type { XiaoliurenData } from '../types/divination';

export function buildXiaoliurenEvidenceTrail(result: XiaoliurenData): EvidenceTrail {
  const items: EvidenceItem[] = [];

  // 1. 占卜基础（depth 0 主证）
  items.push({
    title: '小六壬占卜基础',
    system: 'xiaoliuren',
    computationChain: [
      {
        name: '农历时间',
        reference: 'lunar conversion',
        inputs: {
          lunarMonth: result.lunarMonth,
          lunarDay: result.lunarDay,
          isLeapMonth: result.isLeapMonth,
          hourIndex: result.hourIndex,
        },
      },
      {
        name: '干支',
        output: result.ganzhi,
      },
    ],
    source: { type: 'classical', name: '《小六壬》掌诀体系' },
    boundary: {
      applicableWhen: ['提供农历月日时'],
      cautionWhen: ['闰月沿用同名月序', '以民用日零点换日'],
      precision: '时辰精度（2 小时）',
    },
    counterEvidence: [
      { description: '闰月处理与换日边界口径不同可改变掌诀落点', severity: 'alternative' },
    ],
    confidence: 'high',
    depth: 0,
  });

  // 2. 推算过程（depth 1 辅证）
  if (result.calculation) {
    items.push({
      title: '推算过程',
      system: 'xiaoliuren',
      computationChain: [
        {
          name: '掌诀起数',
          formula: '大安起正月，月上起日，日上起时',
          reference: 'monthSeed/daySeed/hourSeed',
          output: {
            monthSeed: result.calculation.monthSeed,
            daySeed: result.calculation.daySeed,
            hourSeed: result.calculation.hourSeed,
            monthPalace: result.calculation.monthPalaceIndex,
            dayPalace: result.calculation.dayPalaceIndex,
            hourPalace: result.calculation.hourPalaceIndex,
          },
        },
      ],
      source: { type: 'classical', name: '小六壬掌诀推算法' },
      boundary: {
        applicableWhen: ['六掌诀顺数'],
        cautionWhen: ['数满一周循环顺数'],
      },
      counterEvidence: [
        { description: '六掌诀顺序存在不同排列版本', severity: 'alternative' },
      ],
      confidence: 'high',
      depth: 1,
    });
  }

  // 3. 三宫定位（depth 1 辅证）
  if (result.sequence) {
    items.push({
      title: '三宫定位',
      system: 'xiaoliuren',
      computationChain: [
        {
          name: '月宫',
          reference: 'sequence.month',
          output: result.sequence.month.name,
        },
        {
          name: '日宫',
          reference: 'sequence.day',
          output: result.sequence.day.name,
        },
        {
          name: '时宫',
          reference: 'sequence.hour',
          output: result.sequence.hour.name,
        },
      ],
      source: { type: 'classical', name: '小六壬三宫断法' },
      boundary: {
        applicableWhen: ['月日时三宫顺推'],
        cautionWhen: ['三宫组合综合断事'],
      },
      counterEvidence: [
        { description: '三宫主次权重不同流派不同', severity: 'alternative' },
      ],
      confidence: 'high',
      depth: 1,
    });
  }

  // 4. 主卦定局（depth 0 主证）
  if (result.primary) {
    items.push({
      title: '主卦定局',
      system: 'xiaoliuren',
      computationChain: [
        {
          name: '最终掌诀',
          reference: 'hourPalace',
          output: {
            name: result.primary.name,
            label: result.methodLabel,
          },
        },
      ],
      source: { type: 'classical', name: '小六壬六掌诀吉凶' },
      boundary: {
        applicableWhen: ['以最终落宫定吉凶'],
        cautionWhen: ['掌诀解读需结合所问事项'],
      },
      counterEvidence: [
        { description: '掌诀吉凶解释存在流派差异', severity: 'alternative' },
      ],
      confidence: 'medium',
      depth: 0,
    });
  }

  return buildEvidenceTrail(
    items,
    `小六壬占卜证据链（${result.lunarMonth}月${result.lunarDay}日${result.hourLabel}，${result.primary?.name ?? '未知'}）`,
  );
}
