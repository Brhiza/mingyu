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
  replacementReason: string;
  plates: { yun: number[]; shan: number[]; xiang: number[]; year?: number[]; month?: number[] };
  palaces?: Array<{
    gong: number;
    name: string;
    yunStar: number;
    shanStar: number;
    xiangStar: number;
    yearStar?: number;
    monthStar?: number;
    shanXiangRelation: string;
    yunStarState: string;
  }>;
  flowStars?: {
    yearPlate: { year: number; starName: string; centerStar: number; calendarNote: string };
    monthPlate?: { starName: string; centerStar: number; calendarNote: string };
  };
  formation: string;
  combinations: Array<{ name: string; kind: string; palaces?: number[]; note: string }>;
  engine: { name: string; version: string; mode: string };
  daoShanXiang: { summary: string };
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
  castleGate?: { summary: string };
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

const STEP_LIMIT = '计算步骤记录三元九运、山向、起法与三盘飞布如何形成当前盘面';
const FACT_LIMIT = '飞星事实记录当运、山向飞布与到山到向结构';
const COUNTER_LIMIT = '反证用于提示测量边界和输入限制';
const LIMIT_LIMIT = '限制事实用于界定玄空飞星 v1 的输出范围';

function formatFlowYear(year: number): string {
  return year === 0 ? '公元前1' : String(year);
}

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
      promptText: `坐山${result.sitMountain}，朝向${result.facingMountain}，采用${result.guaType}；${result.replacementReason}`,
      sources: ['二十四山罗盘换算', '下卦中央九度与兼向替卦边界规则'],
      limitation: STEP_LIMIT,
    },
    {
      key: 'xuankong:calculation:plates',
      stage: '飞布三盘',
      promptText: result.replacement
        ? `运星${result.period.yunStar}顺飞生成运盘；山盘原${result.replacement.mountain.originalCenterStar}星取${result.replacement.mountain.referenceMountain}山替为${result.replacement.mountain.replacementStar}${result.replacement.mountain.direction}；向盘原${result.replacement.facing.originalCenterStar}星取${result.replacement.facing.referenceMountain}山替为${result.replacement.facing.replacementStar}${result.replacement.facing.direction}`
        : `运星${result.period.yunStar}顺飞生成运盘；山向盘按入中星本宫同元龙山阴阳定顺逆，五黄入中时借原山阴阳`,
      sources: result.replacement
        ? [
            '《沈氏玄空学》上卷替卦章',
            '《中州派玄空学》上册三元龙与起星盘结构；项目量角边界',
            '二十四山替星表、同元取星与顺逆规则',
          ]
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
      key: 'xuankong:fact:gua-type',
      type: '起法',
      promptText: `${result.guaType}；${result.replacementReason}`,
      sources: ['玄空下卦与兼向替卦起法规则'],
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
    ...(result.palaces ?? []).map((palace) => ({
      key: `xuankong:fact:palace:${palace.gong}`,
      type: '宫位组合',
      promptText: `${palace.name}运${palace.yunStar}山${palace.shanStar}向${palace.xiangStar}${
        palace.yearStar !== undefined ? `年${palace.yearStar}` : ''
      }${palace.monthStar !== undefined ? `月${palace.monthStar}` : ''}，山向${palace.shanXiangRelation}，运星${palace.yunStarState}`,
      sources: ['三盘飞星与九星五行生克'],
      limitation: FACT_LIMIT,
    })),
  ];
  if (result.flowStars) {
    facts.push({
      key: 'xuankong:fact:year-star',
      type: '流年飞星',
      promptText: `${formatFlowYear(result.flowStars.yearPlate.year)}年${result.flowStars.yearPlate.starName}入中；${result.flowStars.yearPlate.calendarNote}`,
      sources: ['三元紫白年星', 'tyme4ts 干支年九星'],
      limitation: FACT_LIMIT,
    });
    if (result.flowStars.monthPlate) {
      facts.push({
        key: 'xuankong:fact:month-star',
        type: '流月飞星',
        promptText: `${result.flowStars.monthPlate.starName}入中；${result.flowStars.monthPlate.calendarNote}`,
        sources: ['节气月紫白', 'tyme4ts 节气月九星'],
        limitation: FACT_LIMIT,
      });
    }
  }
  for (const combination of result.combinations) {
    facts.push({
      key: `xuankong:fact:combination:${combination.name}`,
      type: '组合互参',
      promptText: `${combination.name}${combination.palaces?.length ? `（宫位 ${combination.palaces.join('、')}）` : ''}：${combination.note}`,
      sources: [`${result.engine.name}@${result.engine.version} 组合检测`],
      limitation: FACT_LIMIT,
    });
  }
  if (result.castleGate) {
    facts.push({
      key: 'xuankong:fact:castle-gate',
      type: '城门诀',
      promptText: result.castleGate.summary,
      sources: ['《沈氏玄空学》城门诀规则'],
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
          ? '当前替卦运盘、山盘、向盘已重算，但未形成四类正局，组合检测保守跳过'
          : result.flowStars
            ? `当前输出${result.guaType}运盘、山盘、向盘、流年流月飞星、局型与已登记组合`
            : `当前输出${result.guaType}运盘、山盘、向盘、局型与已登记组合`,
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
    promptText: `${result.period.yuan}${result.period.yun}运，坐${result.sitMountain}向${result.facingMountain}，${result.guaType}，${result.formation}；${result.daoShanXiang.summary}`,
    sources: ['定运、山向、三盘飞布与到山到向汇总'],
    limitation: FACT_LIMIT,
  };

  const sources = [
    ...(result.replacementApplied
      ? [
          {
            title: '《沈氏玄空学》上卷替卦章',
            evidence:
              '二十四山替星诀与兼向起替规则；原文扫描页：https://vr-d.com/pdf-file/%E9%A3%8E%E6%B0%B4%2F%E6%B2%89%E6%B0%8F%E7%8E%84%E7%A9%BA_%E4%B8%8A.pdf',
            role: '传统规则来源' as const,
          },
          {
            title: '《中州派玄空学》上册',
            evidence:
              '二十四山三元龙、起星盘结构与同元龙顺逆；本项目中央九度与外侧三度是明确的量角边界，原文扫描页：https://vr-d.com/pdf-file/%E9%A3%8E%E6%B0%B4%2F%E4%B8%AD%E5%B7%9E%E6%B4%BE%E7%8E%84%E7%A9%BA%E5%AD%A6_%E4%B8%8A%E5%86%8C_%E7%8E%8B%E4%BA%AD%E4%B9%8B.pdf',
            role: '传统规则来源' as const,
          },
        ]
      : []),
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
