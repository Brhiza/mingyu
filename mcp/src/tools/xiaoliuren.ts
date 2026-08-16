import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { generateXiaoliuren } from 'mingyu-core/divination/xiaoliuren';
import { calculationDetailShape, resultOutputSchema } from '../schemas.js';
import {
  createErrorToolResult,
  createStructuredToolResult,
  getErrorMessage,
} from '../tool-results.js';
import { buildCommonDivinationPrompt, extendPromptSchema } from './divination-common.js';
import { readMcpCustomDate } from './input-helpers.js';

const xiaoliurenSchema = z.object({
  xiaoliurenMethod: z.enum(['time']).optional().describe('起课方式：仅支持通行掌诀时间起课'),
  customDate: z
    .string()
    .optional()
    .describe('自定义起课时间（ISO 8601 格式），不提供则使用当前时间'),
});

const xiaoliurenPromptSchema = extendPromptSchema(
  xiaoliurenSchema,
  'xiaoliuren',
  '用户希望围绕小六壬结果解读的问题',
);

function buildXiaoliurenInput(args: z.infer<typeof xiaoliurenSchema>) {
  return {
    method: args.xiaoliurenMethod || 'time',
    customDate: readMcpCustomDate(args.customDate),
  };
}

export function registerXiaoliurenTool(server: McpServer) {
  server.registerTool(
    'divine_xiaoliuren',
    {
      description:
        '小六壬通行时间课：按农历月、日、时辰逐步顺数，返回时宫歌诀与来源、历法和解释限制',
      inputSchema: { ...xiaoliurenSchema.shape, ...calculationDetailShape },
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        const result = generateXiaoliuren(buildXiaoliurenInput(args));
        return createStructuredToolResult({ result }, args.detailMode);
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '小六壬起课失败'));
      }
    },
  );

  server.registerTool(
    'xiaoliuren_prompt',
    {
      description:
        '小六壬起课并生成可直接复制给 AI 的完整提示词，仅返回提示词；需要课盘结果时调用 divine_xiaoliuren',
      inputSchema: xiaoliurenPromptSchema.shape,
      outputSchema: {
        prompt: z.string().describe('可直接用于 AI 解读的结构化提示词'),
      },
    },
    async (args) => {
      try {
        const result = generateXiaoliuren(buildXiaoliurenInput(args));
        return createStructuredToolResult({
          result,
          prompt: buildCommonDivinationPrompt(
            'xiaoliuren',
            args.question,
            result,
            args.promptMode,
            {
              schools: args.schools,
            },
          ),
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '生成小六壬提示词失败'));
      }
    },
  );
}
