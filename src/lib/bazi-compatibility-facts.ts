import { analyzeBaziCompatibility, type BaziChartResult } from 'mingyu-core/bazi';

/** 合盘提示词与八字紫微合参共用的双方关系事实。 */
export function formatBaziCompatibilityFacts(
  result1: BaziChartResult,
  result2: BaziChartResult,
  options: { person1Name?: string; person2Name?: string } = {},
): string {
  const relation = analyzeBaziCompatibility(result1, result2, options);
  const relationLines = relation.crossPillarRelations.map((item) => item.promptText);
  const combinationLines = relation.crossBranchCombinations.map((item) => item.promptText);
  const tenGodLines = relation.tenGodMappings.map((item) => item.promptText);
  const coverageLines = relation.usefulGodCoverage
    .filter((item) => item.status === '已计算')
    .map((item) => item.promptText);

  return [
    `日主关系：${relation.dayMasterRelation.promptText}。`,
    `四柱关系：${relationLines.length ? relationLines.join('；') : '双方四柱未见列出的合冲刑害破关系'}。`,
    combinationLines.length ? `跨盘组合：${combinationLines.join('；')}。` : '',
    `双向十神：${tenGodLines.join('；')}。`,
    coverageLines.length ? `喜忌五行对应：${coverageLines.join('；')}。` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
