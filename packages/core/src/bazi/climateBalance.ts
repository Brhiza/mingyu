import type { Pillars } from './baziTypes';
import { getWuxing } from './baziUtils';
import { HIDDEN_STEMS } from './baziDefinitions';

export interface BaziClimateBalanceResult {
  /** 四柱水火分布的启发式方向，不代表完整命局或调候结论。 */
  nature: '偏寒' | '偏燥' | '未见明显偏向' | '微偏寒' | '微偏燥';
  /** 值仍供旧消费方读取；仅是待核的作用方向，不是已确定的药神。 */
  medicine: string;
  summary: string;
}

/**
 * 四柱水火分布的寒暖燥湿辅助指标。
 * 范围说明：本函数仅统计四柱水火分布的寒暖燥湿指标，不计算日主取用、合化、
 * 制化与药神有效性；完整调候取用见 baziTherapeuticStrategy 的细分规则，两者结论范围不同。
 */
export function evaluateBaziClimateBalance(pillars: Pillars): BaziClimateBalanceResult {
  const monthZhi = pillars.month.zhi;

  // 统计水、火五行在四柱天干地支（本气与藏干）的分布
  let fireCount = 0;
  let waterCount = 0;

  for (const pillar of Object.values(pillars)) {
    if (getWuxing(pillar.gan) === '火') fireCount += 1.5;
    if (getWuxing(pillar.gan) === '水') waterCount += 1.5;

    const hidden = (HIDDEN_STEMS[pillar.zhi] || []) as string[];
    hidden.forEach((stem: string, idx: number) => {
      const stemWx = getWuxing(stem);
      const weight = idx === 0 ? 1.0 : 0.5;
      if (stemWx === '火') fireCount += weight;
      if (stemWx === '水') waterCount += weight;
    });
  }

  // 冬月（亥、子、丑）
  if (['亥', '子', '丑'].includes(monthZhi)) {
    if (fireCount <= 0.5) {
      return {
        nature: '偏寒',
        medicine: '可核对照暖作用',
        summary: '生于冬月，透干及藏干中的火气分布稀少，可作为核对寒暖的线索',
      };
    }
    if (fireCount >= 2.5) {
      return {
        nature: '未见明显偏向',
        medicine: '核对已有温暖作用',
        summary: '生于冬月，原局已见较多火气分布，需结合火的根气与制化核对实际暖局作用',
      };
    }
    return {
      nature: '微偏寒',
      medicine: '可核对温暖作用',
      summary: '生于冬月，原局见少量火气分布，可作为核对寒暖的线索',
    };
  }

  // 夏月（巳、午、未）
  if (['巳', '午', '未'].includes(monthZhi)) {
    if (waterCount <= 0.5) {
      return {
        nature: '偏燥',
        medicine: '可核对润燥作用',
        summary: '生于夏月，透干及藏干中的水气分布稀少，可作为核对润燥的线索',
      };
    }
    if (waterCount >= 2.5) {
      return {
        nature: '未见明显偏向',
        medicine: '核对已有润燥作用',
        summary: '生于夏月，原局已见较多水气分布，需结合水的根气与制化核对实际润燥作用',
      };
    }
    return {
      nature: '微偏燥',
      medicine: '可核对润燥作用',
      summary: '生于夏月，原局见少量水气分布，可作为核对润燥的线索',
    };
  }

  // 春秋平月（寅卯辰、申酉戌）
  if (waterCount >= 4.0 && fireCount <= 1.0) {
    return {
      nature: '偏寒',
      medicine: '可核对照暖作用',
      summary: '原局水气分布多、火气分布少，可作为核对寒暖的线索',
    };
  }
  if (fireCount >= 4.0 && waterCount <= 1.0) {
    return {
      nature: '偏燥',
      medicine: '可核对润燥作用',
      summary: '原局火气分布多、水气分布少，可作为核对润燥的线索',
    };
  }

  return {
    nature: '未见明显偏向',
    medicine: '结合日干月令核对调候条件',
    summary: '按四柱水火分布统计未触发单项阈值，完整调候仍需结合日主与月令细分规则另核',
  };
}
