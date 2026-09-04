import type { Pillars } from './baziTypes';
import { getWuxing } from './baziUtils';
import { HIDDEN_STEMS } from './baziDefinitions';

export interface BaziClimateBalanceResult {
  nature: '寒局' | '燥局' | '中和' | '微偏寒' | '微偏燥';
  medicine: string;
  summary: string;
}

/**
 * 依据《穷通宝鉴》《滴天髓》“天道有寒暖，地道有燥湿”的调候失衡与药神判定算法
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
        medicine: '急需丙丁火暖局解冻',
        summary: '三冬水冷金寒，全局火气虚绝，急需丙丁火暖局解冻照拂',
      };
    }
    if (fireCount >= 2.5) {
      return {
        nature: '中和',
        medicine: '冬阳暖局，气象和顺',
        summary: '生于冬月而原局火气温润，冬阳照暖，寒暖得宜',
      };
    }
    return {
      nature: '微偏寒',
      medicine: '喜火向荣',
      summary: '冬月寒气仍盛，原局微带火意，行运仍喜木火温煦',
    };
  }

  // 夏月（巳、午、未）
  if (['巳', '午', '未'].includes(monthZhi)) {
    if (waterCount <= 0.5) {
      return {
        nature: '燥局',
        medicine: '急需壬癸水润泽生津',
        summary: '三夏火炎土燥，全局水气枯竭，急需壬癸水润燥解渴',
      };
    }
    if (waterCount >= 2.5) {
      return {
        nature: '中和',
        medicine: '清凉润泽，气象中和',
        summary: '生于夏月而原局甘霖得济，火烈得制，寒暖燥湿适中',
      };
    }
    return {
      nature: '微偏燥',
      medicine: '喜水润泽',
      summary: '夏月炎炎，原局水气尚薄，行运喜金水清润',
    };
  }

  // 春秋平月（寅卯辰、申酉戌）
  if (waterCount >= 4.0 && fireCount <= 1.0) {
    return {
      nature: '寒局',
      medicine: '喜火照暖',
      summary: '全局水势浩荡而火气羸弱，局势湿寒，喜木火宣泄温煦',
    };
  }
  if (fireCount >= 4.0 && waterCount <= 1.0) {
    return {
      nature: '燥局',
      medicine: '喜水清润',
      summary: '全局火势焦炎而水气无存，局势偏燥，喜金水调剂润泽',
    };
  }

  return {
    nature: '中和',
    medicine: '气序中和',
    summary: '局中寒暖燥湿相对调和，五行运化顺畅',
  };
}
