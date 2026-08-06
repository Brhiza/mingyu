import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { huangjiJingshi } from 'mingyu-core';
import { resultOutputSchema, promptOutputSchema } from '../schemas.js';
import {
  createErrorToolResult,
  createStructuredToolResult,
  getErrorMessage,
} from '../tool-results.js';

const safeInteger = z.number().int().refine(Number.isSafeInteger, '必须是安全范围内的整数');

const huangjiJingshiSchema = z.object({
  epochYear: safeInteger.describe('某一元第一年的整数坐标，必须明确提供'),
  year: safeInteger.optional().describe('目标整数年坐标，与 elapsedYears 二选一'),
  elapsedYears: safeInteger
    .min(0)
    .optional()
    .describe('距纪元第一年已经过的完整年数，0 表示第一年；与 year 二选一'),
  question: z.string().min(1).optional().describe('希望 AI 重点解释的问题'),
});

function calculateHuangjiJingshi(args: z.infer<typeof huangjiJingshiSchema>) {
  if ((args.year === undefined) === (args.elapsedYears === undefined)) {
    throw new Error('皇极经世的 year 与 elapsedYears 必须且只能提供一个。');
  }
  return huangjiJingshi.calculateHuangjiJingshi(args);
}

export function registerHuangjiJingshiTool(server: McpServer) {
  server.registerTool(
    'metaphysics_huangji_jingshi',
    {
      description: '皇极经世周期换算：按明确纪元返回元会运世位置与各层起止年坐标',
      inputSchema: huangjiJingshiSchema.omit({ question: true }).shape,
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        const result = calculateHuangjiJingshi(args);
        return createStructuredToolResult({ result });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '皇极经世周期换算失败'));
      }
    },
  );

  server.registerTool(
    'huangji_jingshi_prompt',
    {
      description: '皇极经世周期换算并生成可直接交给 AI 的完整任务书',
      inputSchema: huangjiJingshiSchema.shape,
      outputSchema: promptOutputSchema,
    },
    async (args) => {
      try {
        const result = calculateHuangjiJingshi(args);
        return createStructuredToolResult({ result, prompt: result.prompt });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '生成皇极经世提示词失败'));
      }
    },
  );
}
