
import type { RelationStructureItem, RelationStructureProfile } from '../types/analysis';

const LIUHE: Record<string, string> = {
  子: '丑', 丑: '子', 寅: '亥', 亥: '寅',
  卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰',
  巳: '申', 申: '巳', 午: '未', 未: '午',
};
const LIUCHONG: Record<string, string> = {
  子: '午', 午: '子', 丑: '未', 未: '丑',
  寅: '申', 申: '寅', 卯: '酉', 酉: '卯',
  辰: '戌', 戌: '辰', 巳: '亥', 亥: '巳',
};
const LIUHAI: Record<string, string> = {
  子: '未', 未: '子', 丑: '午', 午: '丑',
  寅: '巳', 巳: '寅', 卯: '辰', 辰: '卯',
  申: '亥', 亥: '申', 酉: '戌', 戌: '酉',
};
const BRANCH_BREAK: Record<string, string> = {
  子: '酉', 酉: '子', 丑: '辰', 辰: '丑',
  寅: '亥', 亥: '寅', 卯: '午', 午: '卯',
  巳: '申', 申: '巳', 未: '戌', 戌: '未',
};
const SANXING: Record<string, string[]> = {
  子: ['卯'], 卯: ['子'], 寅: ['巳','申'], 巳: ['申','寅'],
  申: ['寅','巳'], 丑: ['戌','未'], 戌: ['未','丑'], 未: ['丑','戌'],
  辰: ['辰'], 午: ['午'], 酉: ['酉'], 亥: ['亥'],
};
const BRANCH_ORDER = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];

function getTripleCombination(b1: string, b2: string, b3: string): string | null {
  const s = new Set([b1, b2, b3]);
  if (s.size !== 3) return null;
  if (['亥','卯','未'].every(b => s.has(b))) return '木';
  if (['寅','午','戌'].every(b => s.has(b))) return '火';
  if (['巳','酉','丑'].every(b => s.has(b))) return '金';
  if (['申','子','辰'].every(b => s.has(b))) return '水';
  return null;
}
function getTripleGathering(b1: string, b2: string, b3: string): string | null {
  const s = new Set([b1, b2, b3]);
  if (s.size !== 3) return null;
  if (['寅','卯','辰'].every(b => s.has(b))) return '木';
  if (['巳','午','未'].every(b => s.has(b))) return '火';
  if (['申','酉','戌'].every(b => s.has(b))) return '金';
  if (['亥','子','丑'].every(b => s.has(b))) return '水';
  return null;
}
function getHalfCombination(b1: string, b2: string): { element: string; type: string } | null {
  const p = [b1, b2]
    .sort((left, right) => BRANCH_ORDER.indexOf(left) - BRANCH_ORDER.indexOf(right))
    .join('');
  const map: Record<string, { element: string; type: string }> = {
    '卯亥': { element: '木', type: '生地半合' }, '卯未': { element: '木', type: '墓地半合' },
    '寅午': { element: '火', type: '生地半合' }, '午戌': { element: '火', type: '墓地半合' },
    '巳酉': { element: '金', type: '生地半合' }, '丑酉': { element: '金', type: '墓地半合' },
    '子申': { element: '水', type: '生地半合' }, '子辰': { element: '水', type: '墓地半合' },
  };
  return map[p] || null;
}

export function analyzeRelationStructure(pillars: Array<{ zhi: string }>): RelationStructureProfile {
  const items: RelationStructureItem[] = [];
  const branches = pillars.map(p => p.zhi);
  const pillarNames = ['year', 'month', 'day', 'hour'];

  // Triple combinations
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      for (let k = j + 1; k < 4; k++) {
        const elem = getTripleCombination(branches[i], branches[j], branches[k]);
        if (elem) {
          items.push({
            category: '三合三会', name: '三合局',
            element: elem, pillars: [pillarNames[i], pillarNames[j], pillarNames[k]],
            values: [branches[i], branches[j], branches[k]],
            evidence: branches[i] + branches[j] + branches[k] + '合成' + elem + '局',
          });
        }
        const gather = getTripleGathering(branches[i], branches[j], branches[k]);
        if (gather && !elem) {
          items.push({
            category: '三合三会', name: '三会局',
            element: gather, pillars: [pillarNames[i], pillarNames[j], pillarNames[k]],
            values: [branches[i], branches[j], branches[k]],
            evidence: branches[i] + branches[j] + branches[k] + '会合' + gather + '方',
          });
        }
      }
    }
  }

  // Half combinations
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      const half = getHalfCombination(branches[i], branches[j]);
      if (half) items.push({
        category: '半合拱局', name: half.type,
        element: half.element, pillars: [pillarNames[i], pillarNames[j]],
        values: [branches[i], branches[j]],
        evidence: branches[i] + '与' + branches[j] + half.type,
      });
    }
  }

  // Six combinations, clash, harm, break
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      if (LIUHE[branches[i]] === branches[j]) items.push({
        category: '合化候选', name: '六合',
        pillars: [pillarNames[i], pillarNames[j]], values: [branches[i], branches[j]],
        evidence: branches[i] + '与' + branches[j] + '六合',
      });
      if (LIUCHONG[branches[i]] === branches[j]) items.push({
        category: '冲刑害破', name: '六冲',
        pillars: [pillarNames[i], pillarNames[j]], values: [branches[i], branches[j]],
        evidence: branches[i] + '与' + branches[j] + '相冲',
      });
      if (LIUHAI[branches[i]] === branches[j]) items.push({
        category: '冲刑害破', name: '六害',
        pillars: [pillarNames[i], pillarNames[j]], values: [branches[i], branches[j]],
        evidence: branches[i] + '与' + branches[j] + '相害',
      });
      if (BRANCH_BREAK[branches[i]] === branches[j]) items.push({
        category: '冲刑害破', name: '相破',
        pillars: [pillarNames[i], pillarNames[j]], values: [branches[i], branches[j]],
        evidence: branches[i] + '与' + branches[j] + '相破',
      });
    }
  }

  // Sanxing
  for (let i = 0; i < 4; i++) {
    const targets = SANXING[branches[i]];
    if (targets) {
      targets.forEach(t => {
        const found = branches.findIndex((b, j) => b === t && j !== i);
        if (found !== -1 && found > i) items.push({
          category: '冲刑害破', name: '三刑',
          pillars: [pillarNames[i], pillarNames[found]], values: [branches[i], branches[found]],
          evidence: branches[i] + '与' + branches[found] + '相刑',
        });
      });
    }
  }

  return { items, summary: '地支关系分析：共发现' + items.length + '组关系' };
}
