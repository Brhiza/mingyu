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
    id: 'disease-over-strong',
    label: '身强泄化',
    description: '普通格局已判身强时，以日主所生五行作为泄化候选',
    diseasePatterns: ['身强', '偏强', '极强'],
    medicinePatterns: ['食伤泄秀'],
    priority: 90,
  },
  {
    id: 'disease-over-weak',
    label: '身弱生扶',
    description: '普通格局已判身弱时，以生日主五行作为生扶候选',
    diseasePatterns: ['身弱', '偏弱', '极弱'],
    medicinePatterns: ['印星生扶', '比劫助身'],
    priority: 90,
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
    description: '水生木、木生火，以木承接水火',
    conflictWuxings: ['水', '火'],
    tongguanWuxing: '木',
    priority: 100,
  },
  {
    id: 'tg-wood-metal',
    label: '木金通关',
    description: '金生水、水生木，以水承接金木',
    conflictWuxings: ['木', '金'],
    tongguanWuxing: '水',
    priority: 100,
  },
  {
    id: 'tg-wood-earth',
    label: '木土通关',
    description: '木生火、火生土，以火承接木土',
    conflictWuxings: ['木', '土'],
    tongguanWuxing: '火',
    priority: 100,
  },
  {
    id: 'tg-earth-water',
    label: '土水通关',
    description: '土生金、金生水，以金承接土水',
    conflictWuxings: ['土', '水'],
    tongguanWuxing: '金',
    priority: 100,
  },
  {
    id: 'tg-metal-fire',
    label: '金火通关',
    description: '火生土、土生金，以土承接火金',
    conflictWuxings: ['金', '火'],
    tongguanWuxing: '土',
    priority: 100,
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
): {
  /** 是否存在需要进一步核验的通关候选，并非已确认两旺相战。 */
  need: boolean;
  status: '候选' | '未见候选';
  conflict?: [string, string];
  tongguan?: string;
  rule?: TongguanRule;
  conditions?: string;
} {
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
      // 出现次数只用于核实两端存在，不用于替代月令、通根和作用力量。
      if (w1Count > 0 && w2Count > 0) {
        return {
          need: true,
          status: '候选',
          conflict: rule.conflictWuxings,
          tongguan: rule.tongguanWuxing,
          rule,
          conditions: `核对${w1}与${w2}的月令、根气及位置是否形成实际相克，再核${rule.tongguanWuxing}能否承接两端及是否符合全局取用`,
        };
      }
    }
  }

  return { need: false, status: '未见候选' };
}

/**
 * 普通格局扶抑病药候选。旺衰来自完整原局判断，次数仅保留为输入事实。
 * 指明日主五行后才可对应生扶、泄化；寒暖燥湿由气候分析单独判断。
 */
export function detectDiseaseMedicine(
  wuxingCounts: Record<string, number>,
  pattern: PatternAnalysis,
  strengthStatus: string,
  dayMasterWuxing?: string,
): {
  hasDisease: boolean;
  status: '候选' | '资料不足' | '不适用';
  disease?: string;
  medicine?: string;
  rule?: DiseaseMedicineRule;
  conditions: string;
} {
  assertWuxingCounts(wuxingCounts);
  if (dayMasterWuxing !== undefined) assertWuxing(dayMasterWuxing, '日主');
  if (pattern.isSpecial) {
    return {
      hasDisease: false,
      status: '不适用',
      conditions: '特殊格局按成格条件及顺从之势取用',
    };
  }
  if (strengthStatus === '中和') {
    return {
      hasDisease: false,
      status: '不适用',
      conditions: '中和命局继续结合格局制化及寒暖燥湿取用',
    };
  }
  const rule = DISEASE_MEDICINE_RULES.find((item) => item.diseasePatterns.includes(strengthStatus));
  if (!dayMasterWuxing || !rule) {
    return {
      hasDisease: false,
      status: '资料不足',
      conditions: '需明确日主五行及结合月令、根气、制化判断的旺衰状态',
    };
  }
  const strong = rule.id === 'disease-over-strong';
  const medicine = strong ? getDrainWuxing(dayMasterWuxing) : getSupportiveWuxing(dayMasterWuxing);
  return {
    hasDisease: true,
    status: '候选',
    disease: `${dayMasterWuxing}日主${strengthStatus}`,
    medicine,
    rule,
    conditions: strong
      ? `核对${medicine}食伤是否有根承泄、是否影响官杀及格局制化，再与财官取用比较`
      : `核对${medicine}印星的根气和受财克制情况，并与${dayMasterWuxing}比劫配合扶身`,
  };
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
