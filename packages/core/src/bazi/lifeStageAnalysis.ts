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

  const tenGodMap: Record<string, { strong: number; low: number }> = {};

  const processStem = (stem: string) => {
    assertHeavenlyStem(stem, '天干');
    if (stem === dayMaster) return;
    const tg = getTenGod(stem, dayMaster);
    if (!tg || tg === '未知') {
      throw new Error(`十神数据缺失：${dayMaster}/${stem}`);
    }
    if (!tenGodMap[tg]) tenGodMap[tg] = { strong: 0, low: 0 };
    pillars.forEach((p) => {
      const stage = getLifeStage(stem, p.zhi);
      if (stageScores[stage]) tenGodMap[tg].strong += stageScores[stage];
      if (lowScores[stage]) tenGodMap[tg].low += lowScores[stage];
    });
  };

  pillars.forEach((p) => {
    processStem(p.gan);
  });
  pillars.forEach((p) => {
    (p.hiddenStems || []).forEach((s) => processStem(s));
  });

  const items = Object.entries(tenGodMap).map(([tenGod, v]) => ({
    stem: '',
    tenGod,
    strongCount: v.strong,
    lowCount: v.low,
    summary: v.strong > v.low ? '旺位多于弱位' : v.low > v.strong ? '弱位多于旺位' : '旺弱相当',
  }));

  return { items, summary: '十神十二长生分析' };
}
