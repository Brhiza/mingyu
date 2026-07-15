/**
 * @file 命语公共地基工具箱
 * @description 统一导出干支、五行、方位与通用神煞能力，供核心包、API 和 MCP 复用。
 */

import {
  HEAVENLY_STEMS,
  EARTHLY_BRANCHES,
  ZODIACS,
  SIXTY_CYCLE,
  SIX_XUN_HEADS,
  CHANGSHENG_ORDER,
} from '../ganzhi/data';
import { describeGanZhi, getBranchRelations, getStemRelations } from '../ganzhi';
import { WUXING, analyzeWuxing } from '../wuxing';
import { BAGUA, TWENTY_FOUR_MOUNTAINS, analyzeCompassDirection } from '../direction';
import { analyzeShenshaEvidence, listShenshaCatalog } from '../shensha';
import { CHINA_DST_YEARS, SHICHEN_PERIODS } from '../calendar';
import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';

export type FoundationModuleId = 'calendar' | 'ganzhi' | 'wuxing' | 'direction' | 'shensha';

export interface FoundationCapabilityFact {
  key: `foundation:capability:${FoundationModuleId}`;
  status: '结构化证据可用' | '目录资料可用';
  module: FoundationModuleId;
  name: string;
  provides: string[];
  evidenceOutputs: string[];
  sources: string[];
  promptText: string;
  limitation: string;
}

export interface FoundationCapabilitySummaryFact {
  key: 'foundation:capabilities:summary';
  status: '目录完整';
  factKeys: FoundationCapabilityFact['key'][];
  moduleFactCount: number;
  evidenceReadyModuleCount: number;
  catalogOnlyModuleCount: number;
  constantGroupCount: number;
  commonShenshaCount: number;
  promptText: string;
  sources: string[];
  limitation: string;
}

export interface FoundationCapabilityLimitationFact {
  key:
    | 'foundation:capabilities:limitation:catalog'
    | 'foundation:capabilities:limitation:traditional-model'
    | 'foundation:capabilities:limitation:shensha-context'
    | 'foundation:capabilities:limitation:high-risk-output';
  status: '适用';
  type: '目录边界' | '传统模型边界' | '神煞边界' | '高风险输出边界';
  ownerFactKeys: Array<FoundationCapabilityFact['key'] | FoundationCapabilitySummaryFact['key']>;
  promptText: string;
  sources: string[];
  limitation: string;
}

export interface FoundationCapabilities {
  key: 'foundation:capabilities';
  status: '已登记';
  version: string;
  singleSourceModules: FoundationModuleId[];
  evidenceOutputs: Record<FoundationModuleId, string[]>;
  capabilityFacts: FoundationCapabilityFact[];
  summaryFact: FoundationCapabilitySummaryFact;
  limitationFacts: FoundationCapabilityLimitationFact[];
  limitations: string[];
  evidence: PromptEvidenceBundle;
  promptText: string;
  constants: {
    heavenlyStems: string[];
    earthlyBranches: string[];
    zodiacs: string[];
    sixtyCycle: string[];
    sixXunHeads: string[];
    changshengOrder: string[];
    wuxing: string[];
    bagua: string[];
    twentyFourMountains: string[];
    shichenPeriods: Array<{
      index: number;
      branch: string;
      name: string;
      range: string;
      hour: number;
    }>;
    chinaDstYears: number[];
  };
  commonShensha: Array<{
    id: string;
    name: string;
    scope: string;
    evidenceStatus: '来源已声明' | '来源未声明';
    inputDependencies: string[];
    ruleText: string;
    sources: string[];
  }>;
}

const FOUNDATION_EVIDENCE_OUTPUTS: Record<FoundationModuleId, string[]> = {
  calendar: [
    '十二时辰目录',
    '中国历史夏令时年份',
    '真太阳时计算链',
    '天文时间尺度证据',
    '月相与节气证据',
  ],
  ganzhi: ['稳定键', '计算链', '来源事实', '证据汇总', '解释限制', '可复制证据文本'],
  wuxing: [
    '稳定键',
    '逐项五行与藏干贡献',
    '计算链',
    '并列最高最低项',
    '证据汇总',
    '解释限制',
    '可复制证据文本',
  ],
  direction: [
    '稳定键',
    '度数归一化',
    '向山与坐山',
    '八卦归属',
    '分界线状态',
    '计算链',
    '证据汇总',
    '解释限制',
    '可复制证据文本',
  ],
  shensha: [
    '稳定键',
    '稳定编号',
    '完整四柱核验',
    '逐项起法与目标地支',
    '逐柱命中事实',
    '来源声明状态',
    '计算链',
    '证据汇总',
    '解释限制',
    '可复制证据文本',
  ],
};

const CAPABILITY_FACT_LIMITATION =
  '能力事实只说明当前可查询的数据、计算链和证据字段，不代表已经完成具体排盘，也不证明传统解释、现实因果、吉凶结果或事件概率';
const SUMMARY_FACT_LIMITATION =
  '能力目录汇总只统计数据来源、证据能力和目录覆盖，不得按能力数量或字段数量生成可靠度、吉凶总分、成功率或现实结论';
const LIMITATION_FACT_LIMITATION =
  '限制事实用于约束能力目录可以支持的解释范围，不得被反向当作传统模型有效性、现实结果或概率证据';

function buildCapabilityFacts(): FoundationCapabilityFact[] {
  return [
    {
      key: 'foundation:capability:calendar',
      status: '结构化证据可用',
      module: 'calendar',
      name: '历法与时间',
      provides: ['十二时辰', '历史夏令时', '真太阳时', '天文时间尺度', '月相', '二十四节气'],
      evidenceOutputs: [...FOUNDATION_EVIDENCE_OUTPUTS.calendar],
      sources: ['公共历法常量', '真太阳时换算', '天文时间尺度、月相与节气计算'],
      promptText:
        '历法与时间资料可提供十二时辰、中国历史夏令时、真太阳时校正、天文时间尺度、月相与节气的可复算事实',
      limitation: CAPABILITY_FACT_LIMITATION,
    },
    {
      key: 'foundation:capability:ganzhi',
      status: '结构化证据可用',
      module: 'ganzhi',
      name: '干支关系',
      provides: ['天干地支', '六十甲子', '六旬旬首', '纳音', '藏干', '合冲刑害破'],
      evidenceOutputs: [...FOUNDATION_EVIDENCE_OUTPUTS.ganzhi],
      sources: ['六十甲子与纳音固定表', '天干地支属性和关系固定表'],
      promptText: '干支资料可提供六十甲子序号、旬首、纳音、藏干及天干地支合冲刑害破的逐项来源事实',
      limitation: CAPABILITY_FACT_LIMITATION,
    },
    {
      key: 'foundation:capability:wuxing',
      status: '结构化证据可用',
      module: 'wuxing',
      name: '五行统计',
      provides: ['天干地支主五行', '藏干贡献', '公开权重', '并列最高最低项'],
      evidenceOutputs: [...FOUNDATION_EVIDENCE_OUTPUTS.wuxing],
      sources: ['天干地支五行固定表', '地支藏干顺序与公开贡献权重'],
      promptText: '五行资料可逐项记录天干地支主五行与藏干贡献，并保留全部并列最高、最低项',
      limitation: CAPABILITY_FACT_LIMITATION,
    },
    {
      key: 'foundation:capability:direction',
      status: '结构化证据可用',
      module: 'direction',
      name: '罗盘方位',
      provides: ['度数归一化', '二十四山', '坐向反转', '后天八卦', '分界线状态'],
      evidenceOutputs: [...FOUNDATION_EVIDENCE_OUTPUTS.direction],
      sources: ['二十四山固定角度区间', '后天八卦方位与坐向反转规则'],
      promptText:
        '罗盘资料可把朝向度数换算为二十四山向山、相反坐山和后天八卦，并显式记录分界线状态',
      limitation: CAPABILITY_FACT_LIMITATION,
    },
    {
      key: 'foundation:capability:shensha',
      status: '结构化证据可用',
      module: 'shensha',
      name: '通用神煞证据',
      provides: ['空亡', '驿马', '桃花', '完整四柱校验', '逐柱命中', '来源声明状态'],
      evidenceOutputs: [...FOUNDATION_EVIDENCE_OUTPUTS.shensha],
      sources: ['六十甲子旬空固定规则', '年支三合局驿马与桃花固定表', '通用神煞注册目录'],
      promptText:
        '通用神煞资料可严格核验完整四柱，逐项计算空亡、驿马和桃花目标，定位实际命中柱位并记录起法、来源与限制',
      limitation: CAPABILITY_FACT_LIMITATION,
    },
  ];
}

function buildLimitationFacts(
  capabilityFacts: FoundationCapabilityFact[],
): FoundationCapabilityLimitationFact[] {
  const allFactKeys = capabilityFacts.map((item) => item.key);
  const summaryKey: FoundationCapabilitySummaryFact['key'] = 'foundation:capabilities:summary';
  return [
    {
      key: 'foundation:capabilities:limitation:catalog',
      status: '适用',
      type: '目录边界',
      ownerFactKeys: [...allFactKeys, summaryKey],
      promptText:
        '能力目录只说明可以查询或计算哪些资料；具体结论必须引用实际输入对应的计算步骤、事实与来源，不得由目录名称直接推断',
      sources: ['能力事实与实际计算结果分层原则'],
      limitation: LIMITATION_FACT_LIMITATION,
    },
    {
      key: 'foundation:capabilities:limitation:traditional-model',
      status: '适用',
      type: '传统模型边界',
      ownerFactKeys: allFactKeys,
      promptText:
        '干支、五行、方位和神煞属于传统规则模型；结构完整与来源可追溯不等于现代实证验证、现实因果或必然结果',
      sources: ['传统规则资料与现实结论分层原则'],
      limitation: LIMITATION_FACT_LIMITATION,
    },
    {
      key: 'foundation:capabilities:limitation:shensha-context',
      status: '适用',
      type: '神煞边界',
      ownerFactKeys: ['foundation:capability:shensha'],
      promptText:
        '通用神煞查询只表示已按当前固定规则核验命中；各体系特有神煞仍须结合对应排盘资料与规则独立计算',
      sources: ['通用神煞证据与各体系特有神煞分离原则'],
      limitation: LIMITATION_FACT_LIMITATION,
    },
    {
      key: 'foundation:capabilities:limitation:high-risk-output',
      status: '适用',
      type: '高风险输出边界',
      ownerFactKeys: [...allFactKeys, summaryKey],
      promptText:
        '不得把目录数量、五行计数、关系命中或方位分类换算为吉凶总分、成功率、事件概率、医疗法律财务定论或保证有效建议',
      sources: ['结构化事实与高风险现实结论分离原则'],
      limitation: LIMITATION_FACT_LIMITATION,
    },
  ];
}

function buildCapabilityEvidence(
  capabilityFacts: FoundationCapabilityFact[],
  summaryFact: FoundationCapabilitySummaryFact,
  limitationFacts: FoundationCapabilityLimitationFact[],
): PromptEvidenceBundle {
  const items: PromptEvidenceItem[] = [
    ...capabilityFacts.map((item): PromptEvidenceItem => ({
      level: item.status === '结构化证据可用' ? '辅证' : '限制',
      title: item.name,
      detail: `${item.promptText}；可用资料：${item.provides.join('、')}；边界：${item.limitation}`,
      source: item.sources.join('、'),
      tags: [item.status, item.module],
    })),
    {
      level: '辅证',
      title: `能力目录证据汇总：${summaryFact.status}`,
      detail: `${summaryFact.promptText}；边界：${summaryFact.limitation}`,
      source: summaryFact.sources.join('、'),
      tags: ['证据汇总', summaryFact.status],
    },
    {
      level: '限制',
      title: '能力目录解释限制',
      detail: `${limitationFacts.map((item) => item.promptText).join('；')}；统一边界：${LIMITATION_FACT_LIMITATION}`,
      source: Array.from(new Set(limitationFacts.flatMap((item) => item.sources))).join('、'),
      tags: ['目录边界', '反伪精确'],
    },
  ];
  return { title: '公共历法干支五行方位神煞能力结构化证据', items };
}

/** 获取可复用底层能力目录。 */
export function getFoundationCapabilities(): FoundationCapabilities {
  const constants: FoundationCapabilities['constants'] = {
    heavenlyStems: [...HEAVENLY_STEMS],
    earthlyBranches: [...EARTHLY_BRANCHES],
    zodiacs: [...ZODIACS],
    sixtyCycle: [...SIXTY_CYCLE],
    sixXunHeads: [...SIX_XUN_HEADS],
    changshengOrder: [...CHANGSHENG_ORDER],
    wuxing: [...WUXING],
    bagua: [...BAGUA],
    twentyFourMountains: [...TWENTY_FOUR_MOUNTAINS],
    shichenPeriods: SHICHEN_PERIODS.map((period) => ({ ...period })),
    chinaDstYears: [...CHINA_DST_YEARS],
  };
  const commonShensha = listShenshaCatalog('common');
  const capabilityFacts = buildCapabilityFacts();
  const evidenceReadyModuleCount = capabilityFacts.filter(
    (item) => item.status === '结构化证据可用',
  ).length;
  const limitationFacts = buildLimitationFacts(capabilityFacts);
  const summaryFact: FoundationCapabilitySummaryFact = {
    key: 'foundation:capabilities:summary',
    status: '目录完整',
    factKeys: capabilityFacts.map((item) => item.key),
    moduleFactCount: capabilityFacts.length,
    evidenceReadyModuleCount,
    catalogOnlyModuleCount: capabilityFacts.length - evidenceReadyModuleCount,
    constantGroupCount: Object.keys(constants).length,
    commonShenshaCount: commonShensha.length,
    promptText: `能力目录已登记${capabilityFacts.length}类资料，其中${evidenceReadyModuleCount}类可直接返回结构化证据，${capabilityFacts.length - evidenceReadyModuleCount}类当前只提供基础目录；固定资料${Object.keys(constants).length}组，通用神煞${commonShensha.length}项`,
    sources: ['历法、干支、五行、方位与通用神煞公共资料逐项登记'],
    limitation: SUMMARY_FACT_LIMITATION,
  };
  const evidence = buildCapabilityEvidence(capabilityFacts, summaryFact, limitationFacts);
  const limitations = limitationFacts.map((item) => item.promptText);
  const promptText = [
    '【公共历法干支五行方位神煞能力结构化证据】',
    ...formatPromptEvidenceBundle(evidence),
    `能力事实：${capabilityFacts.map((item) => item.promptText).join('；')}。`,
    `证据汇总：${summaryFact.promptText}。`,
    `解释限制：${limitations.join('；')}。`,
  ].join('\n');

  return {
    key: 'foundation:capabilities',
    status: '已登记',
    version: '1.2.0',
    singleSourceModules: capabilityFacts.map((item) => item.module),
    evidenceOutputs: Object.fromEntries(
      Object.entries(FOUNDATION_EVIDENCE_OUTPUTS).map(([key, outputs]) => [key, [...outputs]]),
    ) as Record<FoundationModuleId, string[]>,
    capabilityFacts,
    summaryFact,
    limitationFacts,
    limitations,
    evidence,
    promptText,
    constants,
    commonShensha,
  };
}

export const foundation = {
  getFoundationCapabilities,
  describeGanZhi,
  getStemRelations,
  getBranchRelations,
  analyzeWuxing,
  analyzeCompassDirection,
  analyzeShenshaEvidence,
};

export { describeGanZhi, getStemRelations, getBranchRelations } from '../ganzhi';
export { analyzeWuxing } from '../wuxing';
export { analyzeCompassDirection } from '../direction';
export { analyzeShenshaEvidence } from '../shensha';
