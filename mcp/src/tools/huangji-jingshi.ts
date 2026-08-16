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

const safeInteger = z.number().int().refine(Number.isSafeInteger, '必须是安全范围内的整数');

const huangjiJingshiSchema = z.object({
  epochYear: safeInteger.optional().describe('可选的自定义纪元年坐标；省略时按通行公元值年卦排法'),
  year: safeInteger.optional().describe('目标公元年或自定义纪元下的目标整数年坐标'),
  elapsedYears: safeInteger
    .min(0)
    .optional()
    .describe('自定义纪元下距第一年已经过的完整年数；仅与 epochYear 同时使用'),
  question: z.string().min(1).optional().describe('希望 AI 重点解释的问题'),
});

function calculateHuangjiJingshi(args: z.infer<typeof huangjiJingshiSchema>) {
  if (args.epochYear === undefined) {
    if (args.year === undefined || args.elapsedYears !== undefined) {
      throw new Error('皇极经世通行公元模式必须只提供 year。');
    }
  } else if ((args.year === undefined) === (args.elapsedYears === undefined)) {
    throw new Error('皇极经世自定义纪元模式的 year 与 elapsedYears 必须且只能提供一个。');
  }
  return huangjiJingshi.calculateHuangjiJingshi(args);
}

export function registerHuangjiJingshiTool(server: McpServer) {
  server.registerTool(
    'metaphysics_huangji_jingshi',
    {
      description:
        '皇极经世排盘：普通公元年直接返回元会运世、统卦、运卦、十年卦和值年卦；也支持自定义纪元换算',
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
