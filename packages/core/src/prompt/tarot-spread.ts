import type { TarotData, TarotSpreadType } from '../types/divination';
import { buildPromptTask } from './guidance';

export interface TarotSpreadPromptFramework {
  mainLine: string;
  connections: string;
  conclusion: string;
}

export const TAROT_SPREAD_PROMPT_FRAMEWORKS: Record<TarotSpreadType, TarotSpreadPromptFramework> = {
  single: {
    mainLine: '围绕唯一牌位提炼当前问题最核心的状态与启示。',
    connections: '结合问题语境说明牌义与正逆位如何落到当下，不扩展不存在的跨牌关系。',
    conclusion: '归纳一条核心判断和一个可落实的关注点。',
  },
  three: {
    mainLine: '按过去、现在、未来的时间顺序追踪事件如何演变。',
    connections: '说明过去如何形成现在、现在又如何推动或改变未来。',
    conclusion: '归纳趋势的延续点、转折点与当前可把握的关键。',
  },
  love: {
    mainLine: '先分别判断双方内心，再分析关系现状、发展建议与未来走向。',
    connections: '对照双方需求是否一致，并说明关系现状如何连接建议与未来。',
    conclusion: '归纳关系的共同基础、主要矛盾、改善条件与可能走向。',
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
    mainLine: '由当前与阻碍切入，结合过去基础、未来演变、个人态度和外界影响形成全局判断。',
    connections: '串联十个牌位，重点解释内在态度与外界环境如何共同改变未来和最终结果。',
    conclusion: '归纳核心矛盾、关键助力、风险节点与最可能的整体走向。',
  },
  chakra: {
    mainLine: '从海底轮到顶轮依序检视生存、情感、意志、爱、表达、直觉与精神状态。',
    connections: '比较相邻脉轮及上下层能量是否顺畅，找出过度集中或明显薄弱之处。',
    conclusion: '归纳最需要关注的能量层级及恢复整体平衡的先后顺序。',
  },
  year: {
    mainLine: '先判断全年主题，再按四个季度观察时间推进，并分别分析爱情、事业、财运与健康。',
    connections: '说明季度变化如何影响各生活领域，以及挑战、机遇与建议如何互相对应。',
    conclusion: '归纳年度主轴、重要阶段、重点领域和全年行动节奏。',
  },
  mindBodySpirit: {
    mainLine: '分别检视思想、身体行动与精神状态。',
    connections: '比较三者是否一致，说明内在认知如何影响行动和整体感受。',
    conclusion: '归纳失衡来源及恢复身心一致的优先方向。',
  },
  horseshoe: {
    mainLine: '依过去、现在、未来展开，再结合建议、环境、希望恐惧与最终结果。',
    connections: '区分客观环境与主观期待，并说明二者如何影响未来和结果。',
    conclusion: '归纳问题全貌、可控因素、外部变量与最终趋势。',
  },
  holyTriangle: {
    mainLine: '按问题根源、当前状况、发展结果形成简洁因果链。',
    connections: '说明根源如何塑造现状，以及现状延续时会导向什么结果。',
    conclusion: '归纳最关键的成因、转折机会与结果趋势。',
  },
  universal: {
    mainLine: '从当前状况出发，依次辨认阻力、资源、行动与发展趋势。',
    connections: '判断可用资源能否化解主要阻力，并说明建议行动如何改变趋势。',
    conclusion: '归纳局面主轴、可调用资源和最优先的行动方向。',
  },
  fourElements: {
    mainLine: '以核心主题统领火、 水、风、土四个层面的行动、情感、思考与现实条件。',
    connections: '比较四元素之间的支持与冲突，识别过强、缺失或失衡的层面。',
    conclusion: '归纳问题的元素结构、主要失衡点与恢复平衡的顺序。',
  },
  hexagram: {
    mainLine: '按过去、现在、未来确定时间主线，再加入方法、环境、隐藏因素与核心结论。',
    connections: '说明外在环境与隐藏因素如何改变时间趋势，以及可用方法能否形成转机。',
    conclusion: '归纳显性局势、隐性动力、有效方法和整体结果。',
  },
  relationship: {
    mainLine: '分别分析双方状态与需求，再判断关系核心和后续走向。',
    connections: '交叉比较双方状态和需求的契合、错位与互动循环。',
    conclusion: '归纳关系基础、主要矛盾、双方可调整之处与发展条件。',
  },
  wealth: {
    mainLine: '从当前财务状态出发，分析收入机会、支出风险、可用资源与改善建议。',
    connections: '比较机会与风险，并判断现有资源能否支撑改善路径。',
    conclusion: '归纳财务主线、优先控制的风险和可执行的改善方向。',
  },
  problemSolving: {
    mainLine: '从问题表象深入根本原因，再辨认阻力、突破方向与行动结果。',
    connections: '说明根因如何造成表象，突破方向是否真正针对阻力，以及行动如何改变结果。',
    conclusion: '归纳问题根因、最有效的突破口和执行后的可能变化。',
  },
  twelveHouses: {
    mainLine:
      '依十二宫逐一分析自我、财富、沟通、家庭、创造、日常、关系、转变、信念、事业、社群与潜意识。',
    connections: '先找出最活跃或矛盾最明显的宫位，再分析相关生活领域之间的相互影响。',
    conclusion: '归纳周期总主题、三个最重要领域、跨领域联动与优先处理顺序。',
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
    return buildPromptTask('依据唯一牌位、正逆位与单牌牌义回答【问题】。', 'tarot-single');
  }
  const framework =
    TAROT_SPREAD_PROMPT_FRAMEWORKS[data.spreadType as TarotSpreadType] ??
    GENERIC_TAROT_SPREAD_PROMPT_FRAMEWORK;
  return buildPromptTask(
    [
      '依据牌阵、牌位、正逆位与牌序组合回答【问题】。',
      `解读主线：${framework.mainLine}`,
      `牌位联动：${framework.connections}`,
      `结论重点：${framework.conclusion}`,
    ].join('\n'),
    'tarot',
  );
}
