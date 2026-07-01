import type { TombStorageItem, TombStorageProfile } from '../types/analysis';
import { TWELVE_STAGES_MAP } from './baziMappingsData';

const HIDDEN_STEMS: Record<string, string[]> = {
  子: ['癸'],
  丑: ['己', '癸', '辛'],
  寅: ['甲', '丙', '戊'],
  卯: ['乙'],
  辰: ['戊', '乙', '癸'],
  巳: ['丙', '庚', '戊'],
  午: ['丁', '己'],
  未: ['己', '丁', '乙'],
  申: ['庚', '壬', '戊'],
  酉: ['辛'],
  戌: ['戊', '辛', '丁'],
  亥: ['壬', '甲'],
};
function getDayMasterTombBranch(dayMaster: string): string {
  const stages = TWELVE_STAGES_MAP[dayMaster];
  if (!stages) return '';
  return Object.entries(stages).find(([, stage]) => stage === '墓')?.[0] || '';
}

export function analyzeTombStorage(
  pillars: Array<{ gan: string; zhi: string }>,
  dayMaster: string,
  getWuxing: (s: string) => string,
  getTenGod: (g: string, d: string) => string,
): TombStorageProfile {
  const items: TombStorageItem[] = [];
  const fourTombs = ['辰', '戌', '丑', '未'];
  const dmTomb = getDayMasterTombBranch(dayMaster);

  pillars.forEach((p) => {
    if (!fourTombs.includes(p.zhi)) return;
    const stems = HIDDEN_STEMS[p.zhi] || [];
    const storageStem = stems[stems.length - 1] || stems[0];
    const storageWuxing = getWuxing(storageStem);
    items.push({
      branch: p.zhi,
      storageElement: storageWuxing,
      storageStem: storageStem,
      storageTenGod: getTenGod(storageStem, dayMaster),
      isDayMasterTomb: p.zhi === dmTomb,
    });
  });

  return { items, summary: '四库分析' };
}
