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
  plates: { yun: number[]; shan: number[]; xiang: number[] };
  formation: string;
  combinations: Array<{ name: string; kind: string; palaces?: number[]; note: string }>;
  engine: { name: string; version: string; mode: string };
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

const STEP_LIMIT = '计算步骤记录三元九运、山向与下卦三盘飞布如何形成当前盘面';
const FACT_LIMIT = '飞星事实记录当运、山向飞布与到山到向结构';
const COUNTER_LIMIT = '反证用于提示测量边界和输入限制';
const LIMIT_LIMIT = '限制事实用于界定玄空飞星 v1 的输出范围';

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
      promptText: `坐山${result.sitMountain}，朝向${result.facingMountain}，采用下卦`,
      sources: ['二十四山罗盘换算', '下卦中央九度边界规则'],
      limitation: STEP_LIMIT,
    },
    {
      key: 'xuankong:calculation:plates',
      stage: '飞布三盘',
      promptText: `运星${result.period.yunStar}顺飞生成运盘；山向盘按入中星本宫同元龙山阴阳定顺逆，五黄入中时借原山阴阳`,
      sources: [
        `${result.engine.name}@${result.engine.version} 下卦引擎`,
        '玄空飞星元龙阴阳顺逆规则',
      ],
      limitation: STEP_LIMIT,
    },
  ];

  const facts = [
    {
      key: 'xuankong:fact:formation',
      type: '局型',
      promptText: result.formation,
      sources: ['山向宫当运山星、向星落点比较'],
      limitation: FACT_LIMIT,
    },
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
  for (const combination of result.combinations) {
    facts.push({
      key: `xuankong:fact:combination:${combination.name}`,
      type: '组合互参',
      promptText: `${combination.name}${combination.palaces?.length ? `（宫位 ${combination.palaces.join('、')}）` : ''}：${combination.note}`,
      sources: [`${result.engine.name}@${result.engine.version} 组合检测`],
      limitation: FACT_LIMIT,
    });
  }

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

  const limitationFacts = [
    {
      key: 'xuankong:limitation:scope',
      type: '体系边界',
      promptText: '当前输出下卦运盘、山盘、向盘、局型与已登记组合',
      sources: ['项目玄空飞星范围声明'],
      limitation: LIMIT_LIMIT,
    },
    {
      key: 'xuankong:limitation:no-score',
      type: '高风险输出边界',
      promptText: '输出范围限为盘面与组合',
      sources: ['结构化证据限制'],
      limitation: LIMIT_LIMIT,
    },
  ];

  const summaryFact = {
    key: 'xuankong:summary',
    status: counterFacts.length ? '含边界提示' : '结构完整',
    promptText: `${result.period.yuan}${result.period.yun}运，坐${result.sitMountain}向${result.facingMountain}，${result.formation}；${result.daoShanXiang.summary}`,
    sources: ['定运、山向、三盘飞布与到山到向汇总'],
    limitation: FACT_LIMIT,
  };

  const sources = [
    {
      title: '玄空飞星通行规则',
      evidence: '三元九运、运盘顺飞、元龙阴阳定山向盘顺逆与下卦边界',
      role: '传统规则来源' as const,
    },
    {
      title: '@soul-atelier/xuankong 0.2.1',
      evidence: '下卦三盘、局型与组合检测，包含公开金标盘回归测试',
      role: '公共算法来源' as const,
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
