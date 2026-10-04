import { getGanZhiRelationTables } from '../ganzhi/relations';

const GANZHI_RELATION_TABLES = getGanZhiRelationTables();

/** 按动爻、暗动爻及其变爻，复算月建或日辰参与的三合三支。 */
export function getLiuyaoSanheWithTrigger(
  activeBranches: readonly string[],
  triggerBranch: string,
  triggerLabel: '日辰' | '月建',
): { group: string; members: string[]; description: string } | null {
  const activeBranchSet = new Set(activeBranches);
  for (const [group, members] of Object.entries(GANZHI_RELATION_TABLES.SANHE_GROUPS)) {
    if (!members.includes(triggerBranch)) continue;
    const requiredYaoBranches = members.filter((member) => member !== triggerBranch);
    if (requiredYaoBranches.every((member) => activeBranchSet.has(member))) {
      return {
        group,
        members: [...members],
        description: `${triggerLabel}${triggerBranch}与动变爻同见三合${group}三支`,
      };
    }
  }
  return null;
}
