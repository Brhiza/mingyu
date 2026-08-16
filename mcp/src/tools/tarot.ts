import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { calculationDetailShape, resultOutputSchema } from '../schemas.js';
import {
  createErrorToolResult,
  createStructuredToolResult,
  getErrorMessage,
} from '../tool-results.js';
import { buildCommonDivinationPrompt, extendPromptSchema } from './divination-common.js';
import { buildTarotSpread } from './divination-common.js';
import { randomOptionShape, readMcpRandomOptions } from './random-options.js';

const tarotSchema = z.object({
  ...randomOptionShape,
  spreadType: z
    .enum([
      'single',
      'three',
      'love',
      'career',
      'decision',
      'celtic',
      'chakra',
      'year',
      'mindBodySpirit',
      'horseshoe',
    ])
    .optional()
    .describe(
      '牌阵类型：single=单牌指引, three=时间流, love=爱情, career=事业, decision=选择, celtic=凯尔特十字, chakra=七脉轮, year=年运, mindBodySpirit=身心灵, horseshoe=马蹄铁',
    ),
});

const tarotPromptSchema = extendPromptSchema(tarotSchema, 'tarot', '用户希望围绕牌阵解读的问题');

export function registerTarotTool(server: McpServer) {
  server.registerTool(
    'divine_tarot',
    {
      description: '塔罗牌抽牌：从 78 张塔罗牌中洗牌抽牌，支持单牌指引和多种牌阵，含正逆位与关键词',
      inputSchema: { ...tarotSchema.shape, ...calculationDetailShape },
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        const result = buildTarotSpread(args.spreadType || 'single', readMcpRandomOptions(args));
        return createStructuredToolResult({ result }, args.detailMode);
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '抽牌失败'));
      }
    },
  );

  server.registerTool(
    'tarot_prompt',
    {
      description:
        '塔罗抽牌并生成可直接复制给 AI 的完整提示词，仅返回提示词；需要牌阵数据时调用 divine_tarot',
      inputSchema: tarotPromptSchema.shape,
      outputSchema: {
        prompt: z.string().describe('可直接用于 AI 解读的结构化提示词'),
      },
    },
    async (args) => {
      try {
        const result = buildTarotSpread(args.spreadType || 'single', readMcpRandomOptions(args));
        return createStructuredToolResult({
          result,
          prompt: buildCommonDivinationPrompt('tarot', args.question, result, args.promptMode, {
            schools: args.schools,
          }),
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '生成塔罗提示词失败'));
      }
    },
  );
}
