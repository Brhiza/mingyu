import { formatPromptCurrentTime } from './prompt-time';

export interface MetaphysicsPromptOptions {
  measurement?: string;
  currentTime?: Date;
  context?: PromptRealWorldContext;
}

export interface PromptRealWorldContext {
  currentSituation?: string;
  currentState?: string;
  knownFacts?: string;
  desiredOutcome?: string;
  constraints?: string;
}

export function formatPromptRealWorldContext(context?: PromptRealWorldContext): string {
  if (!context) return '';
  return [
    ['当前情况', context.currentSituation],
    ['当前状态', context.currentState],
    ['已知事实', context.knownFacts],
    ['期望结果', context.desiredOutcome],
    ['现实限制', context.constraints],
  ]
    .filter((item): item is [string, string] => Boolean(item[1]?.trim()))
    .map(([label, value]) => `${label}：${value.trim()}`)
    .join('\n');
}

export function insertPromptRealWorldContext(
  prompt: string,
  context?: PromptRealWorldContext,
): string {
  const contextText = formatPromptRealWorldContext(context);
  if (!prompt || !contextText) return prompt;
  const section = `【补充信息】\n${contextText}`;
  const questionMarker = '\n\n【问题】';
  return prompt.includes(questionMarker)
    ? prompt.replace(questionMarker, `\n\n${section}${questionMarker}`)
    : `${prompt}\n\n${section}`;
}

export function buildMetaphysicsPrompt(
  basePrompt: string,
  question?: string,
  options: MetaphysicsPromptOptions = {},
): string {
  const normalizedQuestion = question?.trim() || '请综合解读本次排盘的重点、风险与行动建议。';
  const contextText = formatPromptRealWorldContext(options.context);

  return [
    '【当前时间】',
    formatPromptCurrentTime(options.currentTime),
    '',
    basePrompt,
    ...(options.measurement ? ['', '【测量换算】', options.measurement] : []),
    ...(contextText ? ['', '【补充信息】', contextText] : []),
    '',
    '【问题】',
    normalizedQuestion,
    '',
    '【任务】',
    '只依据上方排盘信息回答【问题】。先给结论，再按主证、辅证、反证或限制说明推理，最后给出可执行建议。',
    '主证必须来自上方排盘的核心结构；辅证只能用于增减或限定主证；证据互相矛盾时要明确保留意见。',
    '',
    '【输出要求】',
    '使用简体中文；每个关键结论都要紧跟对应盘面依据，不要只给笼统吉凶。',
    '只使用上方明确列出的星曜、宫位、关系、日期和现实背景；证据不能支持时保守表达，不延伸新的盘面事实。',
    '神煞、单一方位、单一星曜、单张牌或生肖定级不得作为唯一结论；涉及健康、法律、财务和安全时必须提醒核实现实资料。',
  ].join('\n');
}
