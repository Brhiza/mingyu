import type { TarotData, TarotSpreadType } from '../types/divination';
import { buildPromptTask } from './guidance';

export interface TarotSpreadPromptFramework {
  mainLine: string;
  connections: string;
  conclusion: string;
}

export const TAROT_SPREAD_PROMPT_FRAMEWORKS: Record<TarotSpreadType, TarotSpreadPromptFramework> = {
  single: {
    mainLine: '围绕唯一牌位提炼当前问题的核心主题与启示。',
    connections: '结合问题语境说明牌义与正逆位如何落到当下。',
    conclusion: '归纳一条核心判断和一个可落实的关注点。',
  },
  three: {
    mainLine: '按过去、现在、未来三个牌位整理背景、当前表现与后续主题。',
    connections: '结合相邻牌面的主题与正逆位，比较三个位置的联系和条件差异。',
    conclusion: '归纳主题延续、可能转折与当前可把握的关键。',
  },
  love: {
    mainLine: '围绕双方视角、关系现状、发展建议与未来走向牌位，整理关系主题。',
    connections: '将双方内心牌位作为关系视角的象征线索，联系已知互动信息梳理共识、差异与沟通议题。',
    conclusion: '归纳关系中的共同点、差异点、改善条件与可能走向。',
  },
  career: {
    mainLine: '从事业现状出发，依次辨认优势、挑战、机会、行动与结果。',
    connections: '比较优势能否承接机会、挑战会如何影响行动及结果。',
    conclusion: '给出职业主线、优先突破点和行动后的可能结果。',
  },
  decision: {
    mainLine: '先判断现状，再分别分析选择A、选择B及各自结果。',
    connections: '以相同标准比较两条路径的条件、代价、机会和后续影响。',
    conclusion: '明确更匹配当前目标的选择、成立条件及仍需核实的现实信息。',
  },
  celtic: {
    mainLine:
      '由当前与阻碍切入，结合目标与潜能、现实基础、过去影响和近期未来牌位，再联系个人态度、外界影响及希望与恐惧。',
    connections:
      '比较目标与现实基础、过去影响与近期未来牌位的主题联系，并结合态度与环境线索归纳可能发展。',
    conclusion: '归纳核心矛盾、关键助力、风险节点与可能走向。',
  },
  chakra: {
    mainLine: '从海底轮到顶轮依序检视生存、情感、意志、爱、表达、直觉与精神状态。',
    connections: '比较相邻脉轮及上下层能量是否顺畅，找出过度集中或明显薄弱之处。',
    conclusion: '归纳最需要关注的能量层级及恢复整体平衡的先后顺序。',
  },
  year: {
    mainLine:
      '以全年主题牌为纲，结合四个季度及爱情、事业、财务牌位，并将健康牌位作为身心照料的象征主题。',
    connections:
      '比较季度牌位呈现的主题变化，并联系健康牌位、问题中明确的生活感受与照料安排，归纳各领域的阶段重点。',
    conclusion: '归纳年度主轴、重要阶段、重点领域和全年行动节奏。',
  },
  mindBodySpirit: {
    mainLine: '分别检视思想、身体行动与精神状态。',
    connections: '比较三者是否一致，说明内在认知如何影响行动和整体感受。',
    conclusion: '归纳失衡来源及恢复身心一致的优先方向。',
  },
  horseshoe: {
    mainLine: '依过去、现在、未来展开，再结合建议、环境、希望恐惧与最终结果。',
    connections: '结合建议、环境和希望恐惧牌位，讨论不同现实条件下的未来走向。',
    conclusion: '归纳问题全貌、可控因素、外部变量与可能趋势。',
  },
  holyTriangle: {
    mainLine: '按问题根源、当前状况与发展结果三个牌位整理问题主线。',
    connections: '比较根源线索与当前牌位的主题呼应，并结合现实条件解读结果牌位所示的走向。',
    conclusion: '归纳关键线索、转折机会与可能结果。',
  },
  universal: {
    mainLine: '从现状、阻力、资源、行动与发展趋势梳理通用问题。',
    connections: '比较可用资源与主要阻力，并结合建议行动讨论可能的趋势变化。',
    conclusion: '归纳局面主轴、可调用资源和优先行动方向。',
  },
  fourElements: {
    mainLine: '以核心主题统领火、水、风、土四个层面的行动、情感、思考与现实条件。',
    connections: '比较四元素之间的支持与冲突，识别过强、缺失或失衡的层面。',
    conclusion: '归纳问题的元素结构、主要失衡点与恢复平衡的顺序。',
  },
  hexagram: {
    mainLine: '按过去、现在、未来整理时间主线，再结合方法、环境、隐藏因素与核心结论。',
    connections: '联系外在环境与隐藏因素牌位的主题，并结合方法牌位讨论可能的趋势变化。',
    conclusion: '归纳显性局势、潜在主题、有效方法和可能结果。',
  },
  relationship: {
    mainLine: '按双方视角、需求、关系核心与走向牌位整理关系议题。',
    connections:
      '将双方状态与需求牌位作为关系视角的象征线索，联系可观察的互动信息梳理共识、差异与沟通议题。',
    conclusion: '归纳关系基础、主要分歧、双方可调整之处与发展条件。',
  },
  wealth: {
    mainLine: '围绕财务议题，整理当前状态、收入机会、支出风险、可用资源和改善建议牌位的主题。',
    connections: '比较机会、风险与资源牌位，并结合已提供的收支信息讨论改善路径的现实条件。',
    conclusion: '归纳财务主线、需关注的条件与可执行的改善方向。',
  },
  problemSolving: {
    mainLine: '按问题表象、成因线索、主要阻力、突破方向与行动结果牌位整理问题结构。',
    connections:
      '比较成因线索与表象、阻力牌位的主题关联，并结合突破方向讨论不同行动条件下的可能变化。',
    conclusion: '归纳问题线索、可尝试的突破口和行动后的可能变化。',
  },
  twelveHouses: {
    mainLine:
      '依十二宫逐一分析自我、财富、沟通、家庭、创造、日常、关系、转变、信念、事业、社群与潜意识。',
    connections: '找出重点或矛盾明显的宫位，再比较相关生活领域之间的牌面主题与现实条件。',
    conclusion: '归纳周期总主题、重要领域、跨领域联动与优先处理顺序。',
  },
};

const GENERIC_TAROT_SPREAD_PROMPT_FRAMEWORK: TarotSpreadPromptFramework = {
  mainLine: '按实际记录的牌位顺序追踪问题的状态与发展。',
  connections: '结合相邻牌位、正逆位与牌序组合说明牌面之间的支持、冲突与转折。',
  conclusion: '归纳核心趋势、主要阻力、可用条件与当前应对重点。',
};

export function buildTarotSpreadTask(data: Pick<TarotData, 'spreadType' | 'cards'>) {
  const isSingleCard = data.cards.length === 1;
  if (isSingleCard) {
    return buildPromptTask(
      '依据唯一牌位、牌名、正逆位、关键词与牌面象征，结合问题中可观察的信息和现实条件回答【问题】。',
      'tarot-single',
    );
  }
  const framework =
    TAROT_SPREAD_PROMPT_FRAMEWORKS[data.spreadType as TarotSpreadType] ??
    GENERIC_TAROT_SPREAD_PROMPT_FRAMEWORK;
  return buildPromptTask(
    [
      '依据牌阵、牌位、正逆位与牌序组合回答【问题】。',
      '事实核对：逐张对应牌位、牌名、正逆位、关键词、元素与牌阶主题；结合相邻或对照牌位的象征关系解读。',
      '现实核对：联系问题中可观察的信息说明判断依据、现实条件与可能分支。',
      `解读主线：${framework.mainLine}`,
      `牌位联动：${framework.connections}`,
      `结论重点：${framework.conclusion}`,
    ].join('\n'),
    'tarot',
  );
}
