const fs = require('fs');
const path = require('path');
const coreSrc = path.join(__dirname, '..', 'src');
const baziNewDir = path.join(coreSrc, 'bazi');
const typesDir = path.join(coreSrc, 'types');

// === 1. Constants ===
fs.writeFileSync(path.join(baziNewDir, 'baziValues.ts'), `
// ── 天干阴阳 ──
export const STEM_YINYANG: Record<string, string> = {
  甲: '阳', 乙: '阴', 丙: '阳', 丁: '阴', 戊: '阳',
  己: '阴', 庚: '阳', 辛: '阴', 壬: '阳', 癸: '阴',
};
export const BRANCH_YINYANG: Record<string, string> = {
  子: '阳', 丑: '阴', 寅: '阳', 卯: '阴', 辰: '阳',
  巳: '阴', 午: '阳', 未: '阴', 申: '阳', 酉: '阴', 戌: '阳', 亥: '阴',
};
export const BRANCH_BREAK: Record<string, string> = {
  子: '酉', 酉: '子', 丑: '辰', 辰: '丑',
  寅: '亥', 亥: '寅', 卯: '午', 午: '卯',
  巳: '申', 申: '巳', 未: '戌', 戌: '未',
};
export const LU_BRANCH: Record<string, string> = {
  甲: '寅', 乙: '卯', 丙: '巳', 丁: '午',
  戊: '巳', 己: '午', 庚: '申', 辛: '酉',
  壬: '亥', 癸: '子',
};
export const BLADE_BRANCH: Record<string, string> = {
  甲: '卯', 乙: '寅', 丙: '午', 丁: '巳',
  戊: '午', 己: '巳', 庚: '酉', 辛: '申',
  壬: '子', 癸: '亥',
};
export const TOMB_BRANCH: Record<string, string> = {
  金: '丑', 木: '未', 火: '戌', 水: '辰', 土: '辰',
};
export const TWELVE_STAGES = [
  '长生', '沐浴', '冠带', '临官', '帝旺',
  '衰', '病', '死', '墓', '绝', '胎', '养',
];
import { TWELVE_STAGES_MAP } from './baziMappingsData';
export function getLifeStage(stem: string, branch: string): string {
  return TWELVE_STAGES_MAP[stem]?.[branch] || '未知';
}
export const MONTH_LING: Record<string, string> = {
  寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火',
  未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水', 子: '水', 丑: '土',
};
`, 'utf-8');
console.log('Written baziValues.ts');

// === 2. Type definitions for new analysis ===
const newTypes = `
export interface DayRootItem {
  pillar: string; branch: string; stem: string; tenGod: string;
  strength: '本气' | '中气' | '余气'; score: number;
}
export interface DayRootProfile {
  status: '有根' | '弱根' | '无根'; score: number; items: DayRootItem[]; summary: string;
}
export interface StemRootItem {
  pillar: string; branch: string; stem: string; tenGod: string;
  strength: '本气' | '中气' | '余气'; score: number;
}
export interface VisibleStemRootItem {
  pillar: string; stem: string; tenGod: string; rootScore: number;
  status: '有本根' | '有同气根' | '无根'; summary: string;
}
export interface StemRootProfile {
  items: VisibleStemRootItem[]; rootedCount: number; summary: string;
}
export interface ExposedStemItem {
  pillar: string; stem: string; tenGod: string; seasonStatus: string;
  commandStatus: string; rootStatus: string; rootScore: number; summary: string;
}
export interface ExposedStemProfile {
  items: ExposedStemItem[]; summary: string;
}
export interface TenGodDistributionItem {
  tenGod: string; visibleCount: number; hiddenCount: number;
  totalCount: number; score: number; status: string;
}
export interface TenGodStructureProfile {
  distributions: TenGodDistributionItem[];
  familyDistributions: Array<{ family: string; totalCount: number; score: number; status: string; }>;
  summary: string;
}
export interface TenGodFlowItem { name: string; description: string; caution: string; }
export interface TenGodFlowProfile { items: TenGodFlowItem[]; summary: string; }
export interface MonthQiElementItem {
  element: string; seasonStatus: string; score: number; percent: number; count: number; summary: string;
}
export interface MonthQiProfile {
  commanderStem: string; leadingElements: string[]; items: MonthQiElementItem[]; summary: string;
}
export interface RelationStructureItem {
  category: string; name: string; element?: string; pillars: string[]; values: string[]; evidence: string;
}
export interface RelationStructureProfile {
  items: RelationStructureItem[]; summary: string;
}
export interface UsefulGodPlacementItem {
  pillar: string; branch?: string; stem: string; tenGod: string;
  status: '喜神得力' | '喜神受制' | '忌神受制' | '忌神猖獗' | '中性'; evidence: string;
}
export interface UsefulGodPlacementProfile {
  items: UsefulGodPlacementItem[]; favorableCount: number; unfavorableCount: number; summary: string;
}
export interface TenGodLifeStageItem {
  stem: string; tenGod: string; strongCount: number; lowCount: number; summary: string;
}
export interface TenGodLifeStageProfile { items: TenGodLifeStageItem[]; summary: string; }
export interface TombStorageItem {
  branch: string; storageElement: string; storageStem: string; storageTenGod: string; isDayMasterTomb: boolean;
}
export interface TombStorageProfile { items: TombStorageItem[]; summary: string; }
export interface KongWangFillableItem { fillType: string; condition: string; }
export interface KongWangProfile {
  items: Array<{ pillar: string; emptyBranches: string[]; isEmpty: boolean; fillableItems?: KongWangFillableItem[]; }>;
  summary: string;
}
export interface NayinItem { pillar: string; ganZhi: string; nayin: string; element: string; }
export interface NayinProfile { items: NayinItem[]; summary: string; }
export interface MingGuaProfile { gua: string; element: string; eastWest: '东四命' | '西四命'; }
export interface MatterFocusItem { topic: string; relatedPalaces: string[]; keyStars: string[]; priority: number; }
export interface MatterFocusProfile { items: MatterFocusItem[]; }
export interface XiaoYunItem { age: number; ganZhi: string; tenGod: string; }
export interface XiaoYunProfile { items: XiaoYunItem[]; summary: string; }
export interface LuckDirectionProfile { direction: '顺行' | '逆行'; summary: string; }
`;

const analysisTypes = fs.readFileSync(path.join(typesDir, 'analysis.ts'), 'utf-8');
// Check if already appended
if (!analysisTypes.includes('DayRootProfile')) {
  fs.writeFileSync(path.join(typesDir, 'analysis.ts'), analysisTypes + newTypes, 'utf-8');
  console.log('Appended new types to analysis.ts');
} else {
  console.log('Types already exist, skipping');
}

// === 3. Create analysis modules ===

// 3a. tenGodAnalysis.ts - 十神分布/结构/流动
fs.writeFileSync(path.join(baziNewDir, 'tenGodAnalysis.ts'), `
import type {
  TenGodDistributionItem, TenGodStructureProfile,
  TenGodFlowItem, TenGodFlowProfile,
} from '../types/analysis';

const TEN_GOD_FAMILY: Record<string, string> = {
  比肩: '比劫', 劫财: '比劫',
  正印: '印绶', 偏印: '印绶',
  食神: '食伤', 伤官: '食伤',
  正财: '财才', 偏财: '财才',
  正官: '官杀', 七杀: '官杀',
};
const TEN_GOD_PAIR: Record<string, string> = {
  比肩: '劫财', 劫财: '比肩',
  正印: '偏印', 偏印: '正印',
  食神: '伤官', 伤官: '食神',
  正财: '偏财', 偏财: '正财',
  正官: '七杀', 七杀: '正官',
};

export function analyzeTenGodStructure(
  pillars: Array<{ gan: string; zhi: string; hiddenStems: string[] }>,
  dayMaster: string,
  getTenGod: (g: string, d: string) => string,
): TenGodStructureProfile {
  const tenGodKeys = ['比肩','劫财','食神','伤官','正财','偏财','正官','七杀','正印','偏印'];
  const counts: Record<string, { visible: number; hidden: number }> = {};
  tenGodKeys.forEach(t => { counts[t] = { visible: 0, hidden: 0 }; });

  let totalScore = 0;
  pillars.forEach((p) => {
    const tg = getTenGod(p.gan, dayMaster);
    if (counts[tg]) { counts[tg].visible++; totalScore += 2; }
    p.hiddenStems.forEach((s) => {
      const ht = getTenGod(s, dayMaster);
      if (counts[ht]) { counts[ht].hidden++; totalScore += 1; }
    });
  });

  const distributions: TenGodDistributionItem[] = tenGodKeys.map((tenGod) => {
    const c = counts[tenGod];
    const score = c.visible * 2 + c.hidden;
    const status = c.visible >= 2 ? '偏重' : c.visible >= 1 ? '有力' : c.hidden >= 1 ? '潜藏' : '缺位';
    return { tenGod, visibleCount: c.visible, hiddenCount: c.hidden, totalCount: c.visible + c.hidden, score, status };
  });

  // Family distributions
  const famMap: Record<string, { count: number; score: number }> = {};
  distributions.forEach(d => {
    const f = TEN_GOD_FAMILY[d.tenGod] || '其他';
    if (!famMap[f]) famMap[f] = { count: 0, score: 0 };
    famMap[f].count += d.totalCount;
    famMap[f].score += d.score;
  });
  const familyDistributions = Object.entries(famMap).map(([family, v]) => ({
    family, totalCount: v.count, score: v.score,
    status: v.count >= 4 ? '偏重' : v.count >= 2 ? '有力' : v.count >= 1 ? '偏弱' : '缺位',
  }));

  return {
    distributions,
    familyDistributions,
    summary: '十神分布分析',
  };
}

export function analyzeTenGodFlow(
  structure: TenGodStructureProfile,
): TenGodFlowProfile {
  const flows: TenGodFlowItem[] = [];
  const hasBJ = structure.distributions.some(d => TEN_GOD_FAMILY[d.tenGod] === '比劫' && d.totalCount > 0);
  const hasYX = structure.distributions.some(d => TEN_GOD_FAMILY[d.tenGod] === '印绶' && d.totalCount > 0);
  const hasSS = structure.distributions.some(d => TEN_GOD_FAMILY[d.tenGod] === '食伤' && d.totalCount > 0);
  const hasCC = structure.distributions.some(d => TEN_GOD_FAMILY[d.tenGod] === '财才' && d.totalCount > 0);
  const hasGS = structure.distributions.some(d => TEN_GOD_FAMILY[d.tenGod] === '官杀' && d.totalCount > 0);

  if (hasBJ && hasSS) flows.push({ name: '比劫泄秀', description: '比劫同党与食伤承接，可能靠技能/表达输出', caution: '食伤为用则吉，食伤为忌则泄身太过' });
  if (hasSS && hasCC) flows.push({ name: '食伤生财', description: '才华/技能可转化为财富', caution: '需日主能担财' });
  if (hasCC && hasGS) flows.push({ name: '财生官杀', description: '财富可带来地位/权力', caution: '官杀为用则贵，官杀为忌则压力' });
  if (hasYX && hasBJ) flows.push({ name: '印比相生', description: '人脉/资源相互支撑', caution: '印重则依赖性强' });

  return { items: flows, summary: flows.length ? '十神流动关系分析' : '十神流动特征不明显' };
}
`);
console.log('Written tenGodAnalysis.ts');

// 3b. stemRootAnalysis.ts
fs.writeFileSync(path.join(baziNewDir, 'stemRootAnalysis.ts'), `
import type { StemRootProfile, VisibleStemRootItem, ExposedStemItem, ExposedStemProfile } from '../types/analysis';

const HIDDEN_STEMS: Record<string, string[]> = {
  子: ['癸'], 丑: ['己','癸','辛'], 寅: ['甲','丙','戊'],
  卯: ['乙'], 辰: ['戊','乙','癸'], 巳: ['丙','庚','戊'],
  午: ['丁','己'], 未: ['己','丁','乙'], 申: ['庚','壬','戊'],
  酉: ['辛'], 戌: ['戊','辛','丁'], 亥: ['壬','甲'],
};

export function analyzeStemRootProfile(
  pillars: Array<{ gan: string; zhi: string }>,
  dayMaster: string,
  getWuxing: (s: string) => string,
  getTenGod: (g: string, d: string) => string,
): StemRootProfile {
  const items: VisibleStemRootItem[] = [];
  let rootedCount = 0;

  pillars.forEach((p, idx) => {
    if (p.gan === dayMaster) return; // skip day stem itself
    const stemWuxing = getWuxing(p.gan);
    const stems = HIDDEN_STEMS[p.zhi] || [];
    let rootScore = 0;
    let hasSameStem = false;
    let hasSameElement = false;

    stems.forEach((s, si) => {
      if (s === p.gan) { hasSameStem = true; rootScore += si === 0 ? 3 : 1; }
      else if (getWuxing(s) === stemWuxing) { hasSameElement = true; rootScore += si === 0 ? 2 : 0.5; }
    });

    const status = hasSameStem ? '有本根' : hasSameElement ? '有同气根' : '无根';
    if (status !== '无根') rootedCount++;
    const pillarNames = ['year', 'month', 'day', 'hour'];
    items.push({
      pillar: pillarNames[idx], stem: p.gan, tenGod: getTenGod(p.gan, dayMaster),
      rootScore, status, summary: status === '有本根' ? '有本根支撑' : status === '有同气根' ? '有同气根支撑' : '无根漂浮',
    });
  });

  return { items, rootedCount, summary: rootedCount > items.length / 2 ? '多数透干有根' : '透干多根弱' };
}

export function analyzeExposedStemProfile(
  pillars: Array<{ gan: string; zhi: string }>,
  dayMaster: string,
  getWuxing: (s: string) => string,
  getTenGod: (g: string, d: string) => string,
  commanderStem?: string,
): ExposedStemProfile {
  const items: ExposedStemItem[] = [];
  pillars.forEach((p, idx) => {
    if (p.gan === dayMaster) return;
    const pillarNames = ['year', 'month', 'day', 'hour'];
    const commandStatus = p.gan === commanderStem ? '司令透出' : '普通透干';
    items.push({
      pillar: pillarNames[idx], stem: p.gan, tenGod: getTenGod(p.gan, dayMaster),
      seasonStatus: '平', commandStatus, rootStatus: '待定', rootScore: 0,
      summary: p.gan + '透于' + pillarNames[idx],
    });
  });
  return { items, summary: '天干透出画像' };
}
`);
console.log('Written stemRootAnalysis.ts');

// 3c. relationStructure.ts
fs.writeFileSync(path.join(baziNewDir, 'relationStructure.ts'), `
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
  const BRANCH_ORDER = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
  const p = [b1, b2].sort((a, b) => BRANCH_ORDER.indexOf(a) - BRANCH_ORDER.indexOf(b)).join('');
  const map: Record<string, { element: string; type: string }> = {
    '亥卯': { element: '木', type: '生地半合' }, '卯未': { element: '木', type: '墓地半合' },
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
`);
console.log('Written relationStructure.ts');

// 3d. kongWangAnalysis.ts
fs.writeFileSync(path.join(baziNewDir, 'kongWangAnalysis.ts'), `
import type { KongWangProfile } from '../types/analysis';

export function analyzeKongWangProfile(
  pillars: Array<{ gan: string; zhi: string }>,
  dayMasterStem: string,
): KongWangProfile {
  const stems = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
  const branches = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
  const pillarNames = ['year', 'month', 'day', 'hour'];

  // Find day pillar index to determine xun
  const dayIdx = pillars.findIndex((_, idx) => {
    const pillarNamesLookup = ['year', 'month', 'day', 'hour'];
    return pillarNamesLookup[idx] === 'day';
  });
  const dayGan = pillars[2].gan;
  const dayZhi = pillars[2].zhi;
  const gi = stems.indexOf(dayGan);
  const zi = branches.indexOf(dayZhi);
  const xunStart = gi - zi;
  const emptyIdx1 = (10 + zi - gi) % 12;
  const emptyIdx2 = (11 + zi - gi) % 12;
  const emptyBranches = [branches[emptyIdx1], branches[emptyIdx2]];

  const cnItems = pillarNames.map((pn, idx) => {
    const isEmpty = emptyBranches.includes(pillars[idx].zhi);
    return { pillar: pn, emptyBranches, isEmpty, fillableItems: [] };
  });

  return { items: cnItems, summary: '旬空：' + emptyBranches.join('、') };
}
`);
console.log('Written kongWangAnalysis.ts');

// 3e. tombStorage.ts
fs.writeFileSync(path.join(baziNewDir, 'tombStorage.ts'), `
import type { TombStorageItem, TombStorageProfile } from '../types/analysis';

const HIDDEN_STEMS: Record<string, string[]> = {
  子: ['癸'], 丑: ['己','癸','辛'], 寅: ['甲','丙','戊'],
  卯: ['乙'], 辰: ['戊','乙','癸'], 巳: ['丙','庚','戊'],
  午: ['丁','己'], 未: ['己','丁','乙'], 申: ['庚','壬','戊'],
  酉: ['辛'], 戌: ['戊','辛','丁'], 亥: ['壬','甲'],
};
const TOMB_BRANCH: Record<string, string> = { 金: '丑', 木: '未', 火: '戌', 水: '辰', 土: '辰' };
const WUXING_S: Record<string, string> = { 金: '丑', 木: '未', 火: '戌', 水: '辰', 土: '辰' };

export function analyzeTombStorage(
  pillars: Array<{ gan: string; zhi: string }>,
  dayMaster: string,
  getWuxing: (s: string) => string,
  getTenGod: (g: string, d: string) => string,
): TombStorageProfile {
  const items: TombStorageItem[] = [];
  const fourTombs = ['辰','戌','丑','未'];
  const dmWuxing = getWuxing(dayMaster);
  const dmTomb = TOMB_BRANCH[dmWuxing] || '';

  pillars.forEach(p => {
    if (!fourTombs.includes(p.zhi)) return;
    const stems = HIDDEN_STEMS[p.zhi] || [];
    const storageStem = stems[stems.length - 1] || stems[0];
    const storageWuxing = getWuxing(storageStem);
    items.push({
      branch: p.zhi, storageElement: storageWuxing,
      storageStem: storageStem,
      storageTenGod: getTenGod(storageStem, dayMaster),
      isDayMasterTomb: p.zhi === dmTomb,
    });
  });

  return { items, summary: '四库分析' };
}
`);
console.log('Written tombStorage.ts');

// 3f. lifeStageAnalysis.ts
fs.writeFileSync(path.join(baziNewDir, 'lifeStageAnalysis.ts'), `
import type { TenGodLifeStageItem, TenGodLifeStageProfile, LifeStageItem } from '../types/analysis';

const TWELVE_STAGES = ['长生','沐浴','冠带','临官','帝旺','衰','病','死','墓','绝','胎','养'];
const TWELVE_STAGES_START: Record<string, string> = {
  木: '亥', 火: '寅', 金: '巳', 水: '申', 土: '申',
};
import { TWELVE_STAGES_MAP } from '../baziMappingsData';
function getLifeStage(stem: string, branch: string): string {
  return TWELVE_STAGES_MAP[stem]?.[branch] || '未知';
}

export function analyzeLifeStageProfile(
  pillars: Array<{ gan: string; zhi: string }>,
): LifeStageItem[] {
  const pillarNames = ['year', 'month', 'day', 'hour'];
  return pillars.map((p, idx) => ({
    pillar: pillarNames[idx], stage: getLifeStage(p.gan, p.zhi),
  }));
}

export function analyzeTenGodLifeStageProfile(
  pillars: Array<{ gan: string; zhi: string; hiddenStems: string[] }>,
  dayMaster: string,
  getTenGod: (g: string, d: string) => string,
): TenGodLifeStageProfile {
  const stageScores: Record<string, number> = { 临官: 1, 帝旺: 1, 长生: 0.5, 冠带: 0.5 };
  const lowScores: Record<string, number> = { 死: 1, 绝: 1, 病: 0.5, 墓: 0.5 };

  const tenGodMap: Record<string, { strong: number; low: number }> = {};

  const processStem = (stem: string) => {
    if (stem === dayMaster) return;
    const tg = getTenGod(stem, dayMaster);
    if (!tenGodMap[tg]) tenGodMap[tg] = { strong: 0, low: 0 };
    // Calculate life stage for each branch
    pillars.forEach(p => {
      const stage = getLifeStage(stem, p.zhi);
      if (stageScores[stage]) tenGodMap[tg].strong += stageScores[stage];
      if (lowScores[stage]) tenGodMap[tg].low += lowScores[stage];
    });
  };

  // Process visible stems
  pillars.forEach(p => { processStem(p.gan); });
  // Process hidden stems
  pillars.forEach(p => {
    (p.hiddenStems || []).forEach(s => processStem(s));
  });

  const items = Object.entries(tenGodMap).map(([tenGod, v]) => ({
    stem: '', tenGod, strongCount: v.strong, lowCount: v.low,
    summary: v.strong > v.low ? '旺位多于弱位' : v.low > v.strong ? '弱位多于旺位' : '旺弱相当',
  }));

  return { items, summary: '十神十二长生分析' };
}
`);
console.log('Written lifeStageAnalysis.ts');

// 3g. usefulGodPlacement.ts
fs.writeFileSync(path.join(baziNewDir, 'usefulGodPlacement.ts'), `
import type { UsefulGodPlacementItem, UsefulGodPlacementProfile } from '../types/analysis';

const HIDDEN_STEMS: Record<string, string[]> = {
  子: ['癸'], 丑: ['己','癸','辛'], 寅: ['甲','丙','戊'],
  卯: ['乙'], 辰: ['戊','乙','癸'], 巳: ['丙','庚','戊'],
  午: ['丁','己'], 未: ['己','丁','乙'], 申: ['庚','壬','戊'],
  酉: ['辛'], 戌: ['戊','辛','丁'], 亥: ['壬','甲'],
};

export function analyzeUsefulGodPlacement(
  pillars: Array<{ gan: string; zhi: string }>,
  dayMaster: string,
  getTenGod: (g: string, d: string) => string,
  favorableWuxing: string[],
  unfavorableWuxing: string[],
): UsefulGodPlacementProfile {
  const items: UsefulGodPlacementItem[] = [];
  const pillarNames = ['year', 'month', 'day', 'hour'];
  const getWuxing = (s: string) => {
    const map: Record<string, string> = {
      甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水',
      子:'水',丑:'土',寅:'木',卯:'木',辰:'土',巳:'火',午:'火',未:'土',申:'金',酉:'金',戌:'土',亥:'水',
    };
    return map[s] || '';
  };

  pillars.forEach((p, idx) => {
    const pn = pillarNames[idx];
    // Stem
    const fw = getWuxing(p.gan);
    const isFav = favorableWuxing.includes(fw);
    const isUnfav = unfavorableWuxing.includes(fw);
    items.push({
      pillar: pn, stem: p.gan, tenGod: getTenGod(p.gan, dayMaster),
      status: isFav ? '喜神得力' : isUnfav ? '忌神猖獗' : '中性',
      evidence: p.gan + '透于' + pn,
    });
    // Hidden stems
    const stems = HIDDEN_STEMS[p.zhi] || [];
    stems.forEach(s => {
      const sw = getWuxing(s);
      const sf = favorableWuxing.includes(sw);
      const su = unfavorableWuxing.includes(sw);
      items.push({
        pillar: pn, branch: p.zhi, stem: s, tenGod: getTenGod(s, dayMaster),
        status: sf ? '喜神得力' : su ? '忌神受制' : '中性',
        evidence: s + '藏于' + p.zhi,
      });
    });
  });

  const favorableCount = items.filter(i => i.status.includes('喜')).length;
  const unfavorableCount = items.filter(i => i.status.includes('忌')).length;
  return { items, favorableCount, unfavorableCount, summary: '用神落点分析' };
}
`);
console.log('Written usefulGodPlacement.ts');

// 3h. mingGua.ts
fs.writeFileSync(path.join(baziNewDir, 'mingGua.ts'), `
import type { MingGuaProfile } from '../types/analysis';

const MING_GUA_TABLE: Record<number, { gua: string; star: string; element: string; group: '东四命' | '西四命' }> = {
  1: { gua: '坎', star: '一白贪狼', element: '水', group: '东四命' },
  2: { gua: '坤', star: '二黑巨门', element: '土', group: '西四命' },
  3: { gua: '震', star: '三碧禄存', element: '木', group: '东四命' },
  4: { gua: '巽', star: '四绿文曲', element: '木', group: '东四命' },
  6: { gua: '乾', star: '六白武曲', element: '金', group: '西四命' },
  7: { gua: '兑', star: '七赤破军', element: '金', group: '西四命' },
  8: { gua: '艮', star: '八白左辅', element: '土', group: '西四命' },
  9: { gua: '离', star: '九紫右弼', element: '火', group: '东四命' },
};

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function normalizeMingGuaNumber(value: number): number {
  return positiveModulo(value - 1, 9) + 1;
}

export function calculateMingGua(birthYear: number, gender: string): MingGuaProfile {
  const remainder = positiveModulo(birthYear, 9);
  const rawNumber =
    gender === 'male'
      ? normalizeMingGuaNumber(11 - remainder)
      : normalizeMingGuaNumber(4 + remainder);
  const number = rawNumber === 5 ? (gender === 'male' ? 2 : 8) : rawNumber;
  const config = MING_GUA_TABLE[number] || MING_GUA_TABLE[1];

  return {
    number,
    gua: config.gua,
    star: config.star,
    element: config.element,
    eastWest: config.group,
  };
}
`);
console.log('Written mingGua.ts');

// 3i. luckDetails.ts
fs.writeFileSync(path.join(baziNewDir, 'luckDetails.ts'), `
import type { XiaoYunItem, XiaoYunProfile, LuckDirectionProfile } from '../types/analysis';

export function calculateXiaoYunProfile(
  birthYear: number,
  gender: string,
  dayMaster: string,
  startAge: number,
  getTenGod: (g: string, d: string) => string,
): XiaoYunProfile {
  const items: XiaoYunItem[] = [];
  const stems = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
  const branches = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
  const isMale = gender === 'male';
  const yearGanIdx = (birthYear - 4) % 10;
  const isYang = yearGanIdx % 2 === 0;

  for (let age = 1; age <= startAge; age++) {
    // Small luck: for male yang / female yin, forward; otherwise reverse
    const direction = (isMale && isYang) || (!isMale && !isYang) ? 1 : -1;
    const ganIdx = ((yearGanIdx + direction * (age - 1)) % 10 + 10) % 10;
    const zhiIdx = ((((birthYear - 4) % 12) + direction * (age - 1)) % 12 + 12) % 12;
    const gz = stems[ganIdx] + branches[zhiIdx];
    items.push({ age, ganZhi: gz, tenGod: getTenGod(stems[ganIdx], dayMaster) });
  }
  return { items, summary: items.length + '年小运' };
}

export function buildLuckDirectionProfile(
  gender: string,
  yearStem: string,
): LuckDirectionProfile {
  const stems = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
  const isMale = gender === 'male';
  const idx = stems.indexOf(yearStem);
  const isYang = idx !== -1 && idx % 2 === 0;
  const direction = (isMale && isYang) || (!isMale && !isYang) ? '顺行' : '逆行';
  return {
    direction,
    summary: isMale ? (isYang ? '阳男大运顺行' : '阴男大运逆行') : (isYang ? '阳女大运逆行' : '阴女大运顺行'),
  };
}
`);
console.log('Written luckDetails.ts');

// 3j. matterFocus.ts
fs.writeFileSync(path.join(baziNewDir, 'matterFocus.ts'), `
import type { MatterFocusItem, MatterFocusProfile } from '../types/analysis';

export function analyzeMatterFocusProfile(
  gender: string,
  favorableWuxing: string[],
): MatterFocusProfile {
  const items: MatterFocusItem[] = [
    { topic: '事业', relatedPalaces: ['官禄','迁移'], keyStars: [''], priority: 10 },
    { topic: '财运', relatedPalaces: ['财帛','田宅'], keyStars: [''], priority: 9 },
    { topic: '感情', relatedPalaces: ['夫妻','子女'], keyStars: [''], priority: 8 },
    { topic: '健康', relatedPalaces: ['疾厄'], keyStars: [''], priority: 7 },
    { topic: '人际', relatedPalaces: ['兄弟','父母'], keyStars: [''], priority: 6 },
  ];
  return { items };
}
`);
console.log('Written matterFocus.ts');

// 3k. nayinAnalysis.ts
fs.writeFileSync(path.join(baziNewDir, 'nayinAnalysis.ts'), `
import type { NayinItem, NayinProfile } from '../types/analysis';

const NAYIN_MAP: Record<string, string> = {
  '甲子':'海中金','乙丑':'海中金','丙寅':'炉中火','丁卯':'炉中火',
  '戊辰':'大林木','己巳':'大林木','庚午':'路旁土','辛未':'路旁土',
  '壬申':'剑锋金','癸酉':'剑锋金','甲戌':'山头火','乙亥':'山头火',
  '丙子':'涧下水','丁丑':'涧下水','戊寅':'城头土','己卯':'城头土',
  '庚辰':'白蜡金','辛巳':'白蜡金','壬午':'杨柳木','癸未':'杨柳木',
  '甲申':'泉中水','乙酉':'泉中水','丙戌':'屋上土','丁亥':'屋上土',
  '戊子':'霹雳火','己丑':'霹雳火','庚寅':'松柏木','辛卯':'松柏木',
  '壬辰':'长流水','癸巳':'长流水','甲午':'沙中金','乙未':'沙中金',
  '丙申':'山下火','丁酉':'山下火','戊戌':'平地木','己亥':'平地木',
  '庚子':'壁上土','辛丑':'壁上土','壬寅':'金箔金','癸卯':'金箔金',
  '甲辰':'覆灯火','乙巳':'覆灯火','丙午':'天河水','丁未':'天河水',
  '戊申':'大驿土','己酉':'大驿土','庚戌':'钗钏金','辛亥':'钗钏金',
  '壬子':'桑柘木','癸丑':'桑柘木','甲寅':'大溪水','乙卯':'大溪水',
  '丙辰':'沙中土','丁巳':'沙中土','戊午':'天上火','己未':'天上火',
  '庚申':'石榴木','辛酉':'石榴木','壬戌':'大海水','癸亥':'大海水',
};
const NAYIN_ELEMENT: Record<string, string> = {
  金:'金',木:'木',水:'水',火:'火',土:'土',
};

export function analyzeNayinProfile(
  pillars: Array<{ gan: string; zhi: string }>,
): NayinProfile {
  const pillarNames = ['year', 'month', 'day', 'hour'];
  const items: NayinItem[] = pillars.map((p, idx) => {
    const gz = p.gan + p.zhi;
    const na = NAYIN_MAP[gz] || '未知';
    // Extract element from nayin name (last character)
    const lastChar = na.slice(-1);
    const elements: Record<string, string> = { 金:'金',木:'木',水:'水',火:'火',土:'土' };
    return { pillar: pillarNames[idx], ganZhi: gz, nayin: na, element: elements[lastChar] || '土' };
  });
  return { items, summary: items.map(i => i.nayin).join(' / ') };
}
`);
console.log('Written nayinAnalysis.ts');

// 3l. monthCommand.ts
fs.writeFileSync(path.join(baziNewDir, 'monthCommand.ts'), `
import type { MonthQiElementItem, MonthQiProfile } from '../types/analysis';

export function analyzeMonthQiProfile(
  monthBranch: string,
  commanderStem?: string,
): MonthQiProfile {
  const elemMap: Record<string, string> = { 寅:'木',卯:'木',辰:'土',巳:'火',午:'火',未:'土',申:'金',酉:'金',戌:'土',亥:'水',子:'水',丑:'土' };
  const seasonElements = ['木','火','土','金','水'];
  const monthElement = elemMap[monthBranch] || '土';

  const items: MonthQiElementItem[] = seasonElements.map((elem) => {
    let seasonStatus = '平';
    if (elem === monthElement) seasonStatus = '旺';
    else if ((monthElement === '木' && elem === '火') || (monthElement === '火' && elem === '土') ||
             (monthElement === '土' && elem === '金') || (monthElement === '金' && elem === '水') ||
             (monthElement === '水' && elem === '木')) seasonStatus = '相';
    else if ((elem === '木' && monthElement === '火') || (elem === '火' && monthElement === '土') ||
             (elem === '土' && monthElement === '金') || (elem === '金' && monthElement === '水') ||
             (elem === '水' && monthElement === '木')) seasonStatus = '休';
    else if ((monthElement === '木' && elem === '金') || (monthElement === '火' && elem === '水') ||
             (monthElement === '土' && elem === '木') || (monthElement === '金' && elem === '火') ||
             (monthElement === '水' && elem === '土')) seasonStatus = '囚';
    else seasonStatus = '死';
    return { element: elem, seasonStatus, score: 0, percent: 0, count: 0, summary: elem + '于' + monthBranch + '月' + seasonStatus };
  });

  return { commanderStem: commanderStem || '', leadingElements: [monthElement], items, summary: monthBranch + '月令分析' };
}
`);
console.log('Written monthCommand.ts');

console.log('All analysis modules extracted successfully!');
