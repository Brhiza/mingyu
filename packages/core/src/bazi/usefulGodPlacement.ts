import type { UsefulGodPlacementItem, UsefulGodPlacementProfile } from '../types/analysis';
import { HIDDEN_STEMS } from './baziMappingsData';

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
      甲: '木',
      乙: '木',
      丙: '火',
      丁: '火',
      戊: '土',
      己: '土',
      庚: '金',
      辛: '金',
      壬: '水',
      癸: '水',
      子: '水',
      丑: '土',
      寅: '木',
      卯: '木',
      辰: '土',
      巳: '火',
      午: '火',
      未: '土',
      申: '金',
      酉: '金',
      戌: '土',
      亥: '水',
    };
    return map[s] || '';
  };

  // 只登记喜忌归属事实与位置；得力、猖獗、受制等力量与制约结论超出本函数证据范围，
  // 需由旺衰、根气、合冲等已计算证据另行判断。喜忌数组重叠时显式登记为喜忌冲突
  const classify = (element: string, location: string): UsefulGodPlacementItem['status'] => {
    const isFav = element !== '' && favorableWuxing.includes(element);
    const isUnfav = element !== '' && unfavorableWuxing.includes(element);
    if (isFav && isUnfav) return '喜忌冲突';
    if (isFav) return location === '透出' ? '喜用五行透出' : '喜用五行藏支';
    if (isUnfav) return location === '透出' ? '忌神五行透出' : '忌神五行藏支';
    return '中性';
  };

  pillars.forEach((p, idx) => {
    const pn = pillarNames[idx];
    const fw = getWuxing(p.gan);
    items.push({
      pillar: pn,
      stem: p.gan,
      tenGod: getTenGod(p.gan, dayMaster),
      status: classify(fw, '透出'),
      evidence: p.gan + '透于' + pn,
    });
    const stems = HIDDEN_STEMS[p.zhi] || [];
    stems.forEach((s) => {
      const sw = getWuxing(s);
      items.push({
        pillar: pn,
        branch: p.zhi,
        stem: s,
        tenGod: getTenGod(s, dayMaster),
        status: classify(sw, '藏支'),
        evidence: s + '藏于' + p.zhi,
      });
    });
  });

  const favorableCount = items.filter((i) => i.status.startsWith('喜用')).length;
  const unfavorableCount = items.filter((i) => i.status.startsWith('忌神')).length;
  return { items, favorableCount, unfavorableCount, summary: '用神落点分析' };
}
