import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { generateXiaoliuren } from 'mingyu-core/divination/xiaoliuren';
import { resultOutputSchema } from '../schemas.js';
import {
  createErrorToolResult,
  createStructuredToolResult,
  getErrorMessage,
} from '../tool-results.js';
import { buildCommonDivinationPrompt, extendPromptSchema } from './divination-common.js';
import { readMcpCustomDate } from './input-helpers.js';

const xiaoliurenSchema = z.object({
  xiaoliurenMethod: z
    .enum(['time'])
    .optional()
    .describe('起课方式：仅支持通行掌诀时间起课'),
  customDate: z
    .string()
    .optional()
    .describe('自定义起课时间（ISO 8601 格式），不提供则使用当前时间'),
});

const xiaoliurenPromptSchema = extendPromptSchema(
  xiaoliurenSchema,
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
        '小六壬原始时间事实：返回时间、干支、农历月日、时辰序号及版本边界，不自动落宫或提供歌诀',
      inputSchema: xiaoliurenSchema.shape,
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        const result = generateXiaoliuren(buildXiaoliurenInput(args));
        return createStructuredToolResult({ result });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '小六壬起课失败'));
      }
    },
  );

  server.registerTool(
    'xiaoliuren_prompt',
    {
      description:
        '生成小六壬原始时间事实与待校边界提示词；AI 须先明确具体版本和规则才能继续推算',
      inputSchema: xiaoliurenPromptSchema.shape,
      outputSchema: {
        result: z.unknown().describe('小六壬课盘数据'),
        prompt: z.string().describe('可直接用于 AI 解读的结构化提示词'),
      },
    },
    async (args) => {
      try {
        const result = generateXiaoliuren(buildXiaoliurenInput(args));
        return createStructuredToolResult({
          result,
          prompt: buildCommonDivinationPrompt('xiaoliuren', args.question, result, args.promptMode),
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '生成小六壬提示词失败'));
      }
    },
  );
}
