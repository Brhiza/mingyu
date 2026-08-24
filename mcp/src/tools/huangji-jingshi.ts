import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { huangjiJingshi } from 'mingyu-core';
import { calculationDetailShape, resultOutputSchema, promptOutputSchema } from '../schemas.js';
import {
  createErrorToolResult,
  createStructuredToolResult,
  getErrorMessage,
} from '../tool-results.js';
import { createPromptSchoolsShape } from './school-options.js';
import { readMcpCustomDate } from './input-helpers.js';

const safeInteger = z.number().int().refine(Number.isSafeInteger, '必须是安全范围内的整数');

const huangjiJingshiSchema = z.object({
  customDate: z
    .string()
    .optional()
    .describe('年月日时起盘时间（ISO 8601 格式）；必须带时区，北京时间建议明确提供 +08:00'),
  epochYear: safeInteger.optional().describe('可选的自定义纪元年坐标；省略时按通行公元值年卦排法'),
  year: safeInteger.optional().describe('目标公元年或自定义纪元下的目标整数年坐标'),
  elapsedYears: safeInteger
    .min(0)
    .optional()
    .describe('自定义纪元下距第一年已经过的完整年数；仅与 epochYear 同时使用'),
  question: z.string().min(1).optional().describe('希望 AI 重点解释的问题'),
});

function calculateHuangjiJingshi(args: z.infer<typeof huangjiJingshiSchema>) {
  if (args.customDate !== undefined) {
    if (
      args.epochYear !== undefined ||
      args.year !== undefined ||
      args.elapsedYears !== undefined
    ) {
      throw new Error('皇极经世年月日时起盘不得同时提供 epochYear、year 或 elapsedYears。');
    }
  } else if (args.epochYear === undefined) {
    if (args.year === undefined || args.elapsedYears !== undefined) {
      throw new Error('皇极经世通行公元模式必须只提供 year。');
    }
  } else if ((args.year === undefined) === (args.elapsedYears === undefined)) {
    throw new Error('皇极经世自定义纪元模式的 year 与 elapsedYears 必须且只能提供一个。');
  }
  return huangjiJingshi.calculateHuangjiJingshi({
    ...(args.customDate ? { date: readMcpCustomDate(args.customDate) } : {}),
    ...(args.epochYear !== undefined ? { epochYear: args.epochYear } : {}),
    ...(args.year !== undefined ? { year: args.year } : {}),
    ...(args.elapsedYears !== undefined ? { elapsedYears: args.elapsedYears } : {}),
    ...(args.question ? { question: args.question } : {}),
  });
}

export function registerHuangjiJingshiTool(server: McpServer) {
  server.registerTool(
    'metaphysics_huangji_jingshi',
    {
      description:
        '皇极经世排盘：customDate 返回元会运世至月经、旬纬、日卦、时经卦的年月日时盘；year 兼容值年盘，也支持自定义纪元换算',
      inputSchema: {
        ...huangjiJingshiSchema.omit({ question: true }).shape,
        ...calculationDetailShape,
      },
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        const result = calculateHuangjiJingshi(args);
        return createStructuredToolResult({ result }, args.detailMode);
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '皇极经世周期换算失败'));
      }
    },
  );

  server.registerTool(
    'huangji_jingshi_prompt',
    {
      description: '皇极经世完整排盘并生成可直接交给 AI 解读的自包含任务书',
      inputSchema: {
        ...huangjiJingshiSchema.shape,
        ...createPromptSchoolsShape('huangji-jingshi'),
      },
      outputSchema: promptOutputSchema,
    },
    async (args) => {
      try {
        const result = calculateHuangjiJingshi(args);
        return createStructuredToolResult({
          result,
          prompt: huangjiJingshi.buildHuangjiJingshiPrompt(result, args.question, args.schools),
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '生成皇极经世提示词失败'));
      }
    },
  );
}
