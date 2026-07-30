import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { generateLiuren } from 'mingyu-core/divination/liuren';
import { resultOutputSchema } from '../schemas.js';
import {
  createErrorToolResult,
  createStructuredToolResult,
  getErrorMessage,
} from '../tool-results.js';
import { buildCommonDivinationPrompt, extendPromptSchema } from './divination-common.js';
import { readMcpCustomDate } from './input-helpers.js';

const liurenSchema = z.object({
  customDate: z
    .string()
    .optional()
    .describe('自定义排盘时间（ISO 8601 格式），不提供则使用当前时间'),
  liurenTemplate: z
    .enum(['general', 'ganqing', 'shiye', 'caifu'])
    .optional()
    .describe('断课模板：general=通用, ganqing=感情, shiye=事业, caifu=财富'),
});

const liurenPromptSchema = extendPromptSchema(liurenSchema, '用户希望围绕课盘解读的问题');

export function registerLiurenTool(server: McpServer) {
  server.registerTool(
    'divine_liuren',
    {
      description:
        '大六壬排盘：基于当前时间或自定义时间生成完整的天盘、四课、三传、月将、贵人、旬空等信息，含起盘口径与版本边界、格局标签和断课模板',
      inputSchema: liurenSchema.shape,
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        const result = {
          ...generateLiuren(readMcpCustomDate(args.customDate)),
          template: args.liurenTemplate || 'general',
        };
        return createStructuredToolResult({ result });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '排盘失败'));
      }
    },
  );

  server.registerTool(
    'liuren_prompt',
    {
      description:
        '大六壬排盘并生成 AI 解读提示词：一次调用返回含起盘口径与版本边界的课盘数据和可直接复制给 AI 的提示词',
      inputSchema: liurenPromptSchema.shape,
      outputSchema: {
        result: z.unknown().describe('大六壬课盘数据'),
        prompt: z.string().describe('可直接用于 AI 解读的结构化提示词'),
      },
    },
    async (args) => {
      try {
        const template = args.liurenTemplate || 'general';
        const result = { ...generateLiuren(readMcpCustomDate(args.customDate)), template };
        return createStructuredToolResult({
          result,
          prompt: buildCommonDivinationPrompt('liuren', args.question, result, args.promptMode, {
            liurenTemplate: template,
          }),
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '生成大六壬提示词失败'));
      }
    },
  );
}
