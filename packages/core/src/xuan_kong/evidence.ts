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
    verificationSourceUrl: string;
  };
  daoShanXiang: { summary: string };
  measurement?: {
    stability: string;
    guaTypeStability?: string;
    possibleCenterOffsetRangeDegrees?: { minimum: number; maximum: number };
  };
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
      sources: [
        '二十四山罗盘换算',
        '两份固定公开实现的共同区间；偏离山中心 3° 至 4.5° 的分歧区不自动判卦',
      ],
      limitation: STEP_LIMIT,
    },
    {
      key: 'xuankong:calculation:plates',
      stage: '飞布三盘',
      promptText: result.replacement
        ? `运星${result.period.yunStar}顺飞生成运盘；山盘原${result.replacement.mountain.originalCenterStar}入中，取${result.replacement.mountain.referenceMountain}山替为${result.replacement.mountain.replacementStar}${result.replacement.mountain.direction}；向盘原${result.replacement.facing.originalCenterStar}入中，取${result.replacement.facing.referenceMountain}山替为${result.replacement.facing.replacementStar}${result.replacement.facing.direction}`
        : `运星${result.period.yunStar}顺飞生成运盘；山向盘按入中星本宫同元龙山阴阳定顺逆，五黄入中时借原山阴阳`,
      sources: result.replacement
        ? [
            result.replacement.sourceUrl,
            result.replacement.verificationSourceUrl,
            '二十四山替星表与元龙阴阳顺逆规则',
          ]
        : [
            `${result.engine.name} ${result.engine.version} 透明飞布规则`,
            '玄空飞星元龙阴阳顺逆规则',
          ],
      limitation: STEP_LIMIT,
    },
  ];

  const facts = [
    {
      key: 'xuankong:fact:formation',
      type: '当运星位置结构',
      promptText: `${result.formation}；该名称只表示山向宫的当运山星、向星落点比较，不直接代表现实吉凶`,
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
      type: '中宫三盘星位',
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
  if (result.measurement?.guaTypeStability === '异说区间') {
    const range = result.measurement.possibleCenterOffsetRangeDegrees;
    counterFacts.push({
      key: 'xuankong:counter:gua-type-threshold',
      type: '卦型异说',
      promptText: `测量范围偏离山中心 ${range?.minimum.toFixed(2)}°-${range?.maximum.toFixed(2)}°，涉及 3° 至 4.5° 的下卦、替卦分歧；本盘卦型来自输入明确指定，不代表唯一流派结论`,
      sources: ['funfwo/Fengshui 与 weig19364/xuankongfeixing 固定提交的阈值差异'],
      limitation: COUNTER_LIMIT,
    });
  }

  const limitationFacts = [
    {
      key: 'xuankong:limitation:scope',
      type: '体系边界',
      promptText:
        result.formation === '替卦未成四正局'
          ? '当前替卦三盘未形成四种已登记的当运星位置结构；不扩展检测来源未闭合的特殊组合，也不覆盖形峦、玄空大卦或其他门派替卦口诀'
          : '当前只输出可复算的运盘、山盘、向盘、替星过程、当运星位置比较与测量边界；不扩展检测来源未闭合的特殊组合，也不覆盖形峦、玄空大卦或其他门派替卦口诀',
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
      title: '《青囊奥语》《天玉经》《地理辨正》传统框架',
      evidence:
        '支持二十四山、元运、阴阳顺逆、山水分层与挨星框架；古籍不直接无歧义证明本项目的完整现代阈值、替星表或组合断语',
      role: '传统规则来源' as const,
    },
    {
      title: 'mingyu-core 玄空三盘规则-v2',
      evidence:
        '本地透明实现运盘、山盘、向盘、元龙阴阳顺逆、替星过程与星位比较；下卦 216 盘及替卦 216 盘穷举验证',
      role: '公共算法来源' as const,
    },
    {
      title: 'funfwo/Fengshui 固定提交',
      evidence:
        '固定提交 bd7d85e：交叉核验同元龙取本宫山、替星表与元龙顺逆；卦型阈值采用中央 9°，只作为公开实现互校',
      role: '公共算法来源' as const,
    },
    {
      title: 'weig19364/xuankongfeixing 固定提交',
      evidence:
        '固定提交 324623c：交叉核验完整二十四山替星表；卦型阈值采用偏中心大于 3°，与另一实现的 4.5° 形成已公开保留的分歧',
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
