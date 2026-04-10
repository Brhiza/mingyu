import {
  WUXING_STRENGTH_SCORES,
  HIDDEN_STEMS,
  WUXING_MONTH_WEIGHTS
} from './baziDefinitions'
import { getWuxing as getWuxingUtil } from './baziUtils'
import type { Pillars, WuxingStrengthDetails } from './baziTypes'

/**
 * 专注于五行分布强度计算的工具类
 */
export class WuxingCalculator {
  /**
   * 计算五行分布（高级版）
   * @param pillars - 四柱
   * @returns 包含分数、百分比和缺失项的详细对象
   */
  public calculateWuxingStrength(pillars: Pillars): WuxingStrengthDetails {
    const rawStrength = this._calculateRawStrength(pillars)
    const weightedStrength = this._applyMonthWeights(rawStrength, pillars.month.zhi)

    const totalStrength = Object.values(weightedStrength).reduce((sum, val) => sum + val, 0)
    const percentages = this._calculatePercentages(weightedStrength, totalStrength)

    const missingElements = Object.entries(rawStrength)
      .filter(([, score]) => score === 0)
      .map(([wuxing]) => wuxing)

    return {
      scores: weightedStrength,
      percentages,
      missing: missingElements
    }
  }

  private _calculateRawStrength(pillars: Pillars): Record<string, number> {
    const rawStrength: Record<string, number> = { '金': 0, '木': 0, '水': 0, '火': 0, '土': 0 }
    const scores = WUXING_STRENGTH_SCORES

    for (const pillar of Object.values(pillars)) {
      const ganWuxing = getWuxingUtil(pillar.gan)
      if (ganWuxing !== '未知') {
        rawStrength[ganWuxing] += scores.tianGan
      }

      const zhiStems = HIDDEN_STEMS[pillar.zhi] || []
      zhiStems.forEach((stem, index) => {
        const stemWuxing = getWuxingUtil(stem)
        if (stemWuxing !== '未知') {
          if (index === 0) rawStrength[stemWuxing] += scores.diZhiBenQi
          else if (index === 1) rawStrength[stemWuxing] += scores.diZhiZhongQi
          else rawStrength[stemWuxing] += scores.diZhiYuQi
        }
      })
    }
    return rawStrength
  }

  private _applyMonthWeights(rawStrength: Record<string, number>, monthBranch: string): Record<string, number> {
    const weightedStrength: Record<string, number> = { ...rawStrength }
    const currentMonthWeights = WUXING_MONTH_WEIGHTS[monthBranch]
    for (const wuxing in weightedStrength) {
      weightedStrength[wuxing] = Math.round(weightedStrength[wuxing] * (currentMonthWeights[wuxing] || 1))
    }
    return weightedStrength
  }

  private _calculatePercentages(weightedStrength: Record<string, number>, totalStrength: number): Record<string, number> {
    const percentages: Record<string, number> = { '金': 0, '木': 0, '水': 0, '火': 0, '土': 0 }
    if (totalStrength === 0) {
      return percentages
    }

    const wuxingKeys = Object.keys(weightedStrength)
    let accumulatedPercentage = 0

    // Calculate and round for the first N-1 elements
    for (let i = 0; i < wuxingKeys.length - 1; i++) {
      const wuxing = wuxingKeys[i]
      const percentage = Math.round((weightedStrength[wuxing] / totalStrength) * 100)
      percentages[wuxing] = percentage
      accumulatedPercentage += percentage
    }

    // Assign the remainder to the last element to ensure the total is 100
    const lastWuxing = wuxingKeys[wuxingKeys.length - 1]
    percentages[lastWuxing] = 100 - accumulatedPercentage

    return percentages
  }
}
