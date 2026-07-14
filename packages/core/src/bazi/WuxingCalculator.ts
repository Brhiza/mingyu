import { WUXING_STRENGTH_SCORES, HIDDEN_STEMS, WUXING_MONTH_WEIGHTS } from './baziDefinitions';
import { getWuxing as getWuxingUtil } from './baziUtils';
import type { Pillars, WuxingStrengthDetails } from './baziTypes';

/**
 * 专注于五行分布强度计算的工具类
 */
export class WuxingCalculator {
  /**
   * 计算五行分布（高级版）
   * @param pillars - 四柱
   * @param monthCommander - 月令司权天干（可选），当前司令之干额外加权
   * @returns 包含分数、百分比和缺失项的详细对象
   */
  public calculateWuxingStrength(pillars: Pillars, monthCommander?: string): WuxingStrengthDetails {
    const rawStrength = this._calculateRawStrength(pillars);
    const weightedStrength = this._applyMonthWeights(rawStrength, pillars.month.zhi);

    // 月令司权之神额外加权：当前司令之干的五行 +20%
    // 注：此为自定义量化方案，传统命理以司权当旺定性而非定量；
    // +20% 权重仅用于在五行力量接近时打破平局，不存在古籍直接依据。
    if (monthCommander) {
      const commanderWuxing = getWuxingUtil(monthCommander);
      if (commanderWuxing !== '未知' && weightedStrength[commanderWuxing] !== undefined) {
        weightedStrength[commanderWuxing] = Math.round(weightedStrength[commanderWuxing] * 1.2);
      }
    }

    const missingElements = Object.entries(rawStrength)
      .filter(([, score]) => score === 0)
      .map(([wuxing]) => wuxing);
    const present = Object.keys(rawStrength).filter((wuxing) => !missingElements.includes(wuxing));
    const maxStrength = Math.max(...Object.values(weightedStrength));
    const dominantByRule = Object.entries(weightedStrength)
      .filter(([, value]) => value === maxStrength && maxStrength > 0)
      .map(([wuxing]) => wuxing);
    const commanderElement = monthCommander ? getWuxingUtil(monthCommander) : undefined;

    return {
      missing: missingElements,
      present,
      dominantByRule,
      commanderElement: commanderElement === '未知' ? undefined : commanderElement,
      ruleBasis: [
        '天干与地支藏干按项目五行规则计入结构来源',
        '月令旺衰权重用于比较规则输入，不代表概率、吉凶或现实结果',
        monthCommander
          ? '司令天干仅作为项目内部规则加权条件'
          : '未提供司令天干，未应用司令附加条件',
      ],
    };
  }

  private _calculateRawStrength(pillars: Pillars): Record<string, number> {
    const rawStrength: Record<string, number> = { 金: 0, 木: 0, 水: 0, 火: 0, 土: 0 };
    const scores = WUXING_STRENGTH_SCORES;

    for (const pillar of Object.values(pillars)) {
      const ganWuxing = getWuxingUtil(pillar.gan);
      if (ganWuxing !== '未知') {
        rawStrength[ganWuxing] += scores.tianGan;
      }

      const zhiStems = HIDDEN_STEMS[pillar.zhi] || [];
      zhiStems.forEach((stem, index) => {
        const stemWuxing = getWuxingUtil(stem);
        if (stemWuxing !== '未知') {
          if (index === 0) rawStrength[stemWuxing] += scores.diZhiBenQi;
          else if (index === 1) rawStrength[stemWuxing] += scores.diZhiZhongQi;
          else rawStrength[stemWuxing] += scores.diZhiYuQi;
        }
      });
    }
    return rawStrength;
  }

  private _applyMonthWeights(
    rawStrength: Record<string, number>,
    monthBranch: string,
  ): Record<string, number> {
    const weightedStrength: Record<string, number> = { ...rawStrength };
    const currentMonthWeights = WUXING_MONTH_WEIGHTS[monthBranch];
    for (const wuxing in weightedStrength) {
      weightedStrength[wuxing] = Math.round(
        weightedStrength[wuxing] * (currentMonthWeights[wuxing] || 1),
      );
    }
    return weightedStrength;
  }
}
