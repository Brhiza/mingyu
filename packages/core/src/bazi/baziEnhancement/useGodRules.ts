/**
 * 用神体系扩充：病药法与通关法规则。
 */

import { BASIC_MAPPINGS } from '../baziDefinitions';
import { WUXING, type PatternAnalysis, type Wuxing } from '../baziTypes';

interface DiseaseMedicineRule {
  id: string;
  label: string;
  description: string;
  diseasePatterns: string[];
  medicinePatterns: string[];
  priority: number;
}

const DISEASE_MEDICINE_RULES: DiseaseMedicineRule[] = [
  {
    id: 'disease-water-fire-war',
    label: '水火相战病药',
    description: '命局水火对峙失衡，以木通关调和为药',
    diseasePatterns: ['水旺火弱', '火旺水弱', '水火相激'],
    medicinePatterns: ['木通关', '木泄水火'],
    priority: 100,
  },
  {
    id: 'disease-wood-metal-war',
    label: '木金相战病药',
    description: '命局木金对峙失衡，以水通关调和为药',
    diseasePatterns: ['木旺金弱', '金旺木弱', '木金相战'],
    medicinePatterns: ['水通关', '水泄金木'],
    priority: 100,
  },
  {
    id: 'disease-earth-fire-war',
    label: '土火相战病药',
    description: '命局土火对峙失衡，以金通关调和为药',
    diseasePatterns: ['土旺火弱', '火旺土弱', '土火相激'],
    medicinePatterns: ['金通关', '金泄土火'],
    priority: 100,
  },
  {
    id: 'disease-over-strong',
    label: '过旺为病',
    description: '某五行过旺为病，以泄为药',
    diseasePatterns: ['身强', '偏强', '极强', '专旺'],
    medicinePatterns: ['食伤泄秀', '财星耗泄', '官杀克抑'],
    priority: 90,
  },
  {
    id: 'disease-over-weak',
    label: '过弱为病',
    description: '某五行过弱为病，以生扶为药',
    diseasePatterns: ['身弱', '偏弱', '极弱'],
    medicinePatterns: ['印星生扶', '比劫助身'],
    priority: 90,
  },
  {
    id: 'disease-cold-heat',
    label: '寒热病药',
    description: '命局过寒或过热为病，调候为药',
    diseasePatterns: ['过寒', '过热', '寒热失调'],
    medicinePatterns: ['丙火调候', '癸水润燥', '寒者喜暖', '热者喜凉'],
    priority: 95,
  },
  {
    id: 'disease-dry-wet',
    label: '燥湿病药',
    description: '命局过燥或过湿为病，调候为药',
    diseasePatterns: ['过燥', '过湿', '燥湿失调'],
    medicinePatterns: ['水润燥', '火烤湿', '燥者喜润', '湿者喜燥'],
    priority: 95,
  },
];

interface TongguanRule {
  id: string;
  label: string;
  description: string;
  conflictWuxings: [string, string];
  tongguanWuxing: string;
  priority: number;
}

const TONGGUAN_RULES: TongguanRule[] = [
  {
    id: 'tg-water-fire',
    label: '水火通关',
    description: '木泄水火，调和相战',
    conflictWuxings: ['水', '火'],
    tongguanWuxing: '木',
    priority: 100,
  },
  {
    id: 'tg-wood-metal',
    label: '木金通关',
    description: '水泄金木，调和相战',
    conflictWuxings: ['木', '金'],
    tongguanWuxing: '水',
    priority: 100,
  },
  {
    id: 'tg-earth-fire',
    label: '土火通关',
    description: '金泄土火，调和相战',
    conflictWuxings: ['土', '火'],
    tongguanWuxing: '金',
    priority: 100,
  },
  {
    id: 'tg-earth-water',
    label: '土水通关',
    description: '木泄水土，调和相战',
    conflictWuxings: ['土', '水'],
    tongguanWuxing: '木',
    priority: 100,
  },
  {
    id: 'tg-metal-fire',
    label: '金火通关',
    description: '土泄金火，调和相战',
    conflictWuxings: ['金', '火'],
    tongguanWuxing: '土',
    priority: 100,
  },
  {
    id: 'tg-wood-fire',
    label: '木火通关',
    description: '土泄火木，调和相战',
    conflictWuxings: ['木', '火'],
    tongguanWuxing: '土',
    priority: 90,
  },
];

function assertWuxing(value: string, label: string): asserts value is Wuxing {
  if (!(WUXING as readonly string[]).includes(value)) {
    throw new Error(`${label}五行无效：${value}`);
  }
}

function assertWuxingCounts(wuxingCounts: Record<string, number>): void {
  Object.entries(wuxingCounts).forEach(([wuxing, count]) => {
    assertWuxing(wuxing, '五行统计');
    if (!Number.isFinite(count) || count < 0) {
      throw new Error(`五行统计数值无效：${wuxing}=${count}`);
    }
  });
}

function assertWuxingList(values: string[], label: string): void {
  values.forEach((value) => assertWuxing(value, label));
}

export function detectTongguanNeed(
  wuxingCounts: Record<string, number>,
  favorableWuxing: string[],
  unfavorableWuxing: string[],
): { need: boolean; conflict?: [string, string]; tongguan?: string; rule?: TongguanRule } {
  assertWuxingCounts(wuxingCounts);
  assertWuxingList(favorableWuxing, '喜用');
  assertWuxingList(unfavorableWuxing, '忌用');

  for (const rule of TONGGUAN_RULES) {
    const [w1, w2] = rule.conflictWuxings;
    const favorableHasW1 = favorableWuxing.includes(w1);
    const unfavorableHasW2 = unfavorableWuxing.includes(w2);
    const favorableHasW2 = favorableWuxing.includes(w2);
    const unfavorableHasW1 = unfavorableWuxing.includes(w1);

    const isConflict = (favorableHasW1 && unfavorableHasW2) || (favorableHasW2 && unfavorableHasW1);

    if (isConflict) {
      const w1Count = wuxingCounts[w1] || 0;
      const w2Count = wuxingCounts[w2] || 0;
      const w1Strong = w1Count >= 25;
      const w2Strong = w2Count >= 25;
      const w1Contending = w1Count >= 20;
      const w2Contending = w2Count >= 20;

      if ((w1Strong && w2Contending) || (w2Strong && w1Contending)) {
        return { need: true, conflict: rule.conflictWuxings, tongguan: rule.tongguanWuxing, rule };
      }
    }
  }

  return { need: false };
}

export function detectDiseaseMedicine(
  wuxingCounts: Record<string, number>,
  pattern: PatternAnalysis,
  _strengthStatus: string,
): { hasDisease: boolean; disease?: string; medicine?: string; rule?: DiseaseMedicineRule } {
  assertWuxingCounts(wuxingCounts);

  for (const [wuxing, count] of Object.entries(wuxingCounts)) {
    if (count >= 40) {
      const rule = DISEASE_MEDICINE_RULES.find((r) => r.id === 'disease-over-strong');
      let medicine: string;
      if (wuxing === '土') {
        medicine = pattern.isSpecial ? '顺势化泄' : `木克土为制，金泄土为化（泄秀更佳）`;
      } else {
        medicine = pattern.isSpecial ? '顺势化泄' : getOppositeWuxing(wuxing);
      }
      return { hasDisease: true, disease: `${wuxing}过旺为病`, medicine, rule };
    }
    if (count <= 10) {
      const rule = DISEASE_MEDICINE_RULES.find((r) => r.id === 'disease-over-weak');
      const medicine = getSupportiveWuxing(wuxing);
      return { hasDisease: true, disease: `${wuxing}过弱为病`, medicine, rule };
    }
  }

  const seasonInfo = getSeasonBalance(wuxingCounts);
  if (seasonInfo.imbalance) {
    const rule = DISEASE_MEDICINE_RULES.find((r) =>
      seasonInfo.type === 'cold' ? r.id === 'disease-cold-heat' : r.id === 'disease-dry-wet',
    );
    return {
      hasDisease: true,
      disease: seasonInfo.type === 'cold' ? '过寒为病' : '过燥为病',
      medicine: seasonInfo.medicine,
      rule,
    };
  }

  return { hasDisease: false };
}

function getOppositeWuxing(wuxing: string): string {
  assertWuxing(wuxing, '制化');
  const opposites: Record<Wuxing, string> = {
    木: '金',
    金: '木',
    水: '火',
    火: '水',
    土: '木',
  };
  return opposites[wuxing];
}

export function getDrainWuxing(wuxing: string): string {
  assertWuxing(wuxing, '泄化');
  const drainMap: Record<Wuxing, string> = {
    土: '金',
    火: '土',
    木: '火',
    金: '水',
    水: '木',
  };
  return drainMap[wuxing];
}

function getSupportiveWuxing(wuxing: string): string {
  assertWuxing(wuxing, '生扶');
  const sheng = BASIC_MAPPINGS.WUXING_SHENG;
  const wuxingIndex = Object.values(sheng).indexOf(wuxing);
  if (wuxingIndex >= 0) {
    const keys = Object.keys(sheng);
    const supportiveWuxing = keys[wuxingIndex] || '';
    assertWuxing(supportiveWuxing, '生扶');
    return supportiveWuxing;
  }
  throw new Error(`生扶五行无效：${wuxing}`);
}

function getSeasonBalance(wuxingCounts: Record<string, number>): {
  imbalance: boolean;
  type?: 'cold' | 'hot' | 'dry' | 'wet';
  medicine?: string;
} {
  const water = wuxingCounts['水'] || 0;
  const fire = wuxingCounts['火'] || 0;
  const wood = wuxingCounts['木'] || 0;
  const metal = wuxingCounts['金'] || 0;

  if (water + wood >= 45 && fire + metal <= 20) {
    return { imbalance: true, type: 'cold', medicine: '丙火调候' };
  }

  if (fire + metal >= 45 && water + wood <= 20) {
    return { imbalance: true, type: 'hot', medicine: '癸水润燥' };
  }

  if (fire >= 30 && (wuxingCounts['土'] || 0) >= 30 && water <= 15) {
    return { imbalance: true, type: 'dry', medicine: '水润燥' };
  }

  if (water >= 35 && (wuxingCounts['土'] || 0) <= 15) {
    return { imbalance: true, type: 'wet', medicine: '火暖局' };
  }

  return { imbalance: false };
}
