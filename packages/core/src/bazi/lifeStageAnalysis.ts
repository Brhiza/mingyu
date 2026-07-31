import type { TenGodLifeStageProfile } from '../types/analysis';
import { TWELVE_STAGES_MAP } from './baziMappingsData';
import {
  assertEarthlyBranch,
  assertHeavenlyStem,
  getTenGod as getStandardTenGod,
} from './baziUtils';
import {
  assertTenGodFactInputs,
  FOUR_PILLAR_NAMES,
  type TenGodFactPillar,
} from './tenGodFactValidation';

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
  pillars: TenGodFactPillar[],
  dayMaster: string,
  getTenGod: (g: string, d: string) => string,
): TenGodLifeStageProfile {
  assertTenGodFactInputs(pillars, dayMaster, getTenGod);

  type SourcePosition = {
    pillar: (typeof FOUR_PILLAR_NAMES)[number];
    source: '透干' | '藏干';
  };
  const sourceMap = new Map<string, SourcePosition[]>();
  const recordSource = (stem: string, position: SourcePosition) => {
    const positions = sourceMap.get(stem) ?? [];
    positions.push(position);
    sourceMap.set(stem, positions);
  };

  pillars.forEach((pillar, pillarIndex) => {
    const pillarName = FOUR_PILLAR_NAMES[pillarIndex];
    if (pillarIndex !== 2) {
      recordSource(pillar.gan, { pillar: pillarName, source: '透干' });
    }
    pillar.hiddenStems.forEach((stem) => {
      recordSource(stem, { pillar: pillarName, source: '藏干' });
    });
  });

  const items = [...sourceMap.entries()].map(([stem, sourcePositions]) => {
    const stages = pillars.map((pillar, pillarIndex) => ({
      pillar: FOUR_PILLAR_NAMES[pillarIndex],
      branch: pillar.zhi,
      stage: getLifeStage(stem, pillar.zhi),
    }));
    return {
      stem,
      tenGod: getStandardTenGod(stem, dayMaster),
      sourcePositions,
      stages,
      summary: `${stem}在年、月、日、时四支所临十二长生依次为${stages.map((item) => item.stage).join('、')}`,
      sources: ['十干十二长生固定表（阳干顺行、阴干逆行）'],
      limitation:
        '这里只逐项登记该天干在四支所临十二长生，不设置权重，不汇总为强弱分数，也不据此判断喜忌、吉凶或现实事件',
    };
  });

  return {
    items,
    summary: `逐干逐支十二长生事实：共${items.length}个实际出现的天干`,
  };
}
