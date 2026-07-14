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

    const totalStrength = Object.values(weightedStrength).reduce((sum, val) => sum + val, 0);
    const percentages = this._calculatePercentages(weightedStrength, totalStrength);

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
      scores: weightedStrength,
      percentages,
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

  private _calculatePercentages(
    weightedStrength: Record<string, number>,
    totalStrength: number,
  ): Record<string, number> {
    const percentages: Record<string, number> = { 金: 0, 木: 0, 水: 0, 火: 0, 土: 0 };
    if (totalStrength === 0) {
      return percentages;
    }

    // 按比例计算并保留一位小数，避免 Math.round 取整后将误差集中到末项
    let accumulated = 0;
    const keys = Object.keys(weightedStrength);
    const rawPcts: Array<{ key: string; pct: number }> = keys.map((key) => ({
      key,
      pct: Math.round(((weightedStrength[key] || 0) / totalStrength) * 1000) / 10,
    }));
    // 按原始比例降序，末项补差时偏小项承受误差更不明显
    rawPcts.sort((a, b) => b.pct - a.pct);

    for (let i = 0; i < rawPcts.length - 1; i++) {
      const pct = Math.round(rawPcts[i].pct);
      percentages[rawPcts[i].key] = pct;
      accumulated += pct;
    }
    percentages[rawPcts[rawPcts.length - 1].key] = Math.max(0, 100 - accumulated);

    return percentages;
  }
}
