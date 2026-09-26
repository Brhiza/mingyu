import type { TenGodLifeStageProfile } from '../types/analysis';
import { TWELVE_STAGES_MAP } from './baziMappingsData';
import { assertEarthlyBranch, assertHeavenlyStem } from './baziUtils';

type TenGodLifeStageEvidence = TenGodLifeStageProfile['items'][number]['evidence'][number];
type TenGodLifeStageBranchEvidence = TenGodLifeStageEvidence['branchStages'][number];

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
  if (pillars.length !== 4) {
    throw new Error(`四柱数量无效：${pillars.length}`);
  }
  const stageScores: Record<string, number> = { 临官: 1, 帝旺: 1, 长生: 0.5, 冠带: 0.5 };
  const lowScores: Record<string, number> = { 死: 1, 绝: 1, 病: 0.5, 墓: 0.5 };

  const tenGodMap: Record<
    string,
    {
      strong: number;
      low: number;
      evidence: TenGodLifeStageEvidence[];
    }
  > = {};
  const pillarNames = ['年柱', '月柱', '日柱', '时柱'];

  // 仅排除明确的日主自身（日柱天干）；其余柱的同字比肩正常参与统计。
  // 同一天干多处透出或藏干重复时，四支长生状态只计算一次；出现次数与来源单独保留。
  const processStem = (stem: string, position: string, isDayPillarVisibleStem: boolean) => {
    assertHeavenlyStem(stem, '天干');
    if (stem === dayMaster && isDayPillarVisibleStem) return;
    const tg = getTenGod(stem, dayMaster);
    if (!tg || tg === '未知') {
      throw new Error(`十神数据缺失：${dayMaster}/${stem}`);
    }
    const existing = stemTenGod.get(stem);
    if (existing) {
      existing.occurrences += 1;
      existing.positions.push(position);
      return;
    }
    const branchStages = pillars.map((p, idx) => {
      const stage = getLifeStage(stem, p.zhi);
      return {
        pillar: pillarNames[idx]!,
        branch: p.zhi,
        stage,
        strongScore: stageScores[stage] ?? 0,
        lowScore: lowScores[stage] ?? 0,
      };
    });
    const strong = branchStages.reduce((total, evidence) => total + evidence.strongScore, 0);
    const low = branchStages.reduce((total, evidence) => total + evidence.lowScore, 0);
    stemTenGod.set(stem, {
      tenGod: tg,
      strong,
      low,
      occurrences: 1,
      positions: [position],
      branchStages,
    });
  };
  const stemTenGod = new Map<
    string,
    {
      tenGod: string;
      strong: number;
      low: number;
      occurrences: number;
      positions: string[];
      branchStages: TenGodLifeStageBranchEvidence[];
    }
  >();

  pillars.forEach((p, idx) => {
    const pillar = pillarNames[idx]!;
    processStem(p.gan, `${pillar}透干`, idx === 2);
  });
  pillars.forEach((p, idx) => {
    const pillar = pillarNames[idx]!;
    (p.hiddenStems || []).forEach((s, hiddenIndex) => {
      processStem(s, `${pillar}藏干第${hiddenIndex + 1}位`, false);
    });
  });

  stemTenGod.forEach((entry, stem) => {
    const target: (typeof tenGodMap)[string] = tenGodMap[entry.tenGod] ?? {
      strong: 0,
      low: 0,
      evidence: [],
    };
    target.strong += entry.strong;
    target.low += entry.low;
    target.evidence.push({
      stem,
      occurrences: entry.occurrences,
      positions: entry.positions,
      branchStages: entry.branchStages,
    });
    tenGodMap[entry.tenGod] = target;
  });

  const items = Object.entries(tenGodMap).map(([tenGod, v]) => ({
    stem: v.evidence.map((evidence) => evidence.stem).join('、'),
    tenGod,
    strongCount: v.strong,
    lowCount: v.low,
    evidence: v.evidence,
    summary: `不同天干的四支长生状态合计（旺位${v.strong}、弱位${v.low}）；${v.evidence
      .map(
        (evidence) =>
          `${evidence.stem}出现${evidence.occurrences}次：${evidence.positions.join('、')}`,
      )
      .join('；')}；${
      v.strong > v.low ? '旺位多于弱位' : v.low > v.strong ? '弱位多于旺位' : '旺弱相当'
    }`,
  }));

  return { items, summary: '十神十二长生分析' };
}
