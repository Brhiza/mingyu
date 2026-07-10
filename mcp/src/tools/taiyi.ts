import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { taiyi } from 'mingyu-core';
import { isValidGanZhi } from 'mingyu-core/ganzhi';
import { resultOutputSchema, promptOutputSchema } from '../schemas.js';
import {
  createErrorToolResult,
  createStructuredToolResult,
  getErrorMessage,
} from '../tool-results.js';
import { buildMetaphysicsPrompt } from '../metaphysics-prompt.js';

const taiyiSchema = z.object({
  scope: z
    .enum(['year', 'month', 'day', 'hour', 'minute'])
    .optional()
    .describe('太乙计式，默认年计'),
  year: z.number().int().min(1900).max(2200).optional().describe('公元年（默认今年）'),
  dateTime: z.string().optional().describe('月计、日计、时计、分计所需的 ISO 8601 日期时间'),
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
      description: '太乙神数五计：按七十二局立成表生成年计、月计、日计、时计或分计式盘',
      inputSchema: taiyiSchema.shape,
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        const scope = args.scope ?? 'year';
        const year = args.year ?? new Date().getFullYear();
        const date = args.dateTime ? new Date(args.dateTime) : undefined;
        if (scope !== 'year' && (!date || Number.isNaN(date.getTime()))) {
          throw new Error('月计、日计、时计和分计需要有效的 dateTime。');
        }
        const result = taiyi.generateTaiyi({
          scope,
          ...(scope === 'year' ? { year } : { date }),
          ...(args.ganZhi ? { ganZhi: args.ganZhi } : {}),
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
        const scope = args.scope ?? 'year';
        const year = args.year ?? new Date().getFullYear();
        const date = args.dateTime ? new Date(args.dateTime) : undefined;
        if (scope !== 'year' && (!date || Number.isNaN(date.getTime()))) {
          throw new Error('月计、日计、时计和分计需要有效的 dateTime。');
        }
        const result = taiyi.generateTaiyi({
          scope,
          ...(scope === 'year' ? { year } : { date }),
          ...(args.ganZhi ? { ganZhi: args.ganZhi } : {}),
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
