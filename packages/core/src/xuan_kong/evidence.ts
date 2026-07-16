/**
 * 玄空飞星证据层
 */
import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';

export interface XuanKongEvidenceSourceResult {
  period: {
    year: number;
    yuan: string;
    yun: number;
    yunStar: number;
    label: string;
  };
  sitMountain: string;
  facingMountain: string;
  guaType: string;
  replacementApplied: boolean;
  plates: { yun: number[]; shan: number[]; xiang: number[] };
  daoShanXiang: { summary: string };
  measurement?: { stability: string };
}

export interface XuanKongEvidenceAnalysis {
  key: string;
  calculationSteps: Array<{
    key: string;
    stage: string;
    promptText: string;
    sources: string[];
    limitation: string;
  }>;
  facts: Array<{
    key: string;
    type: string;
    promptText: string;
    sources: string[];
    limitation: string;
  }>;
  counterFacts: Array<{
    key: string;
    type: string;
    promptText: string;
    sources: string[];
    limitation: string;
  }>;
  limitationFacts: Array<{
    key: string;
    type: string;
    promptText: string;
    sources: string[];
    limitation: string;
  }>;
  summaryFact: {
    key: string;
    status: string;
    promptText: string;
    sources: string[];
    limitation: string;
  };
  sources: Array<{ title: string; evidence: string; role: '传统规则来源' | '公共算法来源' }>;
  promptText: string;
}

const STEP_LIMIT =
  '计算步骤只证明三元九运、山向、下卦/替卦与三盘飞布如何形成当前盘面，不证明装修效果、财运健康或现实吉凶';
const FACT_LIMIT =
  '飞星事实只记录当运、山向飞布与到山到向结构，不得直接换算为吉凶总分、成功率或唯一布局方案';
const COUNTER_LIMIT = '反证只用于提示测量边界、替卦条件或输入缺省，不等于住宅必然不利';
const LIMIT_LIMIT =
  '限制事实用于约束玄空飞星 v1 的解释范围，不得被反向当作形峦、大卦或装修有效性证据';

export function analyzeXuanKongEvidence(
  result: XuanKongEvidenceSourceResult,
): XuanKongEvidenceAnalysis {
  const calculationSteps = [
    {
      key: 'xuankong:calculation:yun',
      stage: '定运',
      promptText: `建造或起运年 ${result.period.year} 落入${result.period.yuan}${result.period.yun}运，当运星${result.period.yunStar}`,
      sources: ['三元九运公开运表', '玄空飞星通行定运口径'],
      limitation: STEP_LIMIT,
    },
    {
      key: 'xuankong:calculation:mountain',
      stage: '定山向',
      promptText: `坐山${result.sitMountain}，朝向${result.facingMountain}，卦型${result.guaType}${result.replacementApplied ? '（已启用替卦）' : '（下卦）'}`,
      sources: ['二十四山罗盘换算', '下卦/替卦边界规则'],
      limitation: STEP_LIMIT,
    },
    {
      key: 'xuankong:calculation:plates',
      stage: '飞布三盘',
      promptText: `运星${result.period.yunStar}入中生成运盘，再按山向飞布山盘与向盘`,
      sources: ['玄空飞星九宫顺逆飞布规则'],
      limitation: STEP_LIMIT,
    },
  ];

  const facts = [
    {
      key: 'xuankong:fact:dao-shan-xiang',
      type: '到山到向',
      promptText: result.daoShanXiang.summary,
      sources: ['山盘向盘落宫比较'],
      limitation: FACT_LIMIT,
    },
    {
      key: 'xuankong:fact:center',
      type: '中宫组合',
      promptText: `中宫运山向为 ${result.plates.yun[4]}-${result.plates.shan[4]}-${result.plates.xiang[4]}`,
      sources: ['三盘中宫飞星'],
      limitation: FACT_LIMIT,
    },
  ];

  const counterFacts = [];
  if (result.measurement?.stability && result.measurement.stability !== '稳定') {
    counterFacts.push({
      key: 'xuankong:counter:measurement',
      type: '测量边界',
      promptText: `山向测量稳定性为${result.measurement.stability}，应保留候选山向`,
      sources: ['罗盘度数与二十四山边界'],
      limitation: COUNTER_LIMIT,
    });
  }
  if (!result.replacementApplied && result.guaType === '下卦') {
    counterFacts.push({
      key: 'xuankong:counter:no-ti',
      type: '替卦未启用',
      promptText: '当前未命中可核验的兼向过界替卦条件，按一下卦盘处理',
      sources: ['替卦启用边界'],
      limitation: COUNTER_LIMIT,
    });
  }

  const limitationFacts = [
    {
      key: 'xuankong:limitation:scope',
      type: '体系边界',
      promptText:
        '当前仅为玄空飞星 v1：输出运盘、山盘、向盘与到山到向结构，不覆盖形峦、玄空大卦与全流派替卦口诀',
      sources: ['项目玄空飞星 v1 范围声明'],
      limitation: LIMIT_LIMIT,
    },
    {
      key: 'xuankong:limitation:no-score',
      type: '高风险输出边界',
      promptText: '不生成吉凶总分、财运百分比、健康保证或唯一装修方案',
      sources: ['结构化证据限制'],
      limitation: LIMIT_LIMIT,
    },
  ];

  const summaryFact = {
    key: 'xuankong:summary',
    status: counterFacts.length ? '含边界提示' : '结构完整',
    promptText: `${result.period.yuan}${result.period.yun}运，坐${result.sitMountain}向${result.facingMountain}，${result.guaType}；${result.daoShanXiang.summary}`,
    sources: ['定运、山向、三盘飞布与到山到向汇总'],
    limitation: FACT_LIMIT,
  };

  const sources = [
    {
      title: '玄空飞星通行规则',
      evidence: '三元九运、当运入中、山向飞布与下卦替卦边界',
      role: '传统规则来源' as const,
    },
    {
      title: '公共罗盘模块',
      evidence: '二十四山度数与坐向换算',
      role: '公共算法来源' as const,
    },
  ];

  const evidenceItems: PromptEvidenceItem[] = [
    ...calculationSteps.map((item) => ({
      level: '主证' as const,
      title: item.stage,
      detail: item.promptText,
      source: item.sources.join('、'),
    })),
    ...facts.map((item) => ({
      level: '主证' as const,
      title: item.type,
      detail: item.promptText,
      source: item.sources.join('、'),
    })),
    ...counterFacts.map((item) => ({
      level: '反证' as const,
      title: item.type,
      detail: item.promptText,
      source: item.sources.join('、'),
    })),
    ...limitationFacts.map((item) => ({
      level: '限制' as const,
      title: item.type,
      detail: item.promptText,
      source: item.sources.join('、'),
    })),
  ];

  const bundle: PromptEvidenceBundle = {
    title: '玄空飞星证据',
    items: evidenceItems,
  };

  return {
    key: 'xuankong:evidence',
    calculationSteps,
    facts,
    counterFacts,
    limitationFacts,
    summaryFact,
    sources,
    promptText: formatPromptEvidenceBundle(bundle).join('\n'),
  };
}
