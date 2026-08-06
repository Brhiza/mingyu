import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { wuyunLiuqi } from 'mingyu-core';
import { isValidGanZhi } from 'mingyu-core/ganzhi';
import { resultOutputSchema, promptOutputSchema } from '../schemas.js';
import {
  createErrorToolResult,
  createStructuredToolResult,
  getErrorMessage,
} from '../tool-results.js';

const wuyunLiuqiSchema = z.object({
  year: z.number().int().min(1).max(9999).optional().describe('公历年，按该年年中所属年柱换算'),
  yearGanZhi: z
    .string()
    .refine(isValidGanZhi, 'yearGanZhi 必须是有效的六十甲子')
    .optional()
    .describe('明确年干支，如「丙午」；与 year 同时提供会校验一致性'),
  question: z.string().min(1).optional().describe('希望 AI 重点解释的问题'),
});

function calculateWuyunLiuqi(args: z.infer<typeof wuyunLiuqiSchema>) {
  if (args.year === undefined && args.yearGanZhi === undefined) {
    throw new Error('五运六气必须提供 year 或 yearGanZhi。');
  }
  return wuyunLiuqi.calculateWuyunLiuqi(args);
}

export function registerWuyunLiuqiTool(server: McpServer) {
  server.registerTool(
    'metaphysics_wuyun_liuqi',
    {
      description: '五运六气年度计算：返回岁运太过不及、司天在泉及六步主客气',
      inputSchema: wuyunLiuqiSchema.omit({ question: true }).shape,
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        const result = calculateWuyunLiuqi(args);
        return createStructuredToolResult({ result });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '五运六气计算失败'));
      }
    },
  );

  server.registerTool(
    'wuyun_liuqi_prompt',
    {
      description: '五运六气年度计算并生成可直接交给 AI 的完整任务书',
      inputSchema: wuyunLiuqiSchema.shape,
      outputSchema: promptOutputSchema,
    },
    async (args) => {
      try {
        const result = calculateWuyunLiuqi(args);
        return createStructuredToolResult({ result, prompt: result.prompt });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '生成五运六气提示词失败'));
      }
    },
  );
}
