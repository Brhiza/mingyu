/**
 * @file 透干通根分析
 * @description 检查每个透出天干在地支藏干中是否有根：
 *   - 本根：藏干与透干为同一干
 *   - 同气根：藏干与透干同五行但不同干
 *   - 无根：地支藏干中既无同干也无同五行
 * @古籍依据 《子平真诠》"论根基"、《渊海子平》"论通根"
 *
 * 评分口径（沿用 vibebazi 量化方案）：
 *   - 本气 1.2 / 中气 0.8 / 余气 0.5
 *   - 本根权重 1.0，同气根权重 0.6
 */
import type {
  StemRootProfile,
  VisibleStemRootItem,
  ExposedStemItem,
  ExposedStemProfile,
} from '../types/analysis';

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

const STEM_ELEMENT: Record<string, string> = {
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
};

function getHiddenRootScore(index: number): number {
  if (index === 0) return 1.2; // 本气
  if (index === 1) return 0.8; // 中气
  return 0.5; // 余气
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

export function analyzeStemRootProfile(
  pillars: Array<{ gan: string; zhi: string }>,
  dayMaster: string,
  getWuxing: (s: string) => string,
  getTenGod: (g: string, d: string) => string,
): StemRootProfile {
  const pillarNames = ['year', 'month', 'day', 'hour'];
  const items: VisibleStemRootItem[] = [];

  pillars.forEach((p, idx) => {
    const visibleStem = p.gan;
    const visibleElement = STEM_ELEMENT[visibleStem] || getWuxing(visibleStem);
    let hasSameStem = false;
    let hasSameElement = false;
    let rootScore = 0;

    pillars.forEach((rootPillar) => {
      const stems = HIDDEN_STEMS[rootPillar.zhi] || [];
      stems.forEach((stem, index) => {
        const isSameStem = stem === visibleStem;
        const isSameElement = STEM_ELEMENT[stem] === visibleElement && stem !== visibleStem;
        if (isSameStem) {
          hasSameStem = true;
          rootScore += getHiddenRootScore(index) * 1.0; // 本根权重 1.0
        } else if (isSameElement) {
          hasSameElement = true;
          rootScore += getHiddenRootScore(index) * 0.6; // 同气根权重 0.6
        }
      });
    });

    const status: VisibleStemRootItem['status'] = hasSameStem
      ? '有本根'
      : hasSameElement
        ? '有同气根'
        : '无根';

    items.push({
      pillar: pillarNames[idx],
      stem: visibleStem,
      tenGod: getTenGod(visibleStem, dayMaster),
      rootScore: roundScore(rootScore),
      status,
      summary:
        status === '有本根'
          ? '四柱地支见本根支撑'
          : status === '有同气根'
            ? '四柱地支见同气根支撑'
            : '无根漂浮',
    });
  });

  const rootedCount = items.filter((i) => i.status !== '无根').length;
  return {
    items,
    rootedCount,
    summary: `天干通根：本根${items.filter((i) => i.status === '有本根').length}柱，同气根${items.filter((i) => i.status === '有同气根').length}柱，无根${items.filter((i) => i.status === '无根').length}柱。`,
  };
}

/**
 * 透干综合画像：每个透出天干的月令地位、力量状态
 *
 * commandStatus:
 *   - 司令透出：透干与月令司令同干
 *   - 月令藏干透出：透干为月支藏干之一
 *   - 得月令同气：透干与月令同五行
 *   - 不得月令：以上都不是
 */
export function analyzeExposedStemProfile(
  pillars: Array<{ gan: string; zhi: string }>,
  dayMaster: string,
  getWuxing: (s: string) => string,
  getTenGod: (g: string, d: string) => string,
  commanderStem?: string,
  monthBranch?: string,
): ExposedStemProfile {
  const pillarNames = ['year', 'month', 'day', 'hour'];
  const monthStems = monthBranch ? HIDDEN_STEMS[monthBranch] || [] : [];
  const items: ExposedStemItem[] = [];

  pillars.forEach((p, idx) => {
    const stemElement = STEM_ELEMENT[p.gan] || getWuxing(p.gan);
    let commandStatus = '不得月令';
    if (commanderStem && p.gan === commanderStem) {
      commandStatus = '司令透出';
    } else if (monthStems.includes(p.gan)) {
      commandStatus = '月令藏干透出';
    } else if (monthBranch && getWuxing(monthBranch) === stemElement) {
      commandStatus = '得月令同气';
    }

    items.push({
      pillar: pillarNames[idx],
      stem: p.gan,
      tenGod: getTenGod(p.gan, dayMaster),
      seasonStatus: '平',
      commandStatus,
      rootStatus: '待定',
      rootScore: 0,
      summary: `${p.gan}透于${pillarNames[idx]}，${commandStatus}`,
    });
  });

  return { items, summary: '天干透出画像' };
}
