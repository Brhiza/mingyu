/**
 * 神煞系统扩充：桃花详解与限运分析。
 */

import type { PatternAnalysis } from '../baziTypes';

interface PeachBlossomDetail {
  type: '墙内桃花' | '墙外桃花' | '普通桃花';
  position: string;
  description: string;
  favorable: string;
  unfavorable: string;
}

const PEACH_BLOSSOM_DETAILS: Record<string, PeachBlossomDetail> = {
  墙内桃花: {
    type: '墙内桃花',
    position: '年柱、月柱',
    description: '年、月支桃花取园中之花之象。',
    favorable: '可参考为关系表达较顺、情感存在感较强',
    unfavorable: '再逢刑冲合害或桃花叠见时，传统取象涉及异性干扰或情绪牵扯',
  },
  墙外桃花: {
    type: '墙外桃花',
    position: '时柱',
    description: '时支桃花取墙外之花之象。',
    favorable: '可参考为社交魅力、公众吸引力或外缘较活跃',
    unfavorable: '再遇冲合失衡、桃花混杂或岁运引动时，传统取象涉及口舌是非与关系反复',
  },
  普通桃花: {
    type: '普通桃花',
    position: '日支（夫妻宫）',
    description: '日支桃花位于夫妻宫。',
    favorable: '可参考为存在一定的人缘或审美表达',
    unfavorable: '传统取象仍需由全盘主线和岁运共同确认',
  },
};

export function getPeachBlossomDetail(
  pillarPosition: 'year' | 'month' | 'day' | 'hour',
): PeachBlossomDetail {
  if (pillarPosition === 'year' || pillarPosition === 'month') {
    return { ...PEACH_BLOSSOM_DETAILS['墙内桃花'] };
  } else if (pillarPosition === 'hour') {
    return { ...PEACH_BLOSSOM_DETAILS['墙外桃花'] };
  }
  return { ...PEACH_BLOSSOM_DETAILS['普通桃花'] };
}

export interface PeriodAnalysis {
  earlyStage: {
    description: string;
    focus: string[];
    tips: string[];
  };
  midStage: {
    description: string;
    focus: string[];
    tips: string[];
  };
  lateStage: {
    description: string;
    focus: string[];
    tips: string[];
  };
}

export function generatePeriodAnalysis(
  pattern: PatternAnalysis,
  strengthStatus: string,
  _dayStem: string,
): PeriodAnalysis {
  const baseTips = pattern.isSpecial
    ? ['顺势而行', '化敌为友']
    : strengthStatus.includes('强')
      ? ['抑制过旺', '泄秀为用']
      : ['扶助过弱', '生身为用'];

  return {
    earlyStage: {
      description: '少年时期，多受父母、长辈影响，性格形成阶段。',
      focus: ['学业发展', '性格培养', '身体健康'],
      tips: ['打好学习基础', '培养良好习惯', '注意安全'],
    },
    midStage: {
      description: '青中年时期，是人生事业、感情发展的关键阶段。',
      focus: ['事业发展', '感情婚姻', '财富积累'],
      tips: [...baseTips, '把握机遇', '稳健发展'],
    },
    lateStage: {
      description: '中老年时期，注重健康养生、子女发展。',
      focus: ['身体健康', '子女缘分', '晚年规划'],
      tips: ['注重养生', '家庭和睦', '传承家风'],
    },
  };
}
