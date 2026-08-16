import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { generateLiuren } from 'mingyu-core/divination/liuren';
import { calculationDetailShape, resultOutputSchema } from '../schemas.js';
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

const liurenPromptSchema = extendPromptSchema(liurenSchema, 'liuren', '用户希望围绕课盘解读的问题');

export function registerLiurenTool(server: McpServer) {
  server.registerTool(
    'divine_liuren',
    {
      description:
        '大六壬排盘：基于当前时间或自定义时间生成完整的天盘、四课、三传、月将、贵人、旬空等信息，含格局标签与断课模板',
      inputSchema: { ...liurenSchema.shape, ...calculationDetailShape },
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        const result = {
          ...generateLiuren(readMcpCustomDate(args.customDate)),
          template: args.liurenTemplate || 'general',
        };
        return createStructuredToolResult({ result }, args.detailMode);
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '排盘失败'));
      }
    },
  );

  server.registerTool(
    'liuren_prompt',
    {
      description:
        '大六壬排盘并生成可直接复制给 AI 的完整提示词，仅返回提示词；需要课盘数据时调用 divine_liuren',
      inputSchema: liurenPromptSchema.shape,
      outputSchema: {
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
            schools: args.schools,
          }),
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '生成大六壬提示词失败'));
      }
    },
  );
}
