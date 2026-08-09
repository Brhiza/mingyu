import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { drawRandomSign } from 'mingyu-core/divination/ssgw';
import { calculationDetailShape, resultOutputSchema } from '../schemas.js';
import {
  createErrorToolResult,
  createStructuredToolResult,
  getErrorMessage,
} from '../tool-results.js';
import { buildCommonDivinationPrompt, extendPromptSchema } from './divination-common.js';
import { randomOptionShape, readMcpRandomOptions } from './random-options.js';

const ssgwSchema = z.object({ ...randomOptionShape });

const ssgwPromptSchema = extendPromptSchema(ssgwSchema, '用户希望围绕灵签解读的问题');

export function registerSsgwTool(server: McpServer) {
  server.registerTool(
    'divine_ssgw',
    {
      description: '三山国王灵签求签：随机取一签并返回签号、签题与签诗原文。',
      inputSchema: { ...ssgwSchema.shape, ...calculationDetailShape },
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        const result = drawRandomSign(readMcpRandomOptions(args));
        return createStructuredToolResult({ result }, args.detailMode);
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '求签失败'));
      }
    },
  );

  server.registerTool(
    'ssgw_prompt',
    {
      description:
        '三山国王灵签求签并生成可直接复制给 AI 的完整提示词，仅返回提示词；需要签号、签题与签诗原文时调用 divine_ssgw',
      inputSchema: ssgwPromptSchema.shape,
      outputSchema: {
        prompt: z.string().describe('可直接用于 AI 解读的结构化提示词'),
      },
    },
    async (args) => {
      try {
        const result = drawRandomSign(readMcpRandomOptions(args));
        return createStructuredToolResult({
          result,
          prompt: buildCommonDivinationPrompt('ssgw', args.question, result, args.promptMode),
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '生成灵签提示词失败'));
      }
    },
  );
}
