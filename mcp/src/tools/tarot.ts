import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { resultOutputSchema } from '../schemas.js';
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

const tarotPromptSchema = extendPromptSchema(tarotSchema, '用户希望围绕牌阵解读的问题');

export function registerTarotTool(server: McpServer) {
  server.registerTool(
    'divine_tarot',
    {
      description: '塔罗抽牌记录：从项目内部1至78牌号目录中抽牌，返回牌号、牌名、牌位、正逆位、抽取顺序和随机轨迹。逐牌牌义版本校勘完成前不返回关键词、牌义、元素、牌阶或组合结论',
      inputSchema: tarotSchema.shape,
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        const result = buildTarotSpread(args.spreadType || 'single', readMcpRandomOptions(args));
        return createStructuredToolResult({ result });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '抽牌失败'));
      }
    },
  );

  server.registerTool(
    'tarot_prompt',
    {
      description:
        '塔罗抽牌并生成结构化 AI 核对提示词：返回可复算的牌号、牌名、牌位、正逆位与抽取轨迹，并要求 AI 先明确牌组版本和牌义文献后再继续解读',
      inputSchema: tarotPromptSchema.shape,
      outputSchema: {
        result: z.unknown().describe('塔罗牌阵数据'),
        prompt: z.string().describe('可直接用于 AI 解读的结构化提示词'),
      },
    },
    async (args) => {
      try {
        const result = buildTarotSpread(args.spreadType || 'single', readMcpRandomOptions(args));
        return createStructuredToolResult({
          result,
          prompt: buildCommonDivinationPrompt('tarot', args.question, result, args.promptMode),
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '生成塔罗提示词失败'));
      }
    },
  );
}
