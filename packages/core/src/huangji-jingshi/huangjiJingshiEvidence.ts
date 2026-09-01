/**
 * TempoSoul·命律 — 皇极经世证据链构建器
 *
 * 为 calculateHuangjiJingshi 结果附加 v3.0 四字段证据契约：
 *   计算链(computationChain) / 出处(source) / 边界(boundary) / 反证(counterEvidence)
 * + 置信度(confidence) + 深度(depth ≤4)
 *
 * 覆盖皇极经世四大环节：推算基础 → 元会运世坐标 → 周期换算 → 局限说明
 */
import {
  buildEvidenceTrail,
  type EvidenceItem,
  type EvidenceTrail,
} from '../shared/evidence';
import type { HuangjiJingshiCalculation } from './index';

export function buildHuangjiJingshiEvidenceTrail(
  result: HuangjiJingshiCalculation,
): EvidenceTrail {
  const items: EvidenceItem[] = [];

  // 1. 推算基础（depth 0 主证）
  items.push({
    title: '皇极经世推算基础',
    system: 'huangji-jingshi',
    computationChain: [
      {
        name: '推算模式',
        reference: 'input.mode',
        output: result.input.mode,
      },
      {
        name: '公历年',
        reference: 'input.year',
        output: result.input.year,
      },
      {
        name: '历元',
        reference: 'input.epochYear',
        output: result.input.epochYear,
      },
    ],
    source: { type: 'classical', name: '邵雍《皇极经世》（元会运世周期）' },
    boundary: {
      applicableWhen: ['提供公历年份'],
      cautionWhen: ['仅实现元会运世数学周期，不含值年卦/卦气/事件预测'],
    },
    counterEvidence: [
      { description: '皇极经世数理周期是传统历法模型', severity: 'alternative' },
    ],
    confidence: 'medium',
    depth: 0,
  });

  // 2. 元会运世坐标（depth 1 辅证）
  items.push({
    title: '元会运世坐标',
    system: 'huangji-jingshi',
    computationChain: [
      {
        name: '四层坐标',
        reference: 'position',
        output: {
          yuan: result.position.yuan.indexFromEpoch,
          hui: result.position.hui.indexInYuan,
          yun: result.position.yun.indexInYuan,
          shi: result.position.shi.indexInYuan,
        },
      },
    ],
    source: { type: 'classical', name: '元会运世（129600 年周期）' },
    boundary: {
      applicableWhen: ['按元会运世四级坐标'],
      cautionWhen: ['坐标为数学划分'],
    },
    counterEvidence: [
      { description: '元会运世换算存在版本差异', severity: 'alternative' },
    ],
    confidence: 'medium',
    depth: 1,
  });

  // 3. 周期换算（depth 1 辅证）
  items.push({
    title: '周期换算',
    system: 'huangji-jingshi',
    computationChain: [
      {
        name: '换算系数',
        reference: 'conversion',
        output: result.conversion,
      },
      {
        name: '进度',
        reference: 'progress',
        output: {
          yuan: result.progress.yuan,
          hui: result.progress.hui,
          yun: result.progress.yun,
          shi: result.progress.shi,
        },
      },
    ],
    source: { type: 'classical', name: '元会运世换算（1元=12会=360运=4320世=129600年）' },
    boundary: {
      applicableWhen: ['按固定系数换算'],
      cautionWhen: ['换算系数为传统定值'],
    },
    counterEvidence: [
      { description: '元会运世系数不同版本有差异', severity: 'alternative' },
    ],
    confidence: 'medium',
    depth: 1,
  });

  // 4. 局限说明（depth 1 辅证）
  if (result.limitations.length > 0) {
    items.push({
      title: '推演局限',
      system: 'huangji-jingshi',
      computationChain: [
        {
          name: '局限',
          reference: 'limitations',
          output: result.limitations,
        },
      ],
      source: { type: 'algorithm', name: '模型边界声明' },
      boundary: {
        applicableWhen: ['理解模型适用范围'],
        cautionWhen: ['不含事件预测'],
      },
      counterEvidence: [],
      confidence: 'high',
      depth: 1,
    });
  }

  return buildEvidenceTrail(
    items,
    `皇极经世证据链（${result.input.year}年·${result.input.mode}）`,
  );
}
