import { buildDivinationPrompt } from '../../../src/lib/divination/engine/index.js';
import type { AstrolabePromptTopic } from '../../../src/lib/astrolabe-prompts.js';
import type { DivinationMethodId } from '@core/divination/config';
import type { PromptMode } from '../../../src/lib/public-api/prompt-builders.js';
import type {
  DivinationData,
  LiuyaoTemplateType,
  LiurenTemplateType,
  SupplementaryInfo,
} from '../../../src/types/divination.js';
import {
  buildPromptSelectionTask,
  getPromptSelectionSection,
  requirePromptSelection,
  type PromptSelection,
} from 'mingyu-core/prompt';

export function readMcpPromptSelection(args: {
  methodId: string;
  topicId?: string;
  subtopicId?: string;
  scope?: string;
}): PromptSelection | undefined {
  if (args.topicId === undefined && args.subtopicId === undefined && args.scope === undefined) {
    return undefined;
  }
  return requirePromptSelection({
    methodId: args.methodId,
    topicId: args.topicId,
    subtopicId: args.subtopicId,
    scope: args.scope,
  });
}

export function applyMcpPromptSelection(
  prompt: string,
  selection: PromptSelection | undefined,
  fallbackTask: string,
) {
  if (!selection) return prompt;
  const taskMatch = /【任务】\n([\s\S]*?)(?=\n\n【问题】|$)/u.exec(prompt);
  const task = taskMatch?.[1]?.trim() || fallbackTask;
  const replacement = [
    `【解读选择】\n${getPromptSelectionSection(selection)}`,
    `【任务】\n${buildPromptSelectionTask(task, selection)}`,
  ].join('\n\n');
  return taskMatch ? prompt.replace(taskMatch[0], replacement) : `${prompt}\n\n${replacement}`;
}

export function buildDivinationPromptText(params: {
  method: Exclude<DivinationMethodId, 'random'>;
  question: string;
  data: unknown;
  supplementaryInfo?: SupplementaryInfo;
  liuyaoTemplate?: LiuyaoTemplateType;
  liurenTemplate?: LiurenTemplateType;
  promptMode?: PromptMode;
  astrolabeTopic?: AstrolabePromptTopic;
  astrolabeScopeText?: string;
  schools?: readonly string[];
  topicId?: string;
  subtopicId?: string;
  scope?: string;
}) {
  return buildDivinationPrompt(
    params.method,
    params.question,
    params.data as DivinationData,
    params.supplementaryInfo,
    {
      isCustomQuestion: params.promptMode === 'custom',
      liuyaoTemplate: params.liuyaoTemplate,
      liurenTemplate: params.liurenTemplate,
      astrolabeTopic: params.astrolabeTopic,
      astrolabeScopeText: params.astrolabeScopeText,
      schools: params.schools,
      topicId: params.topicId,
      subtopicId: params.subtopicId,
      scope: params.scope,
    },
  );
}
