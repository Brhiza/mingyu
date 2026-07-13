import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';
import type { XiaoliurenData, XiaoliurenPalaceDetail } from '../types/divination';

export interface XiaoliurenStageEvidence {
  stage: '起因' | '过程' | '结果';
  palace: XiaoliurenPalaceDetail;
  seasonState: string;
  role: string;
  support: string[];
  constraints: string[];
}

export interface XiaoliurenEvidenceAnalysis {
  sources: Array<{ title: string; evidence: string; role: '传统规则来源' | '公共算法来源' }>;
  calculationChain: string[];
  stages: XiaoliurenStageEvidence[];
  transitions: string[];
  counterEvidence: string[];
  triggerConditions: string[];
  limitations: string[];
  evidence: PromptEvidenceBundle;
  promptText: string;
  methodology: string[];
}

const SUPPORT_TENDENCIES = new Set(['宜推进', '有助力']);
const CONSTRAINT_TENDENCIES = new Set(['宜等待', '易反复', '易争执', '易落空']);

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function buildStage(
  stage: XiaoliurenStageEvidence['stage'],
  palace: XiaoliurenPalaceDetail,
  seasonState: string,
): XiaoliurenStageEvidence {
  const role =
    stage === '起因'
      ? '说明事情的起点与既有条件'
      : stage === '过程'
        ? '说明推进方式与中段变化'
        : '作为当前课式的主要落点';
  const support = unique([
    SUPPORT_TENDENCIES.has(palace.tendency) ? `宫位倾向为${palace.tendency}` : '',
    seasonState === '旺' || seasonState === '相' ? `月令${seasonState}` : '',
    palace.keywords.length ? `关键词${palace.keywords.join('、')}` : '',
  ]);
  const constraints = unique([
    CONSTRAINT_TENDENCIES.has(palace.tendency) ? `宫位倾向为${palace.tendency}` : '',
    seasonState === '休' || seasonState === '囚' || seasonState === '死'
      ? `月令${seasonState}`
      : '',
    palace.name === '空亡' ? '空亡提示信息、目标或时机可能尚未落实，须先核实' : '',
    palace.name === '赤口' ? '赤口提示沟通冲突风险，须以现实互动复核' : '',
  ]);
  return { stage, palace, seasonState, role, support, constraints };
}

export function analyzeXiaoliurenEvidence(data: XiaoliurenData): XiaoliurenEvidenceAnalysis {
  const sources: XiaoliurenEvidenceAnalysis['sources'] = [
    {
      title: '《小六壬金口诀》《李淳风六壬时课》传统掌诀体系',
      evidence: '月、日、时或数字顺数六宫及大安、留连、速喜、赤口、小吉、空亡取象',
      role: '传统规则来源',
    },
    {
      title: '命语公共干支与五行关系模块',
      evidence: '时辰序、月支及五行旺相休囚死关系的统一计算',
      role: '公共算法来源',
    },
  ];
  const stages = [
    buildStage('起因', data.sequence.start, data.seasonStates?.start ?? '未定'),
    buildStage('过程', data.sequence.process, data.seasonStates?.process ?? '未定'),
    buildStage('结果', data.sequence.result, data.seasonStates?.result ?? '未定'),
  ];
  const transitions = [
    `起因${data.sequence.start.name}${data.sequence.start.element} → 过程${data.sequence.process.name}${data.sequence.process.element}：${data.wuxingRelations.startToProcess}`,
    `过程${data.sequence.process.name}${data.sequence.process.element} → 结果${data.sequence.result.name}${data.sequence.result.element}：${data.wuxingRelations.processToResult}`,
  ];
  const calculationChain = [
    `${data.methodLabel}确定起课基数；当前课式记录农历${data.lunarMonth}月${data.lunarDay}日、${data.hourLabel}`,
    '按六宫顺序分别定位起因、过程与结果三宫',
    `三宫定位为${data.sequence.start.name} → ${data.sequence.process.name} → ${data.sequence.result.name}`,
    `比较起因至过程、过程至结果的五行关系：${data.wuxingRelations.startToProcess}、${data.wuxingRelations.processToResult}`,
    '以结果宫为主要落点，月令旺衰、方位、神煞和传统应期属性只作辅助资料',
  ];
  const counterEvidence = unique(stages.flatMap((item) => item.constraints));
  const triggerConditions = unique([
    ...(data.timingEvidence?.triggerConditions ?? []),
    data.timingEvidence ? `盘内相对节奏为${data.timingEvidence.rhythm}` : '',
    '以消息、沟通、资源、手续或目标是否落实等现实事件复核，不只依据宫名判断',
  ]);
  const limitations = unique([
    ...(data.timingEvidence?.limitations ?? []),
    '六宫、五行、旺衰、方位和神煞属于传统取象规则，不是现代统计预测模型',
    '时间、数字与随机起课只改变起课输入，不代表其中一种方式具有更高预测准确率',
    '结果宫是当前课式主轴，不得跳过起因与过程直接套用固定吉凶断语',
    '方位、身体部位、传统吉凶标签和神煞不得单独证明现实事件，也不得换算成功率或唯一日期',
  ]);
  const items: PromptEvidenceItem[] = stages.map((item, index): PromptEvidenceItem => ({
    level: index === 2 ? '主证' : '辅证',
    title: `${item.stage}${item.palace.name}`,
    detail: `${item.role}；五行${item.palace.element}，月令${item.seasonState}；宫义${item.palace.meaning}；支持${item.support.join('、') || '未见独立增强条件'}；限制${item.constraints.join('、') || '未见明确限制标签'}。`,
    source: '六宫顺数定位、三段课式与月令五行旺衰',
    weight: index === 2 ? 100 : 75 - index,
    tags: [item.stage, item.palace.name, item.palace.element],
  }));
  items.push(
    {
      level: '主证',
      title: '三宫五行推进',
      detail: `${transitions.join('；')}；综合描述：${data.wuxingRelations.description}。`,
      source: '三宫五行生克逐段比较',
      weight: 90,
      tags: ['五行推进'],
    },
    ...counterEvidence.map((detail): PromptEvidenceItem => ({
      level: '反证',
      title: detail.split('，')[0],
      detail,
      source: '宫位倾向、月令状态与现实条件核验',
      weight: 80,
    })),
    {
      level: '限制',
      title: '小六壬解释边界',
      detail: limitations.join('；'),
      source: '计算事实与解释结论分离原则',
      weight: 120,
      tags: ['传统模型', '证据边界'],
    },
  );
  const evidence: PromptEvidenceBundle = {
    title: '小六壬三宫推进结构化证据',
    items,
  };
  const promptText = [
    '【小六壬三宫推进结构化证据】',
    ...formatPromptEvidenceBundle(evidence),
    `计算链：${calculationChain.join(' → ')}。`,
    `推进关系：${transitions.join('；')}。`,
    `反证限制：${counterEvidence.join('；') || '未见明确休囚、争执、反复或落空标签，仍须现实进展复核'}。`,
    `触发条件：${triggerConditions.join('；')}。`,
    `规则来源：${sources.map((item) => `${item.title}（${item.role}：${item.evidence}）`).join('；')}。`,
  ].join('\n');

  return {
    sources,
    calculationChain,
    stages,
    transitions,
    counterEvidence,
    triggerConditions,
    limitations,
    evidence,
    promptText,
    methodology: [
      '先按起课方式复核输入，再依六宫顺序定位起因、过程和结果。',
      '结果宫作为主要落点，起因与过程用于解释来源和推进过程。',
      '逐段比较三宫五行关系，并以月令旺衰补充条件成熟度。',
      '宫位限制与不利状态作为反证明确列出，不只罗列支持信息。',
      '方位、神煞、身体部位与应期属性只作传统辅助，不生成概率、总分或绝对日期。',
    ],
  };
}
