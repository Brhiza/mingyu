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
  scope: z.literal('year').optional().describe('当前仅支持 year（年家）'),
  year: z.number().int().min(1900).max(2200).optional().describe('公元年（默认今年）'),
  ganZhi: z
    .string()
    .refine(isValidGanZhi, 'ganZhi 必须是有效的六十甲子')
    .optional()
    .describe('可选年干支；必须与公元年一致'),
  question: z.string().optional().describe('希望 AI 重点解读的问题'),
});

export function registerTaiyiTool(server: McpServer) {
  server.registerTool(
    'metaphysics_taiyi',
    {
      description:
        '年家太乙神数：按七十二局立成表推算积年、太乙、文昌、始击、计神、主客算与十六神盘',
      inputSchema: taiyiSchema.shape,
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        const year = args.year ?? new Date().getFullYear();
        const result = taiyi.generateTaiyi({
          scope: 'year',
          year,
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
        const year = args.year ?? new Date().getFullYear();
        const result = taiyi.generateTaiyi({
          scope: 'year',
          year,
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
