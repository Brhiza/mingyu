import type { TenGodLifeStageProfile } from '../types/analysis';
import { TWELVE_STAGES_MAP } from './baziMappingsData';
import { assertEarthlyBranch, assertHeavenlyStem } from './baziUtils';

function getLifeStage(stem: string, branch: string): string {
  assertHeavenlyStem(stem, '天干');
  assertEarthlyBranch(branch, '地支');
  const stage = TWELVE_STAGES_MAP[stem]?.[branch];
  if (!stage) {
    throw new Error(`十二长生数据缺失：${stem}${branch}`);
  }
  return stage;
}

export function analyzeLifeStageProfile(
  pillars: Array<{ gan: string; zhi: string }>,
): Array<{ pillar: string; stage: string }> {
  const pillarNames = ['year', 'month', 'day', 'hour'];
  if (pillars.length !== pillarNames.length) {
    throw new Error(`四柱数量无效：${pillars.length}`);
  }

  return pillars.map((p, idx) => ({
    pillar: pillarNames[idx],
    stage: getLifeStage(p.gan, p.zhi),
  }));
}

export function analyzeTenGodLifeStageProfile(
  pillars: Array<{ gan: string; zhi: string; hiddenStems: string[] }>,
  dayMaster: string,
  getTenGod: (g: string, d: string) => string,
): TenGodLifeStageProfile {
  assertHeavenlyStem(dayMaster, '日主');
  const stageScores: Record<string, number> = { 临官: 1, 帝旺: 1, 长生: 0.5, 冠带: 0.5 };
  const lowScores: Record<string, number> = { 死: 1, 绝: 1, 病: 0.5, 墓: 0.5 };

  const tenGodMap: Record<
    string,
    { strong: number; low: number; occurrences: number; positions: string[] }
  > = {};
  const pillarNames = ['年柱', '月柱', '日柱', '时柱'];

  // 仅排除明确的日主自身（日柱天干）；其余柱的同字比肩正常参与统计。
  // 同一天干多处透出或藏干重复时，长生状态只按该天干计算一次，另以出现次数登记，
  // 避免把“出现次数”与“位置星运”混在同一数值里重复累计
  const processStem = (stem: string, position: string, source: string) => {
    assertHeavenlyStem(stem, '天干');
    if (stem === dayMaster && source === '透干' && position === '日柱') return;
    const tg = getTenGod(stem, dayMaster);
    if (!tg || tg === '未知') {
      throw new Error(`十神数据缺失：${dayMaster}/${stem}`);
    }
    if (processedStems.has(stem)) {
      const entry = stemTenGod.get(stem)!;
      entry.occurrences += 1;
      entry.positions.push(position);
      return;
    }
    processedStems.add(stem);
    const strong = pillars.reduce((total, p) => {
      const stage = getLifeStage(stem, p.zhi);
      return total + (stageScores[stage] ?? 0);
    }, 0);
    const low = pillars.reduce((total, p) => {
      const stage = getLifeStage(stem, p.zhi);
      return total + (lowScores[stage] ?? 0);
    }, 0);
    stemTenGod.set(stem, { tenGod: tg, strong, low, occurrences: 1, positions: [position] });
  };
  const processedStems = new Set<string>();
  const stemTenGod = new Map<
    string,
    { tenGod: string; strong: number; low: number; occurrences: number; positions: string[] }
  >();

  pillars.forEach((p, idx) => {
    processStem(p.gan, pillarNames[idx] ?? String(idx), '透干');
  });
  pillars.forEach((p, idx) => {
    (p.hiddenStems || []).forEach((s) => {
      processStem(s, `${pillarNames[idx] ?? String(idx)}藏干`, '藏干');
    });
  });

  stemTenGod.forEach((entry) => {
    const target = tenGodMap[entry.tenGod] ?? { strong: 0, low: 0, occurrences: 0, positions: [] };
    target.strong += entry.strong;
    target.low += entry.low;
    target.occurrences += entry.occurrences;
    target.positions.push(...entry.positions);
    tenGodMap[entry.tenGod] = target;
  });

  const items = Object.entries(tenGodMap).map(([tenGod, v]) => ({
    stem: '',
    tenGod,
    strongCount: v.strong,
    lowCount: v.low,
    summary: `不同天干长生状态合计（旺位${v.strong}、弱位${v.low}，出现${v.occurrences}次：${v.positions.join('、')}）；${
      v.strong > v.low ? '旺位多于弱位' : v.low > v.strong ? '弱位多于旺位' : '旺弱相当'
    }`,
  }));

  return { items, summary: '十神十二长生分析' };
}
