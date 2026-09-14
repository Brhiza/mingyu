import type { Pillars } from './baziTypes';
import { getWuxing } from './baziUtils';
import { HIDDEN_STEMS } from './baziDefinitions';

export interface BaziClimateBalanceResult {
  nature: '寒局' | '燥局' | '中和' | '微偏寒' | '微偏燥';
  /** 寒暖指标对应的候选作用方向；具体干与适用条件由取用决策给出。 */
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
        nature: '寒局',
        medicine: '照暖与解冻',
        summary: '生于冬月，透干及藏干中的火气分布稀少，寒暖指标偏寒',
      };
    }
    if (fireCount >= 2.5) {
      return {
        nature: '中和',
        medicine: '核对已有温暖作用',
        summary: '生于冬月，原局已见较多火气分布，需结合火的根气与制化核对暖局作用',
      };
    }
    return {
      nature: '微偏寒',
      medicine: '温暖作用',
      summary: '生于冬月，原局见少量火气分布，寒暖指标微偏寒',
    };
  }

  // 夏月（巳、午、未）
  if (['巳', '午', '未'].includes(monthZhi)) {
    if (waterCount <= 0.5) {
      return {
        nature: '燥局',
        medicine: '润燥作用',
        summary: '生于夏月，透干及藏干中的水气分布稀少，寒暖燥湿指标偏燥',
      };
    }
    if (waterCount >= 2.5) {
      return {
        nature: '中和',
        medicine: '核对已有润燥作用',
        summary: '生于夏月，原局已见较多水气分布，需结合水的根气与制化核对润燥作用',
      };
    }
    return {
      nature: '微偏燥',
      medicine: '润燥作用',
      summary: '生于夏月，原局见少量水气分布，寒暖燥湿指标微偏燥',
    };
  }

  // 春秋平月（寅卯辰、申酉戌）
  if (waterCount >= 4.0 && fireCount <= 1.0) {
    return {
      nature: '寒局',
      medicine: '照暖作用',
      summary: '原局水气分布多、火气分布少，寒暖指标偏寒',
    };
  }
  if (fireCount >= 4.0 && waterCount <= 1.0) {
    return {
      nature: '燥局',
      medicine: '润燥作用',
      summary: '原局火气分布多、水气分布少，寒暖燥湿指标偏燥',
    };
  }

  return {
    nature: '中和',
    medicine: '气序中和',
    summary:
      '按水火分布统计，寒暖燥湿指标未见明显失衡；此为寒暖单项指标，完整调候仍需结合日主与月令细分规则另核',
  };
}
