/**
 * TempoSoul·命律 — 奇门遁甲排盘证据链构建器
 *
 * 为 generateQimen 结果附加 v3.0 方案要求的四字段证据契约：
 *   计算链(computationChain) / 出处(source) / 边界(boundary) / 反证(counterEvidence)
 * + 置信度(confidence) + 深度(depth ≤4)
 *
 * 覆盖奇门排盘五大环节：排盘基础 → 定局 → 值符值使 → 九宫布局 → 格局标注
 */
import {
  buildEvidenceTrail,
  type EvidenceItem,
  type EvidenceTrail,
} from '../shared/evidence';
import type { QimenData } from '../types/divination';

export function buildQimenEvidenceTrail(result: QimenData): EvidenceTrail {
  const items: EvidenceItem[] = [];

  // 1. 排盘基础（depth 0 主证）
  items.push({
    title: '奇门排盘基础',
    system: 'qimen',
    computationChain: [
      {
        name: '占卜时间',
        reference: 'getDivinationTime',
        output: result.ganzhi,
      },
      {
        name: '节气归属',
        reference: 'timeInfo.jieQi',
        output: result.timeInfo,
      },
    ],
    source: { type: 'classical', name: '《奇门遁甲秘笈大全》' },
    boundary: {
      applicableWhen: ['提供占卜时刻'],
      cautionWhen: ['节气交接时刻定局敏感', '时家/日家/月家/年家取用不同'],
      precision: '时辰精度（2 小时）',
    },
    counterEvidence: [
      { description: '不同流派定局（拆补/置闰）会改变局数', severity: 'alternative' },
    ],
    confidence: 'high',
    depth: 0,
  });

  // 2. 定局（depth 0 主证）
  items.push({
    title: '奇门定局',
    system: 'qimen',
    computationChain: [
      {
        name: '阴阳遁',
        reference: 'isYangDun',
        output: result.isYangDun ? '阳遁' : '阴遁',
      },
      {
        name: '局数',
        reference: '拆补法/置闰法',
        output: result.juShu,
      },
      {
        name: '排盘级别',
        reference: 'scope',
        output: result.scope ?? 'hour',
      },
      {
        name: '定局方法',
        reference: 'juMethod',
        output: result.juMethod ?? 'chaibu',
      },
    ],
    source: { type: 'classical', name: '奇门定局法（拆补/置闰）' },
    boundary: {
      applicableWhen: ['按节气三元定局'],
      cautionWhen: ['拆补法与置闰法结果不同', '节令交接附近需校准'],
    },
    counterEvidence: [
      { description: '拆补/置闰/茅山派等定局口径差异可改变局数', severity: 'overturn' },
      { description: '超神接气处理方式不同', severity: 'alternative' },
    ],
    confidence: 'medium',
    depth: 0,
  });

  // 3. 值符值使（depth 1 辅证）
  items.push({
    title: '值符值使',
    system: 'qimen',
    computationChain: [
      {
        name: '值符星',
        reference: '寻值符',
        output: result.zhiFu,
      },
      {
        name: '值使门',
        reference: '寻值使',
        output: result.zhiShi,
      },
    ],
    source: { type: 'classical', name: '奇门八门九星体系' },
    boundary: {
      applicableWhen: ['以旬首定值符值使'],
      cautionWhen: ['转盘法与飞盘法值使运转不同'],
    },
    counterEvidence: [
      { description: '飞盘/转盘对值符值使的运转口径不同', severity: 'alternative' },
    ],
    confidence: 'high',
    depth: 1,
  });

  // 4. 九宫布局（depth 1 辅证）
  if (result.jiuGongGe.length > 0) {
    items.push({
      title: '九宫布局',
      system: 'qimen',
      computationChain: [
        {
          name: '九宫排布',
          reference: '转盘/飞盘布局',
          output: {
            palaceCount: result.jiuGongGe.length,
            palaces: result.jiuGongGe.map((g) => `${g.name}（${g.direction}）`),
          },
        },
        {
          name: '三奇六仪',
          reference: '宫位天地盘',
          output: result.stemRelations?.slice(0, 12) ?? null,
        },
      ],
      source: { type: 'classical', name: '奇门九宫图（洛书九宫）' },
      boundary: {
        applicableWhen: ['洛书九宫排布'],
        cautionWhen: ['转盘法与飞盘法宫位排列不同'],
      },
      counterEvidence: [
        { description: '转盘/飞盘对九星八门运转轨迹口径不同', severity: 'alternative' },
      ],
      confidence: 'high',
      depth: 1,
    });
  }

  // 5. 格局标注（depth 1 辅证）
  if ((result.patternTags?.length ?? 0) > 0 || (result.classicPatterns?.length ?? 0) > 0) {
    items.push({
      title: '奇门格局',
      system: 'qimen',
      computationChain: [
        {
          name: '基础格局',
          reference: 'getQimenPatternTags',
          output: result.patternTags ?? [],
        },
        {
          name: '经典格局',
          reference: '九遁/三奇得使/天乙',
          output: result.classicPatterns?.map((p) => p.name) ?? [],
        },
        {
          name: '复合格局',
          reference: 'detectQimenPatternCombos',
          output: result.patternCombos?.map((c) => c.name).slice(0, 10) ?? [],
        },
      ],
      source: { type: 'classical', name: '奇门格局体系（《奇门遁甲统宗》）' },
      boundary: {
        applicableWhen: ['宫位天地盘组合定格局'],
        cautionWhen: ['吉凶格局需结合用神宫与旺衰', '格局仅供参考不构成必然断语'],
      },
      counterEvidence: [
        { description: '格局吉凶判断流派差异较大', severity: 'alternative' },
      ],
      confidence: 'medium',
      depth: 1,
    });
  }

  return buildEvidenceTrail(
    items,
    `奇门遁甲排盘证据链（${result.isYangDun ? '阳' : '阴'}遁${result.juShu}局，${result.ganzhi.hour}时）`,
  );
}
