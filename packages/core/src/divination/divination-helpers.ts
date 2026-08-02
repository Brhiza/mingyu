/**
 * 占卜通用辅助函数
 * 提供各种占卜功能的通用工具方法
 */

import type { MeihuaData } from '../types/divination';
import { rebuildAuditedMeihuaData } from './algorithms/meihua';
import {
  getMeihuaElementRelation,
  getMeihuaElementSeasonState,
  getMeihuaSeasonByJieQi,
  getMeihuaSeasonByMonth,
} from './algorithms/meihua/helpers/analysis';

function analyzeRebuiltMeihuaHexagram(data: MeihuaData) {
  const movingYao = data.yaosDetail.find((yao) => yao.isChanging);

  return {
    hasMovingYao: !!movingYao,
    movingYaoPosition: movingYao?.position || 0,
    upperTrigramElement: data.mainHexagram.upper,
    lowerTrigramElement: data.mainHexagram.lower,
    elementRelation: getMeihuaElementRelation(data.yongGua.element, data.tiGua.element),
  };
}

/**
 * 梅花易数专用工具函数
 */
export const MeihuaHelpers = {
  getSeasonByJieQi(jieQi: string): '春' | '夏' | '秋' | '冬' {
    return getMeihuaSeasonByJieQi(jieQi);
  },

  getSeasonByMonth(monthNumber: number): '春' | '夏' | '秋' | '冬' {
    return getMeihuaSeasonByMonth(monthNumber);
  },

  getElementSeasonState(
    element: string,
    season: '春' | '夏' | '秋' | '冬',
  ): '旺' | '相' | '休' | '囚' | '死' | '未知' {
    return getMeihuaElementSeasonState(element, season);
  },

  /**
   * 分析梅花易数卦象特征
   */
  analyzeMeihuaHexagram(data: MeihuaData) {
    return analyzeRebuiltMeihuaHexagram(rebuildAuditedMeihuaData(data));
  },

  /**
   * 生成梅花易数解读要点
   */
  generateMeihuaInterpretationPoints(data: MeihuaData): string[] {
    const rebuilt = rebuildAuditedMeihuaData(data);
    const points: string[] = [];

    // 基本卦象信息
    points.push(`主卦：${rebuilt.originalName}`);
    points.push(`变卦：${rebuilt.changedName}`);

    if (rebuilt.interName) {
      points.push(`互卦：${rebuilt.interName}`);
    }

    // 八卦分析
    if (rebuilt.mainHexagram.upper && rebuilt.mainHexagram.lower) {
      points.push(`上卦${rebuilt.mainHexagram.upper}，下卦${rebuilt.mainHexagram.lower}`);
      points.push(
        `体卦${rebuilt.tiGua.name}（${rebuilt.tiGua.element}），用卦${rebuilt.yongGua.name}（${rebuilt.yongGua.element}）`,
      );
    }

    // 动爻分析
    points.push(rebuilt.movingYao.description);

    // 五行关系
    const analysis = analyzeRebuiltMeihuaHexagram(rebuilt);
    if (analysis.elementRelation) {
      points.push(`五行关系：${analysis.elementRelation}`);
    }

    return points;
  },

  /**
   * 获取五行相生相克关系
   */
  getElementRelation(yong: string, ti: string): string {
    return getMeihuaElementRelation(yong, ti);
  },
};
