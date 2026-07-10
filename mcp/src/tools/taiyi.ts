import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { taiyi } from 'mingyu-core';
import { resultOutputSchema, promptOutputSchema } from '../schemas.js';
import {
  createErrorToolResult,
  createStructuredToolResult,
  getErrorMessage,
} from '../tool-results.js';
import { buildMetaphysicsPrompt } from '../metaphysics-prompt.js';

const taiyiSchema = z.object({
  scope: z.enum(['year', 'month', 'day', 'hour']).optional().describe('家数，默认 year（年家）'),
  year: z.number().int().min(1900).max(2200).optional().describe('公元年（默认今年）'),
  month: z.number().int().min(1).max(12).optional().describe('月（月家太乙用）'),
  day: z.number().int().min(1).max(31).optional().describe('日（日家太乙用）'),
  hour: z.number().int().min(0).max(23).optional().describe('时（时家太乙用）'),
  ganZhi: z.string().optional().describe('直接给定干支（年/月/日/时家对应的那一柱）'),
  question: z.string().optional().describe('希望 AI 重点解读的问题'),
});

export function registerTaiyiTool(server: McpServer) {
  server.registerTool(
    'metaphysics_taiyi',
    {
      description:
        '太乙神数排盘（三式之一）：推算积年、阴阳遁七十二局、太乙落宫、文昌始击、主客算、十六神盘与掩迫击格',
      inputSchema: taiyiSchema.shape,
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        const year = args.year ?? new Date().getFullYear();
        const date = args.ganZhi
          ? undefined
          : new Date(year, (args.month ?? 2) - 1, args.day ?? 4, args.hour ?? 0);
        const result = taiyi.generateTaiyi({
          scope: args.scope ?? 'year',
          year,
          ...(args.ganZhi ? { ganZhi: args.ganZhi } : { date }),
        });
        return createStructuredToolResult({ result });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '太乙排盘失败'));
      }
    },
  );

  server.registerTool(
    'taiyi_prompt',
    {
      description: '太乙神数排盘并生成结构化 AI 解读提示词',
      inputSchema: taiyiSchema.shape,
      outputSchema: promptOutputSchema,
    },
    async (args) => {
      try {
        const year = args.year ?? new Date().getFullYear();
        const date = args.ganZhi
          ? undefined
          : new Date(year, (args.month ?? 2) - 1, args.day ?? 4, args.hour ?? 0);
        const result = taiyi.generateTaiyi({
          scope: args.scope ?? 'year',
          year,
          ...(args.ganZhi ? { ganZhi: args.ganZhi } : { date }),
        });
        return createStructuredToolResult({
          result,
          prompt: buildMetaphysicsPrompt(result.prompt, args.question),
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '生成太乙提示词失败'));
      }
    },
  );
}
