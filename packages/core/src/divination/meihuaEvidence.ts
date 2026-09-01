/**
 * TempoSoul·命律 — 梅花易数起卦排盘证据链构建器
 *
 * 为 generateMeihua 结果附加 v3.0 方案要求的四字段证据契约：
 *   计算链(computationChain) / 出处(source) / 边界(boundary) / 反证(counterEvidence)
 * + 置信度(confidence) + 深度(depth ≤4)
 *
 * 覆盖梅花起卦五大环节：起卦基础 → 起卦数理 → 卦象构建 → 体用定位 → 体用生克
 */
import {
  buildEvidenceTrail,
  type EvidenceItem,
  type EvidenceTrail,
} from '../shared/evidence';
import type { MeihuaData } from '../types/divination';

export function buildMeihuaEvidenceTrail(result: MeihuaData): EvidenceTrail {
  const items: EvidenceItem[] = [];

  // 1. 起卦基础（depth 0 主证）
  items.push({
    title: '梅花起卦基础',
    system: 'meihua',
    computationChain: [
      {
        name: '占卜时间',
        reference: 'getDivinationTime',
        output: result.ganzhi,
      },
      {
        name: '起卦方式',
        formula:
          result.calculation?.method === 'number'
            ? '数字起卦'
            : result.calculation?.method === 'random'
              ? '随机起卦'
              : result.calculation?.method === 'timeTrigram'
                ? '年月日时起卦'
                : '时间起卦',
        inputs: { method: result.calculation?.method ?? 'time' },
      },
    ],
    source: { type: 'classical', name: '《梅花易数》（传邵雍所传）' },
    boundary: {
      applicableWhen: ['提供占卜时刻或数字'],
      cautionWhen: ['起卦方式不同（时间/数字/随机）卦象不同', '以农历数起卦'],
    },
    counterEvidence: [
      { description: '梅花起卦法门多样，取数口径不同结果不同', severity: 'alternative' },
    ],
    confidence: 'high',
    depth: 0,
  });

  // 2. 起卦数理（depth 1 辅证）
  if (result.calculation) {
    items.push({
      title: '起卦数理',
      system: 'meihua',
      computationChain: [
        {
          name: '上卦',
          formula: '(年支序 + 月 + 日) % 8',
          reference: 'resolveTimeMethod / resolveNumberMethod',
          inputs: result.calculation.numbers
            ? { numbers: result.calculation.numbers }
            : { month: result.calculation.month, day: result.calculation.day, yearZhi: result.calculation.yearZhi },
        },
        {
          name: '下卦',
          formula: '(年支序 + 月 + 日 + 时支序) % 8',
          reference: 'resolveTimeMethod / resolveNumberMethod',
        },
        {
          name: '动爻',
          formula: '(年支序 + 月 + 日 + 时支序) % 6',
          reference: 'resolveTimeMethod / resolveNumberMethod',
          output: result.movingYao.position,
        },
      ],
      source: { type: 'classical', name: '《梅花易数》以数起卦章' },
      boundary: {
        applicableWhen: ['邵雍先天卦数取法'],
        cautionWhen: ['余数为 0 时按 8/6 处理', '随机起卦依赖随机种子'],
      },
      counterEvidence: [
        { description: '取数方式（数除尽时归 8 或 6）存在版本差异', severity: 'alternative' },
      ],
      confidence: 'high',
      depth: 1,
    });
  }

  // 3. 卦象构建（depth 0 主证）
  items.push({
    title: '卦象构建',
    system: 'meihua',
    computationChain: [
      {
        name: '本卦',
        reference: 'findHexagramByTrigrams',
        output: result.mainHexagram.name,
      },
      {
        name: '互卦',
        reference: '互卦取法',
        output: result.interHexagram?.name ?? null,
      },
      {
        name: '变卦',
        reference: '动爻变卦',
        output: result.changedHexagram?.name ?? null,
      },
    ],
    source: { type: 'classical', name: '《周易》六十四卦体系' },
    boundary: {
      applicableWhen: ['上卦下卦合成六十四卦'],
      cautionWhen: ['互卦取二三四爻与三四五爻'],
    },
    counterEvidence: [
      { description: '变卦是否生成取决于动爻', severity: 'alternative' },
    ],
    confidence: 'high',
    depth: 0,
  });

  // 4. 体用定位（depth 0 主证）
  items.push({
    title: '体用定位',
    system: 'meihua',
    computationChain: [
      {
        name: '体卦',
        formula: '动爻所在经卦为用，另一经卦为体',
        reference: 'resolveTiYongByMovingYao',
        output: {
          ti: result.tiGua.name,
          yong: result.yongGua.name,
          movingYao: `${result.movingYao.yaoName}（第${result.movingYao.position}爻）`,
        },
      },
    ],
    source: { type: 'classical', name: '《梅花易数》体用论' },
    boundary: {
      applicableWhen: ['以动爻定体用'],
      cautionWhen: ['体用互变随动爻变化'],
    },
    counterEvidence: [
      { description: '体用取法（动爻归属）个别流派有差异', severity: 'alternative' },
    ],
    confidence: 'high',
    depth: 0,
  });

  // 5. 体用生克（depth 1 辅证）
  if (result.analysis) {
    items.push({
      title: '体用生克',
      system: 'meihua',
      computationChain: [
        {
          name: '体用关系',
          reference: '体用五行生克',
          output: result.analysis.tiYongRelation,
        },
        {
          name: '季节旺衰',
          reference: '月建旺相休囚死',
          output: {
            season: result.analysis.season,
            monthBranch: result.analysis.monthBranch ?? null,
            tiState: result.analysis.tiSeasonState,
            yongState: result.analysis.yongSeasonState,
          },
        },
        {
          name: '互卦变卦关系',
          output: {
            interTi: result.analysis.inter1Relation,
            interYong: result.analysis.inter2Relation,
            changed: result.analysis.changedTiYongRelation,
          },
        },
      ],
      source: { type: 'classical', name: '《梅花易数》体用生克篇' },
      boundary: {
        applicableWhen: ['以体卦为我判断生克吉凶'],
        cautionWhen: ['旺衰依月建而定', '互卦变卦分主事之中与终'],
      },
      counterEvidence: [
        { description: '生克吉凶判断受季节旺衰影响，同一生克关系旺衰不同结论不同', severity: 'alternative' },
      ],
      confidence: 'medium',
      depth: 1,
    });
  }

  return buildEvidenceTrail(
    items,
    `梅花易数起卦证据链（${result.originalName}，${result.ganzhi.day}日）`,
  );
}
