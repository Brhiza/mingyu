import { z } from 'zod';
import { drawTarotSpread } from 'mingyu-core/divination/tarot';
import type { RandomOptions } from 'mingyu-core/types';
import type { tarotSpreads } from 'mingyu-core/divination/tarot';
import { PROMPT_MODES, PROMPT_SCOPE_IDS } from '../../../src/lib/public-api/prompt-builders.js';
import type { PromptMode } from '../../../src/lib/public-api/prompt-builders.js';
import { buildDivinationPromptText } from './prompt-helpers.js';
import type { PromptSchoolMethod } from 'mingyu-core/prompt';
import { createPromptSchoolsShape } from './school-options.js';

type TarotSpreadKey = keyof typeof tarotSpreads;

export function extendPromptSchema<T extends z.ZodRawShape>(
  baseSchema: z.ZodObject<T>,
  method: PromptSchoolMethod,
  questionDescription = '用户希望围绕结果解读的问题',
) {
  return baseSchema.extend({
    ...createPromptSchoolsShape(method),
    question: z.string().describe(questionDescription),
    promptMode: z
      .enum(PROMPT_MODES)
      .optional()
      .describe('提示词模式：framework=内置主题任务, custom=用户问题加通用短答题框架'),
    topicId: z.string().optional().describe('统一解读主题 ID'),
    subtopicId: z.string().optional().describe('统一解读主题细项 ID；必须属于所选主题'),
    scope: z.enum(PROMPT_SCOPE_IDS).optional().describe('统一解读资料范围'),
  });
}

export function extendOptionalQuestionPromptSchema<T extends z.ZodRawShape>(
  baseSchema: z.ZodObject<T>,
  method: PromptSchoolMethod,
  questionDescription = '用户希望围绕结果解读的问题',
) {
  return baseSchema.extend({
    ...createPromptSchoolsShape(method),
    question: z.string().optional().describe(questionDescription),
    promptMode: z
      .enum(PROMPT_MODES)
      .optional()
      .describe('提示词模式：framework=内置主题任务, custom=用户问题加通用短答题框架'),
    topicId: z.string().optional().describe('统一解读主题 ID'),
    subtopicId: z.string().optional().describe('统一解读主题细项 ID；必须属于所选主题'),
    scope: z.enum(PROMPT_SCOPE_IDS).optional().describe('统一解读资料范围'),
  });
}

export function buildCommonDivinationPrompt(
  method: string,
  question: string,
  data: unknown,
  promptMode?: string,
  options?: {
    liuyaoTemplate?: string;
    liurenTemplate?: string;
    astrolabeTopic?: string;
    astrolabeScopeText?: string;
    schools?: readonly string[];
    topicId?: string;
    subtopicId?: string;
    scope?: string;
  },
) {
  return buildDivinationPromptText({
    method: method as Parameters<typeof buildDivinationPromptText>[0]['method'],
    question,
    data,
    promptMode: (promptMode ?? 'framework') as PromptMode,
    liuyaoTemplate: options?.liuyaoTemplate as Parameters<
      typeof buildDivinationPromptText
    >[0]['liuyaoTemplate'],
    liurenTemplate: options?.liurenTemplate as Parameters<
      typeof buildDivinationPromptText
    >[0]['liurenTemplate'],
    astrolabeTopic: options?.astrolabeTopic as Parameters<
      typeof buildDivinationPromptText
    >[0]['astrolabeTopic'],
    astrolabeScopeText: options?.astrolabeScopeText,
    schools: options?.schools,
    topicId: options?.topicId,
    subtopicId: options?.subtopicId,
    scope: options?.scope,
  });
}

export function buildTarotSpread(spreadType: TarotSpreadKey, options?: RandomOptions) {
  return drawTarotSpread(spreadType, options);
}
