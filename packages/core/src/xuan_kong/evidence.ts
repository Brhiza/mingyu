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
  formation: string;
  combinations: Array<{ name: string; kind: string; palaces?: number[]; note: string }>;
  engine: { name: string; version: string; mode: string };
  replacement?: {
    mountain: {
      originalCenterStar: number;
      referenceMountain: string;
      replacementStar: number;
      direction: string;
    };
    facing: {
      originalCenterStar: number;
      referenceMountain: string;
      replacementStar: number;
      direction: string;
    };
    rule: string;
    sourceUrl: string;
  };
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
  '计算步骤只证明三元九运、山向、下卦或替卦与三盘飞布如何形成当前盘面，不证明装修效果、财运健康或现实吉凶';
const FACT_LIMIT =
  '飞星事实只记录当运、山向飞布与到山到向结构，不得直接换算为吉凶总分、成功率或唯一布局方案';
const COUNTER_LIMIT = '反证只用于提示测量边界和输入限制，不等于住宅必然不利';
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
      promptText: `坐山${result.sitMountain}，朝向${result.facingMountain}，采用${result.guaType}`,
      sources: ['二十四山罗盘换算', '下卦中央九度与兼向替卦边界规则'],
      limitation: STEP_LIMIT,
    },
    {
      key: 'xuankong:calculation:plates',
      stage: '飞布三盘',
      promptText: result.replacement
        ? `运星${result.period.yunStar}顺飞生成运盘；山盘原${result.replacement.mountain.originalCenterStar}入中，取${result.replacement.mountain.referenceMountain}山替为${result.replacement.mountain.replacementStar}${result.replacement.mountain.direction}；向盘原${result.replacement.facing.originalCenterStar}入中，取${result.replacement.facing.referenceMountain}山替为${result.replacement.facing.replacementStar}${result.replacement.facing.direction}`
        : `运星${result.period.yunStar}顺飞生成运盘；山向盘按入中星本宫同元龙山阴阳定顺逆，五黄入中时借原山阴阳`,
      sources: result.replacement
        ? [result.replacement.sourceUrl, '二十四山替星表与元龙阴阳顺逆规则']
        : [`${result.engine.name}@${result.engine.version} 下卦引擎`, '玄空飞星元龙阴阳顺逆规则'],
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
      promptText:
        result.formation === '替卦未成四正局'
          ? '当前替卦三盘未形成旺山旺向、上山下水、双星到向或双星到坐，组合检测已保守跳过；不覆盖形峦、玄空大卦或不同门派的其他替卦口诀'
          : '当前输出下卦及兼向替卦的运盘、山盘、向盘、局型与已登记组合；不覆盖形峦、玄空大卦或不同门派的其他替卦口诀',
      sources: ['项目玄空飞星范围声明'],
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
    promptText: `${result.period.yuan}${result.period.yun}运，坐${result.sitMountain}向${result.facingMountain}，${result.guaType}，${result.formation}；${result.daoShanXiang.summary}`,
    sources: ['定运、山向、三盘飞布与到山到向汇总'],
    limitation: FACT_LIMIT,
  };

  const sources = [
    {
      title: '玄空飞星通行规则',
      evidence: '三元九运、运盘顺飞、元龙阴阳定山向盘顺逆、下卦边界与兼向替星表',
      role: '传统规则来源' as const,
    },
    {
      title: '@soul-atelier/xuankong 0.2.1',
      evidence: '下卦三盘、局型与组合检测，包含公开金标盘回归测试',
      role: '公共算法来源' as const,
    },
    {
      title: 'funfwo/Fengshui 固定提交',
      evidence: '固定提交 bd7d85e 的 getJianshanxiangpan：同元龙取本宫山、查替星并沿用原山阴阳顺逆',
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
