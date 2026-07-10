import type { RelationStructureItem, RelationStructureProfile } from '../types/analysis';
import {
  BRANCH_ORDER,
  LIUHAI_MAP,
  LIUHE_MAP,
  LIUCHONG_MAP,
  LIUPO_MAP,
  SANHE_GROUPS,
  SANHUI_GROUPS,
  isSanxing,
} from '../ganzhi/relations';

function getTripleCombination(b1: string, b2: string, b3: string): string | null {
  const s = new Set([b1, b2, b3]);
  if (s.size !== 3) return null;
  for (const [group, members] of Object.entries(SANHE_GROUPS)) {
    if (members.every((branch) => s.has(branch))) return group.replace('局', '');
  }
  return null;
}
function getTripleGathering(b1: string, b2: string, b3: string): string | null {
  const s = new Set([b1, b2, b3]);
  if (s.size !== 3) return null;
  for (const [group, members] of Object.entries(SANHUI_GROUPS)) {
    if (members.every((branch) => s.has(branch))) return group.slice(-1);
  }
  return null;
}
function getHalfCombination(b1: string, b2: string): { element: string; type: string } | null {
  const p = [b1, b2]
    .sort((left, right) => BRANCH_ORDER.indexOf(left) - BRANCH_ORDER.indexOf(right))
    .join('');
  const map: Record<string, { element: string; type: string }> = {
    卯亥: { element: '木', type: '生地半合' },
    卯未: { element: '木', type: '墓地半合' },
    寅午: { element: '火', type: '生地半合' },
    午戌: { element: '火', type: '墓地半合' },
    巳酉: { element: '金', type: '生地半合' },
    丑酉: { element: '金', type: '墓地半合' },
    子申: { element: '水', type: '生地半合' },
    子辰: { element: '水', type: '墓地半合' },
  };
  return map[p] || null;
}

export function analyzeRelationStructure(
  pillars: Array<{ zhi: string }>,
): RelationStructureProfile {
  const items: RelationStructureItem[] = [];
  const branches = pillars.map((p) => p.zhi);
  const pillarNames = ['year', 'month', 'day', 'hour'];

  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      for (let k = j + 1; k < 4; k++) {
        const elem = getTripleCombination(branches[i], branches[j], branches[k]);
        if (elem) {
          items.push({
            category: '三合三会',
            name: '三合局',
            element: elem,
            pillars: [pillarNames[i], pillarNames[j], pillarNames[k]],
            values: [branches[i], branches[j], branches[k]],
            evidence: branches[i] + branches[j] + branches[k] + '合成' + elem + '局',
          });
        }
        const gather = getTripleGathering(branches[i], branches[j], branches[k]);
        if (gather && !elem) {
          items.push({
            category: '三合三会',
            name: '三会局',
            element: gather,
            pillars: [pillarNames[i], pillarNames[j], pillarNames[k]],
            values: [branches[i], branches[j], branches[k]],
            evidence: branches[i] + branches[j] + branches[k] + '会合' + gather + '方',
          });
        }
      }
    }
  }

  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      const half = getHalfCombination(branches[i], branches[j]);
      if (half)
        items.push({
          category: '半合拱局',
          name: half.type,
          element: half.element,
          pillars: [pillarNames[i], pillarNames[j]],
          values: [branches[i], branches[j]],
          evidence: branches[i] + '与' + branches[j] + half.type,
        });
    }
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

  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      if (isSanxing(branches[i], branches[j])) {
        items.push({
          category: '冲刑害破',
          name: '三刑',
          pillars: [pillarNames[i], pillarNames[j]],
          values: [branches[i], branches[j]],
          evidence: branches[i] + '与' + branches[j] + '相刑',
        });
      }
    }
  }

  return { items, summary: '地支关系分析：共发现' + items.length + '组关系' };
}
