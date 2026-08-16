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

const taiyiSchema = z.object({
  scope: z.literal('year').optional().describe('太乙计式；当前只开放已校勘的年计'),
  year: z.number().int().min(1900).max(2200).optional().describe('公元年；年计必填'),
  ganZhi: z
    .string()
    .refine(isValidGanZhi, 'ganZhi 必须是有效的六十甲子')
    .optional()
    .describe('可选本计干支；必须与年份或日期一致'),
  question: z.string().optional().describe('希望 AI 重点解读的问题'),
});

export function registerTaiyiTool(server: McpServer) {
  server.registerTool(
    'metaphysics_taiyi',
    {
      description: '太乙神数年计：按积年与阳遁七十二局立成表生成式盘',
      inputSchema: { ...taiyiSchema.shape, ...calculationDetailShape },
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        if (args.year === undefined) {
          throw new Error('太乙年计必须提供公历年份。');
        }
        const result = taiyi.generateTaiyi({
          scope: 'year',
          year: args.year,
          ...(args.ganZhi ? { ganZhi: args.ganZhi } : {}),
        });
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
        if (args.year === undefined) {
          throw new Error('太乙年计必须提供公历年份。');
        }
        const result = taiyi.generateTaiyi({
          scope: 'year',
          year: args.year,
          ...(args.ganZhi ? { ganZhi: args.ganZhi } : {}),
        });
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
