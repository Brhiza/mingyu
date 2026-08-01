import type { RelationStructureItem, RelationStructureProfile } from '../types/analysis';
import {
  LIUHAI_MAP,
  LIUHE_MAP,
  LIUCHONG_MAP,
  LIUPO_MAP,
  SANHE_GROUPS,
  SANHUI_GROUPS,
  findCompleteSanxingGroups,
} from '../ganzhi/relations';
import { assertEarthlyBranch } from './baziUtils';
export function analyzeRelationStructure(
  pillars: Array<{ zhi: string }>,
): RelationStructureProfile {
  if (!Array.isArray(pillars) || pillars.length !== 4) {
    throw new Error('八字地支关系分析必须提供年、月、日、时四柱。');
  }
  pillars.forEach((pillar, index) =>
    assertEarthlyBranch(pillar?.zhi, `${['年', '月', '日', '时'][index]}柱地支`),
  );

  const items: RelationStructureItem[] = [];
  const branches = pillars.map((p) => p.zhi);
  const pillarNames = ['year', 'month', 'day', 'hour'];

  for (const [group, members] of Object.entries(SANHE_GROUPS)) {
    if (!members.every((branch) => branches.includes(branch))) continue;
    const positions = branches
      .map((branch, index) => (members.includes(branch) ? pillarNames[index] : ''))
      .filter(Boolean);
    items.push({
      category: '三合三会',
      name: '三合三支齐见',
      element: group.replace('局', ''),
      pillars: positions,
      values: [...members],
      evidence: `${members.join('、')}为${group}所需三支齐见；不等于已经成局或合化`,
    });
  }

  for (const [group, members] of Object.entries(SANHUI_GROUPS)) {
    if (!members.every((branch) => branches.includes(branch))) continue;
    const positions = branches
      .map((branch, index) => (members.includes(branch) ? pillarNames[index] : ''))
      .filter(Boolean);
    items.push({
      category: '三合三会',
      name: '三会三支齐见',
      element: group.slice(-1),
      pillars: positions,
      values: [...members],
      evidence: `${members.join('、')}为${group}三会所需三支齐见；不等于已经成局或产生吉凶`,
    });
  }

  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      if (LIUHE_MAP[branches[i]] === branches[j])
        items.push({
          category: '合化候选',
          name: '六合',
          pillars: [pillarNames[i], pillarNames[j]],
          values: [branches[i], branches[j]],
          evidence: branches[i] + '与' + branches[j] + '六合',
        });
      if (LIUCHONG_MAP[branches[i]] === branches[j])
        items.push({
          category: '冲刑害破',
          name: '六冲',
          pillars: [pillarNames[i], pillarNames[j]],
          values: [branches[i], branches[j]],
          evidence: branches[i] + '与' + branches[j] + '相冲',
        });
      if (LIUHAI_MAP[branches[i]] === branches[j])
        items.push({
          category: '冲刑害破',
          name: '六害',
          pillars: [pillarNames[i], pillarNames[j]],
          values: [branches[i], branches[j]],
          evidence: branches[i] + '与' + branches[j] + '相害',
        });
      if (LIUPO_MAP[branches[i]] === branches[j])
        items.push({
          category: '冲刑害破',
          name: '相破',
          pillars: [pillarNames[i], pillarNames[j]],
          values: [branches[i], branches[j]],
          evidence: branches[i] + '与' + branches[j] + '相破',
        });
    }
  }

  const ziMaoPositions = branches
    .map((branch, index) => (branch === '子' || branch === '卯' ? pillarNames[index] : ''))
    .filter(Boolean);
  if (branches.includes('子') && branches.includes('卯')) {
    items.push({
      category: '冲刑害破',
      name: '子卯相刑',
      pillars: ziMaoPositions,
      values: ['子', '卯'],
      evidence: '子、卯两支齐见，构成子卯相刑固定支对',
    });
  }

  for (const branch of ['辰', '午', '酉', '亥']) {
    const positions = branches
      .map((value, index) => (value === branch ? pillarNames[index] : ''))
      .filter(Boolean);
    if (positions.length < 2) continue;
    items.push({
      category: '冲刑害破',
      name: '自刑',
      pillars: positions,
      values: [branch, branch],
      evidence: `${branch}支在${positions.length}柱重复出现，构成${branch}${branch}自刑固定结构`,
    });
  }

  for (const punishment of findCompleteSanxingGroups(branches)) {
    const positions = branches
      .map((branch, index) => (punishment.members.includes(branch) ? pillarNames[index] : ''))
      .filter(Boolean);
    items.push({
      category: '冲刑害破',
      name: punishment.name,
      pillars: positions,
      values: punishment.members,
      evidence: `${punishment.members.join('、')}三支齐见，为${punishment.name}完整成员结构；不把任意两支自动命名相刑`,
    });
  }

  return { items, summary: '地支关系分析：共发现' + items.length + '组关系' };
}
