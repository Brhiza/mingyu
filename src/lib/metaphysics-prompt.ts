import { formatPromptCurrentTime } from './prompt-time';
import { appendTraditionalResearchNotice } from 'mingyu-core/prompt-evidence';
import { buildPromptGuidanceSections, type MetaphysicsPromptMethod } from './prompt-guidance';

export interface MetaphysicsPromptOptions {
  method: MetaphysicsPromptMethod;
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
  question: string | undefined,
  options: MetaphysicsPromptOptions,
): string {
  const normalizedQuestion = question?.trim() || '请综合解读本次排盘的重点、风险与行动建议。';
  const contextText = formatPromptRealWorldContext(options.context);

  return appendTraditionalResearchNotice(
    [
      buildPromptGuidanceSections(options.method),
      '',
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
      '请直接回答【问题】，说明关键盘面依据，并给出可执行建议。',
      '',
      '【输出要求】',
      '先说结论，再展开依据和建议。',
    ].join('\n'),
  );
}
