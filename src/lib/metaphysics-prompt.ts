import { formatPromptCurrentTime } from './prompt-time';
import { buildPromptGuidanceSections, type MetaphysicsPromptMethod } from './prompt-guidance';

export interface MetaphysicsPromptOptions {
  method: MetaphysicsPromptMethod;
  measurement?: string;
  currentTime?: Date;
}

export function buildMetaphysicsPrompt(
  basePrompt: string,
  question: string | undefined,
  options: MetaphysicsPromptOptions,
): string {
  const normalizedQuestion = question?.trim() ?? '';
  const questionSection = normalizedQuestion ? ['', '【问题】', normalizedQuestion] : [];

  return [
    buildPromptGuidanceSections(options.method),
    '',
    '【当前时间】',
    formatPromptCurrentTime(options.currentTime),
    '',
    basePrompt,
    ...(options.measurement ? ['', '【测量换算】', options.measurement] : []),
    ...questionSection,
    '',
    '【任务】',
    '请依据盘面资料和传统依据完成解读。',
  ]
    .flat()
    .filter((line): line is string => typeof line === 'string' && line !== '')
    .join('\n');
}
