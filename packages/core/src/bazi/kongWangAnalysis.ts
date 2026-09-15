import { calculateKongWangBranches } from './kongWang';
import type { KongWangProfile } from '../types/analysis';
import { assertGanZhiPair, assertHeavenlyStem } from './baziUtils';

const PILLAR_NAMES = ['year', 'month', 'day', 'hour'] as const;

function assertKongWangPillars(pillars: Array<{ gan: string; zhi: string }>): void {
  if (!Array.isArray(pillars) || pillars.length !== PILLAR_NAMES.length) {
    throw new Error(`四柱数量无效：${Array.isArray(pillars) ? pillars.length : String(pillars)}`);
  }

  pillars.forEach((pillar, index) => {
    assertGanZhiPair(pillar?.gan, pillar?.zhi, `第${index + 1}柱`);
  });
}

/**
 * 生成以日柱旬空为基准的四柱投影。
 *
 * `emptyBranches` 与 `isEmpty` 都回答“该柱是否落入日柱旬空”；逐柱所属旬空仍由
 * `calculateKongWang` 提供。保留第二个参数是为了兼容既有 API，它只做日干输入校验，
 * 不改变日柱旬空的来源。
 */
export function analyzeKongWangProfile(
  pillars: Array<{ gan: string; zhi: string }>,
  dayMasterStem: string,
): KongWangProfile {
  assertKongWangPillars(pillars);
  assertHeavenlyStem(dayMasterStem, '日主');

  const dayGan = pillars[2].gan;
  const dayZhi = pillars[2].zhi;
  const emptyBranches = calculateKongWangBranches(dayGan, dayZhi);

  const cnItems = PILLAR_NAMES.map((pn, idx) => {
    const isEmpty = emptyBranches.includes(pillars[idx].zhi);
    return { pillar: pn, emptyBranches: [...emptyBranches], isEmpty, fillableItems: [] };
  });

  return {
    items: cnItems,
    summary: `日柱旬空投影（依据${dayGan}${dayZhi}）：${emptyBranches.join('、')}`,
  };
}
