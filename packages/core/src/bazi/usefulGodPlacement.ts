
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
    const fw = getWuxing(p.gan);
    const isFav = favorableWuxing.includes(fw);
    const isUnfav = unfavorableWuxing.includes(fw);
    items.push({
      pillar: pn, stem: p.gan, tenGod: getTenGod(p.gan, dayMaster),
      status: isFav ? '喜神得力' : isUnfav ? '忌神猖獗' : '中性',
      evidence: p.gan + '透于' + pn,
    });
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
