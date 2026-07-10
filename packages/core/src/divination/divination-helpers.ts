/**
 * 占卜通用辅助函数
 * 提供各种占卜功能的通用工具方法
 */

import type { MeihuaData } from '../types/divination';
import { isKe, isSheng } from '../ganzhi';
import { WUXING } from '../wuxing';

const WUXING_ELEMENTS = new Set<string>(WUXING);

function assertWuxing(value: string, label: string): void {
  if (!WUXING_ELEMENTS.has(value)) {
    throw new Error(`${label}五行无效：${value}`);
  }
}

/**
 * 梅花易数专用工具函数
 */
export const MeihuaHelpers = {
  getSeasonByJieQi(jieQi: string): '春' | '夏' | '秋' | '冬' | '未知' {
    const seasonByJieQi: Record<string, '春' | '夏' | '秋' | '冬'> = {
      立春: '春',
      雨水: '春',
      惊蛰: '春',
      春分: '春',
      清明: '春',
      谷雨: '春',
      立夏: '夏',
      小满: '夏',
      芒种: '夏',
      夏至: '夏',
      小暑: '夏',
      大暑: '夏',
      立秋: '秋',
      处暑: '秋',
      白露: '秋',
      秋分: '秋',
      寒露: '秋',
      霜降: '秋',
      立冬: '冬',
      小雪: '冬',
      大雪: '冬',
      冬至: '冬',
      小寒: '冬',
      大寒: '冬',
    };

    return seasonByJieQi[jieQi] || '未知';
  },

  getSeasonByMonth(monthNumber: number): '春' | '夏' | '秋' | '冬' {
    if (!Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
      throw new Error(`月份必须是 1-12 之间的整数，当前为 ${monthNumber}。`);
    }
    if (monthNumber >= 1 && monthNumber <= 3) return '春';
    if (monthNumber >= 4 && monthNumber <= 6) return '夏';
    if (monthNumber >= 7 && monthNumber <= 9) return '秋';
    return '冬';
  },

  getElementSeasonState(
    element: string,
    season: '春' | '夏' | '秋' | '冬',
  ): '旺' | '相' | '休' | '囚' | '死' | '未知' {
    assertWuxing(element, '目标');
    const seasonStates: Record<
      '春' | '夏' | '秋' | '冬',
      Record<string, '旺' | '相' | '休' | '囚' | '死'>
    > = {
      春: { 木: '旺', 火: '相', 水: '休', 金: '囚', 土: '死' },
      夏: { 火: '旺', 土: '相', 木: '休', 水: '囚', 金: '死' },
      秋: { 金: '旺', 水: '相', 土: '休', 火: '囚', 木: '死' },
      冬: { 水: '旺', 木: '相', 金: '休', 土: '囚', 火: '死' },
    };

    const state = seasonStates[season]?.[element];
    if (!state) {
      throw new Error(`无法判断${season}季${element}的旺衰。`);
    }
    return state;
  },

  /**
   * 分析梅花易数卦象特征
   */
  analyzeMeihuaHexagram(data: MeihuaData) {
    const movingYao = data.yaosDetail?.find((yao) => yao.isChanging);

    return {
      hasMovingYao: !!movingYao,
      movingYaoPosition: movingYao?.position || 0,
      upperTrigramElement: data.mainHexagram?.upper || '',
      lowerTrigramElement: data.mainHexagram?.lower || '',
      elementRelation: this.getElementRelation(
        data.yongGua?.element || '',
        data.tiGua?.element || '',
      ),
    };
  },

  /**
   * 生成梅花易数解读要点
   */
  generateMeihuaInterpretationPoints(data: MeihuaData): string[] {
    const points: string[] = [];

    // 基本卦象信息
    points.push(`主卦：${data.originalName}`);
    points.push(`变卦：${data.changedName}`);

    if (data.interName) {
      points.push(`互卦：${data.interName}`);
    }

    // 八卦分析
    if (data.mainHexagram?.upper && data.mainHexagram?.lower) {
      points.push(`上卦${data.mainHexagram.upper}，下卦${data.mainHexagram.lower}`);
      points.push(
        `体卦${data.tiGua.name}（${data.tiGua.element}），用卦${data.yongGua.name}（${data.yongGua.element}）`,
      );
    }

    // 动爻分析
    if (data.movingYao) {
      points.push(`${data.movingYao.description}`);
    }

    // 五行关系
    const analysis = this.analyzeMeihuaHexagram(data);
    if (analysis.elementRelation) {
      points.push(`五行关系：${analysis.elementRelation}`);
    }

    return points;
  },

  /**
   * 获取五行相生相克关系
   */
  getElementRelation(yong: string, ti: string): string {
    assertWuxing(yong, '用卦');
    assertWuxing(ti, '体卦');
    if (yong === ti) {
      return '体用比和';
    }
    if (isSheng(yong, ti)) {
      return '用生体';
    }
    if (isSheng(ti, yong)) {
      return '体生用';
    }
    if (isKe(yong, ti)) {
      return '用克体';
    }
    if (isKe(ti, yong)) {
      return '体克用';
    }
    throw new Error(`无法判断用卦${yong}与体卦${ti}的五行关系。`);
  },
};
