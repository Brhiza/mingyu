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
  year: z.number().int().min(1900).max(2200).optional().describe('公元年；年计必填'),
  dateTime: z.string().optional().describe('月计、日计、时计、分计所需的 ISO 8601 日期时间'),
  ganZhi: z
    .string()
    .refine(isValidGanZhi, 'ganZhi 必须是有效的六十甲子')
    .optional()
    .describe('可选本计干支；必须与年份或日期一致'),
  question: z.string().optional().describe('希望 AI 重点解读的问题'),
});

function parseTaiyiDateTime(scope: z.infer<typeof taiyiSchema>['scope'], dateTime?: string) {
  if (scope === 'year') return undefined;
  if (!dateTime || !/T\d{2}:\d{2}/u.test(dateTime)) {
    throw new Error('月计、日计、时计和分计需要包含具体时分的有效 dateTime。');
  }
  const date = new Date(dateTime);
  if (Number.isNaN(date.getTime())) {
    throw new Error('月计、日计、时计和分计需要包含具体时分的有效 dateTime。');
  }
  return date;
}

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
        if (scope === 'year' && args.year === undefined) {
          throw new Error('太乙年计必须提供公历年份。');
        }
        const date = parseTaiyiDateTime(scope, args.dateTime);
        const result = taiyi.generateTaiyi({
          scope,
          ...(args.year !== undefined ? { year: args.year } : {}),
          ...(scope !== 'year' ? { date } : {}),
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
        if (scope === 'year' && args.year === undefined) {
          throw new Error('太乙年计必须提供公历年份。');
        }
        const date = parseTaiyiDateTime(scope, args.dateTime);
        const result = taiyi.generateTaiyi({
          scope,
          ...(args.year !== undefined ? { year: args.year } : {}),
          ...(scope !== 'year' ? { date } : {}),
          ...(args.ganZhi ? { ganZhi: args.ganZhi } : {}),
        });
        return createStructuredToolResult({
          result,
          prompt: buildMetaphysicsPrompt(result.prompt, args.question, { method: 'taiyi' }),
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '生成太乙提示词失败'));
      }
    },
  );
}
