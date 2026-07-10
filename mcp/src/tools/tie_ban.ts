import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { tieban } from 'mingyu-core';
import { resultOutputSchema, promptOutputSchema } from '../schemas.js';
import {
  createErrorToolResult,
  createStructuredToolResult,
  getErrorMessage,
} from '../tool-results.js';
import { buildMetaphysicsPrompt } from '../metaphysics-prompt.js';

const tiebanSchema = z.object({
  year: z.number().int().min(1900).max(2200).optional().describe('公元年（默认今年）'),
  month: z.number().int().min(1).max(12).optional().describe('月'),
  day: z.number().int().min(1).max(31).optional().describe('日'),
  hour: z.number().int().min(0).max(23).optional().describe('时'),
  minute: z.number().int().min(0).max(59).optional().describe('分'),
  gender: z.enum(['male', 'female']).optional().describe('性别，默认男'),
  keOffset: z.number().int().min(-3).max(3).optional().describe('考刻校正（一刻=15分）'),
  question: z.string().optional().describe('希望 AI 重点解读的问题'),
});

export function registerTiebanTool(server: McpServer) {
  server.registerTool(
    'metaphysics_tieban',
    {
      description:
        '铁板神数：以出生时刻起先天/后天卦，按太玄数与考时定刻生成条文号码，查考父母、兄弟、妻妾、子息等条文',
      inputSchema: tiebanSchema.shape,
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        const year = args.year ?? new Date().getFullYear();
        const result = tieban.generateTieban({
          date: new Date(
            year,
            (args.month ?? 1) - 1,
            args.day ?? 1,
            args.hour ?? 0,
            args.minute ?? 0,
          ),
          minute: args.minute ?? 0,
          gender: args.gender ?? 'male',
          ...(args.keOffset !== undefined ? { keOffset: args.keOffset } : {}),
        });
        return createStructuredToolResult({ result });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '铁板推算失败'));
      }
    },
  );

  server.registerTool(
    'tieban_prompt',
    {
      description: '铁板神数排盘并生成结构化 AI 解读提示词',
      inputSchema: tiebanSchema.shape,
      outputSchema: promptOutputSchema,
    },
    async (args) => {
      try {
        const year = args.year ?? new Date().getFullYear();
        const result = tieban.generateTieban({
          date: new Date(
            year,
            (args.month ?? 1) - 1,
            args.day ?? 1,
            args.hour ?? 0,
            args.minute ?? 0,
          ),
          minute: args.minute ?? 0,
          gender: args.gender ?? 'male',
          ...(args.keOffset !== undefined ? { keOffset: args.keOffset } : {}),
        });
        return createStructuredToolResult({
          result,
          prompt: buildMetaphysicsPrompt(result.prompt, args.question),
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '生成铁板提示词失败'));
      }
    },
  );
}
