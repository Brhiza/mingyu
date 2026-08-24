import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { taiyi } from 'mingyu-core';
import { isValidGanZhi } from 'mingyu-core/ganzhi';
import { calculationDetailShape, resultOutputSchema, promptOutputSchema } from '../schemas.js';
import {
  createErrorToolResult,
  createStructuredToolResult,
  getErrorMessage,
} from '../tool-results.js';
import { buildMetaphysicsPrompt } from '../metaphysics-prompt.js';
import { createPromptSchoolsShape } from './school-options.js';
import { readMcpCustomDate } from './input-helpers.js';

const taiyiSchema = z.object({
  scope: z
    .enum(['year', 'month', 'day', 'hour'])
    .optional()
    .describe('太乙计式：year 年计（默认）、month 月计、day 日计、hour 时计'),
  year: z.number().int().min(1900).max(2200).optional().describe('公元年；年计必填'),
  customDate: z
    .string()
    .optional()
    .describe('月计、日计、时计的排盘时间（ISO 8601 格式）；不提供则使用当前时间'),
  ganZhi: z
    .string()
    .refine(isValidGanZhi, 'ganZhi 必须是有效的六十甲子')
    .optional()
    .describe('可选本计干支；必须与年份或日期一致'),
  question: z.string().optional().describe('希望 AI 重点解读的问题'),
});

function calculateTaiyi(args: z.infer<typeof taiyiSchema>) {
  const scope = args.scope ?? 'year';
  if (scope === 'year') {
    if (args.year === undefined) {
      throw new Error('太乙年计必须提供公历年份。');
    }
    return taiyi.generateTaiyi({
      scope,
      year: args.year,
      ...(args.ganZhi ? { ganZhi: args.ganZhi } : {}),
    });
  }

  return taiyi.generateTaiyi({
    scope,
    date: readMcpCustomDate(args.customDate) ?? new Date(),
    ...(args.ganZhi ? { ganZhi: args.ganZhi } : {}),
  });
}

export function registerTaiyiTool(server: McpServer) {
  server.registerTool(
    'metaphysics_taiyi',
    {
      description: '太乙神数四计：按年、月、日、时生成七十二局式盘',
      inputSchema: { ...taiyiSchema.shape, ...calculationDetailShape },
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        const result = calculateTaiyi(args);
        return createStructuredToolResult({ result }, args.detailMode);
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '太乙排盘失败'));
      }
    },
  );

  server.registerTool(
    'taiyi_prompt',
    {
      description: '太乙神数排盘并生成结构化 AI 解读提示词',
      inputSchema: { ...taiyiSchema.shape, ...createPromptSchoolsShape('taiyi') },
      outputSchema: promptOutputSchema,
    },
    async (args) => {
      try {
        const result = calculateTaiyi(args);
        return createStructuredToolResult({
          result,
          prompt: buildMetaphysicsPrompt(result.prompt, args.question, {
            method: 'taiyi',
            schools: args.schools,
          }),
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '生成太乙提示词失败'));
      }
    },
  );
}
