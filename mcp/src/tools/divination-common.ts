import { z } from 'zod';
import { drawSingleCard, drawSpreadCards, getCardKeywords } from 'mingyu-core/divination/tarot';
import type { RandomOptions } from 'mingyu-core/types';
import type { tarotSpreads } from 'mingyu-core/divination/tarot';
import { PROMPT_MODES } from '../../../src/lib/public-api/prompt-builders.js';
import type { PromptMode } from '../../../src/lib/public-api/prompt-builders.js';
import { buildDivinationPromptText } from './prompt-helpers.js';

type TarotSpreadKey = keyof typeof tarotSpreads;

export function extendPromptSchema<T extends z.ZodRawShape>(
  baseSchema: z.ZodObject<T>,
  questionDescription = '用户希望围绕结果解读的问题',
) {
  return baseSchema.extend({
    question: z.string().describe(questionDescription),
    promptMode: z
      .enum(PROMPT_MODES)
      .optional()
      .describe('提示词模式：framework=内置完整框架, custom=只围绕用户问题自由作答'),
  });
}

export function extendOptionalQuestionPromptSchema<T extends z.ZodRawShape>(
  baseSchema: z.ZodObject<T>,
  questionDescription = '用户希望围绕结果解读的问题',
) {
  return baseSchema.extend({
    question: z.string().optional().describe(questionDescription),
    promptMode: z
      .enum(PROMPT_MODES)
      .optional()
      .describe('提示词模式：framework=内置完整框架, custom=只围绕用户问题自由作答'),
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
  });
}

export function buildTarotSpread(spreadType: TarotSpreadKey, options?: RandomOptions) {
  if (spreadType === 'single') {
    const draw = drawSingleCard(options);
    return {
      spreadType: 'single',
      spreadName: '单牌指引',
      cards: [
        {
          id: draw.card.number,
          name: draw.card.name,
          position: draw.position,
          reversed: draw.isReversed,
          keywords: getCardKeywords(draw.card.name).split(','),
        },
      ],
      timestamp: draw.timestamp,
      meta: draw.meta,
    };
  }

  const draw = drawSpreadCards(spreadType, options);
  return {
    spreadType: draw.spreadType,
    spreadName: draw.spreadName,
    cards: draw.cards.map((item) => ({
      id: item.card.number,
      name: item.card.name,
      position: item.position,
      reversed: item.isReversed,
      keywords: getCardKeywords(item.card.name).split(','),
    })),
    timestamp: draw.timestamp,
    meta: draw.meta,
  };
}
